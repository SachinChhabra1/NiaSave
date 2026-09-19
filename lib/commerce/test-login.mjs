/**
 * Labelled TEST human logins. Real members still need the identity OTP
 * provider. Dummy rows stay dummy. Payments stay off.
 *
 * Member: phone +917000000001 goes through the real
 * /auth/request → /auth/verify → /auth/set-password path with a local
 * HMAC OTP (no SMS). GET /test/member-login runs that path and returns
 * a credential-free proof.
 *
 * Staff: test.desk@nia.one signs in through the real POST /v1/staff/login
 * password check. GET /test/staff/login proves it without exposing a
 * token. Named desk staff can set a personal password after first login.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { SKUS } from '../../rabbit/engine.mjs';
import { hasDurableStore } from '../runtime-store.mjs';
import {
  loginStaffWithPassword,
  namedStaff,
  seededStaffPublic,
  testStaffPassword,
  TEST_STAFF_EMAIL
} from '../staff-auth.mjs';
import * as core from './core.mjs';
import { applyMemberFulfillment } from './member-fulfillment.mjs';
import {
  buildMemberPasswordProfile,
  memberPasswordLogin,
  memberPasswordProfileKey,
  normalizeMemberPhone
} from './member-password.mjs';
import { TEST_DESK } from './test-member.mjs';

export const TEST_PHONE = '+917000000001';
export const TEST_PHONE_MEMBER = Object.freeze({
  id: 'nia-test-phone-member',
  name: 'TEST member',
  role: 'member',
  locationIds: ['S01'],
  identitySource: 'test-phone-otp',
  verifiedPhone: TEST_PHONE,
  test: true
});
export const TEST_MEMBER_LOGIN_VIA = Object.freeze([
  'POST /api/commerce/auth/request',
  'POST /api/commerce/auth/verify',
  'POST /api/commerce/auth/set-password'
]);

function secretsEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (!left.length || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function memberSecret(env = process.env) {
  return String(env.SESSION_SECRET || '');
}

export function isTestMemberPhone(value) {
  return normalizeMemberPhone(value) === TEST_PHONE;
}

export function isTestLoginPath(path) {
  return path === '/test/member-login' || path === '/test/staff/login' || path === '/test/staff/prove';
}

export function testPhoneOtpCode(phone, challenge, env = process.env) {
  const secret = memberSecret(env);
  if (secret.length < 16 || !phone || !challenge) return '';
  const n = createHmac('sha256', secret).update('test-otp-code-v1\n' + phone + '\n' + challenge).digest().readUInt32BE(0) % 1_000_000;
  return String(n).padStart(6, '0');
}

export function testPhoneOtpHash(phone, challenge, code, env = process.env) {
  const secret = memberSecret(env);
  if (secret.length < 16) return '';
  return createHmac('sha256', secret).update('test-otp-hash-v1\n' + phone + '\n' + challenge + '\n' + code).digest('base64url');
}

export function testMemberPassword(env = process.env) {
  const secret = memberSecret(env);
  if (secret.length < 16) return '';
  return createHmac('sha256', secret).update('test-member-password-v1\n' + TEST_PHONE).digest('base64url').slice(0, 24);
}

export function issueTestPhoneOtp(phone, at = Date.now(), env = process.env) {
  const normalized = normalizeMemberPhone(phone);
  if (normalized !== TEST_PHONE) throw new Error('not_test_phone');
  const challenge = randomBytes(16).toString('base64url');
  const code = testPhoneOtpCode(normalized, challenge, env);
  const codeHash = testPhoneOtpHash(normalized, challenge, code, env);
  return { challenge, code, codeHash, exp: at + 10 * 60 * 1000, test: true };
}

export function storeTestOtp(s, phone, issued) {
  s.commerce.testOtps ||= {};
  s.commerce.testOtps[phone] = {
    challenge: issued.challenge,
    codeHash: issued.codeHash,
    exp: issued.exp,
    test: true
  };
}

export function consumeTestOtp(s, phone, challenge, code, time, env = process.env) {
  const row = s.commerce.testOtps?.[phone];
  if (!row || row.exp <= time || !secretsEqual(row.challenge, challenge)) return false;
  const expected = testPhoneOtpCode(phone, challenge, env);
  if (!expected || !secretsEqual(code, expected)) return false;
  if (!secretsEqual(row.codeHash, testPhoneOtpHash(phone, challenge, expected, env))) return false;
  delete s.commerce.testOtps[phone];
  return true;
}

export function completeTestPhoneLogin(s, req, time, env = process.env) {
  applyMemberFulfillment(s, time, SKUS);
  const phone = TEST_PHONE;
  const issued = issueTestPhoneOtp(phone, time, env);
  storeTestOtp(s, phone, issued);
  if (!consumeTestOtp(s, phone, issued.challenge, issued.code, time, env)) {
    return { status: 401, body: { error: 'bad_otp' } };
  }
  const password = testMemberPassword(env);
  if (!password) return { status: 503, body: { error: 'member_password_not_configured' } };
  const profile = buildMemberPasswordProfile(phone, password, {
    subject: TEST_PHONE_MEMBER.id,
    locationIds: TEST_PHONE_MEMBER.locationIds
  }, time, env);
  const key = memberPasswordProfileKey(phone, env);
  s.commerce.memberPasswords ||= {};
  s.commerce.memberPasswords[key] = profile;
  const login = memberPasswordLogin({ phone, password, remember: true }, req, time, env, profile);
  if (login.status !== 200) return login;
  const account = {
    ...TEST_PHONE_MEMBER,
    ...login.body.account,
    test: true,
    name: 'TEST member',
    verifiedPhone: phone
  };
  s.commerce.accounts[account.id] = account;
  const cat = core.catalogue(s, SKUS, false, time);
  return {
    status: 200,
    headers: login.headers,
    body: {
      test: true,
      sms: false,
      via: TEST_MEMBER_LOGIN_VIA,
      phone,
      memberId: account.id,
      account: { id: account.id, name: account.name, role: account.role, locationIds: account.locationIds, test: true },
      catalogueReady: cat.ready === true,
      paymentsEnabled: false,
      storage: s.persist || (hasDurableStore() ? 'postgres' : 'memory'),
      realMemberOtp: 'identity_provider',
      desk: TEST_DESK
    }
  };
}

export async function proveStaffLogin(env = process.env) {
  const password = testStaffPassword(env);
  if (!password) return { status: 503, body: { error: 'staff_auth_not_configured' } };
  const result = await loginStaffWithPassword(TEST_STAFF_EMAIL, password, Date.now(), env);
  if (!result.ok) return { status: result.status || 401, body: { error: result.error, test: true } };
  const admin = namedStaff('admin@nia.one');
  return {
    status: 200,
    body: {
      test: true,
      via: 'POST /v1/staff/login',
      staff: {
        id: result.staff.id,
        email: result.staff.email,
        name: result.staff.name,
        role: result.staff.role,
        desks: result.staff.desks,
        test: true
      },
      sessionIssued: true,
      tokenExposed: false,
      storage: result.storage || (hasDurableStore() ? 'postgres' : 'memory'),
      loginPath: '/v1/staff/login',
      setPasswordPath: '/v1/staff/set-password',
      desk: TEST_DESK,
      admin: {
        email: 'admin@nia.one',
        seeded: Boolean(admin),
        sharedPasswordConfigured: String(env.STAFF_PASSWORD || '').length >= 8,
        tokenSecretConfigured: String(env.STAFF_TOKEN_SECRET || '').length >= 32
      },
      seeded: seededStaffPublic(),
      paymentsEnabled: false,
      humanStep: 'Open https://www.niasave.com/save-desk.html · email admin@nia.one · password = Vercel env STAFF_PASSWORD'
    }
  };
}
