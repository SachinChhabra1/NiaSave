const fields = ['studios', 'capacity', 'occupiedBeds', 'cities', 'enterpriseClients'];
export function safePublicStats(body, now = Date.now()) {
  const at = Date.parse(body?.asOf);
  if (!Number.isFinite(at) || at > now || now - at > 300000) throw new Error('stats_unavailable');
  return Object.fromEntries([...fields.map(key => [key, Number.isSafeInteger(body[key]) && body[key] >= 0 ? body[key] : null]), ['asOf', new Date(at).toISOString()]]);
}
export async function publicStatsHttp(req, res, { env = process.env, fetchImpl = fetch } = {}) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.statusCode = 405; return res.end('{}'); }
  try {
    const origin = new URL(env.CENTRAL_ORIGIN);
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error();
    const response = await fetchImpl(new URL('/api/public-stats', origin), { signal: AbortSignal.timeout(4000), redirect: 'error', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error();
    const body = safePublicStats(await response.json());
    // Never keep a second stale copy or opt into stale-on-error at this edge.
    const remaining = Math.max(0, Math.floor((300000 - (Date.now() - Date.parse(body.asOf))) / 1000));
    res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${Math.min(300, remaining)}, must-revalidate`);
    res.statusCode = 200; return res.end(JSON.stringify(body));
  } catch {
    res.statusCode = 503; return res.end(JSON.stringify({ error: 'stats_unavailable' }));
  }
}
export default publicStatsHttp;
