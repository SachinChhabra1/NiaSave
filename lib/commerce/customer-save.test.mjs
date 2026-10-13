import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {centralIdentityVerifyConfirm,refreshCentralOtpAccount} from './central-client.mjs';
import {emptySaveBook,saveContext,saveStaffActor,previewInventory,publishInventory,catalogueFromBook,quoteFromBook,reserveFromBook,memberOrders,saveSummary,staffSaveSnapshot} from './save-book.mjs';
import {memberSaveService,staffSaveService} from './save-service.mjs';
import {verifiedSmokeContext,SMOKE_SITE} from './save-smoke-context.mjs';
import {saveLocations,reorderProduct,compatibleSaveBag} from '../../commerce-save-scope.js';
const id='customer_'+'a'.repeat(32),other='customer_'+'b'.repeat(32),phone='+919876543210',time=Date.now(),iso=n=>new Date(n).toISOString();
const account={id,role:'member',kind:'customer',authVersion:'a'.repeat(64),locationIds:[],name:'Customer'};
const identity={source:'central',status:'ready',account,customer:{id,status:'active',phoneVerified:true}};
const env={CENTRAL_ORIGIN:'https://central.invalid',CENTRAL_COMMERCE_KEY:'k'.repeat(32),NIASAVE_SAVE_ENABLED:'1',COMMERCE_ENABLED:'1',DUMMY_DATA:'0',DATABASE_URL:'postgres://customer-fixture.invalid/test',NODE_ENV:'production'};
const opts=body=>({env,fetchImpl:async()=>({status:200,json:async()=>body})});

test('customer confirmation and refresh require explicit active verified kind, stable ID and version; never approve MAT',async()=>{
  const result=await centralIdentityVerifyConfirm('challenge','123456',phone,opts(identity));
  assert.equal(result.account.kind,'customer');assert.deepEqual(result.account.locationIds,[]);assert.equal(result.account.member,undefined);
  assert.equal((await refreshCentralOtpAccount(result.account,opts(identity))).id,id);
  for(const patch of [{customer:{...identity.customer,phoneVerified:false}},{customer:{...identity.customer,status:'revoked'}},{customer:{...identity.customer,id:other}},{customer:undefined},{account:{...account,kind:undefined}},{account:{...account,locationIds:['S01']}},{account:{...account,id:'member-approved'}}]){
    await assert.rejects(centralIdentityVerifyConfirm('challenge','123456',phone,opts({...identity,...patch})),/bad_otp/);
    await assert.rejects(refreshCentralOtpAccount(result.account,opts({...identity,...patch})),/sign_in_required/);
  }
  await assert.rejects(refreshCentralOtpAccount(result.account,opts({...identity,account:{...account,authVersion:'b'.repeat(64)}})),/sign_in_required/);
  await assert.rejects(refreshCentralOtpAccount({...result.account,kind:undefined},opts(identity)),/sign_in_required/);
});

const location=(site='site-a')=>({siteCode:site,locationId:site,name:site,address:'Recorded pickup address',modes:['pickup'],serviceRevision:1,windowStartAt:iso(time-60000),windowEndAt:iso(time+3600000),reserveMinutes:15});
const item=(site='site-a')=>({siteCode:site,sku:'rice',productId:'same-product',name:'Rice',pack:'1 kg',pricePaise:100,onHand:4,active:true,countedAt:iso(time),priceVerifiedAt:iso(time),expectedRevision:0});
const reply=locations=>({locations,asOf:iso(time),freshnessSeconds:60});
const admin=sites=>saveStaffActor({id:'admin',role:'admin'},{sites:sites.map(siteCode=>({siteCode,name:siteCode,theatre:'TEST'})),asOf:iso(time),freshnessSeconds:60},time);
function published(items){const book=emptySaveBook(),actor=admin([...new Set(items.map(i=>i.siteCode))]);const p=previewInventory(book,actor,items,time);publishInventory(book,actor,{rows:items,previewHash:p.previewHash,idempotencyKey:'fixture-publish-0001'},time);return book;}

