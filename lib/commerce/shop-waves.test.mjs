import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PENDING_PACK, COLLECT_HINT } from './shop-offer.mjs';
import { publicBrowseProducts } from './core.mjs';
import {
  COLLECT_MAP,
  stampSourceFromConnector,
  decorateBrowseProducts,
  sendPlanContract,
  waveCatalogueExtras
} from './shop-waves.mjs';

const build = fs.readFileSync(new URL('../../vercel-build.sh', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../../commerce.html', import.meta.url), 'utf8');
const commerce = fs.readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
const waves = fs.readFileSync(new URL('../../commerce-waves.js', import.meta.url), 'utf8');

const ten = [
  { id: 'groundnut_oil', nia: 185, keep: 75, kirana: 255, opening: 80 },
  { id: 'mustard_oil', nia: 155, keep: 70, kirana: 225, opening: 80 },
  { id: 'sunflower_oil', nia: 128, keep: 50, kirana: 180, opening: 80 },
  { id: 'coconut_oil', nia: 205, keep: 80, kirana: 280, opening: 80 },
  { id: 'detergent_pick', nia: 95, keep: 20, kirana: 120, opening: 80 },
  { id: 'nia_detergent', nia: 78, keep: 18, kirana: 110, opening: 80 },
  { id: 'bathsoap_pick', nia: 70, keep: 15, kirana: 95, opening: 80 },
  { id: 'nia_bathsoap', nia: 52, keep: 12, kirana: 80, opening: 80 },
  { id: 'toothpaste_pick', nia: 48, keep: 10, kirana: 70, opening: 80 },
  { id: 'essentials_pick', nia: 320, keep: 90, kirana: 420, opening: 80 }
];

test('Wave 1 keeps the live 10 and does not invent SKUs or packs', () => {
  const products = decorateBrowseProducts(publicBrowseProducts(ten));
  assert.equal(products.length, 10);
  assert.equal(products[0].id, 'groundnut_oil');
  assert.equal(products[0].pack, PENDING_PACK);
  assert.equal(products[0].sourceSku, null);
  assert.equal(products[0].sourceSiteCode, null);
  assert.equal(products[0].collectHint.id, COLLECT_HINT.id);
});

test('Wave 1 hides OOS and stamps source only from connector stock', () => {
  const products = decorateBrowseProducts(
    publicBrowseProducts([{ id: 'groundnut_oil', nia: 185, opening: 80 }, { id: 'mustard_oil', nia: 155, opening: 0 }]),
    [{ sku: 'groundnut_oil', site_code: 'S01', pack: '1 L bottle' }]
  );
  assert.equal(products.length, 1);
  assert.equal(products[0].id, 'groundnut_oil');
  assert.equal(products[0].sourceSku, 'groundnut_oil');
  assert.equal(products[0].sourceSiteCode, 'S01');
  assert.equal(products[0].pack, '1 L bottle');
});

test('Wave 2 Send plan never moves money', () => {
  const plan = sendPlanContract();
  assert.equal(plan.transfersEnabled, false);
  assert.equal(plan.paymentsEnabled, false);
  assert.equal(plan.planningOnly, true);
  assert.match(plan.copy, /not a transfer/i);
  assert.doesNotMatch(commerce, /paymentsEnabled\s*=\s*true/);
});

test('Wave 2 fallback leads with Send safety while the primary view is unavailable', () => {
  assert.match(waves, /<h1>Send<\/h1>/);
  assert.match(waves, /Transfers not active/);
  assert.match(waves, /Saving a plan does not move money/);
  assert.match(waves, /hasPrimarySendView/);
});

test('Wave 3 collect map uses only S01 from shops-30', () => {
  assert.equal(COLLECT_MAP.stopId, 'S01');
  assert.equal(COLLECT_MAP.name, 'Nia Nest Ompal');
  assert.equal(COLLECT_MAP.lat, 21.2266);
  assert.equal(COLLECT_MAP.lng, 72.83613);
  assert.equal(COLLECT_MAP.area, 'Ved Road');
  assert.equal(COLLECT_MAP.source, 'rabbit/shops-30.mjs');
  const extras = waveCatalogueExtras();
  assert.equal(extras.paymentsEnabled, false);
  assert.equal(extras.collectMap.stopId, 'S01');
});

test('Wave 0 and Wave 1-3 assets reach dist', () => {
  assert.match(build, /commerce-wave0\.css/);
  assert.match(build, /commerce-wave0\.js/);
  assert.match(build, /commerce-waves\.css/);
  assert.match(build, /commerce-waves\.js/);
  assert.match(html, /commerce-wave0\.css/);
  assert.match(html, /commerce-waves\.js/);
});
