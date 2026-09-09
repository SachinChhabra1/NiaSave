import { showcaseAccess } from './showcase-runtime/showcase/access.mjs';
export const config = { runtime:'nodejs', matcher:'/:path*' };
export default function middleware(request) {
  const path=new URL(request.url).pathname;
  // The legacy operations pages retain their own existing access controls.
  const storefront=path==='/' || path==='/index.html' || path.startsWith('/commerce') || path.startsWith('/api/commerce/') || path.startsWith('/api/showcase');
  if(!storefront)return;
  const headers={'cache-control':'no-store','x-robots-tag':'noindex, nofollow, noarchive'};
  if(process.env.NIA_SHOWCASE!=='1'||(process.env.SHOWCASE_PASSWORD||'').length<24)return new Response('Showcase is not configured.',{status:503,headers});
  if(!showcaseAccess(request.headers.get('authorization')))return new Response('NiaSave private showcase. Enter your invitation credentials.',{status:401,headers:{...headers,'www-authenticate':'Basic realm="NiaSave showcase", charset="UTF-8"'}});
}
