import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
process.env.COMMERCE_PREVIEW = '1';
process.env.DATABASE_URL = '';
process.env.NODE_ENV = 'test';
delete process.env.VERCEL;
const { handler } = await import('../../api/server.mjs');
const { resetDummy } = await import('../../rabbit/engine.mjs');
const { TEST_SKU_ID, TEST_PACK, TEST_PRICE } = await import('./test-lane.mjs');

async function request(path, body, cookie = '', headers = {}, method) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  Object.assign(req, {
    url: '/api/commerce' + path,
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers: { host: 'localhost:8787', origin: 'http://localhost:8787', 'content-type': 'application/json', cookie, ...headers },
    socket: { remoteAddress: '127.0.0.1' }
  });
  let code, head, payload;
  const res = { writeHead(status, h) { code = status; head = h; }, end(raw) { payload = JSON.parse(raw); } };
  await handler(req, res);
  return { status: code, headers: head, body: payload };
}

function fresh() {
  const s = resetDummy();
  s.orders = [];
  s.reservations = [];
  s.scans = [];
  s.payments = [];
  s.settlements = [];
  s.ordersById.clear();
  s.ordersByCode.clear();
  s.orderIdsByStop.clear();
  delete s.commerce;
  return s;
}

async function login() {
  const r = await request('/auth/preview', { role: 'member' });
  assert.equal(r.status, 200);
  return r.headers['set-cookie'].split(';')[0];
}

test('guest catalogue hides the test SKU; signed-in member can reserve it with no online payment', async () => {
  fresh();
  const guest = await request('/catalogue');
  assert.equal(guest.status, 200);
  assert.equal(guest.body.preview, true);
  assert.equal(guest.body.onlinePayment, false);
  assert.equal((guest.body.products || []).some(p => p.id === TEST_SKU_ID), false);
  const cookie = await login();
  const cat = await request('/catalogue', undefined, cookie);
  const testSku = cat.body.products.find(p => p.id === TEST_SKU_ID);
  assert.ok(testSku, 'signed-in member sees the test SKU');
  assert.equal(testSku.pack, TEST_PACK);
  assert.ok(testSku.available >= 1);
  assert.equal(cat.body.locations.some(l => l.id === 'S01' && l.name === 'Nia Nest Ompal'), true);
  const guestOil = cat.body.products.find(p => p.id === 'groundnut_oil');
  assert.equal(guestOil.pack, 'Pack size to be confirmed');
  const intent = { locationId: 'S01', fulfillment: 'pickup', lines: [{ id: TEST_SKU_ID, qty: 1 }] };
  const q = await request('/quote', intent, cookie);
  assert.equal(q.status, 200, q.body?.error);
  assert.equal(q.body.amount, TEST_PRICE);
  const created = await request('/orders', { ...intent, fingerprint: q.body.fingerprint }, cookie, { 'idempotency-key': randomUUID() });
  assert.equal(created.status, 201, created.body?.error);
  assert.equal(created.body.status, 'reserved');
  assert.equal(created.body.payStatus, 'unpaid');
  assert.equal(created.body.paid, 0);
  assert.equal(created.body.due, TEST_PRICE);
  assert.equal(created.body.payment, undefined);
  assert.ok(created.body.pickupCode);
  assert.equal(created.body.location.name, 'Nia Nest Ompal');
});

test('same test order: staff queue → pack → ready at Ompal → UPI UTR handover → closed → recon', async () => {
  const s = fresh();
  const cookie = await login();
  const intent = { locationId: 'S01', fulfillment: 'pickup', lines: [{ id: TEST_SKU_ID, qty: 1 }] };
  const q = await request('/quote', intent, cookie);
  const created = await request('/orders', { ...intent, fingerprint: q.body.fingerprint }, cookie, { 'idempotency-key': randomUUID() });
  assert.equal(created.status, 201, created.body?.error);
  const orderId = created.body.id;
  const pickupCode = created.body.pickupCode;
  const desk = await request('/staff/state');
  assert.equal(desk.status, 200, desk.body?.error);
  assert.equal(desk.body.orders.some(o => o.id === orderId), true);
  async function act(action, extra = {}) {
    return request('/staff/action', { orderId, action, ...extra });
  }
  assert.equal((await act('packed')).status, 200);
  assert.equal((await act('loaded')).status, 200);
  const ready = await act('at_stop');
  assert.equal(ready.status, 200);
  assert.equal(ready.body.status, 'at_stop');
  assert.equal(ready.body.location.name, 'Nia Nest Ompal');
  const blocked = await act('collected', { pickupCode });
  assert.equal(blocked.status, 409);
  const utr = '123456789012';
  const pay = await act('verify_payment', { reference: utr, amount: TEST_PRICE, receiptVerified: true });
  assert.equal(pay.status, 200, pay.body?.error);
  assert.equal(pay.body.payStatus, 'verified');
  assert.equal(pay.body.payment.reference, utr);
  const closed = await act('collected', { pickupCode });
  assert.equal(closed.status, 200, closed.body?.error);
  assert.equal(closed.body.status, 'collected');
  assert.equal(closed.body.due, 0);
  const settlement = s.settlements.find(row => row.orderId === orderId);
  assert.ok(settlement);
  assert.equal(settlement.utr, utr);
  assert.equal(settlement.matched, false);
  const recon = await act('reconcile', { note: 'TEST bank statement row 1', statementVerified: true });
  assert.equal(recon.status, 200, recon.body?.error);
  assert.equal(recon.body.payStatus, 'reconciled');
  assert.equal(s.settlements.find(row => row.orderId === orderId).matched, true);
  const memberView = await request('/orders', undefined, cookie);
  const row = memberView.body.orders.find(o => o.id === orderId);
  assert.equal(row.status, 'collected');
  assert.equal(row.payment.reference, utr);
});
