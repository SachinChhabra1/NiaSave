import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://runtime-store-sanitization";
const store = await import("./runtime-store.mjs");

test("runtime-store errors keep stable codes and never log raw database messages", async () => {
  const sql = () => { throw new Error("password=secret_db_value"); };
  store.useSqlClientForTests(sql);

  const logs = [];
  const original = console.error;
  console.error = (...args) => logs.push(args.map(value => typeof value === "string" ? value : JSON.stringify(value)).join(" "));

  try {
    const loaded = await store.loadRuntimeState("state-key", { ok: true });
    assert.equal(loaded.storage, "memory");

    const saved = await store.saveRuntimeState("state-key", { ok: true }, 1);
    assert.equal(saved.ok, false);
    assert.equal(saved.error, "runtime_store_save_failed");

    const deleted = await store.deleteRuntimeState("state-key");
    assert.equal(deleted.ok, false);
    assert.equal(deleted.error, "runtime_store_delete_failed");
  } finally {
    console.error = original;
  }

  assert.ok(logs.some(line => line.includes("runtime_store_load_failed")));
  assert.ok(logs.some(line => line.includes("runtime_store_save_failed")));
  assert.ok(logs.some(line => line.includes("runtime_store_delete_failed")));
  for (const line of logs) assert.doesNotMatch(line, /secret_db_value|password=/i);
});
