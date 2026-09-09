import { createSign } from 'node:crypto';

// Reporting projection only. Never writes the Living booking/contract book.
export const OCCUPANCY_SHEET_ID = '1e54fm3oUeseNzsTFG8O4XweRnWVU2n8OvBc7MLOu6nE';
const RANGE = "'UI_Occupancy'!A6:N6000";
const REQUIRED = ['Sample_Live', 'Reporting_Date', 'Reporting_Time', 'Studio_ID', 'Contracted_Nests', 'Occupied_Nests', 'Vacant_Nests'];
const count = value => {
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};
function date(value) {
  const raw = typeof value === 'number'
    ? new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000).toISOString().slice(0, 10)
    : String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && new Date(raw + 'T00:00:00Z').toISOString().slice(0, 10) === raw ? raw : null;
}
function time(value) {
  if (typeof value === 'number' && value >= 0 && value < 1) return Math.round(value * 86400);
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match || +match[1] > 23 || +match[2] > 59 || +(match[3] || 0) > 59) return null;
  return +match[1] * 3600 + +match[2] * 60 + +(match[3] || 0);
}
export function projectCurrentPosition(values, fetchedAt) {
  if (!Array.isArray(values) || values.length >= 5995) throw new Error('occupancy_source_invalid');
  const headers = (values[0] || []).map(v => String(v).trim());
  if (REQUIRED.some(h => headers.indexOf(h) < 0 || headers.indexOf(h) !== headers.lastIndexOf(h))) throw new Error('occupancy_source_headers');
  const index = Object.fromEntries(REQUIRED.map(h => [h, headers.indexOf(h)]));
  const studios = new Map();
  for (const cells of values.slice(1)) {
    if (!Array.isArray(cells)) throw new Error('occupancy_source_invalid');
    if (String(cells[index.Sample_Live] || '').trim().toLowerCase() !== 'live') continue;
    const id = String(cells[index.Studio_ID] || '').trim();
    const reportingDate = date(cells[index.Reporting_Date]);
    const reportingTime = time(cells[index.Reporting_Time]);
    if (!id || /sample|example|do.not.count/i.test(id) || !reportingDate || reportingTime === null) throw new Error('occupancy_source_identity');
    const row = { id, date: reportingDate, time: reportingTime, capacity: count(cells[index.Contracted_Nests]), inHouse: count(cells[index.Occupied_Nests]), vacant: count(cells[index.Vacant_Nests]) };
    const previous = studios.get(id);
    if (previous && previous.date === row.date && previous.time === row.time && JSON.stringify(previous) !== JSON.stringify(row)) throw new Error('occupancy_source_duplicate');
    if (!previous || row.date > previous.date || (row.date === previous.date && row.time >= previous.time)) studios.set(id, row);
  }
  if (!studios.size) throw new Error('occupancy_source_empty');
  const rows = [...studios.values()];
  const missing = {}, totals = {};
  for (const metric of ['capacity', 'inHouse', 'vacant']) {
    missing[metric] = rows.filter(r => r[metric] === null).length;
    totals[metric] = missing[metric] === rows.length ? null : rows.reduce((s, r) => s + (r[metric] ?? 0), 0);
  }
  const inconsistent = rows.filter(r => r.capacity !== null && r.inHouse !== null && r.vacant !== null && r.capacity !== r.inHouse + r.vacant).length;
  const reportingDates = [...new Set(rows.map(r => r.date))].sort();
  return { source: 'UI_Occupancy', status: Object.values(missing).some(Boolean) || inconsistent || reportingDates.length > 1 ? 'partial' : 'ready', fetchedAt, reportingDates,
    sourceUrl: `https://docs.google.com/spreadsheets/d/${OCCUPANCY_SHEET_ID}/edit#gid=1229787351`,
    kpis: { ...totals, studios: rows.length }, missing, inconsistent };
}

export function createCurrentPositionReader({ fetchImpl = fetch, env = process.env, now = Date.now, cacheMs = 60000 } = {}) {
  let cached, expires = 0, inFlight;
  async function read() {
    const raw = env.BISON_GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('occupancy_credentials_missing');
    let account;
    try { account = JSON.parse(raw); } catch { throw new Error('occupancy_credentials_invalid'); }
    if (!account.client_email || !account.private_key) throw new Error('occupancy_credentials_invalid');
    const at = Math.floor(now() / 1000);
    const encode = v => Buffer.from(JSON.stringify(v)).toString('base64url');
    const unsigned = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + encode({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly', aud: 'https://oauth2.googleapis.com/token', iat: at, exp: at + 3600 });
    const signer = createSign('RSA-SHA256'); signer.update(unsigned); signer.end();
    const tokenResponse = await fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + signer.sign(account.private_key.replace(/\\n/g, '\n'), 'base64url') }), signal: AbortSignal.timeout(8000), redirect: 'error' });
    if (!tokenResponse.ok) throw new Error('occupancy_google_auth_failed');
    const token = await tokenResponse.json();
    if (!token.access_token) throw new Error('occupancy_google_auth_failed');
    const response = await fetchImpl(`https://sheets.googleapis.com/v4/spreadsheets/${OCCUPANCY_SHEET_ID}/values/${encodeURIComponent(RANGE)}?valueRenderOption=UNFORMATTED_VALUE`, { headers: { authorization: 'Bearer ' + token.access_token }, signal: AbortSignal.timeout(8000), redirect: 'error' });
    if (!response.ok) throw new Error(response.status === 403 ? 'occupancy_sheet_access_denied' : 'occupancy_sheet_read_failed');
    const result = projectCurrentPosition((await response.json()).values, new Date(now()).toISOString());
    cached = result; expires = now() + cacheMs;
    return result;
  }
  return async () => {
    if (cached && now() < expires) return cached;
    if (!inFlight) inFlight = read().catch(error => { cached = null; expires = 0; throw error; }).finally(() => { inFlight = null; });
    return inFlight;
  };
}
export const readCurrentPosition = createCurrentPositionReader();
