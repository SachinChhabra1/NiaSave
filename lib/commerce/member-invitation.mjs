// Public entry renders the persistent login over a public-only backdrop.
// Central passkeys protect member APIs; staff/service authorization is separate.
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
  if(!['passkey','password'].includes(env.COMMERCE_MEMBER_AUTH))return new Response('Member access is not configured.',{status:503,headers});
  // API handlers verify Central member identity and permissions independently.
}
