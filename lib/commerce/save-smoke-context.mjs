import {CommerceError} from './core.mjs';
export const SMOKE_SITE='production-smoke-pickup';
export function verifiedSmokeContext(value,sites,subject,now=Date.now()){
  if(value==null){if(sites?.some(site=>site.siteCode===SMOKE_SITE))throw new CommerceError('test_scope_unverified',403);return null;}
  const expiry=Date.parse(value.expiresAt);
  if(value.id!=='production-smoke-v1'||!/^customer_[a-f0-9]{32}$/.test(value.subject||'')||
    (subject!=null&&value.subject!==subject)||!Number.isFinite(expiry)||expiry<=now||expiry>now+7200000||
    !Array.isArray(sites)||sites.length!==1||sites[0].siteCode!==SMOKE_SITE)
    throw new CommerceError('test_scope_unverified',403);
  return {id:value.id,subject:value.subject,expiresAt:value.expiresAt};
}
