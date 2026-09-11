import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
// Isolated SQL and Central protocol fixtures, never inherited production data.
Object.assign(process.env,{DATABASE_URL:'postgres://login-test.invalid/test',NODE_ENV:'production',COMMERCE_ENABLED:'1',COMMERCE_MEMBER_AUTH:'passkey',DUMMY_DATA:'0',CENTRAL_ORIGIN:'https://central.invalid',CENTRAL_COMMERCE_KEY:'k'.repeat(32),STAFF_PASSWORD:'',STAFF_TOKEN_SECRET:'',STAFF_AUTH_REQUIRED:'1',NIA_RUNTIME_STATE_KEY:'login-fixture'});
process.env.COMMERCE_BOOKS_ENABLED='1';
for(const k of ['SHOWCASE_ENTRY','COMMERCE_PREVIEW','NIA_SHOWCASE'])delete process.env[k];
const store=await import('../runtime-store.mjs');
const {commerceHttp}=await import('./http.mjs');
const rows=new Map();
store.useSqlClientForTests(async(strings,...values)=>{
  const q=strings.join('$'),key=values[0];
  if(q.includes('CREATE TABLE'))return [];
  if(q.includes('SELECT version'))return rows.has(key)?[{version:rows.get(key).version}]:[];
  if(q.includes('INSERT INTO')){
    if(rows.has(key))return [];
    rows.set(key,{state_value:JSON.parse(values[1]),version:1});return [structuredClone(rows.get(key))];
  }
  if(q.includes('SELECT state_value'))return rows.has(key)?[structuredClone(rows.get(key))]:[];
  if(q.includes('UPDATE nia_runtime_state')){
    const row=rows.get(values[1]);if(!row||row.version!==Number(values[2]))return [];
    row.state_value=JSON.parse(values[0]);row.version++;return [{version:row.version}];
  }
  throw Error('unexpected_fixture_query');
});
async function request(path,body,{cookie='',origin='https://www.nia.test'}={}){
  const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
  Object.assign(req,{method:body===undefined?'GET':'POST',url:'/api/commerce'+path,headers:{host:'www.nia.test',origin,cookie},socket:{remoteAddress:'127.0.0.1'}});
  let result;const res={writeHead(status,headers){result={status,headers};},end(raw){result.body=JSON.parse(raw);}};
  await commerceHttp(req,res,path,async()=>null);return result;
}
test('public login bootstrap needs no store password, exposes no data and touches no store',async()=>{
  const r=await request('/catalogue');
  assert.equal(r.status,200);assert.equal(r.body.memberAuth,'passkey');assert.equal(r.body.account,null);
  assert.deepEqual(r.body.products,[]);assert.deepEqual(r.body.locations,[]);assert.equal(rows.size,0);
  assert.equal(r.headers['www-authenticate'],undefined);
});
test('protected routes reject anonymous and forged old cookies before store readiness',async()=>{
  for(const path of ['/orders','/books/plan','/nests/bookings','/membership','/partners','/earn']){
    assert.equal((await request(path,undefined,{cookie:'nia_commerce=forged-local'})).status,401,path);
  }
  assert.equal((await request('/auth/preview',{role:'member'})).status,404);
  assert.equal((await request('/auth/passkey/options',{mode:'authenticate'},{origin:'https://attacker.invalid'})).status,403);
});
test('passkey ceremony works independently of ordering and remains bound to secure cookies',async()=>{
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async(url,init)=>{
    const r=JSON.parse(init.body).request;calls.push(r);
    assert.equal(url,'https://central.invalid/api/service/member');
    if(r.kind==='passkey.options')return Response.json({challengeId:'C'.repeat(43),options:{challenge:'fixture'}});
    if(r.kind==='passkey.verify')return Response.json({token:'T'.repeat(43),account:{id:'fixture-member',name:'Fixture',role:'member',locationIds:[]}});
    if(r.kind==='passkey.session')return Response.json({account:{id:'fixture-member',authSubject:'fixture-subject',role:'member',locationIds:[]}});
    if(r.kind==='passkey.logout')return Response.json({ok:true});
    throw Error('unexpected_fixture_call');
  };
  try{
    const options=await request('/auth/passkey/options',{mode:'authenticate'});
    assert.equal(options.status,200);assert.match(options.headers['set-cookie'],/HttpOnly; Secure; SameSite=Strict; Max-Age=300/);
    const jar=options.headers['set-cookie'].split(';')[0];
    const verify=await request('/auth/passkey/verify',{response:{id:'fixture-credential'}},{cookie:jar});
    assert.equal(verify.status,200);assert.equal(verify.body.token,undefined);assert.ok(rows.size>0);
    const session=verify.headers['set-cookie'][0].split(';')[0];
    assert.equal((await request('/orders',undefined,{cookie:session})).status,503,'ordering still needs store configuration');
    assert.equal((await request('/auth/logout',{}, {cookie:session})).status,200);
    assert.equal(calls.at(-1).kind,'passkey.logout');
  }finally{globalThis.fetch=original;}
});
test('missing Central signing configuration fails closed',async()=>{
  const key=process.env.CENTRAL_COMMERCE_KEY;delete process.env.CENTRAL_COMMERCE_KEY;
  try{assert.equal((await request('/catalogue')).status,503);assert.equal((await request('/auth/passkey/options',{mode:'authenticate'})).status,503);}
  finally{process.env.CENTRAL_COMMERCE_KEY=key;}
});
