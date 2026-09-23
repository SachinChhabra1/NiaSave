import {OWNER_VIEW_ENABLED} from './commerce-capabilities.js';

export const owner = {active:false, name:''};
const token=()=>sessionStorage.getItem('niaOpsToken')||'';
export const ownerActions=new Set(['live','earn','shop','send','account','category','clear-search','detail','help','close','owner-exit']);
const t=(english)=>english;
export const OWNER_BANNER = 'Owner view · Read only · Live catalogue. Personal transactions require a member account.';

export function ownerControls(root=document, translate=t) {
  if(!owner.active)return;
  for(const button of root.querySelectorAll('[data-action]')) {
    if(!ownerActions.has(button.dataset.action)) {
      button.disabled=true;
      button.title=translate('Owner view is read only');
    }
  }
}
function ownerViewOn(){return OWNER_VIEW_ENABLED || (typeof process!=='undefined' && process.env?.NIASAVE_OWNER_VIEW==='1');}
async function read(path) {
  if(!ownerViewOn())throw new Error(t('Owner access is not enabled on this build.'));
  let response;
  try{response=await fetch('/v1/staff/storefront'+path,{headers:{authorization:'Bearer '+token()},cache:'no-store',signal:AbortSignal.timeout(12000)});}
  catch{throw new Error(t('The catalogue could not be reached. Please retry.'));}
  const result=await response.json();
  if(!response.ok){
    if(response.status===401||response.status===403){owner.active=false;sessionStorage.removeItem('niaOwnerView');sessionStorage.removeItem('niaOpsToken');throw new Error(t('Your owner session has expired. Open Owner access to sign in again.'));}
    throw new Error(t('The live catalogue is unavailable. Please retry.'));
  }
  return result;
}
export async function ownerRequest(path,body) {
  if(path==='/nests/availability'&&body&&Object.keys(body).length===1&&typeof body.start==='string')return read('/nests?start='+encodeURIComponent(body.start));
  if(body!==undefined||!['/catalogue','/nests','/earn'].includes(path))throw new Error(t('Owner view is read only. Personal actions require a member account.'));
  return read(path);
}
export async function restoreOwner() {
  if(!ownerViewOn()){exitOwner();return false;}
  if(sessionStorage.getItem('niaOwnerView')!=='1')return false;
  const data=await read('/catalogue');
  if(data.ownerView!==true||data.capabilities?.readOnly!==true)throw new Error(t('Owner access could not be verified.'));
  owner.active=true;owner.name=data.owner.name;return true;
}
export async function signInOwner(fields) {
  if(!ownerViewOn())throw new Error(t('Owner access is not enabled on this build.'));
  const response=await fetch('/v1/staff/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:fields.email,password:fields.password}),signal:AbortSignal.timeout(12000)});
  const result=await response.json();
  if(!response.ok)throw new Error(t('Check your administrator email and password, then try again.'));
  if(result.staff?.role!=='admin')throw new Error(t('This view requires the owner administrator account.'));
  sessionStorage.setItem('niaOpsToken',result.token);
  sessionStorage.setItem('niaOwnerView','1');
  await restoreOwner();
}
export function exitOwner(){owner.active=false;owner.name='';sessionStorage.removeItem('niaOwnerView');sessionStorage.removeItem('niaOpsToken');}
export function ownerLoginMarkup(translate=t){return `<form id="owner-login-form" class="stack"><p>${translate('Use your existing Nia administrator account to view Live, Earn, Save and Send.')}</p><label>${translate('Email')}<input name="email" type="email" autocomplete="username" required></label><label>${translate('Password')}<input name="password" type="password" autocomplete="current-password" required></label><p class="info">${translate('Owner view is read only. Personal transactions require a member account.')}</p><div id="form-error" class="error-inline" role="alert"></div><button type="submit" class="primary">${translate('Open owner view')}</button></form>`;}
export function ownerAccountMarkup(esc, translate=t){return `<div class="page"><h1>${translate('Owner access')}</h1><p class="notice">${translate(OWNER_BANNER)}</p><section class="panel stack"><h2>${esc(owner.name)}</h2><p>${translate('View the published NiaSave catalogue across Live, Earn, Save and Send. Orders, bookings, applications and personal statements require a member account.')}</p><button class="primary" data-action="live">${translate('Explore NiaSave')}</button><a href="https://rafiqicentral.com/2para">${translate('Open business operations')}</a><button data-action="owner-exit">${translate('Sign out of owner view')}</button></section></div>`;}
export function ownerEarnMarkup(data,error,{esc,money,t:translate=t}){return `<div class="page"><p class="notice">${translate(OWNER_BANNER)}</p><div class="service-intro"><div class="eyebrow">${translate('EARN · WALK2WORK')}</div><h1>${translate('Work worth leaving home for.')}</h1><p>${translate('Published job offers. Members see opportunities near their verified Nest.')}</p></div>${error?`<p class="info" role="alert">${esc(error)}</p>`:data.jobs?.length?`<div class="nest-grid">${data.jobs.map(j=>`<article class="panel stack"><span class="eyebrow">${esc(j.city)}</span><h2>${esc(j.title)}</h2><p>${esc(j.employer)}</p><strong>${money(j.payMin)} – ${money(j.payMax)} / ${esc(j.payPeriod)}</strong><p>${esc(j.shift)}</p><p>${esc(j.requirements)}</p><p>${esc(j.terms)}</p><span>${esc(j.openPositions)} ${translate('open positions')}</span><button disabled>${translate('Applications require member sign in')}</button></article>`).join('')}</div>`:`<section class="panel stack"><h2>${translate('No published jobs available yet')}</h2><p>${translate('Verified, open Walk2Work opportunities will appear here when published.')}</p></section>`}<p class="info">${translate('Owner view · Personal job distances and applications are visible only to the member.')}</p></div>`;}
export function ownerSendMarkup(translate=t){return `<div class="page"><p class="notice">${translate(OWNER_BANNER)}</p><div class="service-intro"><div class="eyebrow">${translate('SEND · NIABOOKS')}</div><h1>${translate('More clarity. More for home.')}</h1><p>${translate('NiaBooks brings a member’s income, essentials, housing and monthly plan together.')}</p></div><section class="panel stack"><h2>${translate('NiaBooks & monthly plan')}</h2><p>${translate('Members can follow their own entries and plan what stays with them and what goes home. Personal statements and saved plans are visible only to their member.')}</p><button disabled>${translate('Personal statement')}</button><button disabled>${translate('My plan this month')}</button></section><section class="panel stack books-transfer"><div class="row"><h2>${translate('Send money home')}</h2><span class="badge">${translate('Not active yet')}</span></div><p>${translate('Bank transfers will appear in NiaBooks once the payments-bank integration is connected.')}</p></section></div>`;}
