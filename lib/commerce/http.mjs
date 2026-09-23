import {frozenRoute,freezeResponse} from './write-freeze.mjs';
import {ownsMemberRecord} from './member-ownership.mjs';
import { withLivingState as writeLivingState, withLivingRead, createContract, cancelBooking } from '../../bison/engine.mjs';
import * as earn from './earn.mjs';
import * as books from './books.mjs';
import * as central from './central-client.mjs';
import {memberServiceRoutes,memberServiceParams} from './member-services.mjs';
import {presentCentralSave} from './central-save.mjs';
import {readCentralOrders} from './central-orders.mjs';
import * as nests from './nests.mjs';
import { randomBytes } from 'node:crypto';
import { withSaveState as writeSaveState, withSaveRead, SKUS, DUMMY_DATA } from '../../rabbit/engine.mjs';
import { hasDurableStore } from '../runtime-store.mjs';
import * as core from './core.mjs';
import { applyMemberFulfillment, staffOrderView } from './member-fulfillment.mjs';
import {passkeysEnabled,passkeysReady,passkeyActor,preparePasskeys} from './passkeys.mjs';
import {
  passwordAuthEnabled,
  passwordSessionActor,
  setPasswordSessionActor,
  memberPasswordLogin,
  profilePasswordMatches,
  memberSessionCookie,
  passwordCatalogue,
  passwordAuthCapabilities,
  publicBrowseEnabled,
  normalizeMemberPhone,
  memberPasswordProfileKey,
  buildMemberPasswordProfile,
  issueMemberSetupToken,
  memberSetupCookie,
  memberSetupFromRequest,
  publicMemberAccount,
  requireCentralMember
} from './member-password.mjs';
import { showcaseReady } from './showcase-mode.mjs';
import { overlayTestOffers, isTestStudioId } from './studio-bulk.mjs';
import { listActiveTestStudios } from './studio-bulk-store.mjs';
import {
  TEST_MEMBER,
  TEST_ORDER_IDEMPOTENCY_KEY,
  isTestMemberPath,
  verifyTestReadSig,
  testReadSigFromReq,
  testMemberSessionCookie,
  existingTestOrder,
  placeOneTestOrder,
  testMemberReserveKey,
  testOrderProof
} from './test-member.mjs';
import {
  TEST_PHONE_MEMBER,
  isTestMemberPhone,
  isTestLoginPath,
  issueTestPhoneOtp,
  storeTestOtp,
  consumeTestOtp,
  completeTestPhoneLogin,
  proveStaffLogin
} from './test-login.mjs';
import { centralIdentityRecord, testIdentityRecord } from './central-identity.mjs';

