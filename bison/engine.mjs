/**
 * Bison occupancy control plane.
 * Polo runs bags. Bison runs nests.
 */
import { hasDurableStore, loadRuntimeState, saveRuntimeState } from "../lib/runtime-store.mjs";

const DUMMY_DATA = process.env.DUMMY_DATA !== "0";
const RUNTIME_STATE_KEY = process.env.NIA_BISON_STATE_KEY || "operation-bison";
const HOLD_FILL_RS = 2000;
const TAX_PCT = 12;
const NEST_RATE = 2200;
const SOURCE = "Bison occupancy book";
const OCC_TARGET = 78;

function now() { return new Date().toISOString(); }
function today() { return now().slice(0, 10); }
function plusDays(iso, n) { const d = new Date(iso + "T00:00:00.000Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function daysBetween(a, b) { const x = Date.parse(a), y = Date.parse(b); if (!Number.isFinite(x) || !Number.isFinite(y)) return 0; return Math.max(0, Math.round((y - x) / 86400000)); }
function hoursFromNow(h) { return new Date(Date.now() + h * 3600000).toISOString(); }

function seedSites() {
  return [
    { id: "hsr", city: "Bengaluru", studio: "HSR", code: "WLG-HSR", theatre: "Wellington", cluster: "HSR", model: "FONO", occupied: 774, contracted: 900, vacant: 126, pending: 1364700, owner: "ACT-SHREY", clockDueAt: hoursFromNow(-6), openActions: 83, weeklyPp: 8.5, lastCount: 526, status: "alarm", overdueCheckout: 58, pendingPerNest: 1763, rate: NEST_RATE },
    { id: "blr", city: "Bengaluru", studio: "BLR Central", code: "WLG-BLR", theatre: "Wellington", cluster: "BLR", model: "SP", occupied: 61, contracted: 65, vacant: 4, pending: 189100, owner: "ACT-SHREY", clockDueAt: hoursFromNow(18), openActions: 0, weeklyPp: 87.7, lastCount: 57, status: "alarm", overdueCheckout: 0, pendingPerNest: 3100, rate: NEST_RATE },
    { id: "chk", city: "Bengaluru", studio: "CHK", code: "DCN-CHK", theatre: "Deccan", cluster: "CHK", model: "FONO", occupied: 165, contracted: 187, vacant: 22, pending: 319800, owner: "ACT-SHREY", clockDueAt: hoursFromNow(-6), openActions: 2, weeklyPp: 85.6, lastCount: 162, status: "watch", overdueCheckout: 1, pendingPerNest: 1938, rate: NEST_RATE },
    { id: "fn", city: "NCR", studio: "FN", code: "RJT-FN", theatre: "Rajputana", cluster: "FN", model: "FONO", occupied: 909, contracted: 1008, vacant: 99, pending: 1980000, owner: "ACT-SHREY", clockDueAt: hoursFromNow(-6), openActions: 105, weeklyPp: 76.0, lastCount: 766, status: "alarm", overdueCheckout: 36, pendingPerNest: 2178, rate: NEST_RATE },
    { id: "mns", city: "NCR", studio: "MNS", code: "RJT-MNS", theatre: "Rajputana", cluster: "MNS", model: "FONO", occupied: 436, contracted: 464, vacant: 28, pending: 1031650, owner: "ACT-SHREY", clockDueAt: hoursFromNow(-6), openActions: 128, weeklyPp: 82.8, lastCount: 383, status: "alarm", overdueCheckout: 126, pendingPerNest: 2366, rate: NEST_RATE },
    { id: "sri", city: "Chennai", studio: "SRI", code: "CRM-SRI", theatre: "Coromandel", cluster: "SRI", model: "FONO", occupied: 262, contracted: 507, vacant: 245, pending: 666060, owner: "ACT-SHREY", clockDueAt: hoursFromNow(-6), openActions: 81, weeklyPp: 31.8, lastCount: 189, status: "alarm", overdueCheckout: 68, pendingPerNest: 2542, rate: NEST_RATE }
  ];
}
function seedGroups() { return [{ id: "grp-nia", name: "Nia members", kind: "member" }, { id: "grp-vendor", name: "Vendor walk-in", kind: "company" }]; }
function seedBookings() {
  const t = today();
  return [
    { id: "bkg-1001", siteId: "hsr", nestId: "HSR-012", guest: "Ravi K", companyId: "grp-nia", arrive: t, depart: plusDays(t, 30), status: "in", rate: NEST_RATE, taxPct: TAX_PCT, folio: [{ id: "fol-1", kind: "rent", amount: NEST_RATE, note: "Night 1", at: now() }], createdAt: now() },
    { id: "bkg-1002", siteId: "chk", nestId: "CHK-004", guest: "Imran S", companyId: "grp-nia", arrive: t, depart: plusDays(t, 14), status: "reserved", rate: NEST_RATE, taxPct: TAX_PCT, folio: [], createdAt: now() },
    { id: "bkg-1003", siteId: "sri", nestId: "SRI-088", guest: "Karthik M", companyId: "grp-vendor", arrive: plusDays(t, -2), depart: t, status: "in", rate: NEST_RATE, taxPct: TAX_PCT, folio: [{ id: "fol-2", kind: "rent", amount: NEST_RATE * 2, note: "2 nights", at: now() }], createdAt: now() }
  ];
}
function seedJoinMonths() {
  return [
    { id: "2026-03", label: "Mar 26", members: 2, notices: 0, unverified: 0, first90Open: 0, status: "ok", note: "Stable." },
    { id: "2026-04", label: "Apr 26", members: 5, notices: 0, unverified: 0, first90Open: 5, status: "ok", note: "Stable." },
    { id: "2026-05", label: "May 26", members: 168, notices: 35, unverified: 3, first90Open: 110, status: "alarm", note: "Notice save." },
    { id: "2026-06", label: "Jun 26", members: 3164, notices: 39, unverified: 62, first90Open: 2492, status: "alarm", note: "Notice save." }
  ];
}
function createState() {
  return { dummy: DUMMY_DATA, persist: hasDurableStore() ? "postgres" : "memory", asOf: today(), source: SOURCE, bookingsCount: 3339, studioCodes: 56, sites: seedSites(), groups: seedGroups(), bookings: seedBookings(), audits: [], ingest: [], joinMonths: seedJoinMonths(), assignments: [], clocks: [], auditLog: [] };
}
let state = createState();
function snapshotState(value = state) { return JSON.parse(JSON.stringify(value)); }
function restoreState(value, storage = "memory") {
  const base = createState();
  const restored = { ...base, ...(value || {}) };
  restored.sites = Array.isArray(restored.sites) && restored.sites.length ? restored.sites : base.sites;
  restored.groups = Array.isArray(restored.groups) && restored.groups.length ? restored.groups : base.groups;
  restored.bookings = Array.isArray(restored.bookings) ? restored.bookings : base.bookings;
  restored.audits = Array.isArray(restored.audits) ? restored.audits : [];
  restored.ingest = Array.isArray(restored.ingest) ? restored.ingest : [];
  restored.joinMonths = Array.isArray(restored.joinMonths) ? restored.joinMonths : base.joinMonths;
  restored.assignments = Array.isArray(restored.assignments) ? restored.assignments : [];
  restored.clocks = Array.isArray(restored.clocks) ? restored.clocks : [];
  restored.auditLog = Array.isArray(restored.auditLog) ? restored.auditLog : [];
  restored.source = SOURCE; restored.persist = storage; state = restored;
}
function log(actor, action, ref, detail) {
  state.auditLog.unshift({ id: "log-" + (state.auditLog.length + 1), at: now(), actor: actor || "desk", action, ref: ref || null, detail: detail || "" });
  state.auditLog = state.auditLog.slice(0, 400);
}
function findSite(id) { return state.sites.find(s => s.id === id || s.code === id); }
function findBooking(id) { return state.bookings.find(b => b.id === id); }
function pendingPerNest(site) { if (site.pendingPerNest != null) return site.pendingPerNest; return site.occupied ? Math.round((site.pending || 0) / site.occupied) : 0; }
function clockLabel(site, at = Date.now()) {
  const due = Date.parse(site.clockDueAt); if (!Number.isFinite(due)) return "No clock";
  const hours = Math.round((due - at) / 3600000); return hours < 0 ? "Overdue " + Math.abs(hours) + "h" : "Due " + hours + "h";
}
function refreshSite(site) {
  const clock = clockLabel(site); const heavy = pendingPerNest(site) > HOLD_FILL_RS;
  if (clock.startsWith("Overdue") && heavy) site.status = "alarm"; else if (clock.startsWith("Overdue") || heavy) site.status = "watch"; else site.status = "ok"; return site;
}
function liveOnDate(date, siteId) {
  return state.bookings.filter(b => { if (b.status === "cancelled" || b.status === "out") return false; if (siteId && b.siteId !== siteId) return false; return b.arrive <= date && date < b.depart; });
}
function nestTaken(siteId, nestId, arrive, depart, exceptId) {
  if (!nestId) return false;
  return state.bookings.some(b => { if (b.id === exceptId || b.status === "cancelled" || b.status === "out") return false; if (b.siteId !== siteId || b.nestId !== nestId) return false; return !(depart <= b.arrive || arrive >= b.depart); });
}
function folioTotal(booking) {
  const rent = (booking.folio || []).reduce((n, l) => n + (Number(l.amount) || 0), 0);
  const tax = Math.round(rent * ((booking.taxPct || 0) / 100)); return { rent, tax, gross: rent + tax };
}
function nextId(prefix, list) { return prefix + "-" + String((list || []).length + 1001); }
function folioOf(booking) { const tot = folioTotal(booking); return { bookingId: booking.id, guest: booking.guest, nestId: booking.nestId, rate: booking.rate, taxPct: booking.taxPct, lines: booking.folio || [], rent: tot.rent, tax: tot.tax, gross: tot.gross }; }

export function createBooking(body = {}) {
  const site = findSite(body.siteId || body.code); if (!site) return { error: "site_not_found", status: 404 };
  const arrive = String(body.arrive || today()); const depart = String(body.depart || plusDays(arrive, 30));
  if (depart <= arrive) return { error: "bad_dates", status: 400 };
  const nights = daysBetween(arrive, depart) || 1;
  const vacantOnDate = Math.max(0, site.contracted - liveOnDate(arrive, site.id).length);
  if (vacantOnDate < 1 && !body.force) return { error: "no_vacant", status: 409, vacant: vacantOnDate };
  const nestId = String(body.nestId || (site.code + "-" + String(site.occupied + 1).padStart(3, "0")));
  if (nestTaken(site.id, nestId, arrive, depart)) return { error: "nest_taken", status: 409, nestId };
  const rate = Number(body.rate) || site.rate || NEST_RATE;
  const booking = { id: nextId("bkg", state.bookings), siteId: site.id, nestId, guest: String(body.guest || "Member").slice(0, 48), companyId: body.companyId || "grp-nia", arrive, depart, status: "reserved", rate, taxPct: body.taxPct != null ? Number(body.taxPct) : TAX_PCT, folio: [{ id: nextId("fol", []), kind: "rent", amount: rate * nights, note: nights + " night(s)", at: now() }], createdAt: now() };
  state.bookings.unshift(booking); log(body.actor, "book", booking.id, nestId); return { ok: true, booking, folio: folioOf(booking) };
}
export function amendBooking(body = {}) {
  const booking = findBooking(body.bookingId || body.id); if (!booking) return { error: "booking_not_found", status: 404 };
  if (booking.status === "cancelled" || booking.status === "out") return { error: "closed", status: 409, statusHave: booking.status };
  const arrive = String(body.arrive || booking.arrive); const depart = String(body.depart || booking.depart);
  if (depart <= arrive) return { error: "bad_dates", status: 400 };
  const nestId = body.nestId ? String(body.nestId) : booking.nestId;
  if (nestTaken(booking.siteId, nestId, arrive, depart, booking.id)) return { error: "nest_taken", status: 409, nestId };
  booking.arrive = arrive; booking.depart = depart; booking.nestId = nestId;
  if (body.guest) booking.guest = String(body.guest).slice(0, 48);
  if (body.rate != null) booking.rate = Number(body.rate);
  if (body.companyId) booking.companyId = body.companyId;
  log(body.actor, "amend", booking.id, nestId); return { ok: true, booking };
}
export function cancelBooking(body = {}) {
  const booking = findBooking(body.bookingId || body.id); if (!booking) return { error: "booking_not_found", status: 404 };
  if (booking.status === "in") return { error: "in_house", status: 409, message: "Check out first." };
  booking.status = "cancelled"; booking.cancelledAt = now(); log(body.actor, "cancel", booking.id, ""); return { ok: true, booking };
}
export function checkIn(body = {}) {
  const booking = findBooking(body.bookingId || body.id); if (!booking) return { error: "booking_not_found", status: 404 };
  if (booking.status !== "reserved") return { error: "not_reserved", status: 409, have: booking.status };
  const site = findSite(booking.siteId); const nestId = String(body.nestId || booking.nestId);
  if (!nestId) return { error: "nest_required", status: 400 };
  if (nestTaken(booking.siteId, nestId, booking.arrive, booking.depart, booking.id)) return { error: "nest_taken", status: 409, nestId };
  booking.nestId = nestId; booking.status = "in"; booking.checkedInAt = now();
  if (site && site.vacant > 0) { site.vacant -= 1; site.occupied += 1; refreshSite(site); }
  log(body.actor, "checkin", booking.id, nestId); return { ok: true, booking };
}
export function checkOut(body = {}) {
  const booking = findBooking(body.bookingId || body.id); if (!booking) return { error: "booking_not_found", status: 404 };
  if (booking.status !== "in") return { error: "not_in_house", status: 409, have: booking.status };
  const site = findSite(booking.siteId); booking.status = "out"; booking.checkedOutAt = now();
  if (site) { site.occupied = Math.max(0, site.occupied - 1); site.vacant += 1; refreshSite(site); }
  log(body.actor, "checkout", booking.id, booking.nestId); return { ok: true, booking, folio: folioOf(booking) };
}
export function addFolio(body = {}) {
  const booking = findBooking(body.bookingId || body.id); if (!booking) return { error: "booking_not_found", status: 404 };
  const amount = Number(body.amount); if (!Number.isFinite(amount)) return { error: "bad_amount", status: 400 };
  const line = { id: nextId("fol", booking.folio || []), kind: String(body.kind || "other"), amount, note: String(body.note || ""), at: now() };
  booking.folio = (booking.folio || []).concat([line]); log(body.actor, "folio", booking.id, line.kind); return { ok: true, folio: folioOf(booking) };
}
export function addGroup(body = {}) {
  const name = String(body.name || "").trim(); if (!name) return { error: "name_required", status: 400 };
  const row = { id: nextId("grp", state.groups), name, kind: body.kind || "company" }; state.groups.push(row); return { ok: true, group: row, groups: state.groups };
}
export function inventoryPayload(query = {}) {
  const date = query.date || today(); const siteFilter = query.site;
  const sites = state.sites.filter(s => !siteFilter || s.id === siteFilter || s.code === siteFilter);
  return { ok: true, date, rows: sites.map(s => { const live = liveOnDate(date, s.id); const booked = live.length; return { siteId: s.id, site: s.studio, code: s.code, date, contracted: s.contracted, booked, inHouse: live.filter(b => b.status === "in").length, reserved: live.filter(b => b.status === "reserved").length, vacant: Math.max(0, s.contracted - booked), occPct: s.contracted ? Math.round((booked / s.contracted) * 1000) / 10 : 0, nests: live.map(b => ({ nestId: b.nestId, bookingId: b.id, guest: b.guest, status: b.status })) }; }) };
}
export function auditPayload(query = {}) {
  const date = query.date || today(); const existing = state.audits.find(a => a.date === date); const inv = inventoryPayload({ date });
  return { ok: true, date, closed: Boolean(existing), closedAt: existing && existing.at, inventory: inv.rows, last: state.audits[0] || null };
}
export function runAudit(body = {}) {
  const date = String(body.date || today()); if (state.audits.some(a => a.date === date)) return { error: "already_closed", status: 409, date };
  const inv = inventoryPayload({ date });
  const row = { date, at: now(), actor: body.actor || "desk", occupied: inv.rows.reduce((n, r) => n + r.booked, 0), vacant: inv.rows.reduce((n, r) => n + r.vacant, 0), inHouse: inv.rows.reduce((n, r) => n + r.inHouse, 0) };
  state.audits.unshift(row); state.asOf = date; return { ok: true, audit: row, inventory: inv.rows };
}
export function ingestBook(body = {}) {
  const rows = Array.isArray(body.bookings) ? body.bookings : []; const sites = Array.isArray(body.sites) ? body.sites : [];
  let booked = 0, updated = 0;
  for (const s of sites) { const site = findSite(s.id || s.code); if (!site) continue; for (const k of ["occupied", "contracted", "vacant", "pending", "pendingPerNest", "rate"]) { if (s[k] != null) site[k] = s[k]; } refreshSite(site); updated += 1; }
  for (const row of rows) {
    const site = findSite(row.siteId || row.code); if (!site) continue;
    state.bookings.unshift({ id: row.id || nextId("bkg", state.bookings), siteId: site.id, nestId: String(row.nestId || ""), guest: String(row.guest || "Member").slice(0, 48), companyId: row.companyId || "grp-nia", arrive: String(row.arrive || today()), depart: String(row.depart || plusDays(today(), 30)), status: ["in", "out", "cancelled"].includes(row.status) ? row.status : "reserved", rate: Number(row.rate) || site.rate || NEST_RATE, taxPct: row.taxPct != null ? Number(row.taxPct) : TAX_PCT, folio: Array.isArray(row.folio) ? row.folio : [], createdAt: now() });
    booked += 1;
  }
  if (body.asOf) state.asOf = String(body.asOf);
  state.ingest.unshift({ at: now(), bookings: booked, sites: updated, filename: body.filename || "ingest" });
  return { ok: true, bookings: booked, sites: updated, asOf: state.asOf };
}
export function bookingsPayload(query = {}) {
  let list = state.bookings; if (query.site) list = list.filter(b => b.siteId === query.site); if (query.status) list = list.filter(b => b.status === query.status);
  return { ok: true, count: list.length, bookings: list.slice(0, 200).map(b => ({ ...b, folioSummary: folioTotal(b) })) };
}
function totals() {
  const occupied = state.sites.reduce((n, s) => n + s.occupied, 0); const contracted = state.sites.reduce((n, s) => n + s.contracted, 0); const vacant = state.sites.reduce((n, s) => n + s.vacant, 0); const pending = state.sites.reduce((n, s) => n + s.pending, 0);
  return { occupied, contracted, vacant, pending, occPct: contracted ? Math.round((occupied / contracted) * 1000) / 10 : 0, occTarget: OCC_TARGET };
}
function sitesFor(city) { if (!city || city === "All") return state.sites; return state.sites.filter(s => s.city === city || s.theatre === city || s.cluster === city); }
export function towerPayload(query = {}) {
  const city = query.city || "All"; const list = sitesFor(city).map(s => ({ ...s, clock: clockLabel(s), pendingPerNest: pendingPerNest(s) })); const t = totals();
  const overdue = list.filter(s => String(s.clock).startsWith("Overdue")); const openBookings = state.bookings.filter(b => b.status === "reserved" || b.status === "in");
  return { product: "bison", sibling: "polo", skip: DUMMY_DATA, asOf: state.asOf, persist: state.persist, source: SOURCE, city, cities: ["All", ...Array.from(new Set(state.sites.map(s => s.city)))], theatres: ["All", ...Array.from(new Set(state.sites.map(s => s.theatre)))], clusters: ["All", ...Array.from(new Set(state.sites.map(s => s.cluster)))], kpis: { occupied: t.occupied, contracted: t.contracted, vacant: t.vacant, occPct: t.occPct, occTarget: t.occTarget, overdueClocks: overdue.length, pending: t.pending, joinMonths: state.joinMonths.length, sites: list.length, bookingsOpen: openBookings.length, inHouse: state.bookings.filter(b => b.status === "in").length }, sites: list, blockers: overdue.map(s => ({ level: s.status, area: "Bison", site: s.studio + " · " + s.code, city: s.city, text: s.clock, owner: s.owner, when: s.clock })), actNow: list.filter(s => s.status !== "ok").map(s => { const ppn = pendingPerNest(s); return { id: s.id, site: s.studio, city: s.city, model: s.model, code: s.code, lastCount: s.lastCount, status: s.status, weekly: s.weeklyPp + " pp · ₹" + ppn + "/nest · " + s.vacant + " vacant", action: ppn > HOLD_FILL_RS ? "Collections first. Clock still must close." : "Close the clock, then fill.", desk: "/bison", holdFill: ppn > HOLD_FILL_RS }; }), bookings: openBookings.slice(0, 40), groups: state.groups, joinMonths: state.joinMonths, note: "Bison runs nests. Polo runs bags. Finance bills the nest." };
}
export function assignNest(body = {}) { return createBooking({ ...body, guest: body.guest || body.memberId || "Member" }); }
export function vacateNest(body = {}) {
  if (body.bookingId) return checkOut(body);
  const site = findSite(body.siteId || body.code); if (!site) return { error: "site_not_found", status: 404 };
  const inHouse = state.bookings.find(b => b.siteId === site.id && b.status === "in"); if (inHouse) return checkOut({ bookingId: inHouse.id, actor: body.actor });
  if (site.occupied < 1) return { error: "not_occupied", status: 409 }; site.occupied -= 1; site.vacant += 1; refreshSite(site); return { ok: true, site };
}
export function clearClock(body = {}) {
  const site = findSite(body.siteId || body.code); if (!site) return { error: "site_not_found", status: 404 };
  site.clockDueAt = hoursFromNow(Number(body.nextHours) || 18); site.openActions = Math.max(0, (site.openActions || 0) - 1); refreshSite(site); return { ok: true, site: { ...site, clock: clockLabel(site) } };
}
export function bisonPath(pathname, rewrittenPath) { let p = rewrittenPath ? "/" + String(rewrittenPath).replace(/^\/+/, "") : pathname; p = (p || "/").replace(/\/+$/, "") || "/"; if (p.startsWith("/api/")) p = p.slice(4); return p; }
export function isBisonPath(p) { return p === "/bison" || p.startsWith("/bison/") || p === "/living" || p.startsWith("/living/"); }
function normalize(p) { return p.replace(/^\/living/, "/bison"); }
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
  return { status: 409, body: { error: "state_conflict", message: "Please try again." } };
}
export async function bisonStorageStatus() {
  if (!hasDurableStore()) return { storage: "memory", connected: false, version: 0, product: "bison" };
  const loaded = await loadRuntimeState(RUNTIME_STATE_KEY, snapshotState(createState()));
  return { storage: loaded.storage, connected: true, version: loaded.version, product: "bison" };
}
export function resetBison() { state = createState(); return state; }
function done(result, fallback = 200) { if (result && result.error) return { status: result.status || 400, body: result }; return { status: fallback, body: result }; }
async function handleOnce(req, path, body, url) {
  const q = {}; url.searchParams.forEach((v, k) => { if (k !== "path") q[k] = v; });
  const p = normalize(path); const method = req.method;
  if (method === "GET" && (p === "/bison" || p === "/bison/tower")) return { status: 200, body: towerPayload(q) };
  if (method === "GET" && p === "/bison/sites") return { status: 200, body: { ok: true, sites: towerPayload(q).sites } };
  if (method === "GET" && p === "/bison/bookings") return { status: 200, body: bookingsPayload(q) };
  if (method === "POST" && p === "/bison/bookings") return done(createBooking(body || {}));
  if (method === "POST" && p === "/bison/bookings/amend") return done(amendBooking(body || {}));
  if (method === "POST" && p === "/bison/bookings/cancel") return done(cancelBooking(body || {}));
  if (method === "POST" && p === "/bison/checkin") return done(checkIn(body || {}));
  if (method === "POST" && p === "/bison/checkout") return done(checkOut(body || {}));
  if (method === "GET" && p === "/bison/inventory") return { status: 200, body: inventoryPayload(q) };
  if (method === "GET" && p === "/bison/folio") { const booking = findBooking(q.bookingId || q.id); if (!booking) return { status: 404, body: { error: "booking_not_found" } }; return { status: 200, body: folioOf(booking) }; }
  if (method === "POST" && p === "/bison/folio") return done(addFolio(body || {}));
  if (method === "GET" && p === "/bison/groups") return { status: 200, body: { ok: true, groups: state.groups } };
  if (method === "POST" && p === "/bison/groups") return done(addGroup(body || {}));
  if (method === "GET" && p === "/bison/audit") return { status: 200, body: auditPayload(q) };
  if (method === "POST" && p === "/bison/audit") return done(runAudit(body || {}));
  if (method === "POST" && (p === "/bison/ingest" || p === "/bison/stayflexi")) return done(ingestBook(body || {}));
  if (method === "GET" && p === "/bison/join") return { status: 200, body: { ok: true, months: state.joinMonths } };
  if (method === "POST" && p === "/bison/assign") return done(assignNest(body || {}));
  if (method === "POST" && p === "/bison/vacate") return done(vacateNest(body || {}));
  if (method === "POST" && p === "/bison/clock") return done(clearClock(body || {}));
  return { status: 404, body: { error: "not_found", product: "bison" } };
}
export async function handleBison(req, res, path, body, url) {
  return runWithPersistentState(req.method === "POST" || req.method === "PUT", () => handleOnce(req, path, body, url));
}
