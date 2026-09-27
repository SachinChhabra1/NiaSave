import test from 'node:test';
import assert from 'node:assert/strict';
import {GAPS_MAX} from '../../tests/ui-clarity/limits.mjs';
import {gapCount, languages, missingTranslations, readGaps} from '../../tests/ui-clarity/translations.mjs';

test('every member t() line has a translation, apart from the frozen gaps', async () => {
  const saved = readGaps();
  assert.ok(gapCount(saved) <= 553, 'translation gap snapshot grew from 553 to ' + gapCount(saved));
  const missing = await missingTranslations();
  const live = languages.reduce((sum, lang) => sum + missing[lang].length, 0);
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
