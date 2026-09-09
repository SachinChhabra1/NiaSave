import { goodsCategory } from '../../commerce-categories.js';
import { randomUUID, randomBytes, createHash } from 'node:crypto';

export class CommerceError extends Error {
  constructor(code, status = 400) { super(code); this.status = status; }
}
const fail = (code, status) => { throw new CommerceError(code, status); };
export const hash = value => createHash('sha256').update(String(value)).digest('hex');
const active = new Set(['reserved', 'packed', 'loaded', 'at_stop', 'return_pending']);
const terminal = new Set(['cancelled', 'expired', 'returned']);
const iso = time => new Date(time).toISOString();
const descriptions = {
  groundnut_oil: ['Groundnut oil', 'मूंगफली का तेल', 'Cooking', 'oil'],
  mustard_oil: ['Mustard oil', 'सरसों का तेल', 'Cooking', 'oil'],
  sunflower_oil: ['Sunflower oil', 'सूरजमुखी का तेल', 'Cooking', 'oil'],
  coconut_oil: ['Coconut oil', 'नारियल का तेल', 'Personal care', 'oil'],
  detergent_pick: ['Laundry detergent', 'कपड़े धोने का पाउडर', 'Home care', 'wash'],
  nia_detergent: ['Nia detergent', 'निया डिटर्जेंट', 'Home care', 'wash'],
  bathsoap_pick: ['Bath soap', 'नहाने का साबुन', 'Personal care', 'soap'],
  nia_bathsoap: ['Nia bath soap', 'निया नहाने का साबुन', 'Personal care', 'soap'],
  toothpaste_pick: ['Toothpaste', 'टूथपेस्ट', 'Personal care', 'paste'],
  essentials_pick: ['Essentials pack', 'ज़रूरी सामान का पैक', 'Home care', 'bag'],
};
export function initialise(s, skus, preview, time) {
  if (!s.commerce) s.commerce = { sessions: {}, accounts: {}, requests: {}, limits: {}, tickets: [], audit: [], config: null };
  const c = s.commerce;
  if (preview && !c.config) c.config = {
    verified: false, beatDate: s.beat.beatDate, reserveMinutes: 120,
    locations: [{ id: 'S01', name: 'Preview pickup point', address: 'Illustrative location · no real collection', modes: ['pickup', 'delivery'], windowStart: iso(time), windowEnd: iso(time + 86400000) }],
    products: skus.map(p => ({ id: p.id, name: descriptions[p.id][0], hindi: descriptions[p.id][1], category: descriptions[p.id][2], illustration: descriptions[p.id][3], pack: 'Pack size to be confirmed' })),
    staffLocations: {},
    support: 'Visit your Nia pickup team for help.'
  };
  return c;
}
export function expire(s, time) {
  for (const o of s.orders) {
    if (o.source !== 'commerce' || !active.has(o.status) || Date.parse(o.expiresAt) > time || o.status === 'return_pending') continue;
    o.status = o.status === 'reserved' ? 'expired' : 'return_pending';
    o.updatedAt = iso(time);
    s.commerce.audit.push({ orderId: o.id, action: o.status, actor: 'expiry', at: iso(time) });
  }
  s.reservations = s.reservations.filter(r => !terminal.has(s.orders.find(o => o.id === r.orderId)?.status));
}
function committed(s, id) {
  return s.orders.filter(o => o.beatDate === s.beat.beatDate && !['cancelled','expired','returned','missed'].includes(o.status)).reduce((sum,o) => sum + o.lines.filter(l => l.id === id).reduce((n,l) => n + l.qty, 0), 0);
}
function stock(s, id) { return Math.max(0, (s.beat.opening[id] || 0) - committed(s,id)); }
const currentVerification=(value,time,maxAge)=>Number.isFinite(Date.parse(value)) && Date.parse(value)<=time+60000 && time-Date.parse(value)<=maxAge;
const verifiedProduct=p=>p.centralSource?.system==='rafiqi-central';
function freshProduct(p,time){return !verifiedProduct(p)||(currentVerification(p.verifiedAt,time,30*86400000)&&currentVerification(p.countedAt,time,86400000));}

