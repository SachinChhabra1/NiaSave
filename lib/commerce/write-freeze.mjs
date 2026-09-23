import { isDeepStrictEqual } from 'node:util';
import { COMMITMENTS_FROZEN } from '../../commerce-capabilities.js';
export const freezeResponse = () => ({status:503,body:{error:'pilot_commitments_paused',capabilities:{reserve:false,hold:false,apply:false}}});
// Reject before body parsing or state access. Authentication is outside this policy.
export function frozenRoute(method, rawPath) {
  if (!COMMITMENTS_FROZEN) return false;
  const path = rawPath.replace(/^\/api(?=\/|$)/,'').replace(/\/+$/,'') || '/';
  if (path === '/central/commerce') return false; // Gateway checks signed action.
  if (path.startsWith('/commerce/test/') || /^\/(?:bison|living)\/data\/sync$/.test(path)) return true;
  if (['GET','HEAD','OPTIONS'].includes(method)) return false;
  if (/^\/(?:bison|living)(?:\/|$)/.test(path)) return true;
  if (/^\/commerce\/(?:staff\/(?:config|action)|quote|orders|cancel|nests\/(?:quote|bookings|cancel|config)|earn\/applications|studios\/bulk)(?:\/|$)/.test(path)) return true;
  if (/^\/(?:connectors(?:\/.*)?|beat(?:\/.*)?|scan|stops|po|dispatch|invoice|biker|vendors|vendor-recon|payouts|cash|order|orders(?:\/.*)?)$/.test(path)) return true;
  return /^\/v1\/(?:save|orders|payments|nest|work\/extras|staff\/hub)(?:\/|$)/.test(path);
}
// A missed route cannot persist book changes alongside session/rate-limit writes.
export function saveBook(state) {
  const {commerce, ...book} = state;
  const {sessions,accounts,memberPasswords,limits,centralNonces,tickets,issues,...rest} = commerce || {};
  const frozenAudit=(rest.audit||[]).filter(row=>row.action!=='phone_recovery'&&!String(row.action||'').startsWith('support_'));
  return {...book,commerce:{requests:{},config:null,...rest,audit:frozenAudit}};
}
export function saveBookUnchanged(before, after) {
  return !COMMITMENTS_FROZEN || isDeepStrictEqual(saveBook(before),saveBook(after));
}
export function livingBookUnchanged(before, after) {
  return !COMMITMENTS_FROZEN || isDeepStrictEqual(before,after);
}

// Restore-time normalization must not rewrite the frozen source book when an
// unchanged authentication/support flow saves its own fields.
export function preserveFrozenBook(source, candidate) {
  if (!COMMITMENTS_FROZEN) return candidate;
  const next=structuredClone(source), incoming=candidate.commerce || {};
  next.commerce ||= {};
  for(const key of ['sessions','accounts','memberPasswords','limits','centralNonces','tickets','issues']) {
    if(incoming[key]!==undefined)next.commerce[key]=structuredClone(incoming[key]);
  }
  const prior=source.commerce?.audit || [];
  const added=(incoming.audit || []).slice(prior.length).filter(row=>row.action==='phone_recovery'||String(row.action||'').startsWith('support_'));
  if(added.length)next.commerce.audit=[...structuredClone(prior),...structuredClone(added)];
  return next;
}
