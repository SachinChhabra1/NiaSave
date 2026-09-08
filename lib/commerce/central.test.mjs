import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { centralSignature,verifyCentralEnvelope } from './central-auth.mjs';
process.env.COMMERCE_PREVIEW='1';process.env.DATABASE_URL='';process.env.NODE_ENV='test';delete process.env.VERCEL;
process.env.CENTRAL_COMMERCE_KEY=randomBytes(32).toString('hex');
const {handler}=await import('../../api/server.mjs');
const {resetDummy}=await import('../../rabbit/engine.mjs');
const admin={id:'central-admin',role:'admin'},operator={id:'central-operator',role:'operator'};
async function http(path,body,headers={}) {
  const raw=body===undefined?'':typeof body==='string'?body:JSON.stringify(body);
  const req=Readable.from(raw?[Buffer.from(raw)]:[]);Object.assign(req,{url:path,method:body===undefined?'GET':'POST',headers:{host:'localhost:8787',origin:'http://localhost:8787','content-type':'application/json',...headers},socket:{remoteAddress:'127.0.0.1'}});
  let status,head,payload;await handler(req,{writeHead(s,h){status=s;head=h;},end(v){payload=JSON.parse(v);}});return {status,head,body:payload};
}
async function central(line,action='snapshot',body={},actor=admin,extra={}) {
  const raw=JSON.stringify({line,action,body,actor,at:Date.now(),nonce:randomUUID(),...extra});
  return http('/api/central/commerce',raw,{'x-central-signature':centralSignature(raw,process.env.CENTRAL_COMMERCE_KEY)});
}
async function login(){const r=await http('/api/commerce/auth/preview',{role:'member'});return {cookie:r.head['set-cookie'].split(';')[0]};}
function fresh(){const s=resetDummy();s.orders=[];s.reservations=[];s.payments=[];s.settlements=[];delete s.commerce;return s;}
const offer=()=>({source:{id:'CENTRAL-DEMAND-1',company:'Preview employer',city:'Preview city',demand:10,preview:true,pulledAt:new Date().toISOString()},title:'Preview picker',payMin:14000,payMax:16000,payPeriod:'month',shift:'8 hours, daytime',requirements:'Role assessment',terms:'Example employer terms. Not a real job.',closesAt:new Date(Date.now()+86400000).toISOString(),confirmed:true});
test('Central signature binds actor/body, rejects missing keys, tampering, old requests and replay',async()=>{
  fresh();assert.equal((await http('/api/central/commerce',{})).status,401);
  const envelope={actor:admin,line:'save',action:'snapshot',at:Date.now(),nonce:randomUUID()};const raw=JSON.stringify(envelope),sig=centralSignature(raw,process.env.CENTRAL_COMMERCE_KEY);
  assert.throws(()=>verifyCentralEnvelope(raw,sig,'',Date.now()),/not_configured/);
  assert.throws(()=>verifyCentralEnvelope(raw.replace('central-admin','other-admin'),sig,process.env.CENTRAL_COMMERCE_KEY,Date.now()),/auth_required/);
  assert.throws(()=>verifyCentralEnvelope(raw,sig,process.env.CENTRAL_COMMERCE_KEY,Date.now()+120000),/expired/);
  assert.equal((await http('/api/central/commerce',raw,{'x-central-signature':sig})).status,200);
  assert.equal((await http('/api/central/commerce',raw,{'x-central-signature':sig})).status,409);
});
test('Central Save reads and changes the exact member order, with reader/location/finance restrictions',async()=>{
  fresh();const member=await login(),intent={locationId:'S01',fulfillment:'pickup',lines:[{id:'groundnut_oil',qty:1}]};
  const q=await http('/api/commerce/quote',intent,member);const created=await http('/api/commerce/orders',{...intent,fingerprint:q.body.fingerprint},{...member,'idempotency-key':randomUUID()});assert.equal(created.status,201);
  const reader=await central('save','snapshot',{}, {id:'reader',role:'reader'});assert.equal(reader.body.orders.length,0);assert.equal(reader.body.config,null);
  const unassigned=await central('save','action',{orderId:created.body.id,action:'packed'},operator);assert.equal(unassigned.status,404);
  assert.equal((await central('save','action',{orderId:created.body.id,action:'packed'}, {id:'reader',role:'reader'})).status,403);
  const snapshot=await central('save');assert.equal(snapshot.body.orders[0].id,created.body.id);
  const config=snapshot.body.config;config.verified=true;config.staffLocations[operator.id]=['S01'];assert.equal((await central('save','configure',config)).status,200);
  assert.equal((await central('save','action',{orderId:created.body.id,action:'packed'},operator)).status,200);
  assert.equal((await http('/api/commerce/orders',undefined,member)).body.orders[0].status,'packed');
  assert.equal((await central('save','action',{orderId:created.body.id,action:'reconcile'},operator)).status,403);
});
test('Earn publish → member application → Central update is one idempotent, member-scoped record',async()=>{
  fresh();const member=await login();const published=await central('earn','publish',offer(),operator);assert.equal(published.status,200);
  const jobs=await http('/api/commerce/earn');assert.equal(jobs.body.jobs.length,1);assert.equal(jobs.body.jobs[0].sourceId,undefined);assert.equal(jobs.body.jobs[0].owner,undefined);
  const body={jobId:published.body.id,revision:published.body.revision,consent:true},headers={...member,'idempotency-key':randomUUID()};
  assert.equal((await http('/api/commerce/earn/applications',{...body,consent:false},{...member,'idempotency-key':randomUUID()})).status,400);
  assert.equal((await http('/api/commerce/earn/applications',{...body,revision:'old'},{...member,'idempotency-key':randomUUID()})).status,409);
  const [a,b]=await Promise.all([http('/api/commerce/earn/applications',body,headers),http('/api/commerce/earn/applications',body,headers)]);assert.equal(a.status,201);assert.equal(a.body.id,b.body.id);
  assert.equal(a.body.memberId,undefined);assert.equal(a.body.requestKey,undefined);
  assert.equal((await http('/api/commerce/earn/applications',undefined)).status,401);
  assert.equal((await central('earn','snapshot',{}, {id:'other-operator',role:'operator'})).body.applications.length,0);
  const ops=await central('earn','snapshot',{},operator);assert.equal(ops.body.applications.length,1);assert.equal(ops.body.applications[0].id,a.body.id);
  assert.equal((await central('earn','action',{applicationId:a.body.id,expectedStatus:'interested',action:'contacted',message:'Meet your Nia team tomorrow.'},operator)).status,200);
  const own=await http('/api/commerce/earn/applications',undefined,member);assert.equal(own.body.applications[0].status,'contacted');assert.equal(own.body.applications[0].message,'Meet your Nia team tomorrow.');
  assert.equal((await central('earn','action',{jobId:published.body.id,action:'unpublish'},operator)).status,200);assert.equal((await http('/api/commerce/earn')).body.jobs.length,0);assert.equal((await http('/api/commerce/earn/applications',body,headers)).body.id,a.body.id);
});
test('Publish guards reject stale sources, unchecked terms and invalid pay; production rejects preview operations',async()=>{
  fresh();await login();const input=offer();
  assert.equal((await central('earn','publish',{...input,confirmed:false})).status,400);
  assert.equal((await central('earn','publish',{...input,payMax:1})).status,400);
  assert.equal((await central('earn','publish',{...input,source:{...input.source,pulledAt:'2020-01-01'}})).status,409);
  assert.equal((await central('send')).body.enabled,false);
  assert.equal((await central('save')).body.insurance.enabled,false);
  process.env.NODE_ENV='production';try{assert.equal((await central('earn','publish',input)).status,503);}finally{process.env.NODE_ENV='test';}
});

test('Central Live lists the same canonical booking and cancellation; reader sees no member records',async()=>{
 fresh();const {resetBison}=await import('../../bison/engine.mjs');resetBison();const member=await login();
 const cat=await http('/api/commerce/nests'),intent={studioId:cat.body.offers[0].studioId,start:cat.body.start};
 const q=await http('/api/commerce/nests/quote',intent,member);const a=await http('/api/commerce/nests/bookings',{...intent,fingerprint:q.body.fingerprint},{...member,'idempotency-key':randomUUID()});assert.equal(a.status,201);
 assert.equal((await central('live')).body.bookings[0].id,a.body.id);assert.equal((await central('live','snapshot',{},operator)).body.bookings.length,0);
 assert.equal((await central('live','snapshot',{}, {id:'reader',role:'reader'})).body.bookings.length,0);
 await http('/api/commerce/nests/cancel',{bookingId:a.body.id},member);assert.equal((await central('live')).body.bookings[0].status,'cancelled');
});
