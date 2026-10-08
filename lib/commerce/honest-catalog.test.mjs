import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shop = readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../commerce.html', import.meta.url), 'utf8');
const build = readFileSync(new URL('../../vercel-build.sh', import.meta.url), 'utf8');
const server = readFileSync(new URL('../../api/server.mjs', import.meta.url), 'utf8');
const vite = readFileSync(new URL('../../vite.config.js', import.meta.url), 'utf8');

const branded = /Tata Salt|Fortune Sunlite|weeklySavings:\s*126|fever day free/;

test('member storefront does not invent branded SKUs or weekly savings', () => {
  assert.doesNotMatch(shop, branded);
  assert.doesNotMatch(html, branded);
  assert.match(shop, /groundnut-oil|mustard-oil|sunflower-oil/);
});

test('public entry preserves commerce member app and excludes the React P0 catalog', () => {
  assert.match(build, /cp public-home\.html dist\/index\.html/);
  assert.match(build, /cp -f commerce\.html/);
  assert.match(vite, /req\.url = "\/public-home\.html"/);
  assert.doesNotMatch(build, /cp index\.html dist\/index\.html/);
  assert.doesNotMatch(vite, /COMMERCE_STOREFRONT !== "1"/);
});

test('hosted /v1/catalog is 410, not Tata Salt', () => {
  assert.match(server, /members\|catalog/);
  assert.match(server, /process\.env\.VERCEL/);
  assert.match(server, /use_member_storefront/);
});
