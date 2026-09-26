import test from 'node:test';
import assert from 'node:assert/strict';
import {
  otpIsPrimary, optionalPasswordAllowed, optionalPasswordPath, optionalSetupExpired, submitOptionalPassword,
  usesPhoneAuth, usesPasswordAuth, usesPhoneOtpFlow, e164In, nationalMobile, rememberOn,
  authErrorText, needsSetPassword, setPasswordToken, setPasswordPaths,
  commerceAuthPath, otpRequestPaths, otpVerifyPaths, loginPath,
  authTimeoutMs,
  passwordBody, setPasswordIssue, submitSetPassword, submitAuthPaths,
  phoneFormMarkup, verifyFormMarkup, setPasswordFormMarkup, rememberFormMarkup, passwordFormMarkup
} from '../../commerce-member-auth.js';

const t = (en) => en;
const otpCatalogue = {memberAuth:'otp',memberAuthCapabilities:{primaryMethod:'whatsapp_otp',passwordOptional:true,otpRequestPath:'/api/commerce/auth/request',otpVerifyPath:'/api/commerce/auth/verify',loginPath:'/api/commerce/auth/login',setPasswordPath:'/api/commerce/auth/password'}};

test('OTP primary has two steps and an optional password alternate, preserving legacy markup',()=>{
  assert.equal(otpIsPrimary(otpCatalogue),true);
  assert.equal(otpIsPrimary({memberAuth:'passkey',memberAuthCapabilities:otpCatalogue.memberAuthCapabilities}),false);
  for(const markup of [phoneFormMarkup({t,esc:s=>s,otpPrimary:true,passwordLink:true}),verifyFormMarkup({t,esc:s=>s,otpPrimary:true})]){
    assert.equal((markup.match(/<li/g)||[]).length,2);
    assert.doesNotMatch(markup,/<li[^>]*>Password|<li[^>]*>Stay signed in/);
  }
  assert.match(phoneFormMarkup({t,esc:s=>s,otpPrimary:true,passwordLink:true}),/Send WhatsApp code/);
  assert.match(phoneFormMarkup({t,esc:s=>s,otpPrimary:true,passwordLink:true}),/data-action="password-login"/);
  assert.equal((phoneFormMarkup({t,esc:s=>s}).match(/<li/g)||[]).length,4);
  const optional=setPasswordFormMarkup({t,optional:true});
  assert.match(optional,/data-auth-step="optional-password"/);assert.match(optional,/Optional\. WhatsApp codes will still work/);
  assert.doesNotMatch(optional,/auth-steps|Save password and continue/);
  assert.match(optional,/data-action="phone-login"/);
});

test('completed OTP session never requires password and missing response never invents authentication',()=>{
  assert.equal(needsSetPassword({next:'authenticated',account:{id:'uat',role:'member'},passwordSetup:{available:true}},otpCatalogue),false);
  assert.equal(needsSetPassword({next:'authenticated',account:{id:'uat',role:'member'},token:'optional-token'},otpCatalogue),false);
  assert.equal(needsSetPassword({},otpCatalogue),false);
});

test('optional setup uses only advertised path and never retries a consumed grant',async()=>{
  const account={id:'uat',role:'member'},fields={password:'uat-password-123',confirm:'uat-password-123'};
  assert.equal(optionalPasswordPath(otpCatalogue),'/auth/password');
  assert.equal(optionalPasswordAllowed(otpCatalogue,account),true);
  for(const actor of [null,{role:'admin'},{role:'reader'}])assert.equal(optionalPasswordAllowed(otpCatalogue,actor),false);
  assert.equal(optionalPasswordAllowed({...otpCatalogue,preview:true},account),false);
  assert.equal(optionalPasswordAllowed({memberAuth:'password'},account),false);
  const calls=[];
  await assert.rejects(submitOptionalPassword(async(path,body)=>{calls.push({path,body});throw {code:'setup_expired'};},fields,otpCatalogue,account),e=>e.code==='setup_expired');
  assert.equal(calls.length,1);assert.equal(calls[0].path,'/auth/password');
  assert.equal(calls[0].body.phone,undefined);assert.equal(calls[0].body.token,undefined);
  await assert.rejects(submitOptionalPassword(()=>{throw Error('must not call');},{password:'short'},otpCatalogue,account),e=>e.code==='weak_password');
});

