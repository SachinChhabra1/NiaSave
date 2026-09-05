/**
 * Bison Living control plane.
 * Theatre -> studio -> nest, member contracts, clocks and collections.
 */
import { randomUUID, createSign, createHash } from "node:crypto";
import { hasDurableStore, loadRuntimeState, saveRuntimeState } from "../lib/runtime-store.mjs";
import { STUDIO_COUNT, buildStudioMaster, sourceStudioId, studioIdForSource } from "./catalog.mjs";

const DUMMY_DATA = process.env.DUMMY_DATA !== "0";
const RUNTIME_STATE_KEY = process.env.NIA_BISON_STATE_KEY || "operation-bison";
const HOLD_FILL_RS = 2000;
const TAX_PCT = 12;
const NEST_RATE = 2200;
const SOURCE = "Bison Living book";
const OCC_TARGET = 78;
const SCHEMA_VERSION = 2;

function now() { return new Date().toISOString(); }
function today() { return now().slice(0, 10); }
function plusDays(iso, n) { const d = new Date(iso + "T00:00:00.000Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function daysBetween(a, b) { const x = Date.parse(a), y = Date.parse(b); if (!Number.isFinite(x) || !Number.isFinite(y)) return 0; return Math.max(0, Math.round((y - x) / 86400000)); }
function hoursFromNow(h) { return new Date(Date.now() + h * 3600000).toISOString(); }
function id(prefix) { return `${prefix}-${randomUUID().slice(0, 12)}`; }
function text(value, max = 120) { return String(value || "").trim().slice(0, max); }
function money(value) { const n = Number(value); return Number.isFinite(n) ? Math.round(n) : NaN; }
function fingerprint(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 20); }

function seedSites() {
  return [
    { id: "hsr", city: "Bengaluru", studio: "HSR", code: "WLG-HSR", theatre: "Wellington", cluster: "HSR", model: "FONO", occupied: 774, contracted: 900, vacant: 126, pending: 1364700, owner: "ACT-SHREY", clockDueAt: hoursFromNow(-6), openActions: 83, weeklyPp: 8.5, lastCount: 526, overdueCheckout: 58, rate: NEST_RATE },
    { id: "blr", city: "Bengaluru", studio: "BLR Central", code: "WLG-BLR", theatre: "Wellington", cluster: "BLR", model: "SP", occupied: 61, contracted: 65, vacant: 4, pending: 189100, owner: "ACT-SHREY", clockDueAt: hoursFromNow(18), openActions: 0, weeklyPp: 87.7, lastCount: 57, overdueCheckout: 0, rate: NEST_RATE },
    { id: "chk", city: "Bengaluru", studio: "CHK", code: "DCN-CHK", theatre: "Deccan", cluster: "CHK", model: "FONO", occupied: 165, contracted: 187, vacant: 22, pending: 319800, owner: "ACT-SHREY", clockDueAt: hoursFromNow(-6), openActions: 2, weeklyPp: 85.6, lastCount: 162, overdueCheckout: 1, rate: NEST_RATE },
    { id: "fn", city: "NCR", studio: "FN", code: "RJT-FN", theatre: "Rajputana", cluster: "FN", model: "FONO", occupied: 909, contracted: 1008, vacant: 99, pending: 1980000, owner: "ACT-SHREY", clockDueAt: hoursFromNow(-6), openActions: 105, weeklyPp: 76.0, lastCount: 766, overdueCheckout: 36, rate: NEST_RATE },
    { id: "mns", city: "NCR", studio: "MNS", code: "RJT-MNS", theatre: "Rajputana", cluster: "MNS", model: "FONO", occupied: 436, contracted: 464, vacant: 28, pending: 1031650, owner: "ACT-SHREY", clockDueAt: hoursFromNow(-6), openActions: 128, weeklyPp: 82.8, lastCount: 383, overdueCheckout: 126, rate: NEST_RATE },
    { id: "sri", city: "Chennai", studio: "SRI", code: "CRM-SRI", theatre: "Coromandel", cluster: "SRI", model: "FONO", occupied: 262, contracted: 507, vacant: 245, pending: 666060, owner: "ACT-SHREY", clockDueAt: hoursFromNow(-6), openActions: 81, weeklyPp: 31.8, lastCount: 189, overdueCheckout: 68, rate: NEST_RATE }
  ];
}
function seedGroups() { return [{ id: "grp-nia", name: "Nia members", kind: "member" }, { id: "grp-vendor", name: "Vendor walk-in", kind: "company" }]; }
function seedBookings() {
  const t = today();
  return [
    { id: "bkg-1001", siteId: "hsr", nestId: "R12N1", guest: "Ravi K", companyId: "grp-nia", arrive: t, depart: plusDays(t, 30), status: "in", rate: NEST_RATE, taxPct: TAX_PCT, folio: [{ id: "fol-1", kind: "rent", amount: NEST_RATE, note: "Month 1", at: now() }], createdAt: now() },
    { id: "bkg-1002", siteId: "chk", nestId: "R4N1", guest: "Imran S", companyId: "grp-nia", arrive: t, depart: plusDays(t, 14), status: "reserved", rate: NEST_RATE, taxPct: TAX_PCT, folio: [], createdAt: now() },
    { id: "bkg-1003", siteId: "sri", nestId: "RGN1", guest: "Karthik M", companyId: "grp-vendor", arrive: plusDays(t, -2), depart: plusDays(t, 28), status: "in", rate: NEST_RATE, taxPct: TAX_PCT, folio: [{ id: "fol-2", kind: "rent", amount: NEST_RATE, note: "Month 1", at: now() }], createdAt: now() }
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
function baseState() {
  return { schemaVersion: SCHEMA_VERSION, dummy: DUMMY_DATA, persist: hasDurableStore() ? "postgres" : "memory", asOf: today(), source: SOURCE, sites: seedSites(), studios: [], groups: seedGroups(), bookings: seedBookings(), members: [], contracts: [], receivables: [], collectionPayments: [], audits: [], ingest: [], joinMonths: seedJoinMonths(), assignments: [], clocks: [], auditLog: [], sheetProcessed: [], googleSheet: { url: "", spreadsheetId: "", enabled: false, lastSyncAt: null } };
}
function liveBaselineState(previous = {}) {
  const sites = seedSites().map(site => ({ ...site, occupied: 0, vacant: site.contracted, pending: 0, openActions: 0, lastCount: 0, overdueCheckout: 0 }));
  return { schemaVersion: SCHEMA_VERSION, dummy: false, persist: previous.persist || (hasDurableStore() ? "postgres" : "memory"), asOf: today(), source: SOURCE, sites, studios: [], groups: seedGroups(), bookings: [], members: [], contracts: [], receivables: [], collectionPayments: [], audits: [], ingest: [], joinMonths: [], assignments: [], clocks: [], auditLog: [], sheetProcessed: [], googleSheet: previous.googleSheet || { url: "", spreadsheetId: "", enabled: true, lastSyncAt: null } };
}

let state;
function findSite(value) { return state.sites.find(row => row.id === value || row.code === value); }
function findStudio(value) { return state.studios.find(row => row.id === value || row.code === value || row.sourceStudioId === String(value || "")); }
function findBooking(value) { return state.bookings.find(row => row.id === value); }
function findMember(value) { return state.members.find(row => row.id === value); }
function findContract(value) { return state.contracts.find(row => row.id === value); }
function findReceivable(value) { return state.receivables.find(row => row.id === value); }
function log(actor, action, ref, detail) {
  state.auditLog.unshift({ id: id("log"), at: now(), actor: text(actor || "desk", 80), action, ref: ref || null, detail: text(detail, 240) });
  state.auditLog = state.auditLog.slice(0, 1200);
}

function normalizeState(value, storage = "memory") {
  const base = baseState();
  const restored = { ...base, ...(value || {}) };
  restored.sites = Array.isArray(restored.sites) && restored.sites.length ? restored.sites : base.sites;
  restored.groups = Array.isArray(restored.groups) && restored.groups.length ? restored.groups : base.groups;
  restored.bookings = Array.isArray(restored.bookings) ? restored.bookings : base.bookings;
  for (const key of ["studios", "members", "contracts", "receivables", "collectionPayments", "audits", "ingest", "assignments", "clocks", "auditLog", "sheetProcessed"]) restored[key] = Array.isArray(restored[key]) ? restored[key] : [];
  restored.joinMonths = Array.isArray(restored.joinMonths) ? restored.joinMonths : base.joinMonths;
  restored.source = SOURCE;
  restored.persist = storage;
  restored.schemaVersion = SCHEMA_VERSION;

  restored.studios = restored.dummy === false ? restored.studios : buildStudioMaster(restored.sites, restored.bookings, today(), restored.studios);
  const studioBySource = new Map(restored.studios.map(row => [row.sourceStudioId, row]));
  const firstBySite = new Map(restored.studios.map(row => [row.siteId, row]));
  for (const booking of restored.bookings) {
    const fromSource = studioBySource.get(sourceStudioId(booking));
    const studio = fromSource || restored.studios.find(row => row.id === booking.studioId) || firstBySite.get(booking.siteId);
    if (studio) {
      booking.studioId = studio.id;
      booking.sourceStudioId = studio.sourceStudioId;
      booking.nestCode = `${studio.code}-${text(booking.nestId || "UNASSIGNED", 40).replace(/\s+/g, "-").toUpperCase()}`;
    }
  }

  const memberIds = new Set(restored.members.map(row => row.id));
  const contractIds = new Set(restored.contracts.map(row => row.id));
  for (const booking of restored.bookings) {
    if (!booking.memberId) booking.memberId = `mem-${text(booking.id, 70).toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
    if (!memberIds.has(booking.memberId)) {
      restored.members.push({ id: booking.memberId, name: text(booking.guest || "Member", 80), phone: "", governmentIdLast4: "", verificationStatus: "needs_review", source: "historic_house_book", createdAt: booking.createdAt || now() });
      memberIds.add(booking.memberId);
    }
    if (!booking.contractId) booking.contractId = `ctr-${text(booking.id, 70).toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
    if (!contractIds.has(booking.contractId)) {
      restored.contracts.push({ id: booking.contractId, memberId: booking.memberId, bookingId: booking.id, studioId: booking.studioId, nestId: booking.nestId, startDate: booking.arrive, endDate: booking.depart, monthlyRent: Number(booking.rate) || NEST_RATE, deposit: 0, billingDay: 1, signedStatus: "imported_needs_review", status: booking.status === "in" ? "active" : booking.status === "reserved" ? "pending" : booking.status === "cancelled" ? "cancelled" : "ended", noticeDate: null, amendments: [], source: "historic_house_book", createdAt: booking.createdAt || now() });
      contractIds.add(booking.contractId);
    }
  }
  for (const site of restored.sites) {
    if ((Number(site.pending) || 0) <= 0) continue;
    if (restored.receivables.some(row => row.source === "cluster_rollup" && row.siteId === site.id)) continue;
    restored.receivables.push({ id: `recv-legacy-${site.id}`, memberId: null, contractId: null, studioId: null, siteId: site.id, kind: "historic_balance", dueDate: restored.asOf || today(), amount: Number(site.pending) || 0, paidAmount: 0, status: "needs_allocation", owner: site.owner || "finance", promiseDate: null, note: "Imported cluster balance; allocate to member contracts before recovery action.", source: "cluster_rollup", createdAt: now() });
  }
  return restored;
}
function restoreState(value, storage = "memory") { state = normalizeState(value, storage); }
state = normalizeState(baseState(), hasDurableStore() ? "postgres" : "memory");
function snapshotState() { return JSON.parse(JSON.stringify(state)); }

function liveOnDate(date, filter = {}) {
  return state.bookings.filter(booking => {
    if (booking.status === "cancelled" || booking.status === "out") return false;
    if (filter.siteId && booking.siteId !== filter.siteId) return false;
    if (filter.studioId && booking.studioId !== filter.studioId) return false;
    return booking.arrive <= date && date < booking.depart;
  });
}
function studioInventory(studio, date = today()) {
  const openStays = liveOnDate(date, { studioId: studio.id });
  const byNest = new Map();
  for (const booking of openStays) {
    const nestKey = text(booking.nestId || booking.nestCode || booking.id, 80).toUpperCase();
    const current = byNest.get(nestKey);
    if (!current || (current.status !== "in" && booking.status === "in")) byNest.set(nestKey, booking);
  }
  const live = Array.from(byNest.values());
  const booked = live.length;
  const inHouse = live.filter(row => row.status === "in").length;
  const reserved = live.filter(row => row.status === "reserved").length;
  const overlaps = openStays.length - booked;
  return { booked, openStays: openStays.length, overlaps, inHouse, reserved, vacant: Math.max(0, studio.capacity - booked), occPct: studio.capacity ? Math.round((booked / studio.capacity) * 1000) / 10 : 0, live };
}
function outstanding(row) { return Math.max(0, (Number(row.amount) || 0) - (Number(row.paidAmount) || 0)); }
function pendingFor(filter = {}) { return state.receivables.filter(row => (!filter.siteId || row.siteId === filter.siteId) && (!filter.studioId || row.studioId === filter.studioId)).reduce((n, row) => n + outstanding(row), 0); }
function clockLabel(studio, at = Date.now()) {
  const due = Date.parse(studio.clockDueAt); if (!Number.isFinite(due)) return "No clock";
  const hours = Math.round((due - at) / 3600000); return hours < 0 ? `Overdue ${Math.abs(hours)}h` : `Due ${hours}h`;
}
function studioRow(studio, date = today()) {
  const inv = studioInventory(studio, date); const pending = pendingFor({ studioId: studio.id }); const clock = clockLabel(studio);
  const status = inv.overlaps ? "alarm" : clock.startsWith("Overdue") && pending > HOLD_FILL_RS ? "alarm" : clock.startsWith("Overdue") || pending > HOLD_FILL_RS ? "watch" : "ok";
  return { ...studio, ...inv, live: undefined, pending, pendingPerNest: inv.inHouse ? Math.round(pending / inv.inHouse) : pending, clock, status };
}
function siteRows(date = today(), studios = state.studios) {
  return state.sites.filter(site => studios.some(studio => studio.siteId === site.id)).map(site => {
    const rows = studios.filter(studio => studio.siteId === site.id).map(studio => studioRow(studio, date));
    const capacity = rows.reduce((n, row) => n + row.capacity, 0); const booked = rows.reduce((n, row) => n + row.booked, 0); const openStays = rows.reduce((n, row) => n + row.openStays, 0); const overlaps = rows.reduce((n, row) => n + row.overlaps, 0); const inHouse = rows.reduce((n, row) => n + row.inHouse, 0); const reserved = rows.reduce((n, row) => n + row.reserved, 0); const vacant = Math.max(0, capacity - booked); const pending = pendingFor({ siteId: site.id });
    const overdue = rows.filter(row => row.clock.startsWith("Overdue")).length;
    const status = overdue && pending > HOLD_FILL_RS ? "alarm" : overdue || pending > HOLD_FILL_RS ? "watch" : "ok";
    return { ...site, studios: rows.length, capacity, contracted: capacity, booked, openStays, overlaps, occupied: inHouse, inHouse, reserved, vacant, pending, pendingPerNest: inHouse ? Math.round(pending / inHouse) : pending, occPct: capacity ? Math.round((booked / capacity) * 1000) / 10 : 0, overdueClocks: overdue, clock: overdue ? `${overdue} overdue` : "Current", status };
  });
}
function selectStudios(query = {}) {
  const value = query.city || query.theatre || query.cluster || "All";
  if (!value || value === "All") return state.studios;
  return state.studios.filter(row => row.city === value || row.theatre === value || row.cluster === value || row.siteId === value || row.id === value || row.code === value);
}
function nestTaken(studioId, nestId, arrive, depart, exceptId) {
  if (!studioId || !nestId) return false;
  return state.bookings.some(row => row.id !== exceptId && row.status !== "cancelled" && row.status !== "out" && row.studioId === studioId && row.nestId === nestId && !(depart <= row.arrive || arrive >= row.depart));
}
function folioTotal(booking) { const rent = (booking.folio || []).reduce((n, row) => n + (Number(row.amount) || 0), 0); const tax = Math.round(rent * ((booking.taxPct || 0) / 100)); return { rent, tax, gross: rent + tax }; }
function folioOf(booking) { const total = folioTotal(booking); return { bookingId: booking.id, memberId: booking.memberId, contractId: booking.contractId, guest: booking.guest, nestId: booking.nestId, nestCode: booking.nestCode, rate: booking.rate, taxPct: booking.taxPct, lines: booking.folio || [], ...total }; }

export function hierarchyPayload(query = {}) {
  const studios = selectStudios(query).map(row => studioRow(row, query.date || today()));
  const sites = siteRows(query.date || today(), studios);
  const theatres = Array.from(new Set(studios.map(row => row.theatre))).sort().map(name => ({ name, studios: studios.filter(row => row.theatre === name).length, capacity: studios.filter(row => row.theatre === name).reduce((n, row) => n + row.capacity, 0) }));
  return { ok: true, date: query.date || today(), theatres, sites, studios, studioCount: studios.length };
}

export function createBooking(body = {}) {
  let studio = findStudio(body.studioId || body.studioCode);
  const site = findSite(body.siteId || body.code) || (studio && findSite(studio.siteId));
  if (!studio && site) studio = state.studios.map(row => studioRow(row, body.arrive || today())).find(row => row.siteId === site.id && row.vacant > 0);
  if (!site || !studio) return { error: studio ? "site_not_found" : "studio_not_found", status: 404 };
  const arrive = text(body.arrive || today(), 10); const depart = text(body.depart || plusDays(arrive, 30), 10);
  if (depart <= arrive) return { error: "bad_dates", status: 400 };
  const available = studio.capacity - studioInventory(studio, arrive).booked;
  if (available < 1 && !body.force) return { error: "no_vacant", status: 409, vacant: available };
  const nestId = text(body.nestId || body.nestLabel || `N${studio.capacity - Math.max(0, available) + 1}`, 40).toUpperCase();
  if (nestTaken(studio.id, nestId, arrive, depart)) return { error: "nest_taken", status: 409, nestId, studioId: studio.id };
  const rate = money(body.rate); const booking = { id: id("bkg"), siteId: site.id, studioId: studio.id, sourceStudioId: studio.sourceStudioId, nestId, nestCode: `${studio.code}-${nestId.replace(/\s+/g, "-")}`, guest: text(body.guest || (findMember(body.memberId) || {}).name || "Member", 80), memberId: body.memberId || null, contractId: body.contractId || null, companyId: body.companyId || "grp-nia", arrive, depart, status: body.status === "in" ? "in" : "reserved", rate: Number.isFinite(rate) && rate > 0 ? rate : (site.rate || NEST_RATE), taxPct: body.taxPct != null ? Number(body.taxPct) : TAX_PCT, folio: [], createdAt: now() };
  state.bookings.unshift(booking); log(body.actor, "booking_created", booking.id, booking.nestCode); return { ok: true, booking, folio: folioOf(booking) };
}
export function amendBooking(body = {}) {
  const booking = findBooking(body.bookingId || body.id); if (!booking) return { error: "booking_not_found", status: 404 };
  if (["cancelled", "out"].includes(booking.status)) return { error: "closed", status: 409, statusHave: booking.status };
  const studio = findStudio(body.studioId || booking.studioId); if (!studio) return { error: "studio_not_found", status: 404 };
  const arrive = text(body.arrive || booking.arrive, 10); const depart = text(body.depart || booking.depart, 10); const nestId = text(body.nestId || booking.nestId, 40).toUpperCase();
  if (depart <= arrive) return { error: "bad_dates", status: 400 };
  if (nestTaken(studio.id, nestId, arrive, depart, booking.id)) return { error: "nest_taken", status: 409, nestId, studioId: studio.id };
  Object.assign(booking, { studioId: studio.id, siteId: studio.siteId, sourceStudioId: studio.sourceStudioId, nestId, nestCode: `${studio.code}-${nestId.replace(/\s+/g, "-")}`, arrive, depart });
  if (body.guest) booking.guest = text(body.guest, 80); if (body.rate != null) booking.rate = money(body.rate); if (body.companyId) booking.companyId = body.companyId;
  log(body.actor, "booking_amended", booking.id, booking.nestCode); return { ok: true, booking };
}
export function cancelBooking(body = {}) {
  const booking = findBooking(body.bookingId || body.id); if (!booking) return { error: "booking_not_found", status: 404 };
  if (booking.status === "in") return { error: "in_house", status: 409, message: "Check out first." };
  booking.status = "cancelled"; booking.cancelledAt = now(); const contract = findContract(booking.contractId); if (contract) contract.status = "cancelled";
  log(body.actor, "booking_cancelled", booking.id, body.reason); return { ok: true, booking };
}
export function checkIn(body = {}) {
  const booking = findBooking(body.bookingId || body.id); if (!booking) return { error: "booking_not_found", status: 404 };
  if (booking.status !== "reserved") return { error: "not_reserved", status: 409, have: booking.status };
  if (!booking.studioId || !booking.nestId) return { error: "studio_and_nest_required", status: 400 };
  if (nestTaken(booking.studioId, booking.nestId, booking.arrive, booking.depart, booking.id)) return { error: "nest_taken", status: 409 };
  booking.status = "in"; booking.checkedInAt = now(); const contract = findContract(booking.contractId); if (contract) contract.status = "active";
  log(body.actor, "checked_in", booking.id, booking.nestCode); return { ok: true, booking };
}
export function checkOut(body = {}) {
  const booking = findBooking(body.bookingId || body.id); if (!booking) return { error: "booking_not_found", status: 404 };
  if (booking.status !== "in") return { error: "not_in_house", status: 409, have: booking.status };
  booking.status = "out"; booking.checkedOutAt = now(); const contract = findContract(booking.contractId); if (contract) { contract.status = "ended"; contract.endedAt = now(); }
  log(body.actor, "checked_out", booking.id, booking.nestCode); return { ok: true, booking, folio: folioOf(booking) };
}
export function addFolio(body = {}) {
  const booking = findBooking(body.bookingId || body.id); if (!booking) return { error: "booking_not_found", status: 404 };
  const amount = money(body.amount); if (!Number.isFinite(amount)) return { error: "bad_amount", status: 400 };
  const line = { id: id("fol"), kind: text(body.kind || "other", 40), amount, note: text(body.note, 160), at: now(), actor: text(body.actor || "desk", 80) };
  booking.folio = (booking.folio || []).concat([line]); log(body.actor, "folio_posted", booking.id, `${line.kind} ${amount}`); return { ok: true, folio: folioOf(booking) };
}
export function addGroup(body = {}) { const name = text(body.name, 100); if (!name) return { error: "name_required", status: 400 }; const row = { id: id("grp"), name, kind: text(body.kind || "company", 40), createdAt: now() }; state.groups.push(row); log(body.actor, "group_created", row.id, name); return { ok: true, group: row, groups: state.groups }; }

export function createMember(body = {}) {
  const name = text(body.name, 80); if (!name) return { error: "name_required", status: 400 };
  const phone = text(body.phone, 20).replace(/\D/g, ""); const existing = phone && state.members.find(row => row.phone === phone);
  if (existing && existing.name.toLowerCase() === name.toLowerCase()) { log(body.actor, "member_retry_matched", existing.id, phone); return { ok: true, member: existing, existing: true }; }
  if (existing) return { error: "phone_exists", status: 409 };
  const member = { id: id("mem"), name, phone, governmentIdLast4: text(body.governmentIdLast4, 4), verificationStatus: body.verificationStatus === "verified" ? "verified" : "needs_review", source: "bison_desk", createdAt: now(), createdBy: text(body.actor || "desk", 80) };
  state.members.unshift(member); log(body.actor, "member_created", member.id, name); return { ok: true, member };
}
export function membersPayload(query = {}) {
  let rows = state.members; const q = text(query.q, 80).toLowerCase(); if (q) rows = rows.filter(row => `${row.name} ${row.phone} ${row.id}`.toLowerCase().includes(q));
  return { ok: true, count: rows.length, needsReview: rows.filter(row => row.verificationStatus !== "verified").length, members: rows.slice(0, Math.min(200, Number(query.limit) || 100)) };
}
export function createContract(body = {}) {
  const member = findMember(body.memberId); if (!member) return { error: "member_not_found", status: 404 };
  const studio = findStudio(body.studioId || body.studioCode); if (!studio) return { error: "studio_not_found", status: 404 };
  const monthlyRent = money(body.monthlyRent); const deposit = money(body.deposit || 0); if (!Number.isFinite(monthlyRent) || monthlyRent <= 0 || !Number.isFinite(deposit) || deposit < 0) return { error: "bad_money", status: 400 };
  const startDate = text(body.startDate || today(), 10); const endDate = text(body.endDate || plusDays(startDate, 30), 10); if (endDate <= startDate) return { error: "bad_dates", status: 400 };
  const signedStatus = ["pending", "signed", "imported_needs_review"].includes(body.signedStatus) ? body.signedStatus : "pending";
  const contract = { id: id("ctr"), memberId: member.id, bookingId: null, studioId: studio.id, nestId: text(body.nestId || body.nestLabel, 40).toUpperCase(), startDate, endDate, monthlyRent, deposit, billingDay: Math.min(28, Math.max(1, Number(body.billingDay) || 1)), signedStatus, status: signedStatus === "signed" ? "active" : "pending", noticeDate: null, amendments: [], source: "bison_desk", createdAt: now(), createdBy: text(body.actor || "desk", 80) };
  if (!contract.nestId) return { error: "nest_required", status: 400 };
  const attached = body.attachExisting && state.bookings.find(row => row.studioId === studio.id && row.nestId === contract.nestId && text(row.guest, 80).toLowerCase() === member.name.toLowerCase());
  const booked = attached ? { ok: true, booking: attached } : createBooking({ studioId: studio.id, nestId: contract.nestId, arrive: startDate, depart: endDate, rate: monthlyRent, guest: member.name, memberId: member.id, contractId: contract.id, status: signedStatus === "signed" && body.checkIn ? "in" : "reserved", actor: body.actor });
  if (!booked.ok) return booked;
  contract.bookingId = booked.booking.id; state.contracts.unshift(contract); booked.booking.contractId = contract.id; booked.booking.memberId = member.id;
  if (body.firstCharge !== false) chargeCollection({ contractId: contract.id, amount: monthlyRent, dueDate: startDate, kind: "membership", note: "Opening membership charge", actor: body.actor });
  log(body.actor, "contract_created", contract.id, `${studio.code} ${contract.nestId}`); return { ok: true, contract, booking: booked.booking };
}
export function amendContract(body = {}) {
  const contract = findContract(body.contractId || body.id); if (!contract) return { error: "contract_not_found", status: 404 };
  if (["ended", "cancelled"].includes(contract.status)) return { error: "contract_closed", status: 409 };
  const reason = text(body.reason, 200); if (!reason) return { error: "reason_required", status: 400 };
  const before = { endDate: contract.endDate, monthlyRent: contract.monthlyRent, deposit: contract.deposit, billingDay: contract.billingDay, signedStatus: contract.signedStatus };
  if (body.endDate) contract.endDate = text(body.endDate, 10); if (body.monthlyRent != null) contract.monthlyRent = money(body.monthlyRent); if (body.deposit != null) contract.deposit = money(body.deposit); if (body.billingDay != null) contract.billingDay = Math.min(28, Math.max(1, Number(body.billingDay) || 1)); if (["pending", "signed"].includes(body.signedStatus)) contract.signedStatus = body.signedStatus;
  if (contract.endDate <= contract.startDate || contract.monthlyRent <= 0 || contract.deposit < 0) { Object.assign(contract, before); return { error: "bad_amendment", status: 400 }; }
  contract.status = contract.signedStatus === "signed" ? "active" : "pending"; contract.amendments.push({ id: id("amd"), at: now(), actor: text(body.actor || "desk", 80), reason, before, after: { endDate: contract.endDate, monthlyRent: contract.monthlyRent, deposit: contract.deposit, billingDay: contract.billingDay, signedStatus: contract.signedStatus } });
  const booking = findBooking(contract.bookingId); if (booking) { booking.depart = contract.endDate; booking.rate = contract.monthlyRent; }
  log(body.actor, "contract_amended", contract.id, reason); return { ok: true, contract };
}
export function endContract(body = {}) {
  const contract = findContract(body.contractId || body.id); if (!contract) return { error: "contract_not_found", status: 404 };
  const reason = text(body.reason, 200); if (!reason) return { error: "reason_required", status: 400 };
  const booking = findBooking(contract.bookingId); if (booking && booking.status === "in") checkOut({ bookingId: booking.id, actor: body.actor }); else if (booking && booking.status === "reserved") booking.status = "cancelled";
  contract.status = "ended"; contract.noticeDate = text(body.noticeDate || today(), 10); contract.endedAt = now(); contract.endReason = reason;
  log(body.actor, "contract_ended", contract.id, reason); return { ok: true, contract };
}
export function contractsPayload(query = {}) {
  let rows = state.contracts; if (query.status) rows = rows.filter(row => row.status === query.status); if (query.studioId) rows = rows.filter(row => row.studioId === query.studioId); if (query.memberId) rows = rows.filter(row => row.memberId === query.memberId);
  const contracts = rows.slice(0, Math.min(300, Number(query.limit) || 100)).map(row => ({ ...row, member: (findMember(row.memberId) || {}).name || "Unlinked", studio: (findStudio(row.studioId) || {}).code || "Unlinked" }));
  return { ok: true, count: rows.length, active: state.contracts.filter(row => row.status === "active").length, pending: state.contracts.filter(row => row.status === "pending").length, needsReview: state.contracts.filter(row => row.signedStatus === "imported_needs_review").length, contracts };
}

export function chargeCollection(body = {}) {
  const contract = findContract(body.contractId); if (!contract) return { error: "contract_not_found", status: 404 };
  const amount = money(body.amount); if (!Number.isFinite(amount) || amount <= 0) return { error: "bad_amount", status: 400 };
  const row = { id: id("recv"), memberId: contract.memberId, contractId: contract.id, studioId: contract.studioId, siteId: (findStudio(contract.studioId) || {}).siteId || null, kind: text(body.kind || "membership", 40), dueDate: text(body.dueDate || today(), 10), amount, paidAmount: 0, status: "open", owner: text(body.owner || body.actor || "finance", 80), promiseDate: null, note: text(body.note, 200), source: "bison_desk", createdAt: now() };
  state.receivables.unshift(row); log(body.actor, "charge_posted", row.id, `${row.kind} ${amount}`); return { ok: true, receivable: row };
}
export function recordCollectionPayment(body = {}) {
  const row = findReceivable(body.receivableId); if (!row) return { error: "receivable_not_found", status: 404 };
  if (!row.memberId || !row.contractId) return { error: "allocate_first", status: 409, message: "Allocate the historic balance to a member contract before posting payment." };
  const amount = money(body.amount); if (!Number.isFinite(amount) || amount <= 0 || amount > outstanding(row)) return { error: "bad_amount", status: 400, outstanding: outstanding(row) };
  const reference = text(body.reference, 100); if (!reference) return { error: "reference_required", status: 400 };
  const payment = { id: id("colpay"), receivableId: row.id, memberId: row.memberId, contractId: row.contractId, amount, method: text(body.method || "upi", 30), reference, at: now(), actor: text(body.actor || "finance", 80) };
  state.collectionPayments.unshift(payment); row.paidAmount = (Number(row.paidAmount) || 0) + amount; row.status = outstanding(row) === 0 ? "paid" : "partial";
  log(body.actor, "collection_payment", row.id, `${amount} ${reference}`); return { ok: true, payment, receivable: row };
}
export function workCollection(body = {}) {
  const row = findReceivable(body.receivableId); if (!row) return { error: "receivable_not_found", status: 404 };
  const note = text(body.note, 240); if (!note && body.owner == null && body.promiseDate == null && body.status == null && body.contractId == null) return { error: "work_detail_required", status: 400 };
  let worked = row;
  if (body.contractId) {
    const contract = findContract(body.contractId); if (!contract) return { error: "contract_not_found", status: 404 };
    const balance = outstanding(row); const allocation = body.allocationAmount == null || body.allocationAmount === "" ? balance : money(body.allocationAmount);
    if (!Number.isFinite(allocation) || allocation <= 0 || allocation > balance) return { error: "bad_allocation", status: 400, outstanding: balance };
    if (!row.memberId && allocation < balance) {
      row.amount -= allocation;
      worked = { ...row, id: id("recv"), memberId: contract.memberId, contractId: contract.id, studioId: contract.studioId, siteId: (findStudio(contract.studioId) || {}).siteId || row.siteId, amount: allocation, paidAmount: 0, status: "open", source: "allocated_cluster_rollup", createdAt: now() };
      state.receivables.unshift(worked);
    } else {
      worked.contractId = contract.id; worked.memberId = contract.memberId; worked.studioId = contract.studioId; worked.siteId = (findStudio(contract.studioId) || {}).siteId || worked.siteId; worked.status = outstanding(worked) ? "open" : "paid"; worked.source = "allocated_cluster_rollup";
    }
  }
  if (body.owner != null) worked.owner = text(body.owner, 80); if (body.promiseDate != null) worked.promiseDate = text(body.promiseDate, 10) || null; if (["open", "promised", "disputed", "waived"].includes(body.status)) worked.status = body.status; if (note) worked.note = [worked.note, `${now()} ${text(body.actor || "desk", 80)}: ${note}`].filter(Boolean).join("\n").slice(-1200);
  log(body.actor, "collection_worked", worked.id, note || worked.status); return { ok: true, receivable: worked, sourceReceivable: worked.id === row.id ? null : row };
}
export function collectionsPayload(query = {}) {
  let rows = state.receivables; if (query.siteId) rows = rows.filter(row => row.siteId === query.siteId); if (query.status) rows = rows.filter(row => row.status === query.status);
  const enriched = rows.map(row => { const due = daysBetween(row.dueDate, today()); const balance = outstanding(row); return { ...row, balance, ageDays: due, member: (findMember(row.memberId) || {}).name || "Unallocated", studio: (findStudio(row.studioId) || {}).code || "Cluster roll-up" }; });
  const total = enriched.reduce((n, row) => n + row.balance, 0); const unallocated = enriched.filter(row => !row.memberId).reduce((n, row) => n + row.balance, 0);
  const ageing = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, unallocated };
  enriched.filter(row => row.memberId).forEach(row => { const key = row.ageDays <= 0 ? "current" : row.ageDays <= 30 ? "d1_30" : row.ageDays <= 60 ? "d31_60" : row.ageDays <= 90 ? "d61_90" : "d90plus"; ageing[key] += row.balance; });
  return { ok: true, total, unallocated, allocated: total - unallocated, open: enriched.filter(row => row.balance > 0).length, ageing, receivables: enriched.sort((a, b) => b.balance - a.balance).slice(0, Math.min(300, Number(query.limit) || 100)), payments: state.collectionPayments.slice(0, 100) };
}

export function clearClock(body = {}) {
  const studio = findStudio(body.studioId || body.studioCode); if (!studio) return { error: "studio_required", status: 400 };
  const actor = text(body.actor, 80); const evidence = text(body.evidence, 240); const checks = body.checks || {};
  if (!actor) return { error: "actor_required", status: 400 };
  if (evidence.length < 3) return { error: "evidence_required", status: 400 };
  if (!checks.physicalCount || !checks.vacantVerified || !checks.collectionsReviewed) return { error: "checklist_incomplete", status: 400, required: ["physicalCount", "vacantVerified", "collectionsReviewed"] };
  const before = studio.clockDueAt; const closedAt = now(); const nextHours = Math.min(48, Math.max(6, Number(body.nextHours) || 18)); studio.clockDueAt = hoursFromNow(nextHours);
  const event = { id: id("clock"), studioId: studio.id, siteId: studio.siteId, closedAt, previousDueAt: before, nextDueAt: studio.clockDueAt, actor, evidence, checks: { physicalCount: true, vacantVerified: true, collectionsReviewed: true }, countedNests: body.countedNests == null ? null : Number(body.countedNests), vacantNests: body.vacantNests == null ? null : Number(body.vacantNests) };
  state.clocks.unshift(event); state.clocks = state.clocks.slice(0, 1200); log(actor, "clock_closed", studio.id, evidence); return { ok: true, event, studio: studioRow(studio) };
}
export function clocksPayload(query = {}) { const studios = selectStudios(query).map(row => studioRow(row)); return { ok: true, overdue: studios.filter(row => row.clock.startsWith("Overdue")).length, studios, events: state.clocks.filter(row => !query.studioId || row.studioId === query.studioId).slice(0, 200) }; }

function reconcile(date = today(), studios = state.studios) { const rows = studios.map(row => studioInventory(row, date)); const capacity = studios.reduce((n, row) => n + row.capacity, 0); const booked = rows.reduce((n, row) => n + row.booked, 0); const openStays = rows.reduce((n, row) => n + row.openStays, 0); const overlaps = rows.reduce((n, row) => n + row.overlaps, 0); const inHouse = rows.reduce((n, row) => n + row.inHouse, 0); const reserved = rows.reduce((n, row) => n + row.reserved, 0); const vacant = rows.reduce((n, row) => n + row.vacant, 0); return { date, capacity, booked, openStays, overlaps, inHouse, reserved, vacant, delta: capacity - booked - vacant, ok: capacity === booked + vacant && booked === inHouse + reserved, source: "unique named-nest date book" }; }
export function inventoryPayload(query = {}) {
  const date = query.date || today(); const studios = selectStudios({ ...query, city: query.site || query.city }); const studioRows = studios.map(row => { const inv = studioInventory(row, date); return { studioId: row.id, studio: row.name, code: row.code, siteId: row.siteId, theatre: row.theatre, date, capacity: row.capacity, contracted: row.capacity, ...inv, live: undefined, nests: inv.live.map(booking => ({ nestId: booking.nestId, nestCode: booking.nestCode, bookingId: booking.id, memberId: booking.memberId, contractId: booking.contractId, guest: booking.guest, status: booking.status })) }; });
  const rows = siteRows(date, studios).map(site => ({ ...site, date, nests: studioRows.filter(row => row.siteId === site.id).flatMap(row => row.nests) }));
  return { ok: true, date, rows, studios: studioRows, reconciliation: reconcile(date, studios) };
}
export function auditPayload(query = {}) { const date = query.date || today(); const existing = state.audits.find(row => row.date === date); return { ok: true, date, closed: Boolean(existing), closedAt: existing && existing.at, reconciliation: reconcile(date), last: state.audits[0] || null }; }
export function runAudit(body = {}) { const date = text(body.date || today(), 10); if (state.audits.some(row => row.date === date)) return { error: "already_closed", status: 409, date }; const reconciliation = reconcile(date); if (!reconciliation.ok) return { error: "inventory_not_reconciled", status: 409, reconciliation }; const row = { id: id("audit"), date, at: now(), actor: text(body.actor || "desk", 80), ...reconciliation }; state.audits.unshift(row); state.asOf = date; log(body.actor, "night_audit_closed", row.id, date); return { ok: true, audit: row };
}
export function ingestBook(body = {}) {
  const rows = Array.isArray(body.bookings) ? body.bookings : []; const sites = Array.isArray(body.sites) ? body.sites : []; let booked = 0; let updated = 0;
  for (const incoming of sites) { const site = findSite(incoming.id || incoming.code); if (!site) continue; for (const key of ["contracted", "pending", "rate", "owner", "clockDueAt"]) if (incoming[key] != null) site[key] = incoming[key]; updated += 1; }
  for (const incoming of rows) { const sourceId = sourceStudioId(incoming); const studio = findStudio(incoming.studioId || incoming.studioCode || studioIdForSource(sourceId)); const site = findSite(incoming.siteId || incoming.code) || (studio && findSite(studio.siteId)); if (!site || !studio) continue; const booking = { id: incoming.id || id("bkg"), siteId: site.id, studioId: studio.id, sourceStudioId: studio.sourceStudioId, nestId: text(incoming.nestId || "UNASSIGNED", 40).toUpperCase(), guest: text(incoming.guest || "Member", 80), memberId: incoming.memberId || null, contractId: incoming.contractId || null, companyId: incoming.companyId || "grp-nia", arrive: text(incoming.arrive || today(), 10), depart: text(incoming.depart || plusDays(today(), 30), 10), status: ["in", "out", "cancelled"].includes(incoming.status) ? incoming.status : "reserved", rate: money(incoming.rate) || site.rate || NEST_RATE, taxPct: incoming.taxPct != null ? Number(incoming.taxPct) : TAX_PCT, folio: Array.isArray(incoming.folio) ? incoming.folio : [], createdAt: now() }; booking.nestCode = `${studio.code}-${booking.nestId.replace(/\s+/g, "-")}`; state.bookings.unshift(booking); booked += 1; }
  if (body.asOf) state.asOf = text(body.asOf, 10); state = normalizeState(state, state.persist); state.ingest.unshift({ at: now(), actor: text(body.actor || "desk", 80), bookings: booked, sites: updated, filename: text(body.filename || "ingest", 160) }); log(body.actor, "book_ingested", null, `${booked} bookings`); return { ok: true, bookings: booked, sites: updated, asOf: state.asOf, studios: state.studios.length };
}
export function bookingsPayload(query = {}) { let rows = state.bookings; if (query.site) rows = rows.filter(row => row.siteId === query.site); if (query.studioId) rows = rows.filter(row => row.studioId === query.studioId); if (query.status) rows = rows.filter(row => row.status === query.status); return { ok: true, count: rows.length, bookings: rows.slice(0, Math.min(300, Number(query.limit) || 200)).map(row => ({ ...row, folioSummary: folioTotal(row) })) }; }
export function towerPayload(query = {}) {
  const date = query.date || today(); const studios = selectStudios(query).map(row => studioRow(row, date)); const sites = siteRows(date, studios); const reconciliation = reconcile(date, studios); const collections = collectionsPayload({ limit: 20 }); const contracts = contractsPayload({ limit: 20 }); const overdue = studios.filter(row => row.clock.startsWith("Overdue"));
  return { product: "bison", sibling: "polo", skip: DUMMY_DATA, schemaVersion: state.schemaVersion, asOf: date, persist: state.persist, source: SOURCE, city: query.city || "All", cities: ["All", ...Array.from(new Set(state.studios.map(row => row.city)))], theatres: ["All", ...Array.from(new Set(state.studios.map(row => row.theatre)))], clusters: ["All", ...Array.from(new Set(state.studios.map(row => row.cluster)))], reconciliation, kpis: { occupied: reconciliation.inHouse, inHouse: reconciliation.inHouse, reserved: reconciliation.reserved, committed: reconciliation.booked, capacity: reconciliation.capacity, contracted: reconciliation.capacity, vacant: reconciliation.vacant, occPct: reconciliation.capacity ? Math.round((reconciliation.booked / reconciliation.capacity) * 1000) / 10 : 0, occTarget: OCC_TARGET, overdueClocks: overdue.length, pending: collections.total, unallocated: collections.unallocated, members: state.members.length, activeContracts: contracts.active, contractsNeedReview: contracts.needsReview, studios: studios.length, sites: sites.length, bookingsOpen: reconciliation.openStays, overlapReviews: reconciliation.overlaps }, sites, studios, blockers: overdue.map(row => ({ level: row.status, area: "Bison", studioId: row.id, site: `${row.theatre} · ${row.code}`, city: row.city, text: row.clock, owner: row.owner, when: row.clock })), actNow: studios.filter(row => row.status !== "ok").map(row => ({ id: row.id, siteId: row.siteId, site: row.name, theatre: row.theatre, city: row.city, model: (findSite(row.siteId) || {}).model, code: row.code, status: row.status, weekly: `${row.booked}/${row.capacity} committed · ${row.openStays} open stays · ${row.overlaps} overlap review · ${row.vacant} vacant`, action: row.overlaps ? "Resolve overlapping open stays before assigning this nest." : row.pendingPerNest > HOLD_FILL_RS ? "Collections first. Clock still must close." : "Close the clock, then fill.", holdFill: row.pendingPerNest > HOLD_FILL_RS })), bookings: state.bookings.filter(row => row.status === "reserved" || row.status === "in").slice(0, 40), contracts: contracts.contracts, collections: collections.receivables, groups: state.groups, joinMonths: state.joinMonths, note: "Bison runs nests. Polo runs bags. Finance bills the nest." };
}
export function assignNest(body = {}) { if (!body.memberId) return { error: "member_required", status: 400, message: "Create or select the member before assigning a nest." }; return createContract({ ...body, monthlyRent: body.monthlyRent || body.rate || NEST_RATE, startDate: body.startDate || body.arrive, endDate: body.endDate || body.depart, signedStatus: body.signedStatus || "pending" }); }
export function vacateNest(body = {}) { const booking = body.bookingId ? findBooking(body.bookingId) : state.bookings.find(row => row.studioId === body.studioId && row.status === "in"); if (!booking) return { error: "booking_not_found", status: 404 }; return checkOut({ bookingId: booking.id, actor: body.actor }); }

function importCell(row, ...keys) { for (const key of keys) if (row[key] != null && String(row[key]).trim() !== "") return row[key]; return ""; }
function importMember(row, actor) {
  const memberId = text(importCell(row, "member_id", "memberId"), 80);
  const phone = text(importCell(row, "phone", "mobile"), 20).replace(/\D/g, "");
  let member = (memberId && findMember(memberId)) || (phone && state.members.find(item => item.phone === phone));
  if (member) {
    if (importCell(row, "member_name", "name")) member.name = text(importCell(row, "member_name", "name"), 80);
    if (phone) member.phone = phone;
    if (importCell(row, "verification_status")) member.verificationStatus = text(row.verification_status, 30);
    member.updatedAt = now(); member.updatedBy = actor; return { ok: true, member, updated: true };
  }
  return createMember({ name: importCell(row, "member_name", "name"), phone, governmentIdLast4: importCell(row, "government_id_last4"), verificationStatus: importCell(row, "verification_status"), actor });
}
export function importBisonData(body = {}) {
  const table = text(body.table, 30).toLowerCase(); const rows = Array.isArray(body.rows) ? body.rows : [];
  const actor = text(body.actor || "data desk", 80); const dryRun = body.commit !== true;
  const allowed = ["studios", "members", "contracts", "bookings", "collections", "payments", "clocks"];
  if (!allowed.includes(table)) return { error: "unsupported_table", status: 400, allowed };
  if (!rows.length || rows.length > 2000) return { error: "rows_required", status: 400, message: "Upload 1 to 2,000 rows at a time." };
  const before = snapshotState(); const results = []; const errors = [];
  rows.forEach((raw, index) => {
    const row = raw && typeof raw === "object" ? raw : {}; let result;
    try {
      if (table === "members") result = importMember(row, actor);
      else if (table === "studios") {
        let studio = findStudio(importCell(row, "studio_id", "studio_code", "studioId"));
        if (!studio) {
          const code = text(importCell(row, "studio_code"), 80);
          const theatre = text(importCell(row, "theatre"), 80);
          const site = state.sites.find(item => item.theatre.toLowerCase() === theatre.toLowerCase()) || state.sites.find(item => code.startsWith(item.code));
          if (!code || !site) result = { error: "studio_not_found", status: 404 };
          else {
            studio = { id: `std-live-${code.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, sourceStudioId: code, siteId: site.id, theatre: site.theatre, cluster: site.cluster, city: site.city, name: text(importCell(row, "studio_name"), 120) || code, code, capacity: 0, owner: site.owner, clockDueAt: site.clockDueAt, createdAt: now(), ordinal: state.studios.length + 1 };
            state.studios.push(studio);
          }
        }
        if (!result) { const capacity = Number(importCell(row, "capacity")); if (capacity && capacity < studioInventory(studio).booked) result = { error: "capacity_below_committed", status: 409 }; else { if (capacity) studio.capacity = capacity; if (importCell(row, "owner")) studio.owner = text(row.owner, 80); if (importCell(row, "clock_due_at")) studio.clockDueAt = text(row.clock_due_at, 30); result = { ok: true, studio }; } }
      } else if (table === "contracts") {
        const memberResult = importMember(row, actor); if (!memberResult.ok) result = memberResult; else result = createContract({ memberId: memberResult.member.id, studioId: importCell(row, "studio_id", "studio_code"), nestId: importCell(row, "nest_id", "nest_label"), startDate: importCell(row, "start_date"), endDate: importCell(row, "end_date"), monthlyRent: importCell(row, "monthly_rent", "rent"), deposit: importCell(row, "deposit") || 0, signedStatus: importCell(row, "document_status", "signed_status") || "pending", checkIn: String(importCell(row, "check_in")).toLowerCase() === "true", attachExisting: true, firstCharge: false, actor });
      } else if (table === "bookings") {
        const action = text(importCell(row, "action"), 20).toLowerCase(); const bookingId = importCell(row, "booking_id", "bookingId");
        if (action === "checkin") result = checkIn({ bookingId, actor }); else if (action === "checkout") result = checkOut({ bookingId, actor }); else if (action === "cancel") result = cancelBooking({ bookingId, reason: importCell(row, "reason"), actor }); else {
          const studio=findStudio(importCell(row,"studio_id","studio_code")), nestId=text(importCell(row,"nest_id"),40).toUpperCase(), guest=text(importCell(row,"member_name","guest"),80), arrive=text(importCell(row,"arrive","start_date")||today(),10);
          const existing=studio&&state.bookings.find(item=>item.studioId===studio.id&&item.nestId===nestId&&item.arrive===arrive&&text(item.guest,80).toLowerCase()===guest.toLowerCase());
          if (existing) {
            result=amendBooking({ bookingId:existing.id, studioId:studio.id, nestId, guest, arrive, depart:importCell(row,"depart","end_date")||existing.depart, rate:importCell(row,"rate","monthly_rent"), actor });
            if (result.ok) result.booking.status=String(importCell(row,"status")).toLowerCase()==="in"?"in":"reserved";
          } else result = createBooking({ studioId: importCell(row, "studio_id", "studio_code"), nestId, guest, arrive, depart: importCell(row, "depart", "end_date"), status: importCell(row, "status"), rate: importCell(row, "rate", "monthly_rent"), force:actor==="Google Sheet sync"&&importCell(row,"baseline_force")===true, actor });
        }
      } else if (table === "collections") {
        let contractId = importCell(row, "contract_id");
        if (!contractId) { const phone=text(importCell(row,"member_phone","phone"),20).replace(/\D/g,""); const member=state.members.find(item=>(phone&&item.phone===phone)||text(item.name,80).toLowerCase()===text(importCell(row,"member_name"),80).toLowerCase()); const studio=findStudio(importCell(row,"studio_code","studio_id")); const contract=state.contracts.find(item=>(!member||item.memberId===member.id)&&(!studio||item.studioId===studio.id)&&(!importCell(row,"nest_id")||item.nestId===text(row.nest_id,40).toUpperCase())); contractId=contract&&contract.id; }
        result = chargeCollection({ contractId, amount: importCell(row, "amount"), dueDate: importCell(row, "due_date"), kind: importCell(row, "kind") || "membership", owner: importCell(row, "owner"), note: importCell(row, "note"), actor });
        if (result.ok && Number(importCell(row,"collected_amount"))>0) result=recordCollectionPayment({ receivableId:result.receivable.id, amount:importCell(row,"collected_amount"), reference:importCell(row,"reference")||`SHEET-${index+2}`, method:"sheet", actor });
      }
      else if (table === "payments") result = recordCollectionPayment({ receivableId: importCell(row, "receivable_id"), amount: importCell(row, "amount"), reference: importCell(row, "reference"), method: importCell(row, "method") || "upi", actor });
      else if (table === "clocks") result = clearClock({ studioId: importCell(row, "studio_id", "studio_code"), countedNests: importCell(row, "counted_nests"), vacantNests: importCell(row, "vacant_nests"), evidence: importCell(row, "evidence"), checks: { physicalCount: String(importCell(row, "physical_count")).toLowerCase() === "true", vacantVerified: String(importCell(row, "vacant_verified")).toLowerCase() === "true", collectionsReviewed: String(importCell(row, "collections_reviewed")).toLowerCase() === "true" }, actor });
    } catch (error) { result = { error: "row_failed", message: error.message, status: 400 }; }
    if (!result || result.error) errors.push({ row: index + 2, error: result && result.error || "row_failed", message: result && result.message || "Invalid row" }); else results.push({ row: index + 2, id: (result.member || result.contract || result.booking || result.receivable || result.payment || result.event || result.studio || {}).id || null });
  });
  if (dryRun || errors.length) restoreState(before, before.persist);
  if (errors.length) return { error: "validation_failed", status: 400, table, valid: results.length, errors };
  if (!dryRun) { state = normalizeState(state, state.persist); state.ingest.unshift({ at: now(), actor, table, rows: results.length, filename: text(body.filename || "browser entry", 160) }); log(actor, "data_imported", null, `${table}: ${results.length} rows`); }
  return { ok: true, table, dryRun, valid: results.length, results };
}
export function sheetConfig(body) {
  if (!body) return { ok: true, config: state.googleSheet || { url: "", spreadsheetId: "", enabled: false, lastSyncAt: null } };
  const url = text(body.url, 500); const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (url && !match) return { error: "invalid_google_sheet_url", status: 400 };
  state.googleSheet = { url, spreadsheetId: match ? match[1] : "", enabled: Boolean(body.enabled), lastSyncAt: state.googleSheet && state.googleSheet.lastSyncAt || null, updatedAt: now(), updatedBy: text(body.actor || "data desk", 80) };
  log(body.actor, "google_sheet_configured", null, state.googleSheet.spreadsheetId || "cleared");
  return { ok: true, config: state.googleSheet, message: state.googleSheet.enabled ? "Link saved. Automatic pull requires Google service credentials." : "Link saved for future sync." };
}

function base64url(value) { return Buffer.from(value).toString("base64url"); }
async function googleAccessToken() {
  const raw = process.env.BISON_GOOGLE_SERVICE_ACCOUNT_JSON; if (!raw) throw new Error("google_service_account_missing");
  const account = JSON.parse(raw); const at = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify({ iss: account.client_email, scope: "https://www.googleapis.com/auth/spreadsheets.readonly", aud: "https://oauth2.googleapis.com/token", iat: at, exp: at + 3600 }))}`;
  const signer = createSign("RSA-SHA256"); signer.update(unsigned); signer.end(); const assertion = `${unsigned}.${signer.sign(account.private_key, "base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const payload = await response.json(); if (!response.ok || !payload.access_token) throw new Error(payload.error_description || "google_token_failed"); return payload.access_token;
}
function sheetRows(values = []) { const headers = (values[0] || []).map(value => text(value, 80).toLowerCase().replace(/\*/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")); return values.slice(1).map((row, index) => ({ row: index + 2, data: Object.fromEntries(headers.map((header, column) => [header, row[column] == null ? "" : row[column]])) })).filter(item => Object.values(item.data).some(value => String(value).trim())); }
function sheetDate(value) {
  const valid = candidate => { const match=String(candidate||"").match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!match) return ""; const date=new Date(`${candidate}T00:00:00.000Z`); return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===candidate?candidate:""; };
  if (typeof value === "number" && Number.isFinite(value)) {
    const digits=String(Math.trunc(value));
    if (/^\d{8}$/.test(digits)) return valid(`${digits.slice(0,4)}-${digits.slice(4,6)}-${digits.slice(6,8)}`);
    const serialDate=new Date(Date.UTC(1899,11,30) + Math.round(value) * 86400000);
    return Number.isNaN(serialDate.getTime())?"":serialDate.toISOString().slice(0,10);
  }
  const raw=String(value||"").trim(); if (!raw) return "";
  if (/^\d{8}$/.test(raw)) return valid(`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`);
  const iso=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (iso) return valid(`${iso[1]}-${iso[2].padStart(2,"0")}-${iso[3].padStart(2,"0")}`);
  const local=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); if (local) return valid(`${local[3]}-${local[2].padStart(2,"0")}-${local[1].padStart(2,"0")}`);
  const parsed=new Date(raw); return Number.isNaN(parsed.getTime())?"":parsed.toISOString().slice(0,10);
}
export async function syncGoogleSheet(body = {}) {
  const spreadsheetId = process.env.BISON_GOOGLE_SHEET_ID || (state.googleSheet || {}).spreadsheetId; if (!spreadsheetId) return { error: "google_sheet_missing", status: 400 };
  try {
    const token = await googleAccessToken(); const tabs = ["01_STUDIO_MASTER", "02_OCCUPANCY_INPUT", "03_CONTRACT_INPUT", "04_COLLECTION_INPUT", "05_CLOCK_CLOSE_INPUT"];
    const params = new URLSearchParams(); tabs.forEach(tab => params.append("ranges", `'${tab}'!A1:T6000`)); params.set("majorDimension", "ROWS"); params.set("valueRenderOption", "UNFORMATTED_VALUE"); params.set("dateTimeRenderOption", "FORMATTED_STRING");
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${params}`, { headers: { Authorization: `Bearer ${token}` } }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error && payload.error.message || "google_sheet_read_failed");
    const before = snapshotState(); const replacing = body.replace === true;
    if (replacing && body.confirm !== "REPLACE_SEEDED_BISON") return { error:"confirmation_required", message:"Set confirm to REPLACE_SEEDED_BISON.", status:400 };
    if (replacing && hasDurableStore()) {
      const backupKey=`${RUNTIME_STATE_KEY}-pre-live-backup`, currentBackup=await loadRuntimeState(backupKey, before), savedBackup=await saveRuntimeState(backupKey, before, currentBackup.version);
      if (!savedBackup.ok) return { error:"backup_failed", status:409 };
    }
    if (replacing) restoreState(liveBaselineState(before), before.persist);
    const summary = {}; const processed = new Set(state.sheetProcessed || []);
    const capacityByStudio=new Map(sheetRows((payload.valueRanges[0]||{}).values).map(item=>[String(item.data.studio_code||"").trim().toUpperCase(),Number(String(item.data.contracted_capacity||"").replace(/[^0-9.-]/g,""))]));
    const configs = [
      { tab: tabs[0], table: "studios", accept:r=>r.studio_code, map: r => ({ theatre:r.theatre, studio_code:r.studio_code, studio_name:r.studio_name, capacity:r.contracted_capacity, owner:r.jco_owner, clock_due_at:r.clock_due_time }) },
      { tab: tabs[1], table: "bookings", accept:r=>r.studio_code&&r.room_nest_id&&r.member_name&&sheetDate(r.check_in_date)&&String(r.import_status||"").toUpperCase()==="READY", map: r => { const status=String(r.booking_status||"").trim().toLowerCase().replace(/[\s-]+/g,"_"), arrive=sheetDate(r.check_in_date), planned=sheetDate(r.planned_checkout), checkoutBase=arrive>today()?arrive:today(), occupantKey={ source:r.source_record_id, member:r.member_key, name:r.member_name, phone:r.phone, room:r.room_nest_id, arrive }, nestId=text(`${String(r.room_nest_id).slice(0,18)}-${fingerprint(occupantKey).slice(0,16)}`,40); return ({ action:"create", baseline_force:replacing, studio_code:r.studio_code, nest_id:nestId, member_name:r.member_name, arrive, depart:planned||plusDays(checkoutBase,30), status:["in","in_house","checked_in","occupied"].includes(status)?"in":"reserved", rate:r.monthly_rent }); } },
      { tab: tabs[2], table: "contracts", accept:r=>r.member_name&&r.studio_code&&r.nest_id&&sheetDate(r.start_date)&&!/^(e2e|test)\b/i.test(String(r.member_name).trim()), map: r => ({ member_name:r.member_name, phone:r.phone, studio_code:r.studio_code, nest_id:r.nest_id, start_date:sheetDate(r.start_date), end_date:sheetDate(r.end_date), monthly_rent:r.monthly_rent, deposit:r.deposit, document_status:String(r.signed_status||r.document_status).toLowerCase().includes("signed")?"signed":"pending", check_in:false }) },
      { tab: tabs[3], table: "collections", accept:r=>r.member_phone&&r.studio_code&&r.nest_id&&sheetDate(r.due_date), map: r => ({ member_phone:r.member_phone, studio_code:r.studio_code, nest_id:r.nest_id, amount:r.determined_rent, collected_amount:r.collected_amount, due_date:sheetDate(r.due_date), kind:"membership", owner:r.collection_owner, reference:r.utr_reference }) },
      { tab: tabs[4], table: "clocks", accept:r=>r.studio_code, map: r => ({ studio_code:r.studio_code, counted_nests:r.nests_counted, vacant_nests:r.vacant_verified, evidence:r.evidence_reference, physical_count:r.physical_count_complete, vacant_verified:r.vacant_list_verified, collections_reviewed:r.collections_reviewed }) }
    ];
    for (let i=0;i<configs.length;i++) {
      const config=configs[i], rows=sheetRows((payload.valueRanges[i]||{}).values), pending=[];
      let accepted=rows.filter(item=>config.accept(item.data));
      if (config.dedupeByNest) {
        const byNest=new Map();
        for (const item of accepted) {
          const key=`${String(item.data.studio_code).trim().toUpperCase()}|${String(item.data.room_nest_id).trim().toUpperCase()}`, prior=byNest.get(key);
          if (!prior || sheetDate(item.data.check_in_date)>sheetDate(prior.data.check_in_date)) byNest.set(key,item);
        }
        summary[`${config.tab}_DUPLICATES_SKIPPED`]=accepted.length-byNest.size; accepted=Array.from(byNest.values());
        const counts=new Map(); for (const item of accepted) { const code=String(item.data.studio_code).trim().toUpperCase(); counts.set(code,(counts.get(code)||0)+1); }
        const overflow=Array.from(counts).filter(([code,count])=>Number.isFinite(capacityByStudio.get(code))&&count>capacityByStudio.get(code)).map(([code,count])=>({ studio_code:code, occupied:count, capacity:capacityByStudio.get(code) }));
        if (overflow.length) { restoreState(before,before.persist); return { error:"sheet_capacity_overflow", status:400, sheet:config.tab, overflow }; }
      }
      if (config.table==="bookings") {
        const byOccupant=new Map(); for (const item of accepted) { const row=item.data, key=fingerprint({ source:row.source_record_id, member:row.member_key, name:row.member_name, phone:row.phone, room:row.room_nest_id, arrive:sheetDate(row.check_in_date) }); if (!byOccupant.has(key)) byOccupant.set(key,item); }
        summary[`${config.tab}_EXACT_DUPLICATES_SKIPPED`]=accepted.length-byOccupant.size; accepted=Array.from(byOccupant.values());
        const counts=new Map(); for (const item of accepted) { const code=String(item.data.studio_code).trim().toUpperCase(); counts.set(code,(counts.get(code)||0)+1); }
        const overflow=Array.from(counts).filter(([code,count])=>Number.isFinite(capacityByStudio.get(code))&&count>capacityByStudio.get(code)).map(([code,count])=>({ studio_code:code, occupied:count, capacity:capacityByStudio.get(code) }));
        summary[`${config.tab}_CAPACITY_EXCEPTIONS`]=overflow;
      }
      for (const item of accepted) {
        const mapped=config.map(item.data), legacyKey=`${config.tab}:${item.row}`, key=`${legacyKey}:${fingerprint(mapped)}`;
        if (processed.has(key)) continue;
        // Upgrade old row-only markers without replaying already imported data.
        if (processed.has(legacyKey)) { processed.delete(legacyKey); processed.add(key); continue; }
        pending.push({ key, row:mapped });
      }
      if (!pending.length) { summary[config.tab]=0; continue; }
      for (let start=0;start<pending.length;start+=2000) {
        const batch=pending.slice(start,start+2000), result=importBisonData({ table:config.table, rows:batch.map(item=>item.row), commit:true, filename:`Google Sheet ${config.tab}`, actor:"Google Sheet sync" });
        if (!result.ok) { restoreState(before,before.persist); return { ...result, status:400, sheet:config.tab }; }
      }
      pending.forEach(item=>processed.add(item.key)); summary[config.tab]=pending.length;
    }
    state.sheetProcessed=Array.from(processed).slice(-20000); state.dummy=false; state.googleSheet={ ...(state.googleSheet||{}), url:`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`, spreadsheetId, enabled:true, lastSyncAt:now(), lastSyncStatus:"ok", lastSyncSummary:summary }; log("Google Sheet sync",replacing?"baseline_replaced":"sheet_synced",spreadsheetId,JSON.stringify(summary)); return { ok:true, replaced:replacing, spreadsheetId, syncedAt:state.googleSheet.lastSyncAt, summary };
  } catch (error) { state.googleSheet={ ...(state.googleSheet||{}), lastSyncAt:now(), lastSyncStatus:"error", lastSyncError:text(error.message,240) }; return { error:"google_sheet_sync_failed", message:error.message, status:502 }; }
}

export function bisonPath(pathname, rewrittenPath) { let path = rewrittenPath ? "/" + String(rewrittenPath).replace(/^\/+/, "") : pathname; path = (path || "/").replace(/\/+$/, "") || "/"; if (path.startsWith("/api/")) path = path.slice(4); return path; }
export function isBisonPath(path) { return path === "/bison" || path.startsWith("/bison/") || path === "/living" || path.startsWith("/living/"); }
function normalize(path) { return path.replace(/^\/living/, "/bison"); }
async function runWithPersistentState(mutating, work) {
  if (!hasDurableStore()) return work();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let loaded;
    try {
      loaded = await loadRuntimeState(RUNTIME_STATE_KEY, snapshotState());
      restoreState(loaded.value, loaded.storage);
    } catch (error) {
      console.error("bison_state_load_failed", error);
      return work();
    }
    const result = await work();
    if (!mutating || !result || result.status >= 400) return result;
    try {
      const saved = await saveRuntimeState(RUNTIME_STATE_KEY, snapshotState(), loaded.version);
      if (saved.ok) return result;
    } catch (error) {
      console.error("bison_state_save_failed", error);
      return result;
    }
  }
  return { status: 409, body: { error: "state_conflict", message: "Please try again." } };
}
export async function bisonStorageStatus() {
  if (!hasDurableStore()) return { storage: "memory", connected: false, version: 0, product: "bison", schemaVersion: SCHEMA_VERSION };
  try {
    const loaded = await loadRuntimeState(RUNTIME_STATE_KEY, snapshotState());
    return { storage: loaded.storage, connected: loaded.storage === "postgres", version: loaded.version, product: "bison", schemaVersion: SCHEMA_VERSION };
  } catch (error) {
    console.error("bison_storage_status_failed", error);
    return { storage: "memory", connected: false, version: 0, product: "bison", schemaVersion: SCHEMA_VERSION };
  }
}
export function resetBison() { state = normalizeState(baseState(), hasDurableStore() ? "postgres" : "memory"); return state; }
function done(result, fallback = 200) { if (result && result.error) return { status: result.status || 400, body: result }; return { status: fallback, body: result }; }
async function handleOnce(req, path, body, url) {
  const query = {}; url.searchParams.forEach((value, key) => { if (key !== "path") query[key] = value; }); const route = normalize(path); const method = req.method;
  if (method === "GET" && route === "/bison/release") return { status: 200, body: { release: "bison-baseline-20260904-1" } };
  if (method === "GET" && (route === "/bison" || route === "/bison/tower")) return { status: 200, body: towerPayload(query) };
  if (method === "GET" && route === "/bison/hierarchy") return { status: 200, body: hierarchyPayload(query) };
  if (method === "GET" && route === "/bison/sites") return { status: 200, body: { ok: true, sites: towerPayload(query).sites } };
  if (method === "GET" && route === "/bison/bookings") return { status: 200, body: bookingsPayload(query) };
  if (method === "POST" && route === "/bison/bookings") return done(createBooking(body || {}), 201);
  if (method === "POST" && route === "/bison/bookings/amend") return done(amendBooking(body || {}));
  if (method === "POST" && route === "/bison/bookings/cancel") return done(cancelBooking(body || {}));
  if (method === "POST" && route === "/bison/checkin") return done(checkIn(body || {}));
  if (method === "POST" && route === "/bison/checkout") return done(checkOut(body || {}));
  if (method === "GET" && route === "/bison/inventory") return { status: 200, body: inventoryPayload(query) };
  if (method === "GET" && route === "/bison/folio") { const booking = findBooking(query.bookingId || query.id); return booking ? { status: 200, body: folioOf(booking) } : { status: 404, body: { error: "booking_not_found" } }; }
  if (method === "POST" && route === "/bison/folio") return done(addFolio(body || {}));
  if (method === "GET" && route === "/bison/groups") return { status: 200, body: { ok: true, groups: state.groups } };
  if (method === "POST" && route === "/bison/groups") return done(addGroup(body || {}), 201);
  if (method === "GET" && route === "/bison/members") return { status: 200, body: membersPayload(query) };
  if (method === "POST" && route === "/bison/members") return done(createMember(body || {}), 201);
  if (method === "GET" && route === "/bison/contracts") return { status: 200, body: contractsPayload(query) };
  if (method === "POST" && route === "/bison/contracts") return done(createContract(body || {}), 201);
  if (method === "POST" && route === "/bison/contracts/amend") return done(amendContract(body || {}));
  if (method === "POST" && route === "/bison/contracts/end") return done(endContract(body || {}));
  if (method === "GET" && route === "/bison/collections") return { status: 200, body: collectionsPayload(query) };
  if (method === "POST" && route === "/bison/collections/charges") return done(chargeCollection(body || {}), 201);
  if (method === "POST" && route === "/bison/collections/payments") return done(recordCollectionPayment(body || {}), 201);
  if (method === "POST" && route === "/bison/collections/work") return done(workCollection(body || {}));
  if (method === "GET" && route === "/bison/clocks") return { status: 200, body: clocksPayload(query) };
  if (method === "POST" && route === "/bison/clock") return done(clearClock(body || {}));
  if (method === "POST" && route === "/bison/data/import") return done(importBisonData(body || {}));
  if (method === "GET" && route === "/bison/data/config") return { status: 200, body: sheetConfig() };
  if (method === "POST" && route === "/bison/data/config") return done(sheetConfig(body || {}));
  if ((method === "GET" || method === "POST") && route === "/bison/data/sync") { const secret=process.env.CRON_SECRET; if (method === "GET" && secret && req.headers.authorization !== `Bearer ${secret}`) return { status:401, body:{ error:"unauthorized" } }; return done(await syncGoogleSheet(body || {})); }
  if (method === "GET" && route === "/bison/audit") return { status: 200, body: auditPayload(query) };
  if (method === "POST" && route === "/bison/audit") return done(runAudit(body || {}));
  if (method === "GET" && route === "/bison/audit-log") return { status: 200, body: { ok: true, events: state.auditLog.slice(0, 300) } };
  if (method === "POST" && route === "/bison/ingest") return done(ingestBook(body || {}));
  if (method === "POST" && route === "/bison/migrate") { log(body.actor, "schema_migrated", null, `schema ${SCHEMA_VERSION}; ${state.studios.length} studios`); return { status: 200, body: { ok: true, schemaVersion: SCHEMA_VERSION, studios: state.studios.length, reconciliation: reconcile() } }; }
  if (method === "GET" && route === "/bison/join") return { status: 200, body: { ok: true, months: state.joinMonths } };
  if (method === "POST" && route === "/bison/assign") return done(assignNest(body || {}), 201);
  if (method === "POST" && route === "/bison/vacate") return done(vacateNest(body || {}));
  return { status: 404, body: { error: "not_found", product: "bison" } };
}
export async function handleBison(req, res, path, body, url) { return runWithPersistentState(req.method === "POST" || req.method === "PUT", () => handleOnce(req, path, body, url)); }

export { SCHEMA_VERSION, STUDIO_COUNT };