test('same product across sites has stable distinct bag IDs; selected site, revision, own orders and legacy quote stay bound',()=>{
  const book=published([item(),{...item('site-b'),pricePaise:200}]),context=saveContext(id,reply([location(),location('site-b')]),time);
  const cat=catalogueFromBook(book,context,time),[a,b]=cat.products;
  assert.notEqual(a.id,b.id);assert.equal(cat.products.length,2);
  const reduced=catalogueFromBook(book,saveContext(id,reply([location()]),time),time);assert.equal(reduced.products[0].id,a.id);
  const body={locationId:'site-a',fulfillment:'pickup',lines:[{id:a.id,qty:1}]};
  const quote=quoteFromBook(book,context,body,env.CENTRAL_COMMERCE_KEY,time);
  assert.equal(quote.totalPaise,100);
  assert.throws(()=>quoteFromBook(book,context,{...body,lines:[{id:a.id,qty:4},{id:'same-product',qty:4}]},env.CENTRAL_COMMERCE_KEY,time),/duplicate_bag_item/,'canonical and legacy aliases cannot reserve the same physical stock twice');
  assert.throws(()=>quoteFromBook(book,context,{...body,locationId:'site-b'},env.CENTRAL_COMMERCE_KEY,time),/catalogue_unavailable/);
  const order=reserveFromBook(book,context,{...body,fingerprint:quote.fingerprint},'fixture-reserve-0001',env.CENTRAL_COMMERCE_KEY,time);
  assert.equal(memberOrders(book,context,time).orders[0].id,order.id);
  assert.equal(memberOrders(book,context,time).orders[0].customerSubject,undefined);
  assert.equal(staffSaveSnapshot(book,{...admin(['site-a']),customerSubjects:true},time).orders[0].customerSubject,id);
  assert.equal(staffSaveSnapshot(book,admin(['site-a']),time).orders[0].customerSubject,undefined,'native admin snapshot omits Central-only join');
  assert.equal(staffSaveSnapshot(book,{...admin(['site-a']),role:'operator',customerSubjects:true},time).orders[0].customerSubject,undefined);
  assert.deepEqual(staffSaveSnapshot(book,{...admin(['site-b']),customerSubjects:true},time).orders,[]);
  assert.deepEqual(memberOrders(book,saveContext(other,reply(context.locations),time),time).orders,[]);
  const legacy={...body,lines:[{id:'same-product',qty:1}]};assert.equal(quoteFromBook(book,context,legacy,env.CENTRAL_COMMERCE_KEY,time).totalPaise,100);
  assert.deepEqual(saveLocations(cat,{kind:'customer',locationIds:[]},'pickup',{[a.id]:1}).map(l=>l.id),['site-a']);
  assert.deepEqual(saveLocations(cat,{locationIds:[]},'pickup',{[a.id]:1,[b.id]:1}),[]);
  assert.deepEqual(saveLocations({...cat,owner:'legacy'},{locationIds:[]},'pickup',{}),[]);
  assert.equal(reorderProduct(cat,{location:{id:'site-b'}},{id:'same-product',sku:'rice'}).id,b.id);
  assert.deepEqual(compatibleSaveBag(cat,{'same-product':1}),{});
  assert.deepEqual(compatibleSaveBag(reduced,{'same-product':1}),{[a.id]:1});
  const collision=structuredClone(book);collision.inventory.unshift({...item(),sku:'other-rice',productId:a.id,pricePaise:999,revision:1});
  assert.equal(quoteFromBook(collision,context,body,env.CENTRAL_COMMERCE_KEY,time).totalPaise,100,'a legacy ID resembling another canonical ID cannot shadow that item');
});

test('actual customer order view reads Save only and cannot fail on blocked member services',async()=>{
  const source=readFileSync(new URL('../../commerce.js',import.meta.url),'utf8');
  const start=source.indexOf('async function loadMemberOrders(){'),end=source.indexOf('\ndocument.',start);
  assert.ok(start>0); // Execute the customer early-return body from the real UI function.
  const early=source.slice(start,source.indexOf('await loadEarn();',start));
  const run=new Function('api',`return (async()=>{let account={kind:'customer'},orders=[],issues=[1],nestOrders=[1],applications=[1],nestOrdersError='old';${early} } await loadMemberOrders();return {orders,issues,nestOrders,applications,nestOrdersError};})()`);
  const calls=[],result=await run(async path=>{calls.push(path);return {orders:[{id:'own-order'}]};});
  assert.deepEqual(calls,['/orders']);assert.deepEqual(result.orders,[{id:'own-order'}]);assert.deepEqual(result.nestOrders,[]);
});

