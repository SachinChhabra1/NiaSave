import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  deleteRuntimeState,
  hasDurableStore,
  loadRuntimeState,
  saveRuntimeState
} from "./runtime-store.mjs";

if (!hasDurableStore()) {
  process.stdout.write("runtime store integration skipped: DATABASE_URL missing\n");
  process.exit(0);
}

const key = "test-" + randomUUID();
try {
  const first = await loadRuntimeState(key, { counter: 1 });
  assert.equal(first.storage, "postgres");
  assert.equal(first.value.counter, 1);

  const saved = await saveRuntimeState(key, { counter: 2 }, first.version);
  assert.equal(saved.ok, true);

  const second = await loadRuntimeState(key, { counter: 0 });
  assert.equal(second.value.counter, 2);
  assert.equal(second.version, saved.version);

  const conflict = await saveRuntimeState(key, { counter: 3 }, first.version);
  assert.equal(conflict.conflict, true);
  process.stdout.write("runtime store integration passed\n");
} finally {
  await deleteRuntimeState(key);
}
