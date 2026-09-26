import test from 'node:test';
import assert from 'node:assert/strict';
import {emptySaveBook,saveContext,saveStaffActor,previewInventory,publishInventory,catalogueFromBook,
  quoteFromBook,reserveFromBook,cancelFromBook,completeFromBook,memberOrders,staffSaveSnapshot,retrySaveRequest,saveSummary} from './save-book.mjs';
import {createSaveRepository} from './save-repository.mjs';
import {staffSaveService} from './save-service.mjs';

const time=Date.parse('2026-09-26T09:00:00Z'),iso=n=>new Date(n).toISOString();
const secret='isolated-test-fixture-key-only-32-characters';
const site={siteCode:'site-1',name:'Fixture site',theatre:'Fixture theatre'};
const admin=saveStaffActor({id:'staff-1',role:'admin'},{sites:[site],asOf:iso(time),freshnessSeconds:60},time);
const context=(subject='member-1')=>saveContext(subject,{asOf:iso(time),freshnessSeconds:60,locations:[{
  ...site,locationId:'location-1',address:'Fixture address',serviceRevision:2,modes:['pickup'],
  windowStartAt:iso(time-3600000),windowEndAt:iso(time+3600000),reserveMinutes:30}]},time);
const row={siteCode:'site-1',sku:'fixture-oil',productId:'fixture-product',name:'Fixture oil',pack:'1 L',
  pricePaise:12500,onHand:2,countedAt:iso(time),priceVerifiedAt:iso(time),active:true,expectedRevision:0};
const bag={locationId:'location-1',fulfillment:'pickup',lines:[{id:'fixture-product',qty:1}]};
function seeded(stock=2){const book=emptySaveBook();const rows=[{...row,onHand:stock}];
  const preview=previewInventory(book,admin,rows,time);publishInventory(book,admin,{rows,previewHash:preview.previewHash,idempotencyKey:'fixture-publish-0001'},time);return book;}
function reserve(book,member='member-1',idempotencyKey='fixture-reserve-0001'){
  const q=quoteFromBook(book,context(member),bag,secret,time);
  const body={...bag,fingerprint:q.fingerprint};
  return {order:reserveFromBook(book,context(member),body,idempotencyKey,secret,time),body};
}

