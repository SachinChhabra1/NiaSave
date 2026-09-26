import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomBytes} from 'node:crypto';

Object.assign(process.env, {
  DATABASE_URL: 'postgres://member-auth-hardening.invalid/test',
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
  NIA_RUNTIME_STATE_KEY: 'member-auth-hardening-fixture'
});
for (const key of ['SHOWCASE_ENTRY', 'COMMERCE_PREVIEW', 'NIA_SHOWCASE', 'VERCEL', 'VERCEL_ENV']) delete process.env[key];

const store = await import('../runtime-store.mjs');
const {resetDummy} = await import('../../rabbit/engine.mjs');
const {commerceHttp} = await import('./http.mjs');
const auth = await import('./member-password.mjs');
const {TEST_PHONE, testPhoneOtpCode} = await import('./test-login.mjs');

const stateKey = process.env.NIA_RUNTIME_STATE_KEY;
const {ordersById, ordersByCode, orderIdsByStop, ...emptyBook} = structuredClone(resetDummy());
const rows = new Map();
let storageMode = 'ok';
let remainingConflicts = 0;
let successfulWrites = 0;
let centralMode = 'active';
let confirmMode = 'active';
let confirmationUsed = false;
let centralCalls = [];

function resetFixture() {
  rows.set(stateKey, {state_value: structuredClone(emptyBook), version: 1});
  store.resetRuntimeCache();
  auth.resetMemberLoginAttempts();
  storageMode = 'ok';
  remainingConflicts = 0;
  successfulWrites = 0;
  centralMode = 'active';
  confirmMode = 'active';
  confirmationUsed = false;
  centralCalls = [];
}

store.useSqlClientForTests(async (strings, ...values) => {
  const query = strings.join('$');
  const key = values[0];
  if (query.includes('CREATE TABLE')) return [];
  if (storageMode === 'read-fail' && (query.includes('SELECT version') || query.includes('SELECT state_value'))) throw new Error('fixture_read_failure');
  if (query.includes('SELECT version')) return rows.has(key) ? [{version: rows.get(key).version}] : [];
  if (query.includes('INSERT INTO')) {
    if (rows.has(key)) return [];
    rows.set(key, {state_value: JSON.parse(values[1]), version: 1});
    return [structuredClone(rows.get(key))];
  }
  if (query.includes('SELECT state_value')) return rows.has(key) ? [structuredClone(rows.get(key))] : [];
  if (query.includes('UPDATE nia_runtime_state')) {
    if (storageMode === 'write-fail') throw new Error('fixture_write_failure');
    if (storageMode === 'write-fail-after-gate' && successfulWrites++ >= 1) throw new Error('fixture_write_failure_after_gate');
    if (storageMode === 'write-fail-after-two-writes' && successfulWrites++ >= 2) throw new Error('fixture_write_failure_after_two_writes');
    if (storageMode === 'conflict' || remainingConflicts > 0) {
      if (remainingConflicts > 0) remainingConflicts -= 1;
      return [];
    }
    const row = rows.get(values[1]);
    if (!row || row.version !== Number(values[2])) return [];
    row.state_value = JSON.parse(values[0]);
    row.version += 1;
    return [{version: row.version}];
  }
  throw new Error('unexpected_fixture_query');
});

globalThis.fetch = async (_url, init = {}) => {
  const envelope = JSON.parse(init.body);
  const request = envelope.request || {};
  centralCalls.push({...request, subject: envelope.member?.subject});
  if (request.kind === 'save.locations') return {status: 200, json: async () => ({locations: [], asOf: new Date().toISOString(), freshnessSeconds: 60})};
  if (request.kind === 'identity.verify.request') return {status: 200, json: async () => ({challenge: 'opaque-central-challenge'})};
  if (request.kind === 'identity.verify.confirm') {
    if (confirmMode === 'rejected' || (confirmMode === 'one-use' && confirmationUsed)) return {status: 401, json: async () => ({error: 'bad_otp'})};
    confirmationUsed = true;
    return {status: 200, json: async () => ({token: 'provider-token-never-persisted', account: {
      id: 'central-member-1', role: 'member', authVersion: 'a'.repeat(64), name: 'Central member', locationIds: []
    }})};
  }
  if (request.kind === 'member.identity') {
    if (centralMode === 'unavailable') return {status: 503, json: async () => ({error: 'identity_unavailable'})};
    if (centralMode === 'revoked') return {status: 401, json: async () => ({error: 'sign_in_required'})};
    return {status: 200, json: async () => ({source: 'central', status: 'ready', member: {id: 'central-member-1', state: 'approved', kyc: 'approved', access: 'active'}, account: {
      id: 'central-member-1', role: 'member', authVersion: (centralMode === 'changed-version' ? 'b' : 'a').repeat(64), name: 'Central member', locationIds: []
    }})};
  }
  throw new Error('unexpected_central_request');
};

