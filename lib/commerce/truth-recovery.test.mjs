import test from 'node:test';
import assert from 'node:assert/strict';
import { PENDING_PACK, COLLECT_HINT } from './shop-offer.mjs';
import {
  recoveryCopy,
  moneyJourneyCopy,
  fulfillmentCopy,
  bagHasUnconfirmedPack,
  packIsConfirmed,
  canReserveProduct
} from './truth-recovery.mjs';

test('Live and Earn recovery never use bag language', () => {
  for (const state of ['loading', 'empty', 'network', 'signedOut', 'expired', 'personal', 'unavailable']) {
    const live = recoveryCopy('live', state);
    const earn = recoveryCopy('earn', state);
    if (live) assert.doesNotMatch(live, /bag/i);
    if (earn) assert.doesNotMatch(earn, /bag/i);
  }
  assert.match(recoveryCopy('shop', 'signedOut'), /bag/i);
  assert.equal(recoveryCopy('live', 'expired'), 'Please sign in again to continue.');
  assert.equal(recoveryCopy('live', 'network'), 'We couldn’t load places. Please try again.');
  assert.equal(recoveryCopy('earn', 'unavailable'), 'Open jobs are being connected');
});

test('My money stays planning-only and does not move money', () => {
  const money = moneyJourneyCopy();
  assert.equal(money.nav, 'My money');
  assert.equal(money.transferStatus, 'Not active yet');
  assert.equal(money.planningOnly, true);
  assert.equal(money.transfersEnabled, false);
  assert.equal(money.paymentsEnabled, false);
  assert.match(money.planning, /not a transfer/i);
});

test('fulfillment stays collect-from-point unless a live location offers delivery', () => {
  const collect = fulfillmentCopy({ collectHint: COLLECT_HINT }, { modes: ['pickup', 'delivery'], preview: true });
  assert.equal(collect.method, 'collect');
  assert.match(collect.label, /Collect from Nia Nest Ompal/);
  const liveDelivery = fulfillmentCopy({}, { name: 'Listed member stop', modes: ['pickup', 'delivery'], preview: false });
  assert.equal(liveDelivery.method, 'delivery');
});

test('unconfirmed pack cannot reserve and blocks checkout of an existing bag line', () => {
  const pending = { id: 'groundnut_oil', pack: PENDING_PACK, price: 185, available: 80 };
  const confirmed = { id: 'mustard_oil', pack: '1 L bottle', price: 155, available: 80 };
  assert.equal(packIsConfirmed(pending), false);
  assert.equal(canReserveProduct(pending), false);
  assert.equal(canReserveProduct(confirmed), true);
  assert.equal(bagHasUnconfirmedPack([pending, confirmed], { groundnut_oil: 1 }), true);
  assert.equal(bagHasUnconfirmedPack([pending, confirmed], { mustard_oil: 1 }), false);
});
