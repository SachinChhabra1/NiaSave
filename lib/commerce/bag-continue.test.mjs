import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {shopSourceCopy} from '../../commerce-shop-v2.js';
import {callNiaMarkup} from '../../commerce-support.js';
import {SAVE_PAUSED_COPY} from '../../commerce-capabilities.js';
import {setSaveCapabilities, saveCommitmentReady, bagHasUnconfirmedPack, bagPricesMissing, bagContinueReason, BAG_OFFLINE_COPY, BAG_PACK_COPY, BAG_PRICES_COPY} from '../../commerce-truth.js';

const REVIEW = 'The Nia team will confirm the final price before you pay.';
const OTHERS = [BAG_OFFLINE_COPY, SAVE_PAUSED_COPY, BAG_PACK_COPY, BAG_PRICES_COPY];

function renderBag({online, reservations, product, qty = 1}) {
  setSaveCapabilities({saveReservations: reservations});
  const src = fs.readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
  const start = src.indexOf('function bagReasonMarkup(){');
  const end = src.indexOf('function bagLayer()');
  const cart = {[product.id]: qty};
  const fn = new Function(
    'bagContinueReason', 'navigator', 'saveCommitmentReady', 'bagHasUnconfirmedPack', 'cat', 'cart', 'bagPricesMissing', 'esc', 't', 'callNiaMarkup', 'icon', 'NIA_HELP_PHONE', 'owner', 'count', 'bagLine', 'shopSourceCopy',
    src.slice(start, end) + '\nreturn bag();'
  );
  return fn(
    bagContinueReason,
    {onLine: online},
    saveCommitmentReady,
    bagHasUnconfirmedPack,
    {owner: 'niasave', products: [product]},
    cart,
    bagPricesMissing,
    value => String(value ?? ''),
    english => english,
    callNiaMarkup,
    () => '<svg class="icon"></svg>',
    '',
    {active: false},
    () => qty,
    () => '',
    shopSourceCopy
  );
}

function priced(pack = '5 kg', price = 80) {
  return {id: 'rice', name: 'Rice', price, available: 4, pack};
}

function showsOnly(html, line) {
  assert.match(html, new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const other of OTHERS) if (other !== line) assert.doesNotMatch(html, new RegExp(other.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const reason = html.indexOf('mesha-bag-reason');
  const button = html.indexOf('data-action="review"');
  assert.ok(reason >= 0 && reason < button, 'the reason sits above Continue');
  assert.match(html, /class="call-nia"/);
  assert.match(html, />Call Nia</);
  assert.match(html, new RegExp(REVIEW.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('offline shows the offline line and not another reason', () => {
  const html = renderBag({online: false, reservations: true, product: priced()});
  showsOnly(html, BAG_OFFLINE_COPY);
  assert.match(html, /data-action="review" disabled/);
  assert.equal(bagContinueReason({online: false, reservationsReady: true, unconfirmedPack: false, pricesMissing: true}), BAG_OFFLINE_COPY);
});

test('paused reservations show the paused line and not another reason', () => {
  const html = renderBag({online: true, reservations: false, product: priced()});
  showsOnly(html, SAVE_PAUSED_COPY);
  assert.doesNotMatch(html, /data-action="review" disabled/);
  assert.equal(bagContinueReason({online: true, reservationsReady: false, unconfirmedPack: true, pricesMissing: true}), SAVE_PAUSED_COPY);
});

test('an unconfirmed pack shows the pack line and not another reason', () => {
  const html = renderBag({online: true, reservations: true, product: priced('Pack size to be confirmed', 80)});
  showsOnly(html, BAG_PACK_COPY);
  assert.doesNotMatch(html, /data-action="review" disabled/);
  assert.equal(bagContinueReason({online: true, reservationsReady: true, unconfirmedPack: true, pricesMissing: true}), BAG_PACK_COPY);
});

test('a missing price shows the price line and not another reason', () => {
  const html = renderBag({online: true, reservations: true, product: priced('5 kg', 0)});
  showsOnly(html, BAG_PRICES_COPY);
  assert.doesNotMatch(html, /data-action="review" disabled/);
  assert.equal(bagPricesMissing([priced('5 kg', 0)], {rice: 1}), true);
  assert.equal(bagContinueReason({online: true, reservationsReady: true, unconfirmedPack: false, pricesMissing: true}), BAG_PRICES_COPY);
});

test('a priced confirmed bag online shows no reason line', () => {
  const html = renderBag({online: true, reservations: true, product: priced()});
  assert.doesNotMatch(html, /mesha-bag-reason/);
  assert.doesNotMatch(html, /class="call-nia"/);
  for (const line of OTHERS) assert.doesNotMatch(html, new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(html, /data-action="review" disabled/);
  assert.match(html, new RegExp(REVIEW.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(bagPricesMissing([priced()], {rice: 1}), false);
  assert.equal(bagContinueReason({online: true, reservationsReady: true, unconfirmedPack: false, pricesMissing: false}), '');
});