async function request(path, body, cookie = '', handler = commerceHttp, options = {}) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  Object.assign(req, {
    method: body === undefined ? 'GET' : 'POST',
    url: '/api/commerce' + path,
    headers: {host: 'www.nia.test', origin: 'https://www.nia.test', cookie, ...(options.headers || {})},
    socket: {remoteAddress: options.remoteAddress || '127.0.0.1'}
  });
  let result;
  await handler(req, {
    writeHead(status, headers) { result = {status, headers}; },
    end(raw) { result.body = JSON.parse(raw); }
  }, path, async () => null);
  return result;
}

function savedState() {
  return rows.get(stateKey).state_value;
}

async function otpFixture(run) {
  const previous = process.env.COMMERCE_MEMBER_AUTH;
  process.env.COMMERCE_MEMBER_AUTH = 'otp';
  resetFixture();
  try { await run(); } finally { process.env.COMMERCE_MEMBER_AUTH = previous; }
}

async function issueOtpSession() {
  const requested = await request('/auth/request', {phone: '9876543210'});
  assert.equal(requested.status, 200);
  const result = await request('/auth/verify', {
    phone: '9876543210', challenge: requested.body.challenge, code: '123456',
    account: {id: 'injected-id', role: 'admin', locationIds: ['S01']}
  });
  assert.equal(result.status, 200);
  const cookies = result.headers['set-cookie'];
  assert.equal(cookies.length, 2);
  const member = cookies.find(cookie => cookie.startsWith('nia_member=')).split(';')[0];
  const setup = cookies.find(cookie => cookie.startsWith('nia_member_setup=')).split(';')[0];
  return {result, member, setup, cookie: `${member}; ${setup}`};
}

test('OTP primary authenticates the canonical member directly without a password profile', () => otpFixture(async () => {
  const capabilities = auth.passwordAuthCapabilities();
  assert.equal(capabilities.mode, 'otp');
  assert.equal(capabilities.primaryMethod, 'whatsapp_otp');
  assert.equal(capabilities.passwordOptional, true);
  assert.equal(capabilities.passwordSetupWindowSeconds, 600);
  assert.equal(capabilities.setPasswordPath, '/api/commerce/auth/password');
  assert.equal(capabilities.loginPath, '/api/commerce/auth/login');
  const {result, member} = await issueOtpSession();
  assert.equal(result.body.next, 'authenticated');
  assert.equal(result.body.account.id, 'central-member-1');
  assert.equal(result.body.account.role, 'member');
  assert.deepEqual(result.body.account.locationIds, []);
  assert.equal(result.body.token, undefined);
  assert.equal(result.body.account.passwordSetupGrantId, undefined);
  assert.equal(result.body.passwordSetup.available, true);
  assert.ok(Date.parse(result.body.passwordSetup.expiresAt) > Date.now());
  assert.match(result.headers['set-cookie'][0], /HttpOnly; Secure; SameSite=Strict; Max-Age=43200/);
  const actor = auth.verifyMemberSession(member.slice('nia_member='.length));
  assert.equal(actor.id, 'central-member-1');
  assert.equal(actor.identitySource, 'central-whatsapp');
  assert.equal(actor.authVersion, 'a'.repeat(64));
  assert.equal(savedState().commerce.memberPasswords, undefined);
  assert.equal(Object.keys(savedState().commerce.memberSetupGrants).length, 1);
  const catalogue = await request('/catalogue', undefined, member);
  assert.equal(catalogue.status, 200);
  assert.equal(catalogue.body.memberAuth, 'otp');
  assert.equal(catalogue.body.account.id, 'central-member-1');
}));

test('separate OTP setup grants are unique even for an identical account and timestamp', () => {
  const at = Date.now();
  const first = auth.issueMemberSetupToken('+919876543210', 'central-member-1', at);
  const second = auth.issueMemberSetupToken('+919876543210', 'central-member-1', at);
  assert.notEqual(auth.memberSetupGrantId(first), auth.memberSetupGrantId(second));
  assert.deepEqual(auth.verifyMemberSetupToken(first, at), auth.verifyMemberSetupToken(second, at));
});

