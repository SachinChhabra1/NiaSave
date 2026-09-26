import {createHash,createHmac,randomUUID,randomBytes,timingSafeEqual} from 'node:crypto';
import {CommerceError} from './core.mjs';

export const SAVE_BOOK_SCHEMA=1;
export const emptySaveBook=()=>({schemaVersion:SAVE_BOOK_SCHEMA,inventory:[],orders:[],events:[],requests:{}});
const fail=(code,status=400)=>{throw new CommerceError(code,status);};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clone=value=>structuredClone(value);
const text=(value,max=160)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max;
const identifier=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,99}$/.test(value);
const key=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{16,100}$/.test(value);
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const fresh=(value,age,now)=>date(value)&&Date.parse(value)<=now+1000&&now-Date.parse(value)<=age;
const itemKey=row=>JSON.stringify([row.siteCode,row.sku]);
const activeOrder=(order,now)=>order.status==='reserved'&&Date.parse(order.expiresAt)>now;
const held=(book,row,now)=>book.orders.filter(o=>o.siteCode===row.siteCode&&activeOrder(o,now))
  .reduce((n,o)=>n+o.lines.filter(l=>l.sku===row.sku).reduce((n,l)=>n+l.qty,0),0);
const effect=(order,now)=>order.status==='reserved'&&!activeOrder(order,now)?'expired':order.status;

