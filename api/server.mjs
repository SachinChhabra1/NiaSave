/**
 * NiaSave P0 API — in-memory. Demo 9876541042 / NIA-1042.
 * Nest rupee 2200 interim. Send-home rail not configured.
 * Staff desk contract only. Member phone is owned elsewhere — do not rename tabs.
 * Not for rafiqicentral.com or harness.
 */
import http from "node:http";
import { randomUUID, createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const PORT = Number(process.env.PORT || 8787);
const DEMO = process.env.DEMO !== "0";
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || "SaveDesk#29Aug";
const now = () => new Date().toISOString();
const NOT_NIA = "This phone is not with Nia.";
const HUB_FLOW = ["pack", "count", "leave", "sell", "return", "close"];

const member = {
  id: "NIA-1042",
  name: "Ravi K",
  phone: "9876541042",
  job: "Warehouse picker",
  worksite: "Whitefield",
  nestId: "rajputana",
  nestName: "Rajputana Theatre",
  bed: "Bed 12",
  familyName: "Maa",
  familyPlace: "Bhojpur",
  sendHome: 9988,
  studioWindow: "5:15 PM"
};

const catalog = [
  { id: "salt", name: "Tata Salt", hindi: "namak", size: "1 kg", price: 28, mrp: 34, keep: 6, image: "/products/tata-salt.png", searchTerms: ["salt", "namak"], outOfStock: false },
  { id: "sunlite", name: "Fortune Sunlite", hindi: "tel", size: "1 L", price: 145, mrp: 160, keep: 15, image: "/products/fortune-oil.png", searchTerms: ["oil", "tel"], outOfStock: false },
  { id: "maggi", name: "Maggi 2-Minute", hindi: "maggi", size: "70 g", price: 14, mrp: 17, keep: 3, image: "/products/maggi.png", searchTerms: ["maggi", "noodles"], outOfStock: false },
  { id: "rice", name: "India Gate", hindi: "chawal", size: "5 kg", price: 389, mrp: 409, keep: 20, image: "/products/india-gate-rice.png", searchTerms: ["rice", "chawal"], outOfStock: false },
  { id: "parle", name: "Parle-G", hindi: "biscuit", size: "250 g", price: 27, mrp: 30, keep: 3, image: "/products/parle-g.jpg", searchTerms: ["parle", "biscuit"], outOfStock: false },
  { id: "soap", name: "Nia Soap", hindi: "sabun", size: "30 gms", price: 10, mrp: 12, keep: 2, image: "/products/nia-soap.png", searchTerms: ["soap", "sabun"], outOfStock: false },
  { id: "navratna", name: "Navratna Cool Oil", hindi: "thanda tel", size: "100 ml", price: 70, mrp: 82, keep: 12, image: "/products/navratna-oil.png", searchTerms: ["navratna", "tel"], outOfStock: false }
];

const staffSeed = [
  { id: "stf-admin", email: "admin@nia.one", name: "Admin", role: "admin", desks: ["studio", "hub", "money", "pilot"] },
  { id: "stf-satish", email: "satish@nia.one", name: "Satish", role: "studio+hub", desks: ["studio", "hub"] },
  { id: "stf-ramesh", email: "ramesh@nia.one", name: "Ramesh", role: "hub", desks: ["hub"] },
  { id: "stf-kavita", email: "kavita@nia.one", name: "Kavita", role: "money", desks: ["money"] },
  { id: "stf-pilot", email: "pilot@nia.one", name: "Pilot", role: "pilot", desks: ["pilot"] }
];

const state = {
  extra: { id: "extra-tonight", status: "open" },
  rsvp: false,
  issues: [],
  payments: new Map(),
  orders: new Map(),
  bags: new Map(),
  idem: new Map(),
  tokens: new Map(),
  bagKeep: 126,
  bagSpend: 812,
  payMonth: 16500,
  nestRupee: 2200,
  food: 2800,
  other: 700,
  sent: 0,
  hubDay: {
    date: "2026-08-29",
    stage: "pack",
    packBy: null,
    counts: [],
    leaveBy: null,
    sellBy: null,
    returnBy: null,
    closeBy: null,
    carts: []
  }
};

function leftover() {
  const available = state.payMonth - state.nestRupee - state.bagSpend - state.food - state.other - state.sent;
  return {
    pay: state.payMonth, nest: state.nestRupee, bag: state.bagSpend,
    food: state.food, other: state.other, sent: state.sent, available,
    projectedExtra: state.extra.status === "taken" ? 180 : 0,
    note: "Food and Other are demo constants. Extra 180 is projected.",
    updatedAt: now()
  };
}

function workCurrent() {
  return {
    memberId: member.id, role: member.job,
    week: { in: 4200, due: "Friday", dueAmount: 4200, cut: 0, cutReason: null, source: "demo" },
    today: { start: "08:00", end: "17:00", place: "Whitefield", bus: "7:10", distance: "600 m" },
    help: { name: "Ramesh", path: "help" },
    extra: { id: "extra-tonight", when: "Tonight 6-8 PM", place: "Studio", keep: 180, bus: "With you", weekIfTaken: 5000, status: state.extra.status },
    next: { days: 3, role: "picker+", monthly: 1500 }
  };
}

function nestCurrent() {
  return {
    memberId: member.id, nestId: "rajputana", name: "Rajputana Theatre", bed: "Bed 12",
    rupee: state.nestRupee, walk: "12 min to work", nextPay: "2026-09-01",
    included: [
      { name: "Wi-Fi", status: "Working" }, { name: "Power", status: "Working" },
      { name: "Water", status: "Working" }, { name: "Clean", status: "Today 11 AM" },
      { name: "Gate", status: "24x7" }, { name: "Lock", status: "12" },
      { name: "Bed", status: "In" }, { name: "Hall", status: "Till 10 PM" }
    ],
    event: { id: "bada-khaana", title: "Bada Khaana this Sunday", when: "19:00", place: "Rajputana Theatre", attending: 46, mine: state.rsvp },
    book: [{ id: "laundry", name: "Laundry", backBy: "18:00", price: 0 }, { id: "trim", name: "Trim", price: 80 }],
    issue: state.issues[0] || null
  };
}

function json(res, code, body) {
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "Content-Type, Idempotency-Key, Authorization",
    "access-control-allow-methods": "GET,POST,OPTIONS"
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error("invalid_json")); }
    });
  });
}

