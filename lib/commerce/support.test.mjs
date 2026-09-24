import test from 'node:test';
import assert from 'node:assert/strict';
import {SUPPORT_KIND_IDS, openSupportIssue, publicSupportIssue, supportRoute} from './support.mjs';

const actor = {id:'mem-1', role:'member'};
const order = {id:'ord-1', memberId:'mem-1', source:'commerce'};

test('known kinds cover Save Live Earn and identity and route to an operating unit', () => {
  assert.deepEqual(SUPPORT_KIND_IDS.sort(), [
    'application_update','identity_access','job_details','late','missing_item','move_in','nest_details','other','quality','return_refund'
  ]);
  assert.equal(supportRoute('missing_item').unit, 'pickup_operator');
  assert.equal(supportRoute('move_in').unit, 'nest_operator');
  assert.equal(supportRoute('application_update').unit, 'walk2work_coordinator');
  assert.equal(supportRoute('identity_access').unit, 'identity_owner');
});

test('Save kinds require an owned order; a request is never an approved refund', () => {
  assert.equal(openSupportIssue({actor, body:{kind:'return_refund'}, time:0, id:'issue-1'}).error, 'order_and_issue_required');
  const {issue} = openSupportIssue({actor, body:{kind:'return_refund', note:'short'}, order, time:Date.parse('2026-09-24T00:00:00Z'), id:'issue-abc'});
  assert.equal(issue.refundApproved, false);
  assert.equal(issue.status, 'open');
  assert.equal(issue.relatedRef, 'ord-1');
  assert.equal(publicSupportIssue(issue).refundApproved, false);
  assert.equal(publicSupportIssue(issue).reference, 'issue-abc');
});

test('Live Earn and identity cases keep the related reference without inventing approval', () => {
  const nest = openSupportIssue({actor, body:{kind:'nest_details', relatedRef:'book-9', note:'wrong floor'}, time:1, id:'issue-n'}).issue;
  assert.equal(nest.unit, 'nest_operator');
  assert.equal(nest.relatedRef, 'book-9');
  const idn = openSupportIssue({actor, body:{kind:'identity_access'}, time:1, id:'issue-i'}).issue;
  assert.equal(idn.unit, 'identity_owner');
  assert.equal(idn.orderId, null);
  assert.equal(openSupportIssue({actor, body:{kind:'not_a_kind'}, time:1, id:'x'}).error, 'issue_kind_required');
});
