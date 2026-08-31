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

async function ensureSchema() {
  if (!hasDurableStore()) return false;
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
}

export async function loadRuntimeState(stateKey, initialValue) {
  if (!hasDurableStore()) {
    return { value: initialValue, version: 0, storage: "memory" };
  }

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
  if (!row) throw new Error("runtime_state_missing");
  return {
    value: row.state_value,
    version: Number(row.version),
    storage: "postgres"
  };
}

export async function saveRuntimeState(stateKey, value, expectedVersion) {
  if (!hasDurableStore()) {
    return { ok: true, version: expectedVersion, storage: "memory" };
  }

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
}

export async function storageStatus(stateKey) {
  if (!hasDurableStore()) return { storage: "memory", connected: false };
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
}

export async function deleteRuntimeState(stateKey) {
  if (!hasDurableStore()) return { ok: true, storage: "memory" };
  await ensureSchema();
  await sql()`DELETE FROM nia_runtime_state WHERE state_key = ${stateKey}`;
  return { ok: true, storage: "postgres" };
}
