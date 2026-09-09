import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
process.env.COMMERCE_PREVIEW='1';process.env.DATABASE_URL='';process.env.NODE_ENV='test';delete process.env.VERCEL;
const {handler}=await import('../../api/server.mjs');
const {resetDummy,scanOrder,closeBeat,ledgerOf}=await import('../../rabbit/engine.mjs');
const core=await import('./core.mjs');
async function request(path,body,cookie='',headers={}){
 const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);Object.assign(req,{url:'/api/commerce'+path,method:body===undefined?'GET':'POST',headers:{host:'localhost:8787',origin:'http://localhost:8787','content-type':'application/json',cookie,...headers},socket:{remoteAddress:'127.0.0.1'}});
 let code,h,payload;const res={writeHead(status,head){code=status;h=head;},end(raw){payload=JSON.parse(raw);}};await handler(req,res);return {status:code,headers:h,body:payload};
}
function fresh(){const s=resetDummy();s.orders=[];s.reservations=[];s.scans=[];s.payments=[];s.settlements=[];s.ordersById.clear();s.ordersByCode.clear();s.orderIdsByStop.clear();return s;}
async function login(role='member'){const r=await request('/auth/preview',{role});assert.equal(r.status,200);return r.headers['set-cookie'].split(';')[0];}
test('HTTP session, role enforcement, no CSRF and persistent duplicate request protection',async()=>{
 fresh();const cookie=await login();assert.match(cookie,/nia_commerce=/);const cat=await request('/catalogue',undefined,cookie);assert.equal(cat.body.account.role,'member');assert.equal(cat.body.preview,true);assert.equal(cat.headers['cache-control'],'no-store');
 const csrf=await request('/orders',{},cookie,{origin:'https://attacker.invalid'});assert.equal(csrf.status,403);
 const unauth=await request('/orders',{});assert.equal(unauth.status,401);
 const enterprise=await login('enterprise');assert.equal((await request('/orders',{},enterprise)).status,403);
 const investor=await login('investor');assert.equal((await request('/orders',undefined,investor)).status,403);
 const intent={locationId:'S01',fulfillment:'pickup',lines:[{id:'groundnut_oil',qty:1}]};const q=await request('/quote',intent,cookie);assert.equal(q.status,200);
 const body={...intent,fingerprint:q.body.fingerprint};const key=randomUUID();const [a,b]=await Promise.all([request('/orders',body,cookie,{'idempotency-key':key}),request('/orders',body,cookie,{'idempotency-key':key})]);assert.equal(a.status,201);assert.equal(b.status,201);assert.equal(a.body.id,b.body.id);assert.equal((await request('/orders',undefined,cookie)).body.orders.length,1);
 assert.equal(scanOrder({orderId:a.body.id,type:'collected',pickupCode:a.body.pickupCode}).error,'use_commerce_handover');assert.equal(closeBeat({closing:ledgerOf().leftover}).error,'commerce_orders_unresolved');
 assert.equal((await request('/auth/logout',{},cookie)).status,200);assert.equal((await request('/orders',undefined,cookie)).status,401);
});
test('concurrent reservations from different accounts cannot oversell the last unit',async()=>{
 const s=fresh();s.beat.opening.groundnut_oil=1;core.initialise(s,(await import('../../rabbit/engine.mjs')).SKUS,true,Date.now());
 const cookies=Array.from({length:10},(_,i)=>{const id='test-'+i,key='cookie-'+i;s.commerce.accounts[id]={id,name:'Test member',role:'member',locationIds:['S01']};s.commerce.sessions[core.hash(key)]={accountId:id,expires:Date.now()+60000};return 'nia_commerce='+key;});
 const intent={locationId:'S01',fulfillment:'pickup',lines:[{id:'groundnut_oil',qty:1}]};const q=await request('/quote',intent,cookies[0]);const results=await Promise.all(cookies.map(cookie=>request('/orders',{...intent,fingerprint:q.body.fingerprint},cookie,{'idempotency-key':randomUUID()})));
 assert.equal(results.filter(r=>r.status===201).length,1);assert.equal(results.filter(r=>r.status===409).length,9);
});
test('recovery creates a request without changing ownership or exposing member data',async()=>{
 const s=fresh();const cookie=await login();const result=await request('/recovery',{memberId:'preview-member',newPhone:'+919876543210'});assert.equal(result.status,201);assert.equal(result.body.newPhone,undefined);assert.equal((await request('/catalogue',undefined,cookie)).body.account.id,'preview-member');const ticket=s.commerce.tickets[0];assert.equal(ticket.status,'open');
 const rejected=await request('/staff/recovery',{ticketId:ticket.id,evidenceReference:'test',providerUpdated:false});assert.equal(rejected.status,400);
 const resolved=await request('/staff/recovery',{ticketId:ticket.id,evidenceReference:'PREVIEW identity review',providerUpdated:true});assert.equal(resolved.status,200);assert.equal((await request('/orders',undefined,cookie)).status,401);
});
test('production cannot use preview accounts or memory-only order acknowledgements',async()=>{
 process.env.NODE_ENV='production';try{const r=await request('/catalogue');assert.equal(r.status,503);assert.equal(r.body.error,'commerce_not_configured');assert.equal((await request('/auth/preview',{role:'member'})).status,503);}finally{process.env.NODE_ENV='test';}
});

