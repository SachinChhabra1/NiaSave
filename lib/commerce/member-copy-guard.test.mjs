import test from 'node:test';
import assert from 'node:assert/strict';
import {BASELINE_MAX} from '../../tests/ui-clarity/limits.mjs';
import {copyCovers, readBaseline, scanCopyViolations, textRuns} from '../../tests/ui-clarity/scan.mjs';

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
  const files = new Set(scanCopyViolations().map(entry => entry.file));
  assert.equal(files.has('commerce-owner.js'), false);
  assert.equal(files.has('commerce-ops.js'), false);
});

test('a translated line of a flagged English key is scanned in its own file', () => {
  const found = scanCopyViolations();
  assert.ok(found.some(entry => entry.file === 'commerce-locales/member-updates/kn.js' && entry.string.includes('ಸೆಂಟ್ರಲ್')));
  assert.ok(found.some(entry => entry.file === 'commerce-locales/hi.js' && entry.string === 'सामान की जानकारी उपलब्ध नहीं है'));
  assert.ok(found.some(entry => entry.file === 'commerce-locales/mr.js' && entry.string === 'या खात्यावरून फक्त सूची पाहता येते.'));
});

test('copy coverage needs a complete visible run', () => {
  const entries = readBaseline().entries;
  assert.equal(copyCovers('Central', entries), false);
  assert.equal(copyCovers('Checking Central updates', entries), true);
  const blob = entries.find(entry => entry.kind === 'copy' && entry.string.includes('<p>Browse published'));
  assert.ok(blob, 'an HTML copy line is still in the baseline');
  const run = textRuns(blob.string).find(item => item.includes('Browse published'));
  assert.equal(copyCovers(run, entries), true);
  assert.equal(copyCovers('published', entries), false);
});
