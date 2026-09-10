import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {overlaySafeErrors} from './overlay-safe-errors.mjs';

test('archived API overlay changes only error handling and rejects an unknown layout', async t => {
  const out = await mkdtemp(join(tmpdir(), 'nia-safe-errors-'));
  t.after(() => rm(out, {recursive:true, force:true}));
  await mkdir(join(out, 'api'));
  const file = join(out, 'api/server.mjs');
  const lines = [
    'const DATABASE_URL = process.env.DATABASE_URL;',
    'console.error("member_state_load_failed", { path, message: error.message });',
    'console.error("server_error", { path, method: req.method, message: err && err.message, stack: err && err.stack });',
    'if (!saved.ok) console.error("member_state_conflict", { path, version: memberStateVersion });',
    'console.error("member_state_save_failed", { path, message: error.message });',
    'if (err.message === "invalid_json") return json(res, 400, { error: "invalid_json" });',
  ];
  await writeFile(file, lines.join('\n'));
  await overlaySafeErrors(out);
  const fixed = await readFile(file, 'utf8');
  assert.equal(fixed, [lines[0], 'console.error("member_state_load_failed");', 'console.error("server_error");',
    'if (!saved.ok) console.error("member_state_conflict");', 'console.error("member_state_save_failed");',
    lines[5].replace('err.message', 'err?.message')].join('\n'));
  await writeFile(file, lines.slice(1).join('\n').replace('"server_error"', '"new_layout"'));
  const before = await readFile(file, 'utf8');
  await assert.rejects(overlaySafeErrors(out), /Archived error log changed/);
  assert.equal(await readFile(file, 'utf8'), before);
});

