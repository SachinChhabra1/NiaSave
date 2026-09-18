/**
 * Save test lane. One flagged SKU with a real pack and stock so a member
 * order can be reserved, packed, handed over and reconciled without
 * publishing dummy packs into the live guest catalogue.
 *
 * Never listed by publicBrowseProducts. Never sets paymentsEnabled.
 * OTP / Send / online UPI stay untouched.
 */
import { COLLECT_HINT } from './shop-offer.mjs';

export const TEST_SKU_ID = 'test_groundnut_oil';
export const TEST_PACK = '1 L bottle';
export const TEST_OPENING = 12;
export const TEST_PRICE = 185;
export const TEST_KEEP = 75;
export const TEST_KIRANA = 255;
export const TEST_LOCATION_ID = 'S01';

export const TEST_SKU = Object.freeze({
  id: TEST_SKU_ID,
  category: 'oil',
  nia: TEST_PRICE,
  kirana: TEST_KIRANA,
  keep: TEST_KEEP,
  opening: TEST_OPENING,
  vendor: 'TEST lane · not for sale',
  test: true,
  pack: TEST_PACK
});

export const TEST_DESCRIPTION = Object.freeze([
  'Groundnut oil (TEST)',
  'मूंगफली का तेल (परीक्षण)',
  'Cooking',
  'oil'
]);

export function isTestFlagged(product) {
  if (!product) return false;
  if (product.test === true || product.testFlagged === true) return true;
  return product.id === TEST_SKU_ID;
}

export function guestVisibleProducts(products = []) {
  return products.filter(product => !isTestFlagged(product));
}

export function ompalTestLocation(time) {
  const start = Number.isFinite(time) ? time : Date.now();
  return {
    id: TEST_LOCATION_ID,
    name: COLLECT_HINT.name,
    address: 'Ved Road · Sukh Store · Theatre North · TEST collection point',
    modes: ['pickup'],
    windowStart: new Date(start).toISOString(),
    windowEnd: new Date(start + 14 * 86400000).toISOString(),
    test: true
  };
}

export function testProductRecord() {
  const [name, hindi, category, illustration] = TEST_DESCRIPTION;
  return {
    id: TEST_SKU_ID,
    name,
    hindi,
    category,
    illustration,
    pack: TEST_PACK,
    price: TEST_PRICE,
    keep: TEST_KEEP,
    kirana: TEST_KIRANA,
    test: true,
    testFlagged: true
  };
}

/** Seed pack + stock + Ompal window for the test SKU only. Guest oils stay pending. */
export function applyTestLane(s, time, skus) {
  const allowed = !Array.isArray(skus)
    || skus.some(p => isTestFlagged(p) || p.id === TEST_SKU_ID)
    || (skus.some(p => p.id === 'groundnut_oil') && skus.some(p => p.id === 'essentials_pick'));
  if (!allowed) return s;
  if (!s?.beat) return s;
  s.beat.opening = s.beat.opening || {};
  if (!Number.isFinite(s.beat.opening[TEST_SKU_ID]) || s.beat.opening[TEST_SKU_ID] < 1) {
    s.beat.opening[TEST_SKU_ID] = TEST_OPENING;
  }
  if (!s.beat.open && s.beat.open !== false) s.beat.open = true;
  const c = s.commerce;
  if (!c?.config) return s;
  const products = Array.isArray(c.config.products) ? c.config.products.slice() : [];
  const idx = products.findIndex(p => p.id === TEST_SKU_ID);
  const record = testProductRecord();
  if (idx >= 0) products[idx] = { ...products[idx], ...record, pack: TEST_PACK, test: true, testFlagged: true };
  else products.push(record);
  c.config.products = products;
  const locations = Array.isArray(c.config.locations) ? c.config.locations.slice() : [];
  const locIdx = locations.findIndex(l => l.id === TEST_LOCATION_ID);
  const loc = ompalTestLocation(time);
  if (locIdx >= 0) {
    const prior = locations[locIdx];
    locations[locIdx] = {
      ...prior,
      name: loc.name,
      address: loc.address,
      modes: prior.modes?.length ? prior.modes : loc.modes,
      windowStart: prior.windowStart || loc.windowStart,
      windowEnd: prior.windowEnd || loc.windowEnd,
      test: true
    };
  } else locations.push(loc);
  c.config.locations = locations;
  c.config.testLane = true;
  return s;
}
