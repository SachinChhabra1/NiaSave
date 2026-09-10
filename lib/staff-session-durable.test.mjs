import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';

// SQL protocol fixture only. Never connect to an inherited production database.
process.env.DATABASE_URL = 'postgres://staff-session-test.invalid/test';
delete process.env.POSTGRES_URL;
delete process.env.SHOWCASE_ENTRY;
process.env.STAFF_TOKEN_SECRET = randomBytes(32).toString('base64url');
const store = await import('./runtime-store.mjs');
const auth = await import('./staff-auth.mjs');
const {staffPageAccess} = await import('./staff-pages.mjs');
const {createStaffLoginLimiter} = await import('./staff-login-limit.mjs');

function sqlFixture() {
  const rows = new Map();
  const sql = async (strings, ...values) => {
    const query = strings.join('$');
    const key = values[0];
    if (/CREATE TABLE/.test(query)) return [];
    if (/SELECT version/.test(query)) return rows.has(key) ? [{version: rows.get(key).version}] : [];
    if (/INSERT INTO/.test(query)) {
      if (rows.has(key)) return [];
      rows.set(key, {state_value: JSON.parse(values[1]), version: 1});
      return [structuredClone(rows.get(key))];
    }
    if (/SELECT state_value/.test(query)) return rows.has(key) ? [structuredClone(rows.get(key))] : [];
    if (/UPDATE nia_runtime_state/.test(query)) {
      const row = rows.get(values[1]);
      if (!row || row.version !== Number(values[2])) return [];
      row.state_value = JSON.parse(values[0]); row.version++;
      return [{version: row.version}];
    }
    throw new Error('unexpected_sql');
  };
  return {sql, rows};
}

test('session survives cache reset, observes external revocation, and denies page replay', async () => {
  const db = sqlFixture(); store.useSqlClientForTests(db.sql);
  const token = auth.issueStaffToken(auth.namedStaff('ajay.mahawar@nia.one'));
  assert.equal((await auth.registerStaffSession(token)).ok, true);
  store.resetRuntimeCache();
  assert.equal((await auth.verifyActiveStaffToken(token)).id, 'stf-ajay-mahawar');
  const request = new Request('https://niasave.invalid/bison-data.html', {headers: {cookie: `${auth.STAFF_PAGE_COOKIE}=${token}`}});
  assert.equal(await staffPageAccess(request), undefined);
  // A different instance commits revocation while this one holds a cached value.
  const row = db.rows.get('staff-auth-sessions-v1');
  row.state_value = {tokens: {}}; row.version++;
  assert.equal(await auth.verifyActiveStaffToken(token), null);
  assert.equal((await staffPageAccess(request)).status, 401);
  assert.equal((await auth.registerStaffSession(token)).ok, true);
  assert.equal((await auth.revokeStaffSession(token)).ok, true);
  store.resetRuntimeCache();
  assert.equal(await auth.verifyActiveStaffToken(token), null);
});

test('limiter uses the real runtime-store SQL adapter across cache resets', async () => {
  const db = sqlFixture(); store.useSqlClientForTests(db.sql);
  const options = {maxPerIdentity: 2};
  assert.equal((await createStaffLoginLimiter(options)('ip-a', 'test@example.invalid')).allowed, true);
  store.resetRuntimeCache();
  assert.equal((await createStaffLoginLimiter(options)('ip-b', 'test@example.invalid')).allowed, true);
  store.resetRuntimeCache();
  assert.equal((await createStaffLoginLimiter(options)('ip-c', 'test@example.invalid')).allowed, false);
  assert.doesNotMatch(JSON.stringify([...db.rows.values()]), /test@example|ip-a|ip-b/);
});
