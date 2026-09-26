import {PILOT_CLOSED_COPY,SAVE_PAUSED_COPY,OTHER_COMMITMENTS_PAUSED_COPY} from './commerce-capabilities.js';
import {analyticsEvent,memberAnalyticsPayload} from './commerce-analytics.js';
import {memberShellState,lessNavIcon} from './commerce-shell.js';
import {moneyStatusMarkup} from './commerce-money-status.js';
import {homeDashboardModel,homeDashboardMarkup} from './commerce-home.js';
import {journeyA11y,redactClientLog} from './commerce-content-qa.js';
import {supportFormMarkup,supportIssueLine} from './commerce-support.js';
import {owner,ownerActions,ownerControls,ownerRequest,restoreOwner,signInOwner,exitOwner,ownerLoginMarkup,ownerAccountMarkup,ownerEarnMarkup,ownerSendMarkup} from './commerce-owner.js';
import {passkeyMarkup,usePasskey,takePasskeySetup} from './commerce-passkeys.js';
import {usesPhoneOtpFlow,usesPasswordAuth,e164In,nationalMobile,rememberOn,authErrorText,needsSetPassword,setPasswordToken,passwordBody,setPasswordIssue,submitSetPassword,submitAuthPaths,otpRequestPaths,otpVerifyPaths,loginPath,authTimeoutMs,phoneFormMarkup,verifyFormMarkup,setPasswordFormMarkup,rememberFormMarkup,passwordFormMarkup} from './commerce-member-auth.js';
import {membershipMarkup,partnerListMarkup,partnerConsentMarkup,partnerState} from './commerce-services.js';
import { planForm, planResult, planStatus, fieldsFromValues, valuesFromFields, sameFields } from './commerce-plan.js';
import { booksMarkup, downloadBooks, personalEntryForm, healthSupportDialog, entryPurposeOptions, sendViewState } from './commerce-books.js';
import { mapModel, mapMarkup, mountMap, mapJobDetails, earnProjectionState } from './commerce-earn-map.js';
import { saveCategories, categoryId, categoryIcons } from './commerce-categories.js';
import { languageOptions, validLanguage, loadLanguage, translate } from './commerce-i18n.js';
import { shopTilesFor, manufacturersFor, SHOP_THEATRE, millOrderProduct } from './commerce-shop-categories.js';
import {SHOP_CATEGORY_IDS,voiceLanguage,shopCatalogueMarkup,shopViewState,shopPhoto,shopPrice,shopSourceCopy,shopReservationNotice} from './commerce-shop-v2.js';
import { PENDING_PACK, packReady, reserveReady, commitmentReady, saveCommitmentReady, setSaveCapabilities, commitmentActionReady, bagHasUnconfirmedPack, stayErrorKind } from './commerce-truth.js';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const load = (key,fallback) => {try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch {return fallback;}};
const save = (key,value) => {try {localStorage.setItem(key,JSON.stringify(value));} catch {}};
function readStickyLanguage(){try{const raw=localStorage.getItem('nia-language');if(raw==null)return null;const value=JSON.parse(raw);return validLanguage(value)?value:null;}catch{return null;}}
const languageSticky=()=>readStickyLanguage()!==null;
const memberPages=new Set(['home','live','earn','shop','send','bag','orders','account']);
const pageFromLocation=()=>memberPages.has(location.hash.slice(1))?location.hash.slice(1):'home';
let passkeySetupToken=takePasskeySetup(location,history);
let navigationVersion=0, entryError='', entryLoading=true;
const needsSignIn=()=>!account&&!owner.active;
let lang=readStickyLanguage()||'en', page=pageFromLocation(), cat=null, account=null, cart=load('nia-commerce-bag',{}), locationId='', fulfillment='pickup', category='all', aisle='', search='', orders=[], issues=[], challenge='', busy=false;
let bagOpen=false, checkoutPending=false, sessionExpired=false;
let shellReadAt=0, shellReadFailed=false;
let nestData=null, nestOrders=[], nestOrdersError='', nestStart='', nestDraft=null, nestPending=load('nia-nest-pending',null);
let authPhone='', passwordToken='', pendingPassword='', authStep='';
let disposeEarnMap=()=>{};
let booksData=null,booksMonth='',booksRequest=null;
let memberStatus=null,partners=[],partnerReferrals=[];
let homeData={stay:{status:'loading'},earn:{status:'loading'},fee:{status:'loading'},send:{status:'loading'}};
let homeReadVersion=0, homeAccountId=null;
async function loadHome(){
  const version=++homeReadVersion;
  homeAccountId=account?.id||null;
  if(!account||owner.active){homeData={stay:{status:'source_missing'},earn:{status:'source_missing'},fee:{status:'source_missing'},send:{status:'source_missing'}};return;}
  homeData={stay:{status:'loading'},earn:{status:'loading'},fee:{status:'loading'},send:{status:'loading'}};
  const paths={stay:'/nests/bookings',earn:'/earn',fee:'/membership',send:'/books'};
  const results=await Promise.all(Object.entries(paths).map(async ([name,path])=>{
    try{return [name,{status:'ready',data:await api(path)}];}
    catch(e){return [name,{status:e.status===401?'source_missing':'unavailable'}];}
  }));
  if(version===homeReadVersion)homeData=Object.fromEntries(results);
}

const serviceContext=()=>({t,esc,lang});
// Events carry only fixed outcome codes and the selected UI language. No member or record identifiers leave this surface.
const observedStates=new Map();
function emitAnalytics(pillar,event,payload={}){
  const record=analyticsEvent(pillar,event,memberAnalyticsPayload(payload,lang));
  if(record.ok)document.dispatchEvent(new CustomEvent('nia:analytics',{detail:redactClientLog(record)}));
}
function emitObservedState(pillar,id,status,event){
  if(!event||!id)return;
  const key=pillar+':'+id;
  if(observedStates.get(key)===status)return;
  observedStates.set(key,status);
  emitAnalytics(pillar,event,{source:'server_status'});
}
async function openMembership(recovery=false){if(!account)return login();memberStatus=await api('/membership');emitObservedState('identity','membership',memberStatus.state||memberStatus.status,'state_change');show(t('Membership status'),membershipMarkup(memberStatus,serviceContext(),recovery));}
async function openPartners(kind){if(!account)return login();const results=await Promise.all([api('/partners'),api('/partners/referrals').catch(e=>{if(e.code==='member_not_enrolled')return {referrals:[]};throw e;})]);partners=results[0].partners;partnerReferrals=results[1].referrals;show(t('Partner services'),partnerListMarkup(partners,partnerReferrals,serviceContext(),kind));}

const planDrafts=new Map();let planState=null,planRequest=null;
const planMonth=()=>new Date(Date.now()+19800000).toISOString().slice(0,7);
const currentPlanKey=()=>account?.id+':'+planMonth();
const personalEntry=id=>booksData?.months?.flatMap(m=>m.entries).find(e=>e.reference===id&&e.editable);
async function submitBooks(body){if(booksRequest&&booksRequest.accountId!==account?.id)booksRequest=null;if(booksRequest&&JSON.stringify(booksRequest.body)!==JSON.stringify(body))throw {message:t('Retry the previous entry before changing it.')};booksRequest||={body,key:crypto.randomUUID(),accountId:account?.id};try{await api('/books/entries',booksRequest.body,'POST',booksRequest.key);booksRequest=null;}catch(e){if(!e.uncertain&&!['save_storage_unavailable','state_conflict','service_unavailable'].includes(e.code))booksRequest=null;throw e;}await loadBooks();if(body.date)booksMonth=body.date.slice(0,7);$('#dialog').close();render();}
function whenText(value){const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleString(document.documentElement.lang+'-IN',{dateStyle:'medium',timeStyle:'short'});}
function renderPlan(){show(t('My plan this month'),planForm(planDrafts.get(currentPlanKey())||{},planMonth(),{t,esc,money,actual:booksData?.months?.find(m=>m.month===planMonth()),plan:planState,when:whenText}));}
function refreshPlanStatus(){const status=$('#plan-status');if(!status)return;$('#plan-actions')?.remove();const wrap=document.createElement('div');wrap.innerHTML=planStatus(planState,{t,esc,when:whenText});status.replaceWith(...wrap.childNodes);}
// Central owns the saved plan. Load it, keep any typed draft as unsaved, and never claim "saved" without Central's acknowledgement.
async function openPlan(){const key=currentPlanKey();if(!planDrafts.has(key))planDrafts.set(key,{});planState={status:'loading',month:planMonth()};renderPlan();
  try{const saved=await api('/books/plan?month='+planMonth());const savedFields=saved.fields||null;const draft=planDrafts.get(key);const hasDraft=Object.values(draft).some(v=>String(v??'').trim()!=='');if(!hasDraft&&savedFields)planDrafts.set(key,valuesFromFields(savedFields));
    planState={status:'ready',month:saved.month||planMonth(),revision:saved.revision||0,updatedAt:saved.updatedAt||null,canSave:Boolean(saved.capabilities?.canSave),reason:saved.capabilities?.reason||null,savedFields,saveState:savedFields&&sameFields(fieldsFromValues(planDrafts.get(key)),savedFields)?'saved':'unsaved',error:null};}
  catch(e){if(e.status===401)throw e;planState={status:'unavailable',month:planMonth(),error:e.message};}
  renderPlan();}
async function savePlan(){if(!planState||planState.status!=='ready'||!planState.canSave||planState.saveState==='saving')return;const key=currentPlanKey();const fields=fieldsFromValues(planDrafts.get(key)||{});
  if(!fields){planState={...planState,saveState:'error',error:t('Use amounts from 0 to 10,00,000, with up to two decimal places.')};return refreshPlanStatus();}
  const body={month:planState.month,expectedRevision:planState.revision,fields};
  if(planRequest&&(planRequest.accountId!==account?.id||JSON.stringify(planRequest.body)!==JSON.stringify(body)))planRequest=null;
  planRequest||={body,key:crypto.randomUUID(),accountId:account?.id};
  planState={...planState,saveState:'saving',error:null};renderPlan();
  try{const result=await api('/books/plan',planRequest.body,'PUT',planRequest.key);planRequest=null;const plan=result.plan||result;planDrafts.set(key,valuesFromFields(plan.fields));planState={...planState,revision:plan.revision,updatedAt:plan.updatedAt,savedFields:plan.fields,canSave:Boolean(plan.capabilities?.canSave??planState.canSave),saveState:'saved',error:null};}
  catch(e){if(e.status===401)throw e;
    if(e.code==='plan_revision_conflict'){planRequest=null;const current=e.result?.current;planState={...planState,revision:current?.revision??planState.revision,updatedAt:current?.updatedAt??planState.updatedAt,savedFields:current?.fields??planState.savedFields,saveState:'conflict',error:null};}
    else if(e.code==='plan_save_not_permitted'){planRequest=null;planState={...planState,canSave:false,saveState:'error',error:e.message};}
    else{if(!e.uncertain&&!['service_unavailable','central_unreachable','plan_unavailable'].includes(e.code))planRequest=null;planState={...planState,saveState:'error',error:e.message};}}
  renderPlan();}
