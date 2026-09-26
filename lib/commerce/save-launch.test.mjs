import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {shopReservationNotice} from '../../commerce-shop-v2.js';
import {saveLaunchEnabled,COMMITMENTS_FROZEN} from '../../commerce-capabilities.js';
import {frozenRoute,saveBookUnchanged} from './write-freeze.mjs';
import {commitmentReady,saveCommitmentReady,setSaveCapabilities,reserveReady,commitmentActionReady} from '../../commerce-truth.js';

const enabled={NIASAVE_SAVE_ENABLED:'1',COMMERCE_ENABLED:'1',DUMMY_DATA:'0',
  DATABASE_URL:'postgres://fixture.invalid/test',CENTRAL_ORIGIN:'https://central.invalid',
  CENTRAL_COMMERCE_KEY:'test-fixture-only-'.repeat(3),COMMERCE_PREVIEW:'0'};

test('Save requires explicit release and real configured runtime, including real Vercel Preview',()=>{
  assert.equal(COMMITMENTS_FROZEN,true);
  assert.equal(saveLaunchEnabled({}),false);
  assert.equal(saveLaunchEnabled({...enabled,VERCEL_ENV:'preview'}),true);
  for(const patch of [{NIASAVE_SAVE_ENABLED:'0'},{NIASAVE_SAVE_ENABLED:'true'},
    {COMMERCE_ENABLED:'0'},{DUMMY_DATA:'1'},{DATABASE_URL:''},{CENTRAL_ORIGIN:'http://central.invalid'},
    {CENTRAL_COMMERCE_KEY:'short'},{COMMERCE_PREVIEW:'1'},{NIA_SHOWCASE:'1'}])
    assert.equal(saveLaunchEnabled({...enabled,...patch}),false,JSON.stringify(Object.keys(patch)));
});

test('only canonical Save POST paths open; legacy, writes to other lines and methods stay paused',()=>{
  for(const path of ['/commerce/quote','/commerce/orders','/commerce/cancel']){
    assert.equal(frozenRoute('POST',path,{}),true);
    for(const alias of [path,'/api'+path,path+'/'])assert.equal(frozenRoute('POST',alias,enabled),false);
    for(const method of ['PUT','PATCH','DELETE'])assert.equal(frozenRoute(method,path,enabled),true);
  }
  for(const path of ['/connectors/upload','/connectors/sync-catalogue','/order','/orders',
    '/commerce/orders/anything','/commerce/staff/action','/commerce/staff/config',
    '/commerce/nests/bookings','/commerce/earn/applications','/v1/payments','/bison/data/sync'])
    assert.equal(frozenRoute('POST',path,enabled),true,path);
  const before={beat:{opening:{oil:1}},orders:[],commerce:{}};
  const after=structuredClone(before);after.beat.opening.oil=2;
  assert.equal(saveBookUnchanged(before,after),false);
});

test('browser needs fresh explicit capability; only Save actions open and unknown stock never orders',()=>{
  setSaveCapabilities(null);assert.equal(saveCommitmentReady(),false);
  setSaveCapabilities({saveReservations:'true'});assert.equal(saveCommitmentReady(),false);
  setSaveCapabilities({saveReservations:true});assert.equal(saveCommitmentReady(),true);
  assert.equal(commitmentReady(),false);
  for(const action of ['add','review','confirm','reorder','cancel','cancel-confirm'])assert.equal(commitmentActionReady(action),true);
  for(const action of ['earn-apply','earn-retry','earn-withdraw','nest-review','nest-confirm','nest-cancel'])assert.equal(commitmentActionReady(action),false);
  const product={id:'fixture',pack:'1 L',price:10,available:1};
  assert.equal(reserveReady(product),true);
  for(const available of [undefined,null,NaN,-1,0,1.5])assert.equal(reserveReady({...product,available}),false);
  assert.equal(reserveReady({...product,pack:'Pack size to be confirmed'}),false);
  setSaveCapabilities(null);assert.equal(reserveReady(product),false);
});

