/**
 * RABBIT — NiaSave staff control plane (studio-cart only).
 * Dummy skip ON. No OTP send. No WhatsApp product. No live member UPI / Razorpay.
 * Do not flip DUMMY_DATA off. Member phone is owned elsewhere.
 */
const DUMMY_DATA = process.env.DUMMY_DATA !== "0";

export const WEEK_BEAT = "2026-08-31";
export const NEXT_BEAT = "2026-09-01";
export const SLOT = "17:00";
export const OWNER = "hub";

export const SKUS = [
  { id: "groundnut_oil", nia: 185, kirana: 255, keep: 75, opening: 24, vendor: "Cold-press Tumkur", lead_days: 3, last_buy: "2026-08-18" },
  { id: "mustard_oil", nia: 155, kirana: 225, keep: 70, opening: 23, vendor: "Ghani · Raichur", lead_days: null, last_buy: "" },
  { id: "sunflower_oil", nia: 128, kirana: 177, keep: 50, opening: 24, vendor: "Refinery Hubli", lead_days: 2, last_buy: "2026-08-20" },
  { id: "coconut_oil", nia: 205, kirana: 285, keep: 80, opening: 24, vendor: "Copra press · Tiptur", lead_days: null, last_buy: "" },
  { id: "detergent_pick", nia: 95, kirana: 125, keep: 30, opening: 18, vendor: "Local packer · Peenya", lead_days: null, last_buy: "" },
  { id: "nia_detergent", nia: 78, kirana: 108, keep: 32, opening: 30, vendor: "Local packer Peenya", lead_days: 5, last_buy: "2026-08-15" },
  { id: "bathsoap_pick", nia: 70, kirana: 96, keep: 26, opening: 20, vendor: "Soap works · Mysore", lead_days: null, last_buy: "" },
  { id: "nia_bathsoap", nia: 52, kirana: 72, keep: 32, opening: 28, vendor: "Soap works Mysore", lead_days: 4, last_buy: "2026-08-22" },
  { id: "toothpaste_pick", nia: 48, kirana: 62, keep: 14, opening: 22, vendor: "Trade pack · City", lead_days: null, last_buy: "" },
  { id: "essentials_pick", nia: 320, kirana: 442, keep: 70, opening: 16, vendor: "Ration desk Hub", lead_days: 7, last_buy: "2026-08-10" }
];

const SKU_BY_ID = Object.fromEntries(SKUS.map(s => [s.id, s]));

export const MEMBERS = [
  { memberId: "ravi", name: "Ravi", nest: "North", hub: "Sukh Store · Theatre North", hasMira: true, friday_send: "pending", last_bag: "2026-08-28", last_mira: "2026-08-27" },
  { memberId: "priya", name: "Priya", nest: "East", hub: "Hub", hasMira: false, friday_send: "pending", last_bag: "", last_mira: "" },
  { memberId: "amit", name: "Amit", nest: "Site", hub: "Hub", hasMira: true, friday_send: "sent", last_bag: "", last_mira: "2026-08-25" },
  { memberId: "lakshmi", name: "Lakshmi", nest: "North", hub: "Hub", hasMira: false, friday_send: "pending", last_bag: "2026-08-29", last_mira: "" },
  { memberId: "suresh", name: "Suresh", nest: "West", hub: "Hub", hasMira: false, friday_send: "pending", last_bag: "", last_mira: "" }
];

const SCAN_FLOW = ["reserved", "packed", "loaded", "at_stop", "collected"];
const SCAN_TYPES = {
  packed: "packed",
  loaded: "loaded",
  arrived: "at_stop",
  collected: "collected",
  missed: "missed",
  returned: "returned"
};

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

