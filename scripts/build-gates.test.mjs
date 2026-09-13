import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {translationKeys,checkLocales} from './locale-check.mjs';
import {measureRoute,ROUTE_BUDGET} from './bundle-budget.mjs';

test('locale extraction ignores comments and handles double quotes and escaped text',()=>{
 const keys=translationKeys('// t("not a key")\nconst a=t("Need help?"); const b=t(\'It\\\'s ready\');');
 assert.deepEqual([...keys.keys()],['Need help?',"It's ready"]);
});
test('a missing translation fails without accepting an English fallback',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'nia-locale-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 await mkdir(join(dir,'commerce-locales'));await writeFile(join(dir,'package.json'),'{"type":"module"}');
 await writeFile(join(dir,'commerce.js'),'t("Need help?")');
 for(const lang of ['hi','kn','mr','ta'])await writeFile(join(dir,'commerce-locales',lang+'.js'),lang==='ta'?'export default {};':'export default {"Need help?":"Translated"};');
 assert.deepEqual((await checkLocales(dir)).issues,[{lang:'ta',key:'Need help?'}]);
});
test('bundle follows shared and lazy imports once and detects an oversized route',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'nia-bundle-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 await writeFile(join(dir,'index.html'),'<script type="module" src="/entry.js"></script>');
 await writeFile(join(dir,'entry.js'),"import './shared.js';import('./lazy.js');");
 await writeFile(join(dir,'lazy.js'),"import './shared.js';");
 await writeFile(join(dir,'shared.js'),'export const text='+JSON.stringify(randomBytes(180000).toString('hex'))+';');
 const result=await measureRoute(dir,'index.html');assert.equal(result.scripts.length,3);assert.ok(result.bytes>ROUTE_BUDGET);assert.deepEqual(result.issues,[]);
});
test('unmeasured external scripts and missing imports cannot pass a bundle audit',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'nia-bundle-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 await writeFile(join(dir,'index.html'),'<script src="https://example.invalid/sdk.js"></script>');
 assert.match((await measureRoute(dir,'index.html')).issues.join(' '),/External script/);
 await writeFile(join(dir,'index.html'),'<script src="/missing.js"></script>');
 await assert.rejects(measureRoute(dir,'index.html'),/ENOENT/);
});

test('an operating read cannot save, seed, or retain in-memory mutations',async()=>{
 const {withP0Request}=await import('../lib/p0-request-context.mjs');
 const {createStateRunner}=await import('../lib/commerce/transaction.mjs');
 let state={stock:3},saves=0;
 const run=createStateRunner({durable:()=>true,load:async()=>({value:{stock:3},version:1,storage:'postgres'}),save:async()=>{saves++;return{ok:true,storage:'postgres'};},snapshot:()=>state,restore:value=>{state=structuredClone(value);}});
 const value=await withP0Request({method:'GET'},()=>run(true,()=>{state.stock=1;return{stock:state.stock};}));
 assert.equal(value.stock,1);assert.equal(saves,0);assert.deepEqual(state,{stock:3});
});

test('a read-only request issues only SELECT and explicitly refuses direct saves',async()=>{
 process.env.DATABASE_URL='postgres://example.invalid/niasave-synthetic';
 const store=await import('../lib/runtime-store.mjs?p0-read-proof');
 delete process.env.DATABASE_URL;
 const {withP0Request}=await import('../lib/p0-request-context.mjs');
 const queries=[];
 store.useSqlClientForTests(async parts=>{queries.push(parts.join('?'));return[{state_value:{stock:3},version:2}];});
 await withP0Request({method:'GET'},async()=>{
  assert.equal((await store.loadRuntimeState('synthetic',{})).version,2);
  assert.deepEqual(await store.saveRuntimeState('synthetic',{},2),{ok:false,storage:'postgres',error:'read_only_request'});
  await store.storageStatus('synthetic');
 });
 assert.equal(queries.length,2);for(const query of queries)assert.match(query.trim(),/^SELECT\b/);
});