test('mounted existing control gate allows Save only and preserves paused Earn forms',()=>{
  const source=readFileSync(new URL('../../commerce.js',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('function applyCommitmentGate('),source.indexOf('// Keep rendered member controls'));
  const control=action=>({dataset:{action},disabled:false,setAttribute(){}});
  const buttons=[control('confirm'),control('nest-confirm'),control('earn-apply'),control('order-help')];
  const saveInput={disabled:false},earnInput={disabled:false};
  const forms=[{id:'review-form',querySelectorAll:()=>[saveInput]}, {id:'earn-form',querySelectorAll:()=>[earnInput]}];
  const root={querySelectorAll:selector=>selector==='[data-action]'?buttons:forms,querySelector:()=>null};
  const context={document:root,$:()=>null,page:'shop',category:'all',cat:null,account:null,shopReservationNotice,commitmentActionReady,saveCommitmentReady,commitmentReady,
    PILOT_CLOSED_COPY:'all paused',OTHER_COMMITMENTS_PAUSED_COPY:'other paused'};
  setSaveCapabilities({saveReservations:true});vm.runInNewContext(code+';applyCommitmentGate();',context);
  assert.deepEqual(buttons.map(b=>b.disabled),[false,true,true,false]);
  assert.equal(saveInput.disabled,false);assert.equal(earnInput.disabled,true);
  setSaveCapabilities(null);vm.runInNewContext(code+';applyCommitmentGate();',context);
  assert.equal(buttons[0].disabled,true);assert.equal(saveInput.disabled,true);
});
test('mounted Shop notice follows Nia stock and sign-in without opening controls',()=>{
  const source=readFileSync(new URL('../../commerce.js',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('function applyCommitmentGate('),source.indexOf('// Keep rendered member controls'));
  let note=null;
  const button={dataset:{action:'confirm'},disabled:false,setAttribute(){}};
  const target={querySelector:()=>note,prepend:value=>{note=value;}};
  const document={querySelectorAll:selector=>selector==='[data-action]'?[button]:[],createElement:()=>({dataset:{},setAttribute(){},remove(){note=null;}})};
  const context={document,$:()=>target,page:'shop',category:'all',cat:{owner:'niasave',products:[]},account:{id:'fixture'},shopReservationNotice,
    commitmentActionReady,saveCommitmentReady,commitmentReady,t:s=>s,PILOT_CLOSED_COPY:'all paused',OTHER_COMMITMENTS_PAUSED_COPY:'other paused'};
  setSaveCapabilities(null);vm.runInNewContext(code+';applyCommitmentGate();',context);
  assert.match(note.textContent,/No essentials are available/);assert.equal(button.disabled,true);
  context.account=null;vm.runInNewContext(code+';applyCommitmentGate();',context);assert.match(note.textContent,/^Sign in/);
  context.category='insurance';vm.runInNewContext(code+';applyCommitmentGate();',context);assert.equal(note.textContent,'all paused');
  context.category='all';context.page='live';vm.runInNewContext(code+';applyCommitmentGate();',context);assert.equal(note.textContent,'all paused');
  context.page='shop';context.account={id:'fixture'};context.cat.products=[{available:2}];
  setSaveCapabilities({saveReservations:true});vm.runInNewContext(code+';applyCommitmentGate();',context);assert.equal(note,null);
  setSaveCapabilities(null);
});

Object.assign(process.env,enabled,{NODE_ENV:'production',COMMERCE_MEMBER_AUTH:'password',STAFF_AUTH_REQUIRED:'1',
  SESSION_SECRET:'session-test-fixture-'.repeat(3),NIA_RUNTIME_STATE_KEY:'save-launch-fixture'});
delete process.env.NIA_SHOWCASE;delete process.env.SHOWCASE_DATABASE_URL;
const store=await import('../runtime-store.mjs');
const {resetDummy}=await import('../../rabbit/engine.mjs');
const {commerceHttp}=await import('./http.mjs');
const {handler}=await import('../../api/server.mjs');
const {setPasswordSessionActor}=await import('./member-password.mjs');
const {centralSignature}=await import('./central-auth.mjs');
const {emptySaveBook,previewInventory,publishInventory,saveStaffActor}=await import('./save-book.mjs');
const {SAVE_BOOK_KEY}=await import('./save-repository.mjs');
const time=Date.now(),now=new Date(time).toISOString();
const scope={sites:[{siteCode:'s1',name:'Fixture site',theatre:'Fixture theatre'}],role:'admin',asOf:now,freshnessSeconds:60};
const staff={id:'fixture-admin',email:'fixture@nia.one',role:'admin'};
const actorScope=saveStaffActor(staff,scope,time);
const inventoryRow={siteCode:'s1',sku:'oil',productId:'oil-1',name:'Fixture oil',pack:'1 L',pricePaise:12500,onHand:4,
  countedAt:now,priceVerifiedAt:now,active:true,expectedRevision:0};
const saveBook=emptySaveBook(),preview=previewInventory(saveBook,actorScope,[inventoryRow],time);
publishInventory(saveBook,actorScope,{rows:[inventoryRow],previewHash:preview.previewHash,idempotencyKey:'fixture-publish-0001'},time);
const {ordersById,ordersByCode,orderIdsByStop,...legacyBook}=structuredClone(resetDummy());
const rows=new Map([[process.env.NIA_RUNTIME_STATE_KEY,{value:legacyBook,version:1}],[SAVE_BOOK_KEY,{value:saveBook,version:1}]]);
let legacyWrites=0;
store.useSqlClientForTests(async(strings,...values)=>{
  const query=strings.join('$');
  if(query.includes('CREATE TABLE'))return [];
  if(query.includes('SELECT version'))return rows.has(values[0])?[{version:rows.get(values[0]).version}]:[];
  if(query.includes('SELECT state_value'))return rows.has(values[0])?[{state_value:structuredClone(rows.get(values[0]).value),version:rows.get(values[0]).version}]:[];
  if(query.includes('INSERT INTO')){
    if(rows.has(values[0]))return [];
    rows.set(values[0],{value:JSON.parse(values[1]),version:1});return [{state_value:JSON.parse(values[1]),version:1}];
  }
  if(query.includes('UPDATE nia_runtime_state')){
    const row=rows.get(values[1]);if(!row||row.version!==Number(values[2]))return [];
    if(![SAVE_BOOK_KEY,'niasave-save-auth-v1'].includes(values[1]))legacyWrites++;
    row.value=JSON.parse(values[0]);row.version++;return [{version:row.version}];
  }
  throw Error('unexpected fixture query');
});
async function request(path,{actor,origin='https://nia.invalid',method='POST',payload={},mounted=false,getStaff=async()=>null,key='fixture-save-key-0001'}={}){
  const req=Readable.from(method==='GET'?[]:[Buffer.from(JSON.stringify(payload))]);
  Object.assign(req,{url:'/api/commerce'+path,method,headers:{host:'nia.invalid',origin,'idempotency-key':key},socket:{remoteAddress:'127.0.0.1'}});
  if(actor)setPasswordSessionActor(req,actor);
  let status,headers,result;
  const res={writeHead(s,h){status=s;headers=h;},end(raw){result=JSON.parse(raw);}};
  if(mounted)await handler(req,res);else await commerceHttp(req,res,path,getStaff);
  return {status,headers,body:result};
}
const member={id:'fixture-member',authSubject:'canonical-fixture-member',role:'member',locationIds:[]};
const bag={locationId:'S01',fulfillment:'pickup',lines:[{id:'oil-1',qty:1}]};
const priorFetch=globalThis.fetch;let centralCalls=[];
globalThis.fetch=async(url,init)=>{
  assert.equal(url,'https://central.invalid/api/service/member');
  const envelope=JSON.parse(init.body);centralCalls.push(envelope);assert.ok(init.headers['x-niasave-signature']);
  if(envelope.request.kind==='save.locations')return {status:200,json:async()=>({locations:[{siteCode:'s1',locationId:'S01',name:'Fixture site',address:'Fixture address',modes:['pickup'],serviceRevision:1,reserveMinutes:30,
    windowStartAt:new Date(time-3600000).toISOString(),windowEndAt:new Date(time+3600000).toISOString()}],asOf:new Date().toISOString(),freshnessSeconds:60,pilotOpen:false})};
  if(envelope.request.kind==='save.staffScope')return {status:200,json:async()=>({...scope,asOf:new Date().toISOString()})};
  throw Error('Forbidden Central stock/order operation: '+envelope.request.kind);
};
test.after(()=>{globalThis.fetch=priorFetch;});

test('mounted API keeps default freeze/auth/origin; live member orders persist only in dedicated NiaSave book',async()=>{
  process.env.NIASAVE_SAVE_ENABLED='0';
  assert.equal((await request('/orders',{actor:member,mounted:true})).body.error,'pilot_commitments_paused');
  process.env.NIASAVE_SAVE_ENABLED='1';
  assert.equal((await request('/orders',{mounted:true})).status,401);
  assert.equal((await request('/orders',{actor:member,origin:'https://other.invalid',mounted:true})).status,403);
  const cat=await request('/catalogue',{actor:member,method:'GET',mounted:true});
  assert.equal(cat.status,200);assert.equal(cat.body.owner,'niasave');assert.equal(cat.body.products[0].available,4);
  assert.equal(cat.body.capabilities.saveReservations,true);assert.equal(cat.headers['cache-control'],'no-store');
  const quote=await request('/quote',{actor:member,payload:bag,mounted:true});assert.equal(quote.status,200);
  const payload={...bag,fingerprint:quote.body.fingerprint};
  const order=await request('/orders',{actor:member,payload,mounted:true});assert.equal(order.status,201);
  assert.equal((await request('/orders',{actor:member,payload,mounted:true})).body.id,order.body.id);
  assert.equal(rows.get(SAVE_BOOK_KEY).value.orders.length,1);assert.equal(legacyWrites,0);
  assert.ok(centralCalls.every(c=>c.request.kind==='save.locations'));
  assert.ok(centralCalls.every(c=>c.member.subject===member.authSubject));
  const history=await request('/orders',{actor:member,method:'GET'});assert.equal(history.body.orders[0].id,order.body.id);
  assert.deepEqual((await request('/orders',{actor:{...member,authSubject:'other'},method:'GET'})).body.orders,[]);
  const cancelled=await request('/cancel',{actor:member,payload:{orderId:order.body.id,expectedRevision:1},key:'fixture-cancel-key-0001'});
  assert.equal(cancelled.status,200);assert.equal(cancelled.body.status,'cancelled');
  process.env.COMMERCE_PREVIEW='1';
  assert.equal((await request('/orders',{actor:member,mounted:true})).body.error,'pilot_commitments_paused');
  process.env.COMMERCE_PREVIEW='0';
});

test('native staff requires auth and explicit Save grant plus Central current scope; legacy desk remains unchanged',async()=>{
  const path='/staff/save/snapshot';
  assert.equal((await request(path,{method:'GET'})).status,401);
  const operator={id:'fixture-operator',email:'operator@nia.one',role:'operator'};
  assert.equal((await request(path,{method:'GET',getStaff:async()=>operator})).status,403);
  process.env.NIASAVE_SAVE_OPERATOR_EMAILS=operator.email;
  const result=await request(path,{method:'GET',getStaff:async()=>operator});
  assert.equal(result.status,200);assert.equal(result.body.owner,'niasave');assert.equal(operator.role,'operator');
  assert.ok(result.body.orders.every(order=>order.pickupCode===undefined));
  assert.equal((await request('/staff/save/inventory-preview',{method:'PUT',getStaff:async()=>operator})).status,405);
  assert.equal((await request('/staff/save/inventory-preview',{getStaff:async()=>operator,origin:'https://foreign.invalid'})).status,403);
  delete process.env.NIASAVE_SAVE_OPERATOR_EMAILS;
  assert.equal(legacyWrites,0);
});

test('signed Central snapshot reads same Nia book with signed site scope and no staff-visible pickup code',async()=>{
  const envelope={actor:{id:'central-admin',role:'admin'},line:'save',action:'snapshot',
    body:{_siteScope:scope.sites},at:Date.now(),nonce:'fixture-central-nonce-001'};
  const raw=JSON.stringify(envelope),req=Readable.from([Buffer.from(raw)]);
  Object.assign(req,{url:'/api/central/commerce',method:'POST',headers:{'x-central-signature':centralSignature(raw,process.env.CENTRAL_COMMERCE_KEY)},socket:{remoteAddress:'127.0.0.1'}});
  let status,body;const res={writeHead(s){status=s;},end(raw){body=JSON.parse(raw);}};
  await handler(req,res);assert.equal(status,200);assert.equal(body.owner,'niasave');
  assert.equal(body.orders.length,rows.get(SAVE_BOOK_KEY).value.orders.length);
  assert.equal(body.orders[0].pickupCode,undefined);assert.equal(body.capabilities.saveReservations,true);
  assert.equal(legacyWrites,0);
});

test('summary service has durable nonce protection and cannot reuse its identity for staff writes',async()=>{
  async function signed(envelope){
    const raw=JSON.stringify(envelope),req=Readable.from([Buffer.from(raw)]);
    Object.assign(req,{url:'/api/central/commerce',method:'POST',headers:{'x-central-signature':centralSignature(raw,process.env.CENTRAL_COMMERCE_KEY)},socket:{remoteAddress:'127.0.0.1'}});
    let result;const res={writeHead(status){result={status};},end(raw){result.body=JSON.parse(raw);}};
    await handler(req,res);return result;
  }
  const envelope={actor:{id:'central-save-summary',role:'service'},line:'save',action:'save-summary',
    body:{month:'2026-09'},at:Date.now(),nonce:'fixture-service-nonce-001'};
  const summary=await signed(envelope);assert.equal(summary.status,200);
  assert.equal(summary.body.owner,'niasave');assert.equal(summary.body.sourceReady,true);
  assert.equal(summary.body.inventory,undefined);assert.equal(summary.body.orders,undefined);
  assert.equal((await signed(envelope)).body.error,'central_request_replayed');
  for(const action of ['inventory-publish','complete','snapshot'])
    assert.equal((await signed({...envelope,action,nonce:'different-fixture-nonce-1'})).status,403);
  assert.equal((await signed({...envelope,actor:{id:'not-summary-service',role:'service'}})).status,403);
  assert.equal(legacyWrites,0);
});

