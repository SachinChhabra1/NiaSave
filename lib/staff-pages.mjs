import {verifyActiveStaffToken, STAFF_PAGE_COOKIE} from './staff-auth.mjs';

const living=new Set(['bison','bison-studios','bison-contracts','bison-clocks','bison-collections','bison-nests','bison-data']);
const sikh=new Set(['ops','polo','pickup','recon','predict','hub','next','cash','source','inventory','ageing','po','dispatch','invoice','biker']);
const shared=new Set(['desk','2para']);
const headers={'content-type':'text/html; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'same-origin','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'"};
const signIn='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Nia · Staff sign-in</title><link rel="stylesheet" href="/staff.css"></head><body><main><h1>Sign in to your desk</h1><p id="staff-entry-status" role="status">Use your Nia email and operator password.</p></main><script src="/staff.js"></script><script src="/staff-entry.js"></script></body></html>';

export async function staffPageAccess(request) {
  let path;
  try {path=decodeURIComponent(new URL(request.url).pathname).replace(/\/+$/,'').replace(/\.html$/,'');}
  catch {return new Response('Invalid address.',{status:400,headers});}
  const name=path.slice(1), dogra=path==='/tanot'||path.startsWith('/tanot/');
  if(!living.has(name)&&!sikh.has(name)&&!shared.has(name)&&!dogra)return;
  const authorization=request.headers.get('authorization')||'';
  const bearer=/^Bearer\s+(.+)$/i.exec(authorization)?.[1]||'';
  const cookies=(request.headers.get('cookie')||'').split(';').map(x=>x.trim());
  const cookie=cookies.find(x=>x.startsWith(STAFF_PAGE_COOKIE+'='))?.slice(STAFF_PAGE_COOKIE.length+1)||'';
  const staff=await verifyActiveStaffToken(bearer||cookie);
  if(!staff)return new Response(request.method==='HEAD'?null:signIn,{status:401,headers});
  const allowed=staff.role==='admin'||shared.has(name)||(living.has(name)&&staff.desks.some(d=>['living','studio','money'].includes(d)))||(sikh.has(name)&&staff.desks.some(d=>['studio','hub','money','pilot'].includes(d)))||(dogra&&staff.desks.some(d=>['studio','money','pilot'].includes(d)));
  if(!allowed)return new Response('This desk is not assigned to your account.',{status:403,headers});
}
