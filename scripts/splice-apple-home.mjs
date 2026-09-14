import fs from 'node:fs';

const srcPath = 'commerce.js';
const snippet = fs.readFileSync('lib/commerce/apple-home.snippet.js', 'utf8');
if (!snippet.includes('apple-home') || !snippet.includes('apple-save-unit')) {
  throw new Error('apple-home snippet missing required units');
}
const s = fs.readFileSync(srcPath, 'utf8');
const a = s.indexOf('function entryHomepage');
const b = s.indexOf('function render()');
if (a < 0 || b < 0) throw new Error('entryHomepage block missing in commerce.js');
fs.writeFileSync(srcPath, s.slice(0, a) + snippet + s.slice(b));
console.log('spliced Apple home into commerce.js');