function makeOrder({ memberId, sku, qty = 1, status, pickupCode, payStatus }) {
  const member = MEMBERS.find(m => m.memberId === memberId) || { memberId, name: memberId };
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

function seedStatement() {
  return [
    { id: "stmt-881001", date: WEEK_BEAT, utr: "UTR881001", amount: 320, note: "Ravi essentials H7RAVI", matched: false, settlementId: null },
    { id: "stmt-881002", date: WEEK_BEAT, utr: "UTR881002", amount: 48, note: "Priya toothpaste P8TOOTH", matched: false, settlementId: null },
    { id: "stmt-881099", date: WEEK_BEAT, utr: "UTR881099", amount: 50, note: "Unmatched bank credit", matched: false, settlementId: null },
    { id: "stmt-881077", date: WEEK_BEAT, utr: "UTR881077", amount: 12, note: "Charges reverse", matched: false, settlementId: null }
  ];
}

function seedOrders() {
  return [
    makeOrder({ memberId: "ravi", sku: "essentials_pick", status: "collected", pickupCode: "H7RAVI", payStatus: "captured" }),
    makeOrder({ memberId: "priya", sku: "toothpaste_pick", status: "collected", pickupCode: "P8TOOTH", payStatus: "captured" }),
    makeOrder({ memberId: "lakshmi", sku: "nia_bathsoap", status: "collected", pickupCode: "L3SOAP", payStatus: "captured" }),
    makeOrder({ memberId: "priya", sku: "mustard_oil", status: "missed", pickupCode: "P4MISS", payStatus: "captured" }),
    makeOrder({ memberId: "amit", sku: "coconut_oil", status: "at_stop", pickupCode: "A2STOP", payStatus: "dummy" }),
    makeOrder({ memberId: "lakshmi", sku: "sunflower_oil", status: "packed", pickupCode: "L9PACK", payStatus: "dummy" }),
    makeOrder({ memberId: "ravi", sku: "bathsoap_pick", status: "loaded", pickupCode: "R2LOAD", payStatus: "dummy" }),
    makeOrder({ memberId: "suresh", sku: "detergent_pick", status: "reserved", pickupCode: "S1HOLD", payStatus: "dummy" })
  ];
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
    if (o.status === "packed") {
      /* packed only */
    } else {
      trail.push("loaded");
      if (o.status === "loaded") {
        /* loaded only */
      } else {
        trail.push("arrived");
        if (o.status === "at_stop") {
          /* waiting */
        } else if (o.status === "collected") trail.push("collected");
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

function createState() {
  const orders = seedOrders();
  const settlements = seedSettlements(orders);
  const statement = seedStatement();
  matchStatement(settlements, statement);
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
      nextBeat: true,
      spokenBeat: "next beat",
      damage: ""
    },
    nextOpening: null,
    orders,
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

export function ledgerOf(beatDate) {
  const date = beatDate && beatDate !== "today" ? beatDate : state.beat.beatDate;
  const opening = clone(state.beat.opening);
  const reserved = emptySkuMap();
  const collected = emptySkuMap();
  const missed = emptySkuMap();
  const leftover = emptySkuMap();
  const beatOrders = state.orders.filter(o => o.beatDate === date);
  for (const o of beatOrders) {
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
    opening,
    reserved,
    collected,
    missed,
    leftover,
    owner: OWNER,
    orders: beatOrders,
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

function memberHasBag(memberId, led) {
  return led.orders.some(o => o.memberId === memberId && o.status !== "missed");
}

export function connectorsPayload() {
  const led = ledgerOf();
  const skuRows = SKUS.length;
  return {
    product: "rabbit",
    dummy: DUMMY_DATA,
    sources: [
      { id: "ledger", kind: "api", status: "ok", rows: led.rows.length },
      { id: "procure", kind: "sheet", status: DUMMY_DATA ? "inbound" : "sheet", rows: skuRows },
      { id: "members", kind: "sheet", status: DUMMY_DATA ? "inbound" : "sheet", rows: MEMBERS.length },
      { id: "vendors", kind: "sheet", status: DUMMY_DATA ? "inbound" : "sheet", rows: 3 },
      { id: "upi_statement", kind: "csv", status: DUMMY_DATA ? "inbound" : "file", rows: state.statement.length }
    ]
  };
}

export function sourcePayload() {
  return {
    from: "From sheet",
    sheetFrom: { procure: "From sheet" },
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
    nextBeat: state.beat.nextBeat,
    spokenBeat: state.beat.spokenBeat,
    persist: state.persist,
    blob: state.blob
  };
}

export function ordersPayload(query = {}) {
  const pickup = query.pickup;
  const beat = query.beat;
  let list = state.orders.slice();
  const today = state.beat.beatDate;
  if (pickup === "today" || beat === "today") {
    list = list.filter(o => o.beatDate === today);
  } else if (beat) {
    list = list.filter(o => o.beatDate === beat);
  }
  return {
    orders: list,
    beatDate: today,
    nextBeat: state.beat.nextBeat,
    spokenBeat: state.beat.spokenBeat,
    owner: OWNER
  };
}

export function cashPayload() {
  const today = state.beat.beatDate;
  const orders = state.orders.filter(o => o.beatDate === today && (o.status === "reserved" || o.status === "collected" || o.status === "packed" || o.status === "loaded" || o.status === "at_stop"));
  return { beatDate: today, orders };
}

export function saveCash({ orderId, method, upiRef, amount }) {
  const order = state.orders.find(o => o.id === orderId);
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
  const members = MEMBERS.map(m => ({
    memberId: m.memberId,
    nest: m.nest,
    hub: m.hub,
    hasBag: memberHasBag(m.memberId, led),
    hasMira: m.hasMira,
    bagStatus: led.orders.find(o => o.memberId === m.memberId)?.status || "",
    friday_send: m.friday_send,
    last_bag: m.last_bag,
    last_mira: m.last_mira
  }));
  const chase = led.orders
    .filter(o => ["reserved", "packed", "loaded", "at_stop"].includes(o.status))
    .map(o => ({
      pickupCode: o.pickupCode,
      status: o.status,
      why: o.status === "at_stop" ? "At stop · collect by code" : o.status === "packed" ? "Packed · studio cart" : o.status === "loaded" ? "On the cart" : "Still reserved"
    }));
  const quietMembers = members
    .filter(m => !m.hasBag && !m.hasMira)
    .map(m => ({ memberId: m.memberId, why: "Sheet · no bag this beat · no Mira" }));
  const sendPending = members
    .filter(m => m.friday_send === "pending")
    .map(m => ({ memberId: m.memberId, why: "Sheet · week extra · send pending" }));
  const source = pred.load
    .filter(r => r.tomorrow_qty > (led.leftover[r.sku] || 0))
    .map(r => ({
      sku: r.sku,
      source: skuOf(r.sku).vendor,
      leftover: led.leftover[r.sku] || 0,
      why: "left " + (led.leftover[r.sku] || 0) + " · load " + r.tomorrow_qty
    }));
  const settlementsDue = state.settlements
    .filter(s => s.beatDate === led.beatDate && !s.matched)
    .map(s => ({
      pickupCode: s.pickupCode,
      amount: s.amount,
      why: "Collected · statement not matched"
    }));
  return {
    beatDate: led.beatDate,
    owner: OWNER,
    slot: SLOT,
    miss_rate: pred.miss_rate,
    load: pred.load,
    chase,
    members,
    quietMembers,
    sendPending,
    source,
    settlementsDue,
    sheetFrom: {
      procure: "From sheet",
      members: "From sheet"
    }
  };
}

export function settlementsPayload(query = {}) {
  const date = !query.beat || query.beat === "today" ? state.beat.beatDate : query.beat;
  const settlements = state.settlements.filter(s => s.beatDate === date);
  const statement = state.statement.filter(s => s.date === date);
  return {
    beatDate: date,
    settlements,
    statement,
    count: settlements.length,
    matched: settlements.filter(s => s.matched).length,
    unmatchedSettlements: settlements.filter(s => !s.matched).length,
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
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return { error: "order_not_found", status: 404 };
  const next = SCAN_TYPES[type];
  if (!next) return { error: "bad_scan_type", status: 400 };
  const expected = expectedFrom(order.status);
  const ok = Array.isArray(expected) ? expected.includes(next) : expected === next;
  if (!ok) return { error: "wrong_stage", status: 409, have: order.status, want: expected };
  if (next === "collected") {
    const code = String(pickupCode || "").trim().toUpperCase();
    if (!code || code !== order.pickupCode) return { error: "bad_pickup_code", status: 409 };
  }
  order.status = next;
  state.scans.push({
    id: "scan-" + order.pickupCode + "-" + next + "-" + state.scans.length,
    orderId: order.id,
    type: next === "at_stop" ? "arrived" : next,
    actor: actor || "pickup",
    at: now()
  });
  if (next === "collected") {
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
  if (next === "missed") {
    state.exceptions.push({
      id: "ex-" + order.pickupCode,
      orderId: order.id,
      kind: "miss",
      beatDate: order.beatDate,
      sku: order.lines[0].id,
      qty: order.lines[0].qty,
      at: now()
    });
    state.reservations = state.reservations.filter(r => r.orderId !== order.id);
  }
  if (next === "returned") {
    order.status = "returned";
  }
  return { ok: true, order, ledger: ledgerOf(order.beatDate) };
}

export function towerPayload() {
  const led = ledgerOf();
  const pred = predictPayload();
  const set = settlementsPayload({ beat: "today" });
  const funnel = {
    reserved: led.orders.filter(o => o.status === "reserved").length,
    packed: led.orders.filter(o => o.status === "packed").length,
    loaded: led.orders.filter(o => o.status === "loaded").length,
    at_stop: led.orders.filter(o => o.status === "at_stop").length,
    collected: led.orders.filter(o => o.status === "collected").length,
    missed: led.orders.filter(o => o.status === "missed").length
  };
  const sum = map => Object.values(map).reduce((a, b) => a + (b || 0), 0);
  return {
    product: "rabbit",
    dummy: DUMMY_DATA,
    beatDate: led.beatDate,
    owner: OWNER,
    slot: SLOT,
    kpis: {
      opening: sum(led.opening),
      reserved: sum(led.reserved),
      collected: sum(led.collected),
      missed: sum(led.missed),
      leftover: sum(led.leftover),
      miss_rate: pred.miss_rate,
      balanced: led.balanced
    },
    funnel,
    connectors: connectorsPayload(),
    predict: pred,
    settlements: set,
    ledger: led
  };
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
    "/cash", "/settlements", "/tower"
  ].includes(p);
}

export async function handleStaff(req, res, path, body, url) {
  const q = queryOf(url);
  const method = req.method;

  const done = (result, fallback = 200) => ({ status: result.status || fallback, body: result });
  if (method === "GET" && path === "/connectors") return { status: 200, body: connectorsPayload() };
  if (method === "GET" && path === "/predict") return { status: 200, body: predictPayload() };
  if (method === "GET" && path === "/ledger") {
    const led = ledgerOf(q.beat);
    return { status: 200, body: { ...led, orders: led.orders } };
  }
  if (method === "GET" && path === "/stock") return { status: 200, body: stockPayload() };
  if (method === "GET" && path === "/orders") return { status: 200, body: ordersPayload(q) };
  if (method === "GET" && path === "/beat") return { status: 200, body: beatPayload() };
  if (method === "POST" && path === "/beat/open") return done(openBeat(body));
  if (method === "POST" && path === "/beat/close") return done(closeBeat(body));
  if (method === "POST" && path === "/scan") return done(scanOrder(body));
  if (method === "GET" && path === "/recon") return { status: 200, body: reconPayload() };
  if (method === "GET" && path === "/next") return { status: 200, body: nextPayload() };
  if (method === "GET" && path === "/source") return { status: 200, body: sourcePayload() };
  if (method === "GET" && path === "/cash") return { status: 200, body: cashPayload() };
  if (method === "POST" && path === "/cash") return done(saveCash(body));
  if (method === "GET" && path === "/settlements") return { status: 200, body: settlementsPayload(q) };
  if (method === "GET" && path === "/tower") return { status: 200, body: towerPayload() };
  if ((path === "/beat/open" || path === "/beat/close" || path === "/scan") && method === "GET") {
    return { status: 405, body: { error: "Use POST" } };
  }
  return null;
}

export const SCAN_FLOW_ORDER = SCAN_FLOW;
export { DUMMY_DATA };
