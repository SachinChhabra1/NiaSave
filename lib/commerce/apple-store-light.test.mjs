import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../../niasave-apple-store.css', import.meta.url), 'utf8');
const apple = fs.readFileSync(new URL('../../apple-desktop.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../../commerce.html', import.meta.url), 'utf8');
const src = fs.readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
const build = fs.readFileSync(new URL('../../vercel-build.sh', import.meta.url), 'utf8');
const homeFn = fs.readFileSync(new URL('./apple-home.snippet.js', import.meta.url), 'utf8');

test('Apple Store tokens: white canvas, dark ink, blue accent, 18px cards', () => {
  assert.match(css, /--nia-canvas:#ffffff/);
  assert.match(css, /--nia-band:#f5f5f7/);
  assert.match(css, /--nia-ink:#1d1d1f/);
  assert.match(css, /--nia-muted:#6e6e73/);
  assert.match(css, /--nia-accent:#0066cc/);
  assert.match(css, /--nia-radius:18px/);
  assert.match(apple, /rgba\(255,255,255,\.72\)/);
  assert.match(apple, /backdrop-filter:saturate\(180%\) blur\(20px\)/);
  assert.doesNotMatch(css, /background:#000/);
  assert.doesNotMatch(apple, /#0B0B0C/);
});

test('one shared light chrome is linked last and copied to dist', () => {
  assert.match(html, /niasave-apple-store\.css/);
  assert.match(html, /theme-color" content="#f5f5f7"/);
  assert.match(build, /niasave-apple-store\.css/);
  const lastLink = [...html.matchAll(/href="\/([^"]+\.css)"/g)].map(m => m[1]).at(-1);
  assert.equal(lastLink, 'niasave-apple-store.css');
});

test('Save chips are exactly All / Food / Soap / Care', () => {
  assert.match(src, /\['all','food','cleaning','personal-care'\]/);
  assert.match(src, /function savePill\(/);
  assert.match(src, /all:t\('All'/);
  assert.match(src, /food:t\('Food'/);
  assert.match(src, /cleaning:t\('Soap'/);
  assert.match(src, /'personal-care':t\('Care'/);
});

test('homepage copy locks and stills are unchanged', () => {
  assert.match(homeFn, /A Nest near work\./);
  assert.match(homeFn, /Move in with Nia\. Roof, rest, and a short walk to the shift\./);
  assert.match(homeFn, /An upskilled job\./);
  assert.match(homeFn, /Shop at wholesale rates\./);
  assert.match(homeFn, /Money home\./);
  assert.match(homeFn, /studio-bunk-lockers\.jpg/);
  assert.match(apple, /\/assets\/earn\.jpg/);
  assert.match(apple, /\/assets\/send\.jpg/);
  assert.match(apple, /oils-editorial-sheet\.png/);
  assert.doesNotMatch(homeFn, /Extra shifts/);
  assert.doesNotMatch(homeFn, /Shop less/);
});

test('primary nav stays LESS and mesha-dark is the single member shell', () => {
  assert.match(src, /lessName\('Live'/);
  assert.match(src, /lessName\('Earn'/);
  assert.match(src, /lessName\('Save'/);
  assert.match(src, /lessName\('Send'/);
  assert.match(src, /classList\.toggle\('mesha-dark',!pickingLang\)/);
  assert.doesNotMatch(src, /page==='home'\|\|page==='shop'/);
  assert.match(html, /Call for help/);
});
