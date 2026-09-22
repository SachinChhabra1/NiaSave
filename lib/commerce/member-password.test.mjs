import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs';

const fixturePassword = 'test-member-password';
const fixtureSecret = randomBytes(32).toString('hex');
Object.assign(process.env, {
  DATABASE_URL: 'postgres://member-password-test.invalid/test',
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
  resetMemberLoginAttempts,
  requireCentralMember,
  publicBrowseEnabled,
  passwordAuthCapabilities
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

async function request(path, body, {cookie = '', origin = 'https://www.nia.test', headers = {}} = {}) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  Object.assign(req, {
    method: body === undefined ? 'GET' : 'POST',
    url: '/api/commerce' + path,
    headers: {host: 'www.nia.test', origin, cookie, ...headers},
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

test('COMMERCE_PUBLIC_BROWSE is on unless the env is exactly false', () => {
  const env = {...process.env};
  delete env.COMMERCE_PUBLIC_BROWSE;
  assert.equal(publicBrowseEnabled(env), true);
  assert.equal(publicBrowseEnabled({...env, COMMERCE_PUBLIC_BROWSE: 'true'}), true);
  assert.equal(publicBrowseEnabled({...env, COMMERCE_PUBLIC_BROWSE: 'false'}), false);
});

test('COMMERCE_PUBLIC_BROWSE=false restores the empty unsigned catalogue wall', async () => {
  process.env.COMMERCE_PUBLIC_BROWSE = 'false';
  try {
    const anonymous = await request('/catalogue');
    assert.equal(anonymous.status, 200);
    assert.equal(anonymous.body.account, null);
    assert.equal(anonymous.body.status, 'sign_in_required');
    assert.deepEqual(anonymous.body.products, []);
    assert.equal((await request('/orders')).status, 401);
  } finally {
    delete process.env.COMMERCE_PUBLIC_BROWSE;
  }
});

test('COMMERCE_REQUIRE_CENTRAL_MEMBER is off unless the env is exactly true', () => {
  const env = {...process.env};
  delete env.COMMERCE_REQUIRE_CENTRAL_MEMBER;
  assert.equal(requireCentralMember(env), false);
  assert.equal(passwordAuthCapabilities(env).registeredPhoneOnly, false);
  assert.equal(requireCentralMember({...env, COMMERCE_REQUIRE_CENTRAL_MEMBER: 'false'}), false);
  assert.equal(requireCentralMember({...env, COMMERCE_REQUIRE_CENTRAL_MEMBER: 'true'}), true);
  assert.equal(passwordAuthCapabilities({...env, COMMERCE_REQUIRE_CENTRAL_MEMBER: 'true'}).registeredPhoneOnly, true);
});

test('wrong password is rejected; correct password sets a signed stay-signed-in cookie; cookie authenticates the next request', async () => {
  resetMemberLoginAttempts();
  const anonymous = await request('/catalogue');
  assert.equal(anonymous.status, 200);
  assert.equal(anonymous.body.memberAuth, 'password');
  assert.equal(anonymous.body.memberAuthCapabilities?.mode, 'password_otp');
  assert.equal(anonymous.body.memberAuthCapabilities?.registeredPhoneOnly, false);
  assert.equal(anonymous.body.memberAuthCapabilities?.entryPath, '/');
  assert.deepEqual(anonymous.body.memberAuthCapabilities?.hashTabs, ['live', 'earn', 'shop', 'send']);
  assert.equal(anonymous.body.memberAuthCapabilities?.apiBasePath, '/api/commerce');
  assert.equal(anonymous.body.memberAuthCapabilities?.setPasswordPath, '/api/commerce/auth/set-password');
  assert.equal(anonymous.body.memberAuthCapabilities?.loginPath, '/api/commerce/auth/login');
  assert.equal(anonymous.body.account, null);
  assert.equal(anonymous.body.status, 'ready');
  assert.ok(anonymous.body.products.some(p => p.id === 'groundnut_oil' && p.price > 0));
  // Quarantine: pending-pack SKUs must not appear as orderable guest catalogue products.
  assert.equal(anonymous.body.products.find(p => p.id === 'bathsoap_pick'), undefined);
  assert.equal(anonymous.body.products.find(p => p.id === 'essentials_pick'), undefined);
  const guestOil = anonymous.body.products.find(p => p.id === 'groundnut_oil');
  assert.equal(guestOil.pack, '1 L bottle');
  assert.equal(guestOil.test, true);
  assert.match(guestOil.name, /\(TEST\)/);
  assert.ok(anonymous.body.locations.some(l => l.id === 'S01' && l.test === true));
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

test('OTP requests hide membership and bind the confirmed Central identity through password setup', async () => {
  resetMemberLoginAttempts();
  process.env.COMMERCE_REQUIRE_CENTRAL_MEMBER = 'true';
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({url, body: init.body ? JSON.parse(init.body) : null});
    if (url === 'https://central.invalid/api/service/member') {
      const kind = calls.at(-1).body?.request?.kind;
      const phone = calls.at(-1).body?.request?.phone;
      if (kind === 'member.lookupByPhone') {
        if (phone === '+919999999999') return {status: 404, json: async () => ({error: 'member_not_registered'})};
        return {status: 200, json: async () => ({registered: true, member: {subject: 'member-subject-1'}})};
      }
      if(kind==='member.identity')return {status:200,json:async()=>({source:'central',status:'ready',member:{id:'member-subject-1',state:'approved',kyc:'approved',access:'active'},account:{id:'member-subject-1',role:'member',name:'Verified member',authVersion:'a'.repeat(64),locationIds:[]}})};
      if (kind === 'identity.verify.request') return {status: 200, json: async () => ({challenge: 'challenge-123'})};
      if (kind === 'identity.verify.confirm') {
        const code = calls.at(-1).body?.request?.code;
        return code === '123456' && phone === '+919876543210'
          ? {status: 200, json: async () => ({token: 'central-session', account: {id: 'member-subject-1', authVersion:'a'.repeat(64), role:'member', name:'Verified member',locationIds:[]}})}
          : {status: 401, json: async () => ({error: 'bad_otp'})};
      }
    }
    throw new Error('unexpected_fetch_call');
  };
  try {
    const denied = await request('/auth/request', {phone: '9999999999'});
    assert.equal(denied.status, 200);
    assert.equal(denied.body.error, undefined);
    assert.equal(calls.some(entry=>entry.body?.request?.kind==='member.lookupByPhone'),false);
    assert.equal(calls.some(entry => entry.body?.request?.kind === 'identity.verify.request' && entry.body?.request?.phone === '+919999999999'), true);

    const requested = await request('/auth/request', {phone: '9876543210'});
    assert.equal(requested.status, 200);
    assert.equal(typeof requested.body.challenge, 'string');
    assert.equal(requested.body.next, 'verify_otp');

    const badOtp = await request('/auth/verify', {phone: '9876543210', challenge: requested.body.challenge, code: '111111'});
    assert.equal(badOtp.status, 401);
    assert.equal(badOtp.body.error, 'bad_otp');

    const swapped = await request('/auth/verify', {phone:'9876543222',challenge:requested.body.challenge,code:'123456'});
    assert.equal(swapped.status,401);
    assert.equal(swapped.headers['set-cookie'],undefined);
    const verified = await request('/auth/verify', {phone: '9876543210', challenge: requested.body.challenge, code: '123456'});
    assert.equal(verified.status, 200);
    assert.equal(verified.body.ok, true);
    assert.equal(verified.body.next, 'set_password');
    const setupCookie = verified.headers['set-cookie'].split(';')[0];
    assert.match(setupCookie, /^nia_member_setup=/);

    const weak = await request('/auth/set-password', {password: 'short'}, {cookie: setupCookie});
    assert.equal(weak.status, 400);
    assert.equal(weak.body.error, 'weak_password');

    const weakLegacyAlias = await request('/auth/password', {password: 'short'}, {cookie: setupCookie});
    assert.equal(weakLegacyAlias.status, 400);
    assert.equal(weakLegacyAlias.body.error, 'weak_password');

    const swappedSetup = await request('/auth/set-password',{phone:'9876543222',password:'new-member-password'},{cookie:setupCookie});
    assert.equal(swappedSetup.status,400);
    const configured = await request('/auth/set-password', {phone: '9876543210', password: 'new-member-password', remember: true, subject:'attacker',name:'Injected name',locationIds:['S01'],account:{id:'attacker',role:'admin'}}, {cookie: setupCookie});
    assert.equal(configured.status, 200);
    assert.equal(configured.body.account.id, 'member-subject-1');
    assert.equal(configured.body.account.role, 'member');
    assert.equal(configured.body.account.name,'Verified member');
    assert.deepEqual(configured.body.account.locationIds,[]);
    const memberCookie=configured.headers['set-cookie'][0].split(';')[0];
    const memberCatalogue=await request('/catalogue',undefined,{cookie:memberCookie});
    assert.deepEqual(memberCatalogue.body.account.locationIds,[]);
    assert.equal(Array.isArray(configured.headers['set-cookie']), true);
    assert.match(configured.headers['set-cookie'][0], /^nia_member=/);
    assert.match(configured.headers['set-cookie'][1], /^nia_member_setup=/);
    assert.match(configured.headers['set-cookie'][1], /Max-Age=0$/);

    const ok = await request('/auth/login', {phone: '9876543210', password: 'new-member-password'});
    assert.equal(ok.status, 200);
    assert.equal(ok.body.account.id, 'member-subject-1');
    assert.equal(ok.body.account.role, 'member');

    const wrong = await request('/auth/login', {phone: '9876543210', password: 'wrong-member-password'});
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.error, 'invalid_password');
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.COMMERCE_REQUIRE_CENTRAL_MEMBER;
  }
});

test('unset COMMERCE_REQUIRE_CENTRAL_MEMBER lets an unregistered phone reach the OTP challenge', async () => {
  resetMemberLoginAttempts();
  delete process.env.COMMERCE_REQUIRE_CENTRAL_MEMBER;
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({url, body: init.body ? JSON.parse(init.body) : null});
    if (url === 'https://central.invalid/api/service/member') {
      const kind = calls.at(-1).body?.request?.kind;
      if (kind === 'member.lookupByPhone') return {status: 404, json: async () => ({error: 'member_not_registered'})};
      if (kind === 'identity.verify.request') return {status: 200, json: async () => ({challenge: 'challenge-unregistered'})};
    }
    throw new Error('unexpected_fetch_call');
  };
  try {
    const requested = await request('/auth/request', {phone: '9999999999'});
    assert.equal(requested.status, 200);
    assert.equal(requested.body.challenge, 'challenge-unregistered');
    assert.equal(requested.body.next, 'verify_otp');
    assert.equal(requested.body.error, undefined);
    assert.equal(calls.some(entry => entry.body?.request?.kind === 'identity.verify.request' && entry.body?.request?.phone === '+919999999999'), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('guest storefront first paint does not auto-open OTP', () => {
  const src = fs.readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /if\(needsSignIn\(\)\)\{\$\('#content'\)\.innerHTML=entryHomepage\(\);if\(!\$\('#dialog'\)\.open\)login\(\)/);
  assert.doesNotMatch(src, /else if\(needsSignIn\(\)\)login\(\)/);
  assert.match(src, /page==='home'\?entryHomepage\(\)/);
  assert.match(src, /page==='shop'\?shop\(\)/);
  assert.match(src, /pickingLang/);
});

test('phone after Continue keys the member; mill pack order persists with member id and no online pay', async () => {
  resetMemberLoginAttempts();
  const login = await request('/auth/login', {phone: '9876501234', password: fixturePassword});
  assert.equal(login.status, 200, login.body?.error);
  assert.match(login.body.account.id, /^nia-member-/);
  assert.notEqual(login.body.account.id, MEMBER_ACCOUNT.id);
  assert.notEqual(login.body.account.id, 'preview-member');
  const cookie = login.headers['set-cookie'].split(';')[0];
  const cat = await request('/catalogue', undefined, {cookie});
  assert.equal(cat.status, 200, cat.body?.error);
  assert.equal(cat.body.paymentsEnabled, false);
  assert.equal(cat.body.onlinePayment, false);
  const oil = (cat.body.products || []).find(p => p.id === 'groundnut_oil');
  assert.ok(oil, 'signed-in member sees frozen groundnut oil');
  assert.equal(oil.pack, '1 L bottle');
  assert.equal(oil.test, true);
  assert.match(oil.name, /\(TEST\)/);
  assert.ok(cat.body.locations.some(l => l.id === 'S01' && l.name === 'Nia Nest Ompal'));
  const guestAfter = await request('/catalogue');
  assert.equal(guestAfter.body.products.find(p => p.id === 'groundnut_oil').pack, '1 L bottle');
  assert.equal(guestAfter.body.products.find(p => p.id === 'groundnut_oil').test, true);
  assert.ok(guestAfter.body.locations.some(l => l.id === 'S01'));
  const intent = {locationId: 'S01', fulfillment: 'pickup', lines: [{id: 'groundnut_oil', qty: 1}]};
  const q = await request('/quote', intent, {cookie});
  assert.equal(q.status, 200, q.body?.error);
  assert.equal(q.body.amount, 185);
  const created = await request('/orders', {...intent, fingerprint: q.body.fingerprint}, {cookie, headers: {'idempotency-key': 'phone-order-proof-01'}});
  assert.equal(created.status, 201, created.body?.error);
  assert.equal(created.body.status, 'reserved');
  assert.equal(created.body.payStatus, 'unpaid');
  assert.equal(created.body.paid, 0);
  assert.equal(created.body.preview, false);
  assert.equal(created.body.test, true);
  assert.equal(created.body.memberId, login.body.account.id);
  assert.notEqual(created.body.memberId, 'preview-member');
  assert.equal(created.body.payment, undefined);
  const read = await request('/orders/' + created.body.id, undefined, {cookie});
  assert.equal(read.status, 200, read.body?.error);
  assert.equal(read.body.id, created.body.id);
  assert.equal(read.body.memberId, login.body.account.id);
  assert.equal(read.body.status, 'reserved');
  assert.equal(read.body.payStatus, 'unpaid');
  assert.equal(read.body.test, true);
  assert.equal(read.body.storage, 'postgres');
});


test('Central scopes and display name survive signed setup and session without a default studio grant',async()=>{
 const {issueMemberSetupToken,verifyMemberSetupToken,buildMemberPasswordProfile,memberPasswordLogin}=await import('./member-password.mjs');
 const phone='+919876543244';
 const canonical={authVersion:'a'.repeat(64),locationModes:{'RJT-FN-D01-S01':['pickup']},locationPinCodes:{},id:'canonical-24',name:'Verified member',role:'member',locationIds:['RJT-FN-D01-S01']};
 const setup=verifyMemberSetupToken(issueMemberSetupToken(phone,canonical.id,Date.now(),process.env,canonical));
 assert.deepEqual(setup.locationIds,canonical.locationIds);
 const profile=buildMemberPasswordProfile(phone,'member-pass-123',setup);
 const login=memberPasswordLogin({phone,password:'member-pass-123'},{socket:{remoteAddress:'scope-test'}},Date.now(),process.env,profile);
 assert.equal(login.body.account.id,canonical.id);
 assert.deepEqual(login.body.account.locationIds,canonical.locationIds);
 const actor=verifyMemberSession(login.headers['set-cookie'].split(';')[0].slice('nia_member='.length));
 assert.deepEqual(actor.locationIds,canonical.locationIds);
 assert.equal(actor.name,canonical.name);
 assert.equal(actor.authVersion,canonical.authVersion);
 assert.equal(actor.identitySource,'central-whatsapp');
 assert.deepEqual(actor.locationModes,canonical.locationModes);
});


test('Central OTP setup, password login and existing sessions fail closed on revocation and refresh scopes',async()=>{
 resetMemberLoginAttempts();
 const original=globalThis.fetch;
 const phone='+919876549911',id='member-revalidation',version='a'.repeat(64);
 let active=true,revision=version,locations=['S01'];
 globalThis.fetch=async(_url,init)=>{
  const e=JSON.parse(init.body),r=e.request;
  const account={id,role:'member',name:'Verified',authVersion:revision,locationIds:locations,locationModes:{S01:['pickup']},locationPinCodes:{}};
  if(r.kind==='identity.verify.confirm')return {status:200,json:async()=>({account})};
  assert.equal(r.kind,'member.identity');assert.equal(e.member.subject,id);assert.equal(r.phone,phone);assert.equal(r.authVersion,version);
  if(!active||r.authVersion!==revision)return {status:401,json:async()=>({error:'sign_in_required'})};
  return {status:200,json:async()=>({source:'central',status:'ready',member:{id,state:'approved',kyc:'approved',access:'active'},account})};
 };
 try{
  const verified=await request('/auth/verify',{phone,challenge:'verified-challenge',code:'123456'});
  assert.equal(verified.status,200);
  const setupCookie=verified.headers['set-cookie'].split(';')[0];
  active=false;
  assert.equal((await request('/auth/password',{phone,password:'valid-member-password'},{cookie:setupCookie})).status,401);
  active=true;revision='b'.repeat(64);
  assert.equal((await request('/auth/password',{phone,password:'valid-member-password'},{cookie:setupCookie})).status,401);
  revision=version;
  const configured=await request('/auth/password',{phone,password:'valid-member-password'},{cookie:setupCookie});
  assert.equal(configured.status,200);
  const cookie=configured.headers['set-cookie'][0].split(';')[0];
  locations=[];
  const refreshed=await request('/catalogue',undefined,{cookie});
  assert.equal(refreshed.status,200);assert.deepEqual(refreshed.body.account.locationIds,[]);
  active=false;
  assert.equal((await request('/orders',undefined,{cookie})).status,401);
  assert.equal((await request('/auth/login',{phone,password:'valid-member-password'})).status,401);
  globalThis.fetch=async()=>{throw Error('offline');};
  assert.equal((await request('/orders',undefined,{cookie})).status,503);
 }finally{globalThis.fetch=original;}
});


test('strict Central member mode rejects shared passwords, legacy profiles and old cookies without affecting labelled TEST',async()=>{
 const {memberPasswordLogin,buildMemberPasswordProfile}=await import('./member-password.mjs');
 resetMemberLoginAttempts();
 const legacy=await request('/auth/login',{phone:'9876512345',password:fixturePassword});
 assert.equal(legacy.status,200);
 const cookie=legacy.headers['set-cookie'].split(';')[0];
 const legacyProfile=buildMemberPasswordProfile('+919876512345','old-local-password',{subject:'old-local-member'});
 process.env.COMMERCE_REQUIRE_CENTRAL_MEMBER='true';
 try{
  assert.equal((await request('/auth/login',{phone:'9876512345',password:fixturePassword})).status,401);
  assert.equal((await request('/auth/login',{password:fixturePassword})).status,401);
  assert.equal(memberPasswordLogin({phone:'9876512345',password:'old-local-password'},{socket:{remoteAddress:'strict-test'}},Date.now(),process.env,legacyProfile).status,401);
  assert.equal((await request('/orders',undefined,{cookie})).status,401);
  assert.equal((await request('/catalogue',undefined,{cookie})).status,401);
  assert.equal((await request('/catalogue')).status,200);
  const testActor={id:'nia-test-phone-member',role:'member',name:'TEST member',locationIds:['S01'],test:true};
  const testCookie='nia_member='+issueMemberSession(testActor);
  assert.equal((await request('/catalogue',undefined,{cookie:testCookie})).status,200);
  const testProfile=buildMemberPasswordProfile('+917000000001','test-local-password',{subject:'nia-test-phone-member'});
  assert.equal(memberPasswordLogin({phone:'7000000001',password:'test-local-password'},{socket:{remoteAddress:'strict-test'}},Date.now(),process.env,testProfile).status,200);
 }finally{delete process.env.COMMERCE_REQUIRE_CENTRAL_MEMBER;}
});
