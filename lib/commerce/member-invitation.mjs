import {timingSafeEqual} from 'node:crypto';

// The invitation gate is independent of member identity. A passkey is still
// required by every member API after this outer rollout gate has passed.
export function memberInvitation(request,env=process.env){
  if(env.COMMERCE_STOREFRONT!=='1')return;
  const url=new URL(request.url),path=url.pathname;
  // The operator desk loads this module even when its member-order view is
  // inactive. An HTTP Basic challenge here blocks the unrelated staff login.
  // It contains no member data; hosted member operations remain in Central.
  if(path==='/commerce-ops.js')return;
  const routed=url.searchParams.get('path')||'';
  const memberApi=/^\/(?:api\/)+commerce(?:\/|$)/.test(path)||(['/api','/api/','/api/index','/api/index.mjs'].includes(path)&&/^\/?(?:api\/)?commerce(?:\/|$)/.test(routed));
  const memberPage=path==='/'||path==='/index.html'||path.startsWith('/commerce')||['/member.html','/member-services.html'].includes(path);
  if(!memberPage&&!memberApi)return;
  const headers={'cache-control':'no-store','x-robots-tag':'noindex, nofollow, noarchive'};
  let origin;
  try{origin=new URL(env.MEMBER_SITE_ORIGIN);if(origin.protocol!=='https:'||origin.origin!==env.MEMBER_SITE_ORIGIN)throw Error();}
  catch{return new Response('Member access is not configured.',{status:503,headers});}
  if(memberPage&&url.origin!==origin.origin){
    if(!['GET','HEAD'].includes(request.method))return new Response('Use the member website address.',{status:403,headers});
    return Response.redirect(origin.origin+url.pathname+url.search,308);
  }
  if(env.COMMERCE_MEMBER_AUTH!=='passkey'||env.MEMBER_INVITE_GATE!=='1'||(env.MEMBER_INVITE_PASSWORD||'').length<24)return new Response('Member access is not configured.',{status:503,headers});
  const actual=Buffer.from(request.headers.get('authorization')||''),expected=Buffer.from('Basic '+Buffer.from('showcase:'+env.MEMBER_INVITE_PASSWORD).toString('base64'));
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return new Response('NiaSave invited access. Enter your invitation credentials.',{status:401,headers:{...headers,'www-authenticate':'Basic realm="NiaSave invited access", charset="UTF-8"'}});
}
