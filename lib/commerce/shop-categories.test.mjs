import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { publicBrowseProducts } from './core.mjs';
import { SKUS } from '../../rabbit/engine.mjs';
import {
  SHOP_THEATRE,
  SHOP_CATEGORY_TILES,
  TEST_MANUFACTURERS,
  youSave,
  manufacturersFor,
  shopTilesFor,
  millOrderProduct
} from '../../commerce-shop-categories.js';

test('shop tiles are categories with three mills in the member theatre', () => {
  assert.equal(SHOP_THEATRE.id, 'rajputana');
  assert.equal(SHOP_THEATRE.collect, 'Nia Nest Ompal');
  assert.ok(SHOP_CATEGORY_TILES.length >= 6);
  for (const tile of SHOP_CATEGORY_TILES) {
    const mills = TEST_MANUFACTURERS.filter(r => r.category === tile.id && r.theatre === SHOP_THEATRE.id);
    assert.equal(mills.length, 3, tile.id);
    assert.equal(new Set(mills.map(m => m.manufacturer)).size, 3, tile.id);
    assert.ok(mills.every(m => m.test === true));
    assert.ok(mills.every(m => m.pack && m.manufacturer));
  }
  assert.deepEqual(shopTilesFor('food').map(t => t.id), ['groundnut_oil', 'mustard_oil', 'sunflower_oil', 'coconut_oil']);
  assert.deepEqual(shopTilesFor('cleaning').map(t => t.id), ['detergent']);
});

test('you_save is kirana minus nia and never invented', () => {
  assert.equal(youSave({nia_price_inr: 178, kirana_price_inr: 250}), 72);
  assert.equal(youSave({nia_price_inr: 178}), null);
  assert.equal(youSave({kirana_price_inr: 250}), null);
  assert.equal(youSave({nia_price_inr: 200, kirana_price_inr: 180}), null);
  assert.equal(youSave({nia_price_inr: 0, kirana_price_inr: 250}), null);
  assert.equal(youSave({nia_price_inr: 178, kirana_price_inr: 178}), null);
});

test('cheapest mill is the lowest nia in the theatre', () => {
  const rows = manufacturersFor('groundnut_oil', 'rajputana', {includePrices: true});
  assert.equal(rows.length, 3);
  const cheapest = rows.filter(r => r.cheapest);
  assert.equal(cheapest.length, 1);
  assert.equal(cheapest[0].manufacturer, 'Cold-press Tumkur');
  assert.equal(cheapest[0].you_save, 72);
  assert.equal(cheapest[0].nia_price_inr, 178);
  assert.equal(cheapest[0].kirana_price_inr, 250);
});

test('absent prices show the mill with no fake saving', () => {
  const sun = manufacturersFor('sunflower_oil', 'rajputana', {includePrices: true});
  const open = sun.find(r => !Number.isFinite(Number(r.nia_price_inr)));
  assert.ok(open);
  assert.equal(open.manufacturer, 'Local packer · Peenya');
  assert.equal(open.you_save, null);
  assert.equal(open.cheapest, false);
  const paste = manufacturersFor('toothpaste', 'rajputana', {includePrices: true});
  const noKirana = paste.find(r => Number.isFinite(Number(r.nia_price_inr)) && !Number.isFinite(Number(r.kirana_price_inr)));
  assert.ok(noKirana);
  assert.equal(noKirana.you_save, null);
});

test('live guest path strips manufacturer prices', () => {
  const live = manufacturersFor('groundnut_oil', 'rajputana', {includePrices: false});
  assert.equal(live.length, 3);
  for (const row of live) {
    assert.equal(Object.hasOwn(row, 'nia_price_inr'), false);
    assert.equal(Object.hasOwn(row, 'kirana_price_inr'), false);
    assert.equal(row.you_save, null);
    assert.equal(row.cheapest, false);
    assert.equal(row.test, true);
    assert.equal(row.theatre, 'rajputana');
  }
});

test('guest catalogue products never include manufacturer price rows', () => {
  const products = publicBrowseProducts(SKUS);
  assert.ok(products.length >= 1);
  for (const p of products) {
    assert.equal(p.manufacturer, undefined);
    assert.equal(p.nia_price_inr, undefined);
    assert.equal(p.theatre, undefined);
  }
  const millNames = new Set(TEST_MANUFACTURERS.map(r => r.manufacturer));
  assert.equal(products.some(p => millNames.has(p.name)), false);
});

test('commerce shop opens an aisle of manufacturers, not a product rail', () => {
  const src = fs.readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../../commerce.html', import.meta.url), 'utf8');
  const i18n = fs.readFileSync(new URL('../../commerce-i18n.js', import.meta.url), 'utf8');
  assert.match(src, /data-action="open-aisle"/);
  assert.match(src, /data-action="close-aisle"/);
  assert.match(src, /data-action="open-buy"/);
  assert.match(src, /function millCard\(/);
  assert.match(src, /function saveAisle\(/);
  assert.match(src, /function saveMakers\(/);
  assert.doesNotMatch(src, /function saveFeatured\(/);
  assert.match(src, /if\(action==='shop-hero'\)\{category='food'/);
  assert.doesNotMatch(html, /Call for help/);
  assert.doesNotMatch(html, /class="nia-help"/);
  assert.match(i18n, /\{id:'en', label:'English'\}/);
  assert.match(i18n, /\{id:'hi', label:'हिन्दी'\}/);
  assert.match(i18n, /\{id:'ta', label:'தமிழ்'\}/);
  assert.match(i18n, /\{id:'bn', label:'বাংলা'\}/);
  assert.doesNotMatch(i18n, /id:'kn'/);
});

test('mill cards map only to frozen SKUs whose pack already matches', () => {
  const ghani = TEST_MANUFACTURERS.find(r => r.manufacturer === 'Ghani · Raichur' && r.category === 'groundnut_oil');
  const tumkur = TEST_MANUFACTURERS.find(r => r.manufacturer === 'Cold-press Tumkur' && r.category === 'groundnut_oil');
  const ready = [{ id: 'groundnut_oil', pack: '1 L bottle', price: 185, test: true }];
  const pending = [{ id: 'groundnut_oil', pack: 'Pack size to be confirmed', price: 185 }];
  assert.equal(millOrderProduct(ghani, ready)?.id, 'groundnut_oil');
  assert.equal(millOrderProduct(tumkur, ready), null);
  assert.equal(millOrderProduct(ghani, pending), null);
  assert.doesNotMatch(JSON.stringify(ready), /test_groundnut_oil/);
});
