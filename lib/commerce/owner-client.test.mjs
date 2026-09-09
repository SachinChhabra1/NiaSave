import test from 'node:test';
import assert from 'node:assert/strict';
import {owner,ownerRequest,restoreOwner,exitOwner} from '../../commerce-owner.js';
const storage=new Map();
globalThis.sessionStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
test('owner client permits only catalogue reads and converts date search to GET',async()=>{
  const calls=[];
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({ownerView:true,owner:{name:'Admin'},capabilities:{readOnly:true}})};};
  storage.set('niaOpsToken','test-token');storage.set('niaOwnerView','1');
  await restoreOwner();assert.equal(owner.active,true);
  await ownerRequest('/nests/availability',{start:'2026-09-10'});
  assert.equal(calls[1].url,'/v1/staff/storefront/nests?start=2026-09-10');
  assert.equal(calls[1].options.body,undefined);
  assert.equal(calls[1].options.headers.authorization,'Bearer test-token');
  for(const [path,body] of [['/orders',undefined],['/books',undefined],['/auth/preview',{}],['/catalogue',{}],['/nests/availability',{start:'2026-09-10',memberId:'other'}]])await assert.rejects(ownerRequest(path,body),/read only/);
  assert.equal(calls.length,2);
  exitOwner();assert.equal(owner.active,false);assert.equal(storage.has('niaOpsToken'),false);
});
test('a client flag never grants access after server rejection',async()=>{
  storage.set('niaOwnerView','1');owner.active=true;
  globalThis.fetch=async()=>({ok:false,status:401,json:async()=>({error:'staff_auth_required'})});
  await assert.rejects(restoreOwner(),/expired/);
  assert.equal(owner.active,false);assert.equal(storage.has('niaOwnerView'),false);
});