test('actual OTP submit finishes the member session directly; incomplete or rejected replies cannot finish',async()=>{
  const {readFileSync}=await import('node:fs'),src=readFileSync(new URL('../../commerce.js',import.meta.url),'utf8');
  const start=src.indexOf("if(form.id==='verify-form'){"),end=src.indexOf("if(form.id==='set-password-form'){",start);
  const run=new Function('form','fields','cat','api','finishMemberSession','submitAuthPaths','otpVerifyPaths','setPasswordToken','needsSetPassword','show','t','setPasswordFormMarkup','entryLanguage','errorText',`return (async()=>{let authPhone='+919876543210',challenge='uat-challenge',passwordToken='';${src.slice(start,end)}})()`);
  let reply={ok:true,next:'authenticated',memberAuth:'otp',account:{id:'uat-member',role:'member'},passwordSetup:{available:true}},finished=0,shown=0,calls=[];
  const invoke=()=>run({id:'verify-form'},{code:'123456'},otpCatalogue,async(path)=>{calls.push(path);return reply;},async()=>{finished++;},submitAuthPaths,otpVerifyPaths,setPasswordToken,needsSetPassword,()=>{shown++;},t,setPasswordFormMarkup,()=>'',x=>x);
  await invoke();assert.equal(finished,1);assert.equal(shown,0);assert.deepEqual(calls,['/auth/verify']);
  reply={};await assert.rejects(invoke());assert.equal(finished,1);assert.equal(shown,0);
});

test('only optional setup expiry preserves a valid member view; every other unauthorized response clears it',async()=>{
  const {readFileSync}=await import('node:fs'),src=readFileSync(new URL('../../commerce.js',import.meta.url),'utf8');
  const start=src.indexOf('async function api('),end=src.indexOf('function toast(',start);
  const run=new Function('path','code','cat','optionalSetupExpired','authTimeoutMs','Response','AbortSignal',`return (async()=>{let account={id:'uat',role:'member'},sessionExpired=false,orders=['uat-order'],nestOrders=[],applications=[];const owner={active:false},errorText=x=>x,t=x=>x,fetch=async()=>Response.json({error:code},{status:401});${src.slice(start,end)}try{await api(path,{})}catch{}return {account,sessionExpired,orders};})()`);
  const kept=await run('/auth/password','setup_expired',otpCatalogue,optionalSetupExpired,authTimeoutMs,Response,AbortSignal);
  assert.equal(kept.account.id,'uat');assert.deepEqual(kept.orders,['uat-order']);assert.equal(kept.sessionExpired,false);
  for(const [path,code,cat] of [['/auth/password','sign_in_required',otpCatalogue],['/orders','setup_expired',otpCatalogue],['/auth/password','setup_expired',{memberAuth:'password'}]]){
    const result=await run(path,code,cat,optionalSetupExpired,authTimeoutMs,Response,AbortSignal);assert.equal(result.account,null);assert.deepEqual(result.orders,[]);assert.equal(result.sessionExpired,true);
  }
});

test('actual optional password handler confirms success without the legacy remember step and explains expiry',async()=>{
  const {readFileSync}=await import('node:fs'),src=readFileSync(new URL('../../commerce.js',import.meta.url),'utf8');
  const start=src.indexOf("if(form.id==='set-password-form'){"),end=src.indexOf("if(form.id==='remember-form'){",start);
  const run=new Function('form','fields','cat','account','api','submitOptionalPassword','finishMemberSession','toast','t','errorText',`return (async()=>{${src.slice(start,end)}})()`);
  let reply={account:{id:'uat',role:'member'}},failure=null,finished=0,reset=0,toasts=[];
  const invoke=()=>run({id:'set-password-form',dataset:{authStep:'optional-password'},reset(){reset++;}}, {password:'uat-password-123',confirm:'uat-password-123'},otpCatalogue,{id:'uat',role:'member'},async()=>{if(failure)throw failure;return reply;},submitOptionalPassword,async()=>{finished++;},m=>toasts.push(m),t,x=>x);
  await invoke();assert.equal(finished,1);assert.equal(reset,1);assert.deepEqual(toasts,['Password saved. WhatsApp sign-in is still available.']);
  failure={code:'setup_expired'};await assert.rejects(invoke(),e=>e.message==='Verify again by WhatsApp to set or change an optional password.');assert.equal(finished,1);assert.equal(reset,1);
  failure=null;reply={ok:true};await assert.rejects(invoke(),e=>e.message.includes('could not be confirmed'));assert.equal(finished,1);assert.equal(reset,1);
});

