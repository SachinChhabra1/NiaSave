import { showcaseAccess } from './access.mjs';
import { showcaseReady, enableShowcaseEntry } from '../lib/commerce/showcase-mode.mjs';
// Set before dynamic imports capture storage configuration. Never use the broad
// legacy API entry here: only commerce and the signed Central gateway are exposed.
enableShowcaseEntry();
let runtime;
export default async function handler(req,res) {
  const send=(status,body,headers={})=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-robots-tag':'noindex, nofollow',...headers});res.end(JSON.stringify(body));};
  if(!showcaseReady()) return send(503,{error:'showcase_not_configured'});
  const url=new URL(req.url,'https://'+req.headers.host);
  const path=['/api','/api/showcase','/api/showcase.mjs'].includes(url.pathname) ? '/api/'+(url.searchParams.get('path')||'').replace(/^\/+/, '') : url.pathname;
  const central=path==='/api/central/commerce';
  if(!central && !showcaseAccess(req.headers.authorization)) return send(401,{error:'showcase_invitation_required'},{'www-authenticate':'Basic realm="NiaSave showcase"'});
  if(!central && !path.startsWith('/api/commerce/') && path!=='/api/showcase/health') return send(404,{error:'not_found'});
  try {
    runtime ||= Promise.all([import('../lib/commerce/http.mjs'),import('../lib/commerce/central-http.mjs'),import('./bootstrap.mjs')]);
    const [commerce,operations,bootstrap]=await runtime;
    // Unauthenticated gateway requests must not seed or touch storage.
    if(central) return await operations.centralCommerceHttp(req,res);
    const ready=await bootstrap.bootstrapShowcase();
    if(ready.status!==200) return send(ready.status,ready.body);
    if(path==='/api/showcase/health') return send(200,{status:'ready',environment:'showcase',storage:'postgres',payments:false,partners:false,sharedDemoMember:true});
    return await commerce.commerceHttp(req,res,path.slice('/api/commerce'.length),()=>null);
  } catch {return send(503,{error:'showcase_storage_unavailable'});}
}
