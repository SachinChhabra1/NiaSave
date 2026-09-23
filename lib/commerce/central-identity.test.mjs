const {seedFrozenPreview}=await import('./test-frozen-book.mjs');
import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

process.env.COMMERCE_PREVIEW = '1';
process.env.DATABASE_URL = '';
process.env.NODE_ENV = 'test';
delete process.env.VERCEL;
delete process.env.COMMERCE_REQUIRE_CENTRAL_IDENTITY;

const KEY = '0123456789abcdef0123456789abcdef0123456789abcdef';
const {
  parseIdentityRecord,
  testIdentityRecord,
  unavailableIdentity,
  centralIdentityRecord,
  requireCentralIdentity,
  IDENTITY_KIND
} = await import('./central-identity.mjs');
const { TEST_PHONE_MEMBER } = await import('./test-login.mjs');
const { TEST_MEMBER } = await import('./test-member.mjs');
const { handler } = await import('../../api/server.mjs');

const complete = {
  schemaVersion: 1,
  source: 'central',
  member: { id: 'nm-1', subject: 'auth|member-42', name: 'Ravi Kumar', phoneMasked: '+91 ******3210', state: 'approved', kyc: 'approved', access: 'active', theatre: 'WLG' },
  studio: { id: 'stu-1', siteCode: 'S01', name: 'Nia Nest Ompal', theatre: 'rajputana', verified: true },
  jco: { id: 'p-jco', name: 'Ajit Singh', unitId: 'studio_custody:S01', role: 'JCO' }
};

seedFrozenPreview();
test('parser accepts one Central record and rejects invented or half-shaped payloads', () => {
  const ok = parseIdentityRecord(complete);
  assert.equal(ok.status, 'ready');
  assert.equal(ok.member.id, 'nm-1');
  assert.equal(ok.studio.id, 'stu-1');
  assert.equal(ok.jco.role, 'JCO');
  assert.equal(ok.test, false);
  assert.equal(parseIdentityRecord({ ...complete, schemaVersion: 2 }), null);
  assert.equal(parseIdentityRecord({ ...complete, member: { id: 'nm-1' } }), null);
  assert.equal(parseIdentityRecord({ ...complete, studio: { name: 'guess' } }), null);
  assert.equal(parseIdentityRecord({ ...complete, jco: { name: 'guess', role: 'JCO' } }), null);
  assert.equal(parseIdentityRecord({ ...complete, jco: { id: 'p', name: 'X', unitId: 'u', role: 'counsellor' } }), null);
  const noStudio = parseIdentityRecord({ ...complete, studio: null, jco: null });
  assert.equal(noStudio.studio, null);
  assert.equal(noStudio.jco, null);
  assert.equal(parseIdentityRecord({ ...complete, studio: null }), null);
});

test('TEST identity is labelled TEST and never claims Central as source', () => {
  const phone = testIdentityRecord(TEST_PHONE_MEMBER);
  assert.equal(phone.source, 'test');
  assert.equal(phone.test, true);
  assert.equal(phone.member.id, TEST_PHONE_MEMBER.id);
  assert.equal(phone.member.name, 'TEST member');
  assert.equal(phone.jco.role, 'JCO');
  const auto = testIdentityRecord(TEST_MEMBER);
  assert.equal(auto.member.id, TEST_MEMBER.id);
  assert.equal(auto.test, true);
  assert.notEqual(auto.member.id, phone.member.id);
});