test('catalogue modes pick phone OTP set-password without treating passkey as phone', () => {
  assert.equal(usesPhoneAuth({memberAuth: 'passkey'}), false);
  assert.equal(usesPhoneAuth({memberAuth: 'password'}), false);
  assert.equal(usesPhoneAuth({memberAuth: 'legacy'}), true);
  assert.equal(usesPhoneAuth({memberAuth: 'phone'}), true);
  assert.equal(usesPhoneAuth({memberAuth: 'phone_otp_password'}), true);
  assert.equal(usesPhoneAuth({memberAuth: 'password', capabilities: {phoneOtp: true}}), true);
  assert.equal(usesPasswordAuth({memberAuth: 'password'}), true);
  assert.equal(usesPasswordAuth({memberAuth: 'legacy'}), false);
  assert.equal(usesPhoneOtpFlow({memberAuth: 'password'}), false);
  assert.equal(usesPhoneOtpFlow({
    memberAuth: 'password',
    memberAuthCapabilities: {
      mode: 'password_otp',
      otpRequestPath: '/api/commerce/auth/request',
      otpVerifyPath: '/api/commerce/auth/verify',
      setPasswordPath: '/api/commerce/auth/set-password',
      setPasswordAliases: ['/api/commerce/auth/password', '/api/commerce/auth/password/set'],
      loginPath: '/api/commerce/auth/login'
    }
  }), true);
});

test('Indian mobile numbers normalise to +91 without inventing members', () => {
  assert.equal(e164In('9876543210'), '+919876543210');
  assert.equal(e164In('+91 98765 43210'), '+919876543210');
  assert.equal(e164In('09876543210'), '+919876543210');
  assert.equal(e164In('1234567890'), '');
  assert.equal(e164In('98765'), '');
  assert.equal(nationalMobile('+919876543210'), '9876543210');
});

test('agreed error codes map to English copy and do not invent success', () => {
  assert.match(authErrorText('not_registered', t), /not registered for NiaSave/);
  assert.match(authErrorText('access_not_granted', t), /not registered for NiaSave/);
  assert.match(authErrorText('bad_otp', t), /not correct/);
  assert.match(authErrorText('weak_password', t), /8 characters/);
  assert.match(authErrorText('otp_unavailable', t), /could not be sent/);
  assert.match(authErrorText('central_member_lookup_unavailable', t), /Central member lookup unavailable/);
  assert.equal(authErrorText('unknown_code', t), undefined);
  assert.equal(setPasswordIssue({password: 'short', confirm: 'short'}), 'weak_password');
  assert.equal(setPasswordIssue({password: 'long-enough', confirm: 'different'}), 'password_mismatch');
  assert.equal(setPasswordIssue({password: 'long-enough', confirm: 'long-enough'}), '');
});

