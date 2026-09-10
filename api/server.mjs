/**
 * NiaSave P0 API. Sikh Unit owns Save. Jat Unit owns Living. Legacy API identifiers remain stable.
 * Demo member 9876541042 / NIA-1042 remains while OTP and payment are skipped.
 * Nest rupee 2200 interim. Send-home rail not configured.
 * Staff desk contract only. Member phone is owned elsewhere — do not rename tabs.
 * Not for rafiqicentral.com or harness.
 */
import http from "node:http";
import { centralCommerceHttp } from "../lib/commerce/central-http.mjs";
import { commerceHttp } from "../lib/commerce/http.mjs";
import { ownerViewHttp } from "../lib/commerce/owner-view.mjs";
import { isShowcaseEntry } from '../lib/commerce/showcase-mode.mjs';
import { randomUUID } from "node:crypto";
import {issueStaffToken, verifyStaffToken, verifyActiveStaffToken, registerStaffSession, revokeStaffSession, namedStaff, staffPageCookie, staffTokenFromHeader, validCronToken, STAFF_PAGE_COOKIE} from "../lib/staff-auth.mjs";
export {issueStaffToken, verifyStaffToken} from "../lib/staff-auth.mjs";
import { pathToFileURL } from "node:url";
import { handleStaff, isStaffPath, staffPath, staffStorageStatus, DUMMY_DATA } from "../rabbit/engine.mjs";
import { handleBison, isBisonPath, bisonPath, bisonStorageStatus } from "../bison/engine.mjs";
import { readCurrentPosition } from "../bison/current-position.mjs";
import { hasDurableStore, loadRuntimeState, saveRuntimeState } from "../lib/runtime-store.mjs";
import { readDograState, writeDograState } from "../lib/dogra-store.mjs";

const PORT = Number(process.env.PORT || 8787);
const DEMO = process.env.DEMO !== "0";
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || "";
const STAFF_TOKEN_SECRET = process.env.STAFF_TOKEN_SECRET || "";
// A missing or stale flag must never reopen hosted desks. Local demo access
// requires an explicit opt-out and cannot apply to a real-data runtime.
const STAFF_AUTH_REQUIRED = process.env.STAFF_AUTH_REQUIRED !== "0" || Boolean(process.env.VERCEL_ENV) || !DEMO || process.env.DUMMY_DATA === "0";
const now = () => new Date().toISOString();
const NOT_NIA = "This phone is not with Nia.";
const HUB_FLOW = ["pack", "count", "leave", "sell", "return", "close"];
const PROTECTED_DESK_PATHS = new Set(["/connectors", "/connectors/upload", "/predict", "/ledger", "/inventory", "/ageing", "/orders", "/beat", "/beat/open", "/beat/close", "/scan", "/recon", "/next", "/source", "/cash", "/settlements", "/tower", "/stops", "/po", "/dispatch", "/invoice", "/biker"]);
const OPEN_DESK_STAFF = { id: "stf-open-desk", email: "2para@nia.one", name: "2 Para desk", role: "open", desks: ["studio", "hub", "money", "pilot"] };
const STAFF_LOGIN_WINDOW_MS = Math.max(60_000, Number(process.env.STAFF_LOGIN_WINDOW_MS || 900_000));
const STAFF_LOGIN_MAX_PER_IP = Math.max(1, Number(process.env.STAFF_LOGIN_MAX_PER_IP || 30));
const STAFF_LOGIN_MAX_PER_IDENTITY = Math.max(1, Number(process.env.STAFF_LOGIN_MAX_PER_IDENTITY || 8));
const staffLoginAttempts = new Map();

