import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('production home splice still has its entry names', () => {
  const snippet = fs.readFileSync(path.join(root, 'lib/commerce/apple-home.snippet.js'), 'utf8').trim();
  const commerce = fs.readFileSync(path.join(root, 'commerce.js'), 'utf8');
  assert.ok(snippet.startsWith('function entryHomepage()'), 'snippet must start with function entryHomepage()');
  assert.ok(snippet.includes('homeDashboardModel('), 'snippet must call homeDashboardModel(');
  assert.ok(snippet.includes('homeDashboardMarkup('), 'snippet must call homeDashboardMarkup(');
  const start = commerce.indexOf('function entryHomepage');
  const end = commerce.indexOf('function render()', start);
  assert.ok(start >= 0 && end > start, 'commerce.js must keep function entryHomepage before function render()');
  const entry = commerce.slice(start, end);
  assert.ok(entry.includes('homeDashboardModel('), 'home entry must call homeDashboardModel(');
  assert.ok(entry.includes('homeDashboardMarkup('), 'home entry must call homeDashboardMarkup(');
});
