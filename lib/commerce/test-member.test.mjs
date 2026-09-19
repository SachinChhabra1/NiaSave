import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomBytes} from 'node:crypto';

const fixturePassword = 'test-member-password';
const fixtureSecret = randomBytes(32).toString('hex');
Object.assign(process.env, {
  DATABASE_URL: 'postgres://test-member-prove.invalid/test',
  NODE_ENV: 'production',
  COMMERCE_ENABLED: '1',
  COMMERCE_MEMBER_AUTH: 'password',
  DUMMY_DATA: '0',
  MEMBER_PASSWORD: fixturePassword,
  SESSION_SECRET: fixtureSecret,
  CENTRAL_ORIGIN: 'https://central.invalid',
  CENTRAL_COMMERCE_KEY: 'k'.repeat(32),
  COMMERCE_IDENTITY_URL: 'https://identity.invalid',
  COMMERCE_IDENTITY_KEY: 'identity-test-key',
  STAFF_PASSWORD: 'staff-password-fixture',
  STAFF_TOKEN_SECRET: randomBytes(32).toString('base64url'),
  STAFF_AUTH_REQUIRED: '1',
  NIA_RUNTIME_STATE_KEY: 'test-member-prove'
});
for (const key of ['SHOWCASE_ENTRY', 'COMMERCE_PREVIEW', 'NIA_SHOWCASE', 'VERCEL', 'VERCEL_ENV']) delete process.env[key];

const store = await import('../runtime-store.mjs');
const rows = new Map();
store.useSqlClientForTests(async (strings, ...values) => {
  const q = strings.join('$'), key = values[0];
  if (q.includes('CREATE TABLE')) return [];
  if (q.includes('SELECT version')) return rows.has(key) ? [{version: rows.get(key).version}] : [];
  if (q.includes('INSERT INTO')) {
    if (rows.has(key)) return [];
    rows.set(key, {state_value: JSON.parse(values[1]), version: 1});
    return [structuredClone(rows.get(key))];
  }
  if (q.includes('SELECT state_value')) return rows.has(key) ? [structuredClone(rows.get(key))] : [];
  if (q.includes('UPDATE nia_runtime_state')) {
    const row = rows.get(values[1]);
    if (!row || row.version !== Number(values[2])) return [];
    row.state_value = JSON.parse(values[0]);
    row.version++;
    return [{version: row.version}];
  }
  throw Error('unexpected_fixture_query');
});

const {commerceHttp} = await import('./http.mjs');
const {TEST_MEMBER, TEST_DESK, testReadSig, verifyTestReadSig} = await import('./test-member.mjs');
const {MEMBER_COOKIE, MEMBER_ACCOUNT} = await import('./member-password.mjs');

const admin = {id:'stf-admin',email:'admin@nia.one',name:'Admin',role:'admin',desks:['studio','hub','money','pilot'],staff:true};

async function request(path, body, {cookie='', origin='https://www.nia.test', headers={}, method, staff=null} = {}) {
  const verb = method || (body === undefined ? 'GET' : 'POST');
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  Object.assign(req, {
    method: verb,
    url: '/api/commerce' + path,
    headers: {host:'www.nia.test', origin, cookie, ...headers},
    socket: {remoteAddress:'127.0.0.1'}
  });
  let result;
  const res = {
    writeHead(status, headers) { result = {status, headers}; },
    end(raw) { result.body = JSON.parse(raw); }
  };
  await commerceHttp(req, res, path.split('?')[0], async () => staff);
  return result;
}

test('unsigned POST /orders still requires a real member; guest packs stay pending', async () => {
  const guest = await request('/catalogue');
  assert.equal(guest.status, 200);
  assert.equal(guest.body.account, null);
  assert.equal(guest.body.products.find(p => p.id === 'groundnut_oil').pack, 'Pack size to be confirmed');
  assert.equal(guest.body.paymentsEnabled, false);
  const blocked = await request('/orders', {locationId:'S01',fulfillment:'pickup',lines:[{id:'groundnut_oil',qty:1}]});
  assert.equal(blocked.status, 401);
  assert.equal(blocked.body.error, 'sign_in_required');
});

test('GET /test/session issues a labelled TEST auto-session without OTP', async () => {
  const session = await request('/test/session');
  assert.equal(session.status, 200);
  assert.equal(session.body.account.id, TEST_MEMBER.id);
  assert.equal(session.body.account.name, 'TEST member');
  assert.equal(session.body.account.test, true);
  assert.match(session.headers['set-cookie'], new RegExp(`^${MEMBER_COOKIE}=`));
  const cookie = session.headers['set-cookie'].split(';')[0];
  const cat = await request('/catalogue', undefined, {cookie});
  assert.equal(cat.status, 200);
  assert.equal(cat.body.account.id, TEST_MEMBER.id);
  assert.equal(cat.body.ready, true);
  const oil = cat.body.products.find(p => p.id === 'groundnut_oil');
  assert.equal(oil.pack, '1 L bottle');
  assert.equal(oil.test, true);
  assert.match(oil.name, /\(TEST\)/);
  assert.equal(cat.body.locations[0].id, 'S01');
  assert.equal(cat.body.paymentsEnabled, false);
});

