import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const script = path.join(root, 'tests/ui-guards/hold-check.mjs');

function run(env) {
  return execFileSync(process.execPath, [script], {env: {...process.env, ...env}, encoding: 'utf8'});
}

test('a pull request without a hold passes', () => {
  const output = run({PR_NUMBER: '4242', PR_LABELS: 'ready'});
  assert.match(output, /No hold on PR 4242/);
});

test('the hold label fails the guard', () => {
  assert.throws(() => run({PR_NUMBER: '4242', PR_LABELS: 'hold'}), /hold label/);
});

test('a PR number listed in HOLDS.md fails the guard', () => {
  const file = path.join(os.tmpdir(), 'holds-' + process.pid + '.md');
  fs.writeFileSync(file, '# Holds\n\nPR 77\n');
  try {
    assert.throws(() => run({PR_NUMBER: '77', PR_LABELS: '', HOLDS_PATH: file}), /lists PR 77/);
    const ok = run({PR_NUMBER: '78', PR_LABELS: '', HOLDS_PATH: file});
    assert.match(ok, /No hold on PR 78/);
  } finally {
    fs.rmSync(file, {force: true});
  }
});
