import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {enableShowcaseEntry} from './showcase-mode.mjs';
// All connections are intercepted; these are nonresolving synthetic test values.
Object.assign(process.env,{NIA_SHOWCASE:'1',NIASAVE_INVESTOR_DEMO:'1',SHOWCASE_INSTANCE:'showcase-investor-unit-test',SHOWCASE_DATABASE_URL:'postgresql://test.invalid/fictional',DATABASE_URL:'postgresql://must-not-use.invalid/production',SHOWCASE_PASSWORD:'fictional-test-only-password-32chars',SHOWCASE_CENTRAL_KEY:'fictional-test-only-central-key-32chars',VERCEL_ENV:'preview'});
enableShowcaseEntry();
const store=await import('../runtime-store.mjs');
const {withInvestorState}=await import('../../showcase/investor-store.mjs');
const {seedInvestorDemo}=await import('../../showcase/investor-fixtures.mjs');
let row,fail=false,conflict=false;
const keys=[];
store.useSqlClientForTests(async(strings,...values)=>{
 const sql=strings.join('?');
 if(sql.includes('CREATE TABLE'))return [];
 if(sql.includes('INSERT INTO')){keys.push(values[0]);row||={state_value:JSON.parse(values[1]),version:1};return [structuredClone(row)];}
 if(sql.includes('SELECT')){keys.push(values[0]);return row?[structuredClone(row)]:[];}
 if(sql.includes('UPDATE')){
  keys.push(values[1]);
  if(fail)throw Error('synthetic outage');
  if(conflict){conflict=false;row.version++;return [];}
  if(row.version!==values[2])return [];
  row={state_value:JSON.parse(values[0]),version:row.version+1};return [{version:row.version}];
 }
 throw Error('unexpected SQL');
});
test('demo state uses only an instance-prefixed separate book; retries CAS and fails closed',async()=>{
 const seed=()=>withInvestorState(s=>{seedInvestorDemo(s);return {status:200,body:{ok:true}};});
 assert.equal((await seed()).status,200);
 assert.equal(row.state_value.commerce.config.products.length,20);
 conflict=true;
 const change=()=>withInvestorState(s=>{s.counter=(s.counter||0)+1;return {status:200,body:{counter:s.counter}};});
 assert.equal((await change()).body.counter,1);assert.equal(row.state_value.counter,1);
 fail=true;
 assert.equal((await change()).status,503);assert.equal(row.state_value.counter,1);
 fail=false;
 assert.equal((await change()).body.counter,2);
 assert.ok(keys.length>3);assert.ok(keys.every(k=>k==='showcase-investor-unit-test:investor-demo-v1'));
});

test('a legacy runtime imported before the showcase entry cannot supply its database',()=>{
 const code=`
  import assert from 'node:assert/strict';
  process.env.DATABASE_URL='postgresql://must-not-touch.invalid/production';
  const store=await import('./lib/runtime-store.mjs');
  let touched=false;store.useSqlClientForTests(()=>{touched=true;throw Error('must not run');});
  const mode=await import('./lib/commerce/showcase-mode.mjs');mode.enableShowcaseEntry();
  const {withInvestorState}=await import('./showcase/investor-store.mjs');
  const result=await withInvestorState(()=>{throw Error('must not run');});
  assert.equal(result.status,503);assert.equal(touched,false);
 `;
 execFileSync(process.execPath,['--input-type=module','-e',code],{stdio:'pipe'});
});
