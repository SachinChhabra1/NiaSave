// Transport shutdown only. No Central business rule is implemented here.
// P0 preserves existing session and personal-book endpoints until their cutover.
const sessionPosts = new Set([
  '/v1/staff/login', '/v1/staff/logout',
  '/commerce/auth/login', '/commerce/auth/logout', '/commerce/auth/request',
  '/commerce/auth/verify', '/commerce/auth/password/request',
  '/commerce/auth/password/verify', '/commerce/auth/set-password',
  '/commerce/auth/password', '/commerce/auth/password/set',
  '/commerce/auth/passkey/options', '/commerce/auth/passkey/verify',
]);
const personalBookPosts = new Set(['/commerce/books/entries', '/commerce/books/consent']);

export function canonicalPath(requestUrl) {
  const url = new URL(requestUrl, 'http://localhost');
  let path = url.searchParams.get('path') || url.pathname;
  // Reject ambiguous encodings before any legacy router can interpret them.
  if (/%|\\|\0/.test(path)) throw new Error('ambiguous_path');
  path = '/' + path.replace(/^\/+/, '').replace(/\/+$/, '');
  if (path.startsWith('/api/')) path = path.slice(4);
  return path;
}

export function p0Decision(method, path) {
  // These reads can also run a mutation or initialise an operating book.
  if (path === '/central/commerce' || path.startsWith('/commerce/staff/') ||
      path === '/commerce/nests/config' || /^\/(bison|living)\/data\/sync$/.test(path)) return 'central_operations_required';
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return null;
  if (method === 'POST' && (sessionPosts.has(path) || personalBookPosts.has(path))) return null;
  // A future route or an unrecognised HTTP verb cannot open another write path.
  return 'central_contract_required';
}

export function enforceP0(req, res) {
  let reason;
  try { reason = p0Decision(req.method, canonicalPath(req.url)); }
  catch { reason = 'ambiguous_path'; }
  if (!reason) return false;
  res.writeHead(410, {'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff'});
  res.end(JSON.stringify({error: reason, message:'This operation has moved to Central.'}));
  return true;
}

// Apply the same shutdown before invitation/staff middleware can mask a 410.
export function p0WebResponse(request) {
  let response,status,headers;
  enforceP0(request,{
    writeHead(value,fields){status=value;headers=fields;},
    end(body){response=new Response(body,{status,headers});},
  });
  return response;
}