const member = {
  id: "NIA-1042", name: "Ravi K", phone: "9876541042", job: "Warehouse picker",
  worksite: "Whitefield", nestId: "rajputana", nestName: "Rajputana Theatre", bed: "Bed 12",
  familyName: "Maa", familyPlace: "Bhojpur", sendHome: 9988, studioWindow: "5:15 PM"
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

const state = {
  extra: { id: "extra-tonight", status: "open" }, rsvp: false, issues: [],
  payments: new Map(), orders: new Map(), bags: new Map(), idem: new Map(),
  bagKeep: 126, bagSpend: 812, payMonth: 16500, nestRupee: 2200, food: 2800, other: 700, sent: 0,
  hubDay: { date: "2026-08-29", stage: "pack", packBy: null, counts: [], leaveBy: null, sellBy: null, returnBy: null, closeBy: null, carts: [] }
};

const MEMBER_RUNTIME_STATE_KEY = "member-app";
function snapshotMemberState() {
  return { extra: state.extra, rsvp: state.rsvp, issues: state.issues, orders: [...state.orders.entries()], bags: [...state.bags.entries()], bagKeep: state.bagKeep, bagSpend: state.bagSpend, payMonth: state.payMonth, nestRupee: state.nestRupee, food: state.food, other: state.other, sent: state.sent, hubDay: state.hubDay };
}
function restoreMemberState(value) {
  if (!value || typeof value !== "object") return;
  for (const key of ["extra", "rsvp", "issues", "bagKeep", "bagSpend", "payMonth", "nestRupee", "food", "other", "sent", "hubDay"]) {
    if (value[key] !== undefined) state[key] = value[key];
  }
  state.orders = new Map(Array.isArray(value.orders) ? value.orders : []);
  state.bags = new Map(Array.isArray(value.bags) ? value.bags : []);
}
function leftover() {
  const available = state.payMonth - state.nestRupee - state.bagSpend - state.food - state.other - state.sent;
  return { pay: state.payMonth, nest: state.nestRupee, bag: state.bagSpend, food: state.food, other: state.other, sent: state.sent, available, projectedExtra: state.extra.status === "taken" ? 180 : 0, note: "Food and Other are demo constants. Extra 180 is projected.", updatedAt: now() };
}
function workCurrent() {
  return { memberId: member.id, role: member.job, week: { in: 4200, due: "Friday", dueAmount: 4200, cut: 0, cutReason: null, source: "demo" }, today: { start: "08:00", end: "17:00", place: "Whitefield", bus: "7:10", distance: "600 m" }, help: { name: "Ramesh", path: "help" }, extra: { id: "extra-tonight", when: "Tonight 6-8 PM", place: "Studio", keep: 180, bus: "With you", weekIfTaken: 5000, status: state.extra.status }, next: { days: 3, role: "picker+", monthly: 1500 } };
}
function nestCurrent() {
  return { memberId: member.id, nestId: "rajputana", name: "Rajputana Theatre", bed: "Bed 12", rupee: state.nestRupee, walk: "12 min to work", nextPay: "2026-09-01", included: [{ name: "Wi-Fi", status: "Working" }, { name: "Power", status: "Working" }, { name: "Water", status: "Working" }, { name: "Clean", status: "Today 11 AM" }, { name: "Gate", status: "24x7" }, { name: "Lock", status: "12" }, { name: "Bed", status: "In" }, { name: "Hall", status: "Till 10 PM" }], event: { id: "bada-khaana", title: "Bada Khaana this Sunday", when: "19:00", place: "Rajputana Theatre", attending: 46, mine: state.rsvp }, book: [{ id: "laundry", name: "Laundry", backBy: "18:00", price: 0 }, { id: "trim", name: "Trim", price: 80 }], issue: state.issues[0] || null };
}
function json(res, code, body) {
  res.writeHead(code, { "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "access-control-allow-headers": "Content-Type, Idempotency-Key, Authorization", "access-control-allow-methods": "GET,POST,PUT,OPTIONS" });
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
function digits(phone) { return String(phone || "").replace(/\D/g, "").slice(-10); }
const safeCode = value => {
  const code = String(value || "").trim();
  return /^[a-z0-9_]{2,80}$/i.test(code) ? code : "unclassified";
};
function logApiEvent(event, detail = {}) {
  console.error(event, {
    path: String(detail.path || "").slice(0, 180),
    method: String(detail.method || "").slice(0, 10),
    code: safeCode(detail.code)
  });
}
function tokenFromCookie(req) {
  const cookies = String(req.headers.cookie || "").split(";").map(part => part.trim());
  const pair = cookies.find(item => item.startsWith(STAFF_PAGE_COOKIE + "="));
  return pair ? pair.slice(STAFF_PAGE_COOKIE.length + 1) : "";
}
function staffTokenFromReq(req) {
  const bearer = staffTokenFromHeader(req.headers);
  return bearer || tokenFromCookie(req);
}
function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}
function consumeLimit(key, max, at = Date.now()) {
  const row = staffLoginAttempts.get(key);
  if (!row || at - row.start > STAFF_LOGIN_WINDOW_MS) {
    staffLoginAttempts.set(key, { start: at, count: 1 });
    return true;
  }
  row.count += 1;
  return row.count <= max;
}
async function staffFromReq(req) {
  const raw = staffTokenFromReq(req);
  if (!raw) return null;
  return verifyActiveStaffToken(raw);
}
async function requireStaff(req, res, desks) {
  const staff = await staffFromReq(req) || (STAFF_AUTH_REQUIRED ? null : OPEN_DESK_STAFF);
  if (!staff) { json(res, 401, { error: "staff_required" }); return null; }
  if (desks && desks.length && !staff.desks.some(d => desks.includes(d)) && staff.role !== "admin") {
    json(res, 403, { error: "desk_forbidden", staff: { id: staff.id, role: staff.role } }); return null;
  }
  return staff;
}
function publicMember() { return { id: member.id, name: member.name, phone: member.phone, studio: member.nestName, studioWindow: member.studioWindow, job: member.job, sendHome: member.sendHome }; }
function catalogPayload() { return { studioName: member.nestName, deliveryTime: member.studioWindow, weeklySavings: state.bagKeep, feverPerk: "Bag 500 this month -> fever day free", rail: "upi_only", window: "Studio window", products: catalog }; }
function nextHub(from) { const i = HUB_FLOW.indexOf(from); return i >= 0 && i < HUB_FLOW.length - 1 ? HUB_FLOW[i + 1] : from; }

export async function handler(req, res) {
  if (isShowcaseEntry()) return json(res,503,{error:'use_isolated_showcase_entry'});
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(req.url, "http://localhost");
  const rewrittenPath = url.searchParams.get("path");
  const path = rewrittenPath ? `/${rewrittenPath.replace(/^\/+/, "")}` : url.pathname;
  const commercePath = path.replace(/^\/api/, "");
  if (commercePath.startsWith('/v1/staff/storefront/')) return ownerViewHttp(req,res,commercePath.slice('/v1/staff/storefront'.length),staffFromReq);
  if (commercePath === "/central/commerce") return centralCommerceHttp(req,res);
  if (commercePath.startsWith("/commerce/")) return commerceHttp(req, res, commercePath.slice(9), staffFromReq);
  // A live storefront must not expose the prototype's unauthenticated order/payment paths.
  if (process.env.COMMERCE_ENABLED === "1" && (/^\/(api\/)?(order|member|auth)(\/|$)/.test(path) || /^\/v1\/(save|orders|payments|members)(\/|$)/.test(path))) return json(res,410,{error:"use_member_storefront"});
  const key = req.headers["idempotency-key"];
  const rabbitPath = staffPath(path, rewrittenPath);
  const staffRequest = isStaffPath(rabbitPath);
  const livingPath = bisonPath(path, rewrittenPath);
  const livingRequest = isBisonPath(livingPath);
  const dograRequest = path === "/dogra/state" || path === "/api/dogra/state";
  let memberStateVersion = null;
  try {
    if (!staffRequest && !livingRequest && !dograRequest && hasDurableStore()) {
      try {
        const loaded = await loadRuntimeState(MEMBER_RUNTIME_STATE_KEY, snapshotMemberState());
        restoreMemberState(loaded.value);
        memberStateVersion = loaded.version;
      } catch {
        logApiEvent("member_state_load_failed", { path, method: req.method, code: "runtime_store_unavailable" });
      }
    }
    if (staffRequest) {
      const body = (req.method === "POST" || req.method === "PUT") ? await readBody(req) : {};
      if (PROTECTED_DESK_PATHS.has(rabbitPath)) {
        const skipOpenGet = !STAFF_AUTH_REQUIRED && DUMMY_DATA && req.method === "GET";
        if (!skipOpenGet) {
          const staff = await requireStaff(req, res, ["studio", "hub", "money", "pilot"]);
          if (!staff) return;
          body.actor = `${staff.name} · ${staff.email}`;
        }
      }
      const out = await handleStaff(req, res, rabbitPath, body, url);
      if (out) return json(res, out.status, out.body);
    }
    if (livingRequest) {
      const body = (req.method === "POST" || req.method === "PUT") ? await readBody(req) : {};
      const cronSync = livingPath === '/bison/data/sync' && req.method === 'GET' && validCronToken(staffTokenFromHeader(req.headers));
      const staff = cronSync ? {name:'Scheduled Living sync', email:'scheduler'} : await requireStaff(req, res, ["studio", "money", "living"]);
      if (!staff) return;
      if (livingPath === '/bison/current-position') {
        res.setHeader('Cache-Control', 'private, no-store');
        if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
        try { return json(res, 200, await readCurrentPosition()); }
        catch { return json(res, 503, { error: 'occupancy_source_unavailable', source: 'UI_Occupancy' }); }
      }
      body.actor = `${staff.name} · ${staff.email}`;
      const out = await handleBison(req, res, livingPath, body, url);
      if (out) return json(res, out.status, out.body);
    }
    if (dograRequest) {
      const staff = await requireStaff(req, res, ["studio", "money", "pilot"]);
      if (!staff) return;
      if (req.method === "GET") return json(res, 200, await readDograState());
      if (req.method === "PUT") {
        const body = await readBody(req);
        const out = await writeDograState(body.state, body.expectedVersion);
        return json(res, out.status, out);
      }
      return json(res, 405, { error: "method_not_allowed" });
    }
    if (req.method === "GET" && (path === "/health" || path === "/v1/health")) {
      const storage = await staffStorageStatus();
      return json(res, 200, { ok: true, product: "niasave", demo: DEMO, demoScope: ["otp", "payments"], time: now(), hubStage: state.hubDay.stage, storage, bison: await bisonStorageStatus() });
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
    if (req.method === "GET" && (path === "/v1/catalog" || path === "/v1/save/catalog")) return json(res, 200, catalogPayload());
    if (req.method === "POST" && (path === "/v1/payments" || path === "/v1/save/upi" || path === "/v1/save/bag")) {
      const body = await readBody(req);
      if (key && state.idem.has(key)) return json(res, 200, state.idem.get(key));
      const phone = digits(body.phone || (body.member && body.member.phone));
      if (phone && phone !== member.phone) return json(res, 403, { error: "not_nia", message: NOT_NIA });
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return json(res, 400, { error: "bad_amount" });
      const method = String(body.method || "upi").toLowerCase();
      if (method !== "upi") return json(res, 400, { error: "upi_only" });
      const payment = { id: "pay-" + randomUUID().slice(0, 8), amount, method: "upi", status: DEMO ? "succeeded" : "pending", memberId: body.memberId || member.id, window: "Studio window", createdAt: now() };
      const bag = { id: "bag-" + randomUUID().slice(0, 8), paymentId: payment.id, memberId: payment.memberId, cart: body.cart || [], amount, destination: member.nestName, window: member.studioWindow, status: "hub_hold" };
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
        pay = { id: "pay-" + randomUUID().slice(0, 8), amount, method: "upi", status: DEMO ? "succeeded" : "pending", memberId: body.memberId || member.id, cart: body.cart || [], createdAt: now() };
        state.payments.set(pay.id, pay);
      }
      if (!pay) return json(res, 404, { error: "payment_not_found" });
      if (pay.status !== "succeeded") return json(res, 409, { error: "payment_not_succeeded", status: pay.status });
      const order = { id: "ord-" + randomUUID().slice(0, 8), paymentId: pay.id, memberId: pay.memberId, total: pay.amount, rail: "upi", status: "hub_created", delivery: "Hub has your bag. Delivered to your Studio at " + member.studioWindow + ".", createdAt: now() };
      state.orders.set(order.id, order);
      state.bagSpend = pay.amount;
      state.hubDay.carts.push({ orderId: order.id, amount: pay.amount, at: now() });
      if (key) state.idem.set(key, order);
      return json(res, 201, order);
    }
    if (req.method === "GET" && path === "/v1/home/leftover") {
      const left = leftover();
      return json(res, 200, { memberId: member.id, family: { name: member.familyName, place: member.familyPlace }, leftover: left, canSend: member.sendHome, goal: { name: "Roof at home", current: left.available, target: 20000 }, recharge: { label: "Recharge Maa phone", amount: 199 }, voice: { available: false }, ledger: [{ date: "2026-08-12", to: "Maa, Bhojpur", amount: 2500 }], transferRail: "not_configured" });
    }
    if (req.method === "POST" && path === "/v1/home/transfers") return json(res, 501, { error: "send_home_rail_not_configured" });
    if (req.method === "POST" && path === "/v1/staff/login") {
      if (req.headers.origin) {
        try { if (new URL(req.headers.origin).host !== req.headers.host) return json(res, 403, {error:"origin_mismatch"}); }
        catch { return json(res, 403, {error:"origin_mismatch"}); }
      }
      if (STAFF_TOKEN_SECRET.length < 32) return json(res, 503, { error: "staff_auth_not_configured" });
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const ip = clientIp(req);
      const limitIp = consumeLimit(`staff-login-ip:${ip}`, STAFF_LOGIN_MAX_PER_IP);
      const limitIdentity = consumeLimit(`staff-login-id:${ip}:${email || "unknown"}`, STAFF_LOGIN_MAX_PER_IDENTITY);
      if (!limitIp || !limitIdentity) {
        res.setHeader("Retry-After", String(Math.ceil(STAFF_LOGIN_WINDOW_MS / 1000)));
        return json(res, 429, { error: "too_many_attempts" });
      }
      const found = namedStaff(email);
      const expectedPassword = found?.id === "stf-ajay-mahawar" ? process.env.JAT_STAFF_PASSWORD : STAFF_PASSWORD;
      if (!found || !expectedPassword || password !== expectedPassword) return json(res, 401, { error: "bad_credentials" });
      const token = issueStaffToken(found);
      const activated = await registerStaffSession(token);
      if (!activated.ok) {
        logApiEvent("staff_session_register_failed", { path, method: req.method, code: activated.error });
        return json(res, 503, { error: "staff_session_unavailable" });
      }
      res.setHeader("Set-Cookie", staffPageCookie(token));
      return json(res, 200, { token, staff: { id: found.id, email: found.email, name: found.name, role: found.role, desks: found.desks } });
    }
    if (req.method === "GET" && path === "/v1/staff/me") {
      const staff = await requireStaff(req, res);
      if (!staff) return;
      const raw = staffTokenFromReq(req);
      if (raw) res.setHeader("Set-Cookie", staffPageCookie(raw));
      return json(res, 200, { staff: { id: staff.id, email: staff.email, name: staff.name, role: staff.role, desks: staff.desks } });
    }
    if (req.method === "POST" && path === "/v1/staff/logout") {
      const headerToken = staffTokenFromHeader(req.headers);
      const cookieToken = tokenFromCookie(req);
      const results = [];
      if (headerToken) results.push(await revokeStaffSession(headerToken));
      if (cookieToken && cookieToken !== headerToken) results.push(await revokeStaffSession(cookieToken));
      if (results.some(result => !result.ok)) {
        logApiEvent("staff_session_revoke_failed", { path, method: req.method, code: "staff_session_unavailable" });
        return json(res, 503, { error: "staff_session_unavailable" });
      }
      res.setHeader("Set-Cookie", staffPageCookie(""));
      return json(res, 200, { ok: true });
    }
    if (req.method === "GET" && path === "/v1/staff/hub/day") {
      const staff = await requireStaff(req, res, ["hub", "studio", "pilot"]);
      if (!staff) return;
      return json(res, 200, { day: state.hubDay, flow: HUB_FLOW });
    }
    if (req.method === "POST" && path === "/v1/staff/hub/advance") {
      const staff = await requireStaff(req, res, ["hub", "studio"]);
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
        if (state.hubDay.counts.some(c => c.staffId === staff.id)) return json(res, 409, { error: "already_counted", staffId: staff.id });
        state.hubDay.counts.push({ staffId: staff.id, name: staff.name, at: now(), units: Number(body.units) || state.hubDay.carts.length });
        if (state.hubDay.counts.length < 2) return json(res, 200, { day: state.hubDay, pending: "second_count" });
      }
      state.hubDay.stage = want;
      const stamp = want + "By";
      if (stamp in state.hubDay) state.hubDay[stamp] = { staffId: staff.id, at: now() };
      return json(res, 200, { day: state.hubDay });
    }
    return json(res, 404, { error: "not_found" });
  } catch (err) {
    if (err.message === "invalid_json") return json(res, 400, { error: "invalid_json" });
    logApiEvent("server_error", { path, method: req.method, code: err && err.message });
    return json(res, 500, { error: "server_error" });
  } finally {
    const successfulMutation = memberStateVersion != null && (req.method === "POST" || req.method === "PUT") && res.statusCode < 400;
    if (successfulMutation) {
      try {
        const saved = await saveRuntimeState(MEMBER_RUNTIME_STATE_KEY, snapshotMemberState(), memberStateVersion);
        if (!saved.ok) logApiEvent("member_state_conflict", { path, method: req.method, code: "state_conflict" });
      } catch {
        logApiEvent("member_state_save_failed", { path, method: req.method, code: "runtime_store_unavailable" });
      }
    }
  }
}

export default handler;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  http.createServer(handler).listen(PORT, "127.0.0.1", () => {
    process.stdout.write("niasave api on :" + PORT + " demo=" + DEMO + "\n");
  });
}
