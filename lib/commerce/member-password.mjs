import {createHmac, timingSafeEqual} from 'node:crypto';

export const MEMBER_COOKIE = 'nia_member';
export const MEMBER_SETUP_COOKIE = 'nia_member_setup';
export const MEMBER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const MEMBER_SHORT_SESSION_TTL_SECONDS = 12 * 60 * 60;
export const MEMBER_SETUP_TTL_SECONDS = 10 * 60;
export const MEMBER_ACCOUNT = Object.freeze({
  id: 'nia-member',
  name: 'Nia member',
  role: 'member',
  locationIds: ['S01'],
  identitySource: 'member-password'
});

export function passwordAuthCapabilities() {
  return {
    mode: 'password_otp',
    entryPath: '/',
    hashTabs: ['live', 'earn', 'shop', 'send'],
    apiBasePath: '/api/commerce',
    registeredPhoneOnly: true,
    otpRequestPath: '/api/commerce/auth/request',
    otpVerifyPath: '/api/commerce/auth/verify',
    setPasswordPath: '/api/commerce/auth/set-password',
    setPasswordAliases: ['/api/commerce/auth/password', '/api/commerce/auth/password/set'],
    loginPath: '/api/commerce/auth/login',
    rememberSession: true
  };
}

const actorSlot = Symbol('member-password-actor');
const loginAttempts = new Map();

export function passwordAuthEnabled(env = process.env) {
  return String(env.SESSION_SECRET || '').length >= 16
    && (String(env.MEMBER_PASSWORD || '').length >= 8 || String(env.COMMERCE_MEMBER_AUTH || '') === 'password');
}

export function normalizeMemberPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return '+91' + digits;
  if (/^91[6-9]\d{9}$/.test(digits)) return '+' + digits;
  return null;
}

function validSubject(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_.:@+|-]{1,200}$/.test(value);
}

function digest(value, secret) {
  return createHmac('sha256', secret).update(String(value)).digest();
}

