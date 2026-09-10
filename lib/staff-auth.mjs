import {createHmac, timingSafeEqual, randomUUID} from 'node:crypto';
export const STAFF_TOKEN_TTL_SECONDS = 12 * 60 * 60;
const STAFF_TOKEN_SECRET = process.env.STAFF_TOKEN_SECRET || "";
const staffSeed = [
  { id: "stf-ajay-mahawar", email: "ajay.mahawar@nia.one", name: "Ajay Mahawar", role: "living", desks: ["living"] },
  { id: "stf-admin", email: "admin@nia.one", name: "Admin", role: "admin", desks: ["studio", "hub", "money", "pilot"] },
  { id: "stf-satish", email: "satish@nia.one", name: "Satish", role: "studio+hub", desks: ["studio", "hub"] },
  { id: "stf-ramesh", email: "ramesh@nia.one", name: "Ramesh", role: "hub", desks: ["hub"] },
  { id: "stf-kavita", email: "kavita@nia.one", name: "Kavita", role: "money", desks: ["money"] },
  { id: "stf-pilot", email: "pilot@nia.one", name: "Pilot", role: "pilot", desks: ["pilot"] }
];
if (process.env.STAFF_QA_EMAIL) staffSeed.push({ id: "stf-qa", email: String(process.env.STAFF_QA_EMAIL).toLowerCase(), name: "QA", role: "admin", desks: ["studio", "hub", "money", "pilot"] });

function signTokenPart(part) { return createHmac("sha256", STAFF_TOKEN_SECRET).update(part).digest("base64url"); }
export function issueStaffToken(staff, at = Date.now()) {
  if (STAFF_TOKEN_SECRET.length < 32) throw new Error("staff_auth_not_configured");
  const payload = Buffer.from(JSON.stringify({ sub: staff.id, email: staff.email, iat: Math.floor(at / 1000), exp: Math.floor(at / 1000) + STAFF_TOKEN_TTL_SECONDS, nonce: randomUUID() })).toString("base64url");
  return `${payload}.${signTokenPart(payload)}`;
}
export function verifyStaffToken(raw, at = Date.now()) {
  if (STAFF_TOKEN_SECRET.length < 32) return null;
  const [payload, signature, extra] = String(raw || "").split(".");
  if (!payload || !signature || extra) return null;
  const expected = signTokenPart(payload); const have = Buffer.from(signature); const want = Buffer.from(expected);
  if (have.length !== want.length || !timingSafeEqual(have, want)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!claims.exp || claims.exp <= Math.floor(at / 1000)) return null;
    const staff = staffSeed.find(row => row.id === claims.sub && row.email === claims.email);
    return staff ? { ...staff, tokenIssuedAt: new Date(claims.iat * 1000).toISOString(), tokenExpiresAt: new Date(claims.exp * 1000).toISOString() } : null;
  } catch { return null; }
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
export function validCronToken(raw) {
  const secret=process.env.CRON_SECRET;
  if (!secret || !raw) return false;
  const actual=Buffer.from(raw), expected=Buffer.from(secret);
  return actual.length===expected.length && timingSafeEqual(actual,expected);
}
