import {createHmac, timingSafeEqual} from 'node:crypto';
import {SKUS} from '../../rabbit/engine.mjs';
import {decorateBrowseProducts, waveCatalogueExtras} from './shop-waves.mjs';
import {fulfillmentProducts, stampTestProduct, ompalPickupLocation} from './member-fulfillment.mjs';
import {packIsConfirmed} from './shop-offer.mjs';

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

// Production enforcement: real member password profiles/sessions must originate
// from Central-verified OTP. Explicitly labelled TEST identities stay isolated.
export function requireCentralMember(env = process.env) {
  return String(env.COMMERCE_REQUIRE_CENTRAL_MEMBER || '').trim().toLowerCase() === 'true';
}

// Guest Save/shop browse. Unset or any value other than "false" exposes the
// published SKU grid without a session. Set "false" to restore the empty wall.
export function publicBrowseEnabled(env = process.env) {
  return String(env.COMMERCE_PUBLIC_BROWSE || '').trim().toLowerCase() !== 'false';
}

export function passwordAuthCapabilities(env = process.env) {
  return {
    mode: 'password_otp',
    entryPath: '/',
    hashTabs: ['live', 'earn', 'shop', 'send'],
    apiBasePath: '/api/commerce',
    registeredPhoneOnly: requireCentralMember(env),
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
    name: typeof profile?.name==='string' && profile.name ? profile.name.slice(0,120) : 'Nia member',
    role: 'member',
    locationIds: Array.isArray(profile?.locationIds) ? profile.locationIds : ['S01'],
    identitySource: profile?.identitySource==='central-whatsapp'?'central-whatsapp':'member-password',
    ...(profile?.identitySource==='central-whatsapp'?{authVersion:profile.authVersion,locationModes:profile.locationModes||{},locationPinCodes:profile.locationPinCodes||{}}:{}),
    ...(subject ? {authSubject: subject} : {}),
    ...(phone ? {verifiedPhone: phone} : {})
  };
}

function labelledTestMember(id) {
  return id === 'nia-test-member' || id === 'nia-test-phone-member';
}

