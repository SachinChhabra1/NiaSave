/**
 * Operation Bison control plane on niasave.com.
 * Polo runs bags. Bison runs nests. Finance bills the nest.
 * Durable state key: operation-bison.
 */
import { hasDurableStore, loadRuntimeState, saveRuntimeState } from "../lib/runtime-store.mjs";

const DUMMY_DATA = process.env.DUMMY_DATA !== "0";
const RUNTIME_STATE_KEY = process.env.NIA_BISON_STATE_KEY || "operation-bison";
const OCC_TARGET = 78;
const AS_OF = "2026-06-30";
const SOURCE = "Bison occupancy book";

function now() { return new Date().toISOString(); }

function seedSites() {
  return [
    { id: "hsr", city: "Bengaluru", studio: "HSR", code: "WLG-HSR", theatre: "Wellington", cluster: "HSR", model: "FONO", occupied: 774, contracted: 900, vacant: 126, pending: 1364700, owner: "ACT-SHREY", clockDueAt: "2026-06-30T06:00:00.000Z", openActions: 83, weeklyPp: 8.5, lastCount: 526, status: "alarm", overdueCheckout: 58, pendingPerNest: 1763 },
    { id: "blr", city: "Bengaluru", studio: "BLR Central", code: "WLG-BLR", theatre: "Wellington", cluster: "BLR", model: "SP", occupied: 61, contracted: 65, vacant: 4, pending: 189100, owner: "ACT-SHREY", clockDueAt: "2026-07-01T08:00:00.000Z", openActions: 0, weeklyPp: 87.7, lastCount: 57, status: "alarm", overdueCheckout: 0, pendingPerNest: 3100 },
    { id: "chk", city: "Bengaluru", studio: "CHK", code: "DCN-CHK", theatre: "Deccan", cluster: "CHK", model: "FONO", occupied: 165, contracted: 187, vacant: 22, pending: 319800, owner: "ACT-SHREY", clockDueAt: "2026-06-30T06:00:00.000Z", openActions: 2, weeklyPp: 85.6, lastCount: 162, status: "watch", overdueCheckout: 1, pendingPerNest: 1938 },
    { id: "fn", city: "NCR", studio: "FN", code: "RJT-FN", theatre: "Rajputana", cluster: "FN", model: "FONO", occupied: 909, contracted: 1008, vacant: 99, pending: 1980000, owner: "ACT-SHREY", clockDueAt: "2026-06-22T06:00:00.000Z", openActions: 105, weeklyPp: 76.0, lastCount: 766, status: "alarm", overdueCheckout: 36, pendingPerNest: 2178 },
    { id: "mns", city: "NCR", studio: "MNS", code: "RJT-MNS", theatre: "Rajputana", cluster: "MNS", model: "FONO", occupied: 436, contracted: 464, vacant: 28, pending: 1031650, owner: "ACT-SHREY", clockDueAt: "2026-06-22T06:00:00.000Z", openActions: 128, weeklyPp: 82.8, lastCount: 383, status: "alarm", overdueCheckout: 126, pendingPerNest: 2366 },
    { id: "sri", city: "Chennai", studio: "SRI", code: "CRM-SRI", theatre: "Coromandel", cluster: "SRI", model: "FONO", occupied: 262, contracted: 507, vacant: 245, pending: 666060, owner: "ACT-SHREY", clockDueAt: "2026-06-13T12:00:00.000Z", openActions: 81, weeklyPp: 31.8, lastCount: 189, status: "alarm", overdueCheckout: 68, pendingPerNest: 2542 }
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
  return { dummy: DUMMY_DATA, persist: hasDurableStore() ? "postgres" : "memory", asOf: AS_OF, source: SOURCE, bookings: 3339, studioCodes: 56, sites: seedSites(), joinMonths: seedJoinMonths(), assignments: [], clocks: [], audit: [] };
}

let state = createState();
function snapshotState(value = state) { return JSON.parse(JSON.stringify(value)); }
function restoreState(value, storage = "memory") {
  const base = createState();
  const restored = { ...base, ...(value || {}) };
  restored.sites = Array.isArray(restored.sites) ? restored.sites : base.sites;
  restored.joinMonths = Array.isArray(restored.joinMonths) ? restored.joinMonths : base.joinMonths;
  restored.assignments = Array.isArray(restored.assignments) ? restored.assignments : [];
  restored.clocks = Array.isArray(restored.clocks) ? restored.clocks : [];
  restored.audit = Array.isArray(restored.audit) ? restored.audit : [];
  restored.source = SOURCE;
  restored.persist = storage;
  state = restored;
}
function pendingPerNest(site) {
  if (site.pendingPerNest != null) return site.pendingPerNest;
  const occ = site.occupied || 0;
  return occ ? Math.round(site.pending / occ) : 0;
}
function clockLabel(site, at = Date.now()) {
  const due = Date.parse(site.clockDueAt);
  if (!Number.isFinite(due)) return "No clock";
  const hours = Math.round((due - at) / 3600000);
  if (hours < 0) return "Overdue " + Math.abs(hours) + "h";
  return "Due " + hours + "h";
}
function refreshSiteStatus(site) {
  const clock = clockLabel(site);
  const heavy = pendingPerNest(site) > 2000;
  if (clock.startsWith("Overdue") && heavy) site.status = "alarm";
  else if (clock.startsWith("Overdue") || heavy) site.status = "watch";
  else site.status = "ok";
  return site;
}
function totals() {
  const occupied = state.sites.reduce((n, s) => n + s.occupied, 0);
  const contracted = state.sites.reduce((n, s) => n + s.contracted, 0);
  const vacant = state.sites.reduce((n, s) => n + s.vacant, 0);
  const pending = state.sites.reduce((n, s) => n + s.pending, 0);
  const occPct = contracted ? Math.round((occupied / contracted) * 1000) / 10 : 0;
  return { occupied, contracted, vacant, pending, occPct, occTarget: OCC_TARGET };
}
function sitesFor(city) {
  if (!city || city === "All") return state.sites;
  return state.sites.filter(s => s.city === city || s.theatre === city || s.cluster === city);
}
export function towerPayload(query = {}) {
  const city = query.city || "All";
  const t = totals();
  const sites = sitesFor(city).map(s => ({ ...s, clock: clockLabel(s), pendingPerNest: pendingPerNest(s) }));
  const overdue = sites.filter(s => String(s.clock).startsWith("Overdue"));
  return {
    product: "bison", sibling: "polo", skip: DUMMY_DATA, asOf: state.asOf, persist: state.persist, source: SOURCE,
    bookings: state.bookings, studioCodes: state.studioCodes, city,
    cities: ["All", ...Array.from(new Set(state.sites.map(s => s.city)))],
    theatres: ["All", ...Array.from(new Set(state.sites.map(s => s.theatre).filter(Boolean)))],
    clusters: ["All", ...Array.from(new Set(state.sites.map(s => s.cluster).filter(Boolean)))],
    kpis: { occupied: t.occupied, contracted: t.contracted, vacant: t.vacant, occPct: t.occPct, occTarget: t.occTarget, overdueClocks: overdue.length, pending: t.pending, joinMonths: state.joinMonths.length, sites: sites.length },
    sites,
    blockers: sites.filter(s => s.status === "alarm" || String(s.clock).startsWith("Overdue")).map(s => ({ level: s.status, area: "Bison", site: s.studio + " · " + s.code, city: s.city, text: clockLabel(s), owner: s.owner, when: clockLabel(s) })),
    actNow: sites.filter(s => s.status !== "ok").map(s => ({ id: s.id, site: s.studio, city: s.city, model: s.model, code: s.code, lastCount: s.lastCount, status: s.status, weekly: s.weeklyPp + " pp · ₹" + pendingPerNest(s) + "/nest · " + s.vacant + " vacant", action: pendingPerNest(s) > 2000 ? "Collections first. Clock still must close." : "Close the clock, then fill.", desk: "/bison", holdFill: pendingPerNest(s) > 2000 })),
    joinMonths: state.joinMonths,
    note: "Bison runs nests. Polo runs bags. Finance bills the nest."
  };
}
export function sitesPayload(query = {}) { return { ok: true, city: query.city || "All", sites: towerPayload(query).sites }; }
export function assignNest(body = {}) {
  const site = state.sites.find(s => s.id === body.siteId || s.code === body.code);
  if (!site) return { error: "site_not_found", status: 404 };
  const n = Math.max(1, Number(body.nests) || 1);
  if (site.vacant < n) return { error: "no_vacant", status: 409, vacant: site.vacant };
  const ppn = pendingPerNest(site);
  if (ppn > 2000 && body.force !== true) return { error: "hold_fill", status: 409, pendingPerNest: ppn, message: "Pending/nest is heavy. Collections first." };
  site.vacant -= n; site.occupied += n; refreshSiteStatus(site);
  return { ok: true, site: { ...site, clock: clockLabel(site) } };
}
export function vacateNest(body = {}) {
  const site = state.sites.find(s => s.id === body.siteId || s.code === body.code);
  if (!site) return { error: "site_not_found", status: 404 };
  const n = Math.max(1, Number(body.nests) || 1);
  if (site.occupied < n) return { error: "not_occupied", status: 409, occupied: site.occupied };
  site.occupied -= n; site.vacant += n; site.lastCount -= n; refreshSiteStatus(site);
  return { ok: true, site: { ...site, clock: clockLabel(site) } };
}
export function clearClock(body = {}) {
  const site = state.sites.find(s => s.id === body.siteId || s.code === body.code);
  if (!site) return { error: "site_not_found", status: 404 };
  site.clockDueAt = new Date(Date.now() + (Number(body.nextHours) || 18) * 3600000).toISOString();
  site.openActions = Math.max(0, site.openActions - 1); refreshSiteStatus(site);
  return { ok: true, site: { ...site, clock: clockLabel(site) } };
}
export function joinPayload() { return { ok: true, months: state.joinMonths }; }
export function bisonPath(pathname, rewrittenPath) {
  let p = rewrittenPath ? "/" + String(rewrittenPath).replace(/^\/+/, "") : pathname;
  p = (p || "/").replace(/\/+$/, "") || "/";
  if (p.startsWith("/api/")) p = p.slice(4);
  return p;
}
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
function done(result, fallback = 200) {
  if (result && result.error) return { status: result.status || 400, body: result };
  return { status: fallback, body: result };
}
async function handleOnce(req, path, body, url) {
  const q = {}; url.searchParams.forEach((v, k) => { if (k !== "path") q[k] = v; });
  const p = normalize(path); const method = req.method;
  if (method === "GET" && (p === "/bison" || p === "/bison/tower")) return { status: 200, body: towerPayload(q) };
  if (method === "GET" && p === "/bison/sites") return { status: 200, body: sitesPayload(q) };
  if (method === "GET" && p === "/bison/join") return { status: 200, body: joinPayload() };
  if (method === "POST" && p === "/bison/assign") return done(assignNest(body || {}));
  if (method === "POST" && p === "/bison/vacate") return done(vacateNest(body || {}));
  if (method === "POST" && p === "/bison/clock") return done(clearClock(body || {}));
  return { status: 404, body: { error: "not_found", product: "bison" } };
}
export async function handleBison(req, res, path, body, url) {
  const mutating = req.method === "POST" || req.method === "PUT";
  return runWithPersistentState(mutating, () => handleOnce(req, path, body, url));
}
