import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
process.env.COMMERCE_PREVIEW='1';process.env.DATABASE_URL='';process.env.NODE_ENV='test';delete process.env.VERCEL;
const KEY='0123456789abcdef0123456789abcdef0123456789abcdef';
const {buildEnvelope,centralConfigured,centralMemberRequest,centralMemberPhoneLookup,planWriteRequest,signCentralRequest,CENTRAL_SIGNING_CONTEXT}=await import('./central-client.mjs');
const {handler}=await import('../../api/server.mjs');

test('envelope carries the verified subject, a fresh nonce and the NiaSave -> Central signing context',()=>{
  const env=buildEnvelope('plan.read','member-42',{month:'2026-09'},1757300000000);
  assert.equal(env.service,'niasave');assert.equal(env.member.subject,'member-42');assert.equal(env.request.kind,'plan.read');assert.equal(env.request.month,'2026-09');assert.equal(env.at,1757300000000);
  assert.match(env.nonce,/^[a-zA-Z0-9_-]{16,100}$/);
  assert.notEqual(env.nonce,buildEnvelope('plan.read','member-42').nonce);
  const raw=JSON.stringify(env);
  assert.equal(signCentralRequest(raw,KEY),createHmac('sha256',KEY).update(CENTRAL_SIGNING_CONTEXT+raw).digest('hex'));
  assert.notEqual(signCentralRequest(raw,KEY),createHmac('sha256',KEY).update('niasave-central-v1\n'+raw).digest('hex'));
  assert.throws(()=>buildEnvelope('plan.read','has spaces'),/sign_in_required/);
});

test('plan writes are validated before leaving NiaSave; null stays unknown and zero stays zero',()=>{
  const out=planWriteRequest({month:'2026-09',expectedRevision:0,fields:{incomePaise:1800000,essentialsPaise:0}},'plan-attempt-0001');
  assert.deepEqual(out,{month:'2026-09',expectedRevision:0,fields:{incomePaise:1800000,essentialsPaise:0,debtPaise:null,bufferPaise:null,otherPaise:null,homePaise:null},idempotencyKey:'plan-attempt-0001'});
  assert.throws(()=>planWriteRequest({month:'2026-09',expectedRevision:0,fields:{}},undefined),/idempotency_key_required/);
  assert.throws(()=>planWriteRequest({month:'2026-9',expectedRevision:0,fields:{}},'plan-attempt-0001'),/invalid_plan/);
  assert.throws(()=>planWriteRequest({month:'2026-09',expectedRevision:-1,fields:{}},'plan-attempt-0001'),/invalid_plan/);
  assert.throws(()=>planWriteRequest({month:'2026-09',expectedRevision:0,fields:{incomePaise:12.5}},'plan-attempt-0001'),/invalid_plan/);
  assert.throws(()=>planWriteRequest({month:'2026-09',expectedRevision:0,fields:{extra:1}},'plan-attempt-0001'),/invalid_plan/);
  assert.throws(()=>planWriteRequest({month:'2026-09',expectedRevision:0,fields:{incomePaise:100000001}},'plan-attempt-0001'),/invalid_plan/);
});

test('Central answers pass through unchanged; missing configuration and unreachable Central fail closed',async()=>{
  assert.equal(centralConfigured({}),false);
  assert.equal(centralConfigured({CENTRAL_ORIGIN:'http://central.test',CENTRAL_COMMERCE_KEY:KEY}),false);
  const env={CENTRAL_ORIGIN:'https://central.test/',CENTRAL_COMMERCE_KEY:KEY};
  assert.equal(centralConfigured(env),true);
  await assert.rejects(centralMemberRequest('plan.read','member-42',{},{env:{}}),/central_connection_not_configured/);
  const calls=[];
  const fetchImpl=async(url,init)=>{calls.push({url,init});const body=JSON.parse(init.body);const expected=createHmac('sha256',KEY).update(CENTRAL_SIGNING_CONTEXT+init.body).digest('hex');return {status:body.request.kind==='plan.write'?409:200,json:async()=>({echo:body.request,signatureOk:init.headers['x-niasave-signature']===expected})};};
  const read=await centralMemberRequest('plan.read','member-42',{month:'2026-09'},{env,fetchImpl});
  assert.equal(read.status,200);assert.equal(read.body.signatureOk,true);assert.equal(read.body.echo.month,'2026-09');
  assert.equal(calls[0].url,'https://central.test/api/service/member');assert.equal(calls[0].init.redirect,'error');
  const write=await centralMemberRequest('plan.write','member-42',{month:'2026-09',expectedRevision:3,fields:{},idempotencyKey:'plan-attempt-0001'},{env,fetchImpl});
  assert.equal(write.status,409);
  await assert.rejects(centralMemberRequest('plan.read','member-42',{},{env,fetchImpl:async()=>{throw new Error('down');}}),/central_unreachable/);
  await assert.rejects(centralMemberRequest('plan.read','member-42',{},{env,fetchImpl:async()=>({status:200,json:async()=>'text'})}),/central_invalid_response/);
});

