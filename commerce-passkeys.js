const decode=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0));
const encode=value=>btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
// Setup secrets arrive in the fragment, never in server URLs. Keep them only
// in memory and remove them from browser history before making any API call.
export function takePasskeySetup(location,history) {
  if(!location.hash.startsWith('#setup?'))return '';
  const token=new URLSearchParams(location.hash.slice(7)).get('token')||'';
  history.replaceState(null,'',location.pathname+location.search+'#account');
  return /^[A-Za-z0-9_-]{43}$/.test(token)?token:'';
}
export function passkeyMarkup({t,setup=false}) {
  const form=`<form id="passkey-setup-form" class="stack">
    <p>${t('Your Nia setup link is ready. Confirm this is your phone, then use its screen lock.')}</p>
    <label><input type="checkbox" name="ownPhone" required> ${t('This is my own phone, not a shared phone.')}</label>
    <button class="primary" type="submit">${t('Set up my passkey')}</button></form>`;
  return `<div class="stack">${setup?form:`<p>${t('Use your own phone’s screen lock to sign in. No SMS code is needed.')}</p>
    <button class="primary" data-action="passkey-signin">${t('Sign in with a passkey')}</button>
    <details><summary>${t('First time or a replacement phone?')}</summary>
    <p>${t('Ask your Nia team for a setup link after they verify your membership. Open it on your own phone within 10 minutes. No code to type.')}</p></details>`}
    <p>${t('Lost access? Your Nia team will check your identity before restoring access. Your history stays with your membership.')}</p>
    <button data-action="help">${t('Contact your Nia team')}</button><div id="form-error" class="error-inline" role="alert"></div></div>`;
}
export async function usePasskey(api,mode,setupToken) {
  if(!globalThis.isSecureContext||!navigator.credentials||!globalThis.PublicKeyCredential)throw {code:'passkey_device_unavailable'};
  const {options}=await api('/auth/passkey/options',{mode,...(mode==='register'?{setupToken}: {})});
  const publicKey={...options,challenge:decode(options.challenge)};
  if(mode==='register'){
    publicKey.user={...options.user,id:decode(options.user.id)};
    publicKey.excludeCredentials=(options.excludeCredentials||[]).map(c=>({...c,id:decode(c.id)}));
  }else publicKey.allowCredentials=(options.allowCredentials||[]).map(c=>({...c,id:decode(c.id)}));
  let credential;
  try{credential=await navigator.credentials[mode==='register'?'create':'get']({publicKey});}
  catch{throw {code:'passkey_cancelled'};}
  if(!credential)throw {code:'passkey_cancelled'};
  const r=credential.response;
  const response={id:credential.id,rawId:encode(credential.rawId),type:credential.type,
    clientExtensionResults:credential.getClientExtensionResults(),authenticatorAttachment:credential.authenticatorAttachment,
    response:{clientDataJSON:encode(r.clientDataJSON),...(mode==='register'?{attestationObject:encode(r.attestationObject),transports:r.getTransports?.()||[]}:
      {authenticatorData:encode(r.authenticatorData),signature:encode(r.signature),userHandle:r.userHandle?encode(r.userHandle):null})}};
  return api('/auth/passkey/verify',{response});
}
