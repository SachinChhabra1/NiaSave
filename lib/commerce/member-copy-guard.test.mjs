import test from 'node:test';
import assert from 'node:assert/strict';
import {BASELINE_MAX} from '../../tests/ui-clarity/limits.mjs';
import {readBaseline, scanCopyViolations} from '../../tests/ui-clarity/scan.mjs';

function pair(entry) {
  return entry.kind + '\0' + entry.file + '\0' + entry.string;
}

test('member copy stays inside the baseline', () => {
  const baseline = readBaseline();
  assert.ok(Array.isArray(baseline.entries), 'baseline entries must be a list');
  assert.ok(baseline.entries.length <= BASELINE_MAX, 'baseline grew from ' + BASELINE_MAX + ' to ' + baseline.entries.length);
  for (const entry of baseline.entries) {
    assert.equal(typeof entry.file, 'string');
    assert.equal(typeof entry.string, 'string');
    assert.ok(entry.string.length > 0);
  }
  const allowed = new Set(baseline.entries.filter(entry => entry.kind === 'copy').map(pair));
  const fresh = scanCopyViolations().filter(entry => !allowed.has(pair(entry)));
  assert.deepEqual(fresh.map(entry => entry.file + ': ' + entry.string), [], 'new member copy is outside the baseline');
});
