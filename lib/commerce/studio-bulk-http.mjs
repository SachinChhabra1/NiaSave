import { isShowcaseEntry } from './showcase-mode.mjs';
import { hasDurableStore } from '../runtime-store.mjs';
import { PHOTO_SPEC } from './studio-photo.mjs';
import {
  STUDIO_SHEET_COLUMNS,
  csvTemplate,
  ingestStudioBulk,
  publicStudioRow
} from './studio-bulk.mjs';
import { loadTestStudios } from './studio-bulk-store.mjs';

const MAX_BODY = 32 * 1024 * 1024;
const PREVIEW_ORIGINS = new Set([
  'http://127.0.0.1:8080',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:8787',
  'http://localhost:8787'
]);

function isPreview() {
  return isShowcaseEntry() || (
    process.env.COMMERCE_PREVIEW === '1'
    && process.env.NODE_ENV !== 'production'
    && !process.env.VERCEL
    && !hasDurableStore()
  );
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function allowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return req.method === 'GET';
  const host = req.headers.host;
  if (origin === `http://${host}` || origin === `https://${host}`) return true;
  return PREVIEW_ORIGINS.has(origin);
}

async function readRaw(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > MAX_BODY) {
      const error = new Error('request_too_large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function decodePictures(input) {
  const pictures = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return pictures;
  for (const [name, value] of Object.entries(input)) {
    if (typeof value !== 'string' || !value) continue;
    pictures[name] = Buffer.from(value, 'base64');
  }
  return pictures;
}

async function readMultipart(req, raw) {
  const request = new Request('http://niasave.local/studios/bulk', {
    method: 'POST',
    headers: { 'content-type': req.headers['content-type'] },
    body: raw,
    duplex: 'half'
  });
  const form = await request.formData();
  let csvText = '';
  const pictures = {};
  for (const [name, value] of form.entries()) {
    if (typeof value === 'string') {
      if (name === 'csv' || name === 'sheet') csvText = value;
      continue;
    }
    const bytes = Buffer.from(await value.arrayBuffer());
    const filename = value.name || name;
    if (name === 'csv' || name === 'sheet' || /\.csv$/i.test(filename)) csvText = bytes.toString('utf8');
    else pictures[filename] = bytes;
  }
  return { csvText, pictures };
}

export async function studioBulkHttp(req, res, path) {
  if (!['GET', 'POST'].includes(req.method)) return send(res, 405, { error: 'method_not_allowed' });
  if (!isPreview()) return send(res, 403, { error: 'preview_required' });
  if (req.method !== 'GET' && !allowedOrigin(req)) return send(res, 403, { error: 'same_origin_required' });

  if (req.method === 'GET' && path === '/studios/bulk/template') {
    return send(res, 200, csvTemplate(), {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="live-studios-test.csv"'
    });
  }

  if (req.method === 'GET' && (path === '/studios/bulk' || path === '/studios/bulk/')) {
    const store = loadTestStudios();
    return send(res, 200, {
      preview: true,
      owner: 'central',
      test: true,
      columns: STUDIO_SHEET_COLUMNS,
      spec: PHOTO_SPEC,
      updatedAt: store.updatedAt,
      count: store.rows.length,
      rows: (store.rows || []).map(publicStudioRow)
    });
  }

  if (req.method !== 'POST' || (path !== '/studios/bulk' && path !== '/studios/bulk/')) {
    return send(res, 404, { error: 'not_found' });
  }

  let csvText = '';
  let pictures = {};
  try {
    const raw = await readRaw(req);
    const type = String(req.headers['content-type'] || '');
    if (type.includes('multipart/form-data')) {
      ({ csvText, pictures } = await readMultipart(req, raw));
    } else {
      const body = JSON.parse(raw.toString('utf8') || '{}');
      csvText = body.csv || body.sheet || '';
      pictures = decodePictures(body.pictures);
    }
  } catch (error) {
    return send(res, error.status || 400, { error: error.status === 413 ? 'request_too_large' : 'invalid_body' });
  }

  try {
    const result = ingestStudioBulk({ csvText, pictures });
    if (!result.ok) return send(res, 400, result);
    return send(res, 200, { preview: true, owner: 'central', test: true, ...result });
  } catch (error) {
    const code = error.code === 'photo_normalize_unavailable' ? 'photo_normalize_unavailable' : 'studio_bulk_failed';
    return send(res, code === 'photo_normalize_unavailable' ? 503 : 400, { error: code });
  }
}