test('member phone lookup is central-authoritative and fails closed when lookup is unsupported', async () => {
  const env={CENTRAL_ORIGIN:'https://central.test/',CENTRAL_COMMERCE_KEY:KEY};
  const fetchRegistered = async () => ({status:200,json:async()=>({registered:true,member:{subject:'member-42'}})});
  const fetchUnregistered = async () => ({status:404,json:async()=>({error:'member_not_registered'})});
  const fetchUnsupported = async () => ({status:400,json:async()=>({error:'unknown_operation'})});
  const fetchUnexpected = async () => ({status:500,json:async()=>({error:'server_error'})});
  const registered = await centralMemberPhoneLookup('+919876543210',{env,fetchImpl:fetchRegistered});
  assert.equal(registered.registered,true);assert.equal(registered.subject,'member-42');
  const denied = await centralMemberPhoneLookup('+919999999999',{env,fetchImpl:fetchUnregistered});
  assert.equal(denied.registered,false);assert.equal(denied.subject,null);
  await assert.rejects(centralMemberPhoneLookup('+919876543210',{env,fetchImpl:fetchUnsupported}),/central_member_lookup_required/);
  await assert.rejects(centralMemberPhoneLookup('+919876543210',{env,fetchImpl:fetchUnexpected}),/central_member_lookup_unavailable/);
  await assert.rejects(centralMemberPhoneLookup('not-a-phone',{env,fetchImpl:fetchRegistered}),/invalid_phone/);
});

async function request(path,body,cookie='',method,headers={}){
  const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);Object.assign(req,{url:'/api/commerce'+path,method:method||(body===undefined?'GET':'POST'),headers:{host:'localhost:8787',origin:'http://localhost:8787','content-type':'application/json',cookie,...headers},socket:{remoteAddress:'127.0.0.1'}});
  let code,h,payload;const res={writeHead(status,head){code=status;h=head;},end(raw){payload=JSON.parse(raw);}};await handler(req,res);return {status:code,headers:h,body:payload};
}

test('/books/plan needs a member session, forwards the verified account id and never a browser member id',async()=>{
  assert.equal((await request('/books/plan?month=2026-09')).status,401);
  const login=await request('/auth/preview',{role:'member'});const cookie=login.headers['set-cookie'].split(';')[0];
  const enterprise=(await request('/auth/preview',{role:'enterprise'})).headers['set-cookie'].split(';')[0];
  assert.equal((await request('/books/plan?month=2026-09',undefined,enterprise)).status,403);
  const unconfigured=await request('/books/plan?month=2026-09',undefined,cookie);
  assert.equal(unconfigured.status,503);assert.equal(unconfigured.body.error,'central_connection_not_configured');
  process.env.CENTRAL_ORIGIN='https://central.test';process.env.CENTRAL_COMMERCE_KEY=KEY;
  const originalFetch=globalThis.fetch;const seen=[];
  globalThis.fetch=async(url,init)=>{const body=JSON.parse(init.body);seen.push(body);return {status:body.request.kind==='plan.write'?200:200,json:async()=>({kind:body.request.kind,subject:body.member.subject,month:body.request.month,idempotencyKey:body.request.idempotencyKey})};};
  try{
    const read=await request('/books/plan?month=2026-09&memberId=someone-else',undefined,cookie);
    assert.equal(read.status,200);assert.equal(read.body.subject,'preview-member');assert.equal(read.body.month,'2026-09');
    assert.equal(seen[0].service,'niasave');assert.equal(seen[0].request.memberId,undefined);
    const noKey=await request('/books/plan',{month:'2026-09',expectedRevision:0,fields:{incomePaise:1}},cookie,'PUT');
    assert.equal(noKey.status,400);assert.equal(noKey.body.error,'idempotency_key_required');
    const write=await request('/books/plan',{month:'2026-09',expectedRevision:0,fields:{incomePaise:1},memberId:'someone-else'},cookie,'PUT',{'idempotency-key':'plan-attempt-0001'});
    assert.equal(write.status,200);assert.equal(write.body.subject,'preview-member');assert.equal(seen.at(-1).request.memberId,undefined);assert.equal(seen.at(-1).member.subject,'preview-member');
    const clean=await request('/books/plan',{month:'2026-09',expectedRevision:0,fields:{incomePaise:1}},cookie,'PUT',{'idempotency-key':'plan-attempt-0001'});
    assert.equal(clean.status,200);assert.equal(clean.body.kind,'plan.write');assert.equal(clean.body.subject,'preview-member');assert.equal(clean.body.idempotencyKey,'plan-attempt-0001');
    const csrf=await request('/books/plan',{month:'2026-09',expectedRevision:0,fields:{}},cookie,'PUT',{'idempotency-key':'plan-attempt-0002',origin:'https://attacker.invalid'});
    assert.equal(csrf.status,403);
  } finally {globalThis.fetch=originalFetch;delete process.env.CENTRAL_ORIGIN;delete process.env.CENTRAL_COMMERCE_KEY;}
});