function accountFromClaims(claims) {
  if (!claims || claims.role !== 'member') return null;
  const id = validSubject(claims.sub) ? claims.sub : MEMBER_ACCOUNT.id;
  const authSubject = validSubject(claims.authSubject) ? claims.authSubject : null;
  const verifiedPhone = normalizeMemberPhone(claims.verifiedPhone);
  const locationIds = Array.isArray(claims.locationIds) && claims.locationIds.every(validSubject)
    ? claims.locationIds
    : MEMBER_ACCOUNT.locationIds;
  const test = labelledTestMember(id);
  return {
    id,
    name: test ? 'TEST member' : (typeof claims.name === 'string' && claims.name ? claims.name.slice(0, 80) : MEMBER_ACCOUNT.name),
    role: 'member',
    locationIds,
    ...(claims.identitySource==='central-whatsapp'?{authVersion:claims.authVersion,locationModes:claims.locationModes||{},locationPinCodes:claims.locationPinCodes||{}}:{}),
    identitySource: claims.identitySource==='central-whatsapp'?'central-whatsapp':id === 'nia-test-phone-member' ? 'test-phone-otp' : id === 'nia-test-member' ? 'test-auto-session' : 'member-password',
    ...(authSubject ? {authSubject} : {}),
    ...(verifiedPhone ? {verifiedPhone} : {}),
    ...(test ? {test: true} : {})
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
    ...(account.identitySource==='central-whatsapp'?{identitySource:'central-whatsapp',authVersion:account.authVersion,locationModes:account.locationModes||{},locationPinCodes:account.locationPinCodes||{}}:{}),
    locationIds: account.locationIds || MEMBER_ACCOUNT.locationIds,
    name: labelledTestMember(account.id) ? 'TEST member' : (account.name || MEMBER_ACCOUNT.name),
    role: 'member',
    ...(labelledTestMember(account.id) ? {test: true} : {}),
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

export function issueMemberSetupToken(phone, subject, at = Date.now(), env = process.env, account = null) {
  const normalized = normalizeMemberPhone(phone);
  const secret = String(env.SESSION_SECRET || '');
  if (!normalized || secret.length < 16) throw new Error('member_setup_not_configured');
  const payload = Buffer.from(JSON.stringify({
    phone: normalized,
    subject: validSubject(subject) ? subject : null,
    ...(account ? {identitySource:'central-whatsapp',authVersion:account.authVersion,locationModes:account.locationModes||{},locationPinCodes:account.locationPinCodes||{},name: typeof account.name==='string'?account.name.slice(0,120):'Nia member', locationIds:Array.isArray(account.locationIds)?account.locationIds.filter(validSubject):[]} : {}),
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
    return {phone, subject: validSubject(claims.subject) ? claims.subject : null, ...(Array.isArray(claims.locationIds)?{identitySource:claims.identitySource,authVersion:claims.authVersion,locationModes:claims.locationModes||{},locationPinCodes:claims.locationPinCodes||{},locationIds:claims.locationIds.filter(validSubject),name:typeof claims.name==='string'?claims.name.slice(0,120):'Nia member'}:{})};
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

export function setPasswordSessionActor(req,actor){ req[actorSlot]=actor; }

export function publicMemberAccount(actor) {
  return actor && {id: actor.id, name: actor.name, role: actor.role, locationIds: actor.locationIds, ...(actor.test===true?{test:true}:{})};
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

export function passwordCatalogue(account, env = process.env, stockRows = []) {
  const browse = publicBrowseEnabled(env);
  const guest = guestTestLane(stockRows);
  return {
    preview: false,
    memberAuth: 'password',
    memberAuthCapabilities: passwordAuthCapabilities(env),
    account: publicMemberAccount(account),
    products: browse ? guest.products : [],
    locations: browse ? guest.locations : [],
    status: account || browse ? 'ready' : 'sign_in_required',
    ...waveCatalogueExtras(),
    paymentsEnabled: false
  };
}

function guestTestLane(stockRows = []) {
  // Same quarantine as applyMemberFulfillment: pending-pack SKUs are not orderable.
  const products = decorateBrowseProducts(
    fulfillmentProducts(SKUS).filter(packIsConfirmed).map(stampTestProduct),
    stockRows
  );
  return {
    products,
    locations: [{...ompalPickupLocation(), test: true}]
  };
}

export function buildMemberPasswordProfile(phone, password, {subject = null, locationIds = ['S01'], name = 'Nia member',identitySource=null,authVersion=null,locationModes={},locationPinCodes={}} = {}, at = Date.now(), env = process.env) {
  const normalized = normalizeMemberPhone(phone);
  if (!normalized) throw new Error('invalid_phone');
  if (typeof password !== 'string' || password.length < 8 || password.length > 120) throw new Error('invalid_password');
  const passwordDigest = passwordProfileDigest(normalized, password, env);
  if (!passwordDigest) throw new Error('member_password_not_configured');
  return {
    passwordDigest,
    ...(identitySource==='central-whatsapp'?{identitySource,authVersion,locationModes,locationPinCodes}:{}),
    name: typeof name==='string'?name.slice(0,120):'Nia member',
    subject: validSubject(subject) ? subject : null,
    locationIds: Array.isArray(locationIds) ? locationIds.filter(validSubject) : ['S01'],
    updatedAt: new Date(at).toISOString()
  };
}

export function memberPasswordLogin(body, req, at = Date.now(), env = process.env, profile = null) {
  if (!passwordAuthEnabled(env)) return {status: 503, body: {error: 'member_password_not_configured'}};
  if (!allowMemberLoginAttempt(req.socket?.remoteAddress, at)) return {status: 429, body: {error: 'too_many_attempts'}};
  const phone = normalizeMemberPhone(body?.phone);
  if(requireCentralMember(env)&&profile?.identitySource!=='central-whatsapp'&&!labelledTestMember(profile?.subject))return {status:401,body:{error:'invalid_password'}};
  let account = null;
  if (phone && profile?.passwordDigest) {
    if (!profilePasswordMatches(phone, body?.password, profile, env)) return {status: 401, body: {error: 'invalid_password'}};
    account = memberAccountFromProfile(phone, profile, env);
  } else if (passwordMatches(body?.password, env)) {
    account = phone ? memberAccountFromProfile(phone, {locationIds: ['S01']}, env) : {...MEMBER_ACCOUNT};
  }
  if (phone && (account?.id === 'preview-member' || account?.id === MEMBER_ACCOUNT.id)) {
    account = memberAccountFromProfile(phone, profile || {locationIds: account.locationIds}, env);
  }
  if (!account) return {status: 401, body: {error: 'invalid_password'}};
  if (labelledTestMember(account.id)) account = {...account, test: true, name: 'TEST member'};
  const remember = body?.remember !== false;
  const ttlSeconds = remember ? MEMBER_SESSION_TTL_SECONDS : MEMBER_SHORT_SESSION_TTL_SECONDS;
  return {
    status: 200,
    body: {account: publicMemberAccount(account)},
    headers: {'set-cookie': memberSessionCookie(issueMemberSession(account, at, env, ttlSeconds), ttlSeconds)}
  };
}
