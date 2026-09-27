import test from 'node:test';
import assert from 'node:assert/strict';
import {ratchetProblems} from '../../tests/ui-clarity/ratchet.mjs';

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

test('removing a row without adding one is allowed', () => {
  const problems = ratchetProblems({
    baseline: {entries: []},
    baseBaseline: {entries: [line('font', 'en/360/down/home', 'Example')]},
    gaps: {bn: []},
    baseGaps: {bn: ['Old gap example']}
  });
  assert.deepEqual(problems, []);
});
