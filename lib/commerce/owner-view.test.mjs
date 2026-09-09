import test from 'node:test';
import assert from 'node:assert/strict';
process.env.DUMMY_DATA='0';
process.env.STAFF_AUTH_REQUIRED='1';
const {ownerViewHttp}=await import('./owner-view.mjs');
const {default:handler,issueStaffToken}=await import('../../api/server.mjs');
const admin={id:'stf-admin',email:'admin@nia.one',role:'admin',name:'Admin'};
const response=()=>({status:0,body:null,writeHead(status,headers){this.status=status;this.headers=headers;},end(raw){this.body=JSON.parse(raw);}});
async function call(path,staff=admin,method='GET',dependencies={}) {
  const res=response();await ownerViewHttp({method,url:'/v1/staff/storefront'+path,headers:{}},res,path.split('?')[0],()=>staff,dependencies);return res;
}
test('owner route rejects anonymous, nonadmin, mutations and private paths',async()=>{
  assert.equal((await call('/catalogue',null)).status,401);
  assert.equal((await call('/catalogue',{role:'living'})).status,403);
  for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await call('/catalogue',admin,method)).status,405);
  for(const path of ['/books','/orders','/nests/bookings','/earn/applications','/membership'])assert.equal((await call(path)).status,404);
});
test('router verifies actual signed staff tokens including rewritten route; open desk cannot enter',async()=>{
  for(const url of ['/v1/staff/storefront/catalogue','/api?path=v1/staff/storefront/catalogue']) {
    for(const token of ['',issueStaffToken(admin,Date.now()-13*3600000),issueStaffToken(admin)+'x']) {
      const res=response();await handler({url,method:'GET',headers:{authorization:'Bearer '+token}},res);assert.equal(res.status,401);
    }
    const res=response();await handler({url,method:'POST',headers:{authorization:'Bearer '+issueStaffToken(admin)}},res);assert.equal(res.status,405);
  }
});
test('Save catalogue neither returns nor mutates member records or expired orders',async()=>{
  const state={dummy:false,beat:{beatDate:'2026-09-09',open:false,opening:{}},orders:[{id:'private-order',memberId:'private-member',source:'commerce',status:'reserved',expiresAt:'2020-01-01'}],reservations:[],commerce:{accounts:{secret:{phone:'private-phone'}},sessions:{private:'session'},audit:[],config:null}};
  const before=structuredClone(state);
  const res=await call('/catalogue',admin,'GET',{saveState:fn=>fn(state)});
  assert.equal(res.status,200);assert.equal(res.body.ownerView,true);assert.equal(res.body.account,null);assert.equal(res.headers['cache-control'],'no-store');
  assert.deepEqual(state,before);assert.doesNotMatch(JSON.stringify(res.body),/private-|secret/);
  state.dummy=true;assert.equal((await call('/catalogue',admin,'GET',{saveState:fn=>fn(state)})).status,503);
});
test('Living projection does not expire stored reservations; dates are validated',async()=>{
  const state={dummy:false,studios:[],members:[{id:'private-member'}],bookings:[],contracts:[],collectionPayments:[],memberCatalogue:{verified:false,offers:[]}};
  const before=structuredClone(state),deps={livingState:fn=>fn(state)};
  assert.equal((await call('/nests',admin,'GET',deps)).status,200);
  assert.equal((await call('/nests?start=invalid',admin,'GET',deps)).status,400);
  assert.deepEqual(state,before);
});
test('Earn signs only verified staff context, with no chosen member or personal request',async()=>{
  const res=await call('/earn',admin,'GET',{centralRequest:async(...args)=>{assert.deepEqual(args,['owner.earn','staff:stf-admin',{role:'admin'}]);return {status:200,body:{ownerView:true,jobs:[]}};}});
  assert.equal(res.status,200);
});
