import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';

process.env.DATABASE_URL = 'postgres://staff-password-test.invalid/test';
delete process.env.POSTGRES_URL;
process.env.STAFF_TOKEN_SECRET = randomBytes(32).toString('base64url');
process.env.STAFF_PASSWORD = 'shared-staff-password';
process.env.JAT_STAFF_PASSWORD = 'jat-staff-password';
const store = await import('./runtime-store.mjs');
const auth = await import('./staff-auth.mjs');

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

test('named desk staff can replace the shared password; TEST desk uses its own derived password', async () => {
  const db = sqlFixture(); store.useSqlClientForTests(db.sql);
  const admin = await auth.loginStaffWithPassword('admin@nia.one', process.env.STAFF_PASSWORD);
  assert.equal(admin.ok, true);
  assert.equal(admin.staff.email, 'admin@nia.one');
  assert.equal(admin.via, 'shared');

  const saved = await auth.saveStaffPassword(admin.staff.id, admin.staff.email, 'personal-admin-password');
  assert.equal(saved.ok, true);
  assert.equal((await auth.loginStaffWithPassword('admin@nia.one', process.env.STAFF_PASSWORD)).ok, false);
  const personal = await auth.loginStaffWithPassword('admin@nia.one', 'personal-admin-password');
  assert.equal(personal.ok, true);
  assert.equal(personal.via, 'personal');

  const testLogin = await auth.loginStaffWithPassword(auth.TEST_STAFF_EMAIL, auth.testStaffPassword());
  assert.equal(testLogin.ok, true);
  assert.equal(testLogin.staff.test, true);
  assert.equal(testLogin.via, 'test');
  assert.equal((await auth.loginStaffWithPassword(auth.TEST_STAFF_EMAIL, process.env.STAFF_PASSWORD)).ok, false);

  const emails = auth.seededStaffPublic().map(row => row.email);
  assert.deepEqual(emails, [
    'ajay.mahawar@nia.one',
    'admin@nia.one',
    'satish@nia.one',
    'ramesh@nia.one',
    'kavita@nia.one',
    'pilot@nia.one',
    'test.desk@nia.one'
  ]);
});