function digits(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

function tokenHash(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

function staffFromReq(req) {
  const header = String(req.headers.authorization || "");
  const raw = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!raw) return null;
  return state.tokens.get(tokenHash(raw)) || null;
}

function requireStaff(req, res, desks) {
  const staff = staffFromReq(req);
  if (!staff) {
    json(res, 401, { error: "staff_required" });
    return null;
  }
  if (desks && desks.length && !staff.desks.some(d => desks.includes(d)) && staff.role !== "admin") {
    json(res, 403, { error: "desk_forbidden", staff: { id: staff.id, role: staff.role } });
    return null;
  }
  return staff;
}

function publicMember() {
  return {
    id: member.id,
    name: member.name,
    phone: member.phone,
    studio: member.nestName,
    studioWindow: member.studioWindow,
    job: member.job,
    sendHome: member.sendHome
  };
}

function catalogPayload() {
  return {
    studioName: member.nestName,
    deliveryTime: member.studioWindow,
    weeklySavings: state.bagKeep,
    feverPerk: "Bag 500 this month -> fever day free",
    rail: "upi_only",
    window: "Studio window",
    products: catalog
  };
}

function nextHub(from) {
  const i = HUB_FLOW.indexOf(from);
  return i >= 0 && i < HUB_FLOW.length - 1 ? HUB_FLOW[i + 1] : from;
}

export async function handler(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(req.url, "http://localhost");
  const rewrittenPath = url.searchParams.get("path");
  const path = rewrittenPath ? `/${rewrittenPath.replace(/^\/+/, "")}` : url.pathname;
  const key = req.headers["idempotency-key"];
  try {
    if (req.method === "GET" && (path === "/health" || path === "/v1/health")) {
      return json(res, 200, { ok: true, product: "niasave", demo: DEMO, time: now(), hubStage: state.hubDay.stage });
    }

    if (req.method === "POST" && (path === "/v1/members/lookup" || path === "/v1/save/lookup")) {
      const body = await readBody(req);
      const phone = digits(body.phone);
      if (phone.length !== 10) return json(res, 400, { member: null, error: "invalid_phone", message: NOT_NIA });
      if (phone !== member.phone) return json(res, 200, { member: null, error: "not_nia", message: NOT_NIA });
      return json(res, 200, { member: publicMember() });
    }

    if (req.method === "GET" && path === "/v1/work/current") return json(res, 200, workCurrent());
    if (req.method === "POST" && path.startsWith("/v1/work/extras/") && path.endsWith("/decision")) {
      const id = path.split("/")[4];
      const body = await readBody(req);
      if (key && state.idem.has(key)) return json(res, 200, state.idem.get(key));
      if (id !== "extra-tonight") return json(res, 404, { error: "unknown_extra" });
      if (state.extra.status !== "open") return json(res, 409, { error: "not_open", status: state.extra.status });
      const decision = body.decision === "take" ? "taken" : body.decision === "no" ? "declined" : null;
      if (!decision) return json(res, 400, { error: "decision_must_be_take_or_no" });
      state.extra.status = decision;
      const out = { extraId: id, status: decision, keep: decision === "taken" ? 180 : 0, projected: true };
      if (key) state.idem.set(key, out);
      return json(res, 200, out);
    }

    if (req.method === "GET" && path === "/v1/nest/current") return json(res, 200, nestCurrent());
    if (req.method === "POST" && path === "/v1/nest/events/bada-khaana/rsvp") {
      const body = await readBody(req);
      state.rsvp = body.coming !== false;
      return json(res, 200, { eventId: "bada-khaana", mine: state.rsvp });
    }
    if (req.method === "POST" && path === "/v1/nest/issues") {
      const body = await readBody(req);
      const issue = { id: "iss-" + randomUUID().slice(0, 8), kind: body.kind || "else", owner: "Satish", eta: "21:00", status: "assigned", line: "Satish is on it. Done by 9 PM." };
      state.issues.unshift(issue);
      return json(res, 201, issue);
    }

    if (req.method === "GET" && (path === "/v1/catalog" || path === "/v1/save/catalog")) {
      return json(res, 200, catalogPayload());
    }

    if (req.method === "POST" && (path === "/v1/payments" || path === "/v1/save/upi" || path === "/v1/save/bag")) {
      const body = await readBody(req);
      if (key && state.idem.has(key)) return json(res, 200, state.idem.get(key));
      const phone = digits(body.phone || (body.member && body.member.phone));
      if (phone && phone !== member.phone) return json(res, 403, { error: "not_nia", message: NOT_NIA });
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return json(res, 400, { error: "bad_amount" });
      const method = String(body.method || "upi").toLowerCase();
      if (method !== "upi") return json(res, 400, { error: "upi_only" });
      const payment = {
        id: "pay-" + randomUUID().slice(0, 8),
        amount,
        method: "upi",
        status: DEMO ? "succeeded" : "pending",
        memberId: body.memberId || member.id,
        window: "Studio window",
        createdAt: now()
      };
      const bag = {
        id: "bag-" + randomUUID().slice(0, 8),
        paymentId: payment.id,
        memberId: payment.memberId,
        cart: body.cart || [],
        amount,
        destination: member.nestName,
        window: member.studioWindow,
        status: "hub_hold"
      };
      state.payments.set(payment.id, { ...payment, cart: body.cart || [] });
      state.bags.set(bag.id, bag);
      const out = { ...payment, bag };
      if (key) state.idem.set(key, out);
      return json(res, DEMO ? 200 : 202, out);
    }

    if (req.method === "POST" && (path === "/v1/orders" || path === "/v1/save/checkout")) {
      const body = await readBody(req);
      if (key && state.idem.has(key)) return json(res, 200, state.idem.get(key));
      let pay = body.paymentId ? state.payments.get(body.paymentId) : null;
      if (!pay && body.amount) {
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount <= 0) return json(res, 400, { error: "bad_amount" });
        const phone = digits(body.phone);
        if (phone && phone !== member.phone) return json(res, 403, { error: "not_nia", message: NOT_NIA });
        pay = {
          id: "pay-" + randomUUID().slice(0, 8),
          amount,
          method: "upi",
          status: DEMO ? "succeeded" : "pending",
          memberId: body.memberId || member.id,
          cart: body.cart || [],
          createdAt: now()
        };
        state.payments.set(pay.id, pay);
      }
      if (!pay) return json(res, 404, { error: "payment_not_found" });
      if (pay.status !== "succeeded") return json(res, 409, { error: "payment_not_succeeded", status: pay.status });
      const order = {
        id: "ord-" + randomUUID().slice(0, 8),
        paymentId: pay.id,
        memberId: pay.memberId,
        total: pay.amount,
        rail: "upi",
        status: "hub_created",
        delivery: "Hub has your bag. Delivered to your Studio at " + member.studioWindow + ".",
        createdAt: now()
      };
      state.orders.set(order.id, order);
      state.bagSpend = pay.amount;
      state.hubDay.carts.push({ orderId: order.id, amount: pay.amount, at: now() });
      if (key) state.idem.set(key, order);
      return json(res, 201, order);
    }

    if (req.method === "GET" && path === "/v1/home/leftover") {
      const left = leftover();
      return json(res, 200, {
        memberId: member.id,
        family: { name: member.familyName, place: member.familyPlace },
        leftover: left,
        canSend: member.sendHome,
        goal: { name: "Roof at home", current: left.available, target: 20000 },
        recharge: { label: "Recharge Maa phone", amount: 199 },
        voice: { available: false },
        ledger: [{ date: "2026-08-12", to: "Maa, Bhojpur", amount: 2500 }],
        transferRail: "not_configured"
      });
    }
    if (req.method === "POST" && path === "/v1/home/transfers") {
      return json(res, 501, { error: "send_home_rail_not_configured" });
    }

    if (req.method === "POST" && path === "/v1/staff/login") {
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const found = staffSeed.find(s => s.email === email);
      if (!found || password !== STAFF_PASSWORD) return json(res, 401, { error: "bad_credentials" });
      const token = randomUUID() + "." + randomUUID();
      const record = { ...found, tokenIssuedAt: now() };
      state.tokens.set(tokenHash(token), record);
      return json(res, 200, { token, staff: { id: found.id, email: found.email, name: found.name, role: found.role, desks: found.desks } });
    }
    if (req.method === "GET" && path === "/v1/staff/me") {
      const staff = requireStaff(req, res);
      if (!staff) return;
      return json(res, 200, { staff: { id: staff.id, email: staff.email, name: staff.name, role: staff.role, desks: staff.desks } });
    }
    if (req.method === "POST" && path === "/v1/staff/logout") {
      const header = String(req.headers.authorization || "");
      const raw = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
      if (raw) state.tokens.delete(tokenHash(raw));
      return json(res, 200, { ok: true });
    }

    if (req.method === "GET" && path === "/v1/staff/hub/day") {
      const staff = requireStaff(req, res, ["hub", "studio", "pilot"]);
      if (!staff) return;
      return json(res, 200, { day: state.hubDay, flow: HUB_FLOW });
    }

    if (req.method === "POST" && path === "/v1/staff/hub/advance") {
      const staff = requireStaff(req, res, ["hub", "studio"]);
      if (!staff) return;
      const body = await readBody(req);
      const want = String(body.stage || nextHub(state.hubDay.stage));
      const expected = nextHub(state.hubDay.stage);
      if (want !== expected) return json(res, 409, { error: "wrong_stage", have: state.hubDay.stage, want: expected });
      if (want === "leave") {
        const ids = [...new Set(state.hubDay.counts.map(c => c.staffId))];
        if (ids.length < 2) return json(res, 409, { error: "two_staff_must_count", countedBy: ids });
      }
      if (want === "count") {
        if (state.hubDay.counts.some(c => c.staffId === staff.id)) {
          return json(res, 409, { error: "already_counted", staffId: staff.id });
        }
        state.hubDay.counts.push({ staffId: staff.id, name: staff.name, at: now(), units: Number(body.units) || state.hubDay.carts.length });
        if (state.hubDay.counts.length < 2) {
          return json(res, 200, { day: state.hubDay, pending: "second_count" });
        }
      }
      state.hubDay.stage = want;
      const stamp = want + "By";
      if (stamp in state.hubDay) state.hubDay[stamp] = { staffId: staff.id, at: now() };
      return json(res, 200, { day: state.hubDay });
    }

    return json(res, 404, { error: "not_found" });
  } catch (err) {
    if (err.message === "invalid_json") return json(res, 400, { error: "invalid_json" });
    return json(res, 500, { error: "server_error" });
  }
}

export default handler;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  http.createServer(handler).listen(PORT, "127.0.0.1", () => {
    process.stdout.write("niasave api on :" + PORT + " demo=" + DEMO + "\n");
  });
}
