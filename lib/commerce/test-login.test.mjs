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

test('SMS identity is not used for the labelled TEST phone; real phones still hit the provider', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({url, body: init.body ? JSON.parse(init.body) : null});
    if (String(url).includes('/api/service/member')) {
      const kind = init.body ? JSON.parse(init.body).request?.kind : '';
      if (kind === 'member.lookupByPhone') return {status: 404, json: async () => ({error: 'member_not_registered'})};
      if (kind === 'identity.verify.request') return {status: 200, json: async () => ({challenge: 'provider-challenge'})};
      if (kind === 'identity.verify.confirm') return {status: 200, json: async () => ({token: 't', account: {id: 'member-subject-1', role:'member'}})};
    }
    if (String(url).includes('identity.invalid')) throw new Error('legacy_identity_url');
    throw new Error('unexpected_fetch_call');
  };
  try {
    const testReq = await request('/auth/request', {phone: '7000000001'});
    assert.equal(testReq.status, 200, testReq.body?.error);
    assert.equal(testReq.body.test, true);
    assert.equal(testReq.body.sms, false);
    assert.equal(testReq.body.next, 'verify_otp');
    assert.equal(typeof testReq.body.challenge, 'string');
    assert.equal(testReq.body.code, undefined);
    assert.equal(calls.some(entry => String(entry.url).includes('identity.invalid')), false);

    const realReq = await request('/auth/request', {phone: '9876543210'});
    assert.equal(realReq.status, 200);
    assert.equal(realReq.body.challenge, 'provider-challenge');
    assert.equal(realReq.body.test, undefined);
    assert.equal(calls.some(entry => entry.body?.request?.kind === 'identity.verify.request'), true);

    const bad = await request('/auth/verify', {phone: '7000000001', challenge: testReq.body.challenge, code: '000000'});
    assert.equal(bad.status, 401);
    assert.equal(bad.body.error, 'bad_otp');

    const code = testPhoneOtpCode(TEST_PHONE, testReq.body.challenge);
    const verified = await request('/auth/verify', {phone: '7000000001', challenge: testReq.body.challenge, code});
    assert.equal(verified.status, 200, verified.body?.error);
    assert.equal(verified.body.test, true);
    assert.equal(verified.body.next, 'set_password');
    const setup = verified.headers['set-cookie'].split(';')[0];
    assert.match(setup, new RegExp(`^${MEMBER_SETUP_COOKIE}=`));

    const password = testMemberPassword();
    const configured = await request('/auth/set-password', {phone: '7000000001', password, remember: true}, {cookie: setup});
    assert.equal(configured.status, 200, configured.body?.error);
    assert.equal(configured.body.account.id, TEST_PHONE_MEMBER.id);
    assert.equal(configured.body.account.test, true);
    assert.equal(configured.body.account.name, 'TEST member');
    assert.notEqual(configured.body.account.id, TEST_MEMBER.id);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GET /test/member-login runs the real phone OTP path with no SMS and can order', async () => {
  const done = await request('/test/member-login');
  assert.equal(done.status, 200, done.body?.error);
  assert.equal(done.body.test, true);
  assert.equal(done.body.sms, false);
  assert.equal(done.body.phone, TEST_PHONE);
  assert.equal(done.body.memberId, TEST_PHONE_MEMBER.id);
  assert.equal(done.body.account.test, true);
  assert.equal(done.body.catalogueReady, true);
  assert.equal(done.body.paymentsEnabled, false);
  assert.equal(done.body.storage, 'postgres');
  assert.deepEqual(done.body.via, [
    'POST /api/commerce/auth/request',
    'POST /api/commerce/auth/verify',
    'POST /api/commerce/auth/set-password'
  ]);
  assert.match(done.headers['set-cookie'], new RegExp(`^${MEMBER_COOKIE}=`));
  const cookie = done.headers['set-cookie'].split(';')[0];
  const cat = await request('/catalogue', undefined, {cookie});
  assert.equal(cat.body.account.id, TEST_PHONE_MEMBER.id);
  assert.equal(cat.body.account.test, true);
  assert.equal(cat.body.ready, true);
  const oil = cat.body.products.find(p => p.id === 'groundnut_oil');
  assert.equal(oil.pack, '1 L bottle');
  assert.equal(oil.test, true);
  const intent = {locationId:'S01', fulfillment:'pickup', lines:[{id:'groundnut_oil', qty:1}]};
  const quote = await request('/quote', intent, {cookie});
  assert.equal(quote.status, 200, quote.body?.error);
  const order = await request('/orders', {...intent, fingerprint: quote.body.fingerprint}, {cookie, headers:{'idempotency-key':'nia-test-phone-order-1'}});
  assert.ok([200, 201].includes(order.status), order.body?.error);
  assert.equal(order.body.memberId, TEST_PHONE_MEMBER.id);
  assert.equal(order.body.status, 'reserved');
  assert.equal(order.body.payStatus, 'unpaid');
  assert.equal(order.body.paid, 0);
});

test('GET /test/staff/login proves TEST desk password login without exposing a token', async () => {
  const proof = await request('/test/staff/login');
  assert.equal(proof.status, 200, proof.body?.error);
  assert.equal(proof.body.test, true);
  assert.equal(proof.body.via, 'POST /v1/staff/login');
  assert.equal(proof.body.staff.email, TEST_STAFF_EMAIL);
  assert.equal(proof.body.staff.test, true);
  assert.equal(proof.body.sessionIssued, true);
  assert.equal(proof.body.tokenExposed, false);
  assert.equal(proof.body.token, undefined);
  assert.equal(proof.body.staff.role, 'admin');
  assert.ok(proof.body.staff.desks.includes('studio'));
  assert.equal(proof.body.admin.email, 'admin@nia.one');
  assert.equal(proof.body.admin.seeded, true);
  assert.equal(proof.body.admin.sharedPasswordConfigured, true);
  assert.equal(proof.body.loginPath, '/v1/staff/login');
  assert.equal(proof.body.setPasswordPath, '/v1/staff/set-password');
  assert.equal(proof.body.desk.path, '/save-desk.html');
  assert.ok(proof.body.seeded.some(row => row.email === 'admin@nia.one'));
  assert.ok(proof.body.seeded.some(row => row.email === 'satish@nia.one'));
  assert.equal(namedStaff('admin@nia.one').email, 'admin@nia.one');
  assert.ok(testStaffPassword().length >= 10);
  assert.match(String(proof.headers?.['set-cookie'] || ''), /__Host-nia_staff_page=/);
  assert.equal(proof.body.token, undefined);
});

test('unsigned POST /orders and a real phone still require a real member', async () => {
  const blocked = await request('/orders', {locationId:'S01',fulfillment:'pickup',lines:[{id:'groundnut_oil',qty:1}]});
  assert.equal(blocked.status, 401);
  assert.equal(blocked.body.error, 'sign_in_required');
});
