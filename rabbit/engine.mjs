/**
 * RABBIT — NiaSave staff control plane (studio-cart only).
 * Go-live load: 1 theatre, 40 studios, 3000 members.
 * One evening beat, ~5 bags per stop (~200 orders). Not 10k. Not one cart.
 * Dummy skip ON. No OTP send. No WhatsApp product. No live member UPI / Razorpay.
 * Do not flip DUMMY_DATA off. Member phone is owned elsewhere.
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

export const STUDIOS = buildStudios();
export const MEMBERS = buildMembers(STUDIOS);
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
    payStatus: payStatus || (status === "collected" ? "captured" : "dummy"),
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
        payStatus: status === "collected" || status === "missed" ? "captured" : "dummy"
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
    status: o.payStatus === "captured" ? "captured" : "dummy",
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
    persist: "memory",
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
    cash: {}
  };
}

let state = createState();

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

function stopProgress() {
  return STUDIOS.map(s => {
    const bags = ordersAt(s.id);
    const f = funnelOf(bags);
    const open = f.reserved + f.packed + f.loaded + f.at_stop;
    return {
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
      open
    };
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
    stopCount: STUDIO_COUNT,
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

export function connectorsPayload() {
  const led = ledgerOf();
  const skuRows = SKUS.length;
  return {
    product: "rabbit",
    dummy: DUMMY_DATA,
    theatre: THEATRE.name,
    stopCount: STUDIO_COUNT,
    memberCount: MEMBER_COUNT,
    sources: [
      { id: "ledger", kind: "api", status: "ok", rows: led.rows.length },
      { id: "procure", kind: "sheet", status: DUMMY_DATA ? "inbound" : "sheet", rows: skuRows },
      { id: "members", kind: "sheet", status: DUMMY_DATA ? "inbound" : "sheet", rows: MEMBER_COUNT },
      { id: "vendors", kind: "sheet", status: DUMMY_DATA ? "inbound" : "sheet", rows: 3 },
      { id: "upi_statement", kind: "csv", status: DUMMY_DATA ? "inbound" : "file", rows: state.statement.length }
    ]
  };
}

export function sourcePayload() {
  return {
    from: "From sheet",
    sheetFrom: { procure: "From sheet" },
    theatre: THEATRE.name,
    sources: SKUS.map(s => ({
      sku: s.id,
      vendor: s.vendor,
      source: s.vendor,
      niaCost: s.nia,
      kirana: s.kirana,
      keep: s.keep,
      lead_days: s.lead_days,
      last_buy: s.last_buy,
      status: "active"
    }))
  };
}

export function stockPayload() {
  const led = ledgerOf();
  return {
    beatDate: led.beatDate,
    theatre: THEATRE.name,
    stopCount: STUDIO_COUNT,
    opening: led.opening,
    stock: led.leftover,
    holding: Object.entries(led.reserved).filter(([, n]) => n > 0).map(([sku, qty]) => ({ sku, qty })),
    owner: OWNER,
    nextBeat: state.beat.nextBeat,
    spokenBeat: state.beat.spokenBeat,
    persist: state.persist,
    blob: state.blob
  };
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
    stopCount: STUDIO_COUNT,
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
    stopCount: STUDIO_COUNT,
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
    stopCount: STUDIO_COUNT,
    memberCount: MEMBER_COUNT,
    bagsTonight: state.orders.length,
    bagsPerStop: BEAT_BAGS_PER_STOP,
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
    stopCount: STUDIO_COUNT,
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
    stopCount: STUDIO_COUNT,
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
    stopCount: STUDIO_COUNT,
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
  const source = pred.load
    .filter(r => r.tomorrow_qty > (led.leftover[r.sku] || 0))
    .map(r => ({
      sku: r.sku,
      source: skuOf(r.sku).vendor,
      leftover: led.leftover[r.sku] || 0,
      why: "left " + (led.leftover[r.sku] || 0) + " · load " + r.tomorrow_qty
    }));
  const dueAll = state.settlements.filter(s => s.beatDate === led.beatDate && !s.matched);
  const settlementsDue = dueAll.slice(0, SAMPLE).map(s => ({
    pickupCode: s.pickupCode,
    amount: s.amount,
    why: "Collected · statement not matched"
  }));
  return {
    beatDate: led.beatDate,
    owner: OWNER,
    slot: SLOT,
    theatre: THEATRE.name,
    stopCount: STUDIO_COUNT,
    memberCount: MEMBER_COUNT,
    miss_rate: pred.miss_rate,
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
      procure: "From sheet",
      members: "From sheet"
    },
    note: "Samples only. Full 3000 stay on the member book."
  };
}

export function settlementsPayload(query = {}) {
  const date = !query.beat || query.beat === "today" ? state.beat.beatDate : query.beat;
  const all = state.settlements.filter(s => s.beatDate === date);
  const statement = state.statement.filter(s => s.date === date);
  const paged = query.limit != null;
  const limit = paged ? Math.min(50, Math.max(1, Number(query.limit) || PAGE)) : all.length;
  const offset = paged ? Math.max(0, Number(query.offset) || 0) : 0;
  return {
    beatDate: date,
    theatre: THEATRE.name,
    settlements: all.slice(offset, offset + limit),
    statement,
    count: all.length,
    limit,
    offset,
    matched: all.filter(s => s.matched).length,
    unmatchedSettlements: all.filter(s => !s.matched).length,
    unmatchedStatement: statement.filter(s => !s.matched).length,
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
  const expected = expectedFrom(order.status);
  const ok = Array.isArray(expected) ? expected.includes(kind) : expected === kind;
  if (!ok) return { error: "wrong_stage", status: 409, have: order.status, want: expected };
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
    product: "rabbit",
    dummy: DUMMY_DATA,
    beatDate: led.beatDate,
    owner: OWNER,
    slot: SLOT,
    theatre: THEATRE.name,
    hub: THEATRE.hub,
    area: THEATRE.area,
    stopCount: STUDIO_COUNT,
    memberCount: MEMBER_COUNT,
    membersPerStudio: MEMBERS_PER_STUDIO,
    bagsTonight: state.orders.length,
    bagsPerStop: BEAT_BAGS_PER_STOP,
    kpis: {
      opening: sum(led.opening),
      reserved: sum(led.reserved),
      collected: sum(led.collected),
      missed: sum(led.missed),
      leftover: sum(led.leftover),
      miss_rate: pred.miss_rate,
      balanced: led.balanced,
      stops: STUDIO_COUNT,
      members: MEMBER_COUNT,
      bags: state.orders.length,
      chase: chaseCount
    },
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

export function staffPath(pathname, rewrittenPath) {
  let p = rewrittenPath ? "/" + String(rewrittenPath).replace(/^\/+/, "") : pathname;
  p = (p || "/").replace(/\/+$/, "") || "/";
  if (p.startsWith("/api/")) p = p.slice(4);
  if (p === "/api") p = "/";
  return p;
}

export function isStaffPath(p) {
  return [
    "/connectors", "/predict", "/ledger", "/stock", "/orders", "/beat",
    "/beat/open", "/beat/close", "/scan", "/recon", "/next", "/source",
    "/cash", "/settlements", "/tower", "/stops"
  ].includes(p);
}

export async function handleStaff(req, res, path, body, url) {
  const q = queryOf(url);
  const method = req.method;

  const done = (result, fallback = 200) => ({ status: result.status || fallback, body: result });
  if (method === "GET" && path === "/connectors") return { status: 200, body: connectorsPayload() };
  if (method === "GET" && path === "/predict") return { status: 200, body: predictPayload() };
  if (method === "GET" && path === "/ledger") return { status: 200, body: ledgerOf(q.beat) };
  if (method === "GET" && path === "/stock") return { status: 200, body: stockPayload() };
  if (method === "GET" && path === "/orders") return { status: 200, body: ordersPayload(q) };
  if (method === "GET" && path === "/stops") return { status: 200, body: stopsPayload() };
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
    const page = { ...q, limit: q.limit != null ? q.limit : String(PAGE) };
    return { status: 200, body: settlementsPayload(page) };
  }
  if (method === "GET" && path === "/tower") return { status: 200, body: towerPayload() };
  if ((path === "/beat/open" || path === "/beat/close" || path === "/scan") && method === "GET") {
    return { status: 405, body: { error: "Use POST" } };
  }
  return null;
}

export const SCAN_FLOW_ORDER = SCAN_FLOW;
export const TOWER_MAX_BYTES = TOWER_BYTES_MAX;
export { DUMMY_DATA };