export function assertSaveBook(book){
  if(!book||book.schemaVersion!==SAVE_BOOK_SCHEMA||!Array.isArray(book.inventory)||
    !Array.isArray(book.orders)||!Array.isArray(book.events)||!book.requests||typeof book.requests!=='object'||Array.isArray(book.requests))
    fail('save_book_invalid',503);
  const inventoryKeys=new Set(),orderIds=new Set();
  for(const item of book.inventory){
    if(!item||!identifier(item.siteCode)||!identifier(item.sku)||!identifier(item.productId)||!text(item.name)||!text(item.pack,100)||
      !Number.isSafeInteger(item.pricePaise)||item.pricePaise<1||!Number.isInteger(item.onHand)||item.onHand<0||
      !Number.isInteger(item.revision)||item.revision<1||typeof item.active!=='boolean'||!date(item.countedAt)||!date(item.priceVerifiedAt)||
      inventoryKeys.has(itemKey(item)))fail('save_book_invalid',503);
    inventoryKeys.add(itemKey(item));
  }
  for(const order of book.orders){
    if(!order||!text(order.id,100)||orderIds.has(order.id)||!text(order.memberSubject,200)||!identifier(order.siteCode)||
      !['reserved','cancelled','completed'].includes(order.status)||!Number.isInteger(order.revision)||order.revision<1||
      !date(order.expiresAt)||!date(order.createdAt)||!date(order.updatedAt)||!Array.isArray(order.lines)||!order.lines.length||
      order.lines.some(line=>!identifier(line?.sku)||!identifier(line.id)||!Number.isInteger(line.qty)||line.qty<1||
        !Number.isSafeInteger(line.pricePaise)||line.pricePaise<1)||
      !Number.isSafeInteger(order.totalPaise)||order.totalPaise!==order.lines.reduce((sum,l)=>sum+l.pricePaise*l.qty,0))
      fail('save_book_invalid',503);
    if(order.payment&&(order.status!=='completed'||order.payment.status!=='received'||order.payment.amountPaise!==order.totalPaise||
      order.payment.method!=='at_pickup'||order.payment.bankSettlementVerified!==false||!date(order.payment.receivedAt)))fail('save_book_invalid',503);
    orderIds.add(order.id);
  }
  return book;
}
export function saveContext(subject,reply,now=Date.now()){
  if(!text(subject,200)||!fresh(reply?.asOf,60000,now)||!Number.isInteger(reply.freshnessSeconds)||
    reply.freshnessSeconds<1||reply.freshnessSeconds>60||!Array.isArray(reply.locations))fail('member_location_unverified',403);
  const locations=reply.locations.map(loc=>{
    if(!identifier(loc.siteCode)||!identifier(loc.locationId)||!text(loc.name)||!text(loc.address,500)||
      !Number.isInteger(loc.serviceRevision)||loc.serviceRevision<1||!Array.isArray(loc.modes)||
      !date(loc.windowStartAt)||!date(loc.windowEndAt)||Date.parse(loc.windowEndAt)<=Date.parse(loc.windowStartAt)||
      !Number.isInteger(loc.reserveMinutes)||loc.reserveMinutes<15||loc.reserveMinutes>180)
      fail('member_location_unverified',403);
    return {...clone(loc),modes:loc.modes.filter(mode=>mode==='pickup')};
  });
  if(new Set(locations.map(l=>l.siteCode)).size!==locations.length||new Set(locations.map(l=>l.locationId)).size!==locations.length)
    fail('member_location_unverified',403);
  return {subject,locations,expiresAt:Math.min(Date.parse(reply.asOf)+reply.freshnessSeconds*1000,now+60000)};
}
function contextReady(context,now){if(!context||context.expiresAt<now)fail('member_location_unverified',403);}
function locationFor(context,locationId,now){
  contextReady(context,now);
  const loc=context.locations.find(l=>l.locationId===locationId&&l.modes.includes('pickup'));
  if(!loc)fail('member_location_unverified',403);
  return loc;
}
export function saveStaffActor(actor,reply,now=Date.now()){
  if(!actor||!identifier(actor.id)||!['admin','operator','reader'].includes(actor.role)||
    !fresh(reply?.asOf,60000,now)||reply.freshnessSeconds!==60||!Array.isArray(reply.sites)||reply.sites.length>300)
    fail('staff_scope_unavailable',403);
  const sites=reply.sites.map(site=>{
    if(!identifier(site?.siteCode)||!text(site.name)||!text(site.theatre,100))fail('staff_scope_unavailable',403);
    return {siteCode:site.siteCode,name:site.name,theatre:site.theatre};
  });
  if(new Set(sites.map(s=>s.siteCode)).size!==sites.length)fail('staff_scope_unavailable',403);
  return {id:actor.id,role:actor.role,sites,scopeExpiresAt:Date.parse(reply.asOf)+60000};
}
function staff(actor,now=Date.now()){
  if(!actor||!(actor.role==='admin'||actor.canWriteSave===true)||!identifier(actor.id))fail('admin_access_required',403);
  if(!Array.isArray(actor.sites)||actor.scopeExpiresAt<now)fail('staff_scope_unavailable',403);
}
function inScope(actor,siteCode){return actor.sites?.some(site=>site.siteCode===siteCode);}
function remember(book,scope,requestKey,request,perform){
  if(!key(requestKey))fail('idempotency_key_required');
  const id=hash([scope,requestKey]),fingerprint=hash(request),old=book.requests[id];
  if(old){if(old.hash!==fingerprint)fail('idempotency_key_reused',409);return clone(old.result);}
  const result=perform();book.requests[id]={hash:fingerprint,result:clone(result)};return result;
}
function inventoryRows(rows,now){
  if(!Array.isArray(rows)||!rows.length||rows.length>100)fail('invalid_inventory_rows');
  const keys=new Set(),products=new Set();
  return rows.map((row,index)=>{
    const allowed=['siteCode','sku','productId','name','pack','pricePaise','onHand','countedAt','priceVerifiedAt','active','expectedRevision','evidence'];
    if(!row||typeof row!=='object'||Object.keys(row).some(k=>!allowed.includes(k))||
      !identifier(row.siteCode)||!identifier(row.sku)||!identifier(row.productId)||!text(row.name)||
      !text(row.pack,100)||/to be confirmed/i.test(row.pack)||!Number.isSafeInteger(row.pricePaise)||row.pricePaise<1||row.pricePaise>100000000||
      !Number.isInteger(row.onHand)||row.onHand<0||row.onHand>1000000||typeof row.active!=='boolean'||
      !Number.isInteger(row.expectedRevision)||row.expectedRevision<0||
      (row.evidence!==undefined&&!text(row.evidence,500))||
      !fresh(row.countedAt,86400000,now)||!fresh(row.priceVerifiedAt,30*86400000,now))
      fail('invalid_inventory_row_'+(index+1));
    const id=itemKey(row),product=JSON.stringify([row.siteCode,row.productId]);
    if(keys.has(id)||products.has(product))fail('duplicate_inventory_row_'+(index+1));
    keys.add(id);products.add(product);
    return Object.fromEntries(allowed.map(k=>[k,row[k]]));
  });
}
export function previewInventory(book,actor,rows,now=Date.now()){
  assertSaveBook(book);staff(actor,now);
  const normalized=inventoryRows(rows,now);
  for(const row of normalized){
    if(!inScope(actor,row.siteCode))fail('site_access_required',403);
    const current=book.inventory.find(i=>itemKey(i)===itemKey(row));
    if((current?.revision||0)!==row.expectedRevision)fail('revision_conflict',409);
    if(book.inventory.some(i=>i.siteCode===row.siteCode&&i.productId===row.productId&&i.sku!==row.sku))fail('product_id_conflict',409);
    if(row.onHand<held(book,row,now))fail('count_below_reserved_stock',409);
  }
  return {owner:'niasave',rows:normalized,previewHash:hash(normalized),rowCount:normalized.length,
    asOf:new Date(now).toISOString(),stockMeaning:'Physical on-hand including reserved units; collection deducts stock.'};
}
export function publishInventory(book,actor,input,now=Date.now()){
  staff(actor,now);
  if(!Array.isArray(input.rows)||input.rows.some(row=>!inScope(actor,row?.siteCode)))fail('site_access_required',403);
  return remember(book,'staff:'+actor.id,input.idempotencyKey,{kind:'inventory-publish',rows:input.rows,previewHash:input.previewHash},()=>{
    const preview=previewInventory(book,actor,input.rows,now);
    if(preview.previewHash!==input.previewHash)fail('inventory_preview_changed',409);
    for(const row of preview.rows){
      const index=book.inventory.findIndex(i=>itemKey(i)===itemKey(row));
      const {expectedRevision,...fields}=row;
      const value={...fields,revision:expectedRevision+1,updatedAt:new Date(now).toISOString(),updatedBy:actor.id};
      if(index<0)book.inventory.push(value);else book.inventory[index]=value;
    }
    const event={id:randomUUID(),kind:'inventory-published',actor:actor.id,at:new Date(now).toISOString(),
      previewHash:preview.previewHash,rows:clone(preview.rows)};
    book.events.push(event);
    return {owner:'niasave',published:preview.rowCount,eventId:event.id,asOf:event.at};
  });
}
export function catalogueFromBook(book,context,now=Date.now()){
  assertSaveBook(book);contextReady(context,now);
  const locations=context.locations.filter(l=>l.modes.includes('pickup')).map(l=>({id:l.locationId,sourceSiteCode:l.siteCode,
    name:l.name,address:l.address,modes:['pickup'],windowStart:l.windowStartAt,windowEnd:l.windowEndAt,
    windowOpen:now>=Date.parse(l.windowStartAt)&&now<Date.parse(l.windowEndAt),serviceRevision:l.serviceRevision}));
  const products=book.inventory.filter(i=>i.active&&locations.some(l=>l.sourceSiteCode===i.siteCode)&&
    fresh(i.countedAt,86400000,now)&&fresh(i.priceVerifiedAt,30*86400000,now)).map(i=>({
      id:i.productId,sourceSku:i.sku,sourceSiteCode:i.siteCode,name:i.name,pack:i.pack,pricePaise:i.pricePaise,
      price:i.pricePaise/100,available:Math.max(0,i.onHand-held(book,i,now)),revision:i.revision,
      locationIds:locations.filter(l=>l.sourceSiteCode===i.siteCode).map(l=>l.id),modes:['pickup']}));
  // Existing storefront identifies products by one id. Never ambiguously combine sites.
  if(new Set(products.map(p=>p.id)).size!==products.length)fail('catalogue_location_ambiguous',409);
  return {owner:'niasave',preview:false,ready:products.length>0,locations,products,asOf:new Date(now).toISOString(),
    payment:'upi_at_handover',onlinePayment:false,whatsapp:false};
}
function quoteSignature(quote,secret){
  if(typeof secret!=='string'||secret.length<32)fail('save_signing_not_configured',503);
  return createHmac('sha256',secret).update('niasave-save-quote-v1\n'+JSON.stringify(quote)).digest('hex');
}
function quoteValue(book,context,body,now){
  if(body?.fulfillment!=='pickup')fail('pickup_only');
  const loc=locationFor(context,body.locationId,now);
  if(now<Date.parse(loc.windowStartAt)||now>=Date.parse(loc.windowEndAt))fail('collection_window_closed',409);
  if(!Array.isArray(body.lines)||!body.lines.length||body.lines.length>20||
    new Set(body.lines.map(l=>l?.id)).size!==body.lines.length)fail('invalid_bag');
  const lines=body.lines.map(line=>{
    if(!identifier(line?.id)||!Number.isInteger(line.qty)||line.qty<1||line.qty>100)fail('invalid_bag');
    const item=book.inventory.find(i=>i.siteCode===loc.siteCode&&i.productId===line.id);
    if(!item||!item.active||!fresh(item.countedAt,86400000,now)||!fresh(item.priceVerifiedAt,30*86400000,now))fail('catalogue_unavailable',409);
    if(item.onHand-held(book,item,now)<line.qty)fail('insufficient_stock',409);
    return {id:item.productId,sku:item.sku,name:item.name,pack:item.pack,qty:line.qty,
      pricePaise:item.pricePaise,revision:item.revision};
  });
  const totalPaise=lines.reduce((sum,l)=>sum+l.pricePaise*l.qty,0);
  if(!Number.isSafeInteger(totalPaise)||totalPaise<1)fail('invalid_amount');
  return {subject:context.subject,siteCode:loc.siteCode,locationId:loc.locationId,serviceRevision:loc.serviceRevision,
    mode:'pickup',lines,totalPaise,quotedAt:new Date(now).toISOString(),
    quoteExpiresAt:new Date(Math.min(now+120000,Date.parse(loc.windowEndAt))).toISOString(),
    expiresAt:new Date(Math.min(now+loc.reserveMinutes*60000,Date.parse(loc.windowEndAt))).toISOString()};
}
export function quoteFromBook(book,context,body,secret,now=Date.now()){
  assertSaveBook(book);const quote=quoteValue(book,context,body,now);
  const loc=locationFor(context,body.locationId,now);
  return {owner:'niasave',location:{id:loc.locationId,name:loc.name,address:loc.address},
    lines:quote.lines.map(l=>({...l,nia:l.pricePaise/100})),amount:quote.totalPaise/100,totalPaise:quote.totalPaise,
    expiresAt:quote.expiresAt,fingerprint:JSON.stringify({quote,signature:quoteSignature(quote,secret)})};
}
export function publicSaveOrder(order,now=Date.now()){
  return {id:order.id,pickupCode:order.pickupCode,location:clone(order.location),source:'niasave',
    lines:order.lines.map(l=>({id:l.id,sku:l.sku,name:l.name,pack:l.pack,qty:l.qty,nia:l.pricePaise/100,pricePaise:l.pricePaise,revision:l.revision})),
    amount:order.totalPaise/100,totalPaise:order.totalPaise,status:effect(order,now),revision:order.revision,
    createdAt:order.createdAt,updatedAt:order.updatedAt,expiresAt:order.expiresAt,...(order.payment?{payment:clone(order.payment)}:{})};
}
export function reserveFromBook(book,context,body,requestKey,secret,now=Date.now()){
  assertSaveBook(book);contextReady(context,now);
  return remember(book,'member:'+context.subject,requestKey,{kind:'reserve',body},()=>{
    let envelope;try{envelope=JSON.parse(body.fingerprint);}catch{fail('invalid_quote');}
    const quote=envelope?.quote,signature=envelope?.signature;
    if(!quote||typeof signature!=='string'||!/^[a-f0-9]{64}$/.test(signature)||
      !timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(quoteSignature(quote,secret),'hex')))fail('invalid_quote');
    if(quote.subject!==context.subject||!fresh(quote.quotedAt,120000,now)||Date.parse(quote.quoteExpiresAt)<=now)fail('quote_expired',409);
    const current=quoteValue(book,context,body,now);
    if(quote.locationId!==current.locationId||quote.siteCode!==current.siteCode||quote.mode!==current.mode||
      quote.serviceRevision!==current.serviceRevision||hash(quote.lines)!==hash(current.lines)||quote.totalPaise!==current.totalPaise)
      fail('price_or_details_changed',409);
    if(book.orders.filter(o=>o.memberSubject===context.subject&&activeOrder(o,now)).length>=3)fail('too_many_active_orders',409);
    const loc=locationFor(context,body.locationId,now),id=randomUUID();
    const order={id,pickupCode:randomBytes(6).toString('hex').toUpperCase(),memberSubject:context.subject,
      siteCode:loc.siteCode,location:{id:loc.locationId,name:loc.name,address:loc.address,
        windowStart:loc.windowStartAt,windowEnd:loc.windowEndAt},lines:clone(current.lines),
      totalPaise:current.totalPaise,status:'reserved',revision:1,createdAt:new Date(now).toISOString(),
      updatedAt:new Date(now).toISOString(),expiresAt:new Date(Math.min(Date.parse(quote.expiresAt),Date.parse(current.expiresAt))).toISOString()};
    book.orders.push(order);book.events.push({id:randomUUID(),orderId:id,kind:'reserved',actor:context.subject,at:order.createdAt});
    return publicSaveOrder(order,now);
  });
}
export function memberOrders(book,context,now=Date.now()){
  assertSaveBook(book);contextReady(context,now);
  return {owner:'niasave',orders:book.orders.filter(o=>o.memberSubject===context.subject).map(o=>publicSaveOrder(o,now)).reverse(),paymentsEnabled:false};
}
export function retrySaveRequest(book,context,requestKey,now=Date.now()){
  contextReady(context,now);if(!key(requestKey))fail('idempotency_key_required');
  const old=book.requests[hash(['member:'+context.subject,requestKey])];
  if(!old)fail('request_not_found',404);return clone(old.result);
}
export function cancelFromBook(book,context,input,requestKey,now=Date.now()){
  contextReady(context,now);
  return remember(book,'member:'+context.subject,requestKey,{kind:'cancel',input},()=>{
    const order=book.orders.find(o=>o.id===input.orderId&&o.memberSubject===context.subject);
    if(!order)fail('order_not_found',404);
    if(order.revision!==input.expectedRevision)fail('revision_conflict',409);
    if(!activeOrder(order,now))fail('order_not_cancellable',409);
    order.status='cancelled';order.revision++;order.updatedAt=new Date(now).toISOString();
    book.events.push({id:randomUUID(),orderId:order.id,kind:'cancelled',actor:context.subject,at:order.updatedAt});
    return publicSaveOrder(order,now);
  });
}
export function completeFromBook(book,actor,input,now=Date.now()){
  staff(actor,now);
  const target=book.orders.find(o=>o.id===input.orderId);
  if(!target||!inScope(actor,target.siteCode))fail('order_not_found',404);
  return remember(book,'staff:'+actor.id,input.idempotencyKey,{kind:'complete',input},()=>{
    const order=book.orders.find(o=>o.id===input.orderId);
    if(!order)fail('order_not_found',404);
    if(order.revision!==input.expectedRevision)fail('revision_conflict',409);
    if(!activeOrder(order,now))fail('order_not_collectable',409);
    if(input.pickupCode!==order.pickupCode||input.amountPaise!==order.totalPaise||
      !text(input.paymentEvidence,500)||!text(input.handoverEvidence,500))fail('pickup_payment_and_handover_required',409);
    if(book.events.some(e=>e.kind==='completed'&&e.paymentEvidence===input.paymentEvidence))fail('payment_evidence_already_used',409);
    for(const line of order.lines){
      const item=book.inventory.find(i=>i.siteCode===order.siteCode&&i.sku===line.sku);
      if(!item||item.onHand<line.qty)fail('stock_conflict',409);
    }
    for(const line of order.lines){
      const item=book.inventory.find(i=>i.siteCode===order.siteCode&&i.sku===line.sku);
      item.onHand-=line.qty;item.revision++;item.updatedAt=new Date(now).toISOString();item.updatedBy=actor.id;
    }
    order.status='completed';order.revision++;order.updatedAt=new Date(now).toISOString();
    order.payment={status:'received',amountPaise:order.totalPaise,receivedAt:order.updatedAt,method:'at_pickup',bankSettlementVerified:false};
    book.events.push({id:randomUUID(),kind:'completed',orderId:order.id,actor:actor.id,at:order.updatedAt,
      paymentEvidence:input.paymentEvidence,handoverEvidence:input.handoverEvidence});
    const {pickupCode,...receipt}=publicSaveOrder(order,now);
    return receipt;
  });
}
export function staffSaveSnapshot(book,actor,now=Date.now()){
  assertSaveBook(book);
  if(!Array.isArray(actor?.sites)||actor.scopeExpiresAt<now)fail('staff_scope_unavailable',403);
  const inventory=book.inventory.filter(i=>inScope(actor,i.siteCode));
  const orders=book.orders.filter(o=>inScope(actor,o.siteCode));
  const base={owner:'niasave',schemaVersion:SAVE_BOOK_SCHEMA,asOf:new Date(now).toISOString(),
    sites:clone(actor.sites),counts:{products:inventory.length,orders:orders.length,reserved:orders.filter(o=>activeOrder(o,now)).length,
      completed:orders.filter(o=>o.status==='completed').length},onlinePayment:false};
  if(!['admin','operator'].includes(actor?.role)&&!actor?.canWriteSave)return base;
  return {...base,inventory:inventory.map(i=>({...clone(i),reserved:held(book,i,now),available:Math.max(0,i.onHand-held(book,i,now))})),
    orders:orders.map(o=>{const {pickupCode,...view}=publicSaveOrder(o,now);return {...view,
      siteCode:o.siteCode,mode:'pickup',reservedAt:o.createdAt};}).reverse()};
}

