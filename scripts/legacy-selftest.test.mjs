import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('the complete original Rabbit selftest still passes',()=>{
 const result=spawnSync(process.execPath,['rabbit/selftest.mjs'],{cwd:new URL('../',import.meta.url),encoding:'utf8',timeout:60000});
 assert.equal(result.status,0,result.stderr||result.stdout);
});
