import {createHash, createHmac, timingSafeEqual, randomUUID} from 'node:crypto';
import {hasDurableStore, loadRuntimeState, saveRuntimeState} from './runtime-store.mjs';
export const STAFF_TOKEN_TTL_SECONDS = 12 * 60 * 60;
const STAFF_SESSION_STATE_KEY = 'staff-auth-sessions-v1';
const STAFF_SESSION_RETRIES = 5;
const STAFF_SESSION_MAX_TOKENS = 20000;
const STAFF_TOKEN_SECRET = process.env.STAFF_TOKEN_SECRET || "";
const staffSeed = [
  { id: "stf-ajay-mahawar", email: "ajay.mahawar@nia.one", name: "Ajay Mahawar", role: "living", desks: ["living"] },
  { id: "stf-admin", email: "admin@nia.one", name: "Admin", role: "admin", desks: ["studio", "hub", "money", "pilot"] },
  { id: "stf-satish", email: "satish@nia.one", name: "Satish", role: "studio+hub", desks: ["studio", "hub"] },
  { id: "stf-ramesh", email: "ramesh@nia.one", name: "Ramesh", role: "hub", desks: ["hub"] },
  { id: "stf-kavita", email: "kavita@nia.one", name: "Kavita", role: "money", desks: ["money"] },
  { id: "stf-pilot", email: "pilot@nia.one", name: "Pilot", role: "pilot", desks: ["pilot"] },
  { id: "stf-test", email: "test.desk@nia.one", name: "TEST desk", role: "admin", desks: ["studio", "hub", "money", "pilot"], test: true }
];
export const TEST_STAFF_EMAIL = "test.desk@nia.one";
export const STAFF_PERSONAL_PASSWORD_MIN = 10;
const STAFF_PASSWORD_STATE_KEY = 'staff-auth-passwords-v1';
if (process.env.STAFF_QA_EMAIL) staffSeed.push({ id: "stf-qa", email: String(process.env.STAFF_QA_EMAIL).toLowerCase(), name: "QA", role: "admin", desks: ["studio", "hub", "money", "pilot"] });