test('OTP optional password setup requires its exact session, persists once, and retains password login', () => otpFixture(async () => {
  const first = await issueOtpSession();
  const other = await issueOtpSession();
  const password = {password: 'optional-personal-password'};
  assert.equal((await request('/auth/password', password, first.setup)).body.error, 'sign_in_required');
  assert.equal((await request('/auth/password', password, `${other.member}; ${first.setup}`)).body.error, 'sign_in_required');
  assert.equal(savedState().commerce.memberPasswords, undefined);
  assert.equal((await request('/auth/password', {...password, phone: '9876543211'}, first.cookie)).body.error, 'invalid_phone');
  const configured = await request('/auth/password', password, first.cookie);
  assert.equal(configured.status, 200);
  assert.equal(configured.body.account.id, 'central-member-1');
  const profile = savedState().commerce.memberPasswords[auth.memberPasswordProfileKey('+919876543210')];
  assert.equal(profile.passwordCredential.scheme, 'scrypt');
  assert.equal(profile.identitySource, 'central-whatsapp');
  const replay = await request('/auth/password', {password: 'different-password'}, first.cookie);
  assert.equal(replay.status, 401);
  assert.equal(replay.body.error, 'setup_expired');
  assert.equal(replay.headers['set-cookie'], undefined);
  assert.equal(auth.profilePasswordMatches('+919876543210', password.password, profile), true);
  const login = await request('/auth/login', {phone: '9876543210', ...password});
  assert.equal(login.status, 200);
  assert.equal(login.body.account.id, 'central-member-1');
}));

test('OTP optional grant expiry leaves the authenticated member session usable', () => otpFixture(async () => {
  const issued = await issueOtpSession();
  const grantId = auth.memberSetupGrantIdFromRequest({headers: {cookie: issued.setup}});
  savedState().commerce.memberSetupGrants[grantId].expiresAt = Date.now() - 1;
  store.resetRuntimeCache();
  const expired = await request('/auth/password', {password: 'optional-personal-password'}, issued.cookie);
  assert.equal(expired.status, 401);
  assert.equal(expired.body.error, 'setup_expired');
  assert.equal(expired.headers['set-cookie'], undefined);
  assert.equal((await request('/catalogue', undefined, issued.member)).status, 200);
  assert.equal(savedState().commerce.memberPasswords, undefined);
}));

test('OTP logout revokes the optional grant using only the member cookie and clears both cookies', () => otpFixture(async () => {
  const issued = await issueOtpSession();
  // Browser setup cookie Path excludes logout; member cookie must identify the grant.
  const logout = await request('/auth/logout', {}, issued.member);
  assert.equal(logout.status, 200);
  assert.equal(logout.headers['set-cookie'].length, 2);
  assert.ok(logout.headers['set-cookie'].every(cookie => cookie.includes('Max-Age=0')));
  assert.equal(Object.keys(savedState().commerce.memberSetupGrants).length, 0);
  assert.equal((await request('/auth/password', {password: 'optional-personal-password'}, issued.cookie)).body.error, 'setup_expired');
  assert.equal(savedState().commerce.memberPasswords, undefined);
}));

test('OTP setup revalidates Central identity, version and availability; revoked sessions cannot browse', () => otpFixture(async () => {
  const issued = await issueOtpSession();
  for (const mode of ['revoked', 'changed-version', 'unavailable']) {
    centralMode = mode;
    const result = await request('/auth/password', {password: 'optional-personal-password'}, issued.cookie);
    assert.equal(result.status, mode === 'unavailable' ? 503 : 401);
    assert.equal(result.body.error, mode === 'unavailable' ? 'identity_unavailable' : 'sign_in_required');
    assert.equal(savedState().commerce.memberPasswords, undefined);
    assert.equal(Object.keys(savedState().commerce.memberSetupGrants).length, 1);
  }
  centralMode = 'revoked';
  assert.equal((await request('/catalogue', undefined, issued.member)).body.error, 'sign_in_required');
}));

test('OTP grant storage failure never reports successful authentication or emits cookies', () => otpFixture(async () => {
  const requested = await request('/auth/request', {phone: '9876543210'});
  storageMode = 'write-fail-after-gate';
  const result = await request('/auth/verify', {phone: '9876543210', challenge: requested.body.challenge, code: '123456'});
  assert.equal(result.status, 503);
  assert.equal(result.body.error, 'save_storage_unavailable');
  assert.equal(result.headers['set-cookie'], undefined);
  assert.equal(result.body.account, undefined);
  assert.equal(savedState().commerce.memberSetupGrants, undefined);
}));

test('OTP rejected or replayed Central challenges cannot produce a second session', () => otpFixture(async () => {
  confirmMode = 'one-use';
  await issueOtpSession();
  const replay = await request('/auth/verify', {phone: '9876543210', challenge: 'opaque-central-challenge', code: '123456'});
  assert.equal(replay.status, 401);
  assert.equal(replay.body.error, 'bad_otp');
  assert.equal(replay.headers['set-cookie'], undefined);
  assert.equal(Object.keys(savedState().commerce.memberSetupGrants).length, 1);
}));

