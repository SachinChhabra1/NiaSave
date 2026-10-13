import { createHmac, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { CommerceError } from './core.mjs';
import { showcaseReady } from './showcase-mode.mjs';

// NiaSave -> Central reads and member-scoped writes. The member is identified by
// the account id NiaSave verified for this session; Central maps it to the
// canonical member through its own access record. This direction signs with
// its own context, so an envelope captured here never verifies as a
// Central -> NiaSave operator command (which uses 'niasave-central-v1').
export const CENTRAL_SIGNING_CONTEXT='niasave-to-central-v1\n';
export const CENTRAL_SIGNATURE_HEADER='x-niasave-signature';
const PLAN_FIELDS=['incomePaise','essentialsPaise','debtPaise','bufferPaise','otherPaise','homePaise'];
const PHONE_LOOKUP_SUBJECT = 'phone-bootstrap';

// The hosted showcase keeps its own key (SHOWCASE_CENTRAL_KEY), the same rule the
// signed operator gateway follows; the member deployment uses CENTRAL_COMMERCE_KEY.
export const centralKey=(env=process.env)=>(env===process.env?showcaseReady():showcaseReady(env))?env.SHOWCASE_CENTRAL_KEY||'':env.CENTRAL_COMMERCE_KEY||'';
export function centralConfigured(env=process.env){return /^https:\/\//.test(env.CENTRAL_ORIGIN||'')&&centralKey(env).length>=32;}
// Server-only automation access to a protected Central deployment. The target
// project's secret must be pinned separately; never inherit this app's token.
function centralProtectionHeaders(env){
  const secret=env.CENTRAL_PROTECTION_BYPASS_SECRET;
  if(!secret)return {};
  try{
    const target=new URL(env.CENTRAL_ORIGIN),pinned=new URL(env.CENTRAL_PROTECTION_BYPASS_ORIGIN);
    const originOnly=url=>url.protocol==='https:'&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash;
    if(!originOnly(target)||!originOnly(pinned)||target.origin!==pinned.origin||typeof secret!=='string'||! /^[\x21-\x7e]{1,4096}$/.test(secret))throw new Error();
    return {'x-vercel-protection-bypass':secret};
  }catch{throw new CommerceError('central_protection_not_configured',503);}
}
export function signCentralRequest(raw,key){return createHmac('sha256',key).update(CENTRAL_SIGNING_CONTEXT+raw).digest('hex');}
export function buildEnvelope(kind,subject,params={},time=Date.now()){
  if(!/^[a-zA-Z0-9_.:@+|-]{1,200}$/.test(subject||''))throw new CommerceError('sign_in_required',401);
  return {at:time,nonce:randomBytes(18).toString('base64url'),service:'niasave',member:{subject},request:{kind,...params}};
}

function validSubject(value){
  return typeof value==='string'&&/^[a-zA-Z0-9_.:@+|-]{1,200}$/.test(value);
}

const customerId=value=>typeof value==='string'&&/^customer_[a-f0-9]{32}$/.test(value);
function validAccountKind(account,body){
  if(account?.kind==='customer')return customerId(account.id)&&body?.customer?.id===account.id&&body.customer.status==='active'&&body.customer.phoneVerified===true&&Array.isArray(account.locationIds)&&account.locationIds.length===0;
  return account?.kind==null&&!String(account?.id||'').startsWith('customer_');
}

function memberSubjectFromLookup(body){
  const subject = body?.member?.subject ?? body?.subject ?? body?.memberSubject ?? body?.account?.authSubject ?? body?.account?.id;
  return validSubject(subject) ? subject : null;
}

function isRegisteredMember(body){
  if(body?.registered===true||body?.active===true||body?.enrolled===true)return true;
  if(body?.registered===false||body?.active===false||body?.enrolled===false)return false;
  return Boolean(memberSubjectFromLookup(body));
}

export async function centralMemberPhoneLookup(phone,opts={}){
  if(!/^\+91[6-9]\d{9}$/.test(phone||''))throw new CommerceError('invalid_phone');
  const result = await centralMemberRequest('member.lookupByPhone',PHONE_LOOKUP_SUBJECT,{phone},opts);
  if(result.status===200){
    return {registered:isRegisteredMember(result.body),subject:memberSubjectFromLookup(result.body)};
  }
  if(result.status===404&&['member_not_found','member_not_registered','not_found'].includes(String(result.body?.error||''))){
    return {registered:false,subject:null};
  }
  if(result.status===400&&['unknown_operation','unsupported_member_lookup'].includes(String(result.body?.error||''))){
    throw new CommerceError('central_member_lookup_required',503);
  }
  if(result.status===501){
    throw new CommerceError('central_member_lookup_required',503);
  }
  throw new CommerceError('central_member_lookup_unavailable',503);
}

// Only trust the hosting edge's overwritten header, never body/X-Forwarded-For.
export function identityClientIp(req,env=process.env){
  const candidate=(env.VERCEL||env.VERCEL_ENV)
    ? String(req.headers?.['x-vercel-forwarded-for']||'').split(',')[0].trim()
    : req.socket?.remoteAddress;
  return typeof candidate==='string' && isIP(candidate) ? candidate : null;
}

export async function centralIdentityVerifyRequest(phone,opts={}){
  if(!/^\+91[6-9]\d{9}$/.test(phone||''))throw new CommerceError('invalid_phone');
  if(!isIP(opts.clientIp||''))throw new CommerceError('otp_unavailable',503);
  const result=await centralMemberRequest('identity.verify.request',PHONE_LOOKUP_SUBJECT,{phone,channel:'whatsapp',clientIp:opts.clientIp},opts);
  if(result.status===200 && typeof result.body?.challenge==='string' && result.body.challenge.length>0 && result.body.challenge.length<=300){
    return {challenge:result.body.challenge};
  }
  if(result.status===429)throw new CommerceError('too_many_attempts',429);
  throw new CommerceError('otp_unavailable',503);
}

export async function centralIdentityVerifyConfirm(challenge,code,phone,opts={}){
  if(typeof challenge!=='string'||!challenge||challenge.length>300||!/^\d{4,8}$/.test(code||'')||!/^\+91[6-9]\d{9}$/.test(phone||''))throw new CommerceError('bad_otp',401);
  const result=await centralMemberRequest('identity.verify.confirm',PHONE_LOOKUP_SUBJECT,{challenge,code,phone},opts);
  const account=result.body?.account;
  if(result.status===200 && validSubject(account?.id) && account.role==='member' && /^[a-f0-9]{64}$/.test(account.authVersion||'') && validAccountKind(account,result.body)){
    return {accountId:account.id,account:centralOtpAccount(account,phone)};
  }
  if(result.status===429)throw new CommerceError('too_many_attempts',429);
  if(result.status>=500)throw new CommerceError('identity_unavailable',503);
  throw new CommerceError('bad_otp',401);
}

// Central-owned scopes only. Unknown grants never become an implicit S01 grant.
export function centralOtpAccount(account,phone){
  const ids=account.kind==='customer'?[]:Array.isArray(account.locationIds)?account.locationIds.filter(validSubject):[];
  return {id:account.id,authVersion:account.authVersion,authSubject:account.id,role:'member',identitySource:'central-whatsapp',
    ...(account.kind==='customer'?{kind:'customer'}:{}),
    name:typeof account.name==='string'?account.name.slice(0,120):'Nia member',locationIds:ids,
    locationModes:Object.fromEntries(ids.map(id=>[id,Array.isArray(account.locationModes?.[id])?account.locationModes[id].filter(mode=>['pickup','delivery'].includes(mode)):[]])),
    locationPinCodes:Object.fromEntries(ids.filter(id=>/^[1-9]\d{5}$/.test(account.locationPinCodes?.[id]||'')).map(id=>[id,account.locationPinCodes[id]])),
    verifiedPhone:phone,phoneVerified:true,phone};
}

export async function refreshCentralOtpAccount(actor,opts={}){
  if(!/^[a-f0-9]{64}$/.test(actor?.authVersion||'')||!validSubject(actor?.id)||!/^\+91[6-9]\d{9}$/.test(actor?.verifiedPhone||''))throw new CommerceError('sign_in_required',401);
  const result=await centralMemberRequest('member.identity',actor.id,{phone:actor.verifiedPhone,authVersion:actor.authVersion},opts);
  if(result.status>=500)throw new CommerceError('identity_unavailable',503);
  const body=result.body,a=body?.account,m=body?.member;
  const customer=actor.kind==='customer';
  const identityReady=customer?validAccountKind(a,body)&&a?.kind==='customer':validAccountKind(a,body)&&a?.kind==null&&m?.id===actor.id&&m?.kyc==='approved'&&m?.access==='active'&&m?.state==='approved';
  if(result.status!==200||body?.source!=='central'||body?.status!=='ready'||!identityReady||a?.id!==actor.id||a?.role!=='member'||a?.authVersion!==actor.authVersion)throw new CommerceError('sign_in_required',401);
  return centralOtpAccount(a,actor.verifiedPhone);
}

// Validates the member's plan write before it leaves NiaSave. Central re-validates.
export function planWriteRequest(body,idempotencyKey){
  if(typeof idempotencyKey!=='string'||!/^[a-zA-Z0-9_.:-]{8,120}$/.test(idempotencyKey))throw new CommerceError('idempotency_key_required');
  if(!body||typeof body!=='object')throw new CommerceError('invalid_plan');
  if(typeof body.month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month))throw new CommerceError('invalid_plan');
  if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)throw new CommerceError('invalid_plan');
  const source=body.fields;if(!source||typeof source!=='object'||Array.isArray(source))throw new CommerceError('invalid_plan');
  const fields={};
  for(const key of Object.keys(source))if(!PLAN_FIELDS.includes(key))throw new CommerceError('invalid_plan');
  for(const key of PLAN_FIELDS){const value=source[key];if(value===undefined||value===null){fields[key]=null;continue;}if(!Number.isSafeInteger(value)||value<0||value>100000000)throw new CommerceError('invalid_plan');fields[key]=value;}
  return {month:body.month,expectedRevision:body.expectedRevision,fields,idempotencyKey};
}
export async function centralMemberRequest(kind,subject,params={},{fetchImpl=fetch,env=process.env,time=Date.now()}={}){
  if(!centralConfigured(env))throw new CommerceError('central_connection_not_configured',503);
  const raw=JSON.stringify(buildEnvelope(kind,subject,params,time));
  const protection=centralProtectionHeaders(env);
  let response;
  try{response=await fetchImpl(env.CENTRAL_ORIGIN.replace(/\/$/,'')+'/api/service/member',{method:'POST',headers:{'content-type':'application/json',[CENTRAL_SIGNATURE_HEADER]:signCentralRequest(raw,centralKey(env)),...protection},body:raw,signal:AbortSignal.timeout(kind==='identity.verify.request'?30000:8000),redirect:'error'});}
  catch{throw new CommerceError('central_unreachable',503);}
  let body=null;try{body=await response.json();}catch{body=null;}
  if(!body||typeof body!=='object')throw new CommerceError('central_invalid_response',503);
  // Central's answer is authoritative; pass status and body through unchanged so
  // the member sees Central's revision, capabilities and conflicts, never a local guess.
  return {status:response.status,body};
}
// Earn from Central: the member's own Nest and eligible open mandates. Any failure
// is an explicit map.status of unavailable, never an empty "no jobs" list.
export async function earnProjectionFromCentral(actor,opts={}){
  const unavailable=reason=>({preview:false,owner:'Walk2Work',map:{status:'unavailable',asOf:null,revision:null,reason},jobs:[]});
  if(!actor||actor.role!=='member')return unavailable('sign_in_required');
  try{
    const result=await centralMemberRequest('earn.projection',actor.authSubject||actor.id,{},opts);
    if(result.status!==200||!result.body?.projection?.map||!Array.isArray(result.body.projection.jobs))return unavailable(result.body?.error||'central_unavailable');
    return {...result.body.projection,member:result.body.member,source:'central'};
  }catch(e){return unavailable(e instanceof CommerceError?e.message:'central_unreachable');}
}