test('verify payload decides set-password versus existing session', () => {
  assert.equal(needsSetPassword({account: {id: 'm1'}}, {memberAuth: 'legacy'}), false);
  assert.equal(needsSetPassword({needsPassword: true}, {memberAuth: 'legacy'}), true);
  assert.equal(needsSetPassword({next: 'set_password', setPasswordToken: 'tok'}, {memberAuth: 'phone'}), true);
  assert.equal(setPasswordToken({passwordToken: 'abc'}), 'abc');
  assert.equal(setPasswordPaths({passwordPath: '/auth/set-password'}, {})[0], '/auth/password');
  assert.deepEqual(setPasswordPaths({passwordPath: '/auth/password'}, {}), [
    '/auth/password', '/auth/password/set', '/auth/set-password', '/auth/update-password'
  ]);
  assert.equal(commerceAuthPath('/api/commerce/auth/set-password', '/auth/password'), '/auth/set-password');
  assert.deepEqual(otpRequestPaths({
    memberAuthCapabilities: {otpRequestPath: '/api/commerce/auth/request'}
  }), ['/auth/request', '/auth/password/request']);
  assert.deepEqual(otpVerifyPaths({}), ['/auth/verify', '/auth/password/verify']);
  assert.equal(loginPath({memberAuthCapabilities: {loginPath: '/api/commerce/auth/login'}}), '/auth/login');
  assert.deepEqual(setPasswordPaths({}, {
    memberAuthCapabilities: {
      setPasswordPath: '/api/commerce/auth/set-password',
      setPasswordAliases: ['/api/commerce/auth/password', '/api/commerce/auth/password/set']
    }
  }), ['/auth/password', '/auth/password/set', '/auth/set-password', '/auth/update-password']);
});

test('remember flag and password body stay defensive for Codex field names', () => {
  assert.equal(rememberOn({remember: 'on'}), true);
  assert.equal(rememberOn({}), false);
  const body = passwordBody({password: 'secret-pass', confirm: 'secret-pass', remember: 'on'}, {
    phone: '+919876543210', challenge: 'ch', token: 'tok'
  });
  assert.equal(body.password, 'secret-pass');
  assert.equal(body.remember, true);
  assert.equal(body.phone, '+919876543210');
  assert.equal(body.token, 'tok');
  assert.equal(body.setPasswordToken, 'tok');
});

test('set-password tries agreed paths and does not invent success on 404', async () => {
  const calls = [];
  const api = async (path) => {
    calls.push(path);
    throw {status: 404, code: 'not_found'};
  };
  await assert.rejects(() => submitSetPassword(api, {password: 'secret-pass'}, {memberAuth: 'phone'}), e => e.code === 'not_found');
  assert.deepEqual(calls, ['/auth/password', '/auth/password/set', '/auth/set-password', '/auth/update-password']);
  const ok = await submitSetPassword(async (path) => {
    if (path !== '/auth/password') throw {status: 401, code: 'setup_expired'};
    return {account: {id: 'm1'}};
  }, {password: 'secret-pass'}, {memberAuth: 'phone'});
  assert.deepEqual(ok, {account: {id: 'm1'}});
  const requestCalls = [];
  await assert.rejects(() => submitAuthPaths(async (path) => {
    requestCalls.push(path);
    throw {status: 503, code: 'central_member_lookup_unavailable'};
  }, ['/auth/request', '/auth/password/request'], {phone: '+919876543210'}), e => e.code === 'central_member_lookup_unavailable');
  assert.deepEqual(requestCalls, ['/auth/request']);
});

test('presentation markup covers the four founder steps', () => {
  const phone = phoneFormMarkup({t, esc: s => s, phone: '9876543210', passwordLink: true});
  assert.match(phone, /id="login-form"/);
  assert.match(phone, /\+91/);
  assert.match(phone, /name="phone"/);
  assert.match(phone, /Use your mobile number|Already have a password/);
  const verify = verifyFormMarkup({t, esc: s => s, phone: '+919876543210'});
  assert.match(verify, /id="verify-form"/);
  assert.match(verify,/WhatsApp/);
  assert.doesNotMatch(verify,/SMS/);
  assert.match(verify, /\+919876543210/);
  const set = setPasswordFormMarkup({t});
  assert.match(set, /id="set-password-form"/);
  assert.match(set, /name="remember"/);
  const remember = rememberFormMarkup({t});
  assert.match(remember, /id="remember-form"/);
  const password = passwordFormMarkup({t, phoneLink: true});
  assert.match(password, /name="remember"/);
  assert.match(password, /name="phone"/);
  assert.match(password, /autocomplete="tel-national"/);
  assert.match(password, /personal password/i);
  assert.match(passwordFormMarkup({t, phone: '+919876543210'}), /value="9876543210"/);
  assert.match(password, /data-action="phone-login"/);
});

