import { neon } from "@neondatabase/serverless";
import { showcaseReady, isShowcaseEntry } from './commerce/showcase-mode.mjs';

const showcase = isShowcaseEntry();
const DATABASE_URL = showcase ? (showcaseReady() ? process.env.SHOWCASE_DATABASE_URL : '') : (process.env.DATABASE_URL || "");
const keyFor = key => showcase ? `${process.env.SHOWCASE_INSTANCE}:${key}` : key;
let client;
let schemaReady;
// Version-first reads. A warm instance keeps the last value it loaded or saved
// per state key and asks Postgres only for the current version; the JSON blob
// crosses the network again only when that version has moved. Every save still
// compares-and-swaps on the version, so a stale cache can never win a write.
// This is what keeps the Jat Unit book inside the database's transfer allowance.
const cache = new Map();
const clone = value => (typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
function logStoreEvent(event) {
  console.error(event);
}
export function resetRuntimeCache() { cache.clear(); }
/** Test seam: replace the tagged-template SQL client (tests only). */
export function useSqlClientForTests(fn) { client = fn; schemaReady = undefined; cache.clear(); }

export function hasDurableStore() {
  return Boolean(DATABASE_URL);
}

function sql() {
  if (!DATABASE_URL) return null;
  if (!client) client = neon(DATABASE_URL);
  return client;
}

export function asRuntimeValue(raw, fallback) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      /* use fallback */
    }
  }
  return fallback;
}

async function ensureSchema() {
  if (!hasDurableStore()) return false;
  try {
    if (!schemaReady) {
      schemaReady = sql()`
        CREATE TABLE IF NOT EXISTS nia_runtime_state (
          state_key TEXT PRIMARY KEY,
          state_value JSONB NOT NULL,
          version BIGINT NOT NULL DEFAULT 1,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
    }
    await schemaReady;
    return true;
  } catch (error) {
    schemaReady = undefined;
    throw error;
  }
}

export async function loadRuntimeState(stateKey, initialValue) {
  stateKey = keyFor(stateKey);
  if (!hasDurableStore()) {
    return { value: initialValue, version: 0, storage: "memory" };
  }

  try {
    await ensureSchema();
    const cached = cache.get(stateKey);
    if (cached) {
      const current = await sql()`SELECT version FROM nia_runtime_state WHERE state_key = ${stateKey}`;
      if (current[0] && Number(current[0].version) === cached.version) {
        return { value: clone(cached.value), version: cached.version, storage: "postgres", cached: true };
      }
    }
    const encoded = JSON.stringify(initialValue);
    const inserted = await sql()`
      INSERT INTO nia_runtime_state (state_key, state_value)
      VALUES (${stateKey}, ${encoded}::jsonb)
      ON CONFLICT (state_key) DO NOTHING
      RETURNING state_value, version
    `;
    const rows = inserted.length ? inserted : await sql()`
      SELECT state_value, version
      FROM nia_runtime_state
      WHERE state_key = ${stateKey}
    `;
    const row = rows[0];
    if (!row) {
      logStoreEvent("runtime_state_missing", stateKey);
      return { value: initialValue, version: 0, storage: "postgres" };
    }
    const value = asRuntimeValue(row.state_value, initialValue);
    const version = Number(row.version) || 0;
    cache.set(stateKey, { value: clone(value), version });
    return { value, version, storage: "postgres" };
  } catch {
    logStoreEvent("runtime_store_load_failed", stateKey);
    return { value: initialValue, version: 0, storage: "memory" };
  }
}

export async function saveRuntimeState(stateKey, value, expectedVersion) {
  stateKey = keyFor(stateKey);
  if (!hasDurableStore()) {
    return { ok: true, version: expectedVersion, storage: "memory" };
  }

  try {
    await ensureSchema();
    const encoded = JSON.stringify(value);
    const rows = await sql()`
      UPDATE nia_runtime_state
      SET state_value = ${encoded}::jsonb,
          version = version + 1,
          updated_at = NOW()
      WHERE state_key = ${stateKey}
        AND version = ${expectedVersion}
      RETURNING version
    `;
    if (!rows.length) { cache.delete(stateKey); return { ok: false, conflict: true, storage: "postgres" }; }
    const version = Number(rows[0].version);
    cache.set(stateKey, { value: clone(value), version });
    return { ok: true, version, storage: "postgres" };
  } catch {
    logStoreEvent("runtime_store_save_failed", stateKey);
    return { ok: false, storage: "postgres", error: "runtime_store_save_failed" };
  }
}

export async function storageStatus(stateKey) {
  stateKey = keyFor(stateKey);
  if (!hasDurableStore()) return { storage: "memory", connected: false };
  try {
    await ensureSchema();
    const rows = await sql()`
      SELECT version, updated_at
      FROM nia_runtime_state
      WHERE state_key = ${stateKey}
    `;
    return {
      storage: "postgres",
      connected: true,
      version: rows[0] ? Number(rows[0].version) : 0,
      updatedAt: rows[0]?.updated_at || null
    };
  } catch {
    logStoreEvent("runtime_store_status_failed", stateKey);
    return { storage: "memory", connected: false, version: 0 };
  }
}

export async function deleteRuntimeState(stateKey) {
  stateKey = keyFor(stateKey);
  if (!hasDurableStore()) return { ok: true, storage: "memory" };
  try {
    await ensureSchema();
    await sql()`DELETE FROM nia_runtime_state WHERE state_key = ${stateKey}`;
    cache.delete(stateKey);
    return { ok: true, storage: "postgres" };
  } catch {
    logStoreEvent("runtime_store_delete_failed", stateKey);
    return { ok: false, storage: "postgres", error: "runtime_store_delete_failed" };
  }
}