test('OTP logout reports durable revocation failure while clearing browser cookies', () => otpFixture(async () => {
  const issued = await issueOtpSession();
  storageMode = 'write-fail';
  const logout = await request('/auth/logout', {}, issued.member);
  assert.equal(logout.status, 503);
  assert.equal(logout.body.error, 'save_storage_unavailable');
  assert.ok(logout.headers['set-cookie'].every(cookie => cookie.includes('Max-Age=0')));
}));

async function issueSetup() {
  const requested = await request('/auth/request', {phone: '9876543210'});
  assert.equal(requested.status, 200);
  const verified = await request('/auth/verify', {phone: '9876543210', challenge: requested.body.challenge, code: '123456'});
  assert.equal(verified.status, 200);
  return verified.headers['set-cookie'].split(';')[0];
}

test('C1 configured durable store failures fail closed before Central and cannot create sessions', async () => {
  resetFixture();
  storageMode = 'read-fail';
  const readFailure = await request('/auth/request', {phone: '9876543210'});
  assert.equal(readFailure.status, 503);
  assert.equal(readFailure.body.error, 'save_storage_unavailable');
  assert.equal(centralCalls.length, 0);

  resetFixture();
  storageMode = 'write-fail';
  const writeFailure = await request('/auth/password/request', {phone: '9876543210'});
  assert.equal(writeFailure.status, 503);
  assert.equal(writeFailure.body.error, 'save_storage_unavailable');
  assert.equal(centralCalls.length, 0);

  resetFixture();
  storageMode = 'conflict';
  const exhausted = await request('/auth/password/verify', {phone: '9876543210', challenge: '123456', code: '123456'});
  assert.equal(exhausted.status, 409);
  assert.equal(exhausted.body.error, 'state_conflict');
  assert.equal(centralCalls.length, 0);

  resetFixture();
  storageMode = 'read-fail';
  const loginFailure = await request('/auth/login', {phone: '9876543210', password: 'valid-member-password'});
  assert.equal(loginFailure.status, 503);
  assert.equal(loginFailure.body.error, 'save_storage_unavailable');
  assert.equal(loginFailure.headers['set-cookie'], undefined);
});

test('C2 reserves an opaque one-time grant, consumes it atomically, and preserves Central identity', async () => {
  resetFixture();
  const setupCookie = await issueSetup();
  const grants = savedState().commerce.memberSetupGrants;
  assert.equal(Object.keys(grants).length, 1);
  const grantState = JSON.stringify(grants);
  assert.doesNotMatch(grantState, /9876543210|opaque-central-challenge|provider-token-never-persisted|valid-member-password/);
  assert.equal(grantState.includes(setupCookie.slice('nia_member_setup='.length)), false);

  const weak = await request('/auth/password', {password: 'short'}, setupCookie);
  assert.equal(weak.status, 400);
  assert.equal(weak.body.error, 'weak_password');
  assert.equal(Object.keys(savedState().commerce.memberSetupGrants).length, 1);

  const first = await request('/auth/set-password', {phone: '9876543210', password: 'valid-member-password'}, setupCookie);
  assert.equal(first.status, 200);
  assert.equal(first.body.account.id, 'central-member-1');
  assert.deepEqual(first.body.account.locationIds, []);
  assert.equal(Object.keys(savedState().commerce.memberSetupGrants).length, 0);
  const key = auth.memberPasswordProfileKey('+919876543210');
  const firstProfile = structuredClone(savedState().commerce.memberPasswords[key]);
  assert.equal(firstProfile.passwordDigest, undefined);
  assert.equal(firstProfile.passwordCredential.scheme, 'scrypt');
  assert.equal(firstProfile.passwordCredential.version, 1);
  assert.equal(auth.profilePasswordMatches('+919876543210', 'wrong-member-password', firstProfile), false);
  assert.equal(auth.profilePasswordMatches('+919876543210', 'valid-member-password', firstProfile), true);

  const replay = await request('/auth/password/set', {phone: '9876543210', password: 'second-password'}, setupCookie);
  assert.equal(replay.status, 401);
  assert.equal(replay.body.error, 'setup_expired');
  assert.deepEqual(savedState().commerce.memberPasswords[key], firstProfile);

  const login = await request('/auth/login', {phone: '9876543210', password: 'valid-member-password'});
  assert.equal(login.status, 200);
  assert.equal(login.body.account.id, 'central-member-1');
  assert.deepEqual(login.body.account.locationIds, []);
});

