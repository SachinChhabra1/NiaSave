export const ANALYTICS_EVENTS = {
  save: [
    'catalogue_view','category_view','mill_view','add_to_bag','checkout_start',
    'auth_outcome','claim_validation_outcome','reservation','ready','collection',
    'cancellation','support_request'
  ],
  live: [
    'availability_search','offer_view','quote','hold_confirmation','expiry',
    'cancellation','check_in','check_out'
  ],
  earn: [
    'projection_status','job_view','consent','submission','review','interview',
    'offer','rejection','withdrawal','confirmed_joining'
  ],
  identity: [
    'enrolment_submitted','state_change','recovery_requested'
  ]
};

export const ANALYTICS_SEGMENTS = ['theatre','location','category','mill','language','memberTenure'];

const BLOCKED_KEYS = /^(token|bearer|authorization|password|secret|otp|phone|email|name|fullName|address|dob|dateOfBirth|aadhaar|pan|accountNumber|upi|staffToken|niaOpsToken|memberId|accountId|subject)$/i;
const BLOCKED_VALUE = /bearer\s+[a-z0-9._\-]+|\+91[6-9]\d{9}|[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i;

export function isKnownEvent(pillar, event) {
  return Boolean(ANALYTICS_EVENTS[pillar]?.includes(event));
}

export function sanitizeAnalyticsValue(value) {
  if (value == null) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (BLOCKED_VALUE.test(value) || value.length > 120) return null;
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 8).map(sanitizeAnalyticsValue).filter(v => v !== null);
  if (typeof value === 'object') return sanitizeAnalyticsPayload(value);
  return null;
}

export function sanitizeAnalyticsPayload(input={}) {
  const out = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (BLOCKED_KEYS.test(key)) continue;
    if (key === 'segments' && value && typeof value === 'object' && !Array.isArray(value)) {
      out.segments = {};
      for (const seg of ANALYTICS_SEGMENTS) {
        if (value[seg] == null) continue;
        const clean = sanitizeAnalyticsValue(value[seg]);
        if (clean !== null) out.segments[seg] = clean;
      }
      continue;
    }
    const clean = sanitizeAnalyticsValue(value);
    if (clean !== null) out[key] = clean;
  }
  return out;
}

export function analyticsEvent(pillar, event, payload={}) {
  if (!isKnownEvent(pillar, event)) return {ok:false, error:'unknown_event'};
  const body = sanitizeAnalyticsPayload(payload);
  return {
    ok: true,
    pillar,
    event,
    at: payload.at || new Date().toISOString(),
    segments: body.segments || {},
    payload: Object.fromEntries(Object.entries(body).filter(([k]) => k !== 'segments' && k !== 'at'))
  };
}
