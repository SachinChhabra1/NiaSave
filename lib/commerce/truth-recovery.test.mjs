import test from 'node:test';
import assert from 'node:assert/strict';
import { PENDING_PACK, COLLECT_HINT } from './shop-offer.mjs';
import {
  recoveryCopy,
  moneyJourneyCopy,
  lessNavCopy,
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

test('Send stays planning-only and does not move money', () => {
  const money = moneyJourneyCopy();
  assert.equal(money.nav, 'Send');
  assert.equal(money.transferStatus, 'Transfers not active');
  assert.equal(money.planningOnly, true);
  assert.equal(money.transfersEnabled, false);
  assert.equal(money.paymentsEnabled, false);
  assert.match(money.planning, /Money does not move/);
  assert.doesNotMatch(money.planning, /estimate not a transfer/i);
});

test('LESS primary nav is Live Earn Save Send', () => {
  const nav = lessNavCopy();
  assert.deepEqual([nav.live.brand, nav.earn.brand, nav.shop.brand, nav.send.brand], ['Live', 'Earn', 'Save', 'Send']);
  assert.deepEqual([nav.live.hash, nav.earn.hash, nav.shop.hash, nav.send.hash], ['live', 'earn', 'shop', 'send']);
  assert.match(nav.live.descriptor, /stay/i);
  assert.match(nav.earn.descriptor, /job/i);
  assert.match(nav.shop.descriptor, /essential/i);
  assert.match(nav.send.descriptor, /money/i);
});

test('fulfillment stays collect-from-point unless a live location offers delivery', () => {
  const collect = fulfillmentCopy({ collectHint: COLLECT_HINT }, { modes: ['pickup', 'delivery'], preview: true });
  assert.equal(collect.method, 'collect');
  assert.match(collect.label, /Collect at Nia Nest Ompal/);
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

import fs from 'node:fs';
const commerceSrc = fs.readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
test('LESS primary nav stays Live Earn Save Send', () => {
  assert.match(commerceSrc, /lessName\('Live'/);
  assert.match(commerceSrc, /lessName\('Earn'/);
  assert.match(commerceSrc, /lessName\('Save'/);
  assert.match(commerceSrc, /lessName\('Send'/);
  assert.doesNotMatch(commerceSrc, /send:t\('My money'/);
  assert.match(commerceSrc, /Transfers not active/);
  assert.doesNotMatch(commerceSrc, /from '\.\/lib\/commerce\//);
  assert.match(commerceSrc, /Please sign in again\. Your bag is still here\./);
  assert.match(commerceSrc, /Collect at Nia Nest Ompal/);
  assert.match(commerceSrc, /Pay when you collect/);
  assert.doesNotMatch(commerceSrc, /Pay at pickup or delivery/);
  assert.doesNotMatch(commerceSrc, /collect point|pickup window|doorstep|10-minute|estimate not a transfer/);
  assert.match(commerceSrc, /function earnErrorPanel/);
  assert.doesNotMatch(commerceSrc, /earnError\?`<p class="info" role="status">\$\{esc\(earnError\)\}/);
});
