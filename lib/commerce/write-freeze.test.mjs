import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createHmac} from 'node:crypto';
import {frozenRoute,saveBookUnchanged,preserveFrozenBook} from './write-freeze.mjs';
import {createStateRunner} from './transaction.mjs';
import {commitmentReady,reserveReady} from '../../commerce-truth.js';
import {PILOT_CLOSED_COPY} from '../../commerce-capabilities.js';
import {loadLanguage,translate} from '../../commerce-i18n.js';
process.env.COMMERCE_PREVIEW='1';process.env.NODE_ENV='test';process.env.DATABASE_URL='';delete process.env.VERCEL;
process.env.CENTRAL_COMMERCE_KEY='fixture-key-for-m0-freeze-tests-only-32';
const {handler}=await import('../../api/server.mjs');
const {resetDummy}=await import('../../rabbit/engine.mjs');
const core=await import('./core.mjs');
const {applyMemberFulfillment}=await import('./member-fulfillment.mjs');
const {expireNests}=await import('./nests.mjs');
async function request(url,method='GET',body,extra={}){
 const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
 Object.assign(req,{url,method,headers:{host:'localhost:8787',origin:'http://localhost:8787',...extra},socket:{remoteAddress:'127.0.0.1'}});
 let status,payload;const res={writeHead(s){status=s;},end(raw){payload=raw?JSON.parse(raw):null;}};
 await handler(req,res);return {status,body:payload};
}
const paths=['/commerce/staff/config','/commerce/staff/action','/commerce/quote','/commerce/orders','/commerce/cancel','/commerce/nests/config','/commerce/nests/quote','/commerce/nests/bookings','/commerce/nests/cancel','/commerce/earn/applications','/commerce/studios/bulk','/connectors/upload','/connectors/sync-catalogue','/beat/open','/beat/close','/scan','/stops','/po','/dispatch','/invoice','/biker','/vendors','/vendor-recon','/payouts','/cash','/order','/v1/save/bag','/v1/orders','/v1/payments','/v1/staff/hub/advance','/bison/data/sync','/living/contracts'];
test('all mounted write aliases refuse without parsing bodies or requiring credentials',async()=>{
 for(const path of paths)for(const method of ['POST','PUT','PATCH','DELETE'])for(const url of [path,'/api'+path,'/api?path='+encodeURIComponent(path.slice(1)),path+'/']){
  const r=await request(url,method,{price:1,opening:{groundnut_oil:999},action:'receive'});
  assert.equal(r.status,503,method+' '+url);assert.equal(r.body.error,'pilot_commitments_paused',url);
 }
});
test('test GET order creation is disabled; auth paths are not classified as writes',async()=>{
 for(const url of ['/api/commerce/test/place-one','/api?path=commerce/test/place-one'])assert.equal((await request(url)).body.error,'pilot_commitments_paused');
 for(const path of ['/commerce/auth/login','/commerce/auth/request','/commerce/auth/verify','/commerce/auth/set-password','/v1/staff/login'])assert.equal(frozenRoute('POST',path),false,path);
});
test('valid signed operator commands cannot write any pillar',async()=>{
 for(const line of ['save','live','earn'])for(const action of ['configure','action','publish','demo']){
  const body={actor:{id:'stf-admin',role:'admin'},line,action,body:{},at:Date.now(),nonce:crypto.randomUUID()};
  const sig=createHmac('sha256',process.env.CENTRAL_COMMERCE_KEY).update('niasave-central-v1\n'+JSON.stringify(body)).digest('hex');
  const r=await request('/api/central/commerce','POST',body,{'x-central-signature':sig});
  assert.equal(r.body.error,'pilot_commitments_paused',JSON.stringify(r));
 }
});
test('catalogue GET preserves expired commitments and never republishes fulfilment',async()=>{
 const s=resetDummy();core.initialise(s,[],true,Date.now());
 s.orders=[{id:'expired-fixture',source:'commerce',status:'reserved',expiresAt:'2000-01-01T00:00:00Z',stopId:'S01',lines:[]}];
 s.reservations=[{orderId:'expired-fixture',sku:'groundnut_oil',qty:1}];
 const before=structuredClone(s);
 core.expire(s,Date.now());applyMemberFulfillment(s,Date.now(),[]);assert.deepEqual(s,before);
 const r=await request('/api/commerce/catalogue');assert.equal(r.status,200);
 assert.deepEqual(s,before);
 const living={bookings:[{status:'reserved',memberReservation:{expiresAt:'2000-01-01T00:00:00Z'}}]};const prior=structuredClone(living);expireNests(living,Date.now());assert.deepEqual(living,prior);
});
test('persistence guard rejects a missed stock write and rolls it back',async()=>{
 let state={beat:{opening:{oil:1}},commerce:{sessions:{},accounts:{},limits:{},requests:{},audit:[],config:null}};let writes=0;
 const run=createStateRunner({durable:()=>true,load:async()=>({storage:'postgres',version:1,value:structuredClone(state)}),save:async()=>{writes++;return {ok:true,storage:'postgres'};},snapshot:()=>state,restore:v=>{state=structuredClone(v);},validate:saveBookUnchanged});
 const result=await run(true,()=>{state.beat.opening.oil=9;return {status:200};});assert.equal(result.status,503);assert.equal(state.beat.opening.oil,1);assert.equal(writes,0);
 const auth=await run(true,()=>{state.commerce.sessions.session={expires:123};return {status:200};});assert.equal(auth.status,200);assert.equal(writes,1);
});
test('ordinary state-runner reads restore speculative changes without saving',async()=>{
 let s={stock:1},writes=0;const run=createStateRunner({durable:()=>false,load:async()=>{},save:async()=>{writes++;},snapshot:()=>s,restore:v=>{s=v;}});
 await run(false,()=>{s.stock=99;return {status:200};});assert.equal(s.stock,1);assert.equal(writes,0);
});
test('capability gate and new pause copy cover all four languages',async()=>{
 assert.equal(commitmentReady(),false);assert.equal(reserveReady({id:'real',pack:'1 L',price:10,available:1}),false);
 for(const lang of ['hi','ta','bn']){await loadLanguage(lang);assert.notEqual(translate(lang,PILOT_CLOSED_COPY),PILOT_CLOSED_COPY);}
});

test('authentication saves preserve raw frozen fields despite restore-time normalization',()=>{
 const source={orders:[{id:'historic',stopId:'outside-old-polo-range'}],studios:[],commerce:{audit:[],config:{revision:7}}};
 const normalized={orders:[],studios:[{id:'seed'}],commerce:{sessions:{newSession:{expires:100}},config:{revision:8},audit:[]}};
 const saved=preserveFrozenBook(source,normalized);
 assert.deepEqual(saved.orders,source.orders);assert.deepEqual(saved.studios,source.studios);assert.deepEqual(saved.commerce.config,source.commerce.config);
 assert.deepEqual(saved.commerce.sessions,normalized.commerce.sessions);
});
