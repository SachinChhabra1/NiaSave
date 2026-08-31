/**
 * Operation Polo staff control plane (studio-cart only).
 * Go-live load: 1 theatre, 40 studios, 3000 members.
 * One evening beat, ~5 bags per stop (~200 orders). Not 10k. Not one cart.
 * Durable state uses Postgres when DATABASE_URL is configured; local development falls back to memory.
 * Skip remains ON for OTP and payment only. No WhatsApp product or live member UPI / Razorpay.
 */
import {
  THEATRE,
  STUDIO_COUNT,
  MEMBER_COUNT,
  MEMBERS_PER_STUDIO,
  BEAT_BAGS_PER_STOP,
  buildStudios,
  buildMembers,
  codeFor,
  kindLetter
} from "./scale.mjs";
import { SHOPS_30 } from "./shops-30.mjs";
import { hasDurableStore, loadRuntimeState, saveRuntimeState } from "../lib/runtime-store.mjs";

const SHOP_PIN = Object.fromEntries(SHOPS_30.shops.map(s => [s.stopId, s]));

function pinStudio(studio) {
  const pin = SHOP_PIN[studio.id];
  if (!pin) return { ...studio };
  return { ...studio, lat: pin.lat, lng: pin.lng, seq: pin.seq, area: pin.area };
}

const DUMMY_DATA = process.env.DUMMY_DATA !== "0";

export const WEEK_BEAT = "2026-08-31";
export const NEXT_BEAT = "2026-09-01";
export const SLOT = "17:00";
export const OWNER = "hub";
export { THEATRE, STUDIO_COUNT, MEMBER_COUNT, MEMBERS_PER_STUDIO, BEAT_BAGS_PER_STOP };

export const SKUS = [
  { id: "groundnut_oil", nia: 185, kirana: 255, keep: 75, opening: 80, vendor: "Cold-press Tumkur", lead_days: 3, last_buy: "2026-08-18" },
  { id: "mustard_oil", nia: 155, kirana: 225, keep: 70, opening: 80, vendor: "Ghani · Raichur", lead_days: null, last_buy: "" },
  { id: "sunflower_oil", nia: 128, kirana: 177, keep: 50, opening: 80, vendor: "Refinery Hubli", lead_days: 2, last_buy: "2026-08-20" },
  { id: "coconut_oil", nia: 205, kirana: 285, keep: 80, opening: 80, vendor: "Copra press · Tiptur", lead_days: null, last_buy: "" },
  { id: "detergent_pick", nia: 95, kirana: 125, keep: 30, opening: 80, vendor: "Local packer · Peenya", lead_days: null, last_buy: "" },
  { id: "nia_detergent", nia: 78, kirana: 108, keep: 32, opening: 80, vendor: "Local packer Peenya", lead_days: 5, last_buy: "2026-08-15" },
  { id: "bathsoap_pick", nia: 70, kirana: 96, keep: 26, opening: 80, vendor: "Soap works · Mysore", lead_days: null, last_buy: "" },
  { id: "nia_bathsoap", nia: 52, kirana: 72, keep: 32, opening: 80, vendor: "Soap works Mysore", lead_days: 4, last_buy: "2026-08-22" },
  { id: "toothpaste_pick", nia: 48, kirana: 62, keep: 14, opening: 80, vendor: "Trade pack · City", lead_days: null, last_buy: "" },
  { id: "essentials_pick", nia: 320, kirana: 442, keep: 70, opening: 80, vendor: "Ration desk Hub", lead_days: 7, last_buy: "2026-08-10" }
];

const SKU_BY_ID = Object.fromEntries(SKUS.map(s => [s.id, s]));

export const STUDIOS = buildStudios().map(pinStudio);
export const MEMBERS = buildMembers(STUDIOS);
export { SHOPS_30 };
const studioById = new Map(STUDIOS.map(s => [s.id, s]));
const memberById = new Map(MEMBERS.map(m => [m.memberId, m]));
const membersByStudio = new Map();
for (const m of MEMBERS) {
  if (!membersByStudio.has(m.studioId)) membersByStudio.set(m.studioId, []);
  membersByStudio.get(m.studioId).push(m);
}

const SCAN_FLOW = ["reserved", "packed", "loaded", "at_stop", "collected"];
const SCAN_TYPES = {
  packed: "packed",
  loaded: "loaded",
  arrived: "at_stop",
  collected: "collected",
  missed: "missed",
  returned: "returned"
};

const SAMPLE = 8;
const CHASE_SAMPLE = 12;
const PAGE = 20;
const TOWER_BYTES_MAX = 80000;

function now() {
  return new Date().toISOString();
}

function emptySkuMap() {
  const m = {};
  for (const s of SKUS) m[s.id] = 0;
  return m;
}

