import fs from 'node:fs';

const srcPath = 'commerce.js';
const snippet = fs.readFileSync('lib/commerce/apple-home.snippet.js', 'utf8').trim() + '\n';

const required = ['function entryHomepage', 'apple-home', 'apple-unit', 'apple-save-unit', 'apple-pair', 'studio-bunk-lockers.jpg', "data-action=\"live\"", "data-action=\"shop\"", "A bed near work.", "Keep more."];
for (const token of required) {
  if (!snippet.includes(token)) throw new Error(`apple-home snippet missing ${token}`);
}

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

const out = s.slice(0, a) + snippet + s.slice(b);
if (!out.includes('class="mesha-home apple-home"') || !out.includes('apple-save-unit')) {
  throw new Error('splice failed to land Apple units');
}
if ((out.match(/function entryHomepage/g) || []).length !== 1) {
  throw new Error('splice must leave exactly one entryHomepage');
}

fs.writeFileSync(srcPath, out);
console.log('spliced Apple home into commerce.js');