function signTokenPart(part) { return createHmac("sha256", STAFF_TOKEN_SECRET).update(part).digest("base64url"); }
const clone = value => (typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

let memorySessions = { tokens: {} };
let memoryVersion = 0;
let memoryPasswords = { byStaffId: {} };
let memoryPasswordVersion = 0;

function staffFromClaims(claims) {
  return staffSeed.find(row => row.id === claims.sub && row.email === claims.email) || null;
}
function verifiedClaims(raw, at = Date.now()) {
  if (STAFF_TOKEN_SECRET.length < 32) return null;
  const [payload, signature, extra] = String(raw || "").split(".");
  if (!payload || !signature || extra) return null;
  const expected = signTokenPart(payload);
  const have = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (have.length !== want.length || !timingSafeEqual(have, want)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!claims.exp || claims.exp <= Math.floor(at / 1000)) return null;
    const staff = staffFromClaims(claims);
    return staff ? { claims, staff } : null;
  } catch {
    return null;
  }
}
const sessionHash = raw => createHash("sha256").update(String(raw || "")).digest("hex");
function normaliseSessions(value) {
  const source = value && typeof value === "object" && value.tokens && typeof value.tokens === "object" ? value.tokens : {};
  const tokens = {};
  for (const [key, entry] of Object.entries(source)) {
    if (!/^[a-f0-9]{64}$/.test(key) || !entry || typeof entry !== "object") continue;
    const staffId = typeof entry.staffId === "string" ? entry.staffId : "";
    const expiresAt = Number(entry.expiresAt);
    if (!staffId || !Number.isFinite(expiresAt)) continue;
    tokens[key] = { staffId, expiresAt };
  }
  return { tokens };
}
function pruneSessions(sessionState, at = Date.now()) {
  for (const [key, session] of Object.entries(sessionState.tokens)) {
    if (!Number.isFinite(session.expiresAt) || session.expiresAt <= at) delete sessionState.tokens[key];
  }
  const keys = Object.keys(sessionState.tokens);
  if (keys.length <= STAFF_SESSION_MAX_TOKENS) return;
  keys.sort((a, b) => Number(sessionState.tokens[a].expiresAt) - Number(sessionState.tokens[b].expiresAt));
  for (let index = 0; index < keys.length - STAFF_SESSION_MAX_TOKENS; index += 1) delete sessionState.tokens[keys[index]];
}
async function readSessions(at = Date.now()) {
  if (!hasDurableStore()) {
    const value = normaliseSessions(memorySessions);
    pruneSessions(value, at);
    memorySessions = value;
    return { value: clone(memorySessions), version: memoryVersion, storage: "memory" };
  }
  const loaded = await loadRuntimeState(STAFF_SESSION_STATE_KEY, { tokens: {} });
  const value = normaliseSessions(loaded.value);
  pruneSessions(value, at);
  return { value, version: loaded.version, storage: loaded.storage };
}
async function updateSessions(mutator, at = Date.now()) {
  if (!hasDurableStore()) {
    const value = normaliseSessions(memorySessions);
    pruneSessions(value, at);
    mutator(value.tokens);
    memorySessions = value;
    memoryVersion += 1;
    return { ok: true, storage: "memory", version: memoryVersion };
  }
  for (let attempt = 0; attempt < STAFF_SESSION_RETRIES; attempt += 1) {
    const loaded = await readSessions(at);
    if (loaded.storage !== "postgres") return { ok: false, storage: loaded.storage, error: "staff_session_store_unavailable" };
    const next = normaliseSessions(loaded.value);
    pruneSessions(next, at);
    mutator(next.tokens);
    const saved = await saveRuntimeState(STAFF_SESSION_STATE_KEY, next, loaded.version);
    if (saved.ok) return { ok: true, storage: "postgres", version: saved.version };
    if (!saved.conflict) return { ok: false, storage: "postgres", error: saved.error || "staff_session_store_save_failed" };
  }
  return { ok: false, storage: "postgres", error: "staff_session_store_conflict" };
}
export function issueStaffToken(staff, at = Date.now()) {
  if (STAFF_TOKEN_SECRET.length < 32) throw new Error("staff_auth_not_configured");
  const payload = Buffer.from(JSON.stringify({ sub: staff.id, email: staff.email, iat: Math.floor(at / 1000), exp: Math.floor(at / 1000) + STAFF_TOKEN_TTL_SECONDS, nonce: randomUUID() })).toString("base64url");
  return `${payload}.${signTokenPart(payload)}`;
}
export function verifyStaffToken(raw, at = Date.now()) {
  const verified = verifiedClaims(raw, at);
  if (!verified) return null;
  const { staff, claims } = verified;
  return { ...staff, tokenIssuedAt: new Date(claims.iat * 1000).toISOString(), tokenExpiresAt: new Date(claims.exp * 1000).toISOString() };
}
export async function registerStaffSession(raw, at = Date.now()) {
  const verified = verifiedClaims(raw, at);
  if (!verified) return { ok: false, error: "bad_staff_token" };
  const expiresAt = Number(verified.claims.exp) * 1000;
  return updateSessions(tokens => { tokens[sessionHash(raw)] = { staffId: verified.staff.id, expiresAt }; }, at);
}
export async function revokeStaffSession(raw, at = Date.now()) {
  if (!raw) return { ok: true };
  return updateSessions(tokens => { delete tokens[sessionHash(raw)]; }, at);
}
export async function verifyActiveStaffToken(raw, at = Date.now()) {
  const verified = verifiedClaims(raw, at);
  if (!verified) return null;
  const active = await readSessions(at);
  if (hasDurableStore() && active.storage !== "postgres") return null;
  const session = active.value.tokens[sessionHash(raw)];
  if (!session || session.staffId !== verified.staff.id || session.expiresAt <= at) return null;
  return verifyStaffToken(raw, at);
}