function repository(book){return {read:async fn=>fn(structuredClone(book),1),write:async fn=>({status:200,body:fn(book)})};}
test('smoke grant selects only fixed private book; normal customers/summary cannot see it; no payment completion',async()=>{
  const real=published([item()]),smoke=published([{...item(SMOKE_SITE),name:'TEST rice'}]),before=structuredClone(real);
  const smokeGrant={id:'production-smoke-v1',subject:id,expiresAt:iso(time+3600000)};
  const smokeReply={...reply([location(SMOKE_SITE)]),testContext:smokeGrant};
  let replyValue=smokeReply;
  const central={centralMemberRequest:async(kind,subject)=>{assert.equal(kind,'save.locations');assert.equal(subject,id);return {status:200,body:replyValue};}};
  const args={central,actor:{...account,authSubject:id},repository:repository(real),smokeRepository:repository(smoke),env};
  const cat=await memberSaveService({...args,path:'/catalogue',method:'GET'});assert.equal(cat.body.test,true);assert.equal(cat.body.products[0].name,'TEST rice');
  const body={locationId:SMOKE_SITE,fulfillment:'pickup',lines:[{id:cat.body.products[0].id,qty:1}]};
  const q=await memberSaveService({...args,path:'/quote',method:'POST',body});
  assert.throws(()=>reserveFromBook(structuredClone(smoke),saveContext(id,smokeReply),{...body,fingerprint:q.body.fingerprint},'fixture-cross-book-01',env.CENTRAL_COMMERCE_KEY),/invalid_quote/,'same item/site in a normal book cannot accept a smoke-purpose signature');
  const order=await memberSaveService({...args,path:'/orders',method:'POST',body:{...body,fingerprint:q.body.fingerprint},key:'fixture-smoke-order1'});
  assert.equal(order.status,201);assert.equal(order.body.test,true);assert.equal(smoke.orders.length,1);assert.deepEqual(real,before);
  const staffArgs={actor:admin([SMOKE_SITE]),smoke:smokeGrant,repository:repository(real),smokeRepository:repository(smoke),env};
  const snapshot=await staffSaveService({...staffArgs,action:'snapshot'});assert.equal(snapshot.body.test,true);assert.equal(snapshot.body.capabilities.complete,false);
  await assert.rejects(staffSaveService({...staffArgs,action:'complete',body:{orderId:order.body.id}}),/test_payment_disabled/);
  const cancel=await memberSaveService({...args,path:'/cancel',method:'POST',body:{orderId:order.body.id,expectedRevision:1},key:'fixture-smoke-cancel1'});assert.equal(cancel.body.status,'cancelled');
  replyValue=reply([location()]);const normal=await memberSaveService({...args,path:'/catalogue',method:'GET',body:{testContext:smokeGrant}});assert.equal(normal.body.test,undefined);assert.equal(normal.body.products[0].name,'Rice');
  assert.deepEqual(saveSummary(real,1,undefined,time).completedRows,[]);assert.deepEqual(real,before);
  for(const invalid of [{...smokeGrant,subject:other},{...smokeGrant,expiresAt:iso(time-1)},{...smokeGrant,expiresAt:iso(time+7200001)},{...smokeGrant,id:'arbitrary-book'}])assert.throws(()=>verifiedSmokeContext(invalid,[location(SMOKE_SITE)],id,time),/test_scope_unverified/);
  assert.throws(()=>verifiedSmokeContext(null,[location(SMOKE_SITE)],id,time),/test_scope_unverified/);
});

test('smoke staff publication expires during an awaited repository load or retry',async()=>{
  const book=emptySaveBook(),actor=admin([SMOKE_SITE]),items=[{...item(SMOKE_SITE),name:'TEST rice'}];
  const preview=previewInventory(book,actor,items,time),realNow=Date.now;
  const grant={id:'production-smoke-v1',subject:id,expiresAt:iso(time+1000)};
  const smokeRepository={read:async fn=>fn(structuredClone(book),1),write:async fn=>{Date.now=()=>time+1001;return {status:200,body:fn(book)};}};
  try {
    Date.now=()=>time;
    await assert.rejects(staffSaveService({actor,smoke:grant,action:'inventory-publish',body:{rows:items,previewHash:preview.previewHash,idempotencyKey:'fixture-expiry-publish'},smokeRepository,env}),/staff_scope_unavailable/);
    assert.deepEqual(book,emptySaveBook());assert.equal(actor.scopeExpiresAt,time+60000,'caller actor is not mutated');
  } finally {Date.now=realNow;}
});