export function catalogue(s, skus, preview, time) {
  const c = initialise(s, skus, preview, time);
  expire(s, time);
  const config = c.config;
  const ready = Boolean(config && (preview || config.verified) && config.beatDate === s.beat.beatDate && s.beat.open && !s.beat.closed);
  return {
    preview, ready, payment: 'upi_at_handover', onlinePayment: false, whatsapp: false,
    reserveMinutes: config?.reserveMinutes, support: config?.support || 'Please contact your Nia pickup team.',
    locations: ready ? config.locations.filter(l => Date.parse(l.windowEnd) > time) : [],
    products: ready ? config.products.map(p => ({ ...p, category:goodsCategory(p.category)||p.category, price: p.pricePaise!==undefined?p.pricePaise/100:skus.find(k => k.id === p.id)?.nia, available: freshProduct(p,time)?stock(s,p.id):0, opening:s.beat.opening[p.id]||0 })) : [],
  };
}
function member(actor) { if (!actor || actor.role !== 'member') fail('member_access_required',403); }
function orderFor(s, actor, id, staff = false) {
  const o = s.orders.find(o => o.id === id && o.source === 'commerce');
  if (!o || (!staff && o.memberId !== actor?.id)) fail('order_not_found',404);
  return o;
}
export function publicOrder(o) {
  return Object.fromEntries(['id','pickupCode','lines','amount','due','paid','payStatus','status','createdAt','updatedAt','expiresAt','location','fulfillment','payment','refund','preview'].map(k => [k,o[k]]));
}
export function listOrders(s, actor) { member(actor); return s.orders.filter(o => o.source === 'commerce' && o.memberId === actor.id).map(publicOrder).reverse(); }
function cleanLines(body, products) {
  if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 20) fail('invalid_bag');
  const seen = new Set();
  return body.lines.map(l => {
    if (!l || seen.has(l.id) || !Number.isSafeInteger(l.qty) || l.qty < 1 || l.qty > 10) fail('invalid_quantity');
    seen.add(l.id);
    const p = products.find(p => p.id === l.id);
    if (!p || !Number.isFinite(p.price) || p.price <= 0) fail('product_unavailable',409);
    if (p.available < l.qty) fail('stock_changed',409);
    return { id:p.id, name:p.name, pack:p.pack, qty:l.qty, nia:p.price, kirana:p.price, ...(p.sourceSku?{sourceSku:p.sourceSku,sourceSiteCode:p.sourceSiteCode}:{}) };
  }).sort((a,b) => a.id.localeCompare(b.id));
}
export function quote(s, actor, body, skus, preview, time) {
  member(actor);
  const cat = catalogue(s,skus,preview,time);
  if (!cat.ready) fail('ordering_not_open',409);
  const location = cat.locations.find(l => l.id === body.locationId && l.modes.includes(body.fulfillment));
  if (!location || !actor.locationIds?.includes(location.id)) fail('location_unavailable',409);
  if (time < Date.parse(location.windowStart)) fail('location_unavailable',409);
  if (body.fulfillment==='delivery' && location.deliveryPinCodes) {
    // Trust the verified account's assigned address, never a postcode supplied in the bag.
    const pin=actor.locationPinCodes?.[location.id];
    if (!pin || !location.deliveryPinCodes.includes(pin)) fail('delivery_location_unverified',409);
  }
  const lines = cleanLines(body,cat.products.filter(p=>!p.sourceSiteCode || p.sourceSiteCode===location.sourceSiteCode));
  const amount = lines.reduce((n,l) => n + Math.round(l.nia*100)*l.qty,0)/100;
  // Delivery is to the configured member location only. No arbitrary-address promise.
  const fingerprint = hash(JSON.stringify({ lines, amount, location, fulfillment:body.fulfillment }));
  return { lines, amount, location, fulfillment:body.fulfillment, fingerprint, expiresAt:iso(Math.min(Math.max(time,Date.parse(location.windowStart))+Math.min(cat.reserveMinutes,location.reserveMinutes||cat.reserveMinutes)*60000,Date.parse(location.windowEnd))) };
}
export function reserve(s, actor, body, key, skus, preview, time) {
  member(actor);
  if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(key)) fail('idempotency_key_required');
  const requestKey = hash(actor.id + ':' + key);
  const requestHash = hash(JSON.stringify(body));
  const existing = s.commerce.requests[requestKey];
  if (existing) {
    if (existing.hash !== requestHash) fail('idempotency_conflict',409);
    return publicOrder(orderFor(s,actor,existing.orderId));
  }
  const q = quote(s,actor,body,skus,preview,time);
  if (q.fingerprint !== body.fingerprint) fail('price_or_details_changed',409);
  if (s.orders.filter(o => o.memberId === actor.id && active.has(o.status)).length >= 3) fail('too_many_active_orders',409);
  let pickupCode;
  do { pickupCode = randomBytes(5).toString('hex').toUpperCase(); } while (s.orders.some(o => o.pickupCode === pickupCode));
  const o = { id:'ord-'+randomUUID(), source:'commerce', memberId:actor.id, member:actor.name,
    ...q, pickupCode, stopId:q.location.id, beatDate:s.beat.beatDate, slot:q.location.windowStart,
    createdAt:iso(time), updatedAt:iso(time), status:'reserved', payStatus:'unpaid', due:q.amount, paid:0,
    preview, method:'upi', cart:'studio', owner:'Sikh Unit', kept:0, date:iso(time).slice(0,10) };
  delete o.fingerprint;
  s.orders.push(o);
  s.ordersById?.set(o.id,o); s.ordersByCode?.set(o.pickupCode,o);
  if (s.orderIdsByStop) s.orderIdsByStop.set(o.stopId,[...(s.orderIdsByStop.get(o.stopId)||[]),o.id]);
  for (const l of o.lines) s.reservations.push({ orderId:o.id,sku:l.id,qty:l.qty,stopId:o.stopId,beatDate:o.beatDate });
  s.commerce.requests[requestKey] = { hash:requestHash,orderId:o.id };
  s.commerce.audit.push({ orderId:o.id,action:'reserved',actor:actor.id,at:iso(time) });
  return publicOrder(o);
}
export function cancel(s,actor,id,time) {
  member(actor); const o = orderFor(s,actor,id);
  if (o.status === 'cancelled') return publicOrder(o);
  if (o.status !== 'reserved') fail('contact_team_to_cancel',409);
  o.status = 'cancelled'; o.updatedAt = iso(time);
  s.reservations = s.reservations.filter(r => r.orderId !== id);
  s.commerce.audit.push({ orderId:id,action:'cancelled',actor:actor.id,at:iso(time) });
  return publicOrder(o);
}
export function staffAction(s,actor,body,time) {
  if (!actor?.staff) fail('staff_access_required',403);
  const o = orderFor(s,null,body.orderId,true);
  const audit = () => { o.updatedAt = iso(time); s.commerce.audit.push({ orderId:o.id,action:body.action,actor:actor.id,at:iso(time) }); };
  if (body.action === 'verify_payment') {
    const ref = String(body.reference || '').trim();
    if (!/^\d{12}$/.test(ref) || body.amount !== o.amount || body.receiptVerified !== true) fail('verify_exact_receipt_amount_and_reference');
    if (!['at_stop','collected'].includes(o.status)) fail('payment_only_at_handover',409);
    if (o.payment) {
      if (o.payment.reference === ref) return publicOrder(o);
      fail('payment_already_recorded',409);
    }
    if (s.orders.some(other => other.payment?.reference === ref) || s.payments.some(p => p.utr === ref)) fail('reference_already_used',409);
    o.payment = { reference:ref, amount:o.amount, verifiedBy:actor.id, verifiedAt:iso(time), method:'upi' };
    o.payStatus = 'verified'; o.paid = o.amount; o.due = 0;
    s.payments.push({ id:'pay-'+randomUUID(), orderId:o.id, amount:o.amount, utr:ref, method:'upi', at:iso(time), actor:actor.id });
    s.settlements.push({ id:'set-'+o.id, orderId:o.id, memberId:o.memberId, pickupCode:o.pickupCode, beatDate:o.beatDate, amount:o.amount, utr:ref, status:'open', matched:false, createdAt:iso(time), trigger:'staff_verified_upi' });
  } else if (body.action === 'record_refund') {
    const ref = String(body.reference || '').trim();
    if (!o.payment || o.status !== 'return_pending' || !/^\d{12}$/.test(ref) || body.amount !== o.amount || body.receiptVerified !== true) fail('verified_full_refund_required',409);
    if (o.refund) { if (o.refund.reference === ref) return publicOrder(o); fail('refund_already_recorded',409); }
    if (s.orders.some(other => other.payment?.reference === ref || other.refund?.reference === ref)) fail('reference_already_used',409);
    o.refund = {reference:ref,amount:o.amount,verifiedBy:actor.id,verifiedAt:iso(time),reconciled:false};
    o.payStatus = 'refunded'; o.paid = 0; o.due = 0;
  } else if (body.action === 'reconcile') {
    if (o.refund) {
      if (!String(body.note || '').trim() || body.statementVerified !== true) fail('statement_verification_required');
      o.refund.reconciled=true; o.refund.reconciledBy=actor.id; o.refund.note=String(body.note).slice(0,250);
      const settlement=s.settlements.find(v=>v.orderId===o.id);
      if(settlement){settlement.status='refunded';settlement.matched=true;settlement.refund={...o.refund};}
      audit(); return publicOrder(o);
    }
    if(o.payStatus==='reconciled'&&s.settlements.some(v=>v.orderId===o.id&&v.matched))return publicOrder(o);
    if (!o.payment || o.payStatus !== 'verified') fail('verified_payment_required',409);
    if (!String(body.note || '').trim() || body.statementVerified !== true) fail('statement_verification_required');
    const settlement = s.settlements.find(v => v.orderId === o.id);
    if (!settlement) fail('settlement_missing',409);
    settlement.matched = true; settlement.status = 'matched'; settlement.reconciledBy = actor.id; settlement.reconciledAt = iso(time); settlement.note = String(body.note).slice(0,250);
    o.payStatus = 'reconciled';
  } else {
    const transitions = { reserved:['packed','cancelled'], packed:['loaded','return_pending'], loaded:['at_stop','return_pending'], at_stop:['collected','return_pending'], collected:['return_pending'], return_pending:['returned'] };
    if (!transitions[o.status]?.includes(body.action)) fail('invalid_order_transition',409);
    if (body.action === 'collected' && (String(body.pickupCode).toUpperCase() !== o.pickupCode || !['verified','reconciled'].includes(o.payStatus))) fail('pickup_code_and_verified_payment_required',409);
    if (body.action === 'returned' && body.stockInspected !== true) fail('stock_inspection_required');
    if (o.payment && ['cancelled','returned'].includes(body.action) && !o.refund?.reconciled) fail('paid_return_requires_refund_resolution',409);
    o.status = body.action;
    s.scans.push({id:'scan-'+randomUUID(),orderId:o.id,type:o.status,actor:actor.id,at:iso(time)});
    if (terminal.has(o.status) || o.status === 'collected') s.reservations = s.reservations.filter(r => r.orderId !== o.id);
  }
  audit(); return publicOrder(o);
}
export function configure(s,skus,body,actor,time) {
  if (actor?.role !== 'admin') fail('admin_access_required',403);
  if (body.verified !== true || body.beatDate !== s.beat.beatDate || !Number.isInteger(body.reserveMinutes) || body.reserveMinutes < 15 || body.reserveMinutes > 1440) fail('invalid_pilot_configuration');
  if (!Array.isArray(body.products) || !body.products.length || new Set(body.products.map(p => p.id)).size !== body.products.length) fail('invalid_products');
  if (!Array.isArray(body.locations) || !body.locations.length || new Set(body.locations.map(l => l.id)).size !== body.locations.length) fail('invalid_locations');
  const products = body.products.map(p => {
    if(s.dummy===false&&p.centralSource?.preview===true)fail('preview_data_cannot_go_live',409);
    if (!skus.some(s => s.id === p.id) || !p.name?.trim() || !p.pack?.trim() || !goodsCategory(p.category)) fail('verified_product_details_required');
    let verified={};
    if (verifiedProduct(p) || ['price','pricePaise','onHand'].some(key=>p[key]!==undefined)) {
      if (!Number.isSafeInteger(p.pricePaise)||p.pricePaise<=0||p.pricePaise>100000000||p.price!==p.pricePaise/100||!Number.isSafeInteger(p.onHand)||p.onHand<0||p.onHand>1000000||!currentVerification(p.verifiedAt,time,30*86400000)||!currentVerification(p.countedAt,time,86400000)) fail('verified_price_and_stock_required');
      if(!p.sourceSku||!p.sourceSiteCode) fail('verified_source_mapping_required');
      const prior=s.commerce.config?.products.find(v=>v.id===p.id);
      if(prior?.sourceSiteCode && prior.sourceSiteCode!==p.sourceSiteCode && committed(s,p.id)>0) fail('stock_site_has_orders',409);
      if(p.onHand<committed(s,p.id)) fail('count_below_committed_stock',409);
      verified={price:p.pricePaise/100,pricePaise:p.pricePaise,onHand:p.onHand,verifiedAt:p.verifiedAt,countedAt:p.countedAt,sourceSku:String(p.sourceSku).slice(0,100),sourceSiteCode:String(p.sourceSiteCode).slice(0,100)};
    }
    return { ...verified,id:p.id,name:String(p.name).slice(0,80),hindi:String(p.hindi||'').slice(0,100),pack:String(p.pack).slice(0,100),category:goodsCategory(p.category),...(p.centralSource?.system==='rafiqi-central'?{sourceSiteCode:String(p.sourceSiteCode||'').slice(0,100),sourceSku:String(p.sourceSku||'').slice(0,100),centralSource:{system:'rafiqi-central',siteCode:String(p.sourceSiteCode||'').slice(0,100),sku:String(p.sourceSku||'').slice(0,100),pulledAt:String(p.centralSource.pulledAt||'').slice(0,40),preview:p.centralSource.preview===true}}:{}),illustration:descriptions[p.id]?.[3] || 'bag' };
  });
  const locations = body.locations.map(l => {
    if (!s.studios.some(p => p.id === l.id) || !l.name?.trim() || !l.address?.trim() || !Array.isArray(l.modes) || !l.modes.length || !l.modes.every(m => ['pickup','delivery'].includes(m)) || !(Date.parse(l.windowEnd) > Math.max(time,Date.parse(l.windowStart)))) fail('verified_location_window_required');
    let service={};
    if (l.sourceSiteCode || l.deliveryPinCodes!==undefined) {
      if(!l.sourceSiteCode || !Array.isArray(l.deliveryPinCodes) || l.deliveryPinCodes.some(v=>typeof v!=='string'||!/^[1-9]\d{5}$/.test(v)) || (l.modes.includes('delivery')&&!l.deliveryPinCodes.length) || !Number.isInteger(l.reserveMinutes) || l.reserveMinutes<15 || l.reserveMinutes>1440) fail('verified_serviceability_required');
      service={sourceSiteCode:String(l.sourceSiteCode).slice(0,100),deliveryPinCodes:[...new Set(l.deliveryPinCodes)],reserveMinutes:l.reserveMinutes};
    }
    return {...service,id:l.id,name:String(l.name).slice(0,80),address:String(l.address).slice(0,250),modes:[...new Set(l.modes)],windowStart:l.windowStart,windowEnd:l.windowEnd};
  });
  const staffLocations=Object.fromEntries(Object.entries(body.staffLocations||{}).map(([id,ids])=>{if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||!Array.isArray(ids)||!ids.every(id=>locations.some(l=>l.id===id))) fail('invalid_staff_locations');return [id,[...new Set(ids)]];}));
  for(const p of products)if(p.sourceSiteCode&&!locations.some(l=>l.sourceSiteCode===p.sourceSiteCode))fail('product_location_mismatch');
  // Update the existing beat opening only after every field validates. All orders,
  // including handed-over quantities, continue subtracting from this single book.
  for(const p of products)if(p.onHand!==undefined)s.beat.opening[p.id]=p.onHand;
  s.commerce.config = { staffLocations,verified:true,beatDate:body.beatDate,reserveMinutes:body.reserveMinutes,products,locations,support:String(body.support||'Contact your Nia pickup team.').slice(0,250) };
  s.commerce.audit.push({action:'configure',actor:actor.id,at:iso(time)});
  return {ok:true};
}
export function rateLimit(s,key,time,max=8) {
  const id = hash(key); const r = s.commerce.limits[id];
  if (!r || time-r.start > 900000) { s.commerce.limits[id]={start:time,count:1}; return true; }
  r.count++; return r.count <= max;
}