test('empty dedicated book has no seeded catalogue or legacy fallback',()=>{
  const cat=catalogueFromBook(emptySaveBook(),context(),time);
  assert.equal(cat.owner,'niasave');assert.deepEqual(cat.products,[]);assert.equal(cat.ready,false);
});
test('invalid persisted inventory cannot turn a missing count into zero or a usable offer',()=>{
  const book=seeded();book.inventory[0].onHand=null;
  assert.throws(()=>catalogueFromBook(book,context(),time),/save_book_invalid/);
});
test('inventory preview is all-or-nothing, scoped and exact about zero vs missing',()=>{
  const book=emptySaveBook(),before=structuredClone(book);
  const p=previewInventory(book,admin,[{...row,onHand:0}],time);
  assert.equal(p.rows[0].onHand,0);assert.deepEqual(book,before);
  for(const patch of [{onHand:null},{onHand:-1},{onHand:1.2},{pricePaise:0},{pricePaise:'12500'},
    {active:'true'},{pack:'Pack size to be confirmed'},{countedAt:iso(time-86400001)},
    {countedAt:iso(time+60000)},{expectedRevision:null},{siteCode:'other-site'}])
    assert.throws(()=>previewInventory(book,admin,[{...row,...patch}],time));
  assert.throws(()=>previewInventory(book,admin,[row,row],time),/duplicate_inventory/);
  assert.throws(()=>previewInventory(book,{...admin,role:'reader'},[row],time),/admin_access/);
  assert.deepEqual(book,before);
});
test('publish requires unchanged preview/revision; exact retry does not double publish',()=>{
  const book=emptySaveBook(),p=previewInventory(book,admin,[row],time);
  const input={rows:[row],previewHash:p.previewHash,idempotencyKey:'fixture-publish-0001'};
  assert.throws(()=>publishInventory(book,admin,{...input,previewHash:'bad'},time),/preview_changed/);
  const result=publishInventory(book,admin,input,time);const before=structuredClone(book);
  assert.deepEqual(publishInventory(book,admin,input,time),result);assert.deepEqual(book,before);
  assert.throws(()=>publishInventory(book,admin,{...input,rows:[{...row,onHand:3}]},time),/idempotency_key_reused/);
  assert.throws(()=>previewInventory(book,admin,[row],time),/revision_conflict/);
  assert.throws(()=>previewInventory(book,admin,[{...row,sku:'different'}],time),/product_id_conflict/);
});
test('Central scope must be fresh, unambiguous and current; no guessed default site',()=>{
  assert.throws(()=>saveContext('member',{asOf:iso(time-60001),freshnessSeconds:60,locations:[]},time));
  assert.throws(()=>saveStaffActor({id:'s',role:'admin'},{asOf:iso(time),freshnessSeconds:60,sites:[site,site]},time));
  const none=saveContext('member',{asOf:iso(time),freshnessSeconds:60,locations:[]},time);
  assert.deepEqual(catalogueFromBook(seeded(),none,time).products,[]);
  assert.throws(()=>quoteFromBook(seeded(),none,bag,secret,time),/member_location/);
  assert.throws(()=>quoteFromBook(seeded(),context(),bag,secret,time+60001),/member_location/);
});
test('quotes bind member/site/price/quantity/revisions, reject tampering and expired quote',()=>{
  const book=seeded(),q=quoteFromBook(book,context(),bag,secret,time),body={...bag,fingerprint:q.fingerprint};
  assert.throws(()=>reserveFromBook(book,context('foreign'),body,'fixture-reserve-0001',secret,time),/quote_expired/);
  const forged=JSON.parse(q.fingerprint);forged.quote.totalPaise=1;
  assert.throws(()=>reserveFromBook(book,context(),{...body,fingerprint:JSON.stringify(forged)},'fixture-reserve-0001',secret,time),/invalid_quote/);
  assert.throws(()=>reserveFromBook(book,context(),{...body,lines:[{id:'fixture-product',qty:2}]},'fixture-reserve-0001',secret,time),/details_changed/);
  book.inventory[0].revision++;
  assert.throws(()=>reserveFromBook(book,context(),body,'fixture-reserve-0001',secret,time),/details_changed/);
  assert.equal(book.orders.length,0);
});
test('reservation holds stock, exact retry returns same order, cancellation releases without decrement',()=>{
  const book=seeded(),{order,body}=reserve(book);
  assert.equal(book.inventory[0].onHand,2);
  assert.equal(catalogueFromBook(book,context(),time).products[0].available,1);
  assert.deepEqual(reserveFromBook(book,context(),body,'fixture-reserve-0001',secret,time),order);
  assert.equal(book.orders.length,1);
  assert.deepEqual(retrySaveRequest(book,context(),'fixture-reserve-0001',time),order);
  assert.throws(()=>cancelFromBook(book,context('foreign'),{orderId:order.id,expectedRevision:1},'fixture-cancel-00001',time),/order_not_found/);
  const cancelled=cancelFromBook(book,context(),{orderId:order.id,expectedRevision:1},'fixture-cancel-00001',time);
  assert.equal(cancelled.status,'cancelled');assert.equal(book.inventory[0].onHand,2);
  assert.equal(catalogueFromBook(book,context(),time).products[0].available,2);
  assert.deepEqual(memberOrders(book,context('foreign'),time).orders,[]);
});
test('recount cannot erase active holds; completing pickup decrements once with receipt and no bank claim',()=>{
  const book=seeded(),{order}=reserve(book);
  assert.throws(()=>previewInventory(book,admin,[{...row,onHand:0,expectedRevision:1}],time),/count_below_reserved/);
  const input={orderId:order.id,expectedRevision:1,pickupCode:order.pickupCode,amountPaise:12500,
    paymentEvidence:'receipt-fixture-1',handoverEvidence:'confirmed-fixture-1',idempotencyKey:'fixture-complete-001'};
  for(const patch of [{pickupCode:'bad'},{amountPaise:1},{paymentEvidence:''},{handoverEvidence:''}])
    assert.throws(()=>completeFromBook(book,admin,{...input,...patch},time),/pickup_payment/);
  const snapshot=staffSaveSnapshot(book,admin,time);
  assert.equal(snapshot.orders[0].pickupCode,undefined);
  assert.notEqual(order.pickupCode,order.id.replaceAll('-','').slice(0,12).toUpperCase());
  const completed=completeFromBook(book,admin,input,time);
  assert.equal(completed.status,'completed');assert.equal(completed.payment.bankSettlementVerified,false);
  assert.equal(completed.payment.method,'at_pickup');assert.equal(completed.payment.paymentEvidence,undefined);
  assert.equal(book.inventory[0].onHand,1);assert.equal(book.inventory[0].revision,2);
  assert.deepEqual(completeFromBook(book,admin,input,time),completed);assert.equal(book.inventory[0].onHand,1);
  assert.equal(catalogueFromBook(book,context(),time).products[0].available,1);
});
test('expired reservations stop holding stock without write; scoped staff cannot discover or complete foreign orders',()=>{
  const book=seeded(),{order}=reserve(book);
  const later=time+31*60000,ctx={...context(),expiresAt:later+60000};
  assert.equal(catalogueFromBook(book,ctx,later).products[0].available,2);
  assert.equal(memberOrders(book,ctx,later).orders[0].status,'expired');
  const outsider={...admin,sites:[]};
  assert.deepEqual(staffSaveSnapshot(book,outsider,time).orders,[]);
  assert.throws(()=>completeFromBook(book,outsider,{orderId:order.id,idempotencyKey:'fixture-complete-001'},time),/order_not_found/);
  const reader=staffSaveSnapshot(book,{...admin,role:'reader'},time);
  assert.equal(reader.orders,undefined);assert.equal(reader.inventory,undefined);assert.equal(reader.counts.orders,1);
});