async function loadBooks(){booksData=null;if(!account)return;try{booksData=await api('/books');}catch(e){booksData={months:[],error:e.message};}}
let earnData={jobs:[]}, applications=[], earnError='', earnLoading=false, earnPending=load('nia-earn-pending',null);
let pending=load('nia-commerce-pending',null), draft=null;
if(!validLanguage(lang))lang='en';
const t = (en,hi) => translate(lang,en,hi);
const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2,minimumFractionDigits:0}).format(n||0);
const date = v => new Date(v).toLocaleString(lang+'-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'});
const icons={live:'<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/>',earn:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18M10 12v3h4v-3"/>',send:'<path d="m3 11 18-8-8 18-3-8-7-2Zm7 2L21 3"/>',shop:'<path d="M3 10h18L19 4H5l-2 6Zm2 0v10h14V10M9 20v-6h6v6"/>',bag:'<path d="M5 7h14l1 14H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2"/>',orders:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',account:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',qr:'<path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM19 19h2v2h-2zM15 21v-2M21 15h-2"/>',arrow:'<path d="m9 5 7 7-7 7"/>'};
Object.assign(icons,categoryIcons);
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.bag}</svg>`;
const jobTerms = j => j.preview ? String(j.terms || '').replace('DEMO ONLY · Fictional employer, workplace and vacancy for presentation. No real job offer or application is sent.', '').trim() : j.terms;
const title = p => lang==='hi' && p.hindi ? p.hindi : (p.translations?.[lang]?.name || t(p.name));
const count = () => Object.values(cart).reduce((n,q) => n+q,0);
const total = () => (cat?.products||[]).reduce((n,p)=>n+p.price*(cart[p.id]||0),0);
const errorText = code => authErrorText(code,t) || ({pilot_commitments_paused:t(PILOT_CLOSED_COPY),passkey_device_unavailable:t('Passkeys are unavailable on this device. Ask your Nia team for help.'),passkey_cancelled:t('Sign-in was cancelled. Tap again when you are ready.'),setup_expired:t('This setup code expired or was used. Ask your Nia team for a new code.'),ceremony_expired:t('Sign-in expired. Please try again.'),passkey_not_accepted:t('This passkey could not be accepted. Try again or ask your Nia team for help.'),verified_phone_required:t('Sign in with a verified phone before requesting enrolment or a number change. Your Nia team can help.'),delivery_location_unverified:t('Ask your Nia team to verify your delivery location.'),kyc_not_approved:t('Approved membership is required for financial services.'),member_not_enrolled:t('Please check your membership status.'),central_unreachable:t('Your Nia team could not be reached. Please try again.'),entry_changed:t('This entry changed. Refresh your statement before editing again.'),valid_date_amount_and_description_required:t('Enter a valid date, amount and description.'),entry_not_found:t('This entry is unavailable or cannot be edited.'),job_not_available:t('This job is no longer accepting applications. Refresh to see available jobs.','इस नौकरी के लिए आवेदन बंद हैं। उपलब्ध नौकरियाँ देखने के लिए ताज़ा करें।'),job_details_changed:t('The job details changed. Refresh and review them before applying.','नौकरी की जानकारी बदल गई है। आवेदन से पहले ताज़ा करके जानकारी देखें।'),nest_not_available:t('That Nest is no longer available for these dates. Choose another location or date.','इन तारीखों के लिए नेस्ट उपलब्ध नहीं है। दूसरी जगह या तारीख चुनें।'),invalid_move_in_date:t('Choose a move-in date within the next 30 days.','अगले 30 दिनों में आने की तारीख चुनें।'),existing_nest_stay:t('You already have a Nest for these dates. Open Orders & stays to review it.','इन तारीखों के लिए आपका नेस्ट पहले से है। ऑर्डर और नेस्ट देखें।'),stock_changed:t('Availability changed. Review your bag and try again.','स्टॉक बदल गया है। अपना बैग जाँचकर फिर कोशिश करें।'),price_or_details_changed:t('Your order details changed. Please review the updated total.','ऑर्डर की जानकारी बदल गई है। नया कुल देखें।'),invalid_password:t('That password is not correct. Try again or ask your Nia team.','पासवर्ड सही नहीं है। फिर कोशिश करें या निया टीम से पूछें।'),pack_unconfirmed:t('Ask Nia about this pack.','इस पैक के बारे में निया से पूछें।'),sign_in_required:t('Please sign in again. Your bag is still here.','फिर से साइन इन करें। आपका बैग यहीं है।'),too_many_attempts:t('Too many attempts. Please try again after 15 minutes.','बहुत बार कोशिश हुई। 15 मिनट बाद फिर कोशिश करें।'),location_unavailable:t('This place is closed. Ask Nia.','यह जगह बंद है। निया से पूछें।'),contact_team_to_cancel:t('Your bag is being prepared. Please contact the pickup team.','आपका बैग तैयार हो रहा है। पिकअप टीम से संपर्क करें।'),too_many_active_orders:t('You already have three active orders. Collect or cancel one first.','आपके तीन चालू ऑर्डर हैं। पहले एक लें या रद्द करें।'),commerce_not_configured:t('Ordering is not open yet. Please check with your Nia team.','अभी ऑर्डर शुरू नहीं हुए हैं। अपनी निया टीम से संपर्क करें।'),member_access_required:t('This account has catalogue access only.','इस खाते से केवल कैटलॉग देखा जा सकता है।'),plan_revision_conflict:t('Your plan changed elsewhere. Reload it, check the amounts, then save again.'),plan_save_not_permitted:t('Saving needs an active, verified membership. The calculator still works; nothing is saved.'),central_connection_not_configured:t('Account saving is not connected yet. The calculator still works; nothing is saved.'),books_not_enabled:t('Account saving is not connected yet. The calculator still works; nothing is saved.'),central_unreachable:t('Your Nia team could not be reached. Please try again.'),plan_unavailable:t('Central could not be reached. Your typed amounts are still here; try again.'),idempotency_key_reused:t('That save request was already used with different amounts. Try again.'),invalid_plan:t('Use amounts from 0 to 10,00,000, with up to two decimal places.')})[code] || t('We could not complete that request. Please try again or ask your Nia team for help.','यह अनुरोध पूरा नहीं हुआ। फिर कोशिश करें या निया टीम से मदद लें।');
async function api(path,body,method='POST',key) {
  if(owner.active)return ownerRequest(path,body);
  let response;
  try {response=await fetch('/api/commerce'+path,{method:body===undefined?'GET':method,credentials:'same-origin',headers:body===undefined?{}:{'content-type':'application/json',...(key?{'idempotency-key':key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(authTimeoutMs(path))});} catch {throw {message:t('Connection interrupted. You can retry safely.','कनेक्शन टूट गया। आप सुरक्षित रूप से फिर कोशिश कर सकते हैं।'),uncertain:true};}
  const result=await response.json();
  if(!response.ok){if(response.status===401){if(account||owner.active)sessionExpired=true;account=null;orders=[];nestOrders=[];applications=[];}throw {message:errorText(result.error),code:result.error,status:response.status,result};} return result;
}
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,5000);}

function applyCommitmentGate(root=document){
  for(const button of root.querySelectorAll('[data-action]'))if(!commitmentActionReady(button.dataset.action)){button.disabled=true;button.setAttribute('aria-disabled','true');}
  for(const form of root.querySelectorAll('#review-form,#earn-form'))if(!(form.id==='review-form'?saveCommitmentReady():commitmentReady()))for(const control of form.querySelectorAll('button,input,select'))control.disabled=true;
  const target=root===document?$('#content'):root;
  const shopCopy=page==='shop'&&category!=='insurance'?shopReservationNotice({catalogue:cat,signedIn:!!account,reservationsEnabled:saveCommitmentReady()}):undefined;
  const copy=shopCopy!==undefined?shopCopy:saveCommitmentReady()?(['live','earn'].includes(page)?OTHER_COMMITMENTS_PAUSED_COPY:null):PILOT_CLOSED_COPY;
  const previous=target?.querySelector('[data-pilot-paused]');
  if(previous)previous.remove();
  if(target&&copy){const note=document.createElement('p');note.className='info';note.dataset.pilotPaused='';note.setAttribute('role','status');note.textContent=t(copy);target.prepend(note);}
}

// Keep rendered member controls reachable and named after each view or dialog update.
function prepareJourney(root){
  document.documentElement.lang=lang;
  const skip=document.querySelector('.skip');if(skip)skip.textContent=t('Skip to content','सीधे सामग्री पर जाएँ');
  const close=document.querySelector('#dialog [data-action="close"]');if(close){close.setAttribute('aria-label',t('Close dialog','बंद करें'));const word=close.querySelector('.icon-word');if(word)word.textContent=t('Close dialog','बंद करें');}
  const labels={close:t('Close dialog','बंद करें'),'close-bag':t('Close dialog','बंद करें'),'open-bag':t('Bag','बैग'),help:t('Help'),detail:t('View','देखें')};
  const controls=[...root.querySelectorAll('[data-action]')];
  for(const control of controls){
    const native=control.matches('button,a,input,select,textarea');
    if(!native){control.tabIndex=0;control.setAttribute('role','button');}
    const hasIcon=Boolean(control.querySelector('svg,img'))||/^[×+−]$/.test(control.textContent.trim());
    const visible=control.textContent.replace(/[×+−]/g,'').trim();
    if(hasIcon&&!visible&&control.matches('button,a')&&!control.classList.contains('mesha-bag-backdrop')){
      const word=labels[control.dataset.action]||control.getAttribute('aria-label');
      if(word){const span=document.createElement('span');span.className='icon-word';span.textContent=word;control.append(span);}
    }
    if(!control.getAttribute('aria-label')&&!control.getAttribute('aria-labelledby')&&!control.textContent.trim()&&labels[control.dataset.action])
      control.setAttribute('aria-label',labels[control.dataset.action]);
  }
  const audit=journeyA11y({minWidth:document.documentElement.clientWidth,keyboard:controls.every(c=>c.matches('button,a,input,select,textarea')||c.tabIndex>=0),controls:controls.map(c=>({action:c.dataset.action,ariaLabel:c.getAttribute('aria-label')||c.getAttribute('aria-labelledby'),text:c.textContent.trim(),iconOnly:Boolean(c.querySelector('svg,img'))||/^[×+−]$/.test(c.textContent.trim()),visibleLabel:c.textContent.replace(/[×+−]/g,'').trim(),focusable:c.matches('button,a,input,select,textarea')||c.tabIndex>=0}))});
  (root.documentElement||root).dataset.a11yReady=String(audit.ok);
}
document.addEventListener('keydown',event=>{const control=event.target.closest('[data-action][role="button"]');if(control&&(event.key==='Enter'||event.key===' ')){event.preventDefault();control.click();}});
function show(title,body){$('#dialog').classList.remove('signin-dialog','mesha-checkout');document.body.classList.remove('signin-open','mesha-checkout-open');$('#dialog-title').textContent=title;$('#dialog-body').innerHTML=body;ownerControls($('#dialog-body'));applyCommitmentGate($('#dialog-body'));prepareJourney($('#dialog'));if(!$('#dialog').open)$('#dialog').showModal();$('#dialog-body').querySelector('input:not([type=hidden]),button:not(:disabled),select')?.focus({preventScroll:true});}
function unsyncedTapCount(){
  if(!account||owner.active)return 0;
  const sameMember=key=>load(key,null)?.accountId===account.id;
  let count=['nia-commerce-pending','nia-nest-pending','nia-earn-pending','nia-earn-withdraw-pending'].filter(sameMember).length;
  const cancel=load('nia-commerce-cancel-pending',null);
  if(cancel?.orderId&&orders.some(order=>order.id===cancel.orderId))count++;
  return count;
}
function renderShell(){
  const queued=unsyncedTapCount(),online=navigator.onLine;
  const state=memberShellState({online,readAsOf:cat?.asOf,readAt:shellReadAt,readFailed:shellReadFailed,pendingCount:queued,sourceOwner:cat?.owner,signedIn:!!account});
  const labels={signin:t('Sign in to view availability'),synced:t('Catalogue synced','सामान की सूची अपडेट है'),checking:t('Checking updates','नए अपडेट देख रहे हैं'),stale:t('Checking last update','पिछला अपडेट जाँच रहे हैं'),offline:t('Offline','ऑफ़लाइन'),queued:t('Queued on this phone','इस फोन पर कतार में है'),retry:t('Request needs retry','अनुरोध फिर से भेजना होगा')};
  $('#shell-greeting').textContent=owner.active?t('Owner view','संचालक दृश्य'):account?t('Hello, Member','नमस्ते, सदस्य'):t('Welcome to NiaSave','नियासेव में स्वागत है');
  const sync=$('#sync-state');sync.dataset.state=state;sync.textContent=labels[state];
  const banner=$('#offline-banner');banner.hidden=online;
  banner.textContent=online?'':(cat?.asOf?t('Offline. Last loaded information may be out of date.','ऑफ़लाइन। पिछली देखी जानकारी पुरानी हो सकती है।'):t('Offline. Connect to load information.','ऑफ़लाइन। जानकारी देखने के लिए इंटरनेट से जुड़ें।'))+(queued?' '+t('A request is queued on this phone. Retry when connected.','एक अनुरोध इस फोन पर कतार में है। इंटरनेट आने पर फिर से भेजें।'):'');
}
function notice(){const n=$('#notice');if(owner.active){n.className='notice';n.textContent='Owner view · Read only · Live catalogue. Personal transactions require a member account.';return;}n.className='notice';n.textContent='';}
function pictureState(kind,line,action=''){return `<section class="picture-state" data-state="${esc(kind)}">${icon(kind==='network'?'search':kind==='signed-out'||kind==='expired'?'account':'live')}<p>${line}</p>${action}</section>`;}
function stayPanel(){
  const loginBtn=`<button class="primary" data-action="login">${t('Sign in','साइन इन')}</button>`;
  if(entryLoading&&!nestData)return pictureState('loading',t('Checking places…','रहने की जगह देखी जा रही है…'));
  if(!navigator.onLine||(!cat&&shellReadFailed))return pictureState('network',t("We couldn’t load places. Please try again.",'रहने की जगह लोड नहीं हुई। फिर कोशिश करें।'),`<button class="primary" data-action="live">${t('Try again','फिर कोशिश करें')}</button>`);
  const status=stayErrorKind(nestData?.error,{signedIn:Boolean(account||owner.active||sessionExpired)});
  if(status==='network')return pictureState('network',t("We couldn’t load places. Please try again.",'रहने की जगह लोड नहीं हुई। फिर कोशिश करें।'),`<button class="primary" data-action="live">${t('Try again','फिर कोशिश करें')}</button>`);
  if(status==='signedOut')return pictureState('signed-out',t('Sign in to view places to stay','रहने की जगह देखने के लिए साइन इन करें।'),loginBtn);
  if(status==='expired')return pictureState('expired',t('Please sign in again to continue.','जारी रखने के लिए फिर साइन इन करें।'),loginBtn);
  return pictureState('empty',t('No Nests yet','अभी नेस्ट नहीं'),`<button data-action="help">${t('Ask your Nia team','अपनी निया टीम से पूछें')}</button>`);
}
function lessName(brand,meaningEn,meaningHi){const meaning=t(meaningEn,meaningHi);return lang==='en'?brand:`${brand} · ${meaning}`;}
function nav(){
  const labels={live:t('Live','रहें'),earn:t('Earn','कमाएँ'),shop:t('Shop','खरीदें'),send:t('Send','भेजें')};
  $('#less-nav').setAttribute('aria-label',t('LESS navigation','लेस नेविगेशन'));
  $('#less-nav').innerHTML=['live','earn','shop','send'].map(key=>`<button type="button" data-action="${key}" aria-label="${esc(labels[key])}" ${page===key?'aria-current="page"':''}>${lessNavIcon(key)}<span>${esc(labels[key])}</span></button>`).join('');
  $('#header-language').innerHTML=document.body.classList.contains('mesha-dark')||document.body.classList.contains('mesha-lang-open')?languageChip():languagePicker(true);
  const label=owner.active?t('Owner view','संचालक दृश्य'):account?t('Account','खाता'):t('Sign in','साइन इन');
  $('#sign-label').innerHTML=`${icon('account')}<span>${esc(label)}</span>`;
  $('#sign-label').setAttribute('aria-label',label);
  $('#sign-label').classList.add('signin');
  $('#sign-label').classList.toggle('mesha-avatar',false);
  $('#sign-label').dataset.action='account';
  if(['account','orders'].includes(page))$('#sign-label').setAttribute('aria-current','page');else $('#sign-label').removeAttribute('aria-current');
  $('.header .brand').setAttribute('aria-label',t('NiaSave home','नियासेव होम'));
  document.documentElement.lang=lang;
  const theme=$('meta[name="theme-color"]');if(theme)theme.content='#F5F8FB';
  $('.skip').textContent=t('Skip to content','मुख्य सामग्री पर जाएँ');
  $('[data-action="close"]').setAttribute('aria-label',t('Close dialog','बंद करें'));
}
const skuKeep={groundnut_oil:75,mustard_oil:70,sunflower_oil:50,coconut_oil:80,detergent_pick:30,nia_detergent:32,bathsoap_pick:26,nia_bathsoap:32,toothpaste_pick:14,essentials_pick:70};
const PRODUCT_STILLS={
  groundnut_oil:'/assets/products/groundnut-oil.jpg',
  mustard_oil:'/assets/products/mustard-oil.jpg',
  sunflower_oil:'/assets/products/sunflower-oil.jpg',
  coconut_oil:'/assets/products/coconut-oil.jpg',
  bathsoap:'/assets/products/bath-soap.jpg',
  bathsoap_pick:'/assets/products/bath-soap.jpg',
  nia_bathsoap:'/assets/products/bath-soap.jpg',
  toothpaste:'/assets/products/toothpaste.jpg',
  toothpaste_pick:'/assets/products/toothpaste.jpg',
  detergent:'/assets/products/detergent.jpg',
  detergent_pick:'/assets/products/detergent.jpg',
  nia_detergent:'/assets/products/detergent.jpg',
  essentials_pick:'/assets/products/bath-soap.jpg'
};
function productKeep(p){if(!packReady(p))return 0;if(Number.isFinite(Number(p.keep))&&Number(p.keep)>0)return Number(p.keep);if(Number.isFinite(Number(p.kirana))&&Number(p.kirana)>Number(p.price))return Number(p.kirana)-Number(p.price);if(Number.isFinite(Number(p.mrp))&&Number(p.mrp)>Number(p.price))return Number(p.mrp)-Number(p.price);return skuKeep[p.id]||0;}
function pricePair(keep,nia){return `<div class="store-price">${keep>0?`<span class="store-keep"><small>${t('You keep','आपके पास')}</small><strong>${money(keep)}</strong></span>`:''}<span class="store-nia"><small>Nia</small><strong>${money(nia)}</strong></span></div>`;}
function homeHello(){const h=new Date().getHours();return h<12?t('Good morning','सुप्रभात'):h<17?t('Good afternoon','नमस्कार'):t('Good evening','शुभ संध्या');}
function photo(p,extra=''){const src=PRODUCT_STILLS[p?.id]||PRODUCT_STILLS[p?.photoId]||PRODUCT_STILLS.groundnut_oil;return `<img class="photo photo-still ${extra}" src="${esc(src)}" alt="" width="800" height="800" loading="lazy">`;}
function stepper(p){return `<div class="stepper"><button data-action="minus" data-id="${p.id}" aria-label="${esc(t('Remove one ','एक हटाएँ ')+title(p))}"><span aria-hidden="true">−</span><span class="icon-word">${esc(t('Remove one','एक हटाएँ'))}</span></button><span>${cart[p.id]||0}</span><button data-action="add" data-id="${p.id}" aria-label="${esc(t('Add one ','एक जोड़ें ')+title(p))}" ${(cart[p.id]||0)>=Math.min(10,p.available)?'disabled':''}><span aria-hidden="true">+</span><span class="icon-word">${esc(t('Add one','एक जोड़ें'))}</span></button></div>`;}
function deliveryOffered(){if(cat?.preview)return false;return Array.isArray(cat?.locations)&&cat.locations.some(l=>(!account||account.locationIds?.includes(l.id))&&Array.isArray(l.modes)&&l.modes.includes('delivery'));}
function fulfillmentToggle(){const modes=[['pickup',t('Pickup','पिकअप')]];if(deliveryOffered())modes.push(['delivery',t('Delivery','डिलीवरी')]);if(fulfillment==='delivery'&&!deliveryOffered())fulfillment='pickup';return `<div class="fulfillment-choice"><p>${t('Nothing to pay now.','अभी कुछ नहीं देना है।')}</p><div class="fulfillment-toggle" role="group" aria-label="${t('How do you want your bag?','सामान कैसे चाहिए?')}">${modes.map(([mode,label])=>`<button type="button" data-action="fulfillment" data-id="${mode}" aria-pressed="${fulfillment===mode}" ${pending||busy?'disabled':''}>${label}</button>`).join('')}</div><p class="bag-foot">${fulfillment==='pickup'?t('Pick up your bag here. Pay when you collect.','बैग यहाँ लें। लेते समय पैसे दें।'):t('Pay when it arrives.','आने पर पैसे दें।')}</p></div>`;}
function bagKeepTotal(){return (cat?.products||[]).reduce((n,p)=>n+productKeep(p)*(cart[p.id]||0),0);}
function savePill(c){return ({all:t('All','सभी'),food:t('Food','खाना'),ration:t('Oils','तेल'),cleaning:t('Soap','साबुन'),'personal-care':t('Care','देखभाल'),clothing:t('Clothes','कपड़े'),footwear:t('Shoes','जूते'),insurance:t('Cover','बीमा')})[c.id]||t(c.name,c.hindi);}
function bagChip(){if(!count()||bagOpen)return '';return `<button type="button" class="mesha-bag-chip" data-action="open-bag" aria-label="${t('Bag','बैग')} · ${count()}"><span>${t('Bag','बैग')} · ${count()}</span><span>${t('View','देखें')}</span></button>`;}
function bagLine(p){return `<div class="mesha-bag-line"><button type="button" class="mesha-bag-thumb" data-action="detail" data-id="${p.id}" aria-label="${esc(title(p))} · ${esc(t('View item'))}">${photo(p)}<span class="icon-word">${esc(t('View item'))}</span></button><div class="mesha-bag-copy"><strong>${esc(title(p))}</strong><small>${t('Sticker price')}: ${money(p.price)}</small>${stepper(p)}</div><strong class="mesha-bag-price">${cart[p.id]} × ${money(p.price)}</strong></div>`;}
function bag(){if(owner.active)return `<section class="mesha-bag stack"><div class="mesha-bag-head"><h2>Owner view</h2><button type="button" class="icon-button" data-action="close-bag" aria-label="${esc(t('Close dialog','बंद करें'))}"><span aria-hidden="true">×</span><span class="icon-word">${esc(t('Close dialog','बंद करें'))}</span></button></div><p>Browse published essentials and prices. Ordering requires member sign in.</p></section>`;const n=count();const heading=n?`${t('Bag','बैग')} · ${n}`:t('Bag','बैग');const body=n?(cat?.products||[]).filter(p=>cart[p.id]).map(bagLine).join(''):`<div class="mesha-bag-empty"><h2>${t('Your bag is empty','आपका बैग खाली है')}</h2><p>${t('Add oils or soap from Save. Browse free.','Save से तेल या साबुन जोड़ें। मुफ़्त देखें।')}</p></div>`;const foot=n?`<p class="mesha-bag-note">${t(shopSourceCopy(cat?.owner).review)}</p><button class="primary full mesha-pill mesha-pill-solid" data-action="review" ${!navigator.onLine?'disabled':''}>${t('Continue','आगे बढ़ें')}</button><p class="mesha-bag-note">${t('Phone only on the next step. Nothing to pay online.','फोन अगले कदम पर। ऑनलाइन कुछ नहीं देना है।')}</p>`:`<p class="mesha-bag-note">${t('Choose a product to start your bag.')}</p>`;return `<section class="mesha-bag" aria-label="${esc(heading)}"><div class="mesha-bag-head"><h2>${esc(heading)}</h2><button type="button" class="icon-button" data-action="close-bag" aria-label="${esc(t('Close dialog','बंद करें'))}"><span aria-hidden="true">×</span><span class="icon-word">${esc(t('Close dialog','बंद करें'))}</span></button></div>${body}${foot}</section>`;}
function bagLayer(){return `<div class="mesha-bag-layer"><button type="button" class="mesha-bag-backdrop" data-action="close-bag" aria-label="${t('Close dialog','बंद करें')}"></button>${bag()}</div>`;}
function checkoutPhoneMarkup(){const national=nationalMobile(authPhone);return `<form id="login-form" class="stack mesha-checkout-form" data-auth-step="phone"><p>${t('Enter your phone. Pay when you collect.','फोन डालें। सामान लेते समय पैसे दें।')}</p><label>${t('Mobile number','मोबाइल नंबर')}<span class="phone-field"><span class="phone-prefix" aria-hidden="true">+91</span><input name="phone" type="tel" autocomplete="tel-national" inputmode="numeric" pattern="[6-9][0-9]{9}" minlength="10" maxlength="10" placeholder="${t('10-digit mobile number','10 अंकों का मोबाइल नंबर')}" value="${esc(national)}" required></span></label><div id="form-error" class="error-inline" role="alert"></div><button class="primary mesha-pill mesha-pill-solid" type="submit">${t('Continue','आगे बढ़ें')}</button><p class="mesha-checkout-foot">${t('Only asked at checkout · bag stays on this phone','केवल चेकआउट पर पूछा जाता है · बैग इसी फोन पर रहता है')}</p></form>`;}
function checkoutSignIn(){if(bagOpen){bagOpen=false;render();}if(!cat||cat.memberAuth==='passkey'||cat.preview)return login();if(authStep==='password'&&authPhone&&usesPasswordAuth(cat))return login();authStep='phone';show(t('Your phone','आपका फोन'),checkoutPhoneMarkup());$('#dialog').classList.add('mesha-checkout');document.body.classList.add('mesha-checkout-open');}
async function finishMemberSession(){sessionExpired=false;$('#dialog').close();await refresh();if(checkoutPending&&account&&count())await review();}
async function openBag(){bagOpen=true;if(page!=='shop')return go('shop');render();}
function closeBag(){bagOpen=false;if(page==='shop')render();}
function languagePicker(top=false){return `<label class="language-picker ${top?'language-top':''}"><span>${t('Language','भाषा')}</span><select data-language-select aria-label="${t('Choose your language','अपनी भाषा चुनें')}">${languageOptions.map(l=>`<option value="${l.id}" lang="${l.id}" ${lang===l.id?'selected':''}>${l.label}</option>`).join('')}</select></label>`;}
function languageChip(){const current=languageOptions.find(l=>l.id===lang)||languageOptions[0];return `<button type="button" class="mesha-chip" data-action="language" aria-label="${t('Change language','भाषा बदलें')}">${esc(current.label)}</button>`;}
function languageButtons(){const hint={en:t('Continue'),hi:'Hindi',ta:'Tamil',bn:'Bengali'};return `<div class="mesha-lang-list">${languageOptions.map(l=>`<button type="button" class="mesha-lang-btn" data-action="choose-lang" data-id="${l.id}" lang="${l.id}"><span lang="${l.id}">${l.label}</span><span>${hint[l.id]||''}</span></button>`).join('')}</div>`;}
function languageCard(){return `<section class="mesha-lang" aria-labelledby="mesha-lang-title"><p class="mesha-wordmark">NiaSave</p><div class="mesha-lang-sheet"><p class="mesha-kicker">${t('First step','पहला कदम')}</p><h1 id="mesha-lang-title">${t('Choose your language','अपनी भाषा चुनें')}</h1><p class="mesha-lang-keep">${t("We'll keep this for every screen. Change it anytime.",'यह हर स्क्रीन पर रहेगा। कभी भी बदलें।')}</p>${languageButtons()}<p class="mesha-lang-foot">${t('No sign-in yet. Browse first. Phone only when you check out.','अभी साइन इन नहीं। पहले देखें। फोन केवल चेकआउट पर।')}</p></div></section>`;}
async function chooseLang(next){if(!validLanguage(next))return;try{await loadLanguage(next);lang=next;save('nia-language',lang);$('#dialog').close();render();}catch{toast(t('Language could not be loaded. Check your connection and try again.','भाषा लोड नहीं हुई। कनेक्शन जाँचकर फिर कोशिश करें।'));}}
function footer(){return `<footer class="footer"><span>${t('Make leaving home worth it.','घर से दूर आना सार्थक हो।')}</span><div class="footer-links"><a href="https://www.nia.one/">${t('Why Nia','निया क्यों')}</a><button class="quiet" data-action="help">${t('Help')}</button></div></footer>`;}
function saveHero(){return `<button type="button" class="mesha-save-hero" data-action="shop-hero" aria-label="${t('Shop oils','तेल खरीदें')}"><span class="mesha-kicker">${t('Save')}</span><span class="mesha-save-title">${t('Keep more.','और रखें।')}</span><span class="mesha-save-sub">${t('Oil, soap, detergent — member price.','तेल, साबुन, डिटर्जेंट — सदस्य कीमत।')}</span><span class="mesha-pill mesha-pill-solid">${t('Shop oils','तेल खरीदें')}</span><span class="mesha-save-still"><img src="/assets/oils-editorial-sheet.png" alt="" width="1200" height="800"></span></button>`;}
function saveAisle(){const q=search.trim().toLowerCase();const visible=cat?.products||[];const tiles=shopTilesFor(category).filter(tile=>{if(q&&!`${t(tile.name,tile.hindi)} ${tile.id}`.toLowerCase().includes(q))return false;if(!visible.length)return true;const mills=manufacturersFor(tile.id,SHOP_THEATRE.id,{includePrices:Boolean(cat?.preview)});return mills.some(m=>millOrderProduct(m,visible))||visible.some(p=>p.id===tile.id||p.id===tile.photoId);});if(!tiles.length)return categoryEmpty();return `<div class="save-product-grid save-aisle-grid" role="list">${tiles.map(tile=>{const mills=manufacturersFor(tile.id,SHOP_THEATRE.id,{includePrices:Boolean(cat?.preview)});const pack=mills[0]?.pack||'';const matched=mills.map(m=>millOrderProduct(m,cat?.products||[])).find(p=>p&&packReady(p))||null;const price=matched?makerPrice({nia_price_inr:matched.price,kirana_price_inr:matched.kirana,you_save:productKeep(matched)}):`<p class="save-maker-wait">${t('Price when packs confirm','कीमत पैक पुष्टि पर')}</p>`;const cta=matched&&reserveReady(matched)?t('Add','जोड़ें'):t('Check','देखें');return `<button type="button" class="save-product-card save-aisle-tile" data-action="open-aisle" data-id="${esc(tile.id)}" role="listitem"><span class="save-product-tile save-aisle-photo">${photo({id:tile.photoId})}</span><span class="save-product-body save-aisle-copy"><h3>${esc(t(tile.name,tile.hindi))}</h3>${pack?`<p class="save-product-pack">${esc(t(pack))}</p>`:''}${price}<span class="save-product-cta">${cta}</span></span></button>`;}).join('')}</div>`;}
function makerPrice(row){if(!Number.isFinite(Number(row.nia_price_inr)))return `<p class="save-maker-wait">${t('Price when packs confirm','कीमत पैक पुष्टि पर')}</p>`;const kirana=Number.isFinite(Number(row.kirana_price_inr))?`<span class="save-maker-kirana">${t('Kirana','किराना')} ${money(row.kirana_price_inr)}</span>`:'';const saveAmt=row.you_save!=null?Number(row.you_save):null;return `<div class="save-maker-price save-product-price-row">${kirana}<span class="save-maker-nia save-product-price"><small>Nia</small><strong>${money(row.nia_price_inr)}</strong></span>${saveAmt>0?`<span class="save-maker-save save-product-save"><small>${t('Save','बचत')}</small><strong>${money(saveAmt)}</strong></span>`:''}</div>`;}
function millCard(row){const tile=shopTilesFor('all').find(x=>x.id===row.category);const photoId=tile?.photoId||row.category;const productName=tile?t(tile.name,tile.hindi):row.category;const matched=millOrderProduct(row,cat?.products||[]);const product=matched||(cat?.products||[]).find(p=>p.id===photoId)||null;const orderable=Boolean(matched&&reserveReady(matched));const testMark=(matched?.test||row.test)?`<span class="save-maker-test">${t('TEST','परीक्षण')}</span>`:'';const cheapest=row.cheapest?`<span class="save-maker-badge">${t('Lowest in this theatre','इस थिएटर में सबसे सस्ता')}</span>`:'';const priced=matched&&packReady(matched)?{nia_price_inr:matched.price,kirana_price_inr:matched.kirana,you_save:productKeep(matched)}:row;const price=makerPrice(priced);const cta=`<span class="save-maker-cta save-product-cta">${orderable?t('Add','जोड़ें'):t('Check','देखें')}</span>`;const inner=`<span class="save-product-tile save-maker-still">${photo({id:photoId})}</span><span class="save-product-body"><div class="save-maker-top"><h3>${esc(productName)}</h3>${testMark}${cheapest}</div><p class="save-maker-name save-product-mill">${esc(row.manufacturer)}</p><p class="save-maker-pack save-product-pack">${esc(row.pack)}</p>${price}${cta}</span>`;const klass=`save-product-card save-maker-card${row.cheapest?' is-cheapest':''}${orderable?' is-orderable':''}`;const meta=`data-category="${esc(row.category)}" data-theatre="${esc(row.theatre)}" data-manufacturer="${esc(row.manufacturer)}"`;return product?`<button type="button" class="${klass}" data-action="open-buy" data-id="${esc(product.id)}" ${meta}>${inner}</button>`:`<article class="${klass}" ${meta}>${inner}</article>`;}
function saveMakers(){const visible=cat?.products||[];const rows=manufacturersFor(aisle,SHOP_THEATRE.id,{includePrices:Boolean(cat?.preview)}).filter(row=>!visible.length||millOrderProduct(row,visible)||visible.some(p=>p.id===row.category));const tile=shopTilesFor('all').find(x=>x.id===aisle);const heading=tile?t(tile.name,tile.hindi):t('Save');return `<div class="save-makers save-product-grid"><div class="save-makers-head"><button type="button" class="quiet save-makers-back" data-action="close-aisle">${t('Back to Save','Save पर वापस')}</button><h2>${esc(heading)}</h2><p>${t('Local mills in this theatre','इस थिएटर की स्थानीय मिलें')} · ${esc(t('Rajputana Theatre','राजपूताना थिएटर'))} · ${esc(SHOP_THEATRE.collect)}</p></div>${rows.map(millCard).join('')}${rows.length?'':categoryEmpty()}</div>`;}
function shop(){if(category==='insurance')return insuranceView();return `<div class="save-shop-canvas shop-v2-canvas">${!owner.active&&pending?.accountId===account?.id?moneyStatusMarkup({status:'requested',offlineQueued:!navigator.onLine,kind:'shop'},{t,esc}):''}${shopCatalogueMarkup({catalogue:cat,signedIn:!!account,query:search,aisle,lang,state:shopViewState({catalogue:cat,online:navigator.onLine,loading:entryLoading,readFailed:shellReadFailed})},{t,esc,money,bag:bag()})}${footer()}</div>`;}
function showBuy(id){const p=cat?.products?.find(p=>p.id===id);if(!p||(!cat?.preview&&(p.test===true||p.preview===true)))return;emitAnalytics('save','mill_view');return show(title(p),`<div class="buy-sheet" data-buy-id="${esc(p.id)}"><div class="shop-item-photo">${shopPhoto(p,{esc,t,name:title(p),sourceOwner:cat?.owner})}</div>${p.test?`<p class="info">${t('TEST pack. Pay when you collect.','परीक्षण पैक। लेते समय पैसे दें।')}</p>`:''}<div class="shop-item-detail">${shopPrice(p,{t,esc,money,sourceOwner:cat?.owner})}</div><p class="pack">${esc(t(p.pack||PENDING_PACK))}</p><div class="buy-row">${cart[p.id]&&reserveReady(p)?stepper(p):reserveReady(p)?`<button class="add" data-action="add" data-id="${esc(p.id)}">${t('Add','जोड़ें')}</button>`:`<button class="add" type="button" disabled>${t('Ask Nia','निया से पूछें')}</button>`}</div><p>${t('Pay when you collect.','लेते समय पैसे दें।')}</p></div>`);}
const statusText = status => ({reserved:t('Reserved','बुक हो गया'),picked:t('Picked','पिक हो गया'),packed:t('Packed','पैक हो गया'),loaded:t('Loaded','लोड हो गया'),out_for_delivery:t('Out for delivery','डिलीवरी के लिए निकला'),at_stop:t('Out for delivery','डिलीवरी के लिए निकला'),collect_at_stop:t('Collect at stop','स्टॉप पर लें'),collected:t('Collect at stop','स्टॉप पर लें'),expired:t('Reservation expired','बुकिंग का समय समाप्त'),cancelled:t('Cancelled','रद्द'),completed:t('Completed','पूरा हुआ'),return_pending:t('Return being checked','वापसी की जाँच हो रही है'),returned:t('Returned','वापस हो गया')})[status] || status;
function ordersView(){return `<div class="page"><h1>${t('Your orders & stays','आपके ऑर्डर और नेस्ट')}</h1>${earnHistory()}${nestOrdersView()}<button data-action="refresh-orders">${t('Refresh status','स्थिति ताज़ा करें')}</button><p></p>${orders.length?orders.map(o=>`<article class="order"><div class="row"><h2>${t('Your essentials','आपका ज़रूरी सामान')}</h2>${moneyStatusMarkup({status:o.status,centralAcknowledged:true,kind:'shop',record:o},{t,esc})||`<span class="badge">${esc(statusText(o.status))}</span>`}</div>${o.status==='reserved'?`<div class="code">${esc(o.pickupCode)}</div><p>${t('Show this code when you collect.','सामान लेते समय यह कोड दिखाएँ।')}<br><small>${esc(o.id)}</small></p>`:`<p>${t('Order reference','ऑर्डर संदर्भ')}: <small>${esc(o.id)}</small></p>`}<ul>${o.lines.map(l=>`<li>${esc(t(l.name))} × ${l.qty} · ${money(l.nia*l.qty)}</li>`).join('')}</ul><p><strong>${esc(t(o.location.name))}</strong><br>${esc(t(o.location.address))}<br>${esc(date(o.location.windowStart))} – ${esc(date(o.location.windowEnd))}</p>${o.status==='reserved'?`<p>${t('Collect before','इस समय से पहले लें')}: <strong>${esc(date(o.expiresAt))}</strong></p>`:''}<div class="receipt"><div class="row"><span>${t('Total','कुल')}</span><strong>${money(o.amount)}</strong></div><p>${o.refund?t('Refund recorded · see reference below','रिफंड दर्ज · संदर्भ नीचे देखें'):o.payment?.status==='received'?t('Payment received at pickup'):o.paid?t('UPI payment verified by staff','टीम ने UPI भुगतान की पुष्टि की'):o.status==='reserved'?t('Unpaid · Pay by UPI when you collect','भुगतान बाकी · सामान लेते समय UPI से दें'):t('Payment not recorded','भुगतान दर्ज नहीं है')}</p>${o.payment?.reference?`<small>${t('Payment reference','भुगतान संदर्भ')}: ${esc(o.payment.reference)}</small>`:''}${o.refund?`<p>${t('Refund reference','रिफंड संदर्भ')}: ${esc(o.refund.reference)} · ${money(o.refund.amount)}</p>`:''}</div><div class="order-actions">${o.status==='reserved'?`<button data-action="cancel" data-id="${o.id}">${t('Cancel reservation','बुकिंग रद्द करें')}</button>`:''}<button data-action="reorder" data-id="${o.id}">${t('Add again','फिर जोड़ें')}</button><button data-action="order-help" data-id="${o.id}">${t('Get help','मदद लें')}</button></div>${issues.filter(v=>v.orderId===o.id).map(v=>supportIssueLine(v,{t,esc})).join('')}</article>`).join(''):`<div class="panel empty"><h2>${t('No essentials orders yet','अभी सामान का कोई ऑर्डर नहीं')}</h2><p>${t('Once you reserve, your collection code and updates appear here.','बुकिंग के बाद आपका कोड और स्थिति यहाँ दिखेंगे।')}</p><button data-action="shop">${t('Browse essentials','ज़रूरी सामान देखें')}</button></div>`}${footer()}</div>`;}
function accountView(){if(owner.active)return ownerAccountMarkup(esc);return `<div class="page"><h1>${t('Your account','आपका खाता')}</h1><section class="panel stack">${account?`<h2>${esc(t(account.name))}</h2><div class="account-actions"><button data-action="membership">${icon('account')}<span>${t('Membership status')}</span>${icon('arrow')}</button><button data-action="partners">${icon('account')}<span>${t('Partner services')}</span>${icon('arrow')}</button><button data-action="orders">${icon('orders')}<span>${t('Orders & stays','ऑर्डर और नेस्ट')}</span>${icon('arrow')}</button><button data-action="help">${icon('account')}<span>${t('Contact your Nia team','अपनी निया टीम से संपर्क करें')}</span>${icon('arrow')}</button></div>`:`<h2>${t('Welcome to Niasave','नियासेव में आपका स्वागत है')}</h2><p>${t('Sign in to reserve a Nest, order essentials and follow your updates.','बुकिंग, ऑर्डर की स्थिति और सामान लेने के लिए साइन इन करें।')}</p><button class="primary" data-action="login">${t('Member sign in','सदस्य साइन इन')}</button><button data-action="owner-login">Owner access</button><button data-action="help">${t('Contact your Nia team','अपनी निया टीम से संपर्क करें')}</button>`}<button class="quiet" data-action="recovery">${t('Changed your phone number?','फोन नंबर बदल गया है?')}</button>${account?`<button class="quiet" data-action="logout">${t('Sign out','साइन आउट')}</button>`:''}</section>${cat?.preview?`<p class="info">${t('Preview accounts are examples. Sign in with your Nia membership to place real orders.','प्रीव्यू खाते उदाहरण हैं। असली प्रवेश के लिए सत्यापित खाता चाहिए।')}</p>`:''}${footer()}</div>`;}
// Public presentation only: never render a cached member, balance, order or availability here.
function entryHomepage(){const data=homeAccountId===account?.id?homeData:{stay:{status:'loading'},earn:{status:'loading'},fee:{status:'loading'},send:{status:'loading'}};return homeDashboardMarkup(homeDashboardModel({stay:data.stay,earn:data.earn,fee:data.fee,send:data.send,catalogue:cat?{status:'ready',data:cat}:{status:entryError?'unavailable':'loading'},online:navigator.onLine}),{t,esc,icon});}
function render(){const dispose=disposeEarnMap;disposeEarnMap=()=>{};dispose();if(page==='bag'){bagOpen=true;page='shop';if(location.hash!=='#shop')history.replaceState(null,'','#shop');}const pickingLang=!languageSticky()&&!owner.active;document.body.classList.toggle('mesha-lang-open',pickingLang);document.body.classList.toggle('mesha-dark',!pickingLang);document.body.classList.toggle('mesha-bag-open',bagOpen&&page==='shop');nav();notice();renderShell();document.body.classList.remove('signin-open');if(pickingLang){$('#content').innerHTML=languageCard();prepareJourney(document);return;}$('#content').innerHTML=page==='home'?entryHomepage():page==='live'?liveView():page==='earn'?earnView():page==='send'?sendView():page==='shop'?shop():page==='orders'?ordersView():accountView();ownerControls();applyCommitmentGate();prepareJourney(document);if(page==='earn'&&!owner.active&&account)disposeEarnMap=mountMap(mapModel(earnData),t);}
async function refresh(){entryError='';setSaveCapabilities(null);try{cat=await api('/catalogue');setSaveCapabilities(cat.capabilities);shellReadAt=Date.now();shellReadFailed=false;}catch(e){shellReadFailed=true;entryError=e.message;throw e;}finally{entryLoading=false;}if(owner.active){account=null;if(!['live','earn','shop','send','account'].includes(page))page='live';if(page==='earn')await loadEarn();if(page==='live'){try{await loadNests();}catch(e){nestData={offers:[],error:e.message};}}render();return;}account=cat.account?.role==='member'?cat.account:null;if(!account){homeAccountId=null;homeData={stay:{status:'source_missing'},earn:{status:'source_missing'},fee:{status:'source_missing'},send:{status:'source_missing'}};if(page==='live'){try{await loadNests();}catch(e){nestData={offers:[],error:e.message};}}render();return;}if(earnPending&&earnPending.accountId!==account?.id){earnPending=null;save('nia-earn-pending',null);}if(page==='home')await loadHome();if(page==='earn')await loadEarn();if(page==='send')await loadBooks();if(nestPending&&nestPending.accountId!==account?.id){nestPending=null;save('nia-nest-pending',null);}if(pending&&pending.accountId!==account?.id){pending=null;save('nia-commerce-pending',null);}for(const [id,q] of Object.entries(account||cat.memberAuth!=='passkey'?cart:{}))if(!cat.products.some(p=>p.id===id)||!Number.isInteger(q)||q<1||q>10)delete cart[id];save('nia-commerce-bag',cart);if(page==='live'){try{await loadNests();}catch(e){nestData={offers:[],error:e.message};}}if(page==='orders'&&account){await loadMemberOrders();}render();}
async function go(next,{fromHistory=false}={}){
  next=memberPages.has(next)?next:'home';
  if(next==='bag'){bagOpen=true;next='shop';}
  else if(next!=='shop'){bagOpen=false;aisle='';}
  if(owner.active&&!['live','earn','shop','send','account'].includes(next))next='account';
  const version=++navigationVersion;
  page=next;
  if(location.hash!=='#'+next)history[fromHistory?'replaceState':'pushState'](null,'','#'+next);
  $('#dialog').close();
  if(!account&&!owner.active&&next==='orders'){page='account';history.replaceState(null,'','#account');render();login();return;}
  // Each screen handles missing data; a failed catalogue must not block browsing.
  if(next==='home')await loadHome();
  if(next==='earn')await loadEarn();
  if(next==='shop'&&!owner.active)emitAnalytics('save','catalogue_view');
  if(next==='send')await loadBooks();
  if(next==='live'){try{await loadNests();}catch(e){nestData={offers:[],error:e.message};}}
  if(next==='orders'){
    if(!account){page='account';history.replaceState(null,'','#account');render();login();return;}
    try{await loadMemberOrders();}catch(e){if(version!==navigationVersion)return;toast(e.message);page='account';history.replaceState(null,'','#account');}
  }
  if(version!==navigationVersion)return;
  render();window.scrollTo(0,0);$('#content').focus({preventScroll:true});
}
function syncLocation(){const setup=takePasskeySetup(location,history);if(setup)passkeySetupToken=setup;const next=pageFromLocation();if(setup||next!==page||location.hash!=='#'+next)go(next,{fromHistory:true}).then(()=>{if(setup&&cat?.memberAuth==='passkey')login();}).catch(e=>toast(e.message));}
window.addEventListener('hashchange',syncLocation);
window.addEventListener('popstate',syncLocation);
async function finishPasskey(mode,setupToken){
  if(busy)return;busy=true;$('#dialog-body').setAttribute('aria-busy','true');
  try{await usePasskey(api,mode,setupToken);if(mode==='register')passkeySetupToken='';await finishMemberSession();}
  catch(e){const error=$('#form-error');if(error)error.textContent=e.code?errorText(e.code):e.message;else toast(e.code?errorText(e.code):e.message);}
  finally{busy=false;$('#dialog-body').removeAttribute('aria-busy');}
}
function entryLanguage(){return `<div class="entry-language">${languagePicker()}</div>`;}
function showPhoneLogin(){challenge='';passwordToken='';pendingPassword='';authStep='phone';show(t('Sign in to Niasave','नियासेव में साइन इन करें'),phoneFormMarkup({t,esc,phone:authPhone,passwordLink:usesPasswordAuth(cat)})+entryLanguage());}
function showPasswordLogin(){authStep='password';show(t('Member sign in'),passwordFormMarkup({t,esc,phone:authPhone,phoneLink:true})+entryLanguage());}
function login(){
  if(!cat)return show(t('Member sign in'),`<div class="stack"><p role="status">${esc(entryLoading?t('Loading…'):entryError||t('We could not complete that request. Please try again or ask your Nia team for help.'))}</p><button class="primary" data-action="entry-retry" ${entryLoading?'disabled':''}>${t('Try again','फिर कोशिश करें')}</button><button class="quiet" data-action="owner-login">Owner access</button></div>`);
  if(cat.memberAuth==='passkey')return show(t('Member sign in'),passkeyMarkup({t,setup:Boolean(passkeySetupToken)})+entryLanguage());
  if(cat.preview)return show(t('Sign in to Niasave','नियासेव में साइन इन करें'),`<div class="stack"><p class="info">${t('Preview access — no real OTP, orders or payment.','प्रीव्यू प्रवेश — असली OTP, ऑर्डर या भुगतान नहीं।')}</p><button class="primary" data-action="preview-login" data-id="member">${t('Continue as preview member','प्रीव्यू सदस्य के रूप में जारी रखें')}</button></div>`);
  if(authStep==='password'&&usesPasswordAuth(cat))return showPasswordLogin();
  if(usesPhoneOtpFlow(cat)||authStep==='phone')return showPhoneLogin();
  if(cat.memberAuth==='password')return showPasswordLogin();
  return showPhoneLogin();
}
function recovery(){show(t('Changed your number?','नंबर बदल गया है?'),`<form id="recovery-form" class="stack"><p>${t('Keep your member ID, orders and history. Your Nia team will verify your identity before changing account access.','आपकी सदस्य ID, ऑर्डर और इतिहास वही रहेंगे। खाता बदलने से पहले निया टीम आपकी पहचान जाँचेगी।')}</p><label>${t('Member ID','सदस्य ID')}<input name="memberId" autocomplete="off" maxlength="100" pattern="[a-zA-Z0-9_-]+" required></label><label>${t('New mobile number','नया मोबाइल नंबर')}<input name="phone" type="tel" inputmode="numeric" pattern="[6-9][0-9]{9}" maxlength="10" required></label><p><small>${t('This number is used only so the Nia team can resolve your access request.','इस नंबर का उपयोग निया टीम केवल आपकी मदद के लिए करेगी।')}</small></p><div id="form-error" class="error-inline" role="alert"></div><button class="primary">${t('Request help','मदद माँगें')}</button></form>`);}
async function review(){if(!saveCommitmentReady())return toast(t(SAVE_PAUSED_COPY));if(bagHasUnconfirmedPack(cat?.products||[],cart)){toast(t('Ask Nia about this pack.','इस पैक के बारे में निया से पूछें।'));return;}if(!account){checkoutPending=true;return checkoutSignIn();}checkoutPending=false;if(bagOpen){bagOpen=false;render();}if(pending){show(t('Check your reservation','अपनी बुकिंग जाँचें'),`<p>${t('Your last request may have reached us. Retry the same request to retrieve your order without creating a duplicate.','पिछला अनुरोध पहुँच गया हो सकता है। उसी अनुरोध को फिर भेजें; दूसरा ऑर्डर नहीं बनेगा।')}</p><button class="primary full" data-action="confirm">${t('Retry safely','सुरक्षित रूप से फिर कोशिश करें')}</button><div id="form-error" class="error-inline" role="alert"></div>`);return;}
const availableLocations=cat.locations.filter(l=>account.locationIds.includes(l.id)&&l.modes.includes(fulfillment));show(t('Pay when you collect','लेते समय पैसे दें'),`<form id="review-form" class="stack">${fulfillmentToggle()}<label>${fulfillment==='pickup'?t('Where will you collect?','सामान कहाँ लेंगे?'):t('Where should we deliver?','सामान कहाँ पहुँचाएँ?')}<select name="locationId" required><option value="">${t('Choose a location','जगह चुनें')}</option>${availableLocations.map(l=>`<option value="${l.id}" ${l.id===locationId?'selected':''}>${esc(t(l.name))}</option>`).join('')}</select></label><input type="hidden" name="fulfillment" value="${fulfillment}"><p class="info">${t('Pay by UPI when you collect your bag. Nothing online.','बैग लेते समय UPI से पैसे दें। ऑनलाइन कुछ नहीं।')}</p><div id="form-error" class="error-inline" role="alert"></div><button class="primary">${t('Check price','कीमत देखें')}</button></form>`);}
async function confirm(){if(!saveCommitmentReady())return toast(t(SAVE_PAUSED_COPY));if(busy)return;if(!pending&&draft){pending=draft;draft=null;save('nia-commerce-pending',pending);}if(!pending)return;busy=true;const btn=$('[data-action="confirm"]');if(btn){btn.disabled=true;btn.textContent=t('Confirming…','पुष्टि हो रही है…');}try{const order=await api('/orders',pending.body,'POST',pending.key);pending=null;save('nia-commerce-pending',null);cart={};save('nia-commerce-bag',cart);await go('orders');emitAnalytics('save','reservation',{outcome:'reserved'});toast(t('Reserved. Your collection code is ','बुक हो गया। आपका कोड है ')+order.pickupCode);}catch(e){if(!e.uncertain&&e.code!=='service_unavailable'&&e.code!=='save_storage_unavailable'&&e.code!=='state_conflict'){pending=null;save('nia-commerce-pending',null);}if($('#form-error'))$('#form-error').textContent=e.message;if(btn){btn.disabled=false;btn.textContent=t('Try again','फिर कोशिश करें');if(!pending){btn.dataset.action='review';btn.textContent=t('Review again','फिर जाँचें');}}}finally{busy=false;}}
function saveSearch(){return `<form id="save-search-form" class="save-search" role="search"><label class="visually-hidden">${t('Search essentials','ज़रूरी सामान खोजें')}</label><input type="search" name="q" value="${esc(search)}" placeholder="${t('Search oils, soap…','तेल, साबुन खोजें')}" maxlength="40" aria-label="${t('Search essentials','ज़रूरी सामान खोजें')}"></form>`;}
function saveTabs(){const pills=saveCategories.filter(c=>['all','food','cleaning','personal-care'].includes(c.id));return `<nav class="save-categories save-pills" aria-label="${t('Save categories','बचत की श्रेणियाँ')}">${pills.map(c=>`<button type="button" data-action="category" data-id="${c.id}" aria-pressed="${category===c.id}"><span>${savePill(c)}</span></button>`).join('')}</nav>`;}
function categoryEmpty(){const c=saveCategories.find(c=>c.id===category);const isSearch=Boolean(search.trim());const line=isSearch?t('No matching products','कोई उत्पाद नहीं मिला'):category==='all'?t('No essentials available yet','अभी सामान उपलब्ध नहीं है'):t('No products in this category yet','इस श्रेणी में अभी कोई उत्पाद नहीं है');return `<div class="empty category-empty picture-state">${icon(c?.icon||'shop')}<p>${line}</p><button data-action="clear-search">${t('Show all essentials','सभी सामान देखें')}</button></div>`;}
function insuranceView(){return `<header class="store-head"><h1>${t('Save')}</h1></header>${saveTabs()}<div class="service-grid">${[[t('Medical','चिकित्सा'),'/assets/insurance-accident-v2.jpg'],[t('Life','जीवन'),'/assets/insurance-life-v2.jpg']].map(([name,src])=>`<article class="store-nest"><img class="store-purpose" src="${src}" alt="" width="800" height="600"><div class="stack"><h2>${name}</h2><span class="badge">${t('Not yet','अभी नहीं')}</span><button data-action="partners" data-id="insurance">${t('View','देखें')}</button></div></article>`).join('')}</div>${footer()}${bagChip()}${bagOpen?bagLayer():''}`;}
async function loadEarn(){if(!account&&!owner.active){earnData={jobs:[]};applications=[];earnError='signed_out';earnLoading=false;return;}earnError='';earnLoading=true;try{earnData=await api('/earn');applications=account?(await api('/earn/applications')).applications:[];
    const projection=mapModel(earnData);
    emitAnalytics('earn','projection_status',{status:['ready','unavailable'].includes(projection.status)?projection.status:'other'});
    for(const application of applications){
      const event={contacted:'review',interview:'interview',selected:'offer',closed:'rejection'}[application.status];
      emitObservedState('earn',application.id,application.status,event);
    }}catch(e){earnData={jobs:[]};applications=[];earnError=e.code||e.message;}finally{earnLoading=false;}}
const applicationStatus = value => ({interested:t('Application received','आवेदन मिल गया'),contacted:t('Team contacted you','टीम ने आपसे संपर्क किया'),interview:t('Interview arranged','इंटरव्यू तय हुआ'),selected:t('Selected','चयन हुआ'),closed:t('Application closed','आवेदन बंद हुआ'),withdrawn:t('Application withdrawn','आवेदन वापस लिया गया')})[value]||value;
function earnHistory(){
  const visible=applications.filter(a=>cat?.preview||(a.job?.preview!==true&&a.job?.test!==true));
  const current=visible.filter(a=>!a.historical), previous=visible.filter(a=>a.historical);
  const card=a=>`<article class="order"><div class="row"><h3>${esc(t(a.job.title))}</h3>${a.historical?`<span class="badge">${t('Historical record')}</span>`:`${moneyStatusMarkup({status:a.status,centralAcknowledged:true,kind:'earn'},{t,esc})}<span class="badge">${esc(applicationStatus(a.status))}</span>`}</div><p>${esc(a.job.employer)} · ${esc(a.job.city)}</p>${a.historical?`<p>${t('Last recorded status')}: ${esc(applicationStatus(a.status))}</p>`:''}${a.message?`<p class="info">${esc(t(a.message))}</p>`:''}${!a.historical&&['interested','contacted','interview'].includes(a.status)&&Number.isInteger(a.revision)?`<button type="button" data-action="earn-withdraw" data-id="${esc(a.id)}" ${!navigator.onLine?'disabled':''}>${t('Withdraw request','आवेदन वापस लें')}</button>`:''}<small>${esc(a.id)} · ${esc(date(a.updatedAt))}</small></article>`;
  return `${visible.length?`<section class="stack"><h2>${t('Your job applications','आपके नौकरी के आवेदन')}</h2>${current.map(card).join('')}${previous.length?`<details class="panel stack earn-previous"><summary>${t('Previous applications')} (${previous.length})</summary><p>${t('Earlier records kept for reference. These are not current application updates.')}</p>${previous.map(card).join('')}</details>`:''}</section>`:''}`;
}
function earnErrorPanel(){
  const loginBtn=`<button class="primary" data-action="login">${t('Sign in','साइन इन')}</button>`;
  if(earnLoading)return pictureState('loading',t('Checking jobs…','नौकरियाँ देखी जा रही हैं…'));
  const signedIn=Boolean(account||owner.active||sessionExpired);
  const kind=stayErrorKind(earnError,{signedIn});
  if(kind==='signedOut'||(!account&&!owner.active&&!sessionExpired))return pictureState('signed-out',t('Sign in to see jobs near your Nest','नेस्ट के पास नौकरियाँ देखने के लिए साइन इन करें।'),loginBtn);
  if(kind==='expired')return pictureState('expired',t('Please sign in again to continue.','जारी रखने के लिए फिर साइन इन करें।'),loginBtn);
  if(kind==='network'||!navigator.onLine)return pictureState('network',t("We couldn’t load jobs. Please try again.",'नौकरियाँ लोड नहीं हुईं। फिर कोशिश करें।'),`<button class="primary" data-action="earn">${t('Try again','फिर कोशिश करें')}</button>`);
  if(earnError)return pictureState('network',esc(earnError),`<button class="primary" data-action="earn">${t('Try again','फिर कोशिश करें')}</button>`);
  return '';
}
function earnView(){if(owner.active)return ownerEarnMarkup(earnData,earnError,{esc,money});
  const signedOut=!account&&!owner.active;
  const model=mapModel(earnData), projectionState=earnProjectionState({data:earnData,error:earnError,loading:earnLoading,online:navigator.onLine,signedOut});
  const mapped=model.status==='ready'&&['ready','empty'].includes(projectionState);
  const displayModel={...model,jobs:model.jobs.filter(j=>cat?.preview||(j.preview!==true&&j.test!==true))};
  const visible=projectionState==='ready'?displayModel.jobs:[];
  const projectionCopy={loading:t('Checking Central jobs'),ready:t('Verified open jobs near your Nest'),stale:t('Job locations need refreshing'),source_missing:t('Verified Nest location is not available'),unavailable:t('Job projection is temporarily unavailable'),empty:t('No verified open jobs nearby'),offline:t('Offline. Reconnect to check jobs')};
  const taskAction=signedOut?`<button type="button" class="primary mesha-pill mesha-pill-solid" data-action="login">${t('Sign in','साइन इन')}</button>`:`<button type="button" class="mesha-pill mesha-pill-ghost" data-action="earn">${t('See jobs','नौकरियाँ देखें')}</button>`;
  return `<section class="store-screen store-earn"><header class="store-head store-task"><h1>${t('Earn')}</h1><p>${t('Jobs near your Nest','आपके नेस्ट के पास नौकरियाँ')}</p>${taskAction}</header><figure class="store-task-photo"><img src="/assets/earn.jpg" alt="" width="1168" height="728"></figure>
  ${earnErrorPanel()}
  <p class="pillar-state" data-state="${projectionState}" role="status">${esc(projectionCopy[projectionState])}</p>
  ${signedOut?'':`<div class="earn-layout">${mapMarkup(mapped?displayModel:{status:projectionState==='stale'?'stale':'unavailable',jobs:[]},t,icon)}<section class="stack earn-results" aria-label="${t('Open jobs','खुली नौकरियाँ')}"><div><div class="eyebrow">WALK2WORK</div><h2>${t('Jobs near your Nest','आपके नेस्ट के पास नौकरियाँ')}</h2><p>${mapped?t('Closest locations first','सबसे पास की जगहें पहले'):t('Verified workplace locations will help you compare your journey.','काम की जगहों की पुष्टि से आपको आने-जाने की दूरी समझने में मदद मिलेगी।')}</p></div>
  ${earnPending?`${moneyStatusMarkup({status:'requested',offlineQueued:!navigator.onLine,kind:'earn'},{t,esc})}<button data-action="earn-retry">${t('Retry application safely','आवेदन सुरक्षित रूप से फिर भेजें')}</button>`:''}
  ${visible.length?visible.map((j,index)=>`<article class="panel stack earn-job" id="earn-job-${esc(j.id)}" tabindex="-1"><div class="row"><h3>${mapped?`<span class="earn-job-number">${index+1}</span>`:''}${esc(t(j.title))}</h3>${j.preview?`<span class="badge">${t('Preview')}</span>`:''}</div><p>${esc(j.employer)} · ${esc(j.city)}</p>${mapped?`<span class="earn-distance">${j.distanceKm.toFixed(1)} km · ${t('straight-line distance','सीधी रेखा में दूरी')}</span><p>${j.openPositions} ${t('open positions','खाली पद')}</p>`:''}<div class="earn-compare-cost">${mapJobDetails(j,index,model.studio,t)}</div><details class="earn-job-details"><summary>${t('Shift, requirements & apply')}</summary><p>${esc(t(j.shift))}</p><p>${esc(t(j.requirements))}</p>${jobTerms(j)?`<p>${esc(jobTerms(j))}</p>`:''}<small>${t('Apply before','इस समय से पहले आवेदन करें')}: ${esc(date(j.closesAt))}</small><button class="primary" data-action="earn-apply" data-id="${esc(j.id)}" ${applications.some(a=>a.job.id===j.id)||!navigator.onLine?'disabled':''}>${applications.some(a=>a.job.id===j.id)?t('Application received','आवेदन मिल गया'):t('Apply for this job','इस नौकरी के लिए आवेदन करें')}</button></details></article>`).join(''):`<div class="picture-state" data-state="empty">${icon('earn')}<p>${mapped?t('No jobs open right now','अभी कोई नौकरी खुली नहीं है'):t('Open jobs are being connected','खुली नौकरियाँ जोड़ी जा रही हैं')}</p></div>`}
  </section></div><section class="stack service-panel">${earnHistory()}</section>`}${footer()}</section>`;
}
async function reviewJob(id){if(!commitmentReady())return toast(t(PILOT_CLOSED_COPY));if(!account){login();return;}if(earnPending){show(t('Check your application','अपना आवेदन जाँचें'),`<p>${t('Your last request may have reached us. Retry safely to retrieve it.','पिछला अनुरोध पहुँच गया हो सकता है। उसे पाने के लिए सुरक्षित रूप से फिर कोशिश करें।')}</p><button class="primary" data-action="earn-retry">${t('Retry application safely','आवेदन सुरक्षित रूप से फिर भेजें')}</button><div id="form-error" role="alert"></div>`);return;}const j=earnData.jobs.find(j=>j.id===id);if(!j)return;emitAnalytics('earn','job_view');show(t('Apply for this job','इस नौकरी के लिए आवेदन करें'),`<form id="earn-form" class="stack"><h3>${esc(t(j.title))}</h3><p>${esc(j.employer)} · ${esc(j.city)}</p><p>${money(j.payMin)}–${money(j.payMax)} / ${esc(t(j.payPeriod))}</p><p>${esc(t(j.shift))}</p>${jobTerms(j)?`<p>${esc(jobTerms(j))}</p>`:''}<input type="hidden" name="jobId" value="${esc(j.id)}"><input type="hidden" name="revision" value="${esc(j.revision)}"><label><input type="checkbox" name="consent" required> ${t('Share my member details with the Nia Walk2Work team about this job. Applying does not confirm a job or a payment.','इस नौकरी के लिए मेरी सदस्य जानकारी निया Walk2Work टीम से साझा करें। आवेदन से नौकरी या भुगतान की पुष्टि नहीं होती।')}</label><button class="primary">${t('Send application','आवेदन भेजें')}</button><div id="form-error" role="alert"></div></form>`);}
async function confirmJob(){if(!commitmentReady())return toast(t(PILOT_CLOSED_COPY));if(busy||!earnPending)return;if(earnPending.accountId!==account?.id){login();return;}busy=true;try{await api('/earn/applications',earnPending.body,'POST',earnPending.key);earnPending=null;save('nia-earn-pending',null);await go('earn');emitAnalytics('earn','submission',{outcome:'received'});toast(t('Application received','आवेदन मिल गया'));}catch(e){if(!e.uncertain&&!['service_unavailable','save_storage_unavailable','state_conflict'].includes(e.code)){earnPending=null;save('nia-earn-pending',null);}if($('#form-error'))$('#form-error').textContent=e.message;else toast(e.message);}finally{busy=false;}}

function sendView(){if(owner.active)return ownerSendMarkup();
  const signedOut=!account&&!owner.active;
  const state=sendViewState({data:booksData,online:navigator.onLine,signedOut});
  const labels={loading:t('Checking your money plan'),ready:t('Recorded entries available'),stale:t('Statement needs refreshing'),source_missing:t('Some statement sources are missing'),unavailable:t('Statement temporarily unavailable'),empty:t('No recorded entries yet'),offline:t('Offline. This may be an older statement')};
  const taskAction=signedOut?`<button type="button" class="primary" data-action="login">${t('Sign in','साइन इन')}</button>`:'';
  return `<section class="store-screen store-send send-v2"><header class="store-head store-task"><h1>${t('Send')}</h1><p class="nia-transfer-status" role="status"><span class="badge">${t('Transfers not active','ट्रांसफ़र अभी सक्रिय नहीं')}</span></p><p>${t('Send is a plan. Saving it does not move money.')}</p>${taskAction}</header><p class="pillar-state" data-state="${state}" role="status">${esc(labels[state])}</p>${signedOut?pictureState('signed-out',t('Sign in to see your money plan','पैसे की योजना देखने के लिए साइन इन करें।'),taskAction):state==='loading'?pictureState('loading',t('Checking your money plan')):booksMarkup(booksData,booksMonth,account,{t,esc,money})}<section class="panel stack books-transfer"><div class="row"><h2>${t('Transfers','ट्रांसफ़र')}</h2><span class="badge">${t('Transfers not active','ट्रांसफ़र अभी सक्रिय नहीं')}</span></div><p>${t('Only a Nia team recorded payment appears as paid. A saved plan is not a transfer.')}</p></section>${footer()}</section>`;}

async function loadNests(){nestData=nestStart?await api('/nests/availability',{start:nestStart}):await api('/nests');nestStart=nestData.start;emitAnalytics('live','availability_search',{outcome:(nestData.offers||[]).length?'results':'empty'});}
// Local illustrative artwork only. Jat's published studio media will replace this preview map.
const previewNestImages = {
  'std-35005': {src:'/assets/studio-bunk-lockers.jpg', width:1024, height:1024},
  'std-34696': {src:'/assets/nest-blr-demo.jpg', width:1586, height:992},
  'std-34998': {src:'/assets/nest-chk-demo.jpg', width:1536, height:1024},
};
function nestPhoto(n){
  const media=n.photo?.url?{src:n.photo.url,width:n.photo.width||1200,height:n.photo.height||900}:null;
  const image=media||(cat?.preview?previewNestImages[n.studioId]||{src:'/assets/studio-bunk-lockers.jpg',width:1024,height:1024}:null);
  const caption=n.test?t('Illustrative test studio. Not a real Nest.','उदाहरण टेस्ट स्टूडियो। असली नेस्ट नहीं।'):t('Illustrative shared studio with bunks and lockers','बंक और लॉकर वाले साझा स्टूडियो का उदाहरण');
  return image?`<div class="nest-image"><img src="${esc(image.src)}" width="${image.width}" height="${image.height}" alt="${esc(n.name)} · ${esc(caption)}" loading="lazy"></div>`:`<div class="nest-image"><span class="shop-photo-missing">${esc(t('Photo not supplied by Central'))}</span></div>`;
}
function liveView(){const offers=(nestData?.offers||[]).filter(n=>cat?.preview||(n.test!==true&&n.preview!==true));return `<section class="store-screen store-live"><header class="store-head"><h1>${t('Live')}</h1><p>${t('Find a place near work.','काम के पास रहने की जगह देखें।')}</p></header><form id="nest-search-form" class="store-date nest-search"><label>${t('Move in','आएँ')}<input type="date" name="start" value="${esc(nestStart)}" min="${esc(nestData?.minDate)}" max="${esc(nestData?.maxDate)}" required></label><button class="primary" type="submit">${t('See Nests','नेस्ट देखें')}</button></form>${!owner.active&&nestPending?`${moneyStatusMarkup({status:'requested',offlineQueued:!navigator.onLine,kind:'live'},{t,esc})}<p class="info">${t('A Nest request is awaiting confirmation. Retry safely to check its result.','नेस्ट अनुरोध की पुष्टि बाकी है। नतीजा जाँचने के लिए फिर कोशिश करें।')} <button data-action="nest-confirm">${t('Check my request','मेरा अनुरोध जाँचें')}</button></p>`:''}<div class="nest-grid">${offers.map(n=>`<article class="nest-card store-nest">${nestPhoto(n)}<div class="stack"><h2>${esc(n.name)}</h2>${n.test?`<p class="muted nest-test-flag">${t('Illustrative test studio. Not a real Nest.','उदाहरण टेस्ट स्टूडियो। असली नेस्ट नहीं।')}</p>`:''}${n.test?'':pricePair(0,n.rent)}${n.test?`<button class="primary full" data-action="nest-preview" data-id="${esc(n.studioId)}">${t('View still','स्टिल देखें')}</button>`:`<button class="primary full" data-action="nest-review" data-id="${esc(n.studioId)}" ${!n.available||!navigator.onLine?'disabled':''}>${t('View','देखें')}</button>`}</div></article>`).join('')}</div>${offers.length?'':stayPanel()}${footer()}</section>`;}
async function loadMemberOrders(){await loadEarn();orders=(await api('/orders')).orders;
  for(const order of orders){const event={ready:'ready',collected:'collection'}[order.status];emitObservedState('save',order.id,order.status,event);}
  issues=(await api('/support')).issues;nestOrdersError='';try{nestOrders=(await api('/nests/bookings')).bookings;
    for(const booking of nestOrders){const event={expired:'expiry',in:'check_in',out:'check_out'}[booking.status];emitObservedState('live',booking.id,booking.status,event);}
  }catch(e){nestOrders=[];nestOrdersError=e.message;}}
function nestOrdersView(){if(nestOrdersError)return `<p class="info">${t('Nest status is temporarily unavailable.','नेस्ट की स्थिति अभी उपलब्ध नहीं है।')} ${esc(nestOrdersError)}</p>`;return nestOrders.length?`<section class="stack"><h2>${t('Your Nests','आपके नेस्ट')}</h2>${nestOrders.map(b=>`<article class="order"><div class="row"><h2>${esc(b.name)} · ${esc(b.nestId)}</h2>${moneyStatusMarkup({status:b.status,centralAcknowledged:true,kind:'live'},{t,esc})||`<span class="badge">${esc(b.status==='in'?t('Moved in','आ गए'):b.status==='out'?t('Checked out','निवास समाप्त'):statusText(b.status))}</span>`}</div><p>${esc(t(b.address))}<br>${esc(b.start)} → ${esc(b.end)}</p><p><strong>${t('Booking reference','बुकिंग संदर्भ')}: ${esc(b.id)}</strong></p>${b.status==='reserved'?`<p>${t('Meet your Nia team before the hold expires','नेस्ट रोकने का समय समाप्त होने से पहले निया टीम से मिलें')}: <strong>${esc(date(b.expiresAt))}</strong></p>`:''}<p>${b.status==='reserved'?t('Reserved move-in total','बुकिंग के समय आने पर कुल'):t('Recorded stay quote','दर्ज रहने का अनुमान')}: <strong>${money(b.quote.total)}</strong><br>${b.paidAmount?`${t('Recorded by the team','टीम द्वारा दर्ज')}: ${money(b.paidAmount)} · ${esc(b.paymentReferences.join(', '))}`:b.status==='reserved'?t('No payment recorded. Pay by UPI with the team at move-in.','कोई भुगतान दर्ज नहीं है। आते समय टीम को UPI से भुगतान करें।'):t('No payment recorded for this stay.','इस प्रवास का भुगतान दर्ज नहीं है।')}</p>${b.status==='reserved'?`<p class="muted">${t('Your reservation does not sign the agreement or check you in.','बुकिंग से समझौते पर हस्ताक्षर या चेक-इन नहीं होता।')}</p>`:''}<div class="order-actions">${b.canCancel&&commitmentReady()?`<button data-action="nest-cancel" data-id="${esc(b.id)}">${t('Cancel Nest reservation','नेस्ट की बुकिंग रद्द करें')}</button>`:''}<button data-action="help">${t('Ask your Nia team','अपनी निया टीम से पूछें')}</button></div></article>`).join('')}</section>`:'';}
async function previewTestNest(studioId){const n=(nestData?.offers||[]).find(o=>o.studioId===studioId);if(!n)return;show(n.name,`<div class="stack">${nestPhoto(n)}<p>${esc(n.theatre)} · ${esc(n.city)}</p><p>${esc(t(n.address))}</p><p class="info">${t('Illustrative test studio. Not a real Nest.','उदाहरण टेस्ट स्टूडियो। असली नेस्ट नहीं।')}</p><p>${t('Layout only. No reservation. No online payment.','केवल लेआउट। कोई बुकिंग नहीं। ऑनलाइन भुगतान नहीं।')}</p></div>`);}
async function reviewNest(studioId){if(!commitmentReady())return toast(t(PILOT_CLOSED_COPY));if(!account)return login();if(nestPending)return show(t('Check your Nest request','नेस्ट का अनुरोध जाँचें'),`<p>${t('Your previous request may have reached us. Retry to retrieve its result.','पिछला अनुरोध पहुँच गया हो सकता है। नतीजा देखने के लिए फिर कोशिश करें।')}</p><button class="primary full" data-action="nest-confirm">${t('Retry safely','सुरक्षित रूप से फिर कोशिश करें')}</button>`);const body={studioId,start:nestStart};const q=await api('/nests/quote',body);emitAnalytics('live','quote',{outcome:'available'});nestDraft={accountId:account.id,key:crypto.randomUUID(),body:{...body,fingerprint:q.fingerprint}};show(t('Review your Nest','अपना नेस्ट देखें'),`<div class="stack"><h3>${esc(q.name)}</h3><p>${esc(t(q.address))}<br>${esc(q.start)} → ${esc(q.end)} · ${t('30 days','30 दिन')}</p><div class="receipt"><div class="row"><span>${t('Stay','निवास')}</span><strong>${money(q.rent)}</strong></div><div class="row"><span>${t('Tax','कर')}</span><strong>${money(q.tax)}</strong></div><div class="row"><span>${t('Deposit','जमा')}</span><strong>${money(q.deposit)}</strong></div><div class="row"><strong>${t('Total at move-in','आते समय कुल')}</strong><strong class="price">${money(q.total)}</strong></div></div><p>${esc(t(q.terms))}</p><p class="info">${t('Nothing to pay online. Hold for up to','ऑनलाइन भुगतान नहीं। अधिकतम')} ${q.holdHours} ${t('hours, or until the end of your move-in day if sooner. Meet the team before expiry. Agreement and check-in are completed with the team.','घंटे या आने के दिन के अंत तक, जो पहले हो। समय समाप्त होने से पहले टीम से मिलें। समझौता और चेक-इन टीम के साथ पूरा होगा।')}</p><button class="primary" data-action="nest-confirm">${t('Reserve Nest · Pay at move-in','नेस्ट बुक करें · आते समय भुगतान करें')}</button><div id="form-error" role="alert" class="error-inline"></div></div>`);}
async function confirmNest(){if(!commitmentReady())return toast(t(PILOT_CLOSED_COPY));if(busy)return;if(!account)return login();if(!nestPending&&nestDraft){nestPending=nestDraft;nestDraft=null;save('nia-nest-pending',nestPending);}if(!nestPending)return;if(nestPending.accountId!==account.id){nestPending=null;save('nia-nest-pending',null);return;}busy=true;const btn=$('[data-action="nest-confirm"]');if(btn)btn.disabled=true;try{await api('/nests/bookings',nestPending.body,'POST',nestPending.key);nestPending=null;save('nia-nest-pending',null);await go('orders');emitAnalytics('live','hold_confirmation',{outcome:'reserved'});toast(t('Nest reserved. Check your reference and hold expiry below.','नेस्ट बुक हो गया। नीचे संदर्भ और समय सीमा देखें।'));}catch(e){if(!e.uncertain&&!['service_unavailable','save_storage_unavailable','state_conflict'].includes(e.code)){nestPending=null;save('nia-nest-pending',null);$('#dialog').close();await go('live');}if($('#form-error'))$('#form-error').textContent=e.message;else toast(e.message);}finally{busy=false;if(btn)btn.disabled=false;}}

document.addEventListener('click',async event=>{const button=event.target.closest('[data-action]');if(!button)return;event.preventDefault();const action=button.dataset.action,id=button.dataset.id;if(!commitmentActionReady(action))return;try{
if(action==='owner-login')return show('Owner access',ownerLoginMarkup()+`<button class="quiet full" data-action="entry-back">${t('Member sign in')}</button>`);
if(action==='owner-exit'){exitOwner();return location.reload();}
if(owner.active&&!ownerActions.has(action))return toast('Owner view is read only.');
if(action==='open-bag')return await openBag();
if(action==='close-bag'){closeBag();return;}
if(['home','live','earn','shop','send','bag','orders','account'].includes(action)){
  if(action==='bag')return await openBag();
  return await go(action);
}
if(action==='choose-lang')return await chooseLang(id);
if(action==='how-live')return show(t('How it works'),`<div class="stack"><p>${t('Move in with Nia. Roof, rest, and a short walk to the shift.','निया के साथ रहें। छत, आराम, और शिफ्ट तक थोड़ी पैदल दूरी।')}</p><p>${t('See nearby Nests, hold a bed, and pay at move-in. Browse first. Phone only when you check out.','पास के नेस्ट देखें, बिस्तर रोकें, और आते समय भुगतान करें। पहले देखें। फोन केवल चेकआउट पर।')}</p><button class="primary" data-action="live">${t('See Nest','नेस्ट देखें')}</button></div>`);

if(action==='nest-preview'){emitAnalytics('live','offer_view');return previewTestNest(id);}
if(action==='nest-review'){emitAnalytics('live','offer_view');return await reviewNest(id);}
if(action==='nest-confirm')return await confirmNest();
if(action==='nest-cancel')return show(t('Cancel your Nest reservation?','नेस्ट की बुकिंग रद्द करें?'),`<p>${t('Your hold will be released. No payment has been recorded.','आपका नेस्ट फिर उपलब्ध हो जाएगा। कोई भुगतान दर्ज नहीं है।')}</p><button class="primary full" data-action="nest-cancel-confirm" data-id="${esc(id)}">${t('Cancel Nest reservation','नेस्ट की बुकिंग रद्द करें')}</button>`);
if(action==='nest-cancel-confirm'){await api('/nests/cancel',{bookingId:id});emitAnalytics('live','cancellation',{outcome:'cancelled'});return await go('orders');}
if(action==='entry-retry'){if(entryLoading)return;entryLoading=true;try{await refresh();}catch{}finally{$('#dialog').close();}return;}
if(action==='entry-back')return login();
if(action==='phone-login')return showPhoneLogin();
if(action==='password-login')return showPasswordLogin();
if(action==='close'){nestDraft=null;draft=null;if(!account)checkoutPending=false;return $('#dialog').close();}
if(action==='passkey-signin'){await finishPasskey('authenticate');return;}if(action==='login')return login();if(action==='recovery')return await openMembership(true);
if(action==='membership')return await openMembership();
if(action==='partners')return await openPartners(id);
if(action==='partner-consent'){const p=partners.find(p=>p.partnerId===id);if(p)return show(t('Review request'),partnerConsentMarkup(p,serviceContext()));return;}
if(action==='partner-withdraw')return show(t('Withdraw request'),`<p>${t('Withdrawing stops further sharing. It cannot recall records already sent.')}</p><button class="primary" data-action="partner-withdraw-confirm" data-id="${esc(id)}">${t('Withdraw request')}</button>`);
if(action==='partner-withdraw-confirm'){await api('/partners/withdraw',{referralId:id});return await openPartners();}
if(action==='language')return show(t('Choose your language','अपनी भाषा चुनें'),languageButtons());
if(action==='order-help')return show(t('Help with this order','इस ऑर्डर में मदद'),supportFormMarkup({t,esc},{orderId:id,kinds:['missing_item','quality','late','return_refund','other']}));
if(action==='help')return show(t('Your Nia team','आपकी निया टीम'),`<div class="stack"><p>${esc(t(cat?.support||t('Ask your Nia team','अपनी निया टीम से पूछें')))}</p>${account?`${supportFormMarkup({t,esc},{kinds:['move_in','nest_details','job_details','application_update','identity_access']})}<button data-action="books-harassment">${t('Lender harassing you?')}</button><button data-action="recovery">${t('Help with a changed phone number','बदले हुए फोन नंबर के लिए मदद')}</button>`:`<button class="primary" data-action="login">${t('Member sign in','सदस्य साइन इन')}</button>`}</div>`);
if(action==='preview-login'){await api('/auth/preview',{role:id});return await finishMemberSession();}
if(action==='logout'){memberStatus=null;partners=[];partnerReferrals=[];planDrafts.clear();planState=null;planRequest=null;booksData=null;booksMonth='';booksRequest=null;applications=[];earnPending=null;save('nia-earn-pending',null);authPhone='';passwordToken='';pendingPassword='';authStep='';challenge='';await api('/auth/logout',{});account=null;orders=[];nestOrders=[];nestPending=null;save('nia-nest-pending',null);cart={};pending=null;save('nia-commerce-bag',{});save('nia-commerce-pending',null);await refresh();return;}
if(action==='fulfillment'){if(pending||busy||!['pickup','delivery'].includes(id)||!cat.locations.some(l=>(!account||account.locationIds.includes(l.id))&&l.modes.includes(id)))return;fulfillment=id;if(!cat.locations.some(l=>l.id===locationId&&l.modes.includes(id)))locationId='';if($('#review-form'))return review();render();document.querySelector(`[data-action="fulfillment"][data-id="${id}"]`)?.focus({preventScroll:true});return;}
if(action==='shop-hero'){category='all';aisle='';search='';render();return;}
if(action==='open-aisle'){if(!SHOP_CATEGORY_IDS.includes(id))return;aisle=id;search='';render();return;}
if(action==='close-aisle'){aisle='';render();return;}
if(action==='voice-search'){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition)return toast(t('Voice search is unavailable on this device.'));
  const recognition=new Recognition();recognition.lang=voiceLanguage(lang);recognition.interimResults=false;recognition.maxAlternatives=1;
  recognition.onresult=result=>{search=String(result.results?.[0]?.[0]?.transcript||'').trim().slice(0,40);aisle='';render();$('#shop-query')?.focus({preventScroll:true});};
  recognition.onerror=()=>toast(t('Voice search could not hear you. Type your search instead.'));
  try{recognition.start();}catch{toast(t('Voice search could not start. Type your search instead.'));}return;
}
if(action==='category'){if(!categoryId(id))return;emitAnalytics('save','category_view');category=id;aisle='';search='';render();return;}if(action==='clear-search'){search='';category='all';aisle='';render();return;}
if(action==='add'||action==='minus'){const p=cat.products.find(p=>p.id===id);if(!p)return;if(action==='add'&&!reserveReady(p)){toast(t('Ask Nia about this pack.','इस पैक के बारे में निया से पूछें।'));return;}const fromBuy=Boolean(button.closest('[data-buy-id]'));const q=Math.min(Math.min(10,p.available),(cart[id]||0)+(action==='add'?1:-1));if(q>0)cart[id]=q;else delete cart[id];save('nia-commerce-bag',cart);if(action==='add')emitAnalytics('save','add_to_bag');render();if(fromBuy)return showBuy(id);const focus=document.querySelector(`[data-action="${action==='minus'&&!cart[id]?'add':action}"][data-id="${id}"]`);focus?.focus({preventScroll:true});return;}
if(action==='open-buy'||action==='detail'){return showBuy(id);}
if(action==='books-plan'){if(!account)return login();return await openPlan();}
if(action==='books-plan-save')return await savePlan();
if(action==='books-plan-reload')return await openPlan();
if(action==='books-loans')return show(t('Lower-cost loan pathway'),healthSupportDialog('loans',t)+`<button data-action="partners" data-id="lending">${t('Review request')}</button>`);
if(action==='books-harassment')return show(t('Help with lender harassment'),healthSupportDialog('harassment',t)+`<button data-action="partners" data-id="harassment_support">${t('Review request')}</button>`);
if(action==='books-add'){if(booksRequest)return await submitBooks(booksRequest.body);return show(t('Add to NiaBooks'),personalEntryForm(null,id,{t,esc}));}
if(action==='books-edit'){const entry=personalEntry(id);if(entry)return show(t('Edit your entry'),personalEntryForm(entry,entry.kind,{t,esc}));return;}
if(action==='books-remove'){const entry=personalEntry(id);if(entry)return await submitBooks({id,revision:entry.revision,remove:true});return;}
if(action==='books-refresh')return await go('send');
if(action==='books-download')return downloadBooks(booksData,booksMonth);
if(action==='books-consent'){await api('/books/consent',{enabled:id==='on'});await loadBooks();render();$('[data-action="books-consent"]')?.focus({preventScroll:true});return;}
if(action==='earn-apply')return await reviewJob(id);if(action==='earn-retry')return await confirmJob();
if(action==='earn-withdraw')return show(t('Withdraw this application?','यह आवेदन वापस लें?'),
  `<p>${t('Your Nia team will see that you withdrew this request.','आपकी निया टीम देखेगी कि आपने यह अनुरोध वापस लिया है।')}</p><button class="primary full" data-action="earn-withdraw-confirm" data-id="${esc(id)}">${t('Withdraw request','आवेदन वापस लें')}</button>`);
if(action==='earn-withdraw-confirm'){
  if(!commitmentReady())return toast(t(PILOT_CLOSED_COPY));
  const application=applications.find(a=>a.id===id&&!a.historical);
  if(!application||!Number.isInteger(application.revision))return toast(t('Try again','फिर कोशिश करें'));
  const previous=load('nia-earn-withdraw-pending',null);
  const tap=previous?.accountId===account?.id&&previous.applicationId===id&&previous.expectedRevision===application.revision?
    previous:{accountId:account?.id,applicationId:id,expectedRevision:application.revision,key:crypto.randomUUID()};
  save('nia-earn-withdraw-pending',tap);
  try{
    await api('/earn/applications/withdraw',{applicationId:id,expectedRevision:tap.expectedRevision},'POST',tap.key);
    save('nia-earn-withdraw-pending',null);$('#dialog').close();await loadEarn();render();emitAnalytics('earn','withdrawal',{outcome:'withdrawn'});
    toast(t('Application withdrawn','आवेदन वापस लिया गया'));
  }catch(e){
    if(!e.uncertain){save('nia-earn-withdraw-pending',null);if(e.status===409){await loadEarn();render();}}
    toast(e.status===409?t('Try again','फिर कोशिश करें'):e.message);
  }
  return;
}
if(action==='review')return await review();if(action==='confirm')return await confirm();if(action==='refresh-orders')return await go('orders');
if(action==='cancel')return show(t('Cancel this reservation?','यह बुकिंग रद्द करें?'),`<p>${t('Nothing has been paid. Your reserved stock will be released.','कोई भुगतान नहीं हुआ है। बुक किया गया सामान फिर उपलब्ध हो जाएगा।')}</p><button class="primary full" data-action="cancel-confirm" data-id="${id}">${t('Cancel reservation','बुकिंग रद्द करें')}</button>`);
if(action==='cancel-confirm'){
  if(!saveCommitmentReady())return toast(t(SAVE_PAUSED_COPY));
  const order=orders.find(row=>row.id===id);
  if(!order||!Number.isInteger(order.revision))return toast(t('Try again','फिर कोशिश करें'));
  const previous=load('nia-commerce-cancel-pending',null);
  const tap=previous?.orderId===id?previous:
    {orderId:id,expectedRevision:order.revision,key:crypto.randomUUID()};
  save('nia-commerce-cancel-pending',tap);
  try{
    await api('/cancel',{orderId:tap.orderId,expectedRevision:tap.expectedRevision},'POST',tap.key);
    save('nia-commerce-cancel-pending',null);
    await go('orders');emitAnalytics('save','cancellation',{outcome:'cancelled'});return;
  }catch(e){
    if(!e.uncertain&&e.code!=='service_unavailable'&&e.code!=='state_conflict')
      save('nia-commerce-cancel-pending',null);
    throw e;
  }
}
if(action==='reorder'){const o=orders.find(o=>o.id===id);for(const l of o.lines){const p=cat.products.find(p=>p.id===l.id);if(p?.available)cart[l.id]=Math.min(l.qty,p.available,10);}save('nia-commerce-bag',cart);await go('bag');return toast(t('Added available items. Prices will be checked again.','उपलब्ध सामान जोड़ा गया। कीमतों की फिर जाँच होगी।'));}
}catch(e){if($('#dialog').open){let error=$('#dialog-body .error-inline');if(!error){error=document.createElement('p');error.className='error-inline';error.setAttribute('role','alert');$('#dialog-body').append(error);}error.textContent=e.message;}else toast(e.message);}});
document.addEventListener('input',event=>{if(event.target.matches('#books-plan-form input')){const values=Object.fromEntries(new FormData(event.target.form));planDrafts.set(currentPlanKey(),values);$('#plan-result').innerHTML=planResult(values,{t,money});if(planState?.status==='ready'&&planState.saveState!=='saving'){planState={...planState,saveState:planState.savedFields&&sameFields(fieldsFromValues(values),planState.savedFields)?'saved':'unsaved',error:null};refreshPlanStatus();}}});
document.addEventListener('submit',event=>{if(event.target.id==='books-plan-form')event.preventDefault();});
document.addEventListener('change',async event=>{if(event.target.matches('#books-entry-form [name="kind"]')){event.target.form.elements.namedItem('label').innerHTML=entryPurposeOptions(event.target.value,'',{t,esc});return;}if(event.target.matches('[data-books-month]')){booksMonth=event.target.value;render();$('[data-books-month]')?.focus({preventScroll:true});return;}if(event.target.matches('[data-language-select]')){const selector=event.target,next=selector.value;if(!validLanguage(next))return;selector.disabled=true;try{await chooseLang(next);($('#dialog').open?$('#dialog [data-language-select]'):$('[data-language-select]'))?.focus({preventScroll:true});}catch{selector.value=lang;toast(t('Language could not be loaded. Check your connection and try again.','भाषा लोड नहीं हुई। कनेक्शन जाँचकर फिर कोशिश करें।'));}finally{selector.disabled=false;}}});
document.addEventListener('submit',async event=>{if(owner.active&&event.target.id!=='nest-search-form'){event.preventDefault();return;}if(!['owner-login-form','passkey-setup-form','login-form','verify-form','set-password-form','remember-form','review-form','recovery-form','support-form','nest-search-form','save-search-form','earn-form','books-entry-form','member-enrol-form','member-recovery-form','partner-referral-form'].includes(event.target.id))return;event.preventDefault();const form=event.target,fields=Object.fromEntries(new FormData(form));const submit=form.querySelector('button[type=submit],button.primary');if(submit)submit.disabled=true;try{
if(form.id==='owner-login-form'){await signInOwner(fields);account=null;nestPending=null;orders=[];nestOrders=[];applications=[];page='live';history.replaceState(null,'','#live');form.reset();$('#dialog').close();await refresh();return;}
if(form.id==='passkey-setup-form'){await finishPasskey('register',passkeySetupToken);return;}
if(form.id==='member-enrol-form'){await api('/membership/enrol',{fullName:fields.fullName,preferredLanguage:lang,consent:fields.consent==='on'});emitAnalytics('identity','enrolment_submitted',{outcome:'received'});await openMembership();}
if(form.id==='member-recovery-form'){await api('/membership/recovery',{oldPhone:'+91'+fields.oldPhone});emitAnalytics('identity','recovery_requested',{outcome:'received'});show(t('Request help','मदद माँगें'),`<p>${t('Your Nia team will review the request. Your account has not changed.')}</p>`);}
if(form.id==='partner-referral-form'){const chosen=new FormData(form).getAll('fields');if(!chosen.length)throw {message:t('Choose at least one record to share.')};await api('/partners/referrals',{partnerId:fields.partnerId,consentVersion:Number(fields.consentVersion),fields:chosen,consent:fields.consent==='on'});return await openPartners();}
if(form.id==='books-entry-form'){const amountPaise=Math.round(Number(fields.amount)*100);await submitBooks({...(fields.entryId?{id:fields.entryId,revision:Number(fields.revision)}:{}),date:fields.date,kind:fields.kind,amountPaise,label:fields.label});}
if(form.id==='nest-search-form'){nestStart=fields.start;await loadNests();render();}
if(form.id==='save-search-form'){search=String(fields.q||'').trim().slice(0,40);aisle='';render();return;}
if(form.id==='earn-form'&&!commitmentReady())return toast(t(PILOT_CLOSED_COPY));
if(form.id==='earn-form'){emitAnalytics('earn','consent',{outcome:fields.consent==='on'?'granted':'absent'});if(!earnPending)earnPending={accountId:account.id,key:crypto.randomUUID(),body:{jobId:fields.jobId,revision:fields.revision,consent:fields.consent==='on'}};save('nia-earn-pending',earnPending);await confirmJob();}
if(form.id==='login-form'){
  if(form.dataset.authStep==='password-login'||(cat.memberAuth==='password'&&!fields.phone)){
    const phone=e164In(fields.phone||authPhone);
    if(!phone)throw {code:'invalid_phone',message:errorText('invalid_phone')};
    authPhone=phone;
    await api(loginPath(cat),passwordBody(fields,{phone}));
    await finishMemberSession();return;
  }
  const phone=e164In(fields.phone);
  if(!phone)throw {code:'invalid_phone',message:errorText('invalid_phone')};
  authPhone=phone;
  if(usesPasswordAuth(cat) && cat.memberAuth==='password' && !usesPhoneOtpFlow(cat)){
    showPasswordLogin();
    $('#dialog').classList.add('mesha-checkout');
    return;
  }
  const result=await submitAuthPaths(api,otpRequestPaths(cat),{phone});
  challenge=typeof result.challenge==='string'?result.challenge:'';
  show(t('Enter your code','अपना कोड डालें'),verifyFormMarkup({t,esc,phone:authPhone})+entryLanguage());
}
if(form.id==='verify-form'){
  if(!authPhone)throw {code:'invalid_phone',message:errorText('invalid_phone')};
  const result=await submitAuthPaths(api,otpVerifyPaths(cat),{challenge,code:fields.code,phone:authPhone});
  passwordToken=setPasswordToken(result);
  if(needsSetPassword(result,cat)){show(t('Set your password','अपना पासवर्ड बनाएँ'),setPasswordFormMarkup({t})+entryLanguage());return;}
  if(result.account){await finishMemberSession();return;}
  throw {message:t('We could not complete that request. Please try again or ask your Nia team for help.','यह अनुरोध पूरा नहीं हुआ। फिर कोशिश करें या निया टीम से मदद लें।')};
}
if(form.id==='set-password-form'){
  const issue=setPasswordIssue(fields);
  if(issue)throw {code:issue,message:errorText(issue)};
  pendingPassword=fields.password;
  const result=await submitSetPassword(api,passwordBody(fields,{phone:authPhone,challenge,token:passwordToken}),cat);
  if(result.account){pendingPassword='';await finishMemberSession();return;}
  show(t('Stay signed in','साइन इन रहें'),rememberFormMarkup({t})+entryLanguage());
}
if(form.id==='remember-form'){
  if(!pendingPassword)throw {message:t('Set a password to stay signed in on this phone.','इस फोन पर साइन इन रहने के लिए पासवर्ड बनाएँ।')};
  await api(loginPath(cat),passwordBody({password:pendingPassword,remember:rememberOn(fields)},{phone:authPhone}));
  pendingPassword='';
  await finishMemberSession();
}
if(form.id==='recovery-form'){const result=await api('/recovery',{memberId:fields.memberId,newPhone:'+91'+fields.phone});show(t('Help request received','मदद का अनुरोध मिल गया'),`<p>${t('Your reference','आपका संदर्भ')}: <strong>${esc(result.id)}</strong></p><p>${t('Bring this reference and your member ID to your Nia team. Your account and orders have not changed.','यह संदर्भ और सदस्य ID लेकर निया टीम के पास जाएँ। आपका खाता और ऑर्डर नहीं बदले हैं।')}</p>`);}
if(form.id==='support-form'){const issue=await api('/support',fields);emitAnalytics('save','support_request',{outcome:'received'});show(t('Help request received','मदद का अनुरोध मिल गया'),supportIssueLine(issue,{t,esc}));}
if(form.id==='review-form'&&!saveCommitmentReady())return toast(t(SAVE_PAUSED_COPY));
if(form.id==='review-form'){emitAnalytics('save','checkout_start');locationId=fields.locationId;fulfillment=fields.fulfillment;const body={locationId,fulfillment,lines:Object.entries(cart).map(([id,qty])=>({id,qty}))};const q=await api('/quote',body);const request={...body,fingerprint:q.fingerprint};show(t('Confirm your reservation','अपनी बुकिंग की पुष्टि करें'),`<div class="stack"><ul class="review-lines">${q.lines.map(l=>`<li>${esc(t(l.name))} × ${l.qty} · ${money(l.nia*l.qty)}</li>`).join('')}</ul><div class="row"><strong>${t('Pay when you collect','लेते समय पैसे दें')}</strong><strong class="price">${money(q.amount)}</strong></div><p><strong>${esc(t(q.location.name))}</strong><br>${esc(t(q.location.address))}<br>${t('Collect before','इस समय से पहले लें')} ${esc(date(q.expiresAt))}</p><p class="info">${t('Nothing online. Pay by UPI when you pick up the bag.','ऑनलाइन कुछ नहीं। बैग लेते समय UPI से पैसे दें।')}</p><button class="primary" data-action="confirm">${t('Reserve bag','बैग बुक करें')}</button><div id="form-error" class="error-inline" role="alert"></div></div>`);draft={accountId:account.id,key:crypto.randomUUID(),body:request};}
}catch(e){const error=$('#form-error');if(error)error.textContent=e.message;else toast(e.message);}finally{if(submit)submit.disabled=false;}});
window.addEventListener('online',()=>{notice();render();});window.addEventListener('offline',()=>{notice();render();});
window.addEventListener('storage',()=>renderShell());
setInterval(()=>{if(!document.hidden)renderShell();},30000);
(async()=>{if(location.hash!=='#'+page)history.replaceState(null,'','#'+page);try{await loadLanguage(lang);}catch{lang='en';}try{await restoreOwner();}catch(e){toast(e.message);}render();await refresh();if(passkeySetupToken&&cat.memberAuth==='passkey'&&!owner.active)login();})().catch(e=>{entryLoading=false;entryError=e.message;render();});

let statusRead=false;
setInterval(async()=>{if(needsSignIn()||statusRead||busy||document.hidden||!navigator.onLine||$('#dialog').open||!['orders','earn'].includes(page)||document.activeElement?.matches('input,select,textarea,button'))return;statusRead=true;try{if(page==='orders'&&account)await loadMemberOrders();else if(page==='earn')await loadEarn();if(page==='send')await loadBooks();render();}catch{toast(t('Could not refresh status. Try again.','स्थिति ताज़ा नहीं हुई। फिर कोशिश करें।'));}finally{statusRead=false;}},30000);
