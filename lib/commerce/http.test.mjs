import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
process.env.COMMERCE_PREVIEW='1';process.env.DATABASE_URL='';process.env.NODE_ENV='test';delete process.env.VERCEL;
const {handler}=await import('../../api/server.mjs');
const {scanOrder,closeBeat,ledgerOf}=await import('../../rabbit/engine.mjs');
const {seedFrozenPreview:resetDummy}=await import('./test-frozen-book.mjs');
const core=await import('./core.mjs');
async function request(path,body,cookie='',headers={}){
 const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);Object.assign(req,{url:'/api/commerce'+path,method:body===undefined?'GET':'POST',headers:{host:'localhost:8787',origin:'http://localhost:8787','content-type':'application/json',cookie,...headers},socket:{remoteAddress:'127.0.0.1'}});
 let code,h,payload;const res={writeHead(status,head){code=status;h=head;},end(raw){payload=JSON.parse(raw);}};await handler(req,res);return {status:code,headers:h,body:payload};
}
function confirmPreviewPacks(s){if(!s?.commerce?.config?.products)return;s.commerce.config.products=s.commerce.config.products.map(p=>({...p,pack:p.id==='groundnut_oil'?'1 L bottle':(p.pack==='Pack size to be confirmed'?'100 g bar':p.pack)}));}
function fresh(){const s=resetDummy();s.orders=[];s.reservations=[];s.scans=[];s.payments=[];s.settlements=[];s.ordersById.clear();s.ordersByCode.clear();s.orderIdsByStop.clear();confirmPreviewPacks(s);return s;}
async function login(role='member'){const r=await request('/auth/preview',{role});assert.equal(r.status,200);return r.headers['set-cookie'].split(';')[0];}
test("M0 refuses member commitment writes while preserving order reads",async()=>{fresh();const cookie=await login();for(const path of ['/quote','/orders','/cancel','/nests/quote','/nests/bookings','/nests/cancel','/earn/applications']){const r=await request(path,{},cookie);assert.equal(r.status,503);assert.equal(r.body.error,'pilot_commitments_paused');}assert.equal((await request('/orders',undefined,cookie)).status,200);});

test('recovery creates a request without changing ownership or exposing member data',async()=>{
 const s=fresh();const cookie=await login();const result=await request('/recovery',{memberId:'preview-member',newPhone:'+919876543210'});assert.equal(result.status,201);assert.equal(result.body.newPhone,undefined);assert.equal((await request('/catalogue',undefined,cookie)).body.account.id,'preview-member');const ticket=s.commerce.tickets[0];assert.equal(ticket.status,'open');
 const rejected=await request('/staff/recovery',{ticketId:ticket.id,evidenceReference:'test',providerUpdated:false});assert.equal(rejected.status,400);
 const resolved=await request('/staff/recovery',{ticketId:ticket.id,evidenceReference:'PREVIEW identity review',providerUpdated:true});assert.equal(resolved.status,200);assert.equal((await request('/orders',undefined,cookie)).status,401);
});
test('production cannot use preview accounts or memory-only order acknowledgements',async()=>{
 process.env.NODE_ENV='production';try{const r=await request('/catalogue');assert.equal(r.status,503);assert.equal(r.body.error,'commerce_not_configured');assert.equal((await request('/auth/preview',{role:'member'})).status,503);}finally{process.env.NODE_ENV='test';}
});
