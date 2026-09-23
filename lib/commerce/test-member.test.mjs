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
const {TEST_MEMBER, TEST_DESK, TEST_ORDER_IDEMPOTENCY_KEY, testReadSig, verifyTestReadSig, existingTestOrder, testMemberReserveKey} = await import('./test-member.mjs');
const {MEMBER_COOKIE, MEMBER_ACCOUNT} = await import('./member-password.mjs');
const {hash} = await import('./core.mjs');

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

test("M0 closes TEST auto-session and order-creation endpoints",async()=>{const {handler}=await import('../../api/server.mjs');const {Readable}=await import('node:stream');for(const path of ['/api/commerce/test/session','/api/commerce/test/place-one','/api/commerce/test/member-login','/api/commerce/test/staff/login']){const req=Readable.from([]);Object.assign(req,{url:path,method:'GET',headers:{}});let status,body;await handler(req,{writeHead(s){status=s;},end(s){body=JSON.parse(s);}});assert.equal(status,503);assert.equal(body.error,'pilot_commitments_paused');}});







test('real password member is not the TEST member and still needs the password', async () => {
  const denied = await request('/auth/login', {password: 'not-the-member-password'});
  assert.equal(denied.status, 401);
  const ok = await request('/auth/login', {password: fixturePassword});
  assert.equal(ok.status, 200);
  assert.equal(ok.body.account.id, MEMBER_ACCOUNT.id);
  assert.notEqual(ok.body.account.id, TEST_MEMBER.id);
  assert.equal(ok.body.account.test, undefined);
});





test('existingTestOrder ignores finished TEST rows and still returns an in-flight one', () => {
  const row = (id, status, payStatus = 'unpaid') => ({
    id, source: 'commerce', memberId: TEST_MEMBER.id, test: true, status, payStatus
  });
  const finished = {
    orders: [
      row('ord-expired', 'expired'),
      row('ord-cancelled', 'cancelled'),
      row('ord-returned', 'returned', 'refunded'),
      row('ord-missed', 'missed'),
      row('ord-collected', 'collect_at_stop', 'paid'),
      row('ord-delivered', 'delivered', 'reconciled')
    ]
  };
  assert.equal(existingTestOrder(finished), null);
  finished.orders.push(row('ord-live', 'reserved'));
  assert.equal(existingTestOrder(finished).id, 'ord-live');
  finished.orders = [row('ord-expired', 'expired'), row('ord-packed', 'packed')];
  assert.equal(existingTestOrder(finished).id, 'ord-packed');
  finished.orders = [row('ord-paid-in-flight', 'out_for_delivery', 'paid')];
  assert.equal(existingTestOrder(finished).id, 'ord-paid-in-flight');
  finished.orders = [{...row('ord-other', 'expired'), memberId: 'someone-else'}];
  assert.equal(existingTestOrder(finished), null);
});

test('testMemberReserveKey does not replay an idempotency slot that only points at a finished TEST order', () => {
  const expired = {
    id: 'ord-d4d52774-7cfb-46fe-ae58-28fa3d200df2',
    source: 'commerce',
    memberId: TEST_MEMBER.id,
    test: true,
    status: 'expired',
    payStatus: 'unpaid'
  };
  const s = {
    orders: [expired],
    commerce: {
      requests: {
        [hash(TEST_MEMBER.id + ':' + TEST_ORDER_IDEMPOTENCY_KEY)]: {hash: 'old', orderId: expired.id}
      }
    }
  };
  const next = testMemberReserveKey(s, TEST_ORDER_IDEMPOTENCY_KEY);
  assert.notEqual(next, TEST_ORDER_IDEMPOTENCY_KEY);
  assert.match(next, /^[a-zA-Z0-9_-]{16,100}$/);
  assert.equal(testMemberReserveKey(s, TEST_ORDER_IDEMPOTENCY_KEY), next);
  const fresh = {...expired, id: 'ord-fresh', status: 'reserved', payStatus: 'unpaid'};
  s.orders.push(fresh);
  s.commerce.requests[hash(TEST_MEMBER.id + ':' + next)] = {hash: 'new', orderId: fresh.id};
  assert.equal(testMemberReserveKey(s, TEST_ORDER_IDEMPOTENCY_KEY), next);
  assert.equal(existingTestOrder(s).id, 'ord-fresh');
  assert.equal(testMemberReserveKey(s, 'short'), 'short');
});