function openingMap() {
  const m = {};
  for (const s of SKUS) m[s.id] = s.opening;
  return m;
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function skuOf(id) {
  return SKU_BY_ID[id] || { id, nia: 0, kirana: 0, keep: 0 };
}

function orderAmount(lines) {
  return (lines || []).reduce((n, l) => n + (Number(l.nia) || 0) * (Number(l.qty) || 1), 0);
}

function makeOrder({ memberId, sku, qty = 1, status, pickupCode, payStatus, stopId }) {
  const member = memberById.get(memberId) || { memberId, name: memberId, nest: "", studioId: stopId };
  const item = skuOf(sku);
  const lines = [{ id: sku, qty, nia: item.nia, kirana: item.kirana }];
  const amount = orderAmount(lines);
  const id = "ord-" + pickupCode.toLowerCase();
  return {
    id,
    pickupCode,
    member: member.name,
    memberId: member.memberId,
    phone: member.memberId,
    stopId: stopId || member.studioId,
    nest: member.nest,
    lines,
    pickup: "after 5",
    slot: SLOT,
    beatDate: WEEK_BEAT,
    cart: "studio",
    fulfillment: "hub_collect",
    status,
    kept: item.keep * qty,
    upiRef: "",
    owner: OWNER,
    payStatus: payStatus || (status === "collected" ? "captured" : "skip"),
    amount,
    due: amount,
    paid: status === "collected" ? amount : 0,
    method: status === "collected" ? "upi" : "cash",
    date: WEEK_BEAT
  };
}

function bagStatus(studio, bagIndex) {
  if (studio.id === "S01" && bagIndex === 0) return "reserved";
  if (bagIndex === 0 || bagIndex === 1) return "collected";
  if (bagIndex === 2) return "missed";
  if (bagIndex === 3) {
    const rot = ["packed", "loaded", "at_stop"];
    return rot[(studio.seq - 1) % 3];
  }
  return "reserved";
}

function bagSku(studio, bagIndex, status) {
  if (studio.id === "S01" && bagIndex === 0) return "detergent_pick";
  if (studio.id === "S01" && bagIndex === 1) return "toothpaste_pick";
  if (studio.id === "S02" && bagIndex === 0) return "essentials_pick";
  return SKUS[(studio.seq * 5 + bagIndex) % SKUS.length].id;
}

function seedStatement() {
  return [
    { id: "stmt-881001", date: WEEK_BEAT, utr: "UTR881001", amount: 320, note: "Ravi essentials H7RAVI", matched: false, settlementId: null },
    { id: "stmt-881002", date: WEEK_BEAT, utr: "UTR881002", amount: 48, note: "Priya toothpaste P8TOOTH", matched: false, settlementId: null },
    { id: "stmt-881099", date: WEEK_BEAT, utr: "UTR881099", amount: 50, note: "Unmatched bank credit", matched: false, settlementId: null },
    { id: "stmt-881077", date: WEEK_BEAT, utr: "UTR881077", amount: 12, note: "Charges reverse", matched: false, settlementId: null }
  ];
}

function seedOrders() {
  const out = [];
  for (const studio of STUDIOS) {
    const roster = membersByStudio.get(studio.id) || [];
    for (let j = 0; j < BEAT_BAGS_PER_STOP; j++) {
      const status = bagStatus(studio, j);
      const sku = bagSku(studio, j, status);
      const pickupCode = codeFor(studio.id, kindLetter(status), j + 1);
      const member = roster[j] || roster[0];
      out.push(makeOrder({
        memberId: member.memberId,
        sku,
        status,
        pickupCode,
        stopId: studio.id,
        payStatus: status === "collected" || status === "missed" ? "captured" : "skip"
      }));
    }
  }
  return out;
}

function seedReservations(orders) {
  return orders
    .filter(o => !["collected", "missed", "returned"].includes(o.status))
    .map(o => ({
      id: "res-" + o.pickupCode,
      orderId: o.id,
      beatDate: o.beatDate,
      sku: o.lines[0].id,
      qty: o.lines[0].qty,
      status: "holding"
    }));
}

function seedScans(orders) {
  const at = WEEK_BEAT + "T12:10:00.000Z";
  const events = [];
  for (const o of orders) {
    const trail = [];
    if (o.status === "reserved") continue;
    trail.push("packed");
    if (o.status !== "packed") {
      trail.push("loaded");
      if (o.status !== "loaded") {
        trail.push("arrived");
        if (o.status === "collected") trail.push("collected");
        else if (o.status === "missed") trail.push("missed");
        else if (o.status === "returned") trail.push("returned");
      }
    }
    trail.forEach((type, i) => {
      events.push({
        id: "scan-" + o.pickupCode + "-" + type,
        orderId: o.id,
        type,
        actor: "pickup",
        at,
        seq: i + 1
      });
    });
  }
  return events;
}

function seedPayments(orders) {
  return orders.map(o => ({
    id: "pay-" + o.pickupCode,
    orderId: o.id,
    amount: o.amount,
    method: "upi",
    status: o.payStatus === "captured" ? "captured" : "skip",
    live: false,
    razorpay: false,
    createdAt: WEEK_BEAT + "T10:00:00.000Z"
  }));
}

function seedSettlements(orders) {
  return orders
    .filter(o => o.status === "collected")
    .map(o => ({
      id: "set-" + o.pickupCode,
      orderId: o.id,
      pickupCode: o.pickupCode,
      memberId: o.memberId,
      beatDate: o.beatDate,
      amount: o.amount,
      trigger: "collected",
      status: "open",
      matched: false,
      utr: "",
      createdAt: WEEK_BEAT + "T17:40:00.000Z"
    }));
}

function seedExceptions(orders) {
  return orders
    .filter(o => o.status === "missed")
    .slice(0, 8)
    .map(o => ({
      id: "ex-" + o.pickupCode,
      orderId: o.id,
      kind: "miss",
      beatDate: o.beatDate,
      sku: o.lines[0].id,
      qty: o.lines[0].qty,
      at: WEEK_BEAT + "T18:10:00.000Z"
    }));
}

function matchStatement(settlements, statement) {
  for (const line of statement) {
    line.matched = false;
    line.settlementId = null;
  }
  for (const set of settlements) {
    set.matched = false;
    set.utr = "";
    const line = statement.find(s => !s.matched && s.amount === set.amount);
    if (line) {
      line.matched = true;
      line.settlementId = set.id;
      set.matched = true;
      set.utr = line.utr;
      set.status = "matched";
    }
  }
}

function indexOrders(orders) {
  const ordersById = new Map();
  const ordersByCode = new Map();
  const orderIdsByStop = new Map();
  for (const o of orders) {
    ordersById.set(o.id, o);
    ordersByCode.set(o.pickupCode, o);
    if (!orderIdsByStop.has(o.stopId)) orderIdsByStop.set(o.stopId, []);
    orderIdsByStop.get(o.stopId).push(o.id);
  }
  return { ordersById, ordersByCode, orderIdsByStop };
}

function createState() {
  const orders = seedOrders();
  const settlements = seedSettlements(orders);
  const statement = seedStatement();
  matchStatement(settlements, statement);
  const idx = indexOrders(orders);
  return {
    dummy: DUMMY_DATA,
    persist: hasDurableStore() ? "postgres" : "memory",
    blob: false,
    beat: {
      beatDate: WEEK_BEAT,
      open: true,
      openedAt: "2026-08-30T06:15:00.000Z",
      closed: false,
      closedAt: null,
      opening: openingMap(),
      owner: OWNER,
      slot: SLOT,
      theatre: THEATRE.name,
      theatreId: THEATRE.id,
      hub: THEATRE.hub,
      stopCount: STUDIO_COUNT,
      memberCount: MEMBER_COUNT,
      bagsTonight: orders.length,
      nextBeat: true,
      spokenBeat: "next beat",
      damage: ""
    },
    nextOpening: null,
    orders,
    ...idx,
    reservations: seedReservations(orders),
    scans: seedScans(orders),
    payments: seedPayments(orders),
    settlements,
    exceptions: seedExceptions(orders),
    statement,
    cash: {},
    studios: STUDIOS.map(s => ({ ...s })),
    uploads: { upi_statement: null, procure: null, vendors: null },
    memberFlags: {},
    memberAnswers: [],
    memberFlagsById: {},
    memberAnswersById: {},
    memberSession: { memberId: "ravi", phone: "ravi" },
    pos: [],
    invoices: [],
    dispatches: [],
    bikerRuns: []
  };
}

let state = createState();

const RUNTIME_STATE_KEY = process.env.NIA_RUNTIME_STATE_KEY || "operation-polo";

function snapshotState(value = state) {
  const {
    ordersById,
    ordersByCode,
    orderIdsByStop,
    ...serializable
  } = value;
  return serializable;
}

function restoreState(value, storage = "memory") {
  const base = createState();
  const restored = { ...base, ...(value || {}) };
  restored.orders = Array.isArray(restored.orders) ? restored.orders : base.orders;
  restored.studios = Array.isArray(restored.studios) ? restored.studios : base.studios;
  restored.reservations = Array.isArray(restored.reservations) ? restored.reservations : base.reservations;
  restored.scans = Array.isArray(restored.scans) ? restored.scans : base.scans;
  restored.payments = Array.isArray(restored.payments) ? restored.payments : base.payments;
  restored.settlements = Array.isArray(restored.settlements) ? restored.settlements : base.settlements;
  restored.exceptions = Array.isArray(restored.exceptions) ? restored.exceptions : base.exceptions;
  restored.statement = Array.isArray(restored.statement) ? restored.statement : base.statement;
  restored.pos = Array.isArray(restored.pos) ? restored.pos : [];
  restored.invoices = Array.isArray(restored.invoices) ? restored.invoices : [];
  restored.dispatches = Array.isArray(restored.dispatches) ? restored.dispatches : [];
  restored.bikerRuns = Array.isArray(restored.bikerRuns) ? restored.bikerRuns : [];
  restored.memberFlagsById = restored.memberFlagsById && typeof restored.memberFlagsById === "object"
    ? restored.memberFlagsById
    : { ravi: restored.memberFlags || {} };
  restored.memberAnswersById = restored.memberAnswersById && typeof restored.memberAnswersById === "object"
    ? restored.memberAnswersById
    : { ravi: restored.memberAnswers || [] };
  restored.persist = storage;
  restored.blob = false;
  Object.assign(restored, indexOrders(restored.orders));
  state = restored;
}

async function runWithPersistentState(mutating, work) {
  if (!hasDurableStore()) return work();

  for (let attempt = 0; attempt < 3; attempt++) {
    const loaded = await loadRuntimeState(RUNTIME_STATE_KEY, snapshotState(createState()));
    restoreState(loaded.value, loaded.storage);
    const result = await work();
    if (!mutating || !result || result.status >= 400) return result;

    const saved = await saveRuntimeState(RUNTIME_STATE_KEY, snapshotState(), loaded.version);
    if (saved.ok) return result;
  }

  return {
    status: 409,
    body: { error: "state_conflict", message: "Please try again." }
  };
}

export async function staffStorageStatus() {
  if (!hasDurableStore()) return { storage: "memory", connected: false, version: 0 };
  const loaded = await loadRuntimeState(RUNTIME_STATE_KEY, snapshotState(createState()));
  return { storage: loaded.storage, connected: true, version: loaded.version };
}

export function resetDummy() {
  state = createState();
  return state;
}

export function isDummy() {
  return DUMMY_DATA;
}

function skuQty(map, sku, n) {
  map[sku] = (map[sku] || 0) + n;
}

function ordersAt(stopId) {
  const ids = state.orderIdsByStop.get(stopId) || [];
  return ids.map(id => state.ordersById.get(id)).filter(Boolean);
}

function funnelOf(list) {
  const f = { reserved: 0, packed: 0, loaded: 0, at_stop: 0, collected: 0, missed: 0, returned: 0 };
  for (const o of list) {
    if (f[o.status] != null) f[o.status] += 1;
  }
  return f;
}

function liveStopCount() {
  if (typeof state === "undefined" || !state || !state.studios) return STUDIO_COUNT;
  return state.studios.length;
}

function remainingOnCart() {
  const rem = emptySkuMap();
  for (const sku of Object.keys(rem)) rem[sku] = state.beat.opening[sku] || 0;
  for (const o of state.orders) {
    if (!["packed", "loaded", "at_stop", "collected"].includes(o.status)) continue;
    for (const line of o.lines) rem[line.id] = (rem[line.id] || 0) - (Number(line.qty) || 1);
  }
  return rem;
}

function movementsOf() {
  const out = {};
  for (const s of SKUS) {
    out[s.id] = { inbound: state.beat.opening[s.id] || 0, packed: 0, loaded: 0, collected: 0, missed: 0, leftover: 0 };
  }
  for (const o of state.orders) {
    for (const line of o.lines) {
      const q = Number(line.qty) || 1;
      const row = out[line.id];
      if (!row) continue;
      if (o.status === "packed" || o.status === "loaded" || o.status === "at_stop") row.packed += q;
      if (o.status === "loaded" || o.status === "at_stop") row.loaded += q;
      if (o.status === "collected") row.collected += q;
      if (o.status === "missed") row.missed += q;
    }
  }
  for (const sku of Object.keys(out)) {
    out[sku].leftover = (state.beat.opening[sku] || 0) - out[sku].collected;
  }
  return out;
}

function gatesOf(funnel, led) {
  const bags = state.orders.length;
  const decided = (funnel.collected || 0) + (funnel.missed || 0);
  const opening = Object.values(led.opening).reduce((a, b) => a + (b || 0), 0);
  const missedUnits = Object.values(led.missed).reduce((a, b) => a + (b || 0), 0);
  let keep = 0;
  let amount = 0;
  for (const o of state.orders) {
    if (o.status !== "collected") continue;
    keep += o.kept || 0;
    amount += o.amount || 0;
  }
  return {
    proposed: true,
    participation: { num: bags, den: MEMBER_COUNT, label: "bags / members" },
    sellThrough: { num: funnel.collected || 0, den: decided || 0, label: "collected / decided" },
    preorderFill: { num: funnel.collected || 0, den: bags || 0, label: "collected / bags tonight" },
    memberSaving: { num: keep, den: amount || 0, label: "kept Rs / bag Rs" },
    inventoryLoss: { num: missedUnits, den: opening || 0, label: "missed units / opening" },
    contribution: { num: keep, den: amount || 0, label: "kept Rs / take Rs" }
  };
}

export function addStudio(body = {}) {
  if (!state.studios) state.studios = STUDIOS.map(s => ({ ...s }));
  const seq = state.studios.length + 1;
  const id = "S" + String(seq).padStart(2, "0");
  if (state.studios.some(s => s.id === id)) return { error: "stop_exists", status: 409, stopId: id };
  const studio = {
    id,
    seq,
    name: String(body.name || ("Nia Nest " + id)).slice(0, 48),
    theatre: THEATRE.id,
    theatreName: THEATRE.name,
    hub: THEATRE.hub,
    area: THEATRE.area,
    slot: THEATRE.slot
  };
  state.studios.push(studio);
  state.orderIdsByStop.set(id, []);
  return { ok: true, stop: studio, stopCount: state.studios.length, rewritten: false };
}

function stopProgress() {
  const list = state.studios || STUDIOS;
  return list.map(s => {
    const bags = ordersAt(s.id);
    const f = funnelOf(bags);
    const open = f.reserved + f.packed + f.loaded + f.at_stop;
    const row = {
      stopId: s.id,
      name: s.name,
      area: s.area,
      bags: bags.length,
      collected: f.collected,
      missed: f.missed,
      reserved: f.reserved,
      packed: f.packed,
      loaded: f.loaded,
      at_stop: f.at_stop,
      open,
      seq: s.seq
    };
    if (s.lat != null && s.lng != null) {
      row.lat = s.lat;
      row.lng = s.lng;
    }
    return row;
  });
}

export function ledgerOf(beatDate) {
  const date = beatDate && beatDate !== "today" ? beatDate : state.beat.beatDate;
  const opening = clone(state.beat.opening);
  const reserved = emptySkuMap();
  const collected = emptySkuMap();
  const missed = emptySkuMap();
  const leftover = emptySkuMap();
  let orderCount = 0;
  for (const o of state.orders) {
    if (o.beatDate !== date) continue;
    orderCount += 1;
    for (const line of o.lines) {
      const q = Number(line.qty) || 1;
      if (o.status === "collected") skuQty(collected, line.id, q);
      else if (o.status === "missed") skuQty(missed, line.id, q);
      else if (o.status !== "returned") skuQty(reserved, line.id, q);
    }
  }
  for (const sku of Object.keys(opening)) {
    leftover[sku] = (opening[sku] || 0) - (collected[sku] || 0);
  }
  const rows = Object.keys(opening).sort().map(sku => {
    const o = opening[sku] || 0;
    const c = collected[sku] || 0;
    const l = leftover[sku] || 0;
    const delta = o - c - l;
    return {
      sku,
      opening: o,
      reserved: reserved[sku] || 0,
      collected: c,
      missed: missed[sku] || 0,
      leftover: l,
      delta,
      ok: delta === 0
    };
  });
  return {
    beatDate: date,
    theatre: THEATRE.name,
    stopCount: liveStopCount(),
    memberCount: MEMBER_COUNT,
    orderCount,
    opening,
    reserved,
    collected,
    missed,
    leftover,
    owner: OWNER,
    rows,
    balanced: rows.every(r => r.ok)
  };
}

function missRate(led) {
  let c = 0;
  let m = 0;
  for (const sku of Object.keys(led.collected)) {
    c += led.collected[sku] || 0;
    m += led.missed[sku] || 0;
  }
  const den = c + m;
  if (!den) return 0;
  return Math.round((m / den) * 100);
}

function predictFromLedger(led) {
  const rate = missRate(led);
  const load = Object.keys(led.opening).sort().map(sku => {
    const collected = led.collected[sku] || 0;
    const reserved = led.reserved[sku] || 0;
    const tomorrow_qty = collected + Math.round(reserved * (1 - rate / 100));
    let why = collected + " collected";
    why += reserved ? " · " + reserved + " still holding" : " · nothing still holding";
    if (rate) why += " · miss_rate " + rate + "%";
    return { sku, collected, reserved, miss_rate: rate, tomorrow_qty, why };
  });
  return { miss_rate: rate, load };
}

function parseCsv(text) {
  const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const split = (line) => {
    const out = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === "\"") {
        if (q && line[i + 1] === "\"") {
          cur += "\"";
          i += 1;
          continue;
        }
        q = !q;
        continue;
      }
      if (ch === "," && !q) {
        out.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = split(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, "_"));
  const rows = lines.slice(1).map(line => {
    const cols = split(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i] || ""; });
    return obj;
  });
  return { headers, rows };
}

