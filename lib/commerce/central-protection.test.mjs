import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { centralConfigured, centralMemberRequest, centralProtectionHeaders, signCentralRequest } from './central-client.mjs';

const origin='https://central-preview.vercel.app';
const settings=()=>({CENTRAL_ORIGIN:origin,CENTRAL_COMMERCE_KEY:randomBytes(32).toString('hex'),CENTRAL_PROTECTION_BYPASS_ORIGIN:origin,CENTRAL_PROTECTION_BYPASS_SECRET:randomBytes(32).toString('hex')});

test('preview bypass accompanies the service signature only to the exact configured origin',async()=>{
  const env=settings();let calls=0;
  const answer=await centralMemberRequest('plan.read','test-subject',{month:'2026-09'},{env,fetchImpl:async(url,init)=>{
    calls++;assert.equal(url,origin+'/api/service/member');
    assert.equal(init.headers['x-vercel-protection-bypass'],env.CENTRAL_PROTECTION_BYPASS_SECRET);
    assert.equal(init.headers['x-niasave-signature'],signCentralRequest(init.body,env.CENTRAL_COMMERCE_KEY));
    assert.equal(init.redirect,'error');assert.equal(init.headers['x-vercel-set-bypass-cookie'],undefined);
    assert.equal(url.includes(env.CENTRAL_PROTECTION_BYPASS_SECRET),false);
    assert.equal(init.body.includes(env.CENTRAL_PROTECTION_BYPASS_SECRET),false);
    return {status:200,json:async()=>({revision:2})};
  }});
  assert.equal(calls,1);assert.deepEqual(answer,{status:200,body:{revision:2}});
});

test('unconfigured or mismatched bypass fails before sending any network request',async()=>{
  for(const allowed of [undefined,'https://other.vercel.app','https://central-preview.vercel.app.evil.test',origin+'/api',origin+'?x=1']){
    const env={...settings(),CENTRAL_PROTECTION_BYPASS_ORIGIN:allowed};
    await assert.rejects(centralMemberRequest('plan.read','test-subject',{},{env,fetchImpl:()=>assert.fail('must not fetch')}),/central_protection_not_configured/);
  }
  assert.throws(()=>centralProtectionHeaders({...settings(),CENTRAL_PROTECTION_BYPASS_SECRET:'invalid\r\nheader'}),/central_protection_not_configured/);
});

test('canonical production and ordinary connections never receive a preview credential',async()=>{
  assert.deepEqual(centralProtectionHeaders({...settings(),CENTRAL_ORIGIN:'https://rafiqicentral.com'}),{});
  assert.deepEqual(centralProtectionHeaders({CENTRAL_ORIGIN:origin,VERCEL_AUTOMATION_BYPASS_SECRET:randomBytes(32).toString('hex')}),{});
  const env={...settings(),CENTRAL_ORIGIN:'https://rafiqicentral.com/'};
  await centralMemberRequest('plan.write','test-subject',{},{env,fetchImpl:async(url,init)=>{
    assert.equal(init.headers['x-vercel-protection-bypass'],undefined);
    return {status:409,json:async()=>({error:'plan_revision_conflict'})};
  }});
});

test('Central configuration rejects URLs containing credentials, query strings, fragments or paths',()=>{
  for(const target of ['http://central.test','https://name:password@central.test','https://central.test?key=x','https://central.test/#fragment','https://central.test/api','https://central.test.attacker.invalid/path'])
    assert.equal(centralConfigured({...settings(),CENTRAL_ORIGIN:target}),false);
});

test('identified caller uses its own credential and does not fall back after partial configuration',async()=>{
 const env={...settings(),CENTRAL_SERVICE_KEY_ID:'niasave-preview-current',CENTRAL_SERVICE_KEY:randomBytes(32).toString('hex')};
 await centralMemberRequest('plan.read','test-subject',{},{env,fetchImpl:async(url,init)=>{
  assert.equal(init.headers['x-niasave-key-id'],env.CENTRAL_SERVICE_KEY_ID);
  assert.equal(init.headers['x-niasave-signature'],signCentralRequest(init.body,env.CENTRAL_SERVICE_KEY));
  assert.notEqual(init.headers['x-niasave-signature'],signCentralRequest(init.body,env.CENTRAL_COMMERCE_KEY));
  return {status:200,json:async()=>({revision:1})};
 }});
 for(const config of [{CENTRAL_SERVICE_KEY_ID:'niasave-prod'}, {CENTRAL_SERVICE_KEY:env.CENTRAL_SERVICE_KEY}, {CENTRAL_SERVICE_KEY_ID:'invalid header',CENTRAL_SERVICE_KEY:env.CENTRAL_SERVICE_KEY}])
  assert.equal(centralConfigured({...settings(),...config}),false);
});