test('C2 Central revalidation and durable write failures do not consume the grant', async () => {
  resetFixture();
  const revokedCookie = await issueSetup();
  centralMode = 'revoked';
  const revoked = await request('/auth/password', {password: 'valid-member-password'}, revokedCookie);
  assert.equal(revoked.status, 401);
  assert.equal(revoked.body.error, 'setup_expired');
  assert.equal(Object.keys(savedState().commerce.memberSetupGrants).length, 1);
  centralMode = 'active';
  assert.equal((await request('/auth/password', {password: 'valid-member-password'}, revokedCookie)).status, 200);

  resetFixture();
  const failedWriteCookie = await issueSetup();
  storageMode = 'write-fail';
  const failedWrite = await request('/auth/password', {password: 'another-valid-password'}, failedWriteCookie);
  assert.equal(failedWrite.status, 503);
  assert.equal(failedWrite.body.error, 'save_storage_unavailable');
  assert.equal(Object.keys(savedState().commerce.memberSetupGrants).length, 1);
  assert.equal(savedState().commerce.memberPasswords, undefined);
});

test('C2 Central verify does not acknowledge a setup continuation when grant reservation cannot be saved', async () => {
  resetFixture();
  const requested = await request('/auth/request', {phone: '9876543210'});
  assert.equal(requested.status, 200);
  storageMode = 'write-fail-after-gate';
  const verified = await request('/auth/verify', {phone: '9876543210', challenge: requested.body.challenge, code: '123456'});
  assert.equal(verified.status, 503);
  assert.equal(verified.body.error, 'save_storage_unavailable');
  assert.equal(verified.headers['set-cookie'], undefined);
  assert.equal(savedState().commerce.memberSetupGrants, undefined);
});

test('C2 CAS retry commits the profile and grant consumption as one state transition', async () => {
  resetFixture();
  const setupCookie = await issueSetup();
  remainingConflicts = 1;
  const result = await request('/auth/password', {password: 'cas-valid-password'}, setupCookie);
  assert.equal(result.status, 200);
  const key = auth.memberPasswordProfileKey('+919876543210');
  assert.equal(auth.profilePasswordMatches('+919876543210', 'cas-valid-password', savedState().commerce.memberPasswords[key]), true);
  assert.equal(Object.keys(savedState().commerce.memberSetupGrants).length, 0);
});

test('C2 expired grants fail closed and are pruned on the next durable auth write', async () => {
  resetFixture();
  const setupCookie = await issueSetup();
  const grantId = auth.memberSetupGrantIdFromRequest({headers: {cookie: setupCookie}});
  savedState().commerce.memberSetupGrants[grantId].expiresAt = Date.now() - 1;
  store.resetRuntimeCache();
  const expired = await request('/auth/password', {password: 'expired-valid-password'}, setupCookie);
  assert.equal(expired.status, 401);
  assert.equal(expired.body.error, 'setup_expired');
  assert.equal(savedState().commerce.memberSetupGrants[grantId], undefined);
});

test('C3 durable login budget survives a fresh handler, uses trusted Vercel IPs, and blocks before Central', async () => {
  resetFixture();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await request('/auth/login', {phone: '9876543210', password: 'wrong-member-password'});
    assert.equal(result.status, 401);
  }
  const limits = JSON.stringify(savedState().commerce.limits);
  assert.doesNotMatch(limits, /127\.0\.0\.1|9876543210/);
  store.resetRuntimeCache();
  const freshHttp = (await import('./http.mjs?c3-fresh-handler')).commerceHttp;
  const blocked = await request('/auth/login', {phone: '9876543210', password: 'valid-member-password'}, '', freshHttp);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, 'too_many_attempts');
  assert.equal(centralCalls.length, 0);

  resetFixture();
  const previousVercel = process.env.VERCEL;
  process.env.VERCEL = '1';
  try {
    const login = {phone: '9876543210', password: 'wrong-member-password'};
    const trusted = value => ({headers: {'x-vercel-forwarded-for': value}, remoteAddress: 'shared-vercel-socket'});
    for (let attempt = 0; attempt < 20; attempt += 1) {
      assert.equal((await request('/auth/login', login, '', commerceHttp, trusted('203.0.113.10'))).status, 401);
    }

    // Keep the process-local defense-in-depth counter from obscuring the
    // durable-bucket distinction under test.
    auth.resetMemberLoginAttempts();
    assert.equal((await request('/auth/login', login, '', commerceHttp, trusted('203.0.113.11'))).status, 401);
    auth.resetMemberLoginAttempts();
    assert.equal((await request('/auth/login', login, '', commerceHttp, trusted('203.0.113.10'))).status, 429);
    assert.equal(Object.keys(savedState().commerce.limits).length, 2);

    resetFixture();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      assert.equal((await request('/auth/login', login, '', commerceHttp, {remoteAddress: 'shared-vercel-socket'})).status, 401);
    }
    auth.resetMemberLoginAttempts();
    const invalid = await request('/auth/login', login, '', commerceHttp, {
      headers: {'x-vercel-forwarded-for': 'not-an-ip'},
      remoteAddress: 'different-vercel-socket'
    });
    assert.equal(invalid.status, 429);
    assert.equal(Object.keys(savedState().commerce.limits).length, 1);
  } finally {
    auth.resetMemberLoginAttempts();
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
  }
});

