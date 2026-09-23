import {createHash} from 'node:crypto';

const FIELDS=['orders','reservations','settlements','payments','scans'];
const operationalAudit=row=>row?.action!=='phone_recovery'&&!String(row?.action||'').startsWith('support_');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const digest=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const asArray=(value,key)=>{
  if(value===undefined)return [];
  if(!Array.isArray(value))throw new Error('invalid_test_book_'+key);
  return value;
};
const asObject=(value,key)=>{
  if(value===undefined)return {};
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('invalid_test_book_'+key);
  return value;
};

/** Inspect raw persisted JSON; preserve sessions, identity, support and recovery audit. */
export function discardTestCommerceBook(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('invalid_test_book');
  const state=structuredClone(raw), removed={},counts={};
  for(const field of FIELDS){
    removed[field]=asArray(state[field],field);
    counts[field]=removed[field].length;
    if(Object.hasOwn(state,field))state[field]=[];
  }
  if(state.commerce!==undefined){
    const commerce=asObject(state.commerce,'commerce');
    const requests=asObject(commerce.requests,'requests');
    const audit=asArray(commerce.audit,'audit');
    const operations=audit.filter(operationalAudit);
    removed.idempotencyKeys=requests;
    removed.auditHistory=operations;
    removed.catalogueConfig=commerce.config??null;
    counts.idempotencyKeys=Object.keys(requests).length;
    counts.auditHistory=operations.length;
    counts.catalogueConfig=commerce.config==null?0:1;
    commerce.requests={};
    commerce.audit=audit.filter(row=>!operationalAudit(row));
    commerce.config=null;
  }else{
    removed.idempotencyKeys={};removed.auditHistory=[];removed.catalogueConfig=null;
    counts.idempotencyKeys=0;counts.auditHistory=0;counts.catalogueConfig=0;
  }
  const removedHash=digest(removed);
  return {state,manifest:{counts,removedHash,remainingHash:digest(state),
    classification:'founder_verified_internal_test_data_2026-09-23'}};
}
