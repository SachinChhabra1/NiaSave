import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL || "";
let client;
let schemaReady;

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
  if (!hasDurableStore()) {
    return { value: initialValue, version: 0, storage: "memory" };
  }

  try {
    await ensureSchema();
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
      console.error("runtime_state_missing", { stateKey });
      return { value: initialValue, version: 0, storage: "postgres" };
    }
    return {
      value: asRuntimeValue(row.state_value, initialValue),
      version: Number(row.version) || 0,
      storage: "postgres"
    };
  } catch (error) {
    console.error("runtime_store_load_failed", { stateKey, message: error.message });
    return { value: initialValue, version: 0, storage: "memory" };
  }
}

export async function saveRuntimeState(stateKey, value, expectedVersion) {
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
    if (!rows.length) return { ok: false, conflict: true, storage: "postgres" };
    return { ok: true, version: Number(rows[0].version), storage: "postgres" };
  } catch (error) {
    console.error("runtime_store_save_failed", { stateKey, message: error.message });
    return { ok: false, storage: "postgres", error: error.message };
  }
}

export async function storageStatus(stateKey) {
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
  } catch (error) {
    console.error("runtime_store_status_failed", { stateKey, message: error.message });
    return { storage: "memory", connected: false, version: 0 };
  }
}

export async function deleteRuntimeState(stateKey) {
  if (!hasDurableStore()) return { ok: true, storage: "memory" };
  try {
    await ensureSchema();
    await sql()`DELETE FROM nia_runtime_state WHERE state_key = ${stateKey}`;
    return { ok: true, storage: "postgres" };
  } catch (error) {
    console.error("runtime_store_delete_failed", { stateKey, message: error.message });
    return { ok: false, storage: "postgres", error: error.message };
  }
}
