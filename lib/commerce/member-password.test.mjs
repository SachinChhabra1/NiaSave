import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomBytes} from 'node:crypto';

const fixturePassword = 'test-member-password';
const fixtureSecret = randomBytes(32).toString('hex');
Object.assign(process.env, {
  DATABASE_URL: 'postgres://member-password-test.invalid/test',
  NODE_ENV: 'production',
  COMMERCE_ENABLED: '1',
  COMMERCE_MEMBER_AUTH: 'passkey',
  DUMMY_DATA: '0',
  MEMBER_PASSWORD: fixturePassword,
  SESSION_SECRET: fixtureSecret,
  CENTRAL_ORIGIN: 'https://central.invalid',
  CENTRAL_COMMERCE_KEY: 'k'.repeat(32),
  STAFF_PASSWORD: '',
  STAFF_TOKEN_SECRET: '',
  STAFF_AUTH_REQUIRED: '1',
  NIA_RUNTIME_STATE_KEY: 'member-password-fixture'
});
for (const key of ['SHOWCASE_ENTRY', 'COMMERCE_PREVIEW', 'NIA_SHOWCASE']) delete process.env[key];

const {
  passwordMatches,
  issueMemberSession,
  verifyMemberSession,
  memberSessionCookie,
  MEMBER_COOKIE,
  MEMBER_SESSION_TTL_SECONDS,
  MEMBER_ACCOUNT,
  resetMemberLoginAttempts
} = await import('./member-password.mjs');
const store = await import('../runtime-store.mjs');
const {commerceHttp} = await import('./http.mjs');

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

async function request(path, body, {cookie = '', origin = 'https://www.nia.test'} = {}) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  Object.assign(req, {
    method: body === undefined ? 'GET' : 'POST',
    url: '/api/commerce' + path,
    headers: {host: 'www.nia.test', origin, cookie},
    socket: {remoteAddress: '127.0.0.1'}
  });
  let result;
  const res = {
    writeHead(status, headers) { result = {status, headers}; },
    end(raw) { result.body = JSON.parse(raw); }
  };
  await commerceHttp(req, res, path, async () => null);
  return result;
}

test('wrong password is rejected; correct password sets a signed stay-signed-in cookie; cookie authenticates the next request', async () => {
  resetMemberLoginAttempts();
  const anonymous = await request('/catalogue');
  assert.equal(anonymous.status, 200);
  assert.equal(anonymous.body.memberAuth, 'password');
  assert.equal(anonymous.body.account, null);
  assert.equal((await request('/orders')).status, 401);

  const wrong = await request('/auth/login', {password: 'not-the-member-password'});
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.error, 'invalid_password');
  assert.equal(wrong.headers['set-cookie'], undefined);
  assert.equal((await request('/orders')).status, 401);

  const ok = await request('/auth/login', {password: fixturePassword});
  assert.equal(ok.status, 200);
  assert.equal(ok.body.account.id, MEMBER_ACCOUNT.id);
  assert.equal(ok.body.account.role, 'member');
  const cookie = ok.headers['set-cookie'];
  assert.match(cookie, new RegExp(`^${MEMBER_COOKIE}=[^;]+`));
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict; Max-Age=2592000$/);
  assert.match(cookie, /Path=\/api\/commerce/);
  assert.doesNotMatch(cookie, /test-member-password|MEMBER_PASSWORD/);
  assert.doesNotMatch(JSON.stringify(ok.body), /test-member-password|SESSION_SECRET/);

  const session = cookie.split(';')[0];
  const catalogue = await request('/catalogue', undefined, {cookie: session});
  assert.equal(catalogue.status, 200);
  assert.equal(catalogue.body.memberAuth, 'password');
  assert.equal(catalogue.body.account.id, MEMBER_ACCOUNT.id);
  assert.notEqual((await request('/orders', undefined, {cookie: session})).status, 401);

  const forged = await request('/catalogue', undefined, {cookie: `${MEMBER_COOKIE}=forged-session`});
  assert.equal(forged.status, 200);
  assert.equal(forged.body.account, null);
  assert.equal((await request('/orders', undefined, {cookie: `${MEMBER_COOKIE}=forged-session`})).status, 401);
});

test('password compare is timing-safe HMAC and sessions expire without storing the password', () => {
  assert.equal(passwordMatches(fixturePassword), true);
  assert.equal(passwordMatches('not-the-member-password'), false);
  assert.equal(passwordMatches(''), false);
  assert.equal(passwordMatches(undefined), false);
  const now = Date.parse('2026-09-12T07:00:00Z');
  const token = issueMemberSession(now);
  assert.equal(verifyMemberSession(token, now).id, MEMBER_ACCOUNT.id);
  assert.equal(verifyMemberSession(token, now + MEMBER_SESSION_TTL_SECONDS * 1000 + 1), null);
  assert.equal(verifyMemberSession('tampered.' + token.split('.')[1], now), null);
  assert.doesNotMatch(token, /test-member-password/);
  assert.match(memberSessionCookie(''), /Max-Age=0$/);
});
