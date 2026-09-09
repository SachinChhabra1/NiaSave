export const owner = {active:false, name:''};
const token=()=>sessionStorage.getItem('niaOpsToken')||'';
export const ownerActions=new Set(['live','earn','shop','send','account','category','clear-search','detail','help','close','owner-exit']);
export function ownerControls(root=document) {
  if(!owner.active)return;
  for(const button of root.querySelectorAll('[data-action]')) {
    if(!ownerActions.has(button.dataset.action)) {
      button.disabled=true;
      button.title='Owner view is read only';
    }
  }
}
async function read(path) {
  let response;
  try{response=await fetch('/v1/staff/storefront'+path,{headers:{authorization:'Bearer '+token()},cache:'no-store',signal:AbortSignal.timeout(12000)});}
  catch{throw new Error('The catalogue could not be reached. Please retry.');}
  const result=await response.json();
  if(!response.ok){
    if(response.status===401||response.status===403){owner.active=false;sessionStorage.removeItem('niaOwnerView');throw new Error('Your owner session has expired. Open Owner access to sign in again.');}
    throw new Error('The live catalogue is unavailable. Please retry.');
  }
  return result;
}
export async function ownerRequest(path,body) {
  if(path==='/nests/availability'&&body&&Object.keys(body).length===1&&typeof body.start==='string')return read('/nests?start='+encodeURIComponent(body.start));
  if(body!==undefined||!['/catalogue','/nests','/earn'].includes(path))throw new Error('Owner view is read only. Personal actions require a member account.');
  return read(path);
}
export async function restoreOwner() {
  if(sessionStorage.getItem('niaOwnerView')!=='1')return false;
  const data=await read('/catalogue');
  if(data.ownerView!==true||data.capabilities?.readOnly!==true)throw new Error('Owner access could not be verified.');
  owner.active=true;owner.name=data.owner.name;return true;
}
export async function signInOwner(fields) {
  const response=await fetch('/v1/staff/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:fields.email,password:fields.password}),signal:AbortSignal.timeout(12000)});
  const result=await response.json();
  if(!response.ok)throw new Error('Check your administrator email and password, then try again.');
  if(result.staff?.role!=='admin')throw new Error('This view requires the owner administrator account.');
  sessionStorage.setItem('niaOpsToken',result.token);
  sessionStorage.setItem('niaOwnerView','1');
  await restoreOwner();
}
export function exitOwner(){owner.active=false;owner.name='';sessionStorage.removeItem('niaOwnerView');sessionStorage.removeItem('niaOpsToken');}
export function ownerLoginMarkup(){return `<form id="owner-login-form" class="stack"><p>Use your existing Nia administrator account to view Live, Earn, Save and Send.</p><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><p class="info">Owner view is read only. Personal transactions require a member account.</p><div id="form-error" class="error-inline" role="alert"></div><button type="submit" class="primary">Open owner view</button></form>`;}
export function ownerAccountMarkup(esc){return `<div class="page"><h1>Owner access</h1><section class="panel stack"><h2>${esc(owner.name)}</h2><p>View the published NiaSave catalogue across Live, Earn, Save and Send. Orders, bookings, applications and personal statements require a member account.</p><button class="primary" data-action="live">Explore NiaSave</button><a href="https://rafiqicentral.com/2para">Open business operations</a><button data-action="owner-exit">Sign out of owner view</button></section></div>`;}
export function ownerEarnMarkup(data,error,{esc,money}){return `<div class="page"><div class="service-intro"><div class="eyebrow">EARN · WALK2WORK</div><h1>Work worth leaving home for.</h1><p>Published job offers. Members see opportunities near their verified Nest.</p></div>${error?`<p class="info" role="alert">${esc(error)}</p>`:data.jobs?.length?`<div class="nest-grid">${data.jobs.map(j=>`<article class="panel stack"><span class="eyebrow">${esc(j.city)}</span><h2>${esc(j.title)}</h2><p>${esc(j.employer)}</p><strong>${money(j.payMin)} – ${money(j.payMax)} / ${esc(j.payPeriod)}</strong><p>${esc(j.shift)}</p><p>${esc(j.requirements)}</p><p>${esc(j.terms)}</p><span>${esc(j.openPositions)} open positions</span><button disabled>Applications require member sign in</button></article>`).join('')}</div>`:`<section class="panel stack"><h2>No published jobs available yet</h2><p>Verified, open Walk2Work opportunities will appear here when published.</p></section>`}<p class="info">Owner view · Personal job distances and applications are visible only to the member.</p></div>`;}
export function ownerSendMarkup(){return `<div class="page"><div class="service-intro"><div class="eyebrow">SEND · NIABOOKS</div><h1>More clarity. More for home.</h1><p>NiaBooks brings a member’s income, essentials, housing and monthly plan together.</p></div><section class="panel stack"><h2>NiaBooks & monthly plan</h2><p>Members can follow their own entries and plan what stays with them and what goes home. Personal statements and saved plans are visible only to their member.</p><button disabled>Personal statement</button><button disabled>My plan this month</button></section><section class="panel stack books-transfer"><div class="row"><h2>Send money home</h2><span class="badge">Not active yet</span></div><p>Bank transfers will appear in NiaBooks once the payments-bank integration is connected.</p></section></div>`;}