test('C3 local login defense-in-depth follows trusted Vercel IPs on one socket without a reset', async () => {
  resetFixture();
  const setupCookie = await issueSetup();
  const configured = await request('/auth/set-password', {phone: '9876543210', password: 'valid-member-password'}, setupCookie);
  assert.equal(configured.status, 200);
  auth.resetMemberLoginAttempts();
  const previousVercel = process.env.VERCEL;
  process.env.VERCEL = '1';
  const trusted = value => ({headers: {'x-vercel-forwarded-for': value}, remoteAddress: 'shared-vercel-socket'});
  try {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      assert.equal((await request('/auth/login', {phone: '9876543210', password: 'wrong-member-password'}, '', commerceHttp, trusted('203.0.113.20'))).status, 401);
    }
    const otherClient = await request('/auth/login', {phone: '9876543210', password: 'valid-member-password'}, '', commerceHttp, trusted('203.0.113.21'));
    assert.equal(otherClient.status, 200);
    const deniedClientA = await request('/auth/login', {phone: '9876543210', password: 'valid-member-password'}, '', commerceHttp, trusted('203.0.113.20'));
    assert.equal(deniedClientA.status, 429);
    const otherClientAgain = await request('/auth/login', {phone: '9876543210', password: 'valid-member-password'}, '', commerceHttp, trusted('203.0.113.21'));
    assert.equal(otherClientAgain.status, 200);
  } finally {
    auth.resetMemberLoginAttempts();
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
  }
});

test('C3 real OTP bootstrap uses trusted Vercel IPs while phone and global safeguards remain', async () => {
  resetFixture();
  const previousVercel = process.env.VERCEL;
  process.env.VERCEL = '1';
  const trusted = value => ({headers: {'x-vercel-forwarded-for': value}, remoteAddress: 'shared-vercel-socket'});
  const phones = Array.from({length: 8}, (_, index) => `98765432${String(index).padStart(2, '0')}`);
  try {
    for (const phone of phones) {
      const count = phone === phones.at(-1) ? 4 : 8;
      for (let attempt = 0; attempt < count; attempt += 1) {
        assert.equal((await request('/auth/request', {phone}, '', commerceHttp, trusted('203.0.113.30'))).status, 200);
      }
    }
    const otherClient = await request('/auth/request', {phone: '9876543288'}, '', commerceHttp, trusted('203.0.113.31'));
    assert.equal(otherClient.status, 200);
    const deniedClientA = await request('/auth/request', {phone: '9876543289'}, '', commerceHttp, trusted('203.0.113.30'));
    assert.equal(deniedClientA.status, 429);
    const phoneLimit = await request('/auth/request', {phone: phones[0]}, '', commerceHttp, trusted('203.0.113.31'));
    assert.equal(phoneLimit.status, 429);
    const otherClientAgain = await request('/auth/request', {phone: '9876543288'}, '', commerceHttp, trusted('203.0.113.31'));
    assert.equal(otherClientAgain.status, 200);
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
  }
});

test('C3 storage failure denies before verification, refresh, or session issuance', async () => {
  resetFixture();
  storageMode = 'read-fail';
  const result = await request('/auth/login', {phone: '9876543210', password: 'valid-member-password'});
  assert.equal(result.status, 503);
  assert.equal(result.body.error, 'save_storage_unavailable');
  assert.equal(result.headers['set-cookie'], undefined);
  assert.equal(centralCalls.length, 0);
});

test('C3 window expiry restores the durable login budget', async () => {
  resetFixture();
  const originalNow = Date.now;
  const base = originalNow();
  try {
    Date.now = () => base;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      assert.equal((await request('/auth/login', {phone: '9876543210', password: 'wrong-member-password'})).status, 401);
    }
    Date.now = () => base + 15 * 60 * 1000 + 1;
    const restored = await request('/auth/login', {phone: '9876543210', password: 'wrong-member-password'});
    assert.equal(restored.status, 401);
  } finally {
    Date.now = originalNow;
  }
});