test('OTP request timeout is narrow and ordinary auth calls stay at twelve seconds', () => {
  assert.equal(authTimeoutMs('/auth/request'), 35000);
  assert.equal(authTimeoutMs('/auth/password/request'), 35000);
  assert.equal(authTimeoutMs('/auth/verify'), 12000);
  assert.equal(authTimeoutMs('/auth/login'), 12000);
  assert.equal(authTimeoutMs('/catalogue'), 12000);
});


test('phone submission uses OTP on mixed password+OTP catalogue and explicit password still signs in',async()=>{
 const {readFileSync}=await import('node:fs');
 const src=readFileSync(new URL('../../commerce.js',import.meta.url),'utf8');
 const start=src.indexOf("if(form.id==='login-form'){");
 const end=src.indexOf("if(form.id==='verify-form'){",start);
 const run=new Function('form','fields','cat','api','finishMemberSession','e164In','errorText','usesPasswordAuth','usesPhoneOtpFlow','otpIsPrimary','showPasswordLogin','submitAuthPaths','otpRequestPaths','show','t','verifyFormMarkup','entryLanguage','esc','loginPath','passwordBody',`return (async()=>{let authPhone='',challenge='';${src.slice(start,end)}})()`);
 const catalogue={memberAuth:'password',memberAuthCapabilities:{mode:'password_otp',otpRequestPath:'/auth/request'}};
 const calls=[];
 const args=[catalogue,async(path)=>{calls.push(path);return{};},async()=>{calls.push('session');},e164In,x=>x,usesPasswordAuth,usesPhoneOtpFlow,otpIsPrimary,()=>{throw Error('wrong_password_dialog');},submitAuthPaths,otpRequestPaths,()=>calls.push('code-screen'),t,verifyFormMarkup,()=>'',x=>x,loginPath,passwordBody];
 await run({id:'login-form',dataset:{authStep:'phone'}},{phone:'9876543210'},...args);
 assert.deepEqual(calls,['/auth/request','code-screen']);
 calls.length=0;
 await run({id:'login-form',dataset:{authStep:'password-login'}},{phone:'9876543210',password:'user-password'},...args);
 assert.deepEqual(calls,['/auth/login','session']);
});

test('fresh password submission validates locally and sends normalized phone with password', async () => {
  const {readFileSync} = await import('node:fs');
  const src = readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
  const start = src.indexOf("if(form.id==='login-form'){");
  const end = src.indexOf("if(form.id==='verify-form'){", start);
  const run = new Function('form','fields','cat','api','finishMemberSession','e164In','errorText','usesPasswordAuth','usesPhoneOtpFlow','otpIsPrimary','showPasswordLogin','submitAuthPaths','otpRequestPaths','show','t','verifyFormMarkup','entryLanguage','esc','loginPath','passwordBody', `return (async()=>{let authPhone='',challenge='';${src.slice(start,end)}})()`);
  const catalogue = {memberAuth: 'password', memberAuthCapabilities: {loginPath: '/auth/login'}};
  const calls = [];
  const args = [catalogue, async (path, body) => { calls.push({path, body}); return {}; }, async () => { calls.push({path: 'session'}); }, e164In, x => x, usesPasswordAuth, usesPhoneOtpFlow, otpIsPrimary, () => {}, submitAuthPaths, otpRequestPaths, () => {}, t, verifyFormMarkup, () => '', x => x, loginPath, passwordBody];
  await run({id: 'login-form', dataset: {authStep: 'password-login'}}, {phone: '987 654 3210', password: 'personal-password'}, ...args);
  assert.equal(calls[0].path, '/auth/login');
  assert.equal(calls[0].body.phone, '+919876543210');
  assert.equal(calls[0].body.password, 'personal-password');
  calls.length = 0;
  await assert.rejects(() => run({id: 'login-form', dataset: {authStep: 'password-login'}}, {phone: '1234567890', password: 'personal-password'}, ...args), error => error.code === 'invalid_phone');
  assert.deepEqual(calls, []);
});
