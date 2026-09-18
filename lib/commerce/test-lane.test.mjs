import test from 'node:test';
import assert from 'node:assert/strict';
import { publicBrowseProducts } from './core.mjs';
import {
  TEST_SKU, TEST_SKU_ID, TEST_PACK, TEST_OPENING, TEST_PRICE,
  isTestFlagged, guestVisibleProducts, applyTestLane, ompalTestLocation
} from './test-lane.mjs';
import { decorateBrowseProducts } from './shop-waves.mjs';
import { PENDING_PACK } from './shop-offer.mjs';
import { SKUS } from '../../rabbit/engine.mjs';

test('test SKU is on the Save book with a confirmed pack and stock', () => {
  assert.equal(TEST_SKU.test, true);
  assert.equal(TEST_SKU.pack, TEST_PACK);
  assert.equal(TEST_SKU.opening, TEST_OPENING);
  assert.equal(TEST_SKU.nia, TEST_PRICE);
  assert.equal(isTestFlagged(TEST_SKU), true);
  assert.equal(isTestFlagged({ id: 'groundnut_oil' }), false);
});

test('guest catalogue never lists the test SKU, even when pack is confirmed', () => {
  const guest = publicBrowseProducts(SKUS);
  assert.equal(guest.some(p => p.id === TEST_SKU_ID), false);
  assert.equal(guest.some(p => p.test || p.testFlagged), false);
  assert.ok(guest.some(p => p.id === 'groundnut_oil'));
  assert.equal(guest.find(p => p.id === 'groundnut_oil').pack, PENDING_PACK);
  const decorated = decorateBrowseProducts(guest);
  assert.equal(decorated.some(p => p.id === TEST_SKU_ID), false);
  assert.deepEqual(guestVisibleProducts([{ id: TEST_SKU_ID, test: true }, { id: 'groundnut_oil' }]).map(p => p.id), ['groundnut_oil']);
});

test('applyTestLane seeds Ompal + confirmed pack without rewriting guest oils', () => {
  const time = Date.parse('2026-09-18T04:00:00Z');
  const s = {
    beat: { beatDate: '2026-09-18', open: true, closed: false, opening: { groundnut_oil: 80 } },
    commerce: {
      config: {
        products: [{ id: 'groundnut_oil', name: 'Groundnut oil', pack: PENDING_PACK }],
        locations: [{ id: 'S01', name: 'Preview pickup point', modes: ['pickup'], windowStart: new Date(time).toISOString(), windowEnd: new Date(time + 86400000).toISOString() }]
      }
    }
  };
  applyTestLane(s, time, [TEST_SKU]);
  const oil = s.commerce.config.products.find(p => p.id === 'groundnut_oil');
  const testSku = s.commerce.config.products.find(p => p.id === TEST_SKU_ID);
  assert.equal(oil.pack, PENDING_PACK);
  assert.equal(testSku.pack, TEST_PACK);
  assert.equal(testSku.test, true);
  assert.equal(s.beat.opening[TEST_SKU_ID], TEST_OPENING);
  assert.equal(s.commerce.config.locations[0].name, 'Nia Nest Ompal');
  assert.equal(ompalTestLocation(time).id, 'S01');
});
