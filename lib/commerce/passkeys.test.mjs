import test from 'node:test';import assert from 'node:assert/strict';
import {preparePasskeys,passkeyActor} from './passkeys.mjs';
const token='A'.repeat(43),binding='B'.repeat(43),challenge='C'.repeat(43);
const req=cookie=>({method:'POST',headers:{cookie:cookie||''}});
test('passkey adapter binds ceremony to an HTTP-only cookie and never returns Central session secrets in JSON',async()=>{
 const originalFetch=globalThis.fetch,oldOrigin=process.env.CENTRAL_ORIGIN,oldKey=process.env.CENTRAL_COMMERCE_KEY;
 process.env.CENTRAL_ORIGIN='https://central.test';process.env.CENTRAL_COMMERCE_KEY='k'.repeat(32);
 const calls=[];globalThis.fetch=async(url,init)=>{const r=JSON.parse(init.body).request;calls.push(r);return Response.json(r.kind==='passkey.options'?{options:{challenge:'test'},challengeId:challenge}:{token,account:{id:'history-owner',authSubject:'new-subject',memberId:'m1',role:'member',name:'Test',locationIds:[]}});};
 try{
  const options=await preparePasskeys(req(),'/auth/passkey/options',{mode:'register',setupToken:token});assert.equal(options.status,200);assert.equal(options.body.challengeId,undefined);assert.match(options.headers['set-cookie'],/HttpOnly; Secure; SameSite=Strict/);
  const verified=await preparePasskeys(req('nia_ceremony='+challenge+'.'+binding),'/auth/passkey/verify',{challengeId:'forged',binding:'forged',response:{id:'credential'}});assert.equal(verified.status,200);assert.equal(verified.body.token,undefined);assert.equal(verified.body.account.authSubject,undefined);assert.equal(calls[1].binding,binding);assert.equal(calls[1].challengeId,challenge);assert.match(verified.headers['set-cookie'][0],/pk-/);
  assert.equal((await preparePasskeys(req(),'/auth/passkey/verify',{challengeId:challenge,binding})).status,401);
 }finally{globalThis.fetch=originalFetch;if(oldOrigin===undefined)delete process.env.CENTRAL_ORIGIN;else process.env.CENTRAL_ORIGIN=oldOrigin;if(oldKey===undefined)delete process.env.CENTRAL_COMMERCE_KEY;else process.env.CENTRAL_COMMERCE_KEY=oldKey;}
});
test('every member request uses fresh Central session state; old local cookies and browser ownership are ignored',async()=>{
 const originalFetch=globalThis.fetch,env={...process.env};process.env.CENTRAL_ORIGIN='https://central.test';process.env.CENTRAL_COMMERCE_KEY='k'.repeat(32);
 let active=true;globalThis.fetch=async()=>Response.json(active?{account:{id:'history-owner',authSubject:'replacement',memberId:'m1',role:'member',locationIds:[]}}:{error:'sign_in_required'},{status:active?200:401});
 try{
  const r=req('nia_commerce=pk-'+token);assert.equal(await preparePasskeys(r,'/orders',{memberId:'other-member'}),null);assert.equal(passkeyActor(r).id,'history-owner');assert.equal(passkeyActor(r).authSubject,'replacement');
  active=false;assert.equal((await preparePasskeys(r,'/orders',{})).status,401);assert.equal(passkeyActor(r),null);
  assert.equal((await preparePasskeys(req('nia_commerce=old-local-token'),'/orders',{})).status,401);
  const anon=await preparePasskeys(req(),'/catalogue',{});assert.deepEqual(anon.body.products,[]);assert.equal(anon.body.memberAuth,'passkey');
  assert.equal((await preparePasskeys(req(),'/auth/verify',{code:'123456'})).status,404);
 }finally{globalThis.fetch=originalFetch;for(const key of ['CENTRAL_ORIGIN','CENTRAL_COMMERCE_KEY'])if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];}
});