function digestText(value, secret) {
  return createHmac('sha256', secret).update(String(value)).digest('base64url');
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

export function memberPasswordProfileKey(phone, env = process.env) {
  const normalized = normalizeMemberPhone(phone);
  const secret = String(env.SESSION_SECRET || '');
  if (!normalized || secret.length < 16) return '';
  return digestText('member-phone-v1\n' + normalized, secret);
}

export function passwordProfileDigest(phone, submitted, env = process.env) {
  const normalized = normalizeMemberPhone(phone);
  const secret = String(env.SESSION_SECRET || '');
  const actual = typeof submitted === 'string' ? submitted : '';
  if (!normalized || secret.length < 16 || actual.length < 8 || actual.length > 120) return '';
  return digestText('member-password-v1\n' + normalized + '\n' + actual, secret);
}

export function profilePasswordMatches(phone, submitted, profile, env = process.env) {
  const expected = String(profile?.passwordDigest || '');
  const actual = passwordProfileDigest(phone, submitted, env);
  if (!expected || !actual) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function memberAccountFromProfile(phone, profile, env = process.env) {
  const key = memberPasswordProfileKey(phone, env);
  const fallbackId = key ? 'nia-member-' + key.slice(0, 24) : MEMBER_ACCOUNT.id;
  const subject = validSubject(profile?.subject) ? profile.subject : null;
  return {
    id: subject || fallbackId,
    name: 'Nia member',
    role: 'member',
    locationIds: Array.isArray(profile?.locationIds) ? profile.locationIds : ['S01'],
    identitySource: 'member-password',
    ...(subject ? {authSubject: subject} : {}),
    ...(phone ? {verifiedPhone: phone} : {})
  };
}

function accountFromClaims(claims) {
  if (!claims || claims.role !== 'member') return null;
  const id = validSubject(claims.sub) ? claims.sub : MEMBER_ACCOUNT.id;
  const authSubject = validSubject(claims.authSubject) ? claims.authSubject : null;
  const verifiedPhone = normalizeMemberPhone(claims.verifiedPhone);
  const locationIds = Array.isArray(claims.locationIds) && claims.locationIds.every(id => /^S\d{2}$/.test(id))
    ? claims.locationIds
    : MEMBER_ACCOUNT.locationIds;
  return {
    id,
    name: typeof claims.name === 'string' && claims.name ? claims.name.slice(0, 80) : MEMBER_ACCOUNT.name,
    role: 'member',
    locationIds,
    identitySource: 'member-password',
    ...(authSubject ? {authSubject} : {}),
    ...(verifiedPhone ? {verifiedPhone} : {})
  };
}

export function issueMemberSession(accountOrAt = MEMBER_ACCOUNT, maybeAt = Date.now(), env = process.env, ttlSeconds = MEMBER_SESSION_TTL_SECONDS) {
  if (!passwordAuthEnabled(env)) throw new Error('member_password_not_configured');
  let account = MEMBER_ACCOUNT;
  let at = Date.now();
  if (typeof accountOrAt === 'number') at = accountOrAt;
  else {
    at = typeof maybeAt === 'number' ? maybeAt : Date.now();
    account = {...MEMBER_ACCOUNT, ...(accountOrAt || {})};
  }
  const payload = Buffer.from(JSON.stringify({
    sub: account.id,
    authSubject: account.authSubject || null,
    verifiedPhone: account.verifiedPhone || null,
    locationIds: account.locationIds || MEMBER_ACCOUNT.locationIds,
    name: account.name || MEMBER_ACCOUNT.name,
    role: 'member',
    iat: Math.floor(at / 1000),
    exp: Math.floor(at / 1000) + Math.max(60, Number(ttlSeconds) || MEMBER_SESSION_TTL_SECONDS)
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
    if (!claims.exp || claims.exp <= Math.floor(at / 1000)) return null;
    const account = accountFromClaims(claims);
    if (!account) return null;
    return account;
  } catch {
    return null;
  }
}

function cookieValue(req, name = MEMBER_COOKIE) {
  const cookies = String(req.headers?.cookie || '').split(';').map(part => part.trim());
  const pair = cookies.find(item => item.startsWith(name + '='));
  return pair ? pair.slice(name.length + 1) : '';
}

export function memberSetupCookie(raw = '') {
  const age = raw ? MEMBER_SETUP_TTL_SECONDS : 0;
  return `${MEMBER_SETUP_COOKIE}=${raw}; Path=/api/commerce/auth/password; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
}

export function issueMemberSetupToken(phone, subject, at = Date.now(), env = process.env) {
  const normalized = normalizeMemberPhone(phone);
  const secret = String(env.SESSION_SECRET || '');
  if (!normalized || secret.length < 16) throw new Error('member_setup_not_configured');
  const payload = Buffer.from(JSON.stringify({
    phone: normalized,
    subject: validSubject(subject) ? subject : null,
    iat: Math.floor(at / 1000),
    exp: Math.floor(at / 1000) + MEMBER_SETUP_TTL_SECONDS
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyMemberSetupToken(raw, at = Date.now(), env = process.env) {
  const secret = String(env.SESSION_SECRET || '');
  if (secret.length < 16) return null;
  const [payload, signature, extra] = String(raw || '').split('.');
  if (!payload || !signature || extra) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const have = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (have.length !== want.length || !timingSafeEqual(have, want)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const phone = normalizeMemberPhone(claims.phone);
    if (!phone) return null;
    if (!claims.exp || claims.exp <= Math.floor(at / 1000)) return null;
    return {phone, subject: validSubject(claims.subject) ? claims.subject : null};
  } catch {
    return null;
  }
}

export function memberSetupFromRequest(req, at = Date.now(), env = process.env) {
  return verifyMemberSetupToken(cookieValue(req, MEMBER_SETUP_COOKIE), at, env);
}

export function memberSessionCookie(raw = '', ttlSeconds = MEMBER_SESSION_TTL_SECONDS) {
  const age = raw ? Math.max(60, Number(ttlSeconds) || MEMBER_SESSION_TTL_SECONDS) : 0;
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
    memberAuthCapabilities: passwordAuthCapabilities(),
    account: publicMemberAccount(account),
    products: [],
    locations: [],
    status: account ? 'ready' : 'sign_in_required',
    paymentsEnabled: false
  };
}

export function buildMemberPasswordProfile(phone, password, {subject = null, locationIds = ['S01']} = {}, at = Date.now(), env = process.env) {
  const normalized = normalizeMemberPhone(phone);
  if (!normalized) throw new Error('invalid_phone');
  if (typeof password !== 'string' || password.length < 8 || password.length > 120) throw new Error('invalid_password');
  const passwordDigest = passwordProfileDigest(normalized, password, env);
  if (!passwordDigest) throw new Error('member_password_not_configured');
  return {
    passwordDigest,
    subject: validSubject(subject) ? subject : null,
    locationIds: Array.isArray(locationIds) ? locationIds.filter(id => /^S\d{2}$/.test(id)) : ['S01'],
    updatedAt: new Date(at).toISOString()
  };
}

export function memberPasswordLogin(body, req, at = Date.now(), env = process.env, profile = null) {
  if (!passwordAuthEnabled(env)) return {status: 503, body: {error: 'member_password_not_configured'}};
  if (!allowMemberLoginAttempt(req.socket?.remoteAddress, at)) return {status: 429, body: {error: 'too_many_attempts'}};
  const phone = normalizeMemberPhone(body?.phone);
  let account = null;
  if (phone && profile?.passwordDigest) {
    if (!profilePasswordMatches(phone, body?.password, profile, env)) return {status: 401, body: {error: 'invalid_password'}};
    account = memberAccountFromProfile(phone, profile, env);
  } else if (passwordMatches(body?.password, env)) {
    account = {...MEMBER_ACCOUNT};
  }
  if (!account) return {status: 401, body: {error: 'invalid_password'}};
  const remember = body?.remember !== false;
  const ttlSeconds = remember ? MEMBER_SESSION_TTL_SECONDS : MEMBER_SHORT_SESSION_TTL_SECONDS;
  return {
    status: 200,
    body: {account: publicMemberAccount(account)},
    headers: {'set-cookie': memberSessionCookie(issueMemberSession(account, at, env, ttlSeconds), ttlSeconds)}
  };
}