test('C3 keeps the legacy shared MEMBER_PASSWORD fallback behind the prior local IP limiter', async () => {
  resetFixture();
  auth.resetMemberLoginAttempts();
  const previousRequirement = process.env.COMMERCE_REQUIRE_CENTRAL_MEMBER;
  delete process.env.COMMERCE_REQUIRE_CENTRAL_MEMBER;
  try {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const wrong = await request('/auth/login', {password: 'wrong-shared-password'});
      assert.equal(wrong.status, 401);
    }
    const blocked = await request('/auth/login', {password: 'fixture-shared-password'});
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error, 'too_many_attempts');
    assert.equal(savedState().commerce?.limits, undefined);

    auth.resetMemberLoginAttempts();
    process.env.COMMERCE_REQUIRE_CENTRAL_MEMBER = 'true';
    const strictShared = await request('/auth/login', {password: 'fixture-shared-password'});
    assert.equal(strictShared.status, 401);
    assert.equal(strictShared.body.error, 'invalid_password');
    const strictPhoneShared = await request('/auth/login', {phone: '9876543210', password: 'fixture-shared-password'});
    assert.equal(strictPhoneShared.status, 401);
    assert.equal(strictPhoneShared.body.error, 'invalid_password');
  } finally {
    auth.resetMemberLoginAttempts();
    if (previousRequirement === undefined) delete process.env.COMMERCE_REQUIRE_CENTRAL_MEMBER;
    else process.env.COMMERCE_REQUIRE_CENTRAL_MEMBER = previousRequirement;
  }
});

test('C1 fixed TEST OTP state survives the auth-only frozen save path', async () => {
  resetFixture();
  const requested = await request('/auth/request', {phone: TEST_PHONE});
  assert.equal(requested.status, 200);
  const verified = await request('/auth/verify', {
    phone: TEST_PHONE,
    challenge: requested.body.challenge,
    code: testPhoneOtpCode(TEST_PHONE, requested.body.challenge)
  });
  assert.equal(verified.status, 200);
  assert.match(verified.headers['set-cookie'], /^nia_member_setup=/);
});

test('C5 profiles use salted scrypt credentials and the same password never reuses a verifier', () => {
  resetFixture();
  const first = auth.buildMemberPasswordProfile('+919876543210', 'same-password', {subject: 'central-member-1'});
  const second = auth.buildMemberPasswordProfile('+919876543211', 'same-password', {subject: 'central-member-2'});
  assert.equal(first.passwordDigest, undefined);
  assert.equal(first.passwordCredential.scheme, 'scrypt');
  assert.equal(auth.profilePasswordMatches('+919876543210', 'same-password', first), true);
  assert.equal(auth.profilePasswordMatches('+919876543210', 'wrong-password', first), false);
  assert.notEqual(first.passwordCredential.salt, second.passwordCredential.salt);
  assert.notEqual(first.passwordCredential.verifier, second.passwordCredential.verifier);
  assert.doesNotMatch(JSON.stringify(first), /same-password/);
});

function seedLegacyProfile(phone = '+919876543210', password = 'legacy-password', identitySource = 'central-whatsapp') {
  const profile = {
    passwordDigest: auth.passwordProfileDigest(phone, password),
    subject: 'central-member-1',
    identitySource,
    authVersion: 'a'.repeat(64),
    name: 'Central member',
    locationIds: ['S01'],
    locationModes: {S01: ['pickup']},
    locationPinCodes: {},
    updatedAt: new Date().toISOString()
  };
  savedState().commerce ||= {limits: {}};
  savedState().commerce.limits ||= {};
  savedState().commerce.memberPasswords ||= {};
  savedState().commerce.memberPasswords[auth.memberPasswordProfileKey(phone)] = profile;
  store.resetRuntimeCache();
  return profile;
}

test('C5 legacy personal login migrates once after Central revalidation and preserves identity scopes', async () => {
  resetFixture();
  seedLegacyProfile();
  const result = await request('/auth/login', {phone: '9876543210', password: 'legacy-password'});
  assert.equal(result.status, 200);
  assert.equal(result.body.account.id, 'central-member-1');
  assert.deepEqual(result.body.account.locationIds, []);
  const upgraded = savedState().commerce.memberPasswords[auth.memberPasswordProfileKey('+919876543210')];
  assert.equal(upgraded.passwordDigest, undefined);
  assert.equal(upgraded.passwordCredential.scheme, 'scrypt');
  assert.equal(upgraded.subject, 'central-member-1');
  assert.deepEqual(upgraded.locationModes, {});
  const before = JSON.stringify(upgraded);
  const second = await request('/auth/login', {phone: '9876543210', password: 'legacy-password'});
  assert.equal(second.status, 200);
  assert.equal(JSON.stringify(savedState().commerce.memberPasswords[auth.memberPasswordProfileKey('+919876543210')]), before);
});

