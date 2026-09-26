const {seedFrozenPreview}=await import('./test-frozen-book.mjs');
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
process.env.COMMERCE_PREVIEW='1';process.env.DATABASE_URL='';process.env.NODE_ENV='test';delete process.env.VERCEL;
const KEY='0123456789abcdef0123456789abcdef0123456789abcdef';
const {identityClientIp,buildEnvelope,centralConfigured,centralMemberRequest,centralMemberPhoneLookup,centralIdentityVerifyRequest,centralIdentityVerifyConfirm,planWriteRequest,signCentralRequest,CENTRAL_SIGNING_CONTEXT}=await import('./central-client.mjs');
const {handler}=await import('../../api/server.mjs');

seedFrozenPreview();
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
  const read=await centralMemberRequest('plan.read','member-42',{month:'2026-09'},{env,fetchImpl,clientIp:'203.0.113.7'});
  assert.equal(read.status,200);assert.equal(read.body.signatureOk,true);assert.equal(read.body.echo.month,'2026-09');
  assert.equal(calls[0].url,'https://central.test/api/service/member');assert.equal(calls[0].init.redirect,'error');
  const write=await centralMemberRequest('plan.write','member-42',{month:'2026-09',expectedRevision:3,fields:{},idempotencyKey:'plan-attempt-0001'},{env,fetchImpl,clientIp:'203.0.113.7'});
  assert.equal(write.status,409);
  await assert.rejects(centralMemberRequest('plan.read','member-42',{},{env,fetchImpl:async()=>{throw new Error('down');}}),/central_unreachable/);
  await assert.rejects(centralMemberRequest('plan.read','member-42',{},{env,fetchImpl:async()=>({status:200,json:async()=>'text'})}),/central_invalid_response/);
});

test('protected Central uses only its pinned server secret and preserves the signed OTP request',async()=>{
  const origin='https://central-uat.example',secret='fixture-central-automation-secret';
  const env={CENTRAL_ORIGIN:origin+'/',CENTRAL_COMMERCE_KEY:KEY,CENTRAL_PROTECTION_BYPASS_ORIGIN:origin,CENTRAL_PROTECTION_BYPASS_SECRET:secret,VERCEL_AUTOMATION_BYPASS_SECRET:'wrong-app-token'};
  const seen=[];
  const result=await centralIdentityVerifyRequest('+919876543210',{env,clientIp:'203.0.113.7',fetchImpl:async(url,init)=>{
    seen.push({url,init});return {status:200,json:async()=>({challenge:'opaque-uat-challenge'})};
  }});
  assert.deepEqual(result,{challenge:'opaque-uat-challenge'});
  assert.equal(seen.length,1);
  const {url,init}=seen[0],body=JSON.parse(init.body);
  assert.equal(url,origin+'/api/service/member');
  assert.equal(init.headers['x-vercel-protection-bypass'],secret);
  assert.equal(init.headers['x-vercel-set-bypass-cookie'],undefined);
  assert.equal(init.headers['x-niasave-signature'],createHmac('sha256',KEY).update(CENTRAL_SIGNING_CONTEXT+init.body).digest('hex'));
  assert.equal(body.member.subject,'phone-bootstrap');
  assert.equal(body.request.kind,'identity.verify.request');
  assert.equal(body.request.phone,'+919876543210');
  assert.equal(init.redirect,'error');assert.equal(init.method,'POST');
  assert.equal(init.body.includes(secret),false);
  assert.equal(JSON.stringify(result).includes(secret),false);
});

test('absent Central bypass preserves production headers and ignores this deployment automation token',async()=>{
  const env={CENTRAL_ORIGIN:'https://central.example',CENTRAL_COMMERCE_KEY:KEY,VERCEL_ENV:'production',VERCEL_AUTOMATION_BYPASS_SECRET:'own-app-secret',CENTRAL_PROTECTION_BYPASS_ORIGIN:'https://old-uat.example'};
  await centralMemberRequest('member.identity','member-1',{}, {env,fetchImpl:async(_url,init)=>{
    assert.deepEqual(Object.keys(init.headers).sort(),['content-type','x-niasave-signature']);
    assert.equal(init.redirect,'error');
    return {status:200,json:async()=>({source:'central'})};
  }});
});