export const STAFF_PAGE_COOKIE = '__Host-nia_staff_page';
export function staffPageCookie(raw, at = Date.now()) {
  const staff = verifyStaffToken(raw, at);
  const age = staff ? Math.max(0, Math.floor((Date.parse(staff.tokenExpiresAt) - at) / 1000)) : 0;
  return `${STAFF_PAGE_COOKIE}=${staff ? raw : ''}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
}
export function staffTokenFromHeader(headers) {
  const value=String(headers.authorization || '');
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : '';
}
export function namedStaff(email) { return staffSeed.find(s=>s.email===email); }
export function seededStaffPublic() {
  return staffSeed.map(s => ({
    email: s.email,
    name: s.name,
    role: s.role,
    desks: s.desks,
    ...(s.test ? { test: true } : {})
  }));
}
function secretsEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (!left.length || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
export function testStaffPassword(env = process.env) {
  const secret = String(env.STAFF_TOKEN_SECRET || '');
  if (secret.length < 32) return '';
  return createHmac('sha256', secret).update('test-staff-password-v1\n' + TEST_STAFF_EMAIL).digest('base64url').slice(0, 24);
}
export function staffPasswordDigest(email, password, env = process.env) {
  const secret = String(env.STAFF_TOKEN_SECRET || '');
  const actual = typeof password === 'string' ? password : '';
  if (secret.length < 32 || actual.length < STAFF_PERSONAL_PASSWORD_MIN || actual.length > 120) return '';
  return createHmac('sha256', secret).update('staff-password-v1\n' + String(email || '').toLowerCase() + '\n' + actual).digest('base64url');
}
function normalisePasswords(value) {
  const source = value && typeof value === 'object' && value.byStaffId && typeof value.byStaffId === 'object' ? value.byStaffId : {};
  const byStaffId = {};
  for (const [staffId, entry] of Object.entries(source)) {
    if (typeof staffId !== 'string' || !staffId || !entry || typeof entry !== 'object') continue;
    const digest = typeof entry.digest === 'string' ? entry.digest : '';
    const email = typeof entry.email === 'string' ? entry.email : '';
    if (!digest || !email) continue;
    byStaffId[staffId] = { digest, email, updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : null };
  }
  return { byStaffId };
}
async function readStaffPasswords() {
  if (!hasDurableStore()) {
    memoryPasswords = normalisePasswords(memoryPasswords);
    return { value: clone(memoryPasswords), version: memoryPasswordVersion, storage: 'memory' };
  }
  const loaded = await loadRuntimeState(STAFF_PASSWORD_STATE_KEY, { byStaffId: {} });
  return { value: normalisePasswords(loaded.value), version: loaded.version, storage: loaded.storage };
}
async function updateStaffPasswords(mutator) {
  if (!hasDurableStore()) {
    const value = normalisePasswords(memoryPasswords);
    mutator(value.byStaffId);
    memoryPasswords = value;
    memoryPasswordVersion += 1;
    return { ok: true, storage: 'memory', version: memoryPasswordVersion };
  }
  for (let attempt = 0; attempt < STAFF_SESSION_RETRIES; attempt += 1) {
    const loaded = await readStaffPasswords();
    if (loaded.storage !== 'postgres') return { ok: false, storage: loaded.storage, error: 'staff_password_store_unavailable' };
    const next = normalisePasswords(loaded.value);
    mutator(next.byStaffId);
    const saved = await saveRuntimeState(STAFF_PASSWORD_STATE_KEY, next, loaded.version);
    if (saved.ok) return { ok: true, storage: 'postgres', version: saved.version };
    if (!saved.conflict) return { ok: false, storage: 'postgres', error: saved.error || 'staff_password_store_save_failed' };
  }
  return { ok: false, storage: 'postgres', error: 'staff_password_store_conflict' };
}
export async function verifyStaffPassword(email, password, env = process.env) {
  const found = namedStaff(String(email || '').trim().toLowerCase());
  if (!found) return { ok: false };
  const stored = await readStaffPasswords();
  const personal = stored.value.byStaffId[found.id];
  if (personal?.digest) {
    const actual = staffPasswordDigest(found.email, password, env);
    return { ok: Boolean(actual) && secretsEqual(actual, personal.digest), staff: found, via: 'personal' };
  }
  if (found.id === 'stf-test') {
    const expected = testStaffPassword(env);
    return { ok: Boolean(expected) && secretsEqual(password, expected), staff: found, via: 'test' };
  }
  const expected = found.id === 'stf-ajay-mahawar' ? env.JAT_STAFF_PASSWORD : env.STAFF_PASSWORD;
  if (!expected || !secretsEqual(password, expected)) return { ok: false, staff: found };
  return { ok: true, staff: found, via: found.id === 'stf-ajay-mahawar' ? 'jat' : 'shared' };
}
export async function saveStaffPassword(staffId, email, password, at = Date.now(), env = process.env) {
  const digest = staffPasswordDigest(email, password, env);
  if (!digest) return { ok: false, error: 'weak_password' };
  return updateStaffPasswords(byStaffId => {
    byStaffId[staffId] = { digest, email: String(email || '').toLowerCase(), updatedAt: new Date(at).toISOString() };
  });
}
export async function loginStaffWithPassword(email, password, at = Date.now(), env = process.env) {
  if ((env.STAFF_TOKEN_SECRET || STAFF_TOKEN_SECRET).length < 32) return { ok: false, error: 'staff_auth_not_configured', status: 503 };
  const checked = await verifyStaffPassword(email, password, env);
  if (!checked.ok || !checked.staff) return { ok: false, error: 'bad_credentials', status: 401 };
  try {
    const token = issueStaffToken(checked.staff, at);
    const activated = await registerStaffSession(token, at);
    if (!activated.ok) return { ok: false, error: 'staff_session_unavailable', status: 503, storage: activated.storage };
    return { ok: true, token, staff: checked.staff, storage: activated.storage, via: checked.via, status: 200 };
  } catch {
    return { ok: false, error: 'staff_auth_not_configured', status: 503 };
  }
}
export function validCronToken(raw) {
  const secret=process.env.CRON_SECRET;
  if (!secret || !raw) return false;
  const actual=Buffer.from(raw), expected=Buffer.from(secret);
  return actual.length===expected.length && timingSafeEqual(actual,expected);
}
