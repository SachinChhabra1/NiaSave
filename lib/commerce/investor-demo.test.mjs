import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {enableShowcaseEntry} from './showcase-mode.mjs';
import {investorDemo} from '../../showcase/investor-mode.mjs';
import {seedInvestorDemo} from '../../showcase/investor-fixtures.mjs';
import {showcaseAccess} from '../../showcase/access.mjs';
import {createInvestorHandler} from '../../showcase/investor-http.mjs';
test('flag alone cannot activate demo in the normal entry',()=>{
 assert.equal(investorDemo({NIA_SHOWCASE:'1',NIASAVE_INVESTOR_DEMO:'1'}),false);
 enableShowcaseEntry();
 assert.equal(investorDemo({NIA_SHOWCASE:'1'}),false);
 assert.equal(investorDemo({NIASAVE_INVESTOR_DEMO:'1'}),false);
 assert.equal(investorDemo({NIA_SHOWCASE:'1',NIASAVE_INVESTOR_DEMO:'1'}),true);
});
test('production headers, cookies and auth are byte-identical with demo flag absent or outside showcase',async()=>{
 const previous={...process.env};
 const {default:middleware}=await import('../../middleware.js');
 const {memberSessionCookie}=await import('./member-password.mjs');
 const render=async()=>{
  const result=await middleware(new Request('https://www.niasave.com/ops.html'));
  return {status:result.status,headers:[...result.headers],body:await result.text(),cookie:memberSessionCookie('synthetic-token')};
 };
 try{
  delete process.env.NIA_SHOWCASE;delete process.env.NIASAVE_INVESTOR_DEMO;
  const original=await render();
  assert.equal(original.status,401);
  assert.equal(Object.fromEntries(original.headers)['x-frame-options'],'DENY');
  assert.ok(Object.fromEntries(original.headers)['content-security-policy'].includes("frame-ancestors 'none'"));
  assert.equal(original.cookie,'nia_member=synthetic-token; Path=/api/commerce; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000');
  process.env.NIASAVE_INVESTOR_DEMO='1';
  assert.deepEqual(await render(),original);
  delete process.env.NIASAVE_INVESTOR_DEMO;process.env.NIA_SHOWCASE='1';
  assert.deepEqual(await render(),original);
 }finally{process.env=previous;}
 assert.equal(showcaseAccess(undefined,'synthetic-test-password-with-24-characters'),false);
 const headers=JSON.parse(await readFile(new URL('../../vercel.json',import.meta.url),'utf8')).headers.flatMap(h=>h.headers);
 assert.ok(headers.some(h=>h.key.toLowerCase()==='x-frame-options'&&h.value==='DENY'));
 assert.ok(headers.some(h=>h.key.toLowerCase()==='content-security-policy'&&h.value.includes("frame-ancestors 'none'")));
});
test('fixture bootstrap is idempotent and labels all records fictional',()=>{
 const s=seedInvestorDemo({},1700000000000);s.orders.push({id:'preserved'});
 seedInvestorDemo(s,1800000000000);assert.equal(s.orders[0].id,'preserved');assert.equal(s.commerce.config.products.length,20);
 assert.ok(s.commerce.config.products.every(p=>p.test&&p.name.startsWith('DEMO ')&&p.pricePaise>0));
 assert.equal(s.commerce.accounts['preview-member'].test,true);
});
test('disabled demo API cannot issue cookies, authenticate or touch storage',async()=>{
 const before=process.env.NIASAVE_INVESTOR_DEMO;delete process.env.NIASAVE_INVESTOR_DEMO;
 let touched=false,headers,status;
 await createInvestorHandler(()=>{touched=true;})({method:'GET',headers:{}},{writeHead:(s,h)=>{status=s;headers=h;},end:()=>{}},'/catalogue');
 assert.equal(touched,false);assert.equal(status,404);assert.equal(headers['set-cookie'],undefined);
 if(before!==undefined)process.env.NIASAVE_INVESTOR_DEMO=before;
});
