import {timingSafeEqual} from 'node:crypto';

const inviteChallenge='Basic realm="NiaSave invited access", charset="UTF-8"';
const invitePage='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NiaSave invited access</title><style>body{margin:0;background:#f6f7fb;color:#1f2c3a;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}main{max-width:560px;margin:12vh auto;padding:28px 24px;background:#fff;border:1px solid #dfe5ee;border-radius:16px;box-shadow:0 18px 60px #1723341f}h1{margin:0 0 12px;font-size:28px;line-height:1.2}p{margin:0 0 12px}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;background:#f4f6fa;padding:2px 6px;border-radius:6px}</style></head><body><main><h1>NiaSave invited access</h1><p>This member entry is invite-only.</p><p>Use the invitation credentials from your Nia team. Once invited, the member sign-in card will load automatically.</p><p>If the browser prompt was dismissed, reload this page to try again.</p><p><code>www.niasave.com</code></p></main></body></html>';

function inviteResponse(method,headers){
  const responseHeaders={...headers,'content-type':'text/html; charset=utf-8','www-authenticate':inviteChallenge};
  return new Response(method==='HEAD'?null:invitePage,{status:401,headers:responseHeaders});
}

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
  if(actual.length===expected.length&&timingSafeEqual(actual,expected))return;
  if(memberPage&&['GET','HEAD'].includes(request.method))return inviteResponse(request.method,headers);
  return new Response('NiaSave invited access. Enter your invitation credentials.',{status:401,headers:{...headers,'www-authenticate':inviteChallenge}});
}