test('configured Central bypass rejects invalid or different origins before making any request',async()=>{
  const origin='https://central-uat.example',secret='fixture-private-token';let calls=0;
  const base={CENTRAL_ORIGIN:origin,CENTRAL_COMMERCE_KEY:KEY,CENTRAL_PROTECTION_BYPASS_ORIGIN:origin,CENTRAL_PROTECTION_BYPASS_SECRET:secret};
  const fetchImpl=async()=>{calls++;throw Error('must not fetch');};
  for(const patch of [
    {CENTRAL_PROTECTION_BYPASS_ORIGIN:undefined},
    {CENTRAL_PROTECTION_BYPASS_ORIGIN:'http://central-uat.example'},
    {CENTRAL_PROTECTION_BYPASS_ORIGIN:'https://other.example'},
    {CENTRAL_PROTECTION_BYPASS_ORIGIN:'https://central-uat.example.attacker.example'},
    {CENTRAL_ORIGIN:'https://other.example'},
    {CENTRAL_ORIGIN:origin+':444'},
    {CENTRAL_ORIGIN:origin+'/api'},
    {CENTRAL_ORIGIN:origin+'?token=private-query'},
    {CENTRAL_ORIGIN:origin+'#private-fragment'},
    {CENTRAL_ORIGIN:'https://private-user:private-password@central-uat.example'},
    {CENTRAL_PROTECTION_BYPASS_SECRET:secret+'\r\nx-private: hidden'},
  ])await assert.rejects(centralMemberRequest('member.identity','member-1',{}, {env:{...base,...patch},fetchImpl}),e=>e.status===503&&e.message==='central_protection_not_configured');
  assert.equal(calls,0);
});

