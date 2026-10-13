delete process.env.DATABASE_URL;
import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomBytes} from 'node:crypto';

Object.assign(process.env, {
  NODE_ENV: 'production',
  COMMERCE_ENABLED: '1',
  COMMERCE_MEMBER_AUTH: 'password',
  DUMMY_DATA: '0',
  MEMBER_PASSWORD: 'fixture-shared-password',
  SESSION_SECRET: randomBytes(32).toString('hex'),
  CENTRAL_ORIGIN: 'https://central.invalid',
  CENTRAL_COMMERCE_KEY: 'k'.repeat(32),
  STAFF_PASSWORD: '',
  STAFF_TOKEN_SECRET: '',
  STAFF_AUTH_REQUIRED: '1',
  COMMERCE_REQUIRE_CENTRAL_MEMBER: 'true',
  NIA_RUNTIME_STATE_KEY: 'member-auth-cold-start-fixture'
});
for (const key of ['SHOWCASE_ENTRY', 'COMMERCE_PREVIEW', 'NIA_SHOWCASE', 'VERCEL', 'VERCEL_ENV']) delete process.env[key];

const store = await import('../runtime-store.mjs');
const {commerceHttp} = await import('./http.mjs');
const auth = await import('./member-password.mjs');
const {TEST_PHONE, testPhoneOtpCode} = await import('./test-login.mjs');

let centralCalls = 0;
globalThis.fetch = async () => {
  centralCalls += 1;
  throw new Error('central_should_not_be_called');
};

async function request(path, body, cookie = '') {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  Object.assign(req, {
    method: body === undefined ? 'GET' : 'POST',
    url: '/api/commerce' + path,
    headers: {host: 'www.nia.test', origin: 'https://www.nia.test', cookie},
    socket: {remoteAddress: '127.0.0.1'}
  });
  let result;
  await commerceHttp(req, {
    writeHead(status, headers) { result = {status, headers}; },
    end(raw) { result.body = JSON.parse(raw); }
  }, path, async () => null);
  return result;
}

test('C1 cold start fails real-member auth before Central while preserving guest, logout, and TEST lanes', async () => {
  assert.equal(store.hasDurableStore(), false);
  for (const path of ['/auth/request', '/auth/password/request']) {
    const result = await request(path, {phone: '9876543210'});
    assert.equal(result.status, 503, path);
    assert.equal(result.body.error, 'save_storage_unavailable', path);
  }
  for (const path of ['/auth/verify', '/auth/password/verify']) {
    const result = await request(path, {phone: '9876543210', challenge: '123456', code: '123456'});
    assert.equal(result.status, 503, path);
    assert.equal(result.body.error, 'save_storage_unavailable', path);
  }
  const raw = auth.issueMemberSetupToken('+919876543210', 'central-member-1', Date.now(), process.env, {
    id: 'central-member-1', role: 'member', identitySource: 'central-whatsapp', authVersion: 'a'.repeat(64), locationIds: []
  });
  for (const path of ['/auth/password', '/auth/password/set', '/auth/set-password']) {
    const setup = await request(path, {password: 'valid-member-password'}, 'nia_member_setup=' + raw);
    assert.equal(setup.status, 503, path);
    assert.equal(setup.body.error, 'save_storage_unavailable', path);
  }
  const login = await request('/auth/login', {phone: '9876543210', password: 'valid-member-password'});
  assert.equal(login.status, 503);
  assert.equal(login.body.error, 'save_storage_unavailable');
  assert.equal(centralCalls, 0);

  assert.equal((await request('/auth/logout', {})).status, 200);
  assert.equal((await request('/catalogue')).status, 200);

  const testRequest = await request('/auth/request', {phone: TEST_PHONE});
  assert.equal(testRequest.status, 200, JSON.stringify(testRequest));
  const code = testPhoneOtpCode(TEST_PHONE, testRequest.body.challenge);
  const testVerify = await request('/auth/verify', {phone: TEST_PHONE, challenge: testRequest.body.challenge, code});
  assert.equal(testVerify.status, 200);
  const testCookie = testVerify.headers['set-cookie'].split(';')[0];
  const testSetup = await request('/auth/set-password', {password: 'test-lane-password'}, testCookie);
  assert.equal(testSetup.status, 200);
  assert.equal(testSetup.body.account.test, true);
});
