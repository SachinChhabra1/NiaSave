import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import handler, { issueStaffToken, verifyStaffToken } from "./server.mjs";

const admin = { id: "stf-admin", email: "admin@nia.one", name: "Admin", role: "admin", desks: ["studio", "hub", "money", "pilot"] };

test("staff tokens are signed, time-limited and tamper-evident", () => {
  const issuedAt = Date.parse("2026-09-02T00:00:00Z");
  const token = issueStaffToken(admin, issuedAt);
  assert.equal(verifyStaffToken(token, issuedAt + 1000).email, admin.email);
  assert.equal(verifyStaffToken(token + "x", issuedAt + 1000), null);
  assert.equal(verifyStaffToken(token, issuedAt + 13 * 60 * 60 * 1000), null);
});

test("Bison and Polo desk APIs require a 2 Para staff token", async t => {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const deniedBison = await fetch(`${base}/api/bison/tower`);
  assert.equal(deniedBison.status, 401);
  const deniedPolo = await fetch(`${base}/api/tower`);
  assert.equal(deniedPolo.status, 401);
  const token = issueStaffToken(admin);
  const allowed = await fetch(`${base}/api/bison/tower`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(allowed.status, 200);
  const body = await allowed.json();
  assert.equal(body.kpis.studios, 56);
  assert.equal(body.reconciliation.ok, true);
});
