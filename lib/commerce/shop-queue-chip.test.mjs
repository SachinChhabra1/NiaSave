import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {moneyStatusMarkup} from '../../commerce-money-status.js';

// shop() paints the member Shop and is not exported. Run that function.
const src = fs.readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
const start = src.indexOf('function shop(){');
const end = src.indexOf('function showBuy(');
const shopSrc = src.slice(start, end);
if (!shopSrc.includes('moneyStatusMarkup')) throw new Error('shop() queue chip was not found');

const order = accountId => ({accountId, key: 'pending-key', body: {locationId: 'loc', fulfillment: 'pickup', lines: [{id: 'rice', qty: 1}]}});
const member = {id: 'member-1', role: 'member'};

function render({account, pending, online}) {
  const shop = new Function(
    'category', 'owner', 'pending', 'account', 'navigator', 'moneyStatusMarkup', 't', 'esc',
    'shopCatalogueMarkup', 'cat', 'search', 'aisle', 'lang', 'shopViewState', 'entryLoading',
    'shellFailure', 'money', 'bag', 'footer', 'insuranceView',
    shopSrc + '\nreturn shop();'
  );
  return shop(
    'all', {active: false}, pending, account, {onLine: online}, moneyStatusMarkup,
    value => value, value => String(value), () => '', {products: []}, '', '', 'en',
    () => 'ready', false, () => false, () => '', () => '', () => '', () => ''
  );
}

const noChip = html => assert.doesNotMatch(html, /money-honesty-chip/);

test('signed out with nothing queued shows no shop queue chip', () => {
  noChip(render({account: null, pending: null, online: true}));
  noChip(render({account: undefined, pending: undefined, online: false}));
});

test('signed out with a stale queue shows no shop queue chip', () => {
  noChip(render({account: null, pending: order('member-stale'), online: true}));
  noChip(render({account: null, pending: order('member-stale'), online: false}));
});

test('signed in with nothing queued shows no shop queue chip', () => {
  noChip(render({account: member, pending: null, online: true}));
  noChip(render({account: member, pending: undefined, online: false}));
});

test('signed in with a queued order shows the shop chip online and offline', () => {
  noChip(render({account: member, pending: order('member-other'), online: true}));
  const online = render({account: member, pending: order('member-1'), online: true});
  assert.match(online, /class="money-honesty-chip"/);
  assert.match(online, /data-money-state="requested"/);
  assert.match(online, />Requested</);
  assert.doesNotMatch(online, /data-money-state="queued"/);
  const offline = render({account: member, pending: order('member-1'), online: false});
  assert.match(offline, /class="money-honesty-chip"/);
  assert.match(offline, /data-money-state="queued"/);
  assert.match(offline, />Queued on this phone</);
  assert.doesNotMatch(offline, /data-money-state="requested"/);
});
