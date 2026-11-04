import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
test('separate showcase assembler scopes framing and demo assets; default Basic challenge unchanged',async()=>{
 const root=await mkdtemp(join(tmpdir(),'niasave-investor-package-'));
 const saved={...process.env};
 try{
  const standard=join(root,'standard'),demo=join(root,'demo');
  const env={...process.env,NIA_SHOWCASE:'1',NIASAVE_INVESTOR_DEMO:''};
  execFileSync(process.execPath,['scripts/build-showcase.mjs',standard],{env,stdio:'pipe'});
  const original=await readFile(join(standard,'public/index.html'),'utf8');assert.ok(!original.includes('/demo.js'));
  await assert.rejects(access(join(standard,'public/ops.html')));
  const {default:middleware}=await import(pathToFileURL(join(standard,'middleware.js')));
  Object.assign(process.env,{NIA_SHOWCASE:'1',NIASAVE_INVESTOR_DEMO:'',SHOWCASE_PASSWORD:'fictional-test-password-more-than-24',VERCEL_ENV:'preview'});
  const r=middleware(new Request('https://showcase.test/'));
  assert.equal(r.status,401);
  assert.deepEqual(Object.fromEntries(r.headers),{'cache-control':'no-store','content-type':'text/plain;charset=UTF-8','www-authenticate':'Basic realm="NiaSave showcase", charset="UTF-8"','x-robots-tag':'noindex, nofollow, noarchive'});
  assert.equal(r.headers.get('set-cookie'),null);
  const authorization='Basic '+Buffer.from('showcase:'+process.env.SHOWCASE_PASSWORD).toString('base64');
  assert.equal(middleware(new Request('https://showcase.test/',{headers:{authorization}})),undefined);
  execFileSync(process.execPath,['scripts/build-showcase.mjs',demo],{env:{...env,NIASAVE_INVESTOR_DEMO:'1'},stdio:'pipe'});
  const config=JSON.parse(await readFile(join(demo,'vercel.json'),'utf8'));
  const headers=config.headers.flatMap(h=>h.headers);
  assert.ok(!headers.some(h=>h.key.toLowerCase()==='x-frame-options'));
  assert.ok(headers.some(h=>h.value.includes("frame-ancestors 'self' https://www.nia.one https://nia.one https://*.vercel.app")));
  assert.match(await readFile(join(demo,'public/ops.html'),'utf8'),/demo.js/);
  const {default:demoMiddleware}=await import(pathToFileURL(join(demo,'middleware.js')));
  Object.assign(process.env,{NIASAVE_INVESTOR_DEMO:'1',SHOWCASE_INSTANCE:'showcase-package-test',SHOWCASE_DATABASE_URL:'postgresql://test.invalid/demo',SHOWCASE_CENTRAL_KEY:'fictional-central-key-more-than-32-chars'});
  const allowed=demoMiddleware(new Request('https://showcase.test/'));
  assert.equal(allowed.headers.get('x-middleware-next'),'1');assert.equal(allowed.headers.get('x-frame-options'),null);
  delete process.env.SHOWCASE_DATABASE_URL;
  assert.equal(demoMiddleware(new Request('https://showcase.test/')).status,503);
 }finally{process.env=saved;await rm(root,{recursive:true,force:true});}
});