export const previewMode = () => showcaseReady() || (process.env.COMMERCE_PREVIEW === '1' && process.env.NODE_ENV !== 'production' && !process.env.VERCEL && !hasDurableStore());
const liveReady = () => process.env.COMMERCE_ENABLED === '1' && !DUMMY_DATA && hasDurableStore() && process.env.STAFF_AUTH_REQUIRED === '1' && (process.env.STAFF_TOKEN_SECRET||'').length >= 32 && Boolean(process.env.STAFF_PASSWORD) && (passkeysReady() || (!passkeysEnabled() && central.centralConfigured()));
/** Signed-in password members can place and persist orders without the identity-OTP provider. */
export const durableOrdersReady = () => passwordAuthEnabled() && process.env.COMMERCE_ENABLED === '1' && !DUMMY_DATA && hasDurableStore();
const cookieName = 'nia_commerce';
const cookieValue = req => String(req.headers.cookie||'').split(';').map(p => p.trim()).find(p => p.startsWith(cookieName+'='))?.slice(cookieName.length+1);
function sessionActor(s,req,time) {
  const passwordActor = !previewMode() && passwordAuthEnabled() ? passwordSessionActor(req,time) : null;
  if(passwordActor)return passwordActor;
  if(passkeysEnabled()&&!previewMode())return passkeyActor(req);
  const key = core.hash(cookieValue(req)||''); const session = s.commerce.sessions[key];
  if (!session || session.expires <= time) return null;
  return s.commerce.accounts[session.accountId] || null;
}
async function identity(action,body) {
  if(action==='request')return central.centralIdentityVerifyRequest(body.phone,{clientIp:body.clientIp});
  if(action==='verify')return central.centralIdentityVerifyConfirm(body.challenge,body.code,body.phone);
  throw new core.CommerceError('identity_verification_failed',401);
}
async function read(req) {
  let length = 0; const chunks = [];
  for await (const chunk of req) { length += chunk.length; if(length > 16384) throw new core.CommerceError('request_too_large',413); chunks.push(chunk); }
  try { const body = JSON.parse(Buffer.concat(chunks).toString()||'{}'); if(!body || Array.isArray(body) || typeof body !== 'object') throw Error(); return body; } catch { throw new core.CommerceError('invalid_json'); }
}
export async function commerceHttp(req,res,path,getStaff) {
  const withSaveState = req.method==='GET' && !path.startsWith('/auth/') && !path.startsWith('/test/') ? withSaveRead : writeSaveState;
  const withLivingState = req.method==='GET' || path==='/nests/availability' ? withLivingRead : writeLivingState;
  const preview = previewMode();
  const hosted = showcaseReady();
  const send = (status,body,headers={}) => { res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}); res.end(JSON.stringify(body)); };
  if(frozenRoute(req.method,'/commerce'+path)){const r=freezeResponse();return send(r.status,r.body);}
  // Member identity is independent of the legacy store administrator password.
  // Central signing, durable attempt limits and real-data mode remain required.
  const accessReady = passwordAuthEnabled()
    ? process.env.COMMERCE_ENABLED === '1' && !DUMMY_DATA
    : passkeysEnabled()
      ? process.env.COMMERCE_ENABLED === '1' && !DUMMY_DATA && hasDurableStore() && passkeysReady()
      : liveReady();
  if (!preview && !accessReady) return send(503,{error:'commerce_not_configured',message:'Member access is not configured.'});
  if(!preview&&path.startsWith('/books')&&process.env.COMMERCE_BOOKS_ENABLED!=='1')return send(503,{error:'books_not_enabled'});
  if (!['GET','POST','PUT'].includes(req.method)) return send(405,{error:'method_not_allowed'});
  if (req.method !== 'GET' && (req.headers.origin !== `https://${req.headers.host}` && !(preview && !hosted && ["http://127.0.0.1:5173", `http://${req.headers.host}`].includes(req.headers.origin)))) return send(403,{error:'same_origin_required'});
  // Showcase visitors can use member journeys, never impersonate an operator.
  if (hosted && (path.startsWith('/staff/') || path === '/nests/config' || path === '/recovery')) return send(403,{error:'central_operations_required'});
  let body;
  try { body = req.method === 'GET' ? {} : await read(req); } catch(e) { return send(e.status||400,{error:e.message}); }
  const time = Date.now();
  if(!preview && passwordAuthEnabled()){
    const currentActor=passwordSessionActor(req,time);
    const labelledTestActor=currentActor?.test===true&&['nia-test-member','nia-test-phone-member'].includes(currentActor.id);
    if(currentActor&&requireCentralMember()&&currentActor.identitySource!=='central-whatsapp'&&!labelledTestActor&&!path.startsWith('/auth/'))return send(401,{error:'sign_in_required'});
    if(currentActor?.identitySource==='central-whatsapp'&&!path.startsWith('/auth/')){
      try{setPasswordSessionActor(req,await central.refreshCentralOtpAccount(currentActor));}
      catch(e){return send(e.status===401?401:503,{error:e.status===401?'sign_in_required':'identity_unavailable'});}
    }
    const otpRequestPath=path==='/auth/request'||path==='/auth/password/request';
    const otpVerifyPath=path==='/auth/verify'||path==='/auth/password/verify';
    const setPasswordPath=path==='/auth/set-password'||path==='/auth/password'||path==='/auth/password/set';
    if(otpRequestPath||otpVerifyPath||setPasswordPath){
      if(req.method!=='POST')return send(405,{error:'method_not_allowed'});
      if(otpRequestPath||otpVerifyPath){
        const phone=normalizeMemberPhone(body.phone);
        if(!phone)return send(400,{error:'invalid_phone'});
        if(isTestMemberPhone(phone)){
          if(otpRequestPath){
            const issued=issueTestPhoneOtp(phone,time);
            const stored=await withSaveState(s=>{
              core.initialise(s,SKUS,preview,time);
              if(!preview&&s.dummy!==false)return {status:503,body:{error:'preview_data_cannot_go_live'}};
              const ok=core.rateLimit(s,'password-bootstrap-ip:'+req.socket?.remoteAddress,time,60)&&core.rateLimit(s,'password-bootstrap-phone:'+phone,time,8);
              if(!ok)return {status:429,body:{error:'too_many_attempts'}};
              storeTestOtp(s,phone,issued);
              return {status:200,body:{challenge:issued.challenge}};
            });
            if(stored.status>=400)return send(stored.status,stored.body);
            return send(200,{challenge:stored.body.challenge,next:'verify_otp',memberAuth:'password',test:true,sms:false});
          }
          if(typeof body.challenge!=='string'||!/^\d{4,8}$/.test(body.code||''))return send(400,{error:'bad_otp'});
          const checked=await withSaveState(s=>{
            core.initialise(s,SKUS,preview,time);
            if(!preview&&s.dummy!==false)return {status:503,body:{error:'preview_data_cannot_go_live'}};
            const ok=core.rateLimit(s,'password-bootstrap-ip:'+req.socket?.remoteAddress,time,60)&&core.rateLimit(s,'password-bootstrap-phone:'+phone,time,8);
            if(!ok)return {status:429,body:{error:'too_many_attempts'}};
            if(!consumeTestOtp(s,phone,body.challenge,body.code,time))return {status:401,body:{error:'bad_otp'}};
            return {status:200,body:{ok:true}};
          });
          if(checked.status>=400)return send(checked.status,checked.body);
          let setupToken;
          try{setupToken=issueMemberSetupToken(phone,TEST_PHONE_MEMBER.id,time);}
          catch{return send(503,{error:'member_setup_not_configured'});}
          return send(200,{ok:true,next:'set_password',memberAuth:'password',test:true},{'set-cookie':memberSetupCookie(setupToken)});
        }
        const gate=await withSaveState(s=>{
          core.initialise(s,SKUS,preview,time);
          if(!preview&&s.dummy!==false)return {status:503,body:{error:'preview_data_cannot_go_live'}};
          const ok=core.rateLimit(s,'password-bootstrap-ip:'+req.socket?.remoteAddress,time,60)&&core.rateLimit(s,'password-bootstrap-phone:'+phone,time,8);
          return {status:200,body:{ok}};
        });
        if(gate.status>=400)return send(gate.status,gate.body);
        if(!gate.body.ok)return send(429,{error:'too_many_attempts'});
        // Central alone determines eligibility. A public pre-lookup leaks roster membership.
        if(otpRequestPath){
          let result;
          try{result=await identity('request',{phone,clientIp:central.identityClientIp(req)});}
          catch(e){return send(e.status===429?429:503,{error:e.status===429?'too_many_attempts':'otp_unavailable'});}
          if(typeof result.challenge!=='string'||result.challenge.length>300)return send(503,{error:'otp_unavailable'});
          return send(200,{challenge:result.challenge,next:'verify_otp',memberAuth:'password'});
        }
        if(typeof body.challenge!=='string'||!/^\d{4,8}$/.test(body.code||''))return send(400,{error:'bad_otp'});
        let confirmed;
        try{confirmed=await identity('verify',{challenge:body.challenge,code:body.code,phone});}
        catch(e){const status=e.status===429?429:e.status===503?503:401;return send(status,{error:status===429?'too_many_attempts':status===503?'identity_unavailable':'bad_otp'});}
        const subject=confirmed?.accountId;
        if(!subject)return send(401,{error:'bad_otp'});
        let setupToken;
        try{setupToken=issueMemberSetupToken(phone,subject,time,process.env,confirmed.account);}
        catch{return send(503,{error:'member_setup_not_configured'});}
        return send(200,{ok:true,next:'set_password',memberAuth:'password'},{'set-cookie':memberSetupCookie(setupToken)});
      }
      let setup=memberSetupFromRequest(req,time);
      if(!setup)return send(401,{error:'setup_expired'});
      if(setup.identitySource==='central-whatsapp'){
        try{const refreshed=await central.refreshCentralOtpAccount({id:setup.subject,verifiedPhone:setup.phone,authVersion:setup.authVersion});setup={...setup,...refreshed,subject:refreshed.id,phone:setup.phone};}
        catch(e){return send(e.status===401?401:503,{error:e.status===401?'setup_expired':'identity_unavailable'});}
      }
      if(typeof body.password!=='string'||body.password.length<8||body.password.length>120)return send(400,{error:'weak_password'});
      if(body.phone&&normalizeMemberPhone(body.phone)!==setup.phone)return send(400,{error:'invalid_phone'});
      let profile;
      try{profile=buildMemberPasswordProfile(setup.phone,body.password,{subject:setup.subject,...(Array.isArray(setup.locationIds)?{locationIds:setup.locationIds,name:setup.name,identitySource:setup.identitySource,authVersion:setup.authVersion,locationModes:setup.locationModes,locationPinCodes:setup.locationPinCodes}:{})},time);}
      catch(e){
        if(e?.message==='invalid_phone')return send(400,{error:'invalid_phone'});
        if(e?.message==='invalid_password')return send(400,{error:'weak_password'});
        return send(503,{error:'member_password_not_configured'});
      }
      const profileKey=memberPasswordProfileKey(setup.phone);
      if(!profileKey)return send(503,{error:'member_password_not_configured'});
      const write=await withSaveState(s=>{
        core.initialise(s,SKUS,preview,time);
        if(!preview&&s.dummy!==false)return {status:503,body:{error:'preview_data_cannot_go_live'}};
        s.commerce.memberPasswords ||= {};
        s.commerce.memberPasswords[profileKey]=profile;
        return {status:200,body:{profile}};
      });
      if(write.status>=400)return send(write.status,write.body);
      const login=memberPasswordLogin({phone:setup.phone,password:body.password,remember:body.remember},req,time,process.env,profile);
      if(login.status!==200)return send(login.status,login.body,{'set-cookie':memberSetupCookie('')});
      return send(200,login.body,{'set-cookie':[login.headers['set-cookie'],memberSetupCookie('')]});
    }
    if(req.method==='POST' && path==='/auth/login'){
      let profile=null;
      const phone=normalizeMemberPhone(body.phone);
      if(phone){
        const lookup=await withSaveState(s=>{
          core.initialise(s,SKUS,preview,time);
          if(!preview&&s.dummy!==false)return {status:503,body:{error:'preview_data_cannot_go_live'}};
          const key=memberPasswordProfileKey(phone);
          return {status:200,body:{profile:key?(s.commerce.memberPasswords||{})[key]||null:null}};
        });
        if(lookup.status>=400)return send(lookup.status,lookup.body);
        profile=lookup.body.profile;
      }
      if(profile?.identitySource==='central-whatsapp'&&profilePasswordMatches(phone,body.password,profile)){
        try{const refreshed=await central.refreshCentralOtpAccount({id:profile.subject,verifiedPhone:phone,authVersion:profile.authVersion});profile={...profile,...refreshed,subject:refreshed.id};}
        catch(e){return send(e.status===401?401:503,{error:e.status===401?'invalid_password':'identity_unavailable'});}
      }
      const result=memberPasswordLogin(body,req,time,process.env,profile);
      return send(result.status,result.body,result.headers||{});
    }
    if(req.method==='POST' && path==='/auth/logout')return send(200,{ok:true},{'set-cookie':memberSessionCookie('')});
    const passwordActor=passwordSessionActor(req,time);
    if(!passwordActor){
      if(req.method==='GET' && (isTestMemberPath(path) || isTestLoginPath(path))){
        // TEST auto-session / phone login / staff prove. Real members still 401 below.
      }else if(req.method==='GET' && path==='/catalogue'){
        if(!publicBrowseEnabled()) return send(200,passwordCatalogue(null));
        // Guest browse uses the persisted TEST lane + catalogue connector overlay.
        if(durableOrdersReady()){
          try{
            const live=await withSaveState(s=>{
              core.initialise(s,SKUS,preview,time);
              applyMemberFulfillment(s,time,SKUS);
              if(s.dummy!==false && s.commerce?.config?.testLane!==true)return {status:503,body:{error:'preview_data_cannot_go_live'}};
              const cat=core.catalogue(s,SKUS,preview,time);
              return {status:200,body:{...passwordCatalogue(null),...cat,account:null,paymentsEnabled:false,preview:false}};
            });
            return send(live.status,live.body);
          }catch{}
        }
        return send(200,passwordCatalogue(null));
      }else{
        if(path.startsWith('/auth/'))return send(404,{error:'use_password_access'});
        if(!path.startsWith('/staff/'))return send(401,{error:'sign_in_required'});
      }
    }
  }else if(!preview && passkeysEnabled()){
    try{
      const result=await preparePasskeys(req,path,body,{allowAttempt:async()=>{
        const limit=await withSaveState(s=>{core.initialise(s,SKUS,false,time);return {status:200,body:{ok:s.dummy===false&&core.rateLimit(s,'passkey:'+req.socket?.remoteAddress,time,20)}};});
        return limit.status===200&&limit.body.ok;
      }});
      if(result)return send(result.status,result.body,result.headers||{});
    }catch(e){return send(e instanceof core.CommerceError?e.status:503,{error:e instanceof core.CommerceError?e.message:'passkey_unavailable'});}
  }
  // Public sign-in bootstrap and passkey ceremonies have already returned.
  // Password members with a durable store skip the identity-OTP liveReady gate.
  const passwordActorNow = !preview && passwordAuthEnabled() ? passwordSessionActor(req,time) : null;
  if (!preview && !liveReady() && !(durableOrdersReady() && (passwordActorNow || path.startsWith('/staff/') || isTestMemberPath(path) || isTestLoginPath(path)))) return send(503,{error:'commerce_not_configured',message:'Ordering is not open yet.'});
  // Central owns Save reads. Authentication above remains the existing member session.
  // No local commerce book is opened or normalised for this projection.
  if(!preview && req.method==='GET' && path==='/catalogue'){
    try{
      const session=await withSaveRead(s=>({status:200,body:{actor:sessionActor(s,req,time)}}));
      const actor=session.body?.actor;
      if(!actor)return send(401,{error:'sign_in_required'});
      if(actor.role!=='member')return send(403,{error:'member_access_required'});
      const subject=actor.authSubject||actor.id;
      const locations=await central.centralMemberRequest('save.locations',subject);
      if(locations.status!==200)return send(locations.status,locations.body);
      let catalogue=null;
      if(Array.isArray(locations.body?.locations)&&locations.body.locations.length===1){
        const siteCode=locations.body.locations[0]?.siteCode;
        if(typeof siteCode==='string'&&siteCode){
          const result=await central.centralMemberRequest('save.catalogue',subject,{siteCode});
          if(result.status!==200)return send(result.status,result.body);
          catalogue=result.body;
        }
      }
      const view=presentCentralSave(locations.body,catalogue,time);
      return send(200,{...view,memberAuth:passwordAuthEnabled()?'password':passkeysEnabled()?'passkey':'legacy',
        account:publicMemberAccount(actor)});
    }catch(e){return send(e instanceof core.CommerceError?e.status:503,
      {error:e instanceof core.CommerceError?e.message:'central_save_unavailable'});}
  }
  if(!preview && req.method==='GET' && (path==='/orders'||path.startsWith('/orders/'))){
    try{
      const session=await withSaveRead(s=>({status:200,body:{actor:sessionActor(s,req,time)}}));
      const actor=session.body?.actor;
      if(!actor)return send(401,{error:'sign_in_required'});
      if(actor.role!=='member')return send(403,{error:'member_access_required'});
      const response=await readCentralOrders(central,actor.authSubject||actor.id);
      if(response.status!==200)return send(response.status,response.body);
      if(path==='/orders')return send(200,response.body);
      const id=path.slice('/orders/'.length);
      const order=response.body.orders.find(row=>row.id===id);
      return order?send(200,order):send(404,{error:'order_not_found'});
    }catch(e){return send(e instanceof core.CommerceError?e.status:503,
      {error:e instanceof core.CommerceError?e.message:'central_orders_unavailable'});}
  }
  if (path==='/membership'||path.startsWith('/membership/')||path==='/partners'||path.startsWith('/partners/')) {
    const kind=memberServiceRoutes[req.method+' '+path];
    if(!kind)return send(405,{error:'method_not_allowed'});
    try{
      const auth=await withSaveState(s=>{
        core.initialise(s,SKUS,preview,time);
        if(!preview&&s.dummy!==false)throw new core.CommerceError('preview_data_cannot_go_live',503);
        const actor=sessionActor(s,req,time);
        return {status:200,body:{actor,allowed:req.method==='GET'||core.rateLimit(s,'member-services:'+(actor?.id||req.socket?.remoteAddress),time,20)}};
      });
      if(auth.status>=400)return send(auth.status,auth.body);
      const {actor,allowed}=auth.body;
      if(!actor)return send(401,{error:'sign_in_required'});
      if(actor.role!=='member')return send(403,{error:'member_access_required'});
      if(!allowed)return send(429,{error:'too_many_attempts'});
      const result=await central.centralMemberRequest(kind,actor.authSubject||actor.id,memberServiceParams(kind,actor,body));
      if(kind==='member.status'&&result.status===200)result.body.canSubmitIdentity=Boolean(actor.verifiedPhone);
      return send(result.status,result.body);
    }catch(e){return send(e instanceof core.CommerceError?e.status:503,{error:e instanceof core.CommerceError?e.message:'central_unreachable'});}
  }
  if(req.method==='GET'&&path==='/books'){
    try{
      const snapshot=await withSaveState(s=>{core.initialise(s,SKUS,preview,time);if(!preview&&s.dummy!==false)throw new core.CommerceError('preview_data_cannot_go_live',503);const actor=sessionActor(s,req,time);return {status:200,body:{actor,data:books.ownBooks(s,actor,preview,time)}};});
      if(snapshot.status!==200)return send(snapshot.status,snapshot.body);
      let rows=[],liveAvailable=true;
      try{const live=await withLivingState(s=>({status:200,body:{entries:books.livingEntries(s,snapshot.body.actor,preview)}}));if(live.status!==200)liveAvailable=false;else rows=live.body.entries;}catch{liveAvailable=false;}
      const result=books.mergeBooks(snapshot.body.data,rows,time);result.liveAvailable=liveAvailable;
      if(!liveAvailable)result.score={status:'unavailable',value:null,reason:'history_incomplete'};
      return send(200,result);
    }catch(e){return send(e instanceof core.CommerceError?e.status:503,{error:e instanceof core.CommerceError?e.message:'books_unavailable'});}
  }
  // My plan this month: Central owns one plan per member and month. Authenticate
  // the member in Save state, then call Central outside any replayable callback.
  if (path === '/books/plan') {
    if (!['GET','PUT'].includes(req.method)) return send(405,{error:'method_not_allowed'});
    try {
      const auth = await withSaveState(s => {
        core.initialise(s,SKUS,preview,time);
        if (!preview && s.dummy !== false) return {status:503,body:{error:'preview_data_cannot_go_live'}};
        const actor = sessionActor(s,req,time);
        const allowed = req.method === 'GET' || core.rateLimit(s,'plan:'+(actor?.id||req.socket?.remoteAddress),time,30);
        return {status:200,body:{actor,allowed}};
      });
      if(auth.status>=400)return send(auth.status,auth.body);
      const actor=auth.body.actor;
      if(!actor)return send(401,{error:'sign_in_required'});
      if(actor.role!=='member')return send(403,{error:'member_access_required'});
      if(!auth.body.allowed)return send(429,{error:'too_many_attempts'});
      const month=new URL(req.url,'http://localhost').searchParams.get('month');
      const result=req.method==='GET'
        ? await central.centralMemberRequest('plan.read',actor.authSubject||actor.id,month?{month}:{})
        : await central.centralMemberRequest('plan.write',actor.authSubject||actor.id,central.planWriteRequest(body,req.headers['idempotency-key']));
      return send(result.status,result.body);
    } catch(e) {return send(e instanceof core.CommerceError?e.status:503,{error:e instanceof core.CommerceError?e.message:'plan_unavailable'});}
  }
  // Switch the complete Earn journey together: mandates, applications and status.
  // Hosted showcase is allowed explicitly; local demo and legacy history remain intact.
  if (process.env.EARN_SOURCE==='central' && ['/earn','/earn/applications'].includes(path)) {
    try {
      if (!['GET','POST'].includes(req.method) || (path==='/earn' && req.method!=='GET'))return send(405,{error:'method_not_allowed'});
      const auth=await withSaveState(s=>{
        core.initialise(s,SKUS,preview,time);
        if(!preview&&s.dummy!==false)return {status:503,body:{error:'preview_data_cannot_go_live'}};
        const actor=sessionActor(s,req,time);
        return {status:200,body:{actor,allowed:req.method==='GET'||core.rateLimit(s,'earn:'+(actor?.id||req.socket?.remoteAddress),time,30),legacy:actor?.role==='member'?earn.ownApplications(s,actor).applications:[]}};
      });
      if(auth.status>=400)return send(auth.status,auth.body);
      const actor=auth.body.actor;
      if(!actor)return send(401,{error:'sign_in_required'});
      if(actor.role!=='member')return send(403,{error:'member_access_required'});
      if(!auth.body.allowed)return send(429,{error:'too_many_attempts'});
      if(path==='/earn')return send(200,await central.earnProjectionFromCentral(actor));
      if(req.method==='POST' && (body.consent!==true || typeof body.jobId!=='string' || typeof body.revision!=='string'))return send(400,{error:'invalid_application'});
      const result=await central.centralMemberRequest(req.method==='GET'?'earn.applications':'earn.apply',actor.authSubject||actor.id,req.method==='GET'?{}:{jobId:body.jobId,revision:body.revision,consent:body.consent,idempotencyKey:req.headers['idempotency-key']});
      // Preserve previous applications as history; all new writes go only to Central.
      if(req.method==='GET'&&result.status===200)result.body.applications=[...result.body.applications,...auth.body.legacy.filter(a=>!result.body.applications.some(b=>b.id===a.id)).map(a=>({...a,historical:true}))];
      return send(result.status,result.body);
    }catch(e){return send(e instanceof core.CommerceError?e.status:503,{error:e instanceof core.CommerceError?e.message:'earn_unavailable'});}
  }
  // Authenticate in Save, then write only the canonical Living book. Never nest a
  // Living mutation inside Save's replayable CAS callback.
  if (path.startsWith('/nests')) {
    try {
      const auth = await withSaveState(s => {
        core.initialise(s,SKUS,preview,time);
        if (!preview && s.dummy !== false) return {status:503,body:{error:'preview_data_cannot_go_live'}};
        const actor = sessionActor(s,req,time);
        const allowed = req.method === 'GET' || core.rateLimit(s,'nests:'+(actor?.id||req.socket?.remoteAddress),time,80);
        return {status:200,body:{actor,allowed}};
      });
      if(auth.status>=400)return send(auth.status,auth.body);
      if(!auth.body.allowed)return send(429,{error:'too_many_attempts'});
      const actor=auth.body.actor;
      const result=await withLivingState(async s=>{
        if(!preview&&s.dummy!==false)return {status:503,body:{error:'preview_data_cannot_go_live'}};
        const out=(body,status=200)=>({status,body});
        const catalogue=(start)=> {
          const cat=nests.nestCatalogue(s,preview,time,start);
          return preview ? overlayTestOffers(cat, listActiveTestStudios()) : cat;
        };
        if(req.method==='GET'&&path==='/nests')return out(catalogue());
        if(req.method==='POST'&&path==='/nests/availability')return out(catalogue(body.start));
        if(req.method==='POST'&&path==='/nests/quote'){
          if(isTestStudioId(body.studioId))return out({error:'test_studio_not_reservable'},409);
          return out(nests.nestQuote(s,actor,body,preview,time));
        }
        if(req.method==='GET'&&path==='/nests/bookings')return out(nests.ownNests(s,actor,time));
        if(req.method==='POST'&&path==='/nests/bookings'){
          if(isTestStudioId(body.studioId))return out({error:'test_studio_not_reservable'},409);
          return out(nests.reserveNest(s,actor,body,req.headers['idempotency-key'],preview,time,createContract),201);
        }
        if(req.method==='POST'&&path==='/nests/cancel')return out(nests.cancelNest(s,actor,body,time,cancelBooking));
        if(req.method==='PUT'&&path==='/nests/config')return out(nests.configureNests(s,body,await getStaff(req),time));
        return out({error:'not_found'},404);
      });
      return send(result.status,result.body);
    } catch(e) {return send(e instanceof core.CommerceError?e.status:503,{error:e instanceof core.CommerceError?e.message:'service_unavailable'});}
  }
  let providerResult;
  // Consume a rate-limit slot durably before calling a single-use external provider.
  // A CAS retry must never send a second SMS or verify the same code twice.
  if (!preview && !passkeysEnabled() && req.method === 'POST' && ['/auth/request','/auth/verify'].includes(path)) {
    const allowed = await withSaveState(s => {
      core.initialise(s,SKUS,false,time);
      const ok = s.dummy === false && core.rateLimit(s,'identity-source:'+req.socket?.remoteAddress,time,100) && core.rateLimit(s,path+':'+String(body.phone||body.challenge),time,8);
      return {status:200,body:{ok}};
    });
    if (allowed.status >= 400) return send(allowed.status,allowed.body);
    if (!allowed.body.ok) return send(429,{error:'too_many_attempts'});
    if (path === '/auth/request' && !/^\+91[6-9]\d{9}$/.test(body.phone||'')) return send(400,{error:'invalid_phone'});
    if (path === '/auth/verify' && (typeof body.challenge !== 'string' || !/^\d{4,8}$/.test(body.code||''))) return send(400,{error:'invalid_code'});
    try { providerResult = await identity(path === '/auth/request'?'request':'verify',path === '/auth/request'?{phone:body.phone,clientIp:central.identityClientIp(req)}:{challenge:body.challenge,code:body.code,phone:normalizeMemberPhone(body.phone)}); }
    catch { return send(401,{error:'identity_verification_failed'}); }
  }
  if (req.method==='GET' && (path==='/test/staff/login' || path==='/test/staff/prove')) {
    const proof = await proveStaffLogin();
    return send(proof.status, proof.body, proof.headers || {});
  }
  if (req.method==='GET' && path==='/test/identity') {
    return send(200, { ...testIdentityRecord(), paymentsEnabled: false, copiedToNeon: false, via: 'GET /api/commerce/identity' });
  }
  // Central-owned {member, studio, JCO}. Authenticate in Save, then read
  // Central outside any replayable callback. Never copy the record into Neon.
  if (path === '/identity') {
    if (req.method !== 'GET') return send(405, { error: 'method_not_allowed' });
    try {
      const auth = await withSaveState(s => {
        core.initialise(s, SKUS, preview, time);
        if (!preview && s.dummy !== false) return { status: 503, body: { error: 'preview_data_cannot_go_live' } };
        return { status: 200, body: { actor: sessionActor(s, req, time) } };
      });
      if (auth.status >= 400) return send(auth.status, auth.body);
      const actor = auth.body.actor;
      if (!actor) return send(401, { error: 'sign_in_required' });
      if (actor.role !== 'member') return send(403, { error: 'member_access_required' });
      return send(200, await centralIdentityRecord(actor));
    } catch (e) {
      return send(e instanceof core.CommerceError ? e.status : 503, { error: e instanceof core.CommerceError ? e.message : 'identity_unavailable' });
    }
  }
  try {
    const result = await withSaveState(async s => {
      core.initialise(s,SKUS,preview,time);
      if (!preview) applyMemberFulfillment(s, time, SKUS);
      if (!preview && s.dummy !== false && s.commerce?.config?.testLane !== true) return {status:200,body:{status:503,body:{error:'preview_data_cannot_go_live'}}};
      core.expire(s,time);
      const c=s.commerce; c.issues ||= []; const actor=sessionActor(s,req,time);
      const out = (body,status=200,headers={}) => ({status:200,body:{body,status,headers}});
      try {
        if(req.method === 'GET' && (isTestMemberPath(path) || isTestLoginPath(path))) {
          if(!preview && !durableOrdersReady()) return out({error:'commerce_not_configured'},503);
          if(path === '/test/session') {
            c.accounts[TEST_MEMBER.id] = { ...TEST_MEMBER };
            return out({account:{id:TEST_MEMBER.id,name:TEST_MEMBER.name,role:'member',locationIds:TEST_MEMBER.locationIds,test:true},test:true},200,{'set-cookie':testMemberSessionCookie(time)});
          }
          if(path === '/test/place-one') {
            const placed = placeOneTestOrder(s,time,SKUS,preview);
            return out(testOrderProof(s,placed.order,req),placed.created?201:200,{'set-cookie':testMemberSessionCookie(time)});
          }
          if(path === '/test/member-login') {
            const done = completeTestPhoneLogin(s,req,time);
            return out(done.body, done.status, done.headers || {});
          }
          if(/^\/test\/proof\/ord-[a-zA-Z0-9-]+$/.test(path)) {
            const id = path.slice('/test/proof/'.length);
            const o = s.orders.find(row=>row.id===id && row.source==='commerce' && row.test===true);
            if(!o) return out({error:'order_not_found'},404);
            return out(testOrderProof(s,o,req));
          }
          const id = path.slice('/test/orders/'.length);
          if(!verifyTestReadSig(id,testReadSigFromReq(req))) return out({error:'invalid_test_read'},401);
          const o = s.orders.find(row=>row.id===id && row.source==='commerce' && row.test===true);
          if(!o) return out({error:'order_not_found'},404);
          return out(testOrderProof(s,o,req));
        }
        if(req.method === 'POST' && path === '/books/entries'){if(!core.rateLimit(s,'books-entry:'+(actor?.id||req.socket?.remoteAddress),time,60))return out({error:'too_many_attempts'},429);return out(books.writePersonalEntry(s,actor,body,req.headers['idempotency-key'],time));}
        if(req.method === 'POST' && path === '/books/consent') return out(books.booksConsent(s,actor,body,time));
        if(req.method === 'GET' && path === '/earn') return out(earn.jobs(s,preview,time,actor));
        if(req.method === 'GET' && path === '/earn/applications') return out(earn.ownApplications(s,actor));
        if(req.method === 'POST' && path === '/earn/applications') {
          if(!core.rateLimit(s,'earn:'+(actor?.id||req.socket?.remoteAddress),time,30))return out({error:'too_many_attempts'},429);
          return out(earn.applyForJob(s,actor,body,req.headers['idempotency-key'],preview,time),201);
        }
        if(req.method === 'GET' && path === '/catalogue') return out({...core.catalogue(s,SKUS,preview,time),paymentsEnabled:false,memberAuth:!preview&&passwordAuthEnabled()?'password':!preview&&passkeysEnabled()?'passkey':'legacy',...(!preview&&passwordAuthEnabled()?{memberAuthCapabilities:passwordAuthCapabilities()}:{}),account:publicMemberAccount(actor)});
        if(req.method === 'POST' && ['/auth/preview','/recovery'].includes(path)) {
          if(!core.rateLimit(s,'source:'+req.socket?.remoteAddress,time,100) || !core.rateLimit(s,path+':'+String(body.phone||body.challenge||'preview'),time,8)) return out({error:'too_many_attempts'},429);
        }
        if(req.method === 'POST' && path === '/auth/request') {
          if(preview) return out({error:'use_preview_access'},409);
          if(!/^\+91[6-9]\d{9}$/.test(body.phone||'')) return out({error:'invalid_phone'},400);
          const result = providerResult;
          // Provider must return an opaque challenge, never expose roster membership here.
          if(typeof result.challenge !== 'string' || result.challenge.length > 300) return out({error:'identity_unavailable'},503);
          return out({challenge:result.challenge,message:'If this number has access, a code will arrive.'});
        }
        if(req.method === 'POST' && ['/auth/verify','/auth/preview'].includes(path)) {
          let account;
          if(path === '/auth/preview') {
            if(!preview) return out({error:'not_found'},404);
            const role = !hosted && ['member','enterprise','investor'].includes(body.role) ? body.role : 'member';
            account={id:'preview-'+role,name:role==='member'?'Preview member':'Preview '+role,role,locationIds:['S01']};
          } else {
            if(preview || typeof body.challenge !== 'string' || !/^\d{4,8}$/.test(body.code||'')) return out({error:'invalid_code'},400);
            account = providerResult.account;
            if(!account || !/^[a-zA-Z0-9_-]{1,100}$/.test(account.id) || !['member','enterprise','investor'].includes(account.role) || !Array.isArray(account.locationIds)) return out({error:'access_not_granted'},403);
            account = {id:account.id,name:String(account.name||'Nia member').slice(0,80),role:account.role,locationIds:account.locationIds.filter(id => /^S\d{2}$/.test(id)),
              ...(account.phoneVerified===true&&/^\+91[6-9]\d{9}$/.test(account.phone||'')?{verifiedPhone:account.phone}:{}),
              locationPinCodes:Object.fromEntries(Object.entries(account.locationPinCodes||{}).filter(([id,pin])=>account.locationIds.includes(id)&&typeof pin==='string'&&/^[1-9]\d{5}$/.test(pin)))};
          }
          c.accounts[account.id]=account;
          const token=randomBytes(32).toString('hex'); c.sessions[core.hash(token)]={accountId:account.id,expires:time+43200000};
          return out({account:{id:account.id,name:account.name,role:account.role,locationIds:account.locationIds}},200,{'set-cookie':`${cookieName}=${token}; Path=/api/commerce; HttpOnly; SameSite=Strict; Max-Age=43200${preview&&!hosted?'':'; Secure'}`});
        }
        if(req.method === 'POST' && path === '/auth/logout') {
          delete c.sessions[core.hash(cookieValue(req)||'')];
          return out({ok:true},200,{'set-cookie':`${cookieName}=; Path=/api/commerce; HttpOnly; SameSite=Strict; Max-Age=0${preview&&!hosted?'':'; Secure'}`});
        }
        if(req.method === 'POST' && path === '/recovery') {
          if(!/^\+91[6-9]\d{9}$/.test(body.newPhone||'') || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.memberId||'')) return out({error:'member_id_and_new_phone_required'},400);
          const ticket={id:'help-'+randomBytes(6).toString('hex'),memberId:body.memberId,newPhone:body.newPhone,status:'open',createdAt:new Date(time).toISOString()};
          c.tickets.push(ticket);
          return out({id:ticket.id,message:'Bring this reference and your member ID to the Nia team. Your account has not changed.'},201);
        }
        if(path.startsWith('/staff/')) {
          const staff = preview ? {id:'preview-operator',role:'admin',staff:true} : await getStaff(req);
          if(!staff || (!preview && !staff.desks?.some(d => ['studio','hub','money','pilot'].includes(d)))) return out({error:'staff_access_required'},403);
          staff.staff=true;
          const assigned = preview || staff.role==='admin' ? null : (Object.hasOwn(c.config?.staffLocations||{},staff.id)?c.config.staffLocations[staff.id]:[]);
          const visibleOrders=s.orders.filter(o=>o.source==='commerce' && (!assigned || assigned.includes(o.stopId)));
          const visibleIds=new Set(visibleOrders.map(o=>o.id));
          if(req.method === 'GET' && path === '/staff/state') return out({preview,paymentsEnabled:false,orders:visibleOrders.slice(-200).reverse().map(staffOrderView),tickets:staff.role==='admin'?c.tickets.filter(t => t.status==='open'):[],config:staff.role==='admin'?c.config:null,issues:c.issues.filter(v=>v.status!=='resolved' && visibleIds.has(v.orderId)),audit:c.audit.filter(v=>staff.role==='admin'||visibleIds.has(v.orderId)).slice(-100).reverse()});
          if(req.method === 'POST' && path === '/staff/action') {
            if(!visibleIds.has(body.orderId)) return out({error:'order_not_found'},404);
            if(['reconcile','record_refund'].includes(body.action) && !preview && staff.role!=='admin' && !staff.desks?.includes('money')) return out({error:'money_access_required'},403);
            if(['verify_payment'].includes(body.action) && !preview && staff.role!=='admin' && !staff.desks?.includes('money') && !staff.desks?.includes('studio')) return out({error:'money_access_required'},403);
            return out(core.staffAction(s,staff,body,time));
          }
          if(req.method === 'POST' && path === '/staff/support') {
            const issue=c.issues.find(v=>v.id===body.id);
            if(!issue || !visibleIds.has(issue.orderId) || !['assigned','resolved'].includes(body.status) || !String(body.note||'').trim()) return out({error:'issue_and_resolution_note_required'},400);
            Object.assign(issue,{status:body.status,owner:staff.id,note:String(body.note).slice(0,500),updatedAt:new Date(time).toISOString()});
            c.audit.push({action:'support_'+body.status,ticketId:issue.id,actor:staff.id,at:new Date(time).toISOString()});return out({ok:true});
          }
          if(req.method === 'PUT' && path === '/staff/config') return out(core.configure(s,SKUS,body,staff,time));
          if(req.method === 'POST' && path === '/staff/recovery') {
            if(staff.role!=='admin') return out({error:'admin_access_required'},403);
            const ticket=c.tickets.find(t => t.id===body.ticketId && t.status==='open');
            if(!ticket || !String(body.evidenceReference||'').trim() || body.providerUpdated!==true) return out({error:'verified_identity_provider_update_required'},400);
            // Phone ownership is changed in the trusted identity provider, not from an unverified request.
            for(const [key,value] of Object.entries(c.sessions)) if(value.accountId===ticket.memberId) delete c.sessions[key];
            Object.assign(ticket,{status:'resolved',resolvedBy:staff.id,resolvedAt:new Date(time).toISOString(),evidenceReference:String(body.evidenceReference).slice(0,250)});
            c.audit.push({action:'phone_recovery',ticketId:ticket.id,actor:staff.id,at:new Date(time).toISOString()});
            return out({ok:true});
          }
          return out({error:'not_found'},404);
        }
        if(!actor) return out({error:'sign_in_required'},401);
        if(req.method === 'GET' && path === '/support') return out({issues:c.issues.filter(v=>ownsMemberRecord(actor,v.memberId))});
        if(req.method === 'POST' && path === '/support') {
          if(actor.role!=='member') return out({error:'member_access_required'},403);
          const order=s.orders.find(o=>o.id===body.orderId && ownsMemberRecord(actor,o.memberId) && o.source==='commerce');
          if(!order || !['missing_item','quality','late','return_refund','other'].includes(body.kind)) return out({error:'order_and_issue_required'},400);
          if(!core.rateLimit(s,'support:'+actor.id,time,6)) return out({error:'too_many_attempts'},429);
          const issue={id:'issue-'+randomBytes(6).toString('hex'),memberId:actor.id,orderId:order.id,kind:body.kind,note:String(body.note||'').slice(0,500),status:'open',createdAt:new Date(time).toISOString()};
          c.issues.push(issue);return out({id:issue.id,status:issue.status},201);
        }
        if(req.method === 'GET' && path === '/orders') return out({orders:core.listOrders(s,actor),paymentsEnabled:false});
        if(req.method === 'GET' && /^\/orders\/ord-[a-zA-Z0-9-]+$/.test(path)) {
          const id=path.slice('/orders/'.length);
          const o=s.orders.find(row=>row.id===id && row.source==='commerce');
          if(!o || !ownsMemberRecord(actor,o.memberId)) return out({error:'order_not_found'},404);
          return out({...core.publicOrder(o),storage:s.persist||(hasDurableStore()?'postgres':'memory')});
        }
        if(req.method === 'POST' && path === '/quote') return out(core.quote(s,actor,body,SKUS,preview,time));
        if(req.method === 'POST' && path === '/orders') {
          if(actor?.test===true && actor.id===TEST_MEMBER.id) {
            const existing = existingTestOrder(s);
            if(existing) return out({...core.publicOrder(existing),storage:s.persist||(hasDurableStore()?'postgres':'memory')},200);
          }
          const requestedKey = req.headers['idempotency-key']||(actor?.test===true?TEST_ORDER_IDEMPOTENCY_KEY:undefined);
          const reserveKey = actor?.test===true && actor.id===TEST_MEMBER.id ? testMemberReserveKey(s, requestedKey) : requestedKey;
          return out(core.reserve(s,actor,body,reserveKey,SKUS,preview,time),201);
        }
        if(req.method === 'POST' && path === '/cancel') return out(core.cancel(s,actor,body.orderId,time));
        return out({error:'not_found'},404);
      } catch(error) {
        if(error instanceof core.CommerceError) return out({error:error.message},error.status);
        throw error;
      }
    });
    if(result.status >= 400) return send(result.status,result.body);
    return send(result.body.status,result.body.body,result.body.headers);
  } catch { return send(503,{error:'service_unavailable',message:'Please try again. No order is confirmed without a reference.'}); }
}
