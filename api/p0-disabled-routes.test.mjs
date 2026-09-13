import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {randomBytes} from 'node:crypto';
// All identity material is synthetic; credentials are never inherited by this suite.
process.env.DUMMY_DATA='1';process.env.DEMO='1';process.env.STAFF_AUTH_REQUIRED='1';
process.env.STAFF_TOKEN_SECRET=randomBytes(32).toString('base64url');
for(const key of ['DATABASE_URL','POSTGRES_URL','VERCEL','VERCEL_ENV','NIA_SHOWCASE','CENTRAL_COMMERCE_KEY','COMMERCE_IDENTITY_KEY','COMMERCE_IDENTITY_URL'])delete process.env[key];
const {handler,issueStaffToken}=await import('./server.mjs');
const {p0Decision}=await import('../lib/p0-boundary.mjs');
const signed=issueStaffToken({id:'synthetic-p0',email:'p0@example.invalid',name:'Synthetic operator',role:'admin',desks:['living','studio','money','pilot']});
// Independently derived from handlers, not from the boundary allowlist.
const routes=new Set(['/stock','/order','/orders','/settlements','/scan','/ledger','/cash','/recon','/source','/connectors/upload','/stops','/beat/open','/beat/close','/po','/dispatch','/invoice','/biker','/dogra/state','/commerce/staff/config','/commerce/staff/action','/commerce/staff/support','/commerce/staff/recovery','/commerce/nests/config','/commerce/nests/availability','/commerce/nests/quote','/commerce/nests/bookings','/commerce/nests/cancel','/commerce/quote','/commerce/orders','/commerce/cancel','/central/commerce','/v1/payments','/v1/save/upi','/v1/save/bag','/v1/orders','/v1/save/checkout','/v1/staff/hub/advance']);
const living=await readFile(new URL('../bison/engine.mjs',import.meta.url),'utf8');
for(const match of living.matchAll(/route === "(\/bison[^\"]*)"/g))routes.add(match[1]);
async function denied(path,method,authorization){
 let bodyRead=false,writeHead=0,ended=0;
 const req=new Readable({read(){bodyRead=true;throw Error('body must not be read');}});
 req.url=path;req.method=method;req.headers={host:'localhost',...(authorization?{authorization:'Bearer '+authorization}:{})};
 const res={writeHead(status,headers){writeHead++;this.statusCode=status;assert.match(headers['cache-control'],/no-store/);},end(body){ended++;this.body=JSON.parse(body);}};
 const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('No remote or database request is permitted');};
 try{await handler(req,res);}finally{globalThis.fetch=originalFetch;}
 assert.equal(res.statusCode,410,path+' '+method);assert.equal(writeHead,1);assert.equal(ended,1);assert.equal(bodyRead,false);assert.ok(res.body.error);
}
for(const path of routes)test('P0 disables '+path+' before any write, signed in and out',async()=>{
 for(const alias of [path,'/api'+path,'/api?path='+encodeURIComponent(path.slice(1)),path+'/'])for(const method of ['POST','PUT','PATCH','DELETE'])for(const auth of [null,signed])await denied(alias,method,auth);
});
test('GET sync and signed inbound commerce cannot mutate either',async()=>{
 for(const path of ['/bison/data/sync','/living/data/sync','/central/commerce'])for(const auth of [null,signed])await denied('/api'+path,'GET',auth);
});
test('new write routes and ambiguous encoded paths fail closed',async()=>{
 for(const path of ['/future-write','/api/commerce%2Fstaff%2Fconfig','/api?path=%252Fcommerce%252Fstaff%252Fconfig'])await denied(path,'POST',signed);
});
test('existing member reads, session and personal-book transport remain available',()=>{
 for(const path of ['/commerce/catalogue','/commerce/nests','/commerce/earn','/commerce/orders'])assert.equal(p0Decision('GET',path),null);
 for(const path of ['/commerce/auth/login','/commerce/auth/passkey/options','/commerce/books/entries'])assert.equal(p0Decision('POST',path),null);
});

test('production middleware returns the same 410 before member or staff authentication',async()=>{
 const {default:middleware}=await import('../middleware.js');
 process.env.COMMERCE_STOREFRONT='1';
 for(const path of ['/api/commerce/staff/config','/api/commerce/orders','/api?path=central%2Fcommerce','/api/bison/data/sync']){
  for(const token of [null,signed]){
   const request=new Request('https://synthetic.example.invalid'+path,{method:path.includes('sync')?'GET':'POST',headers:token?{authorization:'Bearer '+token}:{}});
   const response=await middleware(request);assert.equal(response.status,410,path);assert.match(response.headers.get('cache-control'),/no-store/);
  }
 }
 delete process.env.COMMERCE_STOREFRONT;
});
