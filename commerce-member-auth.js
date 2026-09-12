const API_PREFIX = '/api/commerce';
const PHONE_AUTH_MODES = new Set([
  'phone', 'otp', 'phone_otp', 'legacy', 'phone_password',
  'set_password', 'member_phone', 'phone_otp_password'
]);
const SET_PASSWORD_NEXT = new Set(['set_password', 'password', 'set-password', 'update_password']);
const RETRY_MISSING_PATH = new Set(['not_found', 'use_password_access', 'method_not_allowed']);
const RETRY_SET_PASSWORD = new Set([...RETRY_MISSING_PATH, 'setup_expired']);

export function memberAuthCapabilities(cat) {
  return cat?.memberAuthCapabilities && typeof cat.memberAuthCapabilities === 'object'
    ? cat.memberAuthCapabilities
    : {};
}

export function commerceAuthPath(value, fallback = '') {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return fallback;
  const path = raw.startsWith(API_PREFIX + '/') ? raw.slice(API_PREFIX.length) : raw;
  return path.startsWith('/auth/') ? path : fallback;
}

export function usesPhoneAuth(cat) {
  if (!cat || cat.memberAuth === 'passkey') return false;
  const auth = String(cat.memberAuth || '');
  if (PHONE_AUTH_MODES.has(auth)) return true;
  const caps = cat.capabilities || cat.auth || {};
  return Boolean(
    caps.phoneOtp || caps.phoneAuth || caps.memberPhoneAuth ||
    caps.canSetPassword || caps.setPassword || caps.phonePassword ||
    caps.otp || /phone|otp/.test(auth)
  );
}

export function hasPhoneOtpCapabilities(cat) {
  const caps = memberAuthCapabilities(cat);
  return Boolean(
    caps.otpRequestPath || caps.otpVerifyPath || caps.setPasswordPath ||
    caps.registeredPhoneOnly || caps.mode === 'password_otp' ||
    (Array.isArray(caps.setPasswordAliases) && caps.setPasswordAliases.length)
  );
}

export function usesPhoneOtpFlow(cat) {
  return usesPhoneAuth(cat) || hasPhoneOtpCapabilities(cat);
}

export function usesPasswordAuth(cat) {
  return cat?.memberAuth === 'password' || Boolean(cat?.capabilities?.password || cat?.auth?.password || memberAuthCapabilities(cat).loginPath);
}

export function otpRequestPaths(cat) {
  return [...new Set([
    commerceAuthPath(memberAuthCapabilities(cat).otpRequestPath, ''),
    '/auth/request',
    '/auth/password/request'
  ].filter(Boolean))];
}

export function otpVerifyPaths(cat) {
  return [...new Set([
    commerceAuthPath(memberAuthCapabilities(cat).otpVerifyPath, ''),
    '/auth/verify',
    '/auth/password/verify'
  ].filter(Boolean))];
}

export function loginPath(cat) {
  return commerceAuthPath(memberAuthCapabilities(cat).loginPath, '/auth/login');
}

