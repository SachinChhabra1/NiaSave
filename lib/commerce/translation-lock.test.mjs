import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GAPS_MAX} from '../../tests/ui-clarity/limits.mjs';
import {gapCount, languages, memberJsFiles, missingTranslations, readGaps} from '../../tests/ui-clarity/translations.mjs';
import {root} from '../../tests/ui-clarity/scan.mjs';
import path from 'node:path';

// Keys inside a template are painted on a screen. Keys that only sit in an
// error map stay dormant, and the frozen allowlist may still excuse those.
function paintedKeys() {
  const keys = new Set();
  for (const name of memberJsFiles()) {
    if (name === 'commerce-owner.js' || name === 'commerce-ops.js') continue;
    const src = fs.readFileSync(path.join(root, name), 'utf8');
    let i = 0;
    while (i < src.length) {
      if (src[i] !== '`') { i += 1; continue; }
      let j = i + 1;
      let body = '';
      while (j < src.length && src[j] !== '`') {
        if (src[j] === '\\') { body += src.slice(j, j + 2); j += 2; continue; }
        body += src[j];
        j += 1;
      }
      const re = /t\(\s*'((?:\\'|[^'])*)'/g;
      let match;
      while ((match = re.exec(body))) keys.add(match[1].replace(/\\'/g, "'"));
      i = j + 1;
    }
  }
  return keys;
}

test('every member t() line has a translation, apart from the frozen gaps', async () => {
  const saved = readGaps();
  const missing = await missingTranslations();
  const live = languages.reduce((sum, lang) => sum + missing[lang].length, 0);
  const excused = languages.reduce((sum, lang) => {
    const known = new Set(saved[lang] || []);
    return sum + missing[lang].filter(key => known.has(key)).length;
  }, 0);
  assert.ok(excused <= GAPS_MAX, 'translation gap snapshot grew from ' + GAPS_MAX + ' to ' + excused);
  assert.ok(live <= GAPS_MAX, 'translation gaps grew from ' + GAPS_MAX + ' to ' + live);
  const fresh = [];
  for (const lang of languages) {
    const known = new Set(saved[lang] || []);
    for (const key of missing[lang]) {
      if (!known.has(key)) fresh.push(lang + ': ' + key);
    }
  }
  assert.deepEqual(fresh, [], 'a member line has no translation');
});

test('a key painted on a member screen has a translation even when the frozen list allows the gap', async () => {
  const missing = await missingTranslations();
  const painted = paintedKeys();
  const hits = [];
  for (const lang of ['hi', 'ta', 'bn', 'kn', 'mr']) {
    for (const key of missing[lang]) {
      if (painted.has(key)) hits.push(lang + ': ' + key);
    }
  }
  assert.deepEqual(hits, []);
});
