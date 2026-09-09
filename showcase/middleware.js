import { showcaseAccess } from './showcase/access.mjs';
export const config = { runtime: 'nodejs', matcher: '/:path*' };
export default function middleware(request) {
  const headers = { 'cache-control':'no-store', 'x-robots-tag':'noindex, nofollow, noarchive' };
  if(process.env.VERCEL_ENV === 'production' || process.env.NIA_SHOWCASE !== '1' || (process.env.SHOWCASE_PASSWORD||'').length < 24) return new Response('Showcase is not configured.',{status:503,headers});
  // The gateway authenticates signed Central envelopes itself; no other bypass.
  if(new URL(request.url).pathname === '/api/central/commerce') return;
  if(!showcaseAccess(request.headers.get('authorization'))) return new Response('NiaSave private showcase. Enter your showcase invitation credentials.',{status:401,headers:{...headers,'www-authenticate':'Basic realm="NiaSave showcase", charset="UTF-8"'}});
}
