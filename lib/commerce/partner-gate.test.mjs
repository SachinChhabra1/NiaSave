import test from 'node:test';
import assert from 'node:assert/strict';
import {PARTNER_IDS, partnerIsActionable, launchPartnersOrOmit, referralPublic, memberPartnerView} from './partner-gate.mjs';

const live = {
  partnerId:'lending-low-cost',
  kind:'lending',
  name:'Lower-cost loans',
  contractId:'c1',
  connectorId:'conn-1',
  consentVersion:2,
  operatorId:'jat-unit',
  live:true,
  acceptsReferrals:true,
  consentScope:['full_name','phone','nia_health_score']
};

test('four partner ids; a website-only row is not actionable', () => {
  assert.deepEqual(PARTNER_IDS, ['freed-shield','lending-low-cost','payments-pickup-upi','send-bank-transfer']);
  assert.equal(partnerIsActionable({...live, partnerId:'lending-low-cost', contractId:'', website:'https://lender.example'}), false);
  assert.equal(partnerIsActionable(live), true);
});

test('lower-cost loans and harassment support are omitted until the gate passes; health score is not required', () => {
  const closed = launchPartnersOrOmit([
    live,
    {partnerId:'freed-shield', name:'Harassment', website:'https://example'}
  ]);
  assert.deepEqual(closed.omitted, ['freed-shield']);
  assert.equal(closed.partners.some(p=>p.partnerId==='freed-shield'), false);
  assert.ok(memberPartnerView(live).consentScope.includes('phone'));
  assert.equal(memberPartnerView(live).consentScope.includes('nia_health_score'), false);
});

test('referred means delivery happened; withdrawal states what cannot be recalled', () => {
  const open = referralPublic({referralId:'r1', partnerId:'freed-shield', status:'forwarded', referred:false, partnerAcknowledged:false, consentVersion:2, fields:['phone']});
  assert.equal(open.withdrawable, true);
  assert.match(open.cannotRecall, /Nothing has been delivered/);
  const sent = referralPublic({referralId:'r2', partnerId:'freed-shield', status:'forwarded', referred:true, partnerAcknowledged:true});
  assert.equal(sent.referred, true);
  assert.equal(sent.partnerAcknowledged, true);
  assert.match(sent.cannotRecall, /cannot unsend/);
});
