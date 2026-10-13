import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {BASELINE_MAX} from '../../tests/ui-clarity/limits.mjs';
import {copyCovers, hasBannedWord, readBaseline, root, scanCopyViolations, textRuns} from '../../tests/ui-clarity/scan.mjs';

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

test('each language resolves the shell line, and textbook words are Hindi only', async () => {
  const key = 'Your information is up to date.';
  for (const lang of ['bn', 'hi', 'kn', 'mr', 'ta']) {
    const dict = (await import(pathToFileURL(path.join(root, 'commerce-locales', lang + '.js')).href)).default;
    const value = dict[key];
    assert.equal(typeof value, 'string', lang);
    assert.ok(value.trim(), lang);
    assert.notEqual(value, key, lang);
    assert.equal(hasBannedWord(value, 'commerce-locales/' + lang + '.js'), false, lang + ': ' + value);
  }
  assert.equal(hasBannedWord('सक्रिय', 'commerce-locales/hi.js'), true);
  assert.equal(hasBannedWord('விண்ணப்பம்', 'commerce-locales/ta.js'), false);
  assert.equal(hasBannedWord('সেন্ট্রাল', 'commerce-locales/bn.js'), true);
});

test('banned stems catch plural and past forms and skip unrelated words', () => {
  for (const word of ['sources', 'supplies', 'supplied', 'supply', 'supplying', 'published', 'publishing', 'catalogue', 'catalogues', 'cataloguing', 'source', 'sourced', 'sourcing', 'central', 'projection', 'projections']) {
    assert.equal(hasBannedWord(word), true, word);
  }
  for (const word of ['resources', 'resource', 'supple', 'supplement', 'supplier', 'publisher', 'catalog', 'support', 'surprise']) {
    assert.equal(hasBannedWord(word), false, word);
    assert.equal(hasBannedWord('A ' + word + ' line'), false, word);
  }
});

test('copy coverage needs a complete visible run on the same screen', () => {
  const entries = readBaseline().entries;
  assert.equal(entries.length, 0);
  assert.equal(copyCovers('Source', entries), false);
  assert.equal(copyCovers('Source', entries, 'home'), false);
  assert.equal(copyCovers('Source', entries, 'shop'), false);
  assert.equal(copyCovers('Source', entries, 'live'), false);
  assert.equal(copyCovers('Source', entries, 'earn'), false);
  assert.equal(copyCovers('Source', entries, 'send'), false);
  assert.equal(copyCovers('Catalogue synced', entries, 'home'), false);
  assert.equal(copyCovers('Catalogue synced', entries, 'shop'), false);
  assert.equal(copyCovers('Catalogue synced', entries, 'send'), false);
  assert.equal(copyCovers('Central', entries, 'home'), false);
  assert.equal(copyCovers('Central details missing', entries, 'home'), false);
  assert.equal(copyCovers('Central details missing', entries, 'shop'), false);
  assert.equal(copyCovers('published', entries, 'shop'), false);
  const blob = {kind: 'copy', file: 'commerce.js', string: '<p>Browse published essentials and prices.</p>', screen: 'shop', rule: 'banned'};
  const run = textRuns(blob.string).find(item => item.includes('Browse published'));
  const scoped = [blob];
  assert.equal(copyCovers(run, scoped, 'shop'), true);
  assert.equal(copyCovers(run, scoped, 'home'), false);
  assert.equal(copyCovers('published', scoped, 'shop'), false);
  assert.equal(copyCovers(run, entries, 'shop'), false);
});
