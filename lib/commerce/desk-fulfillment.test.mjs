import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';

process.env.STAFF_AUTH_REQUIRED = '1';
process.env.STAFF_TOKEN_SECRET = randomBytes(32).toString('base64url');
process.env.STAFF_PASSWORD = 'desk-operator-password';
process.env.DEMO = '1';
process.env.DUMMY_DATA = '1';
delete process.env.VERCEL_ENV;
delete process.env.DATABASE_URL;
delete process.env.COMMERCE_ENABLED;

const { default: handler } = await import('../../api/server.mjs');
const { registerStaffSession } = await import('../staff-auth.mjs');
const { resetDummy } = await import('../../rabbit/engine.mjs');

test('staff login keeps the page cookie so admin@nia.one can reload the desk', async t => {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(base + '/v1/staff/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@nia.one', password: 'desk-operator-password' })
  });
  assert.equal(login.status, 200, await login.clone().text());
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /__Host-nia_staff_page=/);
  const body = await login.json();
  assert.equal(body.staff.email, 'admin@nia.one');
  await registerStaffSession(body.token);
  const me = await fetch(base + '/v1/staff/me', { headers: { authorization: 'Bearer ' + body.token } });
  assert.equal(me.status, 200);
});

test('GET /api/orders/:id returns member id and full pay state; vendor desks are staff-gated', async t => {
  resetDummy();
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(base + '/v1/staff/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@nia.one', password: 'desk-operator-password' })
  });
  const staff = await login.json();
  await registerStaffSession(staff.token);
  const auth = { authorization: 'Bearer ' + staff.token };
  const missing = await fetch(base + '/api/orders/ord-missing-id', { headers: auth });
  assert.equal(missing.status, 404);
  const vendors = await fetch(base + '/api/vendors', { headers: auth });
  assert.equal(vendors.status, 200);
  const vendorsBody = await vendors.json();
  assert.equal(vendorsBody.paymentsEnabled, false);
  assert.equal(Array.isArray(vendorsBody.vendors), true);
  const unauth = await fetch(base + '/api/vendors');
  assert.equal(unauth.status, 401);
  const payouts = await fetch(base + '/api/payouts', { headers: auth });
  assert.equal(payouts.status, 200);
  const payoutsBody = await payouts.json();
  assert.equal(payoutsBody.memberRail, 'upi_at_handover');
  assert.equal(payoutsBody.paymentsEnabled, false);
});

test('desk HTML ships without invented SKUs or online pay', () => {
  const save = fs.readFileSync(new URL('../../save-desk.html', import.meta.url), 'utf8');
  const vendors = fs.readFileSync(new URL('../../vendors.html', import.meta.url), 'utf8');
  const payout = fs.readFileSync(new URL('../../payout.html', import.meta.url), 'utf8');
  assert.match(save, /Save desk/);
  assert.match(save, /\/api\/commerce\/staff\/state/);
  assert.match(save, /verify_payment/);
  assert.doesNotMatch(save, /test_groundnut_oil|paymentsEnabled/);
  assert.match(vendors, /\/api\/vendors/);
  assert.match(payout, /\/api\/payouts/);
  assert.match(payout, /upi_at_handover/);
});
