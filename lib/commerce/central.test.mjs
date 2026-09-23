import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { centralSignature,verifyCentralEnvelope } from './central-auth.mjs';
process.env.COMMERCE_PREVIEW='1';process.env.DATABASE_URL='';process.env.NODE_ENV='test';delete process.env.VERCEL;
process.env.CENTRAL_COMMERCE_KEY=randomBytes(32).toString('hex');
const {handler}=await import('../../api/server.mjs');
const {seedFrozenPreview:resetDummy}=await import('./test-frozen-book.mjs');
const admin={id:'central-admin',role:'admin'},operator={id:'central-operator',role:'operator'};
async function http(path,body,headers={}) {
  const raw=body===undefined?'':typeof body==='string'?body:JSON.stringify(body);
  const req=Readable.from(raw?[Buffer.from(raw)]:[]);Object.assign(req,{url:path,method:body===undefined?'GET':'POST',headers:{host:'localhost:8787',origin:'http://localhost:8787','content-type':'application/json',...headers},socket:{remoteAddress:'127.0.0.1'}});
  let status,head,payload;await handler(req,{writeHead(s,h){status=s;head=h;},end(v){payload=JSON.parse(v);}});return {status,head,body:payload};
}
async function central(line,action='snapshot',body={},actor=admin,extra={}) {
  const raw=JSON.stringify({line,action,body,actor,at:Date.now(),nonce:randomUUID(),...extra});
  return http('/api/central/commerce',raw,{'x-central-signature':centralSignature(raw,process.env.CENTRAL_COMMERCE_KEY)});
}
async function login(){const r=await http('/api/commerce/auth/preview',{role:'member'});return {cookie:r.head['set-cookie'].split(';')[0]};}
function fresh(){const s=resetDummy();s.orders=[];s.reservations=[];s.payments=[];s.settlements=[];return s;}
function confirmPreviewPacks(s){if(!s?.commerce?.config?.products)return;s.commerce.config.products=s.commerce.config.products.map(p=>({...p,pack:p.id==='groundnut_oil'?'1 L bottle':(p.pack==='Pack size to be confirmed'?'100 g bar':p.pack)}));}
const offer=()=>({source:{id:'CENTRAL-DEMAND-1',company:'Preview employer',city:'Preview city',demand:10,preview:true,pulledAt:new Date().toISOString()},title:'Preview picker',payMin:14000,payMax:16000,payPeriod:'month',shift:'8 hours, daytime',requirements:'Role assessment',terms:'Example employer terms. Not a real job.',closesAt:new Date(Date.now()+86400000).toISOString(),confirmed:true});
test('Central signature binds actor/body, rejects missing keys, tampering, old requests and replay',async()=>{
  fresh();assert.equal((await http('/api/central/commerce',{})).status,401);
  const envelope={actor:admin,line:'save',action:'snapshot',at:Date.now(),nonce:randomUUID()};const raw=JSON.stringify(envelope),sig=centralSignature(raw,process.env.CENTRAL_COMMERCE_KEY);
  assert.throws(()=>verifyCentralEnvelope(raw,sig,'',Date.now()),/not_configured/);
  assert.throws(()=>verifyCentralEnvelope(raw.replace('central-admin','other-admin'),sig,process.env.CENTRAL_COMMERCE_KEY,Date.now()),/auth_required/);
  assert.throws(()=>verifyCentralEnvelope(raw,sig,process.env.CENTRAL_COMMERCE_KEY,Date.now()+120000),/expired/);
  assert.equal((await http('/api/central/commerce',raw,{'x-central-signature':sig})).status,200);
  assert.equal((await http('/api/central/commerce',raw,{'x-central-signature':sig})).status,409);
});
test("M0 refuses every signed operational action across all four pillars",async()=>{fresh();for(const line of ['save','live','earn','send'])for(const action of ['configure','action','publish','demo','books-demo']){const r=await central(line,action);assert.equal(r.status,503);assert.equal(r.body.error,'pilot_commitments_paused');}});








test('Command Center reads aggregate unit metrics through signed access without exposing records',async()=>{
  fresh();
  const reader={id:'central-reader',role:'reader'};
  const sikh=await central('save','unit-overview',{unit:'sikh'},reader);
  assert.equal(sikh.status,200);assert.equal(sikh.body.product,'polo');
  assert.deepEqual(Object.keys(sikh.body).sort(),['kpis','product','storage']);
  const jat=await central('save','unit-overview',{unit:'jat'},reader);
  assert.equal(jat.status,200);assert.equal(jat.body.product,'bison');
  assert.deepEqual(Object.keys(jat.body).sort(),['asOf','kpis','product','storage']);
  const dogra=await central('save','unit-overview',{unit:'dogra'},reader);
  assert.equal(dogra.status,200);assert.equal(dogra.body.product,'dogra');
  assert.deepEqual(Object.keys(dogra.body).sort(),['product','state','storage','summary']);
  assert.deepEqual(Object.keys(dogra.body.state),['updatedAt']);
  assert.equal((await central('save','unit-overview',{unit:'unknown'},reader)).status,400);
  assert.equal((await central('live','unit-overview',{unit:'jat'},reader)).status,400);
  assert.equal((await http('/api/central/commerce',{line:'save',action:'unit-overview',body:{unit:'jat'},actor:reader})).status,401);
});
