/**
 * Central-owned shared identity. One record { member, studio, JCO }.
 *
 * Source of truth is RafiQi Central. NiaSave reads it through the existing
 * signed POST /api/service/member kind `member.identity`. Writes stay on
 * Central (enrolment, residence, studio_custody JCO assignment) — NiaSave
 * never copies the record into nia_runtime_state.
 *
 * TEST members skip Central and return a labelled TEST record. Real members
 * never receive invented member / studio / JCO values: missing stays null,
 * unknown_request is unavailable unless COMMERCE_REQUIRE_CENTRAL_IDENTITY=true
 * (then fail closed). Orders stay keyed by the session member id.
 */
import { CommerceError } from './core.mjs';
import { centralMemberRequest } from './central-client.mjs';
import { COLLECT_HINT } from './shop-offer.mjs';
import { TEST_MEMBER } from './test-member.mjs';
import { TEST_PHONE, TEST_PHONE_MEMBER } from './test-login.mjs';

export const IDENTITY_SCHEMA_VERSION = 1;
export const IDENTITY_KIND = 'member.identity';

export function requireCentralIdentity(env = process.env) {
  return String(env.COMMERCE_REQUIRE_CENTRAL_IDENTITY || '').trim().toLowerCase() === 'true';
}

function text(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function idLike(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_.:@+|-]{1,200}$/.test(value);
}

function parseStudio(raw) {
  if (raw === null || raw === undefined) return null;
  if (!raw || typeof raw !== 'object') return undefined;
  const id = text(raw.id, 80);
  if (!id) return undefined;
  return {
    id,
    siteCode: text(raw.siteCode, 80),
    name: text(raw.name, 120),
    theatre: text(raw.theatre, 40),
    verified: raw.verified === true
  };
}

function parseJco(raw) {
  if (raw === null || raw === undefined) return null;
  if (!raw || typeof raw !== 'object') return undefined;
  const id = text(raw.id, 80);
  if (!id || raw.role !== 'JCO') return undefined;
  return {
    id,
    name: text(raw.name, 120),
    unitId: text(raw.unitId, 120),
    role: 'JCO'
  };
}

/** Strict parse of Central's one record. Rejects invented or half-shaped payloads. */
export function parseIdentityRecord(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (Number(body.schemaVersion) !== IDENTITY_SCHEMA_VERSION) return null;
  if (body.source && body.source !== 'central') return null;
  const member = body.member;
  if (!member || typeof member !== 'object' || !idLike(member.id) || !idLike(member.subject)) return null;
  const studio = parseStudio(body.studio);
  if (studio === undefined) return null;
  const jco = parseJco(body.jco);
  if (jco === undefined) return null;
  if (jco && !studio) return null;
  return {
    schemaVersion: IDENTITY_SCHEMA_VERSION,
    source: 'central',
    status: 'ready',
    member: {
      id: member.id,
      subject: member.subject,
      name: text(member.name, 120),
      phoneMasked: text(member.phoneMasked, 24),
      state: text(member.state, 40),
      kyc: text(member.kyc, 40) || null,
      access: text(member.access, 40) || null,
      theatre: text(member.theatre, 40)
    },
    studio,
    jco,
    test: false
  };
}

export function unavailableIdentity(reason) {
  return {
    schemaVersion: IDENTITY_SCHEMA_VERSION,
    source: 'central',
    status: 'unavailable',
    error: reason || 'central_unavailable',
    member: null,
    studio: null,
    jco: null,
    test: false
  };
}

export function testIdentityRecord(actor = TEST_PHONE_MEMBER) {
  const test = actor?.id === TEST_MEMBER.id ? TEST_MEMBER : TEST_PHONE_MEMBER;
  const phone = test.id === TEST_PHONE_MEMBER.id ? TEST_PHONE : '';
  return {
    schemaVersion: IDENTITY_SCHEMA_VERSION,
    source: 'test',
    status: 'ready',
    test: true,
    member: {
      id: test.id,
      subject: test.id,
      name: 'TEST member',
      phoneMasked: phone ? `+91 ******${phone.slice(-4)}` : '',
      state: 'test',
      kyc: 'test',
      access: 'active',
      theatre: 'TEST'
    },
    studio: {
      id: COLLECT_HINT.id,
      siteCode: COLLECT_HINT.id,
      name: COLLECT_HINT.name,
      theatre: COLLECT_HINT.theatre,
      verified: false
    },
    jco: {
      id: 'test-jco',
      name: 'TEST JCO',
      unitId: 'studio_custody:' + COLLECT_HINT.id,
      role: 'JCO'
    }
  };
}

export function isTestIdentityActor(actor) {
  return Boolean(actor && actor.role === 'member' && actor.test === true && (actor.id === TEST_MEMBER.id || actor.id === TEST_PHONE_MEMBER.id));
}

function closedFailure(code) {
  return new CommerceError(code, 503);
}

/**
 * Read the Central identity record for this session actor.
 * Never writes to Save state. TEST skip is labelled TEST.
 */
export async function centralIdentityRecord(actor, opts = {}) {
  if (!actor || actor.role !== 'member') throw new CommerceError('sign_in_required', 401);
  if (isTestIdentityActor(actor)) return testIdentityRecord(actor);
  const env = opts.env || process.env;
  const requireIdentity = requireCentralIdentity(env);
  let result;
  try {
    result = await centralMemberRequest(IDENTITY_KIND, actor.authSubject || actor.id, {}, opts);
  } catch (error) {
    const reason = error instanceof CommerceError ? error.message : 'central_unreachable';
    if (requireIdentity) throw closedFailure(reason === 'central_connection_not_configured' ? 'central_identity_required' : reason);
    return unavailableIdentity(reason);
  }
  const error = typeof result.body?.error === 'string' ? result.body.error : '';
  if (result.status === 404 && ['member_not_enrolled', 'member_not_found', 'not_found'].includes(error)) {
    if (requireIdentity) throw closedFailure('member_not_enrolled');
    return unavailableIdentity(error || 'member_not_enrolled');
  }
  if (result.status === 400 && ['unknown_request', 'unknown_operation', 'unsupported_member_identity'].includes(error)) {
    if (requireIdentity) throw closedFailure('central_identity_required');
    return unavailableIdentity(error || 'unknown_request');
  }
  if (result.status !== 200) {
    if (requireIdentity) throw closedFailure(error || 'central_identity_unavailable');
    return unavailableIdentity(error || 'central_identity_unavailable');
  }
  const parsed = parseIdentityRecord(result.body);
  if (!parsed) {
    if (requireIdentity) throw closedFailure('central_invalid_identity');
    return unavailableIdentity('central_invalid_identity');
  }
  return parsed;
}
