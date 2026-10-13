import test from 'node:test';
import assert from 'node:assert/strict';
import {ANALYTICS_EVENTS, analyticsEvent, sanitizeAnalyticsPayload, memberAnalyticsPayload} from './analytics.mjs';

test('required Save Live Earn and identity events are named', () => {
  assert.ok(ANALYTICS_EVENTS.save.includes('catalogue_view'));
  assert.ok(ANALYTICS_EVENTS.save.includes('support_request'));
  assert.ok(ANALYTICS_EVENTS.live.includes('hold_confirmation'));
  assert.ok(ANALYTICS_EVENTS.earn.includes('confirmed_joining'));
  assert.ok(ANALYTICS_EVENTS.identity.includes('enrolment_submitted'));
});

test('payloads drop staff bearer, phone, email and other personal fields', () => {
  const clean = sanitizeAnalyticsPayload({
    authorization: 'Bearer abc.def',
    staffToken: 'tok',
    niaOpsToken: 'ops',
    phone: '+919999999999',
    email: 'ram@example.com',
    fullName: 'Ram',
    category: 'ration',
    theatre: 'bengaluru',
    note: 'Bearer leaked-token-value',
    segments: {theatre:'bengaluru', location:'S01', category:'ration', mill:'m1', language:'ta', memberTenure:'new', phone:'+919999999999'}
  });
  assert.equal(clean.authorization, undefined);
  assert.equal(clean.staffToken, undefined);
  assert.equal(clean.phone, undefined);
  assert.equal(clean.email, undefined);
  assert.equal(clean.fullName, undefined);
  assert.equal(clean.note, undefined);
  assert.equal(clean.category, 'ration');
  assert.deepEqual(clean.segments, {theatre:'bengaluru', location:'S01', category:'ration', mill:'m1', language:'ta', memberTenure:'new'});
});

test('unknown events are rejected; known events stay segmentable without raw identity', () => {
  assert.equal(analyticsEvent('save','not_an_event').ok, false);
  const ev = analyticsEvent('identity','state_change',{segments:{language:'hi', memberTenure:'repeat'}, memberId:'mem-secret', next:'wait_for_review'});
  assert.equal(ev.ok, true);
  assert.equal(ev.payload.next, 'wait_for_review');
  assert.equal(ev.segments.language, 'hi');
  assert.equal(ev.payload.memberId, undefined);
});

test('member analytics only exports fixed codes and generates its own timestamp', () => {
  const payload=memberAnalyticsPayload({outcome:'Bearer staff-secret',status:'ready',staffBearerCredential:'secret',at:'Bearer abc.def',segments:{language:'ta',phone:'+919999999999'}},'ta');
  assert.deepEqual(payload,{segments:{language:'ta'},status:'ready'});
  const record=analyticsEvent('earn','projection_status',{...payload,at:'Bearer abc.def'});
  assert.equal(record.ok,true);
  assert.equal(record.payload.staffBearerCredential,undefined);
  assert.notEqual(record.at,'Bearer abc.def');
  assert.equal(memberAnalyticsPayload({outcome:'received',source:'server_status'},'xx').segments.language,'en');
  assert.equal(sanitizeAnalyticsPayload({nested:{staffBearerCredential:'secret',category:'ration'}}).nested.staffBearerCredential,undefined);
});