test('protected Central transport and non-JSON failures never expose the token or follow redirects',async()=>{
  const secret='fixture-very-private-token',env={CENTRAL_ORIGIN:'https://central-uat.example',CENTRAL_COMMERCE_KEY:KEY,CENTRAL_PROTECTION_BYPASS_ORIGIN:'https://central-uat.example',CENTRAL_PROTECTION_BYPASS_SECRET:secret};
  let calls=0;
  await assert.rejects(centralMemberRequest('member.identity','member-1',{}, {env,fetchImpl:async(_url,init)=>{
    calls++;assert.equal(init.redirect,'error');throw Error('Redirect rejected: '+secret);
  }}),e=>e.status===503&&e.message==='central_unreachable');
  await assert.rejects(centralMemberRequest('member.identity','member-1',{}, {env,fetchImpl:async(_url,init)=>{
    calls++;assert.equal(init.redirect,'error');return {status:401,json:async()=>{throw new SyntaxError('Private response '+secret);}};
  }}),e=>e.status===503&&e.message==='central_invalid_response');
  assert.equal(calls,2);
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

test("M0 refuses Earn submission and withdrawal even when Central Earn is configured",async()=>{process.env.EARN_SOURCE='central';try{
  for(const [path,body] of [['/earn/applications',{jobId:'fixture',revision:'1',consent:true}],['/earn/applications/withdraw',{applicationId:'app-fixture',expectedRevision:1}]]){
    const r=await request(path,body);assert.equal(r.status,503);assert.equal(r.body.error,'pilot_commitments_paused');
  }
}finally{delete process.env.EARN_SOURCE;}});

test('identity verify goes to Central kinds, not COMMERCE_IDENTITY_URL', async () => {
  const env={CENTRAL_ORIGIN:'https://central.test/',CENTRAL_COMMERCE_KEY:KEY};
  const seen=[];
  const fetchImpl=async(url,init)=>{
    seen.push({url,body:JSON.parse(init.body)});
    const kind=JSON.parse(init.body).request.kind;
    if(kind==='identity.verify.request')return {status:200,json:async()=>({challenge:'opaque-challenge'})};
    if(kind==='identity.verify.confirm')return {status:200,json:async()=>({token:'sess',account:{id:'nm-kyc-1',role:'member',authVersion:'a'.repeat(64)}})};
    return {status:400,json:async()=>({error:'unknown_request'})};
  };
  const requested=await centralIdentityVerifyRequest('+919876543210',{env,fetchImpl,clientIp:'203.0.113.7'});
  assert.equal(requested.challenge,'opaque-challenge');
  assert.equal(seen[0].url,'https://central.test/api/service/member');
  assert.equal(seen[0].body.request.kind,'identity.verify.request');
  assert.equal(seen[0].body.request.channel,'whatsapp');
  assert.equal(seen[0].body.member.subject,'phone-bootstrap');
  const confirmed=await centralIdentityVerifyConfirm('opaque-challenge','123456','+919876543210',{env,fetchImpl,clientIp:'203.0.113.7'});
  assert.equal(confirmed.accountId,'nm-kyc-1');
  await assert.rejects(centralIdentityVerifyRequest('+919876543210',{env,clientIp:'203.0.113.7',fetchImpl:async()=>({status:400,json:async()=>({error:'unknown_request'})})}),/otp_unavailable/);
  await assert.rejects(centralIdentityVerifyConfirm('opaque-challenge','000000','+919876543210',{env,fetchImpl:async()=>({status:200,json:async()=>({ok:true})})}),/bad_otp/);
});


test('OTP client IP is platform-derived, not browser or arbitrary forwarded data',()=>{
 const req={headers:{'x-forwarded-for':'198.51.100.9','x-vercel-forwarded-for':'203.0.113.7'},socket:{remoteAddress:'127.0.0.1'},body:{clientIp:'1.2.3.4'}};
 assert.equal(identityClientIp(req,{}),'127.0.0.1');
 assert.equal(identityClientIp(req,{VERCEL:'1'}),'203.0.113.7');
 assert.equal(identityClientIp({...req,headers:{'x-forwarded-for':'198.51.100.9'}},{VERCEL:'1'}),null);
 assert.equal(identityClientIp({...req,headers:{'x-vercel-forwarded-for':'invalid'}},{VERCEL:'1'}),null);
});

test('OTP confirmation rejects missing identity, wrong role and masked upstream 401; outages stay retryable',async()=>{
 const env={CENTRAL_ORIGIN:'https://central.test',CENTRAL_COMMERCE_KEY:KEY};
 const result=(status,body)=>({env,fetchImpl:async()=>({status,json:async()=>body})});
 for(const body of [{ok:true},{account:{id:'m1',role:'admin'}},{account:{id:'',role:'member'}},{account:{subject:'m1',role:'member'}}]){
  await assert.rejects(centralIdentityVerifyConfirm('challenge','123456','+919876543210',result(200,body)),e=>e.status===401&&e.message==='bad_otp');
 }
 await assert.rejects(centralIdentityVerifyConfirm('challenge','123456','+919876543210',result(401,{error:'not_enrolled'})),e=>e.status===401&&e.message==='bad_otp');
 await assert.rejects(centralIdentityVerifyConfirm('challenge','123456','+919876543210',result(503,{})),e=>e.status===503&&e.message==='identity_unavailable');
 await assert.rejects(centralIdentityVerifyRequest('+919876543210',{...result(429,{}),clientIp:'203.0.113.7'}),e=>e.status===429);
 await assert.rejects(centralIdentityVerifyRequest('+919876543210',{...result(200,{challenge:'x'})}),e=>e.status===503);
 const seen=[];
 const confirmed=await centralIdentityVerifyConfirm('challenge','123456','+919876543210',{env,fetchImpl:async(_url,init)=>{seen.push(JSON.parse(init.body));return {status:200,json:async()=>({account:{id:'canonical-member',authVersion:'a'.repeat(64),authSubject:'ignored-subject',role:'member',locationIds:[]},token:'never-exposed'})};}});
 assert.equal(seen[0].request.phone,'+919876543210');
 assert.equal(confirmed.accountId,'canonical-member');
 assert.equal(confirmed.account.authSubject,'canonical-member');
 assert.equal(confirmed.token,undefined);
});


test('only OTP delivery uses a bounded 30-second budget; other Central calls stay at eight seconds',async()=>{
 const original=AbortSignal.timeout,budgets=[];
 AbortSignal.timeout=(ms)=>{budgets.push(ms);return original(ms);};
 const env={CENTRAL_ORIGIN:'https://central.test',CENTRAL_COMMERCE_KEY:KEY};
 try{
  const fetchImpl=async()=>({status:200,json:async()=>({challenge:'challenge'})});
  await centralIdentityVerifyRequest('+919876543210',{env,fetchImpl,clientIp:'203.0.113.7'});
  await centralMemberRequest('member.identity','member-1',{}, {env,fetchImpl});
  assert.deepEqual(budgets,[30000,8000]);
 }finally{AbortSignal.timeout=original;}
});
