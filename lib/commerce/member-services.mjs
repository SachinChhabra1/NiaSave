import {CommerceError} from './core.mjs';

const fail=code=>{throw new CommerceError(code);};
const pick=(body,keys)=>Object.fromEntries(keys.filter(k=>body?.[k]!==undefined).map(k=>[k,body[k]]));
export const memberServiceRoutes={
  'GET /membership':'member.status',
  'POST /membership/enrol':'member.enrol',
  'POST /membership/recovery':'member.recover',
  'GET /partners':'partner.catalogue',
  'GET /partners/referrals':'partner.referrals',
  'POST /partners/referrals':'partner.refer',
  'POST /partners/withdraw':'partner.withdraw',
};
// A client can choose neither the signed subject nor a service kind. Phone
// ownership comes from the identity provider's verified session, not form data.
export function memberServiceParams(kind,actor,body={}){
  if(kind==='member.enrol'||kind==='member.recover'){
    if(!/^\+91[6-9]\d{9}$/.test(actor?.verifiedPhone||''))throw new CommerceError('verified_phone_required',409);
    if(kind==='member.enrol'){
      if(body.consent!==true)fail('consent_required');
      if(typeof body.fullName!=='string'||body.fullName.trim().length<2||body.fullName.length>120)fail('invalid_enrolment');
      if(!['en','hi','ta','kn','mr'].includes(body.preferredLanguage))fail('invalid_enrolment');
      // Identity documents are reviewed in Jat Unit, not collected in this shared storefront.
      return {...pick(body,['fullName','preferredLanguage','consent']),phone:actor.verifiedPhone};
    }
    if(!/^\+91[6-9]\d{9}$/.test(body.oldPhone||'')||body.oldPhone===actor.verifiedPhone)fail('invalid_recovery');
    return {oldPhone:body.oldPhone,newPhone:actor.verifiedPhone,reason:String(body.reason||'').slice(0,300)};
  }
  if(kind==='partner.refer'){
    if(typeof body.partnerId!=='string'||body.partnerId.length>100||body.consent!==true||!Number.isSafeInteger(body.consentVersion)||!Array.isArray(body.fields)||!body.fields.length||body.fields.length>20||body.fields.some(f=>typeof f!=='string'||f.length>100))fail('consent_required');
    return {...pick(body,['partnerId','consent','consentVersion','fields']),purpose:String(body.purpose||'').slice(0,300)};
  }
  if(kind==='partner.withdraw'){
    if(typeof body.referralId!=='string'||body.referralId.length>120)fail('invalid_referral');
    return {referralId:body.referralId};
  }
  return {};
}
