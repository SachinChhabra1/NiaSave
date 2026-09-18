import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CATALOGUE_SKU_CAP,
  PENDING_PACK,
  COLLECT_HINT,
  shopVisibleProduct,
  enforceCatalogueCap,
  browseOfferFields,
  packIsConfirmed,
  canReserveProduct
} from './shop-offer.mjs';
import { publicBrowseProducts } from './core.mjs';

const commerce = fs.readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../../commerce.html', import.meta.url), 'utf8');

test('catalogue cap is 200, not a fill target', () => {
  assert.equal(CATALOGUE_SKU_CAP, 200);
  assert.doesNotThrow(() => enforceCatalogueCap(Array.from({ length: 200 }, (_, i) => ({ id: 'sku-' + i }))));
  assert.throws(() => enforceCatalogueCap(Array.from({ length: 201 }, (_, i) => ({ id: 'sku-' + i }))), /catalogue_cap_200/);
  assert.throws(() => enforceCatalogueCap([]), /invalid_products/);
});

test('shop hides OOS and keeps unstamped in-stock SKUs', () => {
  assert.equal(shopVisibleProduct({ id: 'groundnut_oil', available: 8 }), true);
  assert.equal(shopVisibleProduct({ id: 'groundnut_oil', available: 0 }), false);
  assert.equal(shopVisibleProduct({ id: 'groundnut_oil', available: 3, sourceSku: null }), true);
  assert.equal(shopVisibleProduct({ id: '' }), false);
});

test('browse fields do not invent packs or Central source IDs', () => {
  const fields = browseOfferFields({ id: 'groundnut_oil' });
  assert.equal(fields.pack, PENDING_PACK);
  assert.equal(fields.photo, null);
  assert.equal(fields.sourceSku, null);
  assert.equal(fields.sourceSiteCode, null);
  assert.deepEqual(fields.locationIds, []);
  assert.equal(fields.collectHint.id, 'S01');
  assert.equal(COLLECT_HINT.theatre, 'rajputana');
});

test('guest browse still lists the current 10 and keeps payments off the contract', () => {
  const skus = [
    { id: 'groundnut_oil', nia: 185, keep: 75, kirana: 255, opening: 80 },
    { id: 'mustard_oil', nia: 155, keep: 70, kirana: 225, opening: 80 }
  ];
  const products = publicBrowseProducts(skus);
  assert.equal(products.length, 2);
  assert.equal(products[0].pack, PENDING_PACK);
  assert.equal(products[0].available, 80);
  assert.equal(products[0].sourceSku ?? null, null);
});

test('Save photo and hero actions stay on shop in commerce.js', () => {
  assert.match(commerce, /data-action="detail"/);
  assert.match(commerce, /data-action="shop-hero"/);
  assert.match(commerce, /function go\(/);
  assert.doesNotMatch(commerce, /if\(action==='detail'\)[^;]*go\('home'\)/);
  assert.match(commerce, /if\(action==='shop-hero'\)\{category='ration'/);
});

test('Wave 0 does not flip payment or invent a gateway', () => {
  assert.match(html, /commerce.js/);
  assert.doesNotMatch(commerce, /paymentsEnabled\s*=\s*true/);
  assert.match(commerce, /Pay at pickup/);
});

test('unknown pack is listed but not reservable', () => {
  const pending = { id: 'groundnut_oil', pack: PENDING_PACK, price: 185, available: 80 };
  const missing = { id: 'groundnut_oil', price: 185, available: 80 };
  const confirmed = { id: 'groundnut_oil', pack: '1 L bottle', price: 185, available: 80 };
  assert.equal(shopVisibleProduct(pending), true);
  assert.equal(packIsConfirmed(pending), false);
  assert.equal(packIsConfirmed(missing), false);
  assert.equal(packIsConfirmed(confirmed), true);
  assert.equal(canReserveProduct(pending), false);
  assert.equal(canReserveProduct(missing), false);
  assert.equal(canReserveProduct(confirmed), true);
  assert.equal(canReserveProduct({ id: 'groundnut_oil', pack: '1 L bottle', price: 185, available: 0 }), false);
  assert.equal(canReserveProduct({ id: 'groundnut_oil', pack: '1 L bottle', nia: 185, available: 8 }), true);
});
