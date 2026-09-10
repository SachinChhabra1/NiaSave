import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';

// Only an injected SQL client is used. Never inherit a live connection.
process.env.DATABASE_URL = 'postgres://safe-errors-test.invalid/test';
delete process.env.POSTGRES_URL;
process.env.STAFF_TOKEN_SECRET = randomBytes(32).toString('base64url');
const store = await import('./runtime-store.mjs');
const {default: handler} = await import('../api/server.mjs');
const sensitive = 'private-test-password postgres://user:secret@private.invalid/db member@example.invalid';

test('database failures retain event labels without leaking exception or state-key details', async t => {
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  store.useSqlClientForTests(async () => { throw new Error(sensitive); });
  const results = [
    await store.loadRuntimeState(sensitive, {}),
    await store.saveRuntimeState(sensitive, {}, 1),
    await store.storageStatus(sensitive),
    await store.deleteRuntimeState(sensitive),
  ];
  assert.deepEqual(logs, [
    ['runtime_store_load_failed'], ['runtime_store_save_failed'],
    ['runtime_store_status_failed'], ['runtime_store_delete_failed'],
  ]);
  assert.deepEqual(results[1], {ok:false, storage:'postgres', error:'runtime_store_save_failed'});
  assert.deepEqual(results[3], {ok:false, storage:'postgres', error:'runtime_store_delete_failed'});
  assert.equal(results[2].connected, false);
  assert.ok(!JSON.stringify({logs, results}).includes(sensitive));
});

test('request failures return stable errors without logging raw exceptions, paths or stack traces', async t => {
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  store.useSqlClientForTests(async () => { throw new Error(sensitive); });
  for (const thrown of [new Error(sensitive), new Error('private_alphanumeric_exception'), null]) {
    const req = {method:'POST', url:'/v1/staff/login?private=' + encodeURIComponent(sensitive), headers:{}, on() { throw thrown; }};
    const res = {writeHead(status) { this.statusCode = status; }, end(body) { this.body = JSON.parse(body); }};
    await handler(req, res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, {error:'server_error'});
  }
  assert.deepEqual(logs, Array.from({length: 3}, () => [['runtime_store_load_failed'], ['server_error']]).flat());
});
