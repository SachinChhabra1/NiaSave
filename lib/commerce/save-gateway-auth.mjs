import {hasDurableStore,loadRuntimeState,saveRuntimeState} from '../runtime-store.mjs';
import {createStateRunner} from './transaction.mjs';
export const SAVE_AUTH_KEY='niasave-save-auth-v1';
let current={schemaVersion:1,nonces:{}};
const run=createStateRunner({durable:hasDurableStore,
  load:()=>loadRuntimeState(SAVE_AUTH_KEY,{schemaVersion:1,nonces:{}}),
  save:(value,version)=>saveRuntimeState(SAVE_AUTH_KEY,value,version),snapshot:()=>current,
  restore:value=>{if(value?.schemaVersion!==1||!value.nonces||typeof value.nonces!=='object')throw Error('invalid_save_auth_book');current=structuredClone(value);}});
export async function authenticateSaveGateway(envelope,time=Date.now()){
  if(!hasDurableStore())return {status:503,body:{error:'save_storage_unavailable'}};
  return run(true,()=>{
    for(const [nonce,entry] of Object.entries(current.nonces))if(entry.expiresAt<=time)delete current.nonces[nonce];
    if(current.nonces[envelope.nonce])return {status:409,body:{error:'central_request_replayed'}};
    if(Object.values(current.nonces).filter(entry=>entry.actor===envelope.actor.id).length>=600)return {status:429,body:{error:'too_many_attempts'}};
    current.nonces[envelope.nonce]={actor:envelope.actor.id,expiresAt:time+120000};
    return {status:200,body:{ok:true}};
  },true);
}
