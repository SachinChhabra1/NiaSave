import test from 'node:test';
import assert from 'node:assert/strict';
import {partnerListMarkup,partnerConsentMarkup} from '../../commerce-services.js';

const gate={partnerId:'lending-low-cost',kind:'lending',name:'Lower-cost loans',provider:'Example',
  live:true,acceptsReferrals:true,contractId:'contract',connectorId:'connector',
  consentVersion:1,operatorId:'owner',consentScope:['full_name','phone','nia_health_score']};
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;');
test('unverified Central partner never gains a referral control from live flags alone',()=>{
  const context={t:x=>x,esc};
  const missing={...gate,connectorId:null};
  const omitted=partnerListMarkup([missing],[],context);
  assert.doesNotMatch(omitted,/partner-consent|Lower-cost loan pathway/);
  assert.doesNotMatch(partnerConsentMarkup(missing,context),/partner-referral-form/);
  const informational={...gate,partnerId:'payments-pickup-upi',kind:'payments',contractId:null};
  const view=partnerListMarkup([informational],[],context);
  assert.match(view,/Not available yet/);
  assert.doesNotMatch(view,/partner-consent/);
});
test('reviewed gate enables consent while excluding the health score in every member language',async()=>{
  for(const lang of ['en','hi','ta','bn']){
    const dict=lang==='en'?{}:(await import(`../../commerce-locales/${lang}.js`)).default;
    const context={t:key=>dict[key]||key,esc};
    const list=partnerListMarkup([gate],[],context);
    assert.match(list,/data-action="partner-consent"/,lang);
    const form=partnerConsentMarkup(gate,context);
    assert.match(form,/partner-referral-form/,lang);
    assert.doesNotMatch(form,/nia_health_score/,lang);
    assert.match(partnerConsentMarkup({...gate,operatorId:null},context),
      new RegExp(dict['Not available yet']||'Not available yet'),lang);
  }
});
