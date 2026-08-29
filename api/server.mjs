/**
 * NiaSave P0 API — in-memory. Demo 9876541042 / NIA-1042.
 * Nest rupee 2200 interim. Send-home rail not configured.
 * Not for rafiqicentral.com or harness.
 */
import http from "node:http";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const PORT = Number(process.env.PORT || 8787);
const DEMO = process.env.DEMO !== "0";
const now = () => new Date().toISOString();

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
  familyPlace: "Bhojpur"
};

const catalog = [
  { id: "salt", name: "Tata Salt", hindi: "namak", size: "1 kg", price: 28, mrp: 34, keep: 6, image: "/products/salt.jpg", searchTerms: ["salt", "namak"], outOfStock: false },
  { id: "sunlite", name: "Fortune Sunlite", hindi: "tel", size: "1 L", price: 145, mrp: 160, keep: 15, image: "/products/oil.jpg", searchTerms: ["oil", "tel"], outOfStock: false },
  { id: "maggi", name: "Maggi 2-Minute", hindi: "maggi", size: "70 g", price: 14, mrp: 17, keep: 3, image: "/products/maggi.jpg", searchTerms: ["maggi", "noodles"], outOfStock: false },
  { id: "rice", name: "India Gate", hindi: "chawal", size: "5 kg", price: 389, mrp: 409, keep: 20, image: "/products/rice.jpg", searchTerms: ["rice", "chawal"], outOfStock: false }
];

const state = {
  extra: { id: "extra-tonight", status: "open" },
  rsvp: false,
  issues: [],
  payments: new Map(),
  orders: new Map(),
  idem: new Map(),
  bagKeep: 126,
  bagSpend: 812,
  payMonth: 16500,
  nestRupee: 2200,
  food: 2800,
  other: 700,
  sent: 0
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
    "access-control-allow-headers": "Content-Type, Idempotency-Key",
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

export async function handler(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(req.url, "http://localhost");
  const rewrittenPath = url.searchParams.get("path");
  const path = rewrittenPath ? `/${rewrittenPath.replace(/^\/+/, "")}` : url.pathname;
  const key = req.headers["idempotency-key"];
  try {
    if (req.method === "GET" && path === "/health") {
      return json(res, 200, { ok: true, product: "niasave", demo: DEMO, time: now() });
    }
    if (req.method === "POST" && path === "/v1/members/lookup") {
      const body = await readBody(req);
      const phone = digits(body.phone);
      if (phone.length !== 10) return json(res, 400, { member: null, error: "invalid_phone" });
      if (phone !== member.phone) return json(res, 200, { member: null });
      return json(res, 200, { member: { id: member.id, name: member.name, studio: member.nestName, studioWindow: "5:15 PM", job: member.job } });
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
    if (req.method === "GET" && path === "/v1/catalog") {
      return json(res, 200, { studioName: "Rajputana Theatre", deliveryTime: "5:15 PM", weeklySavings: state.bagKeep, feverPerk: "Bag 500 this month -> fever day free", products: catalog });
    }
    if (req.method === "POST" && path === "/v1/payments") {
      const body = await readBody(req);
      if (key && state.idem.has(key)) return json(res, 200, state.idem.get(key));
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return json(res, 400, { error: "bad_amount" });
      const payment = { id: "pay-" + randomUUID().slice(0, 8), amount, status: DEMO ? "succeeded" : "pending", memberId: body.memberId || null, createdAt: now() };
      state.payments.set(payment.id, { ...payment, cart: body.cart || [] });
      if (key) state.idem.set(key, payment);
      return json(res, DEMO ? 200 : 202, payment);
    }
    if (req.method === "POST" && path === "/v1/orders") {
      const body = await readBody(req);
      if (key && state.idem.has(key)) return json(res, 200, state.idem.get(key));
      const pay = state.payments.get(body.paymentId);
      if (!pay) return json(res, 404, { error: "payment_not_found" });
      if (pay.status !== "succeeded") return json(res, 409, { error: "payment_not_succeeded", status: pay.status });
      const order = { id: "ord-" + randomUUID().slice(0, 8), paymentId: pay.id, memberId: pay.memberId, total: pay.amount, status: "hub_created", delivery: "Hub has your bag. Delivered to your Studio at 5:15 PM.", createdAt: now() };
      state.orders.set(order.id, order);
      state.bagSpend = pay.amount;
      if (key) state.idem.set(key, order);
      return json(res, 201, order);
    }
    if (req.method === "GET" && path === "/v1/home/leftover") {
      return json(res, 200, {
        memberId: member.id,
        family: { name: member.familyName, place: member.familyPlace },
        leftover: leftover(),
        goal: { name: "Roof at home", current: leftover().available, target: 20000 },
        recharge: { label: "Recharge Maa phone", amount: 199 },
        voice: { available: false },
        ledger: [{ date: "2026-08-12", to: "Maa, Bhojpur", amount: 2500 }],
        transferRail: "not_configured"
      });
    }
    if (req.method === "POST" && path === "/v1/home/transfers") {
      return json(res, 501, { error: "send_home_rail_not_configured" });
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