test('TEST actors skip Central; real members fail closed only when the gate is on', async () => {
  const env = { CENTRAL_ORIGIN: 'https://central.test', CENTRAL_COMMERCE_KEY: KEY };
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(JSON.parse(init.body));
    return { status: 200, json: async () => complete };
  };
  const testOut = await centralIdentityRecord({ ...TEST_PHONE_MEMBER }, { env, fetchImpl });
  assert.equal(testOut.test, true);
  assert.equal(testOut.source, 'test');
  assert.equal(calls.length, 0);

  const real = await centralIdentityRecord({ id: 'local-1', role: 'member', authSubject: 'auth|member-42' }, { env, fetchImpl });
  assert.equal(real.status, 'ready');
  assert.equal(real.source, 'central');
  assert.equal(real.member.subject, 'auth|member-42');
  assert.equal(calls[0].request.kind, IDENTITY_KIND);
  assert.equal(calls[0].member.subject, 'auth|member-42');
  assert.equal(calls[0].request.memberId, undefined);

  const unknown = await centralIdentityRecord({ id: 'local-1', role: 'member', authSubject: 'auth|member-42' }, {
    env, fetchImpl: async () => ({ status: 400, json: async () => ({ error: 'unknown_request' }) })
  });
  assert.equal(unknown.status, 'unavailable');
  assert.equal(unknown.error, 'unknown_request');
  assert.equal(unknown.member, null);
  assert.equal(unknown.studio, null);
  assert.equal(unknown.jco, null);

  assert.equal(requireCentralIdentity({}), false);
  await assert.rejects(
    centralIdentityRecord({ id: 'local-1', role: 'member', authSubject: 'auth|member-42' }, {
      env: { ...env, COMMERCE_REQUIRE_CENTRAL_IDENTITY: 'true' },
      fetchImpl: async () => ({ status: 400, json: async () => ({ error: 'unknown_request' }) })
    }),
    /central_identity_required/
  );
  await assert.rejects(centralIdentityRecord(null, { env }), /sign_in_required/);
  assert.equal(unavailableIdentity('x').status, 'unavailable');
});

async function request(path, body, cookie = '', method, headers = {}) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  Object.assign(req, {
    url: '/api/commerce' + path,
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers: { host: 'localhost:8787', origin: 'http://localhost:8787', 'content-type': 'application/json', cookie, ...headers },
    socket: { remoteAddress: '127.0.0.1' }
  });
  let code, h, payload;
  const res = { writeHead(status, head) { code = status; h = head; }, end(raw) { payload = JSON.parse(raw); } };
  await handler(req, res);
  return { status: code, headers: h, body: payload };
}

test('GET /identity needs a member session, forwards the verified subject, never a browser member id, never writes identity into Save state', async () => {
  assert.equal((await request('/identity')).status, 401);
  const login = await request('/auth/preview', { role: 'member' });
  const cookie = login.headers['set-cookie'].split(';')[0];
  const enterprise = (await request('/auth/preview', { role: 'enterprise' })).headers['set-cookie'].split(';')[0];
  assert.equal((await request('/identity', undefined, enterprise)).status, 403);

  process.env.CENTRAL_ORIGIN = 'https://central.test';
  process.env.CENTRAL_COMMERCE_KEY = KEY;
  const originalFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    seen.push({ url: String(url), body });
    return { status: 200, json: async () => complete };
  };
  try {
    const read = await request('/identity?memberId=someone-else', undefined, cookie);
    assert.equal(read.status, 200, read.body?.error);
    assert.equal(read.body.source, 'central');
    assert.equal(read.body.member.id, 'nm-1');
    assert.equal(read.body.studio.id, 'stu-1');
    assert.equal(read.body.jco.role, 'JCO');
    assert.equal(seen[0].url, 'https://central.test/api/service/member');
    assert.equal(seen[0].body.request.kind, IDENTITY_KIND);
    assert.equal(seen[0].body.member.subject, 'preview-member');
    assert.equal(seen[0].body.request.memberId, undefined);
    assert.equal((await request('/identity', { memberId: 'forged' }, cookie, 'POST')).status, 405);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.CENTRAL_ORIGIN;
    delete process.env.CENTRAL_COMMERCE_KEY;
  }
});

test("M0 refuses the credential-free TEST identity endpoint",async()=>{const r=await request('/test/identity');assert.equal(r.status,503);assert.equal(r.body.error,'pilot_commitments_paused');});