function uploadMeta(id) {
  const u = state.uploads && state.uploads[id];
  if (!u) return { status: "empty", rows: 0, filename: "", uploadedAt: null };
  return { status: "ok", rows: u.rowCount, filename: u.filename, uploadedAt: u.at };
}

export function connectorsPayload() {
  const led = ledgerOf();
  const procure = uploadMeta("procure");
  const vendors = uploadMeta("vendors");
  const upi = uploadMeta("upi_statement");
  return {
    product: "polo",
    skip: DUMMY_DATA,
    theatre: THEATRE.name,
    stopCount: liveStopCount(),
    memberCount: MEMBER_COUNT,
    sources: [
      { id: "ledger", kind: "api", status: "ok", rows: led.rows.length },
      { id: "procure", kind: "csv", status: procure.status, rows: procure.rows, filename: procure.filename, uploadedAt: procure.uploadedAt },
      { id: "members", kind: "sheet", status: "ok", rows: MEMBER_COUNT },
      { id: "vendors", kind: "csv", status: vendors.status, rows: vendors.rows, filename: vendors.filename, uploadedAt: vendors.uploadedAt },
      { id: "upi_statement", kind: "csv", status: upi.status, rows: upi.rows, filename: upi.filename, uploadedAt: upi.uploadedAt }
    ]
  };
}

export function uploadConnector({ kind, csv, filename }) {
  const k = String(kind || "");
  if (!["upi_statement", "procure", "vendors"].includes(k)) {
    return { error: "bad_kind", status: 400 };
  }
  const raw = String(csv == null ? "" : csv);
  if (!raw.trim()) return { error: "empty_csv", status: 400 };
  const parsed = parseCsv(raw);
  const at = now();
  const name = String(filename || "upload.csv");
  if (!state.uploads) state.uploads = { upi_statement: null, procure: null, vendors: null };
  state.uploads[k] = { kind: k, filename: name, at, rows: parsed.rows, rowCount: parsed.rows.length };
  if (k === "upi_statement") {
    state.statement = parsed.rows.map((r, i) => ({
      id: "stmt-up-" + (i + 1),
      date: r.date || r.beat || WEEK_BEAT,
      utr: r.utr || r.ref || r.utr_no || "",
      amount: Number(r.amount || r.rs || r.inr) || 0,
      note: r.note || r.narration || r.remark || "",
      matched: false,
      settlementId: null
    }));
    matchStatement(state.settlements, state.statement);
  }
  return {
    ok: true,
    kind: k,
    filename: name,
    rows: parsed.rows.length,
    uploadedAt: at,
    persist: state.persist,
    connectors: connectorsPayload()
  };
}

export function sourcePayload() {
  const u = state.uploads && state.uploads.procure;
  const vendors = state.uploads && state.uploads.vendors;
  if (!u) {
    return {
      from: "No file yet",
      sheetFrom: { procure: "No file yet", vendors: vendors ? vendors.filename : "No file yet" },
      theatre: THEATRE.name,
      sources: []
    };
  }
  return {
    from: u.filename,
    sheetFrom: { procure: u.filename, vendors: vendors ? vendors.filename : "No file yet" },
    theatre: THEATRE.name,
    uploadedAt: u.at,
    rows: u.rowCount,
    sources: u.rows.map(r => ({
      sku: r.sku || "",
      name: r.name || "",
      vendor: r.vendor || "",
      source: r.vendor || "",
      niaCost: Number(r.buy_inr) || 0,
      kirana: r.kirana === "" || r.kirana == null ? null : Number(r.kirana),
      keep: Number(r.keep_qty) || 0,
      lead_days: r.lead_days === "" || r.lead_days == null ? null : Number(r.lead_days) || null,
      last_buy: r.last_buy || "",
      status: r.status || ""
    }))
  };
}

export function stockPayload() {
  const led = ledgerOf();
  return {
    beatDate: led.beatDate,
    theatre: THEATRE.name,
    stopCount: liveStopCount(),
    opening: led.opening,
    stock: led.leftover,
    remaining: remainingOnCart(),
    movements: movementsOf(),
    holding: Object.entries(led.reserved).filter(([, n]) => n > 0).map(([sku, qty]) => ({ sku, qty })),
    owner: OWNER,
    nextBeat: state.beat.nextBeat,
    spokenBeat: state.beat.spokenBeat,
    persist: state.persist,
    blob: state.blob
  };
}

