import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { checkHostedShowcase } from '../../scripts/check-hosted-showcase.mjs';

test('hosted acceptance checks read, save, exact retry, stale conflict, reload and Earn without changing plan figures',async()=>{
  const env={SHOWCASE_PASSWORD:randomBytes(32).toString('hex'),SHOWCASE_EXPECTED_JOB_IDS:'1,2,3,4',SHOWCASE_EXPECTED_APPLICATIONS:JSON.stringify([{id:'application-test',status:'interview'}]),SHOWCASE_ACCEPTANCE_WRITE:'1'};
  let revision=2,saved,key;const fields={incomePaise:2200000};
  const fetchImpl=async(url,init)=>{
    assert.equal(init.redirect,'error');let body,status=200;const path=new URL(url).pathname;
    if(path.endsWith('/health'))body={environment:'showcase',sharedDemoMember:true,payments:false};
    else if(path.endsWith('/auth/preview'))body={ok:true};
    else if(path.endsWith('/earn'))body={source:'central',map:{status:'ready'},jobs:['1','2','3','4'].map(id=>({id,employer:'Demo · Fictional employer'}))};
    else if(path.endsWith('/applications'))body={applications:[{id:'application-test',status:'interview'}]};
    else if(init.method==='PUT'){
      const input=JSON.parse(init.body);assert.deepEqual(input.fields,fields);
      if(init.headers['idempotency-key']===key)body=saved;
      else if(input.expectedRevision!==revision){status=409;body={error:'plan_revision_conflict'};}
      else{revision++;key=init.headers['idempotency-key'];body=saved={ok:true,plan:{revision,fields}};}
    }else body={month:'2026-09',revision,fields,capabilities:{canSave:true}};
    return new Response(JSON.stringify(body),{status,headers:{'set-cookie':'test-session=generated-test-cookie; Secure; HttpOnly'}});
  };
  const result=await checkHostedShowcase(env,fetchImpl);
  assert.equal(result.status,'passed');assert.equal(revision,3);assert.equal(result.checks.length,10);
  assert.equal(JSON.stringify(result).includes(env.SHOWCASE_PASSWORD),false);
});
