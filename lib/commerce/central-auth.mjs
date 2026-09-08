import { createHmac, timingSafeEqual } from 'node:crypto';
import { CommerceError } from './core.mjs';

// The signed envelope binds the exact body, caller and timestamp. This key is
// server-only and distinct from member cookies and legacy desk tokens.
export function centralSignature(raw,key) { return createHmac('sha256',key).update('niasave-central-v1\n'+raw).digest('hex'); }
export function verifyCentralEnvelope(raw,signature,key,time) {
  if(typeof key!=='string'||key.length<32)throw new CommerceError('central_connection_not_configured',503);
  if(typeof signature!=='string'||!/^[a-f0-9]{64}$/.test(signature)||!timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(centralSignature(raw,key),'hex')))throw new CommerceError('central_auth_required',401);
  let value;try{value=JSON.parse(raw);}catch{throw new CommerceError('invalid_json');}
  if(!Number.isSafeInteger(value.at)||Math.abs(time-value.at)>60000||!/^[a-zA-Z0-9_-]{16,100}$/.test(value.nonce||''))throw new CommerceError('central_request_expired',401);
  const actor=value.actor;
  if(!actor||!/^[a-zA-Z0-9_-]{1,100}$/.test(actor.id||'')||!['admin','operator','reader'].includes(actor.role))throw new CommerceError('central_actor_required',403);
  return {...value,actor:{id:actor.id,role:actor.role,staff:true}};
}
