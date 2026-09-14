import fs from 'node:fs';

const srcPath = 'commerce.js';
const snippet = fs.readFileSync('lib/commerce/apple-home.snippet.js', 'utf8').trim() + '\n';

const required = ['function entryHomepage', 'apple-home', 'apple-unit', 'apple-live-unit', 'apple-save-unit', 'apple-pair', 'studio-bunk-lockers.jpg', "data-action=\"live\"", "data-action=\"shop\"", "A bed near work.", "Keep more."];
for (const token of required) {
  if (!snippet.includes(token)) throw new Error(`apple-home snippet missing ${token}`);
}
if (snippet.includes("[\'shop','save'")) throw new Error('Save belongs in its own unit, not the rail');

const forbidden = /\d+\s*nests|vacanc|open roles|\bUPI\b|pay online|\bwallet\b|Series A|fundraise|OTP|pre-seed|localStorage\.setItem\('nia-language'/i;
if (forbidden.test(snippet)) throw new Error('apple-home snippet contains forbidden homepage copy');

const actions = [...snippet.matchAll(/data-action="([^"]+)"/g)].map(m => m[1]);
const allowed = new Set(['live', 'how-live', 'shop', '${action}']);
for (const action of actions) {
  if (!allowed.has(action)) throw new Error(`homepage action not allowed: ${action}`);
}

const s = fs.readFileSync(srcPath, 'utf8');
const a = s.indexOf('function entryHomepage');
const b = s.indexOf('function render()');
if (a < 0 || b < 0 || a >= b) throw new Error('entryHomepage block missing in commerce.js');
if (s.indexOf('function entryHomepage', a + 1) !== -1 && s.indexOf('function entryHomepage', a + 1) < b) {
  throw new Error('multiple entryHomepage functions in splice window');
}

let out = s.slice(0, a) + snippet + s.slice(b);
const langNeedle = "pickingLang=!languageSticky()&&!owner.active";
const langWide = "pickingLang=!languageSticky()&&!owner.active&&window.matchMedia('(max-width: 760px)').matches";
if (out.includes(langNeedle) && !out.includes(langWide)) {
  out = out.replaceAll(langNeedle, langWide);
}
if (!out.includes(langWide)) throw new Error('desktop must skip the language wall');

if (!out.includes('class=\"mesha-home apple-home\"') || !out.includes('apple-save-unit') || !out.includes('apple-pair')) {
  throw new Error('splice failed to land Live / Save / Earn-Send units');
}
if ((out.match(/function entryHomepage/g) || []).length !== 1) {
  throw new Error('splice must leave exactly one entryHomepage');
}

fs.writeFileSync(srcPath, out);
console.log('spliced Apple home into commerce.js');