export function saveSummary(book,version,requestedMonth,now=Date.now()){
  assertSaveBook(book);
  const monthOf=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit'})
    .formatToParts(new Date(value)).filter(p=>['year','month'].includes(p.type)).sort((a,b)=>a.type==='year'?-1:1).map(p=>p.value).join('-');
  const month=requestedMonth??monthOf(now);
  if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))fail('invalid_month');
  const grouped=new Map();
  for(const order of book.orders){
    if(order.status!=='completed'||!order.payment||monthOf(order.payment.receivedAt)!==month)continue;
    for(const line of order.lines){
      const key=JSON.stringify([order.siteCode,line.sku]);
      const row=grouped.get(key)||{month,siteCode:order.siteCode,sku:line.sku,quantity:0,revenuePaise:0,costPaise:null,savingsPaise:null};
      row.quantity+=line.qty;row.revenuePaise+=line.qty*line.pricePaise;
      if(!Number.isSafeInteger(row.quantity)||!Number.isSafeInteger(row.revenuePaise))fail('summary_amount_overflow',503);
      grouped.set(key,row);
    }
  }
  return {owner:'niasave',schemaVersion:1,sourceReady:version>0,version,asOf:new Date(now).toISOString(),month,
    stockRows:book.inventory.map(i=>({siteCode:i.siteCode,sku:i.sku,onHand:i.onHand,reserved:held(book,i,now),
      available:Math.max(0,i.onHand-held(book,i,now)),active:i.active,countedAt:i.countedAt})),
    completedRows:[...grouped.values()],counts:{orders:book.orders.length,
      completed:book.orders.filter(o=>o.status==='completed'&&o.payment&&monthOf(o.payment.receivedAt)===month).length,
      reserved:book.orders.filter(o=>activeOrder(o,now)).length}};
}
