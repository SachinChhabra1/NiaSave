import test from 'node:test';
import assert from 'node:assert/strict';
import { SKUS } from '../../rabbit/engine.mjs';
import { packIsConfirmed } from './shop-offer.mjs';
import {
  millPackForSku,
  fulfillmentProducts,
  applyMemberFulfillment,
  staffOrderView
} from './member-fulfillment.mjs';

test('fulfilment uses only frozen SKU ids and prices; packs come from matching mill rows', () => {
  const products = fulfillmentProducts(SKUS);
  assert.equal(products.length, 10);
  assert.deepEqual(products.map(p => p.id).sort(), SKUS.map(s => s.id).sort());
  for (const product of products) {
    const sku = SKUS.find(s => s.id === product.id);
    assert.equal(product.price, sku.nia);
    assert.equal(product.keep, sku.keep);
    assert.equal(product.kirana, sku.kirana);
  }
  assert.equal(millPackForSku(SKUS.find(s => s.id === 'groundnut_oil')), '1 L bottle');
  assert.equal(packIsConfirmed(products.find(p => p.id === 'groundnut_oil')), true);
  assert.equal(packIsConfirmed(products.find(p => p.id === 'essentials_pick')), false);
  assert.doesNotMatch(JSON.stringify(products), /test_groundnut_oil|oil-sunflower-1l/);
});

test("M0 never republishes TEST fulfilment or replenishes stock on reads",()=>{const s={beat:{opening:{groundnut_oil:0},open:false},commerce:{config:null}};const before=structuredClone(s);applyMemberFulfillment(s,Date.now(),SKUS);assert.deepEqual(s,before);});



test('staff-published config is not overwritten by the member fulfilment lane', () => {
  const s = {
    beat: { beatDate: '2026-08-31', open: true, closed: false, opening: { groundnut_oil: 3 } },
    commerce: { config: { verified: true, products: [{ id: 'groundnut_oil', pack: 'staff pack' }], locations: [], memberFulfillment: false } }
  };
  applyMemberFulfillment(s, Date.now(), SKUS);
  assert.equal(s.commerce.config.products[0].pack, 'staff pack');
});



test('staff order view always includes member id and full pay state', () => {
  const view = staffOrderView({
    id: 'ord-1',
    memberId: 'nia-member-phonehash',
    member: 'Nia member',
    status: 'reserved',
    payStatus: 'unpaid',
    amount: 185,
    due: 185,
    paid: 0,
    pickupCode: 'ABC',
    lines: [{ id: 'groundnut_oil', qty: 1, nia: 185 }],
    preview: false
  });
  assert.equal(view.memberId, 'nia-member-phonehash');
  assert.equal(view.payStatus, 'unpaid');
  assert.equal(view.preview, false);
  assert.equal(view.test, false);
});
