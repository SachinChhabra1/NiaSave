import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
process.env.STAFF_TOKEN_SECRET=randomBytes(32).toString('base64url');
const {issueStaffToken,staffPageCookie,STAFF_PAGE_COOKIE,registerStaffSession}=await import('./staff-auth.mjs');
const {staffPageAccess}=await import('./staff-pages.mjs');
const ajay={id:'stf-ajay-mahawar',email:'ajay.mahawar@nia.one'};
const admin={id:'stf-admin',email:'admin@nia.one'};
const request=(path,token='',method='GET')=>new Request('https://www.niasave.com'+path,{method,headers:token?{cookie:STAFF_PAGE_COOKIE+'='+token}:{}});
test('every deployed desk and clean alias challenges before serving a desk document',async()=>{
  for(const page of ['ops','polo','desk','2para','bison','bison-data','bison-clocks','bison-contracts','bison-collections','bison-nests','bison-studios','pickup','recon','predict','hub','next','cash','source','inventory','ageing','po','dispatch','invoice','biker','tanot/index']) {
    for(const suffix of ['','.html','/']) {
      const r=await staffPageAccess(request('/'+page+suffix));
      assert.equal(r.status,401,page+suffix);
      assert.match(r.headers.get('cache-control'),/no-store/);
      const body=await r.text();assert.match(body,/staff-entry.js/);assert.doesNotMatch(body,/bison-data.js|commerce-ops.js/);
    }
  }
  const head=await staffPageAccess(request('/ops.html','','HEAD'));assert.equal(head.status,401);assert.equal(await head.text(),'');
});
test('Ajay can open Living pages but cannot open Sikh or Dogra pages',async()=>{
  const token=issueStaffToken(ajay);
  const ajaySession=await registerStaffSession(token);
  assert.equal(ajaySession.ok,true);
  assert.equal(await staffPageAccess(request('/bison-data.html',token)),undefined);
  assert.equal(await staffPageAccess(request('/bison.html',token)),undefined);
  for(const path of ['/ops.html','/polo','/tanot','/tanot/index.html','/tanot/assets/bundle.js'])assert.equal((await staffPageAccess(request(path,token))).status,403);
  const adminToken=issueStaffToken(admin);
  const adminSession=await registerStaffSession(adminToken);
  assert.equal(adminSession.ok,true);
  assert.equal(await staffPageAccess(request('/ops.html',adminToken)),undefined);
  assert.equal((await staffPageAccess(request('/bison-data.html',token+'x'))).status,401);
  assert.equal((await staffPageAccess(request('/bison-data.html',issueStaffToken(ajay,Date.now()-13*3600000)))).status,401);
});
test('login assets and application authentication routes stay available to obtain a credential',async()=>{
  for(const path of ['/staff.js','/staff.css','/staff-entry.js','/v1/staff/login','/v1/staff/me','/api/bison/tower','/api/service/member','/commerce.html','/'])assert.equal(await staffPageAccess(request(path)),undefined);
});
test('staff page cookie is secure, host-only and never outlives its signed token',()=>{
  const now=Math.floor(Date.now()/1000)*1000,token=issueStaffToken(ajay,now-3600000),cookie=staffPageCookie(token,now);
  assert.match(cookie,/^__Host-nia_staff_page=/);
  assert.match(cookie,/Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=39600$/);
  assert.doesNotMatch(cookie,/Domain=/i);
  assert.match(staffPageCookie('',now),/Max-Age=0$/);
});
