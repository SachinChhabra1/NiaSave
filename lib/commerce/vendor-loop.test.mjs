import test from "node:test";
import assert from "node:assert/strict";
import * as v from "./vendor-loop.mjs";

const now = Date.parse("2026-09-17T09:30:00Z");

function ready() {
  const state = v.emptyState(now);
  const vendor = v.seedHubKirana(state, now);
  const upload = state.uploads[0];
  v.publishList(state, upload.id, {
    "oil-sunflower-1l": 128,
    "oil-groundnut-1l": 155,
    "detergent-1kg": 69,
    "soap-bar-4": 32,
    "rice-5kg": 229,
    "ata-5kg": 215
  }, now);
  return { state, vendor };
}

function bag(state, extra = {}) {
  return v.recordCollectedBag(state, {
    id: extra.id || "bag-1",
    orderId: extra.orderId || "ord-1",
    pickupCode: "NIA1042",
    collectionId: "col-1",
    bankRef: extra.bankRef || "123456789012",
    collected: extra.collected ?? 128,
    deliveredQty: extra.deliveredQty,
    pod: extra.pod !== false,
    lines: extra.lines || [{ sku: "oil-sunflower-1l", qty: 1 }]
  }, now);
}

test("draft vendor cannot upload; active vendor can", () => {
  const state = v.emptyState(now);
  const draft = v.registerVendor(state, {
    name: "Hub kirana",
    payTerms: "cash_same_day",
    payoutRail: "cash_desk",
    activate: false
  }, now);
  assert.equal(draft.status, "draft");
  assert.throws(() => v.uploadCatalog(state, draft.id, [{ sku: "rice-5kg", name: "Rice 5kg", buyInr: 210, keepQty: 12, leadDays: 2 }], now), /vendor_not_active/);
  const live = v.registerVendor(state, {
    name: "Hub kirana 2",
    payTerms: "cash_same_day",
    payoutRail: "cash_desk"
  }, now);
  const upload = v.uploadCatalog(state, live.id, [{ sku: "rice-5kg", name: "Rice 5kg", buyInr: 210, keepQty: 12, leadDays: 2 }], now);
  assert.equal(upload.status, "draft");
});

test("seeded Hub kirana stays dummy and cannot seed onto live state", () => {
  const state = v.emptyState(now);
  v.seedHubKirana(state, now);
  assert.equal(state.dummy, true);
  assert.equal(state.vendors[0].dummy, true);
  state.dummy = false;
  assert.throws(() => v.seedHubKirana(state, now), /seed_forbidden_on_live/);
});

test("matched collect pays buy_inr not listed price and writes last_buy", () => {
  const { state, vendor } = ready();
  bag(state);
  const recon = v.reconcileBag(state, "bag-1", now);
  assert.equal(recon.result, "matched");
  assert.equal(recon.lines[0].payable, 118);
  const payout = v.postPayout(state, vendor.id, now);
  assert.equal(payout.amount, 118);
  assert.equal(payout.listed, 128);
  assert.equal(payout.margin, 10);
  assert.equal(payout.status, "posted");
  assert.ok(payout.reconIds.includes(recon.id));
  assert.equal(vendor.lastPo, payout.id);
  assert.equal(vendor.lastBuy, "2026-09-17");
});

test("short collect, no-POD and partial never post payout", () => {
  const { state, vendor } = ready();
  bag(state, { id: "bag-short", collected: 100 });
  assert.equal(v.reconcileBag(state, "bag-short", now).result, "short_cash");
  bag(state, { id: "bag-pod", bankRef: "", pod: false, collected: 128 });
  assert.equal(v.reconcileBag(state, "bag-pod", now).result, "no_pod");
  bag(state, { id: "bag-part", deliveredQty: 0, collected: 128 });
  assert.equal(v.reconcileBag(state, "bag-part", now).result, "partial");
  assert.throws(() => v.postPayout(state, vendor.id, now), /no_eligible_lines/);
  assert.equal(state.payouts.length, 0);
  assert.ok(v.watches(state).some(item => item.kind === "short_cash"));
  assert.ok(v.watches(state).some(item => item.kind === "no_pod"));
  assert.ok(v.watches(state).some(item => item.kind === "partial"));
});

test("price drift rejects the upload and does not rewrite the live list", () => {
  const { state, vendor } = ready();
  const listedBuy = state.list.find(item => item.sku === "rice-5kg").buyInr;
  const drifted = v.uploadCatalog(state, vendor.id, [
    { sku: "rice-5kg", name: "Rice 5kg", buyInr: listedBuy + 20, keepQty: 12, leadDays: 2 }
  ], now);
  assert.equal(drifted.status, "rejected");
  assert.throws(() => v.publishList(state, drifted.id, { "rice-5kg": 249 }, now), /upload_not_publishable/);
  assert.equal(state.list.find(item => item.sku === "rice-5kg").buyInr, listedBuy);
});

test("unlisted SKU cannot become a collected bag", () => {
  const { state } = ready();
  assert.throws(() => bag(state, { lines: [{ sku: "unknown-oil", qty: 1 }] }), /unlisted_sku/);
});

test("same recon line cannot be paid twice", () => {
  const { state, vendor } = ready();
  bag(state);
  v.reconcileBag(state, "bag-1", now);
  v.postPayout(state, vendor.id, now);
  assert.throws(() => v.postPayout(state, vendor.id, now), /no_eligible_lines/);
});
