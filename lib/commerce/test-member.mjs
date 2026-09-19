/**
 * Live TEST member for one unpaid Save order.
 * Real members still use phone password/OTP. Dummy rows stay dummy.
 * The reserve call is the same function POST /api/commerce/orders uses.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { SKUS } from '../../rabbit/engine.mjs';
import { hasDurableStore } from '../runtime-store.mjs';
import * as core from './core.mjs';
import { applyMemberFulfillment, staffOrderView } from './member-fulfillment.mjs';
import { issueMemberSession, memberSessionCookie } from './member-password.mjs';

export const TEST_MEMBER = Object.freeze({
  id: 'nia-test-member',
  name: 'TEST member',
  role: 'member',
  locationIds: ['S01'],
  identitySource: 'test-auto-session',
  test: true
});

export const TEST_ORDER_IDEMPOTENCY_KEY = 'nia-test-one-order-v1';
export const TEST_SESSION_TTL_SECONDS = 60 * 60;
export const TEST_SKU_ID = 'groundnut_oil';
export const TEST_DESK = Object.freeze({
  id: 'save-desk',
  name: 'Sikh Unit · Save desk',
  path: '/save-desk.html',
  url: 'https://www.niasave.com/save-desk.html',
  login: 'admin@nia.one',
  flow: ['reserved', 'packed', 'loaded', 'at_stop', 'verify_payment', 'collected', 'reconcile']
});

export function isTestMemberPath(path) {
  return path === '/test/session' || path === '/test/place-one' || /^\/test\/orders\/ord-[a-zA-Z0-9-]+$/.test(path);
}

export function testReadSig(orderId, env = process.env) {
  const secret = String(env.SESSION_SECRET || '');
  if (secret.length < 16 || typeof orderId !== 'string' || !orderId) return '';
  return createHmac('sha256', secret).update('test-read-v1\n' + orderId).digest('base64url');
}

export function verifyTestReadSig(orderId, sig, env = process.env) {
  const expected = testReadSig(orderId, env);
  if (!expected || typeof sig !== 'string' || !sig) return false;
  const have = Buffer.from(sig);
  const want = Buffer.from(expected);
  return have.length === want.length && timingSafeEqual(have, want);
}

export function testReadSigFromReq(req) {
  try {
    return new URL(req.url, 'http://localhost').searchParams.get('sig') || '';
  } catch {
    return '';
  }
}

export function issueTestMemberSession(at = Date.now(), env = process.env) {
  return issueMemberSession({ ...TEST_MEMBER }, at, env, TEST_SESSION_TTL_SECONDS);
}

export function testMemberSessionCookie(at = Date.now(), env = process.env) {
  return memberSessionCookie(issueTestMemberSession(at, env), TEST_SESSION_TTL_SECONDS);
}

export function existingTestOrder(s) {
  return (s?.orders || []).find(o => o.source === 'commerce' && o.memberId === TEST_MEMBER.id && o.test === true) || null;
}

export function testOrderIntent() {
  return { locationId: 'S01', fulfillment: 'pickup', lines: [{ id: TEST_SKU_ID, qty: 1 }] };
}

/** Same quote + reserve as POST /api/commerce/quote then POST /api/commerce/orders. */
export function placeOneTestOrder(s, time, skus = SKUS, preview = false) {
  applyMemberFulfillment(s, time, skus);
  s.commerce.accounts[TEST_MEMBER.id] = { ...TEST_MEMBER };
  const existing = existingTestOrder(s);
  if (existing) return { order: existing, created: false };
  const actor = { ...TEST_MEMBER };
  const intent = testOrderIntent();
  const quoted = core.quote(s, actor, intent, skus, preview, time);
  const reserved = core.reserve(s, actor, { ...intent, fingerprint: quoted.fingerprint }, TEST_ORDER_IDEMPOTENCY_KEY, skus, preview, time);
  const full = s.orders.find(o => o.id === reserved.id) || reserved;
  full.test = true;
  full.member = TEST_MEMBER.name;
  return { order: full, created: true };
}

export function testOrderProof(s, order, req, env = process.env) {
  const host = String(req?.headers?.host || 'www.niasave.com').split(',')[0].trim() || 'www.niasave.com';
  const proto = /localhost|127\.0\.0\.1/.test(host) ? 'http' : 'https';
  const sig = testReadSig(order.id, env);
  const readPath = `/api/commerce/test/orders/${order.id}?sig=${sig}`;
  return {
    test: true,
    dummy: s.dummy === true,
    storage: s.persist || (hasDurableStore() ? 'postgres' : 'memory'),
    memberId: order.memberId,
    status: order.status,
    order: staffOrderView(order),
    readPath,
    readUrl: `${proto}://${host}${readPath}`,
    desk: TEST_DESK,
    paymentsEnabled: false,
    via: 'POST /api/commerce/orders'
  };
}
