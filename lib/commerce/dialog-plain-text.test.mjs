import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {showDMY} from '../../commerce-books.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const samples = ['NEST-2026-09-15-0007', '1800-12-3456', '2026-09-15T04:30:00.000Z'];

function memberSources() {
  return fs.readdirSync(root).filter(name => /^commerce.*\.js$/.test(name)).map(name => ({
    name,
    src: fs.readFileSync(path.join(root, name), 'utf8')
  }));
}

function dateRewrites(src) {
  const regions = [];
  const showAt = src.indexOf('function show(');
  if (showAt >= 0) {
    const end = src.indexOf('\nfunction ', showAt + 10);
    regions.push(src.slice(showAt, end > showAt ? end : src.length));
  }
  if (src.includes('createTreeWalker')) regions.push(src);
  const found = [];
  const re = /\.replace\(\s*\/((?:\\\/|[^/\n])+)\/([gimsuy]*)/g;
  for (const region of regions) {
    let match;
    while ((match = re.exec(region))) {
      if (!match[1].includes('\\d{4}') && !match[1].includes('d{4}')) continue;
      found.push(new RegExp(match[1], match[2]));
    }
  }
  return found;
}

function afterDialog(src, text) {
  let out = text;
  for (const pattern of dateRewrites(src)) out = out.replace(pattern, iso => showDMY(iso) || iso);
  return out;
}

test('dialog text that is not a date on its own comes back unchanged', () => {
  for (const file of memberSources()) {
    for (const sample of samples) {
      assert.equal(afterDialog(file.src, sample), sample, file.name + ' changed ' + sample + ' into ' + afterDialog(file.src, sample));
    }
  }
});