test('one TEST order is placed through the real reserve path and readable without credentials', async () => {
  const placed = await request('/test/place-one');
  assert.ok([200, 201].includes(placed.status));
  assert.equal(placed.body.test, true);
  assert.equal(placed.body.memberId, TEST_MEMBER.id);
  assert.equal(placed.body.status, 'reserved');
  assert.equal(placed.body.order.payStatus, 'unpaid');
  assert.equal(placed.body.order.paid, 0);
  assert.equal(placed.body.paymentsEnabled, false);
  assert.equal(placed.body.desk.path, TEST_DESK.path);
  assert.equal(placed.body.desk.login, 'admin@nia.one');
  assert.equal(placed.body.via, 'POST /api/commerce/orders');
  assert.equal(placed.body.storage, 'postgres');
  assert.match(placed.body.order.id, /^ord-/);
  assert.equal(placed.body.order.lines[0].id, 'groundnut_oil');
  assert.equal(placed.body.order.lines[0].test, true);
  assert.equal(placed.body.order.location.id, 'S01');
  assert.match(placed.body.order.location.name, /Ompal/);

  const again = await request('/test/place-one');
  assert.equal(again.body.order.id, placed.body.order.id);

  const unsignedMember = await request('/orders/' + placed.body.order.id);
  assert.equal(unsignedMember.status, 401);

  const badSig = await request(`/test/orders/${placed.body.order.id}?sig=forged`);
  assert.equal(badSig.status, 401);

  const proof = await request(placed.body.readPath.replace('/api/commerce', ''));
  assert.equal(proof.status, 200);
  assert.equal(proof.body.memberId, TEST_MEMBER.id);
  assert.equal(proof.body.status, 'reserved');
  assert.equal(proof.body.storage, 'postgres');
  assert.equal(proof.body.order.id, placed.body.order.id);
  assert.equal(verifyTestReadSig(placed.body.order.id, testReadSig(placed.body.order.id)), true);
});

test('TEST cookie can POST /api/commerce/orders for real; second bag is the same order', async () => {
  const session = await request('/test/session');
  const cookie = session.headers['set-cookie'].split(';')[0];
  const cat = await request('/catalogue', undefined, {cookie});
  const oil = cat.body.products.find(p => p.id === 'groundnut_oil');
  assert.ok(oil && oil.test === true);
  const intent = {locationId:'S01', fulfillment:'pickup', lines:[{id:'groundnut_oil', qty:1}]};
  const quote = await request('/quote', intent, {cookie});
  assert.equal(quote.status, 200);
  const first = await request('/orders', {...intent, fingerprint: quote.body.fingerprint}, {cookie, headers:{'idempotency-key':'nia-test-post-order-1'}});
  assert.ok([200, 201].includes(first.status));
  assert.equal(first.body.memberId, TEST_MEMBER.id);
  assert.equal(first.body.test, true);
  assert.equal(first.body.status, 'reserved');
  const second = await request('/orders', {...intent, fingerprint: quote.body.fingerprint}, {cookie, headers:{'idempotency-key':'nia-test-post-order-2'}});
  assert.equal(second.status, 200);
  assert.equal(second.body.id, first.body.id);
});

test('real password member is not the TEST member and still needs the password', async () => {
  const denied = await request('/auth/login', {password: 'not-the-member-password'});
  assert.equal(denied.status, 401);
  const ok = await request('/auth/login', {password: fixturePassword});
  assert.equal(ok.status, 200);
  assert.equal(ok.body.account.id, MEMBER_ACCOUNT.id);
  assert.notEqual(ok.body.account.id, TEST_MEMBER.id);
  assert.equal(ok.body.account.test, undefined);
});

test('admin@nia.one Save desk can see the TEST order and walk reserve→pack→ready→UTR→close→recon', async () => {
  const placed = await request('/test/place-one');
  const id = placed.body.order.id;
  const pickup = placed.body.order.pickupCode;
  const amount = placed.body.order.amount;
  const state = await request('/staff/state', undefined, {staff: admin});
  assert.equal(state.status, 200);
  const seen = state.body.orders.find(o => o.id === id);
  assert.ok(seen);
  assert.equal(seen.memberId, TEST_MEMBER.id);
  assert.equal(seen.test, true);
  assert.equal(seen.status, 'reserved');

  const packed = await request('/staff/action', {orderId:id, action:'packed'}, {staff: admin});
  assert.equal(packed.status, 200);
  assert.equal(packed.body.status, 'packed');
  const loaded = await request('/staff/action', {orderId:id, action:'loaded'}, {staff: admin});
  assert.equal(loaded.body.status, 'loaded');
  const ready = await request('/staff/action', {orderId:id, action:'at_stop'}, {staff: admin});
  assert.equal(ready.body.status, 'at_stop');
  const pay = await request('/staff/action', {orderId:id, action:'verify_payment', reference:'918273645019', amount, receiptVerified:true}, {staff: admin});
  assert.equal(pay.body.payStatus, 'verified');
  const closed = await request('/staff/action', {orderId:id, action:'collected', pickupCode:pickup}, {staff: admin});
  assert.equal(closed.body.status, 'collected');
  const recon = await request('/staff/action', {orderId:id, action:'reconcile', note:'Bank statement matched', statementVerified:true}, {staff: admin});
  assert.equal(recon.body.payStatus, 'reconciled');

  const proof = await request(placed.body.readPath.replace('/api/commerce', ''));
  assert.equal(proof.body.status, 'collected');
  assert.equal(proof.body.order.payStatus, 'reconciled');
  assert.equal(proof.body.storage, 'postgres');
  assert.equal(proof.body.memberId, TEST_MEMBER.id);
});

test('unsigned staff and a forged test-read cannot see real-looking TEST state without the sig', async () => {
  assert.equal((await request('/staff/state')).status, 403);
  const placed = await request('/test/place-one');
  assert.equal((await request('/test/orders/' + placed.body.order.id)).status, 401);
});
