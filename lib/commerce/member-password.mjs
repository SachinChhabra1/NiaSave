import {createHmac, timingSafeEqual} from 'node:crypto';

export const MEMBER_COOKIE = 'nia_member';
export const MEMBER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const MEMBER_ACCOUNT = Object.freeze({
  id: 'nia-member',
  name: 'Nia member',
  role: 'member',
  locationIds: ['S01'],
  identitySource: 'member-password'
});

const actorSlot = Symbol('member-password-actor');
const loginAttempts = new Map();

export function passwordAuthEnabled(env = process.env) {
  return String(env.MEMBER_PASSWORD || '').length >= 8 && String(env.SESSION_SECRET || '').length >= 16;
}

function digest(value, secret) {
  return createHmac('sha256', secret).update(String(value)).digest();
}

export function passwordMatches(submitted, env = process.env) {
  const expected = String(env.MEMBER_PASSWORD || '');
  const actual = typeof submitted === 'string' ? submitted : '';
  const secret = String(env.SESSION_SECRET || '');
  if (expected.length < 8 || secret.length < 16) return false;
  const left = digest(actual, secret);
  const right = digest(expected, secret);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function issueMemberSession(at = Date.now(), env = process.env) {
  if (!passwordAuthEnabled(env)) throw new Error('member_password_not_configured');
  const payload = Buffer.from(JSON.stringify({
    sub: MEMBER_ACCOUNT.id,
    role: 'member',
    iat: Math.floor(at / 1000),
    exp: Math.floor(at / 1000) + MEMBER_SESSION_TTL_SECONDS
  })).toString('base64url');
  const signature = createHmac('sha256', env.SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyMemberSession(raw, at = Date.now(), env = process.env) {
  if (!passwordAuthEnabled(env)) return null;
  const [payload, signature, extra] = String(raw || '').split('.');
  if (!payload || !signature || extra) return null;
  const expected = createHmac('sha256', env.SESSION_SECRET).update(payload).digest('base64url');
  const have = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (have.length !== want.length || !timingSafeEqual(have, want)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (claims.sub !== MEMBER_ACCOUNT.id || claims.role !== 'member') return null;
    if (!claims.exp || claims.exp <= Math.floor(at / 1000)) return null;
    return {...MEMBER_ACCOUNT};
  } catch {
    return null;
  }
}

function cookieValue(req) {
  const cookies = String(req.headers?.cookie || '').split(';').map(part => part.trim());
  const pair = cookies.find(item => item.startsWith(MEMBER_COOKIE + '='));
  return pair ? pair.slice(MEMBER_COOKIE.length + 1) : '';
}

export function memberSessionCookie(raw = '') {
  const age = raw ? MEMBER_SESSION_TTL_SECONDS : 0;
  return `${MEMBER_COOKIE}=${raw}; Path=/api/commerce; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
}

export function passwordSessionActor(req, at = Date.now(), env = process.env) {
  if (Object.hasOwn(req, actorSlot)) return req[actorSlot];
  const actor = verifyMemberSession(cookieValue(req), at, env);
  req[actorSlot] = actor;
  return actor;
}

export function publicMemberAccount(actor) {
  return actor && {id: actor.id, name: actor.name, role: actor.role, locationIds: actor.locationIds};
}

export function allowMemberLoginAttempt(ip, at = Date.now()) {
  const key = String(ip || 'unknown');
  const windowMs = 15 * 60 * 1000;
  const row = loginAttempts.get(key);
  if (!row || at - row.start > windowMs) {
    loginAttempts.set(key, {count: 1, start: at});
    return true;
  }
  if (row.count >= 20) return false;
  row.count += 1;
  return true;
}

export function resetMemberLoginAttempts() {
  loginAttempts.clear();
}

export function passwordCatalogue(account) {
  return {
    preview: false,
    memberAuth: 'password',
    account: publicMemberAccount(account),
    products: [],
    locations: [],
    status: account ? 'ready' : 'sign_in_required',
    paymentsEnabled: false
  };
}

export function memberPasswordLogin(body, req, at = Date.now(), env = process.env) {
  if (!passwordAuthEnabled(env)) return {status: 503, body: {error: 'member_password_not_configured'}};
  if (!allowMemberLoginAttempt(req.socket?.remoteAddress, at)) return {status: 429, body: {error: 'too_many_attempts'}};
  if (!passwordMatches(body?.password, env)) return {status: 401, body: {error: 'invalid_password'}};
  return {
    status: 200,
    body: {account: publicMemberAccount(MEMBER_ACCOUNT)},
    headers: {'set-cookie': memberSessionCookie(issueMemberSession(at, env))}
  };
}
