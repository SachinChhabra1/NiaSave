import {randomBytes} from 'node:crypto';
import {centralMemberRequest,centralConfigured} from './central-client.mjs';
import {CommerceError} from './core.mjs';
const actorSlot=Symbol('central-passkey-actor');
export const passkeysEnabled=()=>process.env.COMMERCE_MEMBER_AUTH==='passkey';
export const passkeysReady=()=>passkeysEnabled()&&centralConfigured();
export const passkeyActor=req=>req[actorSlot]||null;
const cookies=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim().split('=')));
const cookie=(name,value,age)=>`${name}=${value}; Path=/api/commerce; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
const call=(kind,body)=>centralMemberRequest(kind,'passkey-bootstrap',body);
const publicAccount=a=>a&&({id:a.id,name:a.name,role:a.role,locationIds:a.locationIds});

// Browser identifiers are ignored. Central verifies the ceremony and returns
// the immutable history owner separately from the current authentication subject.
export async function preparePasskeys(req,path,body,{allowAttempt=async()=>true}={}) {
  const jar=cookies(req),token=jar.nia_commerce?.startsWith('pk-')?jar.nia_commerce.slice(3):'';
  if(path==='/auth/logout'&&req.method==='POST'){
    if(token){const result=await call('passkey.logout',{token});if(result.status!==200)return result;}
    return {status:200,body:{ok:true},headers:{'set-cookie':cookie('nia_commerce','',0)}};
  }
  if(path==='/auth/passkey/options'&&req.method==='POST'){
    if(!await allowAttempt())return {status:429,body:{error:'too_many_attempts'}};
    const binding=randomBytes(32).toString('base64url');
    const result=await call('passkey.options',{mode:body.mode,setupToken:body.setupToken,binding});
    if(result.status!==200)return result;
    if(!/^[A-Za-z0-9_-]{43}$/.test(result.body.challengeId||''))throw new CommerceError('central_invalid_response',503);
    return {status:200,body:{options:result.body.options},headers:{'set-cookie':cookie('nia_ceremony',result.body.challengeId+'.'+binding,300)}};
  }
  if(path==='/auth/passkey/verify'&&req.method==='POST'){
    if(!await allowAttempt())return {status:429,body:{error:'too_many_attempts'}};
    const [challengeId,binding]=String(jar.nia_ceremony||'').split('.');
    if(!/^[A-Za-z0-9_-]{43}$/.test(challengeId||'')||!/^[A-Za-z0-9_-]{43}$/.test(binding||''))return {status:401,body:{error:'ceremony_expired'}};
    const result=await call('passkey.verify',{challengeId,binding,response:body.response});
    if(result.status!==200)return {...result,headers:{'set-cookie':cookie('nia_ceremony','',0)}};
    if(!/^[A-Za-z0-9_-]{43}$/.test(result.body.token||'')||!result.body.account?.id)throw new CommerceError('central_invalid_response',503);
    return {status:200,body:{account:publicAccount(result.body.account)},headers:{'set-cookie':[cookie('nia_commerce','pk-'+result.body.token,43200),cookie('nia_ceremony','',0)]}};
  }
  if(path.startsWith('/auth/'))return {status:404,body:{error:'use_passkey_access'}};
  req[actorSlot]=null;
  if(token){
    const result=await call('passkey.session',{token});
    if(result.status===200){
      const a=result.body.account;
      if(!a||a.role!=='member'||typeof a.id!=='string'||typeof a.authSubject!=='string'||!Array.isArray(a.locationIds))throw new CommerceError('central_invalid_response',503);
      if(a.historyIds!==undefined&&(!Array.isArray(a.historyIds)||a.historyIds.length>20||a.historyIds.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9_.:@+|-]{1,200}$/.test(id))))throw new CommerceError('central_invalid_response',503);
      req[actorSlot]={...a,identitySource:'central-passkey'};
    }else if(result.status!==401)return result;
  }
  if(!req[actorSlot]&&path==='/catalogue')return {status:200,body:{preview:false,memberAuth:'passkey',account:null,products:[],locations:[],status:'sign_in_required',paymentsEnabled:false}};
  if(!req[actorSlot]&&!path.startsWith('/staff/'))return {status:401,body:{error:'sign_in_required'}};
  return null;
}