export function nationalMobile(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export function e164In(value) {
  const n = nationalMobile(value);
  return /^[6-9]\d{9}$/.test(n) ? '+91' + n : '';
}

export function rememberOn(fields) {
  return fields?.remember === 'on' || fields?.remember === 'true' || fields?.remember === true;
}

export function authErrorText(code, t) {
  return ({
    not_registered: t('This number is not registered for NiaSave. Ask your Nia team if you need access.', 'यह नंबर नियासेव के लिए पंजीकृत नहीं है। प्रवेश चाहिए तो निया टीम से पूछें।'),
    access_not_granted: t('This number is not registered for NiaSave. Ask your Nia team if you need access.', 'यह नंबर नियासेव के लिए पंजीकृत नहीं है। प्रवेश चाहिए तो निया टीम से पूछें।'),
    bad_otp: t('That code is not correct. Try again.', 'कोड सही नहीं है। फिर कोशिश करें।'),
    invalid_code: t('Enter the 4 to 8 digit code from your SMS.', 'SMS में आया 4 से 8 अंकों का कोड डालें।'),
    weak_password: t('Choose a stronger password. Use at least 8 characters.', 'मज़बूत पासवर्ड चुनें। कम से कम 8 अक्षर हों।'),
    invalid_phone: t('Enter a 10-digit Indian mobile number starting with 6–9.', '6–9 से शुरू 10 अंकों का भारतीय मोबाइल नंबर डालें।'),
    password_mismatch: t('The passwords do not match.', 'पासवर्ड मेल नहीं खाते।'),
    use_password_access: t('Sign in with your member password.', 'अपना सदस्य पासवर्ड डालकर साइन इन करें।'),
    identity_verification_failed: t('We could not verify that code. Try again or ask your Nia team.', 'कोड की पुष्टि नहीं हुई। फिर कोशिश करें या निया टीम से पूछें।'),
    identity_unavailable: t('The sign-in service is unavailable. Please try again.', 'साइन इन सेवा उपलब्ध नहीं है। फिर कोशिश करें।'),
    use_preview_access: t('Preview access is not available here.', 'यहाँ प्रीव्यू प्रवेश उपलब्ध नहीं है।'),
    member_password_not_configured: t('Password sign-in is not available yet. Ask your Nia team.', 'पासवर्ड साइन इन अभी उपलब्ध नहीं है। निया टीम से पूछें।'),
    password_required: t('Set a password to stay signed in on this phone.', 'इस फोन पर साइन इन रहने के लिए पासवर्ड बनाएँ।'),
    set_password_required: t('Set a password to stay signed in on this phone.', 'इस फोन पर साइन इन रहने के लिए पासवर्ड बनाएँ।'),
    password_not_set: t('Set a password to stay signed in on this phone.', 'इस फोन पर साइन इन रहने के लिए पासवर्ड बनाएँ।'),
    otp_unavailable: t('A verification code could not be sent. Try again or sign in with your password if you already have one.', 'पुष्टि कोड नहीं भेजा जा सका। फिर कोशिश करें या पासवर्ड से साइन इन करें।'),
    central_member_lookup_unavailable: t('Central member lookup unavailable — try again or use password if offered.', 'सेंट्रल सदस्य जाँच उपलब्ध नहीं है — फिर कोशिश करें या पासवर्ड इस्तेमाल करें।'),
    member_setup_not_configured: t('Password setup is not available yet. Ask your Nia team.', 'पासवर्ड बनाना अभी उपलब्ध नहीं है। निया टीम से पूछें।')
  })[code];
}

export function setPasswordToken(result) {
  if (!result || typeof result !== 'object') return '';
  const token = result.setPasswordToken || result.passwordToken || result.setupToken || result.passwordSetupToken || result.token || '';
  return typeof token === 'string' && token.length <= 400 ? token : '';
}

function setPasswordSignal(result) {
  if (!result || typeof result !== 'object') return false;
  const next = String(result.next || result.nextStep || result.step || '').toLowerCase();
  return result.needsPassword === true
    || result.mustSetPassword === true
    || result.passwordRequired === true
    || result.setPassword === true
    || result.requiresPassword === true
    || SET_PASSWORD_NEXT.has(next)
    || Boolean(setPasswordToken(result));
}

export function needsSetPassword(result, cat) {
  if (setPasswordSignal(result)) return true;
  if (result?.account) return false;
  return usesPhoneOtpFlow(cat);
}

export function setPasswordPaths(result, cat) {
  const caps = memberAuthCapabilities(cat);
  const named = [
    result?.passwordPath, result?.setPasswordPath, result?.nextPath,
    caps.setPasswordPath,
    ...(Array.isArray(caps.setPasswordAliases) ? caps.setPasswordAliases : []),
    cat?.auth?.passwordPath, cat?.auth?.setPasswordPath, cat?.capabilities?.passwordPath
  ].map(path => commerceAuthPath(path, '')).filter(Boolean);
  return [...new Set([
    ...named,
    '/auth/password',
    '/auth/password/set',
    '/auth/set-password',
    '/auth/update-password'
  ])];
}

export function passwordBody(fields, {phone, challenge, token, remember} = {}) {
  const password = String(fields.password || '');
  const confirm = String(fields.confirm || fields.confirmPassword || '');
  const body = {password, remember: remember === undefined ? rememberOn(fields) : Boolean(remember)};
  if (confirm) body.confirm = confirm;
  if (phone) body.phone = phone;
  if (challenge) body.challenge = challenge;
  if (token) {
    body.token = token;
    body.setPasswordToken = token;
    body.passwordToken = token;
  }
  return body;
}

export function setPasswordIssue(fields) {
  const password = String(fields.password || '');
  const confirm = String(fields.confirm || fields.confirmPassword || '');
  if (password.length < 8) return 'weak_password';
  if (confirm && password !== confirm) return 'password_mismatch';
  return '';
}

export async function submitAuthPaths(api, paths, body, retryCodes = RETRY_MISSING_PATH) {
  let last;
  for (const path of paths) {
    try { return await api(path, body, 'POST'); }
    catch (e) {
      last = e;
      if (e.status === 404 || e.status === 405 || retryCodes.has(e.code)) continue;
      throw e;
    }
  }
  throw last || {code: 'not_found'};
}

export async function submitSetPassword(api, body, cat, result) {
  return submitAuthPaths(api, setPasswordPaths(result, cat), body, RETRY_SET_PASSWORD);
}

function steps(t, current) {
  const items = [
    ['phone', t('Mobile', 'मोबाइल')],
    ['code', t('Code', 'कोड')],
    ['password', t('Password', 'पासवर्ड')],
    ['remember', t('Stay signed in', 'साइन इन रहें')]
  ];
  return `<ol class="auth-steps" aria-label="${t('Sign-in steps', 'साइन इन के चरण')}">${items.map(([id, label]) => `<li${id === current ? ' aria-current="step"' : ''}>${label}</li>`).join('')}</ol>`;
}

function fieldError() {
  return '<div id="form-error" class="error-inline" role="alert"></div>';
}

export function phoneFormMarkup({t, esc, phone = '', passwordLink = false}) {
  const national = nationalMobile(phone);
  return `<form id="login-form" class="stack" data-auth-step="phone">${steps(t, 'phone')}<p>${t('Use the phone number registered with Nia.', 'निया में दर्ज फोन नंबर डालें।')}</p><label>${t('Mobile number', 'मोबाइल नंबर')}<span class="phone-field"><span class="phone-prefix" aria-hidden="true">+91</span><input name="phone" type="tel" autocomplete="tel-national" inputmode="numeric" pattern="[6-9][0-9]{9}" minlength="10" maxlength="10" placeholder="${t('10-digit mobile number', '10 अंकों का मोबाइल नंबर')}" value="${esc(national)}" required></span></label>${fieldError()}<button class="primary" type="submit">${t('Send code', 'कोड भेजें')}</button>${passwordLink ? `<button type="button" class="quiet" data-action="password-login">${t('Already have a password? Sign in', 'पासवर्ड पहले से है? साइन इन करें')}</button>` : ''}<button type="button" data-action="recovery">${t('Number changed? Get help', 'नंबर बदल गया? मदद लें')}</button></form>`;
}

export function verifyFormMarkup({t, esc, phone = ''}) {
  const shown = e164In(phone) || phone;
  return `<form id="verify-form" class="stack" data-auth-step="code">${steps(t, 'code')}<p>${t('If this number is registered with Nia, a code will arrive by SMS.', 'यदि यह नंबर निया में पंजीकृत है, तो SMS पर कोड आएगा।')}</p>${shown ? `<p class="auth-phone">${esc(shown)}</p>` : ''}<label>${t('Verification code', 'पुष्टि कोड')}<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{4,8}" maxlength="8" required></label>${fieldError()}<button class="primary" type="submit">${t('Verify & continue', 'पुष्टि करके आगे बढ़ें')}</button><button type="button" data-action="login">${t('Use another number / resend', 'दूसरा नंबर / फिर भेजें')}</button></form>`;
}

export function setPasswordFormMarkup({t}) {
  return `<form id="set-password-form" class="stack" data-auth-step="password">${steps(t, 'password')}<p>${t('Create a password for this phone. You will use it the next time you sign in.', 'इस फोन के लिए पासवर्ड बनाएँ। अगली बार इसी से साइन इन करेंगे।')}</p><label>${t('New password', 'नया पासवर्ड')}<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><label>${t('Confirm password', 'पासवर्ड की पुष्टि')}<input name="confirm" type="password" autocomplete="new-password" minlength="8" required></label><label class="remember-choice"><input type="checkbox" name="remember" checked> ${t('Stay signed in on this phone', 'इस फोन पर साइन इन रहें')}</label>${fieldError()}<button class="primary" type="submit">${t('Save password and continue', 'पासवर्ड सहेजें और आगे बढ़ें')}</button><button type="button" class="quiet" data-action="login">${t('Use another number / resend', 'दूसरा नंबर / फिर भेजें')}</button></form>`;
}

export function rememberFormMarkup({t}) {
  return `<form id="remember-form" class="stack" data-auth-step="remember">${steps(t, 'remember')}<p>${t('Your password is saved. Stay signed in on this phone?', 'पासवर्ड सहेज लिया गया। इस फोन पर साइन इन रहें?')}</p><label class="remember-choice"><input type="checkbox" name="remember" checked> ${t('Remember this phone so you stay signed in.', 'इस फोन को याद रखें ताकि आप साइन इन रहें।')}</label>${fieldError()}<button class="primary" type="submit">${t('Continue', 'आगे बढ़ें')}</button></form>`;
}

export function passwordFormMarkup({t, phoneLink = false}) {
  return `<form id="login-form" class="stack" data-auth-step="password-login"><p>${t('Enter the member password from your Nia team. This phone stays signed in.', 'निया टीम का सदस्य पासवर्ड डालें। यह फोन साइन इन रहेगा।')}</p><label>${t('Password', 'पासवर्ड')}<input name="password" type="password" autocomplete="current-password" required></label><label class="remember-choice"><input type="checkbox" name="remember" checked> ${t('Stay signed in on this phone', 'इस फोन पर साइन इन रहें')}</label>${fieldError()}<button class="primary" type="submit">${t('Sign in and stay signed in', 'साइन इन करें और साइन इन रहें')}</button>${phoneLink ? `<button type="button" class="quiet" data-action="phone-login">${t('Use your mobile number', 'अपना मोबाइल नंबर इस्तेमाल करें')}</button>` : ''}</form>`;
}
