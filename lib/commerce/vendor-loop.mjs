/**
 * Sikh Unit vendor settlement gate.
 * Principal model: Nia buys at buyInr, lists at listed, pays vendor only on matched recon.
 * Member collection stays UPI-at-handover. pay_terms is Nia → vendor.
 * Dummy Hub kirana data must stay dummy: true.
 */

const PAY_TERMS = new Set(["cash_same_day"]);
const SKU = /^[a-z0-9][a-z0-9_-]{1,63}$/;

function fail(code) {
  const err = new Error(code);
  err.code = code;
  throw err;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rupees(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) fail("invalid_amount");
  return n;
}

function qty(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) fail("invalid_quantity");
  return n;
}

function id(prefix, time) {
  return `${prefix}-${String(time).slice(-8)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyState(now = Date.now()) {
  return {
    dummy: true,
    vendors: [],
    uploads: [],
    list: [],
    bags: [],
    recons: [],
    payouts: [],
    exceptions: [],
    updatedAt: new Date(now).toISOString()
  };
}

export function seedHubKirana(state, now = Date.now()) {
  if (!state.dummy) fail("seed_forbidden_on_live");
  const vendor = registerVendor(state, {
    name: "Hub kirana",
    phone: "",
    payTerms: "cash_same_day",
    payoutRail: "cash_desk",
    dummy: true
  }, now);
  uploadCatalog(state, vendor.id, [
    { sku: "oil-sunflower-1l", name: "Sunflower oil 1L", buyInr: 118, keepQty: 24, leadDays: 1 },
    { sku: "oil-groundnut-1l", name: "Groundnut oil 1L", buyInr: 142, keepQty: 18, leadDays: 1 },
    { sku: "detergent-1kg", name: "Detergent 1kg", buyInr: 62, keepQty: 20, leadDays: 1 },
    { sku: "soap-bar-4", name: "Soap bars 4pk", buyInr: 28, keepQty: 30, leadDays: 1 },
    { sku: "rice-5kg", name: "Rice 5kg", buyInr: 210, keepQty: 12, leadDays: 2 },
    { sku: "ata-5kg", name: "Atta 5kg", buyInr: 198, keepQty: 12, leadDays: 2 }
  ], now);
  return vendor;
}

export function registerVendor(state, input = {}, now = Date.now()) {
  const name = String(input.name || "").trim();
  const payTerms = String(input.payTerms || "").trim();
  const payoutRail = String(input.payoutRail || "").trim();
  if (!name) fail("vendor_name_required");
  if (!PAY_TERMS.has(payTerms)) fail("pay_terms_required");
  if (!payoutRail) fail("payout_rail_required");
  const vendor = {
    id: input.id || id("ven", now),
    name,
    phone: String(input.phone || "").trim(),
    gstin: String(input.gstin || "").trim(),
    pan: String(input.pan || "").trim(),
    payTerms,
    payoutRail,
    status: input.activate === false ? "draft" : "active",
    dummy: Boolean(state.dummy),
    lastPo: null,
    lastBuy: null,
    createdAt: new Date(now).toISOString()
  };
  state.vendors.push(vendor);
  state.updatedAt = vendor.createdAt;
  return vendor;
}

function vendorOf(state, vendorId) {
  const vendor = state.vendors.find(v => v.id === vendorId);
  if (!vendor) fail("vendor_not_found");
  return vendor;
}

export function uploadCatalog(state, vendorId, rows, now = Date.now()) {
  const vendor = vendorOf(state, vendorId);
  if (vendor.status !== "active") fail("vendor_not_active");
  if (!Array.isArray(rows) || !rows.length) fail("upload_empty");
  const seen = new Set();
  const parsed = rows.map(row => {
    const sku = String(row.sku || "").trim();
    if (!SKU.test(sku)) fail("invalid_sku");
    if (seen.has(sku)) fail("duplicate_sku");
    seen.add(sku);
    return {
      sku,
      name: String(row.name || sku).trim(),
      buyInr: rupees(row.buyInr),
      keepQty: qty(row.keepQty),
      leadDays: Number.isInteger(Number(row.leadDays)) ? Number(row.leadDays) : 1,
      status: String(row.status || "keep")
    };
  });
  const published = state.list.filter(item => item.vendorId === vendorId);
  for (const row of parsed) {
    const live = published.find(item => item.sku === row.sku);
    if (live && live.buyInr !== row.buyInr) {
      row.frozen = true;
      note(state, "price_drift", { vendorId, sku: row.sku, listedBuyInr: live.buyInr, uploadBuyInr: row.buyInr }, now);
    }
  }
  const upload = {
    id: id("upl", now),
    vendorId,
    version: state.uploads.filter(item => item.vendorId === vendorId).length + 1,
    rows: parsed,
    status: parsed.some(row => row.frozen) ? "rejected" : "draft",
    createdAt: new Date(now).toISOString()
  };
  state.uploads.push(upload);
  state.updatedAt = upload.createdAt;
  return upload;
}

export function publishList(state, uploadId, listPrices = {}, now = Date.now()) {
  const upload = state.uploads.find(item => item.id === uploadId);
  if (!upload) fail("upload_not_found");
  if (upload.status !== "draft") fail("upload_not_publishable");
  const vendor = vendorOf(state, upload.vendorId);
  const published = upload.rows.map(row => {
    const listed = listPrices[row.sku] == null ? row.buyInr : rupees(listPrices[row.sku]);
    if (listed < row.buyInr) fail("listed_below_buy");
    return {
      sku: row.sku,
      name: row.name,
      vendorId: vendor.id,
      vendorName: vendor.name,
      buyInr: row.buyInr,
      listed,
      keepQty: row.keepQty,
      leadDays: row.leadDays,
      uploadId: upload.id,
      dummy: Boolean(state.dummy)
    };
  });
  state.list = state.list.filter(item => item.vendorId !== vendor.id).concat(published);
  upload.status = "published";
  upload.publishedAt = new Date(now).toISOString();
  state.updatedAt = upload.publishedAt;
  return published;
}

export function recordCollectedBag(state, bag, now = Date.now()) {
  const listed = bag.lines.map(line => {
    const sku = state.list.find(item => item.sku === line.sku);
    if (!sku) fail("unlisted_sku");
    return {
      sku: line.sku,
      qty: qty(line.qty),
      listed: sku.listed,
      buyInr: sku.buyInr,
      vendorId: sku.vendorId
    };
  });
  const reservedQty = listed.reduce((n, line) => n + line.qty, 0);
  const deliveredQty = bag.deliveredQty == null ? reservedQty : Number(bag.deliveredQty);
  const record = {
    id: bag.id || id("bag", now),
    orderId: bag.orderId || bag.id || id("ord", now),
    status: "collected",
    pickupCode: String(bag.pickupCode || ""),
    collectionId: bag.collectionId || id("col", now),
    bankRef: String(bag.bankRef || ""),
    listedTotal: listed.reduce((n, line) => n + line.listed * line.qty, 0),
    collected: rupees(bag.collected),
    reservedQty,
    deliveredQty,
    pod: Boolean(bag.pod),
    lines: listed,
    createdAt: new Date(now).toISOString()
  };
  state.bags.push(record);
  return record;
}

export function reconcileBag(state, bagId, now = Date.now()) {
  const bag = state.bags.find(item => item.id === bagId);
  if (!bag) fail("bag_not_found");
  if (state.recons.some(item => item.bagId === bagId)) fail("already_reconciled");
  const result = verdict(bag);
  const recon = {
    id: id("rec", now),
    bagId: bag.id,
    orderId: bag.orderId,
    collectionId: bag.collectionId,
    result,
    listedTotal: bag.listedTotal,
    collected: bag.collected,
    deliveredQty: bag.deliveredQty,
    reservedQty: bag.reservedQty,
    lines: bag.lines.map(line => ({
      sku: line.sku,
      qty: line.qty,
      listed: line.listed,
      buyInr: line.buyInr,
      vendorId: line.vendorId,
      payable: result === "matched" ? line.buyInr * line.qty : 0
    })),
    createdAt: new Date(now).toISOString()
  };
  state.recons.push(recon);
  if (result !== "matched") note(state, result, { reconId: recon.id, bagId: bag.id, orderId: bag.orderId }, now);
  return recon;
}

function verdict(bag) {
  if (!bag.pod || !bag.bankRef || bag.bankRef.replace(/\D/g, "").length !== 12) return "no_pod";
  if (bag.deliveredQty !== bag.reservedQty) return "partial";
  if (bag.collected < bag.listedTotal) return "short_cash";
  if (bag.collected !== bag.listedTotal) return "collect_mismatch";
  return "matched";
}

export function postPayout(state, vendorId, now = Date.now()) {
  const vendor = vendorOf(state, vendorId);
  if (vendor.status !== "active") fail("vendor_not_active");
  const lines = state.recons
    .filter(recon => recon.result === "matched")
    .flatMap(recon => recon.lines
      .filter(line => line.vendorId === vendorId && line.payable > 0)
      .map(line => ({ ...line, reconId: recon.id, bagId: recon.bagId, orderId: recon.orderId })));
  const unused = lines.filter(line => !state.payouts.some(payout => payout.reconIds.includes(line.reconId) && payout.skus.includes(line.sku)));
  if (!unused.length) fail("no_eligible_lines");
  const amount = unused.reduce((n, line) => n + line.payable, 0);
  const listed = unused.reduce((n, line) => n + line.listed * line.qty, 0);
  const payout = {
    id: id("pay", now),
    vendorId,
    reconIds: [...new Set(unused.map(line => line.reconId))],
    skus: unused.map(line => line.sku),
    amount,
    listed,
    margin: listed - amount,
    payTerms: vendor.payTerms,
    status: "posted",
    dummy: Boolean(state.dummy),
    postedAt: new Date(now).toISOString()
  };
  if (!payout.reconIds.length) fail("payout_without_recon");
  state.payouts.push(payout);
  vendor.lastPo = payout.id;
  vendor.lastBuy = payout.postedAt.slice(0, 10);
  state.updatedAt = payout.postedAt;
  return payout;
}

export function watches(state) {
  const open = state.exceptions.filter(item => item.open);
  const extra = [];
  if (state.payouts.some(item => !item.reconIds.length)) extra.push({ kind: "payout_without_recon" });
  if (state.dummy && state.payouts.some(item => item.dummy === false)) extra.push({ kind: "dummy_labelled_live" });
  for (const vendor of state.vendors) {
    if (vendor.status === "active" && !vendor.lastPo && state.recons.some(recon => recon.result === "matched" && recon.lines.some(line => line.vendorId === vendor.id))) {
      extra.push({ kind: "eligible_unpaid", vendorId: vendor.id });
    }
  }
  return open.concat(extra);
}

function note(state, kind, detail, now) {
  state.exceptions.push({
    id: id("exc", now),
    kind,
    detail,
    open: true,
    createdAt: new Date(now).toISOString()
  });
}

export function snapshot(state) {
  return clone(state);
}
