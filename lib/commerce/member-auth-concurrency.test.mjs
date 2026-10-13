import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {randomBytes} from 'node:crypto';

Object.assign(process.env, {
  DATABASE_URL: 'postgres://member-auth-concurrency.invalid/test',
  NODE_ENV: 'production',
  COMMERCE_ENABLED: '1',
  COMMERCE_MEMBER_AUTH: 'password',
  DUMMY_DATA: '0',
  MEMBER_PASSWORD: 'fixture-shared-password',
  SESSION_SECRET: randomBytes(32).toString('hex'),
  CENTRAL_ORIGIN: 'https://central.invalid',
  CENTRAL_COMMERCE_KEY: 'k'.repeat(32),
  STAFF_PASSWORD: '', STAFF_TOKEN_SECRET: '', STAFF_AUTH_REQUIRED: '1',
  COMMERCE_REQUIRE_CENTRAL_MEMBER: 'true',
  NIA_RUNTIME_STATE_KEY: 'member-auth-concurrency-fixture'
});
for (const key of ['SHOWCASE_ENTRY', 'COMMERCE_PREVIEW', 'NIA_SHOWCASE', 'VERCEL', 'VERCEL_ENV']) delete process.env[key];

const auth = await import('./member-password.mjs');
const {resetDummy} = await import('../../rabbit/engine.mjs');
const {PERSONAL_PASSWORD_KDF} = auth;
const {ordersById, ordersByCode, orderIdsByStop, ...emptyBook} = structuredClone(resetDummy());

function workerResult(id, control, state, cookie) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./member-auth-concurrency-worker.mjs', import.meta.url), {
      workerData: {id, control, state, cookie}
    });
    worker.once('message', value => resolve(value));
    worker.once('error', reject);
    worker.once('exit', code => { if (code !== 0) reject(new Error(`concurrency worker exited ${code}`)); });
  });
}

test('C2 concurrent valid setup-cookie requests produce one success and one setup-expired result', async () => {
  const raw = auth.issueMemberSetupToken('+919876543210', 'central-member-1', Date.now(), process.env, {
    id: 'central-member-1', role: 'member', authVersion: 'a'.repeat(64),
    name: 'Central member', locationIds: []
  });
  const grantId = auth.memberSetupGrantId(raw);
  const state = {
    ...emptyBook,
    commerce: {limits: {}, memberPasswords: {}, memberSetupGrants: {
      [grantId]: {expiresAt: Date.now() + 600000}
    }}
  };
  const encoded = new TextEncoder().encode(JSON.stringify(state));
  const control = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 5);
  const stateBuffer = new SharedArrayBuffer(Math.max(2 * 1024 * 1024, encoded.length + 1024));
  new Uint8Array(stateBuffer).set(encoded);
  Atomics.store(new Int32Array(control), 0, 1);
  Atomics.store(new Int32Array(control), 1, encoded.length);
  const cookie = 'nia_member_setup=' + raw;
  const [first, second] = await Promise.all([
    workerResult(1, control, stateBuffer, cookie),
    workerResult(2, control, stateBuffer, cookie)
  ]);
  const results = [first, second];
  assert.deepEqual(results.map(result => result.status).sort((a, b) => a - b), [200, 401]);
  assert.equal(results.filter(result => result.status === 200)[0].accountId, 'central-member-1');
  assert.equal(results.filter(result => result.status === 401)[0].error, 'setup_expired');
  const finalState = JSON.parse(new TextDecoder().decode(new Uint8Array(stateBuffer).slice(0, Atomics.load(new Int32Array(control), 1))));
  assert.equal(finalState.commerce.memberSetupGrants[grantId], undefined);
  const profiles = Object.values(finalState.commerce.memberPasswords);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].passwordCredential.scheme, PERSONAL_PASSWORD_KDF.scheme);
  assert.equal(auth.profilePasswordMatches('+919876543210', 'concurrent-valid-password', profiles[0]), true);
});
