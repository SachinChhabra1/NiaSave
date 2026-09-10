import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomBytes } from "node:crypto";

process.env.STAFF_AUTH_REQUIRED = "1";
process.env.STAFF_PASSWORD = randomBytes(24).toString("base64url");
process.env.JAT_STAFF_PASSWORD = randomBytes(24).toString("base64url");
process.env.STAFF_TOKEN_SECRET = randomBytes(32).toString("base64url");
process.env.STAFF_LOGIN_WINDOW_MS = "60000";
process.env.STAFF_LOGIN_MAX_PER_IP = "100";
process.env.STAFF_LOGIN_MAX_PER_IDENTITY = "2";
process.env.DEMO = "0";
process.env.DUMMY_DATA = "0";
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;

const { default: handler } = await import("./server.mjs");

test("staff login applies per-identity throttling and stable 429 error code", async t => {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const login = async password => fetch(`${base}/v1/staff/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "ajay.mahawar@nia.one", password })
  });

  assert.equal((await login("wrong-pass-1")).status, 401);
  assert.equal((await login("wrong-pass-2")).status, 401);

  const throttled = await login("wrong-pass-3");
  assert.equal(throttled.status, 429);
  assert.equal(throttled.headers.get("retry-after"), "60");
  assert.deepEqual(await throttled.json(), { error: "too_many_attempts" });

  const blockedValid = await login(process.env.JAT_STAFF_PASSWORD);
  assert.equal(blockedValid.status, 429);
});