function database(initial=seeded(1)){
  let stored=structuredClone(initial),version=1,saves=0;
  const io={durable:()=>true,load:async()=>({storage:'postgres',version,value:structuredClone(stored)}),
    initialize:async()=>({storage:'postgres',version,value:structuredClone(stored)}),
    save:async(value,expected)=>{saves++;if(expected!==version)return {ok:false,storage:'postgres',conflict:true};
      stored=structuredClone(value);version++;return {ok:true,storage:'postgres',version};}};
  return {io,read:()=>structuredClone(stored),saves:()=>saves};
}
test('two serverless repository instances race for last unit; CAS re-evaluation prevents oversell',async()=>{
  const db=database(),a=createSaveRepository(db.io),b=createSaveRepository(db.io);
  const quote=quoteFromBook(db.read(),context(),bag,secret,time);
  const other=quoteFromBook(db.read(),context('member-2'),bag,secret,time);
  const results=await Promise.allSettled([
    a.write(book=>reserveFromBook(book,context(),{...bag,fingerprint:quote.fingerprint},'fixture-request-0001',secret,time)),
    b.write(book=>reserveFromBook(book,context('member-2'),{...bag,fingerprint:other.fingerprint},'fixture-request-0002',secret,time))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(db.read().orders.length,1);assert.equal(db.read().inventory[0].onHand,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.message,'insufficient_stock');
});
test('database failures never acknowledge order or leave partial book; reload proves committed durable snapshot',async()=>{
  const db=database(),q=quoteFromBook(db.read(),context(),bag,secret,time),body={...bag,fingerprint:q.fingerprint};
  const fail=createSaveRepository({...db.io,save:async()=>({ok:false,storage:'postgres'})});
  assert.equal((await fail.write(book=>reserveFromBook(book,context(),body,'fixture-request-0001',secret,time))).status,503);
  assert.equal(db.read().orders.length,0);
  const a=createSaveRepository(db.io);const saved=await a.write(book=>reserveFromBook(book,context(),body,'fixture-request-0001',secret,time));
  const fresh=createSaveRepository(db.io);const reloaded=await fresh.read(book=>memberOrders(book,context(),time));
  assert.equal(reloaded.orders[0].id,saved.body.id);
  const absent=createSaveRepository({...db.io,durable:()=>false});
  await assert.rejects(absent.write(()=>({ok:true})),/save_storage_unavailable/);
});

test('real staff service retries publication after response loss before advanced revision validation',async()=>{
  const now=Date.now(),db=database(emptySaveBook()),repository=createSaveRepository(db.io);
  const actor={...admin,scopeExpiresAt:now+60000};
  const rows=[{...row,countedAt:iso(now),priceVerifiedAt:iso(now),evidence:'physical-count-fixture'}];
  const env={NIASAVE_SAVE_ENABLED:'1',COMMERCE_ENABLED:'1',DUMMY_DATA:'0',DATABASE_URL:'postgres://fixture.invalid/test',
    CENTRAL_ORIGIN:'https://central.invalid',CENTRAL_COMMERCE_KEY:secret};
  const preview=await staffSaveService({actor,action:'inventory-preview',body:{rows},repository,env});
  const body={rows,previewHash:preview.body.previewHash,idempotencyKey:'service-publish-0001'};
  const first=await staffSaveService({actor,action:'inventory-publish',body,repository,env});
  const retry=await staffSaveService({actor,action:'inventory-publish',body,repository,env});
  assert.deepEqual(retry.body,first.body);assert.equal(db.read().inventory[0].revision,1);
  assert.equal(db.read().events[0].rows[0].evidence,'physical-count-fixture');
  await assert.rejects(staffSaveService({actor,action:'inventory-publish',body:{...body,rows:[{...rows[0],onHand:99}]},repository,env}),/idempotency_key_reused/);
});

test('summary uses completion receipt month, physical stock and explicit unknown costs, with no member fields',()=>{
  const book=seeded(),{order}=reserve(book);
  completeFromBook(book,admin,{orderId:order.id,expectedRevision:1,pickupCode:order.pickupCode,amountPaise:12500,
    paymentEvidence:'summary-receipt-fixture',handoverEvidence:'summary-handover-fixture',idempotencyKey:'summary-complete-001'},time);
  const summary=saveSummary(book,3,'2026-09',time);
  assert.equal(summary.sourceReady,true);assert.equal(summary.version,3);
  assert.equal(summary.stockRows[0].onHand,1);assert.equal(summary.completedRows[0].quantity,1);
  assert.equal(summary.completedRows[0].revenuePaise,12500);assert.equal(summary.completedRows[0].costPaise,null);
  assert.equal(summary.completedRows[0].savingsPaise,null);
  assert.equal(JSON.stringify(summary).includes('member-1'),false);assert.equal(JSON.stringify(summary).includes(order.pickupCode),false);
  assert.deepEqual(saveSummary(book,3,'2026-08',time).completedRows,[]);
  assert.equal(saveSummary(emptySaveBook(),0,'2026-09',time).sourceReady,false);
});