test('Earn from Central passes the projection through and turns every failure into an explicit unavailable map',async()=>{
  const {earnProjectionFromCentral}=await import('./central-client.mjs');
  const env={CENTRAL_ORIGIN:'https://central.test',CENTRAL_COMMERCE_KEY:KEY};
  const projection={owner:'Walk2Work',preview:false,map:{status:'ready',asOf:'2026-09-08T10:00:00.000Z',revision:'r1',studio:{id:'S01',name:'Nest one',lat:12.9,lng:77.6,verified:true}},jobs:[]};
  const ok=await earnProjectionFromCentral({id:'member-42',role:'member'},{env,fetchImpl:async()=>({status:200,json:async()=>({schemaVersion:1,projection,member:{enrolled:true,active:true,kycApproved:true}})})});
  assert.equal(ok.map.status,'ready');assert.equal(ok.source,'central');assert.equal(ok.member.kycApproved,true);
  assert.equal((await earnProjectionFromCentral(null,{env})).map.reason,'sign_in_required');
  assert.equal((await earnProjectionFromCentral({id:'x',role:'enterprise'},{env})).map.reason,'sign_in_required');
  assert.equal((await earnProjectionFromCentral({id:'member-42',role:'member'},{env:{}})).map.reason,'central_connection_not_configured');
  assert.equal((await earnProjectionFromCentral({id:'member-42',role:'member'},{env,fetchImpl:async()=>{throw new Error('down');}})).map.reason,'central_unreachable');
  const denied=await earnProjectionFromCentral({id:'member-42',role:'member'},{env,fetchImpl:async()=>({status:403,json:async()=>({error:'service_not_authorized'})})});
  assert.equal(denied.map.status,'unavailable');assert.equal(denied.map.reason,'service_not_authorized');assert.deepEqual(denied.jobs,[]);
});

test('the hosted showcase signs with SHOWCASE_CENTRAL_KEY, the member deployment with CENTRAL_COMMERCE_KEY',async()=>{
  const {centralKey}=await import('./central-client.mjs');
  const showcase={NIA_SHOWCASE:'1',NIA_SHOWCASE_ENTRY:'isolated-v1',VERCEL_ENV:'preview',SHOWCASE_INSTANCE:'showcase-abcdefgh',SHOWCASE_DATABASE_URL:'postgres://x',SHOWCASE_PASSWORD:'p'.repeat(24),SHOWCASE_CENTRAL_KEY:'s'.repeat(40),CENTRAL_COMMERCE_KEY:'c'.repeat(40),CENTRAL_ORIGIN:'https://central.test'};
  assert.equal(centralKey(showcase),'s'.repeat(40));
  assert.equal(centralKey({...showcase,NIA_SHOWCASE:'0'}),'c'.repeat(40));
  assert.equal(centralConfigured({...showcase,CENTRAL_COMMERCE_KEY:''}),true);
  assert.equal(centralConfigured({...showcase,SHOWCASE_CENTRAL_KEY:'short',CENTRAL_COMMERCE_KEY:''}),false);
});

test('Earn switch routes list and application writes to Central with member identity and no local fallback',async()=>{
 process.env.EARN_SOURCE='central';process.env.CENTRAL_ORIGIN='https://central.test';process.env.CENTRAL_COMMERCE_KEY=KEY;
 const originalFetch=globalThis.fetch,seen=[];
 try{
  assert.equal((await request('/earn')).status,401);
  const login=await request('/auth/preview',{role:'member'}),cookie=login.headers['set-cookie'].split(';')[0];
  globalThis.fetch=async(url,init)=>{const e=JSON.parse(init.body);seen.push(e);return {status:e.request.kind==='earn.apply'?409:200,json:async()=>e.request.kind==='earn.projection'?{projection:{owner:'Walk2Work',map:{status:'ready'},jobs:[{id:'mandate:1'}]}}:e.request.kind==='earn.apply'?{error:'job_not_available'}:{applications:[]}};};
  const listing=await request('/earn',undefined,cookie);assert.equal(listing.body.source,'central');assert.equal(listing.body.jobs[0].id,'mandate:1');
  const submitted=await request('/earn/applications',{jobId:'mandate:1',revision:'r1',consent:true,memberId:'someone-else',pay:1},cookie,'POST',{'idempotency-key':'application-request-0001'});
  assert.equal(submitted.status,409);assert.equal(submitted.body.error,'job_not_available');
  assert.equal(seen.at(-1).member.subject,'preview-member');assert.equal(seen.at(-1).request.memberId,undefined);assert.equal(seen.at(-1).request.pay,undefined);
  assert.equal((await request('/earn/applications',undefined,cookie)).body.applications.length,0);
  globalThis.fetch=async()=>{throw Error('offline');};assert.equal((await request('/earn/applications',undefined,cookie)).status,503);
 }finally{globalThis.fetch=originalFetch;delete process.env.EARN_SOURCE;delete process.env.CENTRAL_ORIGIN;delete process.env.CENTRAL_COMMERCE_KEY;}
});
