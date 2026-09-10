import test from 'node:test';
import assert from 'node:assert/strict';
import {createStaffLoginLimiter} from './staff-login-limit.mjs';

function sharedStore() {
  let value = {buckets: {}}, version = 1;
  return {
    durable: () => true, hosted: () => true,
    load: async () => ({value: structuredClone(value), version, storage: 'postgres'}),
    save: async (_key, next, expected) => {
      if (expected !== version) return {ok: false, conflict: true};
      value = structuredClone(next); version++;
      return {ok: true, storage: 'postgres'};
    },
    value: () => value,
  };
}

test('identity attempts persist across independent instances and different IPs', async () => {
  const store = sharedStore();
  const options = {...store, maxPerIdentity: 2};
  assert.equal((await createStaffLoginLimiter(options)('ip-a', 'Person@Example.invalid')).allowed, true);
  assert.equal((await createStaffLoginLimiter(options)('ip-b', 'person@example.invalid')).allowed, true);
  assert.equal((await createStaffLoginLimiter(options)('ip-c', 'person@example.invalid')).allowed, false);
  assert.doesNotMatch(JSON.stringify(store.value()), /Person|person|example|ip-a|ip-b/);
});

test('concurrent instances cannot overspend an identity budget', async () => {
  const store = sharedStore();
  const results = await Promise.all(Array.from({length: 12}, (_, i) => createStaffLoginLimiter({...store, maxPerIdentity: 3})(`ip-${i}`, 'person@example.invalid')));
  assert.equal(results.filter(result => result.allowed).length, 3);
});

test('IP budget spans different identities and the window expires', async () => {
  let at = 1000;
  const consume = createStaffLoginLimiter({...sharedStore(), now: () => at, windowMs: 60_000, maxPerIp: 2});
  assert.equal((await consume('ip', 'a')).allowed, true);
  assert.equal((await consume('ip', 'b')).allowed, true);
  assert.deepEqual(await consume('ip', 'c'), {allowed: false, retryAfter: 60});
  at += 60_000;
  assert.equal((await consume('ip', 'c')).allowed, true);
});

test('hosted missing store, failed reads/writes and exhausted conflicts deny login', async () => {
  for (const override of [
    {durable: () => false},
    {load: async () => ({storage: 'memory'})},
    {load: async () => { throw new Error('private_exception'); }},
    {save: async () => ({ok: false})},
    {save: async () => ({ok: false, conflict: true})},
  ]) {
    assert.deepEqual(await createStaffLoginLimiter({...sharedStore(), ...override})('ip', 'person'), {allowed: false, unavailable: true, retryAfter: 60});
  }
});

test('active buckets are not evicted at capacity and expired buckets are pruned', async () => {
  let at = 1000;
  const consume = createStaffLoginLimiter({...sharedStore(), now: () => at, windowMs: 60_000, maxEntries: 2});
  assert.equal((await consume('a', 'a')).allowed, true);
  assert.equal((await consume('b', 'b')).unavailable, true);
  at += 60_000;
  assert.equal((await consume('b', 'b')).allowed, true);
});

test('invalid numeric settings use bounded defaults, never NaN or unlimited budgets', async () => {
  const consume = createStaffLoginLimiter({...sharedStore(), maxPerIdentity: 'invalid', maxPerIp: Infinity, windowMs: NaN});
  for (let i = 0; i < 8; i++) assert.equal((await consume('ip', 'person')).allowed, true);
  const denied = await consume('ip', 'person');
  assert.equal(denied.allowed, false);
  assert.ok(denied.retryAfter >= 899 && denied.retryAfter <= 900);
});