function daysBetween(from, to) {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

function lastBuyOf(sku) {
  const u = state.uploads && state.uploads.procure && state.uploads.procure.rows;
  if (u) {
    const row = u.find(r => r.sku === sku);
    if (row && row.last_buy) return row.last_buy;
  }
  const item = skuOf(sku);
  return item.last_buy || "";
}

export function ageingPayload() {
  const led = ledgerOf();
  const beat = led.beatDate;
  const rows = Object.keys(led.opening).sort().map(sku => {
    const buy = lastBuyOf(sku);
    const daysSitting = buy ? daysBetween(buy, beat) : daysBetween(state.beat.openedAt.slice(0, 10), beat) || 1;
    const leftover = led.leftover[sku] || 0;
    const missed = led.missed[sku] || 0;
    return {
      sku,
      daysSitting,
      leftoverAge: leftover ? daysSitting : 0,
      leftover,
      missed,
      opening: led.opening[sku] || 0,
      sitting: { num: daysSitting, den: 90, label: "days sitting / 90" }
    };
  });
  const over7 = rows.filter(r => r.daysSitting >= 7);
  const leftoverUnits = rows.reduce((n, r) => n + r.leftover, 0);
  const leftoverAged = rows.filter(r => r.leftoverAge >= 7).reduce((n, r) => n + r.leftover, 0);
  const missedUnits = rows.reduce((n, r) => n + r.missed, 0);
  const decidedUnits = rows.reduce((n, r) => n + (led.collected[r.sku] || 0) + r.missed, 0);
  return {
    beatDate: beat,
    theatre: THEATRE.name,
    stopCount: liveStopCount(),
    owner: OWNER,
    proposed: true,
    sitting: { num: over7.length, den: rows.length, label: "SKUs sitting 7 or more days / SKUs" },
    leftoverAge: { num: leftoverAged, den: leftoverUnits || 0, label: "leftover aged 7 or more / leftover" },
    missStuck: { num: missedUnits, den: decidedUnits || 0, label: "miss that did not move / decided" },
    rows
  };
}

export function inventoryPayload() {
  const stock = stockPayload();
  const led = ledgerOf();
  const lots = led.rows.map(r => ({
    sku: r.sku,
    owner: OWNER,
    opening: r.opening,
    inbound: (stock.movements[r.sku] && stock.movements[r.sku].inbound) || r.opening,
    reserved: r.reserved,
    collected: r.collected,
    leftover: r.leftover,
    missed: r.missed,
    onHand: r.leftover,
    packed: (stock.movements[r.sku] && stock.movements[r.sku].packed) || 0,
    loaded: (stock.movements[r.sku] && stock.movements[r.sku].loaded) || 0
  }));
  return {
    beatDate: stock.beatDate,
    theatre: stock.theatre,
    stopCount: stock.stopCount,
    owner: OWNER,
    stock,
    ledger: led,
    lots,
    movements: stock.movements
  };
}

export function placeMemberOrder(body = {}) {
  const linesIn = Array.isArray(body.lines) ? body.lines : [];
  if (!linesIn.length) return { error: "no_lines", status: 400 };
  const lines = linesIn.map(l => {
    const item = skuOf(l.id);
    return {
      id: l.id,
      qty: Number(l.qty) || 1,
      nia: Number(l.nia) || item.nia,
      kirana: Number(l.kirana) || item.kirana
    };
  });
  const amount = orderAmount(lines);
  const kept = lines.reduce((n, l) => n + ((skuOf(l.id).keep || 0) * (l.qty || 1)), 0);
  const pickupCode = "M" + String(state.orders.length + 1).padStart(4, "0");
  const memberId = String(body.memberId || body.phone || "ravi");
  const order = {
    id: "ord-" + pickupCode.toLowerCase(),
    pickupCode,
    member: body.member || memberId,
    memberId,
    phone: body.phone || memberId,
    stopId: body.stopId || "S01",
    nest: "",
    lines,
    pickup: body.pickup || "after 5",
    slot: body.slot || SLOT,
    beatDate: body.beatDate || WEEK_BEAT,
    cart: body.cart || "studio",
    fulfillment: body.fulfillment || "hub_collect",
    status: "reserved",
    kept,
    upiRef: body.upiRef || "",
    owner: OWNER,
    payStatus: "skip",
    amount,
    due: amount,
    paid: 0,
    method: "cash",
    date: body.beatDate || WEEK_BEAT
  };
  state.orders.push(order);
  state.ordersById.set(order.id, order);
  state.ordersByCode.set(order.pickupCode, order);
  if (!state.orderIdsByStop.has(order.stopId)) state.orderIdsByStop.set(order.stopId, []);
  state.orderIdsByStop.get(order.stopId).push(order.id);
  state.reservations.push({
    id: "res-" + order.pickupCode,
    orderId: order.id,
    beatDate: order.beatDate,
    sku: lines[0].id,
    qty: lines[0].qty,
    status: "holding"
  });
  return {
    id: order.id,
    pickupCode: order.pickupCode,
    kept,
    beat: order.beatDate === WEEK_BEAT ? "tonight" : "next beat",
    memberId,
    payStatus: "skip",
    trigger: "collected",
    settled: false,
    stock: remainingOnCart()
  };
}

export function authOtp() {
  return { ok: true, skip: true, sent: false };
}

export function authVerify(body = {}) {
  const phone = String(body.phone || "ravi");
  state.memberSession = { memberId: phone, phone };
  return { ok: true, skip: true, memberId: phone, phone };
}

export function authMe() {
  const session = state.memberSession || { memberId: "ravi", phone: "ravi" };
  const memberId = String(session.memberId || "ravi");
  return {
    ok: true,
    skip: true,
    memberId,
    phone: session.phone,
    flags: (state.memberFlagsById && state.memberFlagsById[memberId]) || {},
    answers: (state.memberAnswersById && state.memberAnswersById[memberId]) || []
  };
}

export function memberPayload(query = {}) {
  const session = state.memberSession || { memberId: "ravi", phone: "ravi" };
  const id = String(query.memberId || query.phone || session.memberId || "ravi");
  const row = memberById.get(id) || memberById.get("ravi");
  return {
    memberId: row.memberId,
    name: row.name,
    studioId: row.studioId,
    nest: row.nest,
    hub: row.hub,
    theatre: row.theatre,
    hasMira: row.hasMira,
    friday_send: row.friday_send,
    last_bag: row.last_bag,
    last_mira: row.last_mira,
    phone: session.phone || row.memberId,
    flags: (state.memberFlagsById && state.memberFlagsById[id]) || {},
    answers: (state.memberAnswersById && state.memberAnswersById[id]) || [],
    ok: true,
    skip: true
  };
}

export function memberOrderGet(query = {}) {
  const session = state.memberSession || { memberId: "ravi", phone: "ravi" };
  const memberId = String(query.memberId || query.phone || session.memberId || "ravi");
  const orders = state.orders.filter(o => o.memberId === memberId);
  return {
    skip: true,
    memberId,
    orderCount: orders.length,
    orders
  };
}

export function saveMemberFlags(body = {}) {
  const flags = body.flags && typeof body.flags === "object" ? body.flags : {};
  const session = state.memberSession || { memberId: "ravi" };
  const memberId = String(body.memberId || body.phone || session.memberId || "ravi");
  if (!state.memberFlagsById) state.memberFlagsById = {};
  state.memberFlagsById[memberId] = { ...(state.memberFlagsById[memberId] || {}), ...flags };
  state.memberFlags = state.memberFlagsById.ravi || {};
  return { ok: true, skip: true, memberId, flags: state.memberFlagsById[memberId] };
}

export function saveMemberAnswer(body = {}) {
  const session = state.memberSession || { memberId: "ravi" };
  const memberId = String(body.memberId || body.phone || session.memberId || "ravi");
  const row = { tab: body.tab || "", qid: body.qid || "", val: body.val, at: now() };
  if (!state.memberAnswersById) state.memberAnswersById = {};
  state.memberAnswersById[memberId] = (state.memberAnswersById[memberId] || []).concat([row]);
  state.memberAnswers = state.memberAnswersById.ravi || [];
  return { ok: true, skip: true, memberId };
}

export function beatPayload() {
  return {
    beatDate: state.beat.beatDate,
    open: state.beat.open,
    openedAt: state.beat.openedAt,
    closed: state.beat.closed,
    closedAt: state.beat.closedAt,
    opening: state.beat.opening,
    owner: OWNER,
    theatre: THEATRE.name,
    hub: THEATRE.hub,
    stopCount: liveStopCount(),
    memberCount: MEMBER_COUNT,
    bagsTonight: state.orders.length,
    bagsPerStop: BEAT_BAGS_PER_STOP,
    nextBeat: state.beat.nextBeat,
    spokenBeat: state.beat.spokenBeat,
    persist: state.persist,
    blob: state.blob
  };
}

export function stopsPayload() {
  return {
    ok: true,
    theatre: THEATRE.name,
    hub: THEATRE.hub,
    area: THEATRE.area,
    beatDate: state.beat.beatDate,
    slot: SLOT,
    stopCount: liveStopCount(),
    memberCount: MEMBER_COUNT,
    membersPerStudio: MEMBERS_PER_STUDIO,
    bagsTonight: state.orders.length,
    bagsPerStop: BEAT_BAGS_PER_STOP,
    stops: stopProgress(),
    skip: DUMMY_DATA
  };
}

export function ordersPayload(query = {}) {
  const pickup = query.pickup;
  const beat = query.beat;
  const stop = query.stop;
  const today = state.beat.beatDate;
  const f = funnelOf(state.orders);
  const base = {
    beatDate: today,
    nextBeat: state.beat.nextBeat,
    spokenBeat: state.beat.spokenBeat,
    owner: OWNER,
    theatre: THEATRE.name,
    stopCount: liveStopCount(),
    memberCount: MEMBER_COUNT,
    bagsTonight: state.orders.length,
    bagsPerStop: BEAT_BAGS_PER_STOP,
    remaining: remainingOnCart(),
    orderCount: state.orders.length,
    byStatus: f,
    skip: DUMMY_DATA
  };
  if (stop) {
    const studio = studioById.get(stop);
    return {
      ...base,
      stop,
      stopName: studio?.name || stop,
      orders: ordersAt(stop)
    };
  }
  return {
    ...base,
    stops: stopProgress(),
    orders: [],
    note: pickup === "today" || beat === "today" || beat || pickup
      ? "pass stop=S01 to load that stop only"
      : "pass stop to load bags for one stop"
  };
}

export function cashPayload(query = {}) {
  const today = state.beat.beatDate;
  const stop = query.stop;
  const money = o => o.beatDate === today && (o.status === "reserved" || o.status === "collected" || o.status === "packed" || o.status === "loaded" || o.status === "at_stop");
  const collected = state.orders.filter(o => o.status === "collected");
  const due = collected.reduce((s, o) => s + o.amount, 0);
  const base = {
    beatDate: today,
    theatre: THEATRE.name,
    stopCount: liveStopCount(),
    collectedCount: collected.length,
    dueToday: due,
    paidIn: due,
    skip: DUMMY_DATA
  };
  if (stop) {
    return { ...base, stop, orders: ordersAt(stop).filter(money) };
  }
  return {
    ...base,
    stops: stopProgress(),
    orders: [],
    note: "pass stop=S01 to load money rows for that stop"
  };
}

export function saveCash({ orderId, method, upiRef, amount }) {
  const order = state.ordersById.get(orderId);
  if (!order) return { error: "order_not_found", status: 404 };
  order.method = method === "upi" ? "upi" : "cash";
  order.upiRef = String(upiRef || "");
  if (amount != null) order.amount = Number(amount) || order.amount;
  state.cash[orderId] = { method: order.method, upiRef: order.upiRef, amount: order.amount, live: false };
  return { ok: true, cash: state.cash[orderId] };
}

export function reconPayload() {
  const led = ledgerOf();
  return {
    ok: true,
    saved: state.beat.closed,
    beatDate: led.beatDate,
    theatre: THEATRE.name,
    stopCount: liveStopCount(),
    orderCount: led.orderCount,
    opening: led.opening,
    reserved: led.reserved,
    collected: led.collected,
    missed: led.missed,
    leftover: led.leftover,
    closing: clone(led.leftover),
    rows: led.rows,
    balanced: led.balanced
  };
}

export function nextPayload() {
  const led = ledgerOf();
  const pred = predictFromLedger(led);
  const predicted = {};
  for (const row of pred.load) predicted[row.sku] = row.tomorrow_qty;
  return {
    beatDate: led.beatDate,
    nextBeatDate: NEXT_BEAT,
    owner: OWNER,
    slot: SLOT,
    theatre: THEATRE.name,
    stopCount: liveStopCount(),
    leftover: led.leftover,
    load: pred.load,
    predicted,
    suggested: predicted,
    opening: state.nextOpening,
    already_open: false
  };
}

export function predictPayload() {
  const led = ledgerOf();
  const pred = predictFromLedger(led);
  const bagByMember = new Map();
  const chaseAll = [];
  for (const o of state.orders) {
    if (o.status !== "missed") bagByMember.set(o.memberId, o);
    if (["reserved", "packed", "loaded", "at_stop"].includes(o.status)) {
      chaseAll.push({
        pickupCode: o.pickupCode,
        status: o.status,
        stopId: o.stopId,
        why: o.status === "at_stop" ? "At stop · collect by code" : o.status === "packed" ? "Packed · studio cart" : o.status === "loaded" ? "On the cart" : "Still reserved"
      });
    }
  }
  const quietAll = [];
  const sendAll = [];
  const memberSample = [];
  for (const m of MEMBERS) {
    const bag = bagByMember.get(m.memberId);
    const hasBag = Boolean(bag);
    if (!hasBag && !m.hasMira) {
      if (quietAll.length < SAMPLE) quietAll.push({ memberId: m.memberId, why: "Sheet · no bag this beat · no Mira" });
    }
    if (m.friday_send === "pending" && sendAll.length < SAMPLE) {
      sendAll.push({ memberId: m.memberId, why: "Sheet · week extra · send pending" });
    }
    if (hasBag && memberSample.length < SAMPLE) {
      memberSample.push({
        memberId: m.memberId,
        nest: m.nest,
        hub: m.hub,
        hasBag: true,
        hasMira: m.hasMira,
        bagStatus: bag.status,
        friday_send: m.friday_send,
        last_bag: m.last_bag,
        last_mira: m.last_mira
      });
    }
  }
  let quietCount = 0;
  let sendCount = 0;
  for (const m of MEMBERS) {
    if (!bagByMember.has(m.memberId) && !m.hasMira) quietCount += 1;
    if (m.friday_send === "pending") sendCount += 1;
  }
  const procureRows = (state.uploads && state.uploads.procure && state.uploads.procure.rows) || [];
  const source = procureRows.length
    ? procureRows.map(r => ({
      sku: r.sku || "",
      source: r.vendor || "",
      leftover: led.leftover[r.sku] || 0,
      why: (r.status || "on file") + " · buy " + (r.buy_inr || "-") + " · keep " + (r.keep_qty || "-")
    }))
    : [];
  const dueAll = state.settlements.filter(s => s.beatDate === led.beatDate && !s.matched);
  const settlementsDue = dueAll.slice(0, SAMPLE).map(s => ({
    pickupCode: s.pickupCode,
    amount: s.amount,
    why: "Collected · statement not matched"
  }));
  const funnel = funnelOf(state.orders);
  return {
    beatDate: led.beatDate,
    owner: OWNER,
    slot: SLOT,
    theatre: THEATRE.name,
    stopCount: liveStopCount(),
    memberCount: MEMBER_COUNT,
    skip: DUMMY_DATA,
    miss_rate: pred.miss_rate,
    gates: gatesOf(funnel, led),
    load: pred.load,
    chase: chaseAll.slice(0, CHASE_SAMPLE),
    chaseCount: chaseAll.length,
    members: memberSample,
    quietMembers: quietAll,
    quietCount,
    sendPending: sendAll,
    sendCount,
    source,
    settlementsDue,
    settlementsDueCount: dueAll.length,
    sheetFrom: {
      procure: (state.uploads && state.uploads.procure) ? state.uploads.procure.filename : "No file yet",
      members: "From sheet"
    },
    note: "Samples only. Full 3000 stay on the member book."
  };
}

export function settlementsPayload(query = {}) {
  const date = !query.beat || query.beat === "today" ? state.beat.beatDate : query.beat;
  const all = state.settlements.filter(s => s.beatDate === date);
  const statement = state.statement.filter(s => s.date === date);
  const unmatchedSet = all.filter(s => !s.matched);
  const matchedSet = all.filter(s => s.matched);
  const unmatchedStmt = statement.filter(s => !s.matched);
  const matchedStmt = statement.filter(s => s.matched);
  const night = query.unmatched === "1" || query.unmatched === true || query.view === "match";
  const wantAll = night || query.limit == null || query.limit === "0" || query.limit === "all";
  let settlements;
  if (night) {
    settlements = unmatchedSet;
  } else if (wantAll) {
    settlements = unmatchedSet.concat(matchedSet);
  } else {
    const pageLimit = Math.min(200, Math.max(1, Number(query.limit) || PAGE));
    settlements = unmatchedSet.concat(matchedSet.slice(0, pageLimit));
  }
  return {
    beatDate: date,
    theatre: THEATRE.name,
    settlements,
    statement: unmatchedStmt.concat(matchedStmt),
    unmatchedSettlementsList: unmatchedSet,
    unmatchedStatementLines: unmatchedStmt,
    count: all.length,
    limit: wantAll || night ? settlements.length : Number(query.limit) || PAGE,
    offset: 0,
    unmatchedFirst: true,
    matched: matchedSet.length,
    unmatchedSettlements: unmatchedSet.length,
    unmatchedStatement: unmatchedStmt.length,
    trigger: "collected",
    liveUpi: false
  };
}

export function openBeat({ opening, beatDate, replace }) {
  const date = beatDate || state.beat.beatDate;
  if (state.beat.open && state.beat.beatDate === date && !replace) {
    return { error: "already_open", status: 409, opening: state.beat.opening, beatDate: state.beat.beatDate };
  }
  const next = opening && typeof opening === "object" ? opening : state.beat.opening;
  const clean = emptySkuMap();
  for (const sku of Object.keys(clean)) clean[sku] = Number(next[sku]) || 0;
  if (replace && date === state.beat.beatDate) {
    state.beat.opening = clean;
    return { ok: true, beatDate: date, opening: clean, replaced: true };
  }
  if (date === NEXT_BEAT || replace) {
    state.nextOpening = clean;
    return { ok: true, beatDate: date, opening: clean, queued: date !== state.beat.beatDate };
  }
  state.beat.open = true;
  state.beat.closed = false;
  state.beat.closedAt = null;
  state.beat.openedAt = now();
  state.beat.opening = clean;
  state.beat.beatDate = date;
  return { ok: true, beatDate: date, opening: clean };
}

export function closeBeat({ closing, beatDate }) {
  const led = ledgerOf(beatDate);
  const closeMap = closing && typeof closing === "object" ? closing : {};
  const mismatch = [];
  for (const sku of Object.keys(led.leftover)) {
    const want = led.leftover[sku] || 0;
    const got = Number(closeMap[sku]);
    if (!Number.isFinite(got) || got !== want) {
      mismatch.push({ sku, leftover: want, closing: Number.isFinite(got) ? got : null });
    }
  }
  if (mismatch.length) {
    return { error: "closing_ne_leftover", status: 409, mismatch, identity: "opening - collected - leftover = 0" };
  }
  state.beat.closed = true;
  state.beat.closedAt = now();
  return { ok: true, saved: true, beatDate: led.beatDate, leftover: led.leftover };
}

function expectedFrom(status) {
  if (status === "reserved" || status === "paid") return "packed";
  if (status === "packed") return "loaded";
  if (status === "loaded") return "at_stop";
  if (status === "at_stop") return ["collected", "missed"];
  if (status === "collected") return "returned";
  return null;
}

export function scanOrder({ type, orderId, pickupCode, actor }) {
  const order = (orderId && state.ordersById.get(orderId)) || (pickupCode && state.ordersByCode.get(String(pickupCode).trim().toUpperCase()));
  if (!order) return { error: "order_not_found", status: 404 };
  const kind = SCAN_TYPES[type];
  if (!kind) return { error: "bad_scan_type", status: 400 };
  if (kind === "collected" && order.status === "collected") {
    const code = String(pickupCode || "").trim().toUpperCase();
    if (code && code === order.pickupCode) return { ok: true, order, already: true };
  }
  const expected = expectedFrom(order.status);
  const ok = Array.isArray(expected) ? expected.includes(kind) : expected === kind;
  const officerCollect = (kind === "collected" || kind === "missed")
    && ["reserved", "paid", "packed", "loaded", "at_stop"].includes(order.status);
  const hubReturn = kind === "returned" && ["loaded", "packed"].includes(order.status);
  if (!ok && !officerCollect && !hubReturn) return { error: "wrong_stage", status: 409, have: order.status, want: expected };
  if (kind === "packed") {
    const rem = remainingOnCart();
    for (const line of order.lines) {
      const q = Number(line.qty) || 1;
      if ((rem[line.id] || 0) < q) {
        return { error: "last_unit_taken", status: 409, sku: line.id, remaining: rem[line.id] || 0 };
      }
    }
  }
  if (kind === "collected") {
    const code = String(pickupCode || "").trim().toUpperCase();
    if (!code || code !== order.pickupCode) return { error: "bad_pickup_code", status: 409 };
  }
  order.status = kind;
  state.scans.push({
    id: "scan-" + order.pickupCode + "-" + kind + "-" + state.scans.length,
    orderId: order.id,
    type: kind === "at_stop" ? "arrived" : kind,
    actor: actor || "pickup",
    at: now()
  });
  if (kind === "collected") {
    order.payStatus = "captured";
    order.paid = order.amount;
    const set = {
      id: "set-" + order.pickupCode,
      orderId: order.id,
      pickupCode: order.pickupCode,
      memberId: order.memberId,
      beatDate: order.beatDate,
      amount: order.amount,
      trigger: "collected",
      status: "open",
      matched: false,
      utr: "",
      createdAt: now()
    };
    state.settlements = state.settlements.filter(s => s.orderId !== order.id).concat([set]);
    matchStatement(state.settlements, state.statement);
    state.reservations = state.reservations.filter(r => r.orderId !== order.id);
  }
  if (kind === "missed") {
    if (!state.exceptions.some(e => e.orderId === order.id)) {
      state.exceptions.push({
        id: "ex-" + order.pickupCode,
        orderId: order.id,
        kind: "miss",
        beatDate: order.beatDate,
        sku: order.lines[0].id,
        qty: order.lines[0].qty,
        at: now()
      });
    }
    state.reservations = state.reservations.filter(r => r.orderId !== order.id);
  }
  if (kind === "returned") {
    order.status = "returned";
  }
  return { ok: true, order };
}

export function towerPayload() {
  const led = ledgerOf();
  const pred = predictFromLedger(led);
  const set = settlementsPayload({ beat: "today", limit: "0" });
  const funnel = funnelOf(state.orders);
  const progress = stopProgress();
  const sum = map => Object.values(map).reduce((a, b) => a + (b || 0), 0);
  const chaseCount = funnel.reserved + funnel.packed + funnel.loaded + funnel.at_stop;
  return {
    product: "polo",
    skip: DUMMY_DATA,
    beatDate: led.beatDate,
    owner: OWNER,
    slot: SLOT,
    theatre: THEATRE.name,
    hub: THEATRE.hub,
    area: THEATRE.area,
    stopCount: liveStopCount(),
    memberCount: MEMBER_COUNT,
    membersPerStudio: MEMBERS_PER_STUDIO,
    bagsTonight: state.orders.length,
    bagsPerStop: BEAT_BAGS_PER_STOP,
    kpis: {
      opening: sum(led.opening),
      onHand: sum(led.leftover),
      reserved: sum(led.reserved),
      collected: sum(led.collected),
      missed: sum(led.missed),
      leftover: sum(led.leftover),
      miss_rate: pred.miss_rate,
      daysOfStock: { num: sum(led.leftover), den: sum(led.collected) || 0, label: "leftover / collected" },
      balanced: led.balanced,
      stops: liveStopCount(),
      members: MEMBER_COUNT,
      bags: state.orders.length,
      chase: chaseCount
    },
    ageing: ageingPayload(),
    gates: gatesOf(funnel, led),
    funnel,
    stopProgress: progress,
    connectors: connectorsPayload(),
    predict: {
      miss_rate: pred.miss_rate,
      load: pred.load,
      chaseCount,
      chase: [],
      quietCount: 0,
      sendCount: 0
    },
    settlements: {
      count: set.count,
      matched: set.matched,
      unmatchedSettlements: set.unmatchedSettlements,
      unmatchedStatement: set.unmatchedStatement,
      trigger: set.trigger,
      liveUpi: false
    },
    ledger: {
      beatDate: led.beatDate,
      orderCount: led.orderCount,
      opening: led.opening,
      collected: led.collected,
      leftover: led.leftover,
      missed: led.missed,
      reserved: led.reserved,
      rows: led.rows,
      balanced: led.balanced
    },
    ops: {
      poOpen: (state.pos || []).filter(p => p.status === "open").length,
      poSent: (state.pos || []).filter(p => p.status === "sent").length,
      poReceived: (state.pos || []).filter(p => p.status === "received").length,
      invoices: (state.invoices || []).length,
      dispatchNotes: (state.dispatches || []).length,
      bikerRuns: (state.bikerRuns || []).length
    }
  };
}

export function jsonSize(obj) {
  return JSON.stringify(obj).length;
}

function queryOf(url) {
  const q = {};
  url.searchParams.forEach((v, k) => { if (k !== "path") q[k] = v; });
  return q;
}

const GSTIN_PHONE = "this phone";

function procureBook() {
  const u = state.uploads && state.uploads.procure && state.uploads.procure.rows;
  if (u && u.length) {
    return u.map(r => ({
      sku: r.sku || "",
      vendor: r.vendor || "",
      niaCost: Number(r.buy_inr) || 0,
      name: r.name || r.sku || ""
    }));
  }
  return SKUS.map(s => ({ sku: s.id, vendor: s.vendor, niaCost: s.nia, name: s.id }));
}

function draftPoLines() {
  const next = nextPayload();
  const book = Object.fromEntries(procureBook().map(r => [r.sku, r]));
  const lines = [];
  for (const row of next.load) {
    const qty = Number(row.tomorrow_qty) || 0;
    if (!qty) continue;
    const p = book[row.sku] || { sku: row.sku, vendor: skuOf(row.sku).vendor, niaCost: skuOf(row.sku).nia };
    lines.push({
      sku: row.sku,
      vendor: p.vendor || "",
      qty,
      niaCost: Number(p.niaCost) || 0,
      beatDate: next.nextBeatDate
    });
  }
  return lines;
}

function poCounts() {
  const list = state.pos || [];
  return {
    open: list.filter(p => p.status === "open").length,
    sent: list.filter(p => p.status === "sent").length,
    received: list.filter(p => p.status === "received").length,
    cancelled: list.filter(p => p.status === "cancelled").length
  };
}

export function poPayload() {
  return {
    skip: DUMMY_DATA,
    theatre: THEATRE.name,
    beatDate: state.beat.beatDate,
    nextBeatDate: NEXT_BEAT,
    slot: SLOT,
    draft: draftPoLines(),
    pos: state.pos || [],
    counts: poCounts()
  };
}

export function mutatePo(body = {}) {
  const action = body.action || "create";
  if (action === "create") {
    const lines = Array.isArray(body.lines) && body.lines.length ? body.lines : draftPoLines();
    if (!lines.length) return { error: "no_lines", status: 400 };
    const poId = "PO-" + String((state.pos || []).length + 1).padStart(4, "0");
    const po = {
      poId,
      status: "open",
      vendor: body.vendor || lines[0].vendor || "",
      beatDate: body.beatDate || lines[0].beatDate || NEXT_BEAT,
      lines,
      amount: lines.reduce((n, l) => n + (Number(l.niaCost) || 0) * (Number(l.qty) || 0), 0),
      createdAt: now(),
      sentAt: null,
      receivedAt: null
    };
    state.pos.push(po);
    return { ok: true, poId, po, pos: state.pos, counts: poCounts() };
  }
  const po = (state.pos || []).find(p => p.poId === body.poId);
  if (!po) return { error: "po_not_found", status: 404 };
  if (action === "send") {
    if (po.status !== "open") return { error: "not_open", status: 409, have: po.status };
    po.status = "sent";
    po.sentAt = now();
    return { ok: true, poId: po.poId, po, counts: poCounts() };
  }
  if (action === "receive") {
    if (po.status === "received") return { error: "already_received", status: 409 };
    if (po.status === "cancelled") return { error: "cancelled", status: 409 };
    if (po.status !== "sent" && po.status !== "open") return { error: "not_receivable", status: 409, have: po.status };
    po.status = "received";
    po.receivedAt = now();
    for (const line of po.lines) {
      const sku = line.sku;
      const qty = Number(line.qty) || 0;
      if (!sku || !qty) continue;
      state.beat.opening[sku] = (state.beat.opening[sku] || 0) + qty;
    }
    return { ok: true, poId: po.poId, po, inbound: true, movements: movementsOf(), counts: poCounts() };
  }
  if (action === "cancel") {
    if (po.status === "received") return { error: "already_received", status: 409 };
    po.status = "cancelled";
    return { ok: true, poId: po.poId, po, counts: poCounts() };
  }
  return { error: "bad_action", status: 400 };
}

export function dispatchPayload(query = {}) {
  const stop = query.stop;
  const base = {
    beatDate: state.beat.beatDate,
    theatre: THEATRE.name,
    slot: SLOT,
    stopCount: liveStopCount(),
    notes: state.dispatches || [],
    stops: stopProgress()
  };
  if (!stop) {
    return { ...base, orders: [], unpacked: 0, packed: 0, loaded: 0, bags: 0 };
  }
  const studio = studioById.get(stop);
  const orders = ordersAt(stop).filter(o => !["collected", "missed", "returned"].includes(o.status));
  const unpacked = orders.filter(o => o.status === "reserved" || o.status === "paid");
  const packed = orders.filter(o => o.status === "packed");
  const loaded = orders.filter(o => o.status === "loaded" || o.status === "at_stop");
  return {
    ...base,
    stop,
    stopName: studio?.name || stop,
    orders,
    unpacked: unpacked.length,
    packed: packed.length,
    loaded: loaded.length,
    bags: orders.length
  };
}

export function mutateDispatch(body = {}) {
  const stop = body.stopId || body.stop;
  if (!stop) return { error: "stop_required", status: 400 };
  const action = body.action;
  const live = () => ordersAt(stop).filter(o => !["collected", "missed", "returned"].includes(o.status));
  if (action === "pack" || action === "pack_remaining") {
    let packed = 0;
    for (const o of live()) {
      if (o.status === "reserved" || o.status === "paid") {
        const r = scanOrder({ type: "packed", orderId: o.id, actor: "dispatch" });
        if (r.ok) packed += 1;
      }
    }
    return { ok: true, stop, packed, desk: dispatchPayload({ stop }) };
  }
  if (action === "load") {
    const unpacked = live().filter(o => o.status === "reserved" || o.status === "paid");
    if (unpacked.length) return { error: "unpacked_remain", status: 409, unpacked: unpacked.length };
    let loaded = 0;
    for (const o of live()) {
      if (o.status === "packed") {
        const r = scanOrder({ type: "loaded", orderId: o.id, actor: "dispatch" });
        if (r.ok) loaded += 1;
      }
    }
    return { ok: true, stop, loaded, desk: dispatchPayload({ stop }) };
  }
  if (action === "dispatch") {
    const unpacked = live().filter(o => o.status === "reserved" || o.status === "paid");
    if (unpacked.length) return { error: "unpacked_remain", status: 409, unpacked: unpacked.length };
    for (const o of live()) {
      if (o.status === "packed") scanOrder({ type: "loaded", orderId: o.id, actor: "dispatch" });
    }
    let arrived = 0;
    for (const o of live()) {
      if (o.status === "loaded") {
        const r = scanOrder({ type: "arrived", orderId: o.id, actor: "dispatch" });
        if (r.ok) arrived += 1;
      }
    }
    const after = live();
    const studio = (state.studios || STUDIOS).find(s => s.id === stop);
    const note = {
      noteId: "DN-" + String((state.dispatches || []).length + 1).padStart(4, "0"),
      beatDate: state.beat.beatDate,
      stopId: stop,
      stopName: studio?.name || stop,
      slot: SLOT,
      bags: after.length,
      packed: after.filter(o => ["packed", "loaded", "at_stop"].includes(o.status)).length,
      loaded: after.filter(o => o.status === "loaded" || o.status === "at_stop").length,
      arrived,
      at: now()
    };
    state.dispatches.push(note);
    return { ok: true, noteId: note.noteId, note, desk: dispatchPayload({ stop }) };
  }
  return { error: "bad_action", status: 400 };
}

export function invoicePayload() {
  const collected = state.orders.filter(o => o.status === "collected");
  const invoices = state.invoices || [];
  return {
    skip: DUMMY_DATA,
    theatre: THEATRE.name,
    beatDate: state.beat.beatDate,
    liveUpi: false,
    trigger: "collected",
    gstin: GSTIN_PHONE,
    invoices,
    collectedReady: collected.filter(o => !invoices.some(i => i.kind === "member" && i.pickupCode === o.pickupCode)).slice(0, 40).map(o => ({
      orderId: o.id,
      pickupCode: o.pickupCode,
      memberId: o.memberId,
      amount: o.amount,
      lines: o.lines,
      stopId: o.stopId
    })),
    posReady: (state.pos || []).filter(p => p.status === "received" && !invoices.some(i => i.kind === "vendor" && i.poId === p.poId))
  };
}

export function mutateInvoice(body = {}) {
  const action = body.action;
  if (action === "receipt") {
    const order = (body.orderId && state.ordersById.get(body.orderId))
      || (body.pickupCode && state.ordersByCode.get(String(body.pickupCode).trim().toUpperCase()));
    if (!order) return { error: "order_not_found", status: 404 };
    if (order.status !== "collected") return { error: "not_collected", status: 409, have: order.status };
    if ((state.invoices || []).some(i => i.kind === "member" && i.pickupCode === order.pickupCode)) {
      return { error: "already_invoiced", status: 409 };
    }
    const inv = {
      invoiceId: "INV-M-" + order.pickupCode,
      kind: "member",
      pickupCode: order.pickupCode,
      memberId: order.memberId,
      lines: order.lines,
      amount: order.amount,
      trigger: "collected",
      gstin: body.gstin || GSTIN_PHONE,
      liveUpi: false,
      beatDate: order.beatDate,
      createdAt: now()
    };
    state.invoices.push(inv);
    return { ok: true, invoiceId: inv.invoiceId, invoice: inv };
  }
  if (action === "vendor_bill") {
    const po = (state.pos || []).find(p => p.poId === body.poId);
    if (!po) return { error: "po_not_found", status: 404 };
    if ((state.invoices || []).some(i => i.kind === "vendor" && i.poId === po.poId)) {
      return { error: "already_billed", status: 409 };
    }
    const inv = {
      invoiceId: "INV-V-" + po.poId,
      kind: "vendor",
      poId: po.poId,
      vendor: po.vendor,
      amount: po.amount,
      lines: po.lines,
      gstin: body.gstin || GSTIN_PHONE,
      liveUpi: false,
      beatDate: po.beatDate,
      createdAt: now()
    };
    state.invoices.push(inv);
    return { ok: true, invoiceId: inv.invoiceId, invoice: inv };
  }
  return { error: "bad_action", status: 400 };
}

function bikerLive() {
  const out = [];
  for (const pin of SHOPS_30.shops) {
    for (const o of ordersAt(pin.stopId)) {
      if (!["collected", "missed", "returned"].includes(o.status)) out.push(o);
    }
  }
  return out;
}

function openBikerRun() {
  return (state.bikerRuns || []).find(r => r.status !== "returned" && r.status !== "closed") || null;
}

export function bikerPayload() {
  const live = bikerLive();
  const unpacked = live.filter(o => o.status === "reserved" || o.status === "paid");
  const packed = live.filter(o => o.status === "packed");
  const loaded = live.filter(o => o.status === "loaded");
  const atStop = live.filter(o => o.status === "at_stop");
  return {
    skip: true,
    liveUpi: false,
    bikeId: "BIKE-01",
    rider: "this phone",
    hub: SHOPS_30.hub,
    shops: SHOPS_30.shops.map(s => {
      const bags = ordersAt(s.stopId);
      const f = funnelOf(bags);
      const studio = (state.studios || STUDIOS).find(x => x.id === s.stopId) || {};
      return {
        stopId: s.stopId,
        name: studio.name || s.name,
        lat: s.lat,
        lng: s.lng,
        seq: s.seq,
        area: s.area,
        bags: bags.length,
        reserved: f.reserved,
        packed: f.packed,
        loaded: f.loaded,
        at_stop: f.at_stop,
        collected: f.collected
      };
    }),
    run: openBikerRun(),
    runs: state.bikerRuns || [],
    unpacked: unpacked.length,
    packed: packed.length,
    loaded: loaded.length,
    atStop: atStop.length,
    leftoverOnBike: loaded.length,
    slot: SLOT,
    beatDate: state.beat.beatDate,
    theatre: THEATRE.name
  };
}

export function mutateBiker(body = {}) {
  const action = body.action;
  if (action === "book") {
    const open = openBikerRun();
    if (open) return { error: "run_open", status: 409, runId: open.runId, run: open };
    const run = {
      runId: "RUN-" + String((state.bikerRuns || []).length + 1).padStart(4, "0"),
      bikeId: "BIKE-01",
      rider: "this phone",
      status: "booked",
      beatDate: state.beat.beatDate,
      slot: SLOT,
      drops: [],
      loadedAt: null,
      returnedAt: null,
      leftoverReturned: 0,
      skip: true,
      liveUpi: false,
      createdAt: now()
    };
    state.bikerRuns.push(run);
    return { ok: true, runId: run.runId, run, skip: true, liveUpi: false, desk: bikerPayload() };
  }
  const run = (state.bikerRuns || []).find(r => r.runId === (body.runId || body.run)) || openBikerRun();
  if (!run) return { error: "run_required", status: 404 };

  if (action === "load") {
    const live = bikerLive();
    const unpacked = live.filter(o => o.status === "reserved" || o.status === "paid");
    if (unpacked.length) return { error: "unpacked_remain", status: 409, unpacked: unpacked.length };
    const packed = live.filter(o => o.status === "packed");
    if (!packed.length) return { error: "no_packed", status: 409 };
    let loaded = 0;
    for (const o of packed) {
      const r = scanOrder({ type: "loaded", orderId: o.id, actor: "biker" });
      if (r.ok) loaded += 1;
    }
    run.status = "loaded";
    run.loadedAt = now();
    run.loaded = loaded;
    return { ok: true, runId: run.runId, loaded, run, skip: true, liveUpi: false, desk: bikerPayload() };
  }

  if (action === "drop") {
    const stop = body.stopId || body.stop;
    const pin = SHOP_PIN[stop];
    if (!pin) return { error: "not_on_run", status: 400, stop };
    if (run.status === "booked") return { error: "not_loaded", status: 409 };
    if (run.status === "returned" || run.status === "closed") return { error: "run_closed", status: 409 };
    const live = ordersAt(stop).filter(o => !["collected", "missed", "returned"].includes(o.status));
    for (const o of live) {
      if (o.status === "packed") scanOrder({ type: "loaded", orderId: o.id, actor: "biker" });
    }
    let arrived = 0;
    for (const o of live) {
      if (o.status === "loaded") {
        const r = scanOrder({ type: "arrived", orderId: o.id, actor: "biker" });
        if (r.ok) arrived += 1;
      }
    }
    run.status = "on_run";
    run.drops.push({
      stopId: stop,
      name: pin.name,
      lat: pin.lat,
      lng: pin.lng,
      seq: pin.seq,
      arrived,
      at: now()
    });
    return {
      ok: true,
      runId: run.runId,
      stopId: stop,
      lat: pin.lat,
      lng: pin.lng,
      seq: pin.seq,
      arrived,
      run,
      skip: true,
      liveUpi: false,
      desk: bikerPayload()
    };
  }

  if (action === "return") {
    const leftover = bikerLive().filter(o => o.status === "loaded");
    let returned = 0;
    for (const o of leftover) {
      const r = scanOrder({ type: "returned", orderId: o.id, actor: "biker" });
      if (r.ok) returned += 1;
    }
    const still = bikerLive().filter(o => o.status === "loaded");
    if (still.length) return { error: "leftover_on_bike", status: 409, leftover: still.length };
    run.status = "returned";
    run.returnedAt = now();
    run.leftoverReturned = returned;
    return { ok: true, runId: run.runId, leftoverReturned: returned, run, skip: true, liveUpi: false, desk: bikerPayload() };
  }
  return { error: "bad_action", status: 400 };
}

export function staffPath(pathname, rewrittenPath) {
  let p = rewrittenPath ? "/" + String(rewrittenPath).replace(/^\/+/, "") : pathname;
  p = (p || "/").replace(/\/+$/, "") || "/";
  if (p.startsWith("/api/")) p = p.slice(4);
  if (p === "/api") p = "/";
  return p;
}

export function isStaffPath(p) {
  return [
    "/connectors", "/connectors/upload", "/predict", "/ledger", "/stock", "/inventory", "/ageing",
    "/orders", "/order", "/member", "/member/answer", "/auth/me", "/auth/otp", "/auth/verify",
    "/beat", "/beat/open", "/beat/close", "/scan", "/recon", "/next", "/source",
    "/cash", "/settlements", "/tower", "/stops", "/po", "/dispatch", "/invoice", "/biker"
  ].includes(p);
}

async function handleStaffOnce(req, res, path, body, url) {
  const q = queryOf(url);
  const method = req.method;

  const done = (result, fallback = 200) => ({ status: result.status || fallback, body: result });
  if (method === "GET" && path === "/connectors") return { status: 200, body: connectorsPayload() };
  if (method === "POST" && path === "/connectors/upload") return done(uploadConnector(body || {}));
  if (method === "GET" && path === "/predict") return { status: 200, body: predictPayload() };
  if (method === "GET" && path === "/ledger") return { status: 200, body: ledgerOf(q.beat) };
  if (method === "GET" && path === "/stock") return { status: 200, body: stockPayload() };
  if (method === "GET" && path === "/inventory") return { status: 200, body: inventoryPayload() };
  if (method === "GET" && path === "/ageing") return { status: 200, body: ageingPayload() };
  if (method === "GET" && path === "/orders") return { status: 200, body: ordersPayload(q) };
  if (method === "GET" && path === "/order") return { status: 200, body: memberOrderGet(q) };
  if (method === "POST" && path === "/order") return done(placeMemberOrder(body || {}));
  if (method === "GET" && path === "/member") return { status: 200, body: memberPayload(q) };
  if (method === "POST" && path === "/member") return done(saveMemberFlags(body || {}));
  if (method === "POST" && path === "/member/answer") return done(saveMemberAnswer(body || {}));
  if (method === "GET" && path === "/auth/me") return { status: 200, body: authMe() };
  if (method === "POST" && path === "/auth/otp") return { status: 200, body: authOtp() };
  if (method === "POST" && path === "/auth/verify") return done(authVerify(body || {}));
  if (method === "GET" && path === "/stops") return { status: 200, body: stopsPayload() };
  if (method === "POST" && path === "/stops") return done(addStudio(body));
  if (method === "GET" && path === "/beat") return { status: 200, body: beatPayload() };
  if (method === "POST" && path === "/beat/open") return done(openBeat(body));
  if (method === "POST" && path === "/beat/close") return done(closeBeat(body));
  if (method === "POST" && path === "/scan") return done(scanOrder(body));
  if (method === "GET" && path === "/recon") return { status: 200, body: reconPayload() };
  if (method === "GET" && path === "/next") return { status: 200, body: nextPayload() };
  if (method === "GET" && path === "/source") return { status: 200, body: sourcePayload() };
  if (method === "GET" && path === "/cash") return { status: 200, body: cashPayload(q) };
  if (method === "POST" && path === "/cash") return done(saveCash(body));
  if (method === "GET" && path === "/settlements") {
    const page = { ...q };
    if (q.unmatched == null && q.view == null && q.limit == null) page.unmatched = "1";
    return { status: 200, body: settlementsPayload(page) };
  }
  if (method === "GET" && path === "/po") return { status: 200, body: poPayload() };
  if (method === "POST" && path === "/po") return done(mutatePo(body || {}));
  if (method === "GET" && path === "/dispatch") return { status: 200, body: dispatchPayload(q) };
  if (method === "POST" && path === "/dispatch") return done(mutateDispatch(body || {}));
  if (method === "GET" && path === "/invoice") return { status: 200, body: invoicePayload() };
  if (method === "POST" && path === "/invoice") return done(mutateInvoice(body || {}));
  if (method === "GET" && path === "/biker") return { status: 200, body: bikerPayload() };
  if (method === "POST" && path === "/biker") return done(mutateBiker(body || {}));
  if (method === "GET" && path === "/tower") return { status: 200, body: towerPayload() };
  if ((path === "/beat/open" || path === "/beat/close" || path === "/scan") && method === "GET") {
    return { status: 405, body: { error: "Use POST" } };
  }
  return null;
}

export async function handleStaff(req, res, path, body, url) {
  const mutating = (req.method === "POST" || req.method === "PUT")
    && path !== "/auth/otp"
    && path !== "/auth/verify";
  return runWithPersistentState(mutating, () => handleStaffOnce(req, res, path, body, url));
}

export const SCAN_FLOW_ORDER = SCAN_FLOW;
export const TOWER_MAX_BYTES = TOWER_BYTES_MAX;
export { DUMMY_DATA };
