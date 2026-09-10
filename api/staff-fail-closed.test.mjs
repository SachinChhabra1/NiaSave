import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';

// Each case boots a fresh API process with no database credentials. No live
// endpoint or production book is used by these configuration regression tests.
function check(extra, expectedLoginStatus) {
  const source = `
    import assert from 'node:assert/strict';
    import http from 'node:http';
    const {default:handler,verifyStaffToken}=await import('./api/server.mjs');
    const server=http.createServer(handler);
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const base='http://127.0.0.1:'+server.address().port;
    try {
      for (const path of ['/api/bison/tower','/api/tower','/api/orders','/api/dogra/state','/v1/staff/me','/api?path=tower']) {
        const response=await fetch(base+path);
        assert.equal(response.status,401,path);
        assert.match(response.headers.get('cache-control'),/no-store/);
        assert.deepEqual(await response.json(),{error:'staff_required'});
      }
      const login=await fetch(base+'/v1/staff/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@nia.one',password:'not-a-credential'})});
      assert.equal(login.status,${expectedLoginStatus});
      assert.equal(verifyStaffToken('invalid.signature'),null);
      const cronPath=base+'/api/bison/data/sync';
      assert.equal((await fetch(cronPath)).status,401);
      assert.equal((await fetch(cronPath,{headers:{authorization:'Bearer deliberately-invalid'}})).status,401);
      if(process.env.CRON_SECRET) {
        const allowed=await fetch(cronPath,{headers:{authorization:'Bearer '+process.env.CRON_SECRET}});
        // No source/database exists in this process. Reaching this source
        // precondition proves the scheduler cleared only its intended gate.
        assert.equal(allowed.status,400);
        assert.deepEqual(await allowed.json(),{error:'google_sheet_missing',status:400});
        assert.equal((await fetch(base+'/api/bison/tower',{headers:{authorization:'Bearer '+process.env.CRON_SECRET}})).status,401);
      }
    } finally { await new Promise(r=>server.close(r)); }
  `;
  const result=spawnSync(process.execPath,['--input-type=module','-e',source],{
    cwd:new URL('../',import.meta.url),encoding:'utf8',timeout:15000,
    env:{PATH:process.env.PATH,DEMO:'1',DUMMY_DATA:'1',...extra}
  });
  assert.equal(result.status,0,result.stderr || 'isolated API check failed');
}

test('missing staff configuration denies every staff API and cannot issue a session',()=>check({},503));
test('hosted preview cannot bypass staff auth through the demo GET shortcut',()=>check({VERCEL_ENV:'preview',STAFF_AUTH_REQUIRED:'0',STAFF_TOKEN_SECRET:randomBytes(32).toString('base64url')},401));
test('production ignores a stale opt-out even if dummy mode was accidentally left on',()=>check({VERCEL_ENV:'production',STAFF_AUTH_REQUIRED:'0',STAFF_TOKEN_SECRET:randomBytes(32).toString('base64url')},401));
test('real-data runtime never permits the local opt-out',()=>check({DEMO:'0',DUMMY_DATA:'0',STAFF_AUTH_REQUIRED:'0',STAFF_TOKEN_SECRET:randomBytes(32).toString('base64url')},401));
test('scheduler secret grants only the exact Living sync GET, never other desk APIs',()=>check({DEMO:'0',DUMMY_DATA:'0',VERCEL_ENV:'production',STAFF_TOKEN_SECRET:randomBytes(32).toString('base64url'),CRON_SECRET:randomBytes(32).toString('base64url')},401));