test('C5 migration failure returns no session and revoked Central identity never migrates', async () => {
  resetFixture();
  seedLegacyProfile();
  storageMode = 'write-fail-after-two-writes';
  const failed = await request('/auth/login', {phone: '9876543210', password: 'legacy-password'});
  assert.equal(failed.status, 503);
  assert.equal(failed.body.error, 'save_storage_unavailable');
  assert.equal(failed.headers['set-cookie'], undefined);
  assert.equal(savedState().commerce.memberPasswords[auth.memberPasswordProfileKey('+919876543210')].passwordDigest !== undefined, true);

  resetFixture();
  seedLegacyProfile();
  centralMode = 'revoked';
  const revoked = await request('/auth/login', {phone: '9876543210', password: 'legacy-password'});
  assert.equal(revoked.status, 401);
  assert.equal(revoked.body.error, 'invalid_password');
  assert.equal(savedState().commerce.memberPasswords[auth.memberPasswordProfileKey('+919876543210')].passwordDigest !== undefined, true);
});

test('final integration: Central WhatsApp identity reaches fresh-browser password login and fails closed after revocation', async () => {
  resetFixture();
  auth.resetMemberLoginAttempts();
  const phone = '9876543210';
  const password = 'journey-personal-password';
  const requested = await request('/auth/request', {phone});
  assert.equal(requested.status, 200);
  assert.equal(requested.body.challenge, 'opaque-central-challenge');
  assert.equal(centralCalls[0].kind, 'identity.verify.request');
  assert.equal(centralCalls[0].channel, 'whatsapp');

  const verified = await request('/auth/verify', {phone, challenge: requested.body.challenge, code: '123456'});
  assert.equal(verified.status, 200);
  assert.equal(centralCalls[1].kind, 'identity.verify.confirm');
  const setupCookie = verified.headers['set-cookie'].split(';')[0];
  assert.equal(Object.keys(savedState().commerce.memberSetupGrants).length, 1);

  const configured = await request('/auth/set-password', {phone, password}, setupCookie);
  assert.equal(configured.status, 200);
  assert.equal(configured.body.account.id, 'central-member-1');
  assert.deepEqual(configured.body.account.locationIds, []);
  assert.equal(Object.keys(savedState().commerce.memberSetupGrants).length, 0);
  const savedProfile = savedState().commerce.memberPasswords[auth.memberPasswordProfileKey('+919876543210')];
  assert.equal(savedProfile.identitySource, 'central-whatsapp');
  assert.equal(savedProfile.authVersion.length, 64);
  assert.equal(savedProfile.passwordCredential.scheme, 'scrypt');
  assert.deepEqual(savedProfile.locationIds, []);
  const retainedCookie = configured.headers['set-cookie'][0].split(';')[0];

  // This request has a new request object and no phone/client state from the
  // setup browser: the browser must provide phone + personal password again.
  const freshBrowserLogin = await request('/auth/login', {phone, password});
  assert.equal(freshBrowserLogin.status, 200);
  assert.equal(freshBrowserLogin.body.account.id, 'central-member-1');
  assert.deepEqual(freshBrowserLogin.body.account.locationIds, []);
  assert.equal(centralCalls.filter(call => call.kind === 'member.identity').length, 2);
  assert.equal(centralCalls.some(call => call.kind === 'member.identity' && call.subject === 'central-member-1'), true);
  assert.equal(freshBrowserLogin.body.account.id, savedState().commerce.memberPasswords[auth.memberPasswordProfileKey('+919876543210')].subject);
  assert.deepEqual(freshBrowserLogin.body.account.locationIds, []);

  centralMode = 'revoked';
  const revokedLogin = await request('/auth/login', {phone, password});
  assert.equal(revokedLogin.status, 401);
  assert.equal(revokedLogin.body.error, 'invalid_password');
  assert.equal(revokedLogin.headers['set-cookie'], undefined);
  const retainedSession = await request('/catalogue', undefined, retainedCookie);
  assert.equal(retainedSession.status, 401);
  assert.equal(retainedSession.body.error, 'sign_in_required');
  assert.equal(savedState().commerce.memberPasswords[auth.memberPasswordProfileKey('+919876543210')].locationIds.length, 0);
  assert.equal(centralCalls.some(call => call.kind === 'identity.verify.request'), true);
  assert.equal(centralCalls.some(call => call.kind === 'identity.verify.confirm'), true);
  assert.equal(centralCalls.some(call => call.kind === 'member.identity'), true);
  assert.equal(centralCalls.some(call => call.kind === 'member.lookupByPhone'), false);
});
