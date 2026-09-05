import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { deleteRuntimeState, hasDurableStore } from "./runtime-store.mjs";

if (!hasDurableStore()) {
  process.stdout.write("Polo persistence integration skipped: DATABASE_URL missing\n");
  process.exit(0);
}

const key = "test-polo-" + randomUUID();
process.env.NIA_RUNTIME_STATE_KEY = key;
process.env.NIA_STAFF_STORE_GETS = "1";

const { handleStaff, resetDummy } = await import("../rabbit/engine.mjs");
const req = method => ({ method });
const url = query => new URL("http://local/api/member" + (query || ""));

try {
  const written = await handleStaff(
    req("POST"),
    {},
    "/member/answer",
    { memberId: "persistence-test", tab: "save", qid: "goal", val: "durable" },
    url()
  );
  assert.equal(written.status, 200);

  resetDummy();
  const read = await handleStaff(
    req("GET"),
    {},
    "/member",
    {},
    url("?memberId=persistence-test")
  );
  assert.equal(read.status, 200);
  assert.equal(read.body.answers.length, 1);
  assert.equal(read.body.answers[0].val, "durable");
  assert.equal(read.body.answers[0].qid, "goal");
  process.stdout.write("Polo persistence integration passed\n");
} finally {
  await deleteRuntimeState(key);
}
