import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ratchetProblems} from '../../tests/ui-clarity/ratchet.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function runRatchet(ref) {
  return spawnSync(process.execPath, ['tests/ui-clarity/ratchet.mjs', ref], {cwd: root, encoding: 'utf8'});
}

const line = (kind, file, string) => ({kind, file, string});

test('dropping one baseline row and adding another is rejected', () => {
  const problems = ratchetProblems({
    baseline: {entries: [line('copy', 'fixture.js', 'Fresh example')]},
    baseBaseline: {entries: [line('copy', 'fixture.js', 'Old example')]},
    gaps: {bn: ['Kept example']},
    baseGaps: {bn: ['Kept example']}
  });
  assert.ok(problems.some(problem => problem.includes('Fresh example')));
});

test('a larger total is rejected when the new row repeats an old one', () => {
  const problems = ratchetProblems({
    baseline: {entries: [line('copy', 'fixture.js', 'Old example'), line('copy', 'fixture.js', 'Old example')]},
    baseBaseline: {entries: [line('copy', 'fixture.js', 'Old example')]},
    gaps: {bn: ['Kept example', 'Kept example']},
    baseGaps: {bn: ['Kept example']}
  });
  assert.ok(problems.some(problem => problem.includes('BASELINE.json grew')));
  assert.ok(problems.some(problem => problem.includes('translation gaps grew')));
});

test('a missing base ref exits non-zero', () => {
  const result = runRatchet('origin/does-not-exist');
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout || '', /no frozen baseline yet/);
  assert.match(result.stderr || '', /does not resolve/);
});

test('a resolved ref with no baseline file establishes the baseline', () => {
  const blob = execFileSync('git', ['rev-parse', '--verify', '--end-of-options', 'HEAD:package.json'], {cwd: root, encoding: 'utf8'}).trim();
  const result = runRatchet(blob);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout || '', /no frozen baseline yet/);
});

test('removing a row without adding one is allowed', () => {
  const problems = ratchetProblems({
    baseline: {entries: []},
    baseBaseline: {entries: [line('font', 'en/360/down/home', 'Example')]},
    gaps: {bn: []},
    baseGaps: {bn: ['Old gap example']}
  });
  assert.deepEqual(problems, []);
});
