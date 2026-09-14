import fs from 'node:fs';

const srcPath = 'commerce.js';
const snippet = fs.readFileSync('lib/commerce/apple-home.snippet.js', 'utf8').trim() + '\n';

const required = ['function entryHomepage', 'apple-home', 'apple-unit', 'apple-live-unit', 'apple-save-unit', 'apple-pair', 'studio-bunk-lockers.jpg', 'data-action="live"', 'data-action="shop"', 'A bed near work.', 'Keep more.'];
for (const token of required) {
  if (!snippet.includes(token)) throw new Error('apple-home snippet missing ' + token);
}
if (snippet.includes("[\'shop','save'")) {
  // placeholder replaced below
}
