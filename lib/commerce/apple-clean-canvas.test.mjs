import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
const apple = fs.readFileSync(new URL('../../niasave-apple-store.css', import.meta.url), 'utf8');
const wave0 = fs.readFileSync(new URL('../../commerce-wave0.css', import.meta.url), 'utf8');
const wavesCss = fs.readFileSync(new URL('../../commerce-waves.css', import.meta.url), 'utf8');
const waves = fs.readFileSync(new URL('../../commerce-waves.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../../commerce.html', import.meta.url), 'utf8');
const commerceCss = fs.readFileSync(new URL('../../commerce.css', import.meta.url), 'utf8');
const homeFn = fs.readFileSync(new URL('./apple-home.snippet.js', import.meta.url), 'utf8');

const slice = (from, start, end) => {
  const a = from.indexOf(start);
  const b = from.indexOf(end);
  assert.ok(a >= 0 && b > a, `${start} must precede ${end}`);
  return from.slice(a, b);
};

const languageCard = slice(src, 'function languageCard(', 'async function chooseLang');
const saveHero = slice(src, 'function saveHero(', 'function saveAisle(');
const saveHeroAfter = slice(apple, 'body.mesha-dark .mesha-save-hero:before', 'body.mesha-dark .mesha-save-still{');

test('canvas tokens stay white and band; responsive shell stylesheet is last', () => {
  assert.match(apple, /--nia-canvas:#ffffff/);
  assert.match(apple, /--nia-band:#f5f5f7/);
  const lastLink = [...html.matchAll(/href="\/([^"]+\.css)"/g)].map(m => m[1]).at(-1);
  assert.equal(lastLink, 'commerce-shell.css');
});

test('language splash is type on a flat canvas with no photo', () => {
  assert.match(languageCard, /class="mesha-lang"/);
  assert.match(languageCard, /Choose your language/);
  assert.doesNotMatch(languageCard, /<img\b/);
  assert.doesNotMatch(languageCard, /studio-bunk-lockers\.jpg/);
  assert.doesNotMatch(languageCard, /mesha-lang-hero/);
  assert.match(apple, /\.mesha-lang\{[^}]*background:var\(--nia-canvas\)/);
  assert.match(apple, /\.mesha-lang-hero/);
  assert.match(apple, /display:none!important/);
});

test('Save hero has no pictured or gradient background; oils still lives in a contained card', () => {
  assert.match(saveHero, /Keep more\./);
  assert.match(saveHero, /class="mesha-save-still"/);
  assert.match(saveHero, /oils-editorial-sheet\.png/);
  assert.doesNotMatch(saveHeroAfter, /url\(/);
  assert.match(saveHeroAfter, /display:none!important/);
  assert.doesNotMatch(wave0, /url\(/);
  assert.doesNotMatch(wave0, /background:#000/);
  assert.doesNotMatch(wave0, /background:#111/);
  assert.doesNotMatch(commerceCss.match(/\.mesha-save-hero\{[^}]+\}/)?.[0] || '', /url\(/);
  assert.match(apple, /\.mesha-save-still img/);
  assert.match(apple, /border-radius:10px/);
});

test('waves do not paint the collect map under the language splash', () => {
  assert.match(waves, /function langOpen\(/);
  assert.match(waves, /mesha-lang-open/);
  assert.match(waves, /if \(langOpen\(\)\) return;/);
  assert.match(waves, /save-collect-card/);
});

test('collect and send cards are white, not #111', () => {
  assert.match(wavesCss, /background: #ffffff/);
  assert.doesNotMatch(wavesCss, /background: #111/);
  assert.doesNotMatch(wavesCss, /background: #000/);
  assert.match(apple, /\.save-collect-card/);
  assert.match(apple, /background:var\(--nia-card\)/);
});

test('homepage stills stay inside cards; bunk is not a page wallpaper', () => {
  assert.match(homeFn, /nia-home-photo-frame/);
  assert.match(homeFn, /studio-bunk-lockers\.jpg/);
  assert.doesNotMatch(homeFn, /apple-save-unit/);
});
