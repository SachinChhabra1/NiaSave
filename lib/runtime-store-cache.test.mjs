import test from 'node:test';
import assert from 'node:assert/strict';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://runtime-store-cache-test';
const store = await import('./runtime-store.mjs');

// A fake Postgres: one table, and a log of every statement with the bytes it moved.
function fakeDb() {
  const rows = new Map(); const log = [];
  const sql = (strings, ...values) => {
    const text = strings.join('$');
    const [key, encoded] = values;
    if (/CREATE TABLE/.test(text)) { log.push({ kind: 'schema', bytes: 0 }); return Promise.resolve([]); }
    if (/^\s*SELECT version(, updated_at)?\s+FROM/.test(text)) { const r = rows.get(key); log.push({ kind: 'version', bytes: 8 }); return Promise.resolve(r ? [{ version: String(r.version), updated_at: '2026-09-09T00:00:00Z' }] : []); }
    if (/INSERT INTO/.test(text)) { if (rows.has(key)) { log.push({ kind: 'insert-noop', bytes: encoded.length }); return Promise.resolve([]); } rows.set(key, { value: JSON.parse(encoded), version: 1 }); log.push({ kind: 'insert', bytes: encoded.length }); return Promise.resolve([{ state_value: rows.get(key).value, version: '1' }]); }
    if (/SELECT state_value, version/.test(text)) { const r = rows.get(key); log.push({ kind: 'load', bytes: JSON.stringify(r.value).length }); return Promise.resolve([{ state_value: r.value, version: String(r.version) }]); }
    if (/UPDATE nia_runtime_state/.test(text)) { const [k, enc, expected] = [values[1], values[0], values[2]]; const r = rows.get(k); log.push({ kind: 'save', bytes: enc.length }); if (!r || r.version !== Number(expected)) return Promise.resolve([]); r.value = JSON.parse(enc); r.version += 1; return Promise.resolve([{ version: String(r.version) }]); }
    if (/DELETE FROM/.test(text)) { rows.delete(key); log.push({ kind: 'delete', bytes: 0 }); return Promise.resolve([]); }
    throw new Error('unexpected statement: ' + text);
  };
  return { sql, rows, log, bytes: kind => log.filter(l => !kind || l.kind === kind).reduce((n, l) => n + l.bytes, 0) };
}

test('a warm instance re-reads only the version until the book changes; saves still compare-and-swap', async () => {
  const db = fakeDb(); store.useSqlClientForTests(db.sql);
  const big = { members: Array.from({ length: 2000 }, (_, i) => ({ id: 'm' + i, name: 'Member ' + i, phone: '9' + String(i).padStart(9, '0') })) };
  const first = await store.loadRuntimeState('operation-bison', big);
  assert.equal(first.storage, 'postgres'); assert.equal(first.version, 1);
  const afterFirst = db.bytes();
  // Sixty polls of an unchanged book cost sixty version reads, not sixty book downloads.
  for (let i = 0; i < 60; i += 1) { const again = await store.loadRuntimeState('operation-bison', {}); assert.equal(again.version, 1); assert.equal(again.cached, true); assert.equal(again.value.members.length, 2000); }
  assert.equal(db.bytes() - afterFirst, 60 * 8);
  assert.equal(db.log.filter(l => l.kind === 'load').length, 0);
  // Returned values are copies: mutating a result never corrupts the cache.
  const copy = await store.loadRuntimeState('operation-bison', {}); copy.value.members.length = 0;
  assert.equal((await store.loadRuntimeState('operation-bison', {})).value.members.length, 2000);
  // A save advances the version and refreshes the cache without a re-read.
  const saved = await store.saveRuntimeState('operation-bison', { ...big, asOf: '2026-09-09' }, 1);
  assert.equal(saved.ok, true); assert.equal(saved.version, 2);
  const next = await store.loadRuntimeState('operation-bison', {});
  assert.equal(next.version, 2); assert.equal(next.cached, true); assert.equal(next.value.asOf, '2026-09-09');
  // Another instance moved the book: the version differs, so the blob is fetched once, then cached again.
  db.rows.get('operation-bison').version = 3; db.rows.get('operation-bison').value = { ...big, asOf: 'elsewhere' };
  const moved = await store.loadRuntimeState('operation-bison', {});
  assert.equal(moved.version, 3); assert.equal(moved.cached, undefined); assert.equal(moved.value.asOf, 'elsewhere');
  assert.equal((await store.loadRuntimeState('operation-bison', {})).cached, true);
  // A stale expected version is rejected and drops the cache so the next read re-fetches.
  const conflict = await store.saveRuntimeState('operation-bison', big, 2);
  assert.equal(conflict.conflict, true);
  assert.equal((await store.loadRuntimeState('operation-bison', {})).cached, undefined);
  // Status probes never move the book.
  const before = db.bytes('load'); const status = await store.storageStatus('operation-bison');
  assert.equal(status.connected, true); assert.equal(status.version, 3); assert.equal(db.bytes('load'), before);
  await store.deleteRuntimeState('operation-bison');
  assert.equal((await store.loadRuntimeState('operation-bison', { fresh: true })).value.fresh, true);
});
