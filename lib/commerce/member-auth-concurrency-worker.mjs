import {Readable} from 'node:stream';
import {parentPort, workerData} from 'node:worker_threads';

const control = new Int32Array(workerData.control);
const stateBytes = new Uint8Array(workerData.state);
const stateKey = process.env.NIA_RUNTIME_STATE_KEY;

function readState() {
  const size = Atomics.load(control, 1);
  return JSON.parse(new TextDecoder().decode(stateBytes.slice(0, size)));
}

function writeState(value) {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  stateBytes.fill(0, 0, encoded.length);
  stateBytes.set(encoded);
  Atomics.store(control, 1, encoded.length);
}

function lock() {
  while (Atomics.compareExchange(control, 2, 0, 1) !== 0) Atomics.wait(control, 2, 1);
}

function unlock() {
  Atomics.store(control, 2, 0);
  Atomics.notify(control, 2);
}

function awaitInitialReadBarrier() {
  const arrived = Atomics.add(control, 3, 1) + 1;
  if (arrived === 2) {
    Atomics.store(control, 4, 1);
    Atomics.notify(control, 4, 2);
    return;
  }
  if (arrived < 2) while (Atomics.load(control, 4) === 0) Atomics.wait(control, 4, 0);
}

const store = await import('../runtime-store.mjs');
store.useSqlClientForTests(async (strings, ...values) => {
  const query = strings.join('$');
  if (query.includes('CREATE TABLE')) return [];
  if (query.includes('SELECT version')) {
    lock();
    try { return [{version: Atomics.load(control, 0)}]; } finally { unlock(); }
  }
  if (query.includes('INSERT INTO')) return [];
  if (query.includes('SELECT state_value')) {
    awaitInitialReadBarrier();
    lock();
    try { return [{state_value: readState(), version: Atomics.load(control, 0)}]; } finally { unlock(); }
  }
  if (query.includes('UPDATE nia_runtime_state')) {
    lock();
    try {
      const expected = Number(values[2]);
      if (expected !== Atomics.load(control, 0)) return [];
      writeState(JSON.parse(values[0]));
      Atomics.add(control, 0, 1);
      return [{version: Atomics.load(control, 0)}];
    } finally { unlock(); }
  }
  throw new Error('unexpected_concurrency_fixture_query');
});

globalThis.fetch = async () => ({
  status: 200,
  json: async () => ({
    source: 'central', status: 'ready',
    member: {id: 'central-member-1', state: 'approved', kyc: 'approved', access: 'active'},
    account: {id: 'central-member-1', role: 'member', authVersion: 'a'.repeat(64), name: 'Central member', locationIds: []}
  })
});

const {commerceHttp} = await import(`./http.mjs?c2-worker=${workerData.id}`);
const body = {phone: '9876543210', password: 'concurrent-valid-password', remember: true};
const req = Readable.from([Buffer.from(JSON.stringify(body))]);
Object.assign(req, {
  method: 'POST', url: '/api/commerce/auth/set-password',
  headers: {host: 'www.nia.test', origin: 'https://www.nia.test', cookie: workerData.cookie},
  socket: {remoteAddress: workerData.id === 1 ? '127.0.0.2' : '127.0.0.3'}
});
let result;
await commerceHttp(req, {
  writeHead(status, headers) { result = {status, headers}; },
  end(raw) { result.body = JSON.parse(raw); }
}, '/auth/set-password', async () => null);

parentPort.postMessage({status: result.status, error: result.body?.error, accountId: result.body?.account?.id});
