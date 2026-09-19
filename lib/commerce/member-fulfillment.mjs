/**
 * Signed-in member fulfilment on the existing 10 SKUs.
 * Packs come only from mill rows that already match frozen nia prices.
 * Guest catalogue stays pending. No new SKU ids. No new prices.
 * Orderable rows are TEST-flagged. Orders persist through withSaveState → nia_runtime_state.
 */
import { TEST_MANUFACTURERS } from '../../commerce-shop-categories.js';
import { COLLECT_HINT, packIsConfirmed } from './shop-offer.mjs';
import { goodsCategory } from '../../commerce-categories.js';
import { overlayCatalogueProducts } from './catalogue-connector.mjs';
import { canonStatus } from './core.mjs';

const MILL_CATEGORY = Object.freeze({
  groundnut_oil: 'groundnut_oil',
  mustard_oil: 'mustard_oil',
  sunflower_oil: 'sunflower_oil',
  coconut_oil: 'coconut_oil',
  detergent_pick: 'detergent',
  nia_detergent: 'detergent',
  bathsoap_pick: 'bathsoap',
  nia_bathsoap: 'bathsoap',
  toothpaste_pick: 'toothpaste'
});

const DESCRIPTIONS = Object.freeze({
  groundnut_oil: ['Groundnut oil', 'मूंगफली का तेल', 'Cooking', 'oil'],
  mustard_oil: ['Mustard oil', 'सरसों का तेल', 'Cooking', 'oil'],
  sunflower_oil: ['Sunflower oil', 'सूरजमुखी का तेल', 'Cooking', 'oil'],
  coconut_oil: ['Coconut oil', 'नारियल का तेल', 'Personal care', 'oil'],
  detergent_pick: ['Laundry detergent', 'कपड़े धोने का पाउडर', 'Home care', 'wash'],
  nia_detergent: ['Nia detergent', 'निया डिटर्जेंट', 'Home care', 'wash'],
  bathsoap_pick: ['Bath soap', 'नहाने का साबुन', 'Personal care', 'soap'],
  nia_bathsoap: ['Nia bath soap', 'निया नहाने का साबुन', 'Personal care', 'soap'],
  toothpaste_pick: ['Toothpaste', 'टूथपेस्ट', 'Personal care', 'paste'],
  essentials_pick: ['Essentials pack', 'ज़रूरी सामान का पैक', 'Home care', 'bag']
});

export function millPackForSku(sku) {
  if (!sku?.id) return null;
  const group = MILL_CATEGORY[sku.id];
  if (!group) return null;
  const nia = Number(sku.nia);
  if (!Number.isFinite(nia) || nia <= 0) return null;
  const row = TEST_MANUFACTURERS.find(item =>
    item.category === group && Number(item.nia_price_inr) === nia && typeof item.pack === 'string' && item.pack.trim()
  );
  return row ? row.pack.trim() : null;
}

export function fulfillmentProducts(skus = []) {
  return (skus || []).filter(sku => DESCRIPTIONS[sku.id]).map(sku => {
    const [name, hindi, category, illustration] = DESCRIPTIONS[sku.id];
    const pack = millPackForSku(sku);
    return {
      id: sku.id,
      name,
      hindi,
      category: goodsCategory(category) || category,
      illustration,
      pack: pack || 'Pack size to be confirmed',
      price: sku.nia,
      keep: sku.keep,
      kirana: sku.kirana
    };
  });
}

export function stampTestProduct(product) {
  if (!packIsConfirmed(product)) return product;
  return {
    ...product,
    name: product.name.includes('(TEST)') ? product.name : `${product.name} (TEST)`,
    hindi: product.hindi.includes('(परीक्षण)') ? product.hindi : `${product.hindi} (परीक्षण)`,
    test: true,
    testFlagged: true
  };
}

export function ompalPickupLocation(time) {
  const start = Number.isFinite(time) ? time : Date.now();
  return {
    id: 'S01',
    name: COLLECT_HINT.name,
    address: 'Ved Road · Sukh Store · Theatre North',
    modes: ['pickup'],
    sourceSiteCode: 'S01',
    windowStart: new Date(start).toISOString(),
    windowEnd: new Date(start + 14 * 86400000).toISOString(),
    test: true
  };
}

/** Publish existing SKUs + Ompal pickup into the Save snapshot. Never invent SKUs. */
export function applyMemberFulfillment(s, time, skus = []) {
  if (!s?.beat) return s;
  const c = s.commerce;
  if (!c) return s;
  const products = fulfillmentProducts(skus);
  const ready = products.filter(p => packIsConfirmed(p));
  if (!ready.length) return s;
  const staffLocked = c.config?.verified && c.config.memberFulfillment !== true
    && (c.config.products || []).some(p => packIsConfirmed(p));
  if (staffLocked) {
    if (c.config) {
      c.config.products = overlayCatalogueProducts(c.config.products, s.uploads?.catalogue, { testLane: c.config.testLane === true });
    }
    return s;
  }
  s.beat.opening = s.beat.opening || {};
  for (const product of ready) {
    const sku = (skus || []).find(row => row.id === product.id);
    const opening = Number(s.beat.opening[product.id]);
    if (!Number.isFinite(opening) || opening < 1) {
      s.beat.opening[product.id] = Number.isFinite(sku?.opening) ? sku.opening : 8;
    }
  }
  if (!s.beat.closed) s.beat.open = true;
  const location = ompalPickupLocation(time);
  const existing = Array.isArray(c.config?.locations) ? c.config.locations.find(l => l.id === 'S01') : null;
  c.config = {
    verified: true,
    beatDate: s.beat.beatDate,
    reserveMinutes: 120,
    products: products.map(stampTestProduct),
    locations: [existing && Date.parse(existing.windowEnd) > time ? { ...existing, modes: existing.modes?.length ? existing.modes : ['pickup'], name: location.name, address: existing.address || location.address, test: true } : location],
    staffLocations: c.config?.staffLocations || {},
    support: c.config?.support || 'Ask your Nia team.',
    memberFulfillment: true,
    testLane: true
  };
  c.config.products = overlayCatalogueProducts(c.config.products, s.uploads?.catalogue, { testLane: true });
  return s;
}

export function staffOrderView(o) {
  if (!o) return null;
  return {
    id: o.id,
    memberId: o.memberId,
    member: o.member,
    source: o.source || 'commerce',
    status: canonStatus(o.status),
    payStatus: o.payStatus,
    amount: o.amount,
    due: o.due,
    paid: o.paid,
    pickupCode: o.pickupCode,
    lines: o.lines,
    location: o.location,
    fulfillment: o.fulfillment,
    payment: o.payment || null,
    refund: o.refund || null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    expiresAt: o.expiresAt,
    stopId: o.stopId,
    beatDate: o.beatDate,
    preview: o.preview === true,
    test: o.test === true,
    method: o.method || 'upi'
  };
}