test('LESS Live reservations share the canonical Living book and authenticated member, with safe retries',async()=>{
 fresh();const {resetBison,bookingsPayload,contractsPayload}=await import('../../bison/engine.mjs');resetBison();
 const cookie=await login();const catalogue=await request('/nests');assert.equal(catalogue.status,200);assert.equal(catalogue.body.preview,true);
 assert.equal(JSON.stringify(catalogue.body).includes('Ravi'),false);assert.equal(catalogue.body.offers[0].nestIds,undefined);
 const intent={studioId:catalogue.body.offers[0].studioId,start:catalogue.body.start,rent:1,total:1};
 assert.equal((await request('/nests/quote',intent)).status,401);
 const q=await request('/nests/quote',intent,cookie);assert.equal(q.status,200);assert.equal(q.body.total,2464);
 const body={...intent,fingerprint:q.body.fingerprint};const key=randomUUID();
 const [a,b]=await Promise.all([request('/nests/bookings',body,cookie,{'idempotency-key':key}),request('/nests/bookings',body,cookie,{'idempotency-key':key})]);
 assert.equal(a.status,201);assert.equal(b.status,201);assert.equal(a.body.id,b.body.id);assert.equal(a.body.paidAmount,0);assert.equal(a.body.contractStatus,'pending');
 const rows=bookingsPayload({}).bookings;assert.equal(rows.find(v=>v.id===a.body.id).memberId,'preview-member');
 assert.ok(contractsPayload({}).contracts.some(c=>c.bookingId===a.body.id&&c.status==='pending'));
 assert.equal((await request('/nests/bookings',undefined,cookie)).body.bookings.length,1);
 assert.equal((await request('/nests/bookings',{...body,start:'2099-01-01'},cookie,{'idempotency-key':key})).status,409);
 const investor=await login('investor');assert.equal((await request('/nests/bookings',undefined,investor)).status,403);
 assert.equal((await request('/nests/cancel',{bookingId:a.body.id},cookie,{origin:'https://attacker.invalid'})).status,403);
 assert.equal((await request('/nests/cancel',{bookingId:a.body.id},cookie)).body.status,'cancelled');
 assert.equal((await request('/nests/bookings',body,cookie,{'idempotency-key':key})).body.status,'cancelled');
});

test('concurrent member requests cannot take the same last Nest; other members cannot read or cancel it',async()=>{
 const save=fresh();core.initialise(save,(await import('../../rabbit/engine.mjs')).SKUS,true,Date.now());
 const {resetBison}=await import('../../bison/engine.mjs');const living=resetBison();living.dummy=false;living.studios=[{...living.studios[0],capacity:1}];living.bookings=[];living.contracts=[];
 const cookies=Array.from({length:5},(_,i)=>{const id='nest-'+i,key='nest-cookie-'+i;save.commerce.accounts[id]={id,name:'Member '+i,role:'member',locationIds:['S01']};save.commerce.sessions[core.hash(key)]={accountId:id,expires:Date.now()+60000};return 'nia_commerce='+key;});
 const catalogue=await request('/nests');const intent={studioId:catalogue.body.offers[0].studioId,start:catalogue.body.start};
 const q=await request('/nests/quote',intent,cookies[0]);
 const results=await Promise.all(cookies.map(cookie=>request('/nests/bookings',{...intent,fingerprint:q.body.fingerprint},cookie,{'idempotency-key':randomUUID()})));
 assert.equal(results.filter(r=>r.status===201).length,1);assert.equal(results.filter(r=>r.status===409).length,4);
 const winner=results.findIndex(r=>r.status===201),other=(winner+1)%5;
 assert.equal((await request('/nests/bookings',undefined,cookies[other])).body.bookings.length,0);
 assert.equal((await request('/nests/cancel',{bookingId:results[winner].body.id},cookies[other])).status,404);
});
