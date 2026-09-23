import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomBytes} from 'node:crypto';

const fixturePassword = 'test-member-password';
const fixtureSecret = randomBytes(32).toString('hex');
const staffSecret = randomBytes(32).toString('base64url');
const staffPassword = 'staff-password-fixture';
Object.assign(process.env, {
  DATABASE_URL: 'postgres://test-login-prove.invalid/test',
  NODE_ENV: 'production',
  COMMERCE_ENABLED: '1',
  COMMERCE_MEMBER_AUTH: 'password',
  DUMMY_DATA: '0',
  MEMBER_PASSWORD: fixturePassword,
  SESSION_SECRET: fixtureSecret,
  CENTRAL_ORIGIN: 'https://central.invalid',
  CENTRAL_COMMERCE_KEY: 'k'.repeat(32),
  COMMERCE_IDENTITY_URL: 'https://identity.invalid',
  COMMERCE_IDENTITY_KEY: 'identity-test-key',
  STAFF_PASSWORD: staffPassword,
  STAFF_TOKEN_SECRET: staffSecret,
  STAFF_AUTH_REQUIRED: '1',
  NIA_RUNTIME_STATE_KEY: 'test-login-prove'
});
for (const key of ['SHOWCASE_ENTRY', 'COMMERCE_PREVIEW', 'NIA_SHOWCASE', 'VERCEL', 'VERCEL_ENV']) delete process.env[key];

const store = await import('../runtime-store.mjs');
const rows = new Map();
store.useSqlClientForTests(async (strings, ...values) => {
  const q = strings.join('$'), key = values[0];
  if (q.includes('CREATE TABLE')) return [];
  if (q.includes('SELECT version')) return rows.has(key) ? [{version: rows.get(key).version}] : [];
  if (q.includes('INSERT INTO')) {
    if (rows.has(key)) return [];
    rows.set(key, {state_value: JSON.parse(values[1]), version: 1});
    return [structuredClone(rows.get(key))];
  }
  if (q.includes('SELECT state_value')) return rows.has(key) ? [structuredClone(rows.get(key))] : [];
  if (q.includes('UPDATE nia_runtime_state')) {
    const row = rows.get(values[1]);
    if (!row || row.version !== Number(values[2])) return [];
    row.state_value = JSON.parse(values[0]);
    row.version++;
    return [{version: row.version}];
  }
  throw Error('unexpected_fixture_query');
});

const {commerceHttp} = await import('./http.mjs');
const {MEMBER_COOKIE, MEMBER_SETUP_COOKIE} = await import('./member-password.mjs');
const {
  TEST_PHONE,
  TEST_PHONE_MEMBER,
  testPhoneOtpCode,
  testMemberPassword
} = await import('./test-login.mjs');
const {TEST_STAFF_EMAIL, testStaffPassword, namedStaff} = await import('../staff-auth.mjs');
const {TEST_MEMBER} = await import('./test-member.mjs');

async function request(path, body, {cookie='', origin='https://www.nia.test', headers={}, method, staff=null} = {}) {
  const verb = method || (body === undefined ? 'GET' : 'POST');
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  Object.assign(req, {
    method: verb,
    url: '/api/commerce' + path,
    headers: {host:'www.nia.test', origin, cookie, ...headers},
    socket: {remoteAddress:'127.0.0.1'}
  });
  let result;
  const res = {
    writeHead(status, headers) { result = {status, headers}; },
    end(raw) { result.body = JSON.parse(raw); }
  };
  await commerceHttp(req, res, path.split('?')[0], async () => staff);
  return result;
}

test("M0 closes credential-free TEST login and proof endpoints",async()=>{const {handler}=await import('../../api/server.mjs');const {Readable}=await import('node:stream');for(const path of ['/api/commerce/test/session','/api/commerce/test/place-one','/api/commerce/test/member-login','/api/commerce/test/staff/login']){const req=Readable.from([]);Object.assign(req,{url:path,method:'GET',headers:{}});let status,body;await handler(req,{writeHead(s){status=s;},end(s){body=JSON.parse(s);}});assert.equal(status,503);assert.equal(body.error,'pilot_commitments_paused');}});
