import {createHash} from 'node:crypto';
import {hasDurableStore, loadRuntimeState, saveRuntimeState} from './runtime-store.mjs';

const STATE_KEY = 'staff-login-limits-v1';
const integer = (value, fallback, min, max) => Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max ? Number(value) : fallback;
const hash = value => createHash('sha256').update(value).digest('hex');

// Shared compare-and-swap state, not an instance-local production counter.
// Only an explicitly non-hosted process may fall back to memory.
export function createStaffLoginLimiter(options = {}) {
  const windowMs = integer(options.windowMs ?? process.env.STAFF_LOGIN_WINDOW_MS, 900_000, 60_000, 3_600_000);
  const maxIp = integer(options.maxPerIp ?? process.env.STAFF_LOGIN_MAX_PER_IP, 30, 1, 1000);
  const maxIdentity = integer(options.maxPerIdentity ?? process.env.STAFF_LOGIN_MAX_PER_IDENTITY, 8, 1, 1000);
  const maxEntries = options.maxEntries ?? 20_000;
  const now = options.now ?? Date.now;
  const durable = options.durable ?? hasDurableStore;
  const hosted = options.hosted ?? (() => Boolean(process.env.VERCEL || process.env.VERCEL_ENV) || process.env.NODE_ENV === 'production');
  const load = options.load ?? loadRuntimeState;
  const save = options.save ?? saveRuntimeState;
  let memory = {buckets: {}}, version = 0;
  const unavailable = () => ({allowed: false, unavailable: true, retryAfter: 60});

  return async function consumeStaffLogin(ip, email) {
    const at = now();
    const keys = [
      ['p:' + hash(String(ip || 'unknown').slice(0, 256)), maxIp],
      // The identity budget is global across IPs and instances.
      ['i:' + hash(String(email || 'unknown').trim().toLowerCase().slice(0, 320)), maxIdentity],
    ];
    const shared = durable();
    if (!shared && hosted()) return unavailable();
    try {
      for (let attempt = 0; attempt < 8; attempt++) {
        const current = shared ? await load(STATE_KEY, {buckets: {}}) : {value: structuredClone(memory), version};
        if (shared && current.storage !== 'postgres') return unavailable();
        const source = current.value?.buckets;
        if (!source || typeof source !== 'object' || Array.isArray(source)) return unavailable();
        const buckets = {};
        for (const [key, row] of Object.entries(source)) {
          if (!/^[pi]:[a-f0-9]{64}$/.test(key) || !row || !Number.isSafeInteger(row.count) || row.count < 1 || !Number.isFinite(row.until)) return unavailable();
          if (row.until > at) buckets[key] = row;
        }
        const blocked = keys.filter(([key, max]) => buckets[key]?.count >= max);
        if (blocked.length) return {allowed: false, retryAfter: Math.max(1, Math.ceil(Math.max(...blocked.map(([key]) => buckets[key].until - at)) / 1000))};
        const additions = keys.filter(([key]) => !buckets[key]).length;
        // Never evict an active limit to admit another attacker-controlled key.
        if (Object.keys(buckets).length + additions > maxEntries) return unavailable();
        for (const [key] of keys) {
          const row = buckets[key];
          buckets[key] = {count: (row?.count ?? 0) + 1, until: row?.until ?? at + windowMs};
        }
        if (!shared) {
          memory = {buckets}; version++;
          return {allowed: true};
        }
        const result = await save(STATE_KEY, {buckets}, current.version);
        if (result.ok) return {allowed: true};
        if (!result.conflict) return unavailable();
      }
    } catch { /* Store errors never permit a login or expose exception details. */ }
    return unavailable();
  };
}

export const consumeStaffLogin = createStaffLoginLimiter();
