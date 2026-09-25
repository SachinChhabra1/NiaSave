import test from 'node:test';
import assert from 'node:assert/strict';
import {MEMBER_STATES, membershipSurface, enrolmentPayload} from './membership-state.mjs';

test('authenticated but not ready is catalogue-only before any commitment', () => {
  assert.deepEqual(MEMBER_STATES, ['enrol','wait_for_review','contact_jat_unit','recovery_pending','ready']);
  for (const next of ['enrol','wait_for_review','contact_jat_unit','recovery_pending']) {
    const s = membershipSurface({next});
    assert.equal(s.catalogueOnly, true);
    assert.equal(s.canReserve, false);
    assert.equal(s.canHold, false);
    assert.equal(s.canApply, false);
    assert.equal(s.access, 'member_access_required');
    assert.match(s.nextStep, /Catalogue/);
  }
  const ready = membershipSurface({next:'ready'});
  assert.equal(ready.catalogueOnly, false);
  assert.equal(ready.canApply, true);
});

test('enrolment captures name, language and consent and never accepts uploaded documents', () => {
  const payload = enrolmentPayload({fullName:'  Ram  ', preferredLanguage:'ta', consent:true, documents:['x']}, '+919999999999');
  assert.equal(payload.fullName, 'Ram');
  assert.equal(payload.preferredLanguage, 'ta');
  assert.equal(payload.consent, true);
  assert.equal(payload.documentsUploaded, false);
  assert.equal(payload.phone, '+919999999999');
});

test('surface renders Central audit fields and does not invent a transition', () => {
  const s = membershipSurface({next:'wait_for_review', audit:{reviewer:'jat-1', at:'2026-09-24T00:00:00Z', evidenceReference:'ev-9'}});
  assert.equal(s.audit.reviewer, 'jat-1');
  assert.equal(s.audit.evidenceReference, 'ev-9');
  assert.equal(membershipSurface({next:'mystery'}).next, 'enrol');
});
