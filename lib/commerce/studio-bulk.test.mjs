import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { STUDIO_COUNT, STUDIO_NAMES } from '../../rabbit/scale.mjs';
import { PHOTO_SPEC, normalizeStudioPhoto } from './studio-photo.mjs';
import {
  STUDIO_SHEET_COLUMNS,
  STUDIO_BULK_CAP,
  parseCsv,
  csvTemplate,
  validateStudioRow,
  validateBulk,
  overlayTestOffers,
  isTestStudioId,
  ingestStudioBulk
} from './studio-bulk.mjs';
import { clearTestStudios, saveTestStudios, listActiveTestStudios } from './studio-bulk-store.mjs';

process.env.COMMERCE_PREVIEW = '1';
process.env.DATABASE_URL = '';
process.env.NODE_ENV = 'test';
delete process.env.VERCEL;

const { handler } = await import('../../api/server.mjs');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function pngChunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function rgbPng(path, width, height, color) {
  const [r, g, b] = color;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const i = row + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]));
}

function csvRows(rows) {
  return STUDIO_SHEET_COLUMNS.join(',') + '\n' + rows.map(r => STUDIO_SHEET_COLUMNS.map(c => r[c]).join(',')).join('\n') + '\n';
}

function validRow(over = {}) {
  return {
    site_code: 'TEST-ALPHA',
    name: 'Test Studio Alpha',
    theatre: 'Test Theatre',
    city: 'Bengaluru',
    address: 'Illustrative test address. Not a real Nest.',
    picture: 'alpha.png',
    active: 'true',
    ...over
  };
}

async function request(path, { method = 'GET', body, headers = {}, raw } = {}) {
  const payload = raw || (body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]);
  const req = Readable.from(payload);
  Object.assign(req, {
    url: '/api/commerce' + path,
    method,
    headers: {
      host: 'localhost:8787',
      origin: 'http://localhost:8787',
      'content-type': headers['content-type'] || (method === 'GET' ? undefined : 'application/json'),
      ...headers
    },
    socket: { remoteAddress: '127.0.0.1' }
  });
  let code, head, text;
  const res = {
    writeHead(status, h) { code = status; head = h; },
    end(rawBody) { text = rawBody; }
  };
  await handler(req, res);
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: code, headers: head, body: parsed, text };
}

test.afterEach(() => clearTestStudios());

test('sheet columns match the Live ingest contract', () => {
  assert.deepEqual(STUDIO_SHEET_COLUMNS, ['site_code', 'name', 'theatre', 'city', 'address', 'picture', 'active']);
  assert.match(csvTemplate(), /^site_code,name,theatre,city,address,picture,active/);
  const parsed = parseCsv(csvRows([validRow()]));
  assert.deepEqual(parsed.columns, STUDIO_SHEET_COLUMNS);
});

test('TEST-flagged rows only; Polo stops and real nest names are refused', () => {
  const pictures = { 'alpha.png': Buffer.from('x') };
  assert.equal(validateStudioRow(validRow(), pictures).ok, true);
  assert.ok(validateStudioRow(validRow({ site_code: 'S01' }), pictures).errors.includes('polo_stop_forbidden'));
  assert.ok(validateStudioRow(validRow({ site_code: 'S40' }), pictures).errors.includes('polo_stop_forbidden'));
  assert.ok(validateStudioRow(validRow({ site_code: 'BLR-01' }), pictures).errors.includes('test_site_code_required'));
  assert.ok(validateStudioRow(validRow({ name: 'Test Ompal' }), pictures).errors.includes('real_studio_name_forbidden'));
  assert.ok(validateStudioRow(validRow({ name: 'Nia Nest Ompal' }), pictures).errors.includes('real_studio_name_forbidden'));
  assert.ok(validateStudioRow(validRow({ theatre: 'Rajputana Theatre' }), pictures).errors.includes('test_theatre_required'));
  assert.ok(validateStudioRow(validRow({ address: '12 MG Road, Bengaluru' }), pictures).errors.includes('test_address_required'));
  assert.ok(validateStudioRow(validRow({ address: 'A real nest on MG Road' }), pictures).errors.includes('test_address_required'));
  assert.equal(validateBulk(Array.from({ length: STUDIO_BULK_CAP + 1 }, (_, i) => validRow({ site_code: 'TEST-X' + i, picture: 'alpha.png' })), pictures).error, 'studio_cap_100');
});

test('Polo lock stays at 40 named stops', () => {
  assert.equal(STUDIO_COUNT, 40);
  assert.equal(STUDIO_NAMES.length, 40);
  assert.equal(STUDIO_NAMES[0], 'Ompal');
});

test('photos from different source sizes normalize to identical 1200x900 WebP', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nia-photo-'));
  const sources = [
    [640, 480, [40, 80, 120]],
    [200, 900, [180, 40, 40]],
    [1600, 900, [40, 160, 80]],
    [1024, 1024, [200, 180, 40]]
  ];
  const sizes = new Set();
  try {
    sources.forEach(([w, h, color], i) => {
      const src = join(dir, `src-${i}.png`);
      const dest = join(dir, `out-${i}.webp`);
      rgbPng(src, w, h, color);
      const info = normalizeStudioPhoto(src, dest);
      assert.equal(info.width, 1200);
      assert.equal(info.height, 900);
      assert.equal(info.aspect, '4:3');
      assert.equal(info.format, 'webp');
      assert.equal(info.quality, 80);
      assert.equal(info.crop, 'cover-attention');
      assert.equal(info.sourceWidth, w);
      assert.equal(info.sourceHeight, h);
      const out = readFileSync(dest);
      assert.ok(out.length > 32);
      assert.equal(out.toString('ascii', 0, 4), 'RIFF');
      assert.equal(out.toString('ascii', 8, 12), 'WEBP');
      sizes.add(`${info.width} ${info.height} ${info.format}`);
    });
    assert.equal(sizes.size, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('preview overlay replaces dummy Live cards with TEST studios and blocks reserve', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nia-ingest-'));
  try {
    const src = join(dir, 'alpha.png');
    rgbPng(src, 320, 240, [30, 90, 160]);
    const result = ingestStudioBulk({
      csvText: csvRows([validRow()]),
      pictures: { 'alpha.png': readFileSync(src) }
    });
    assert.equal(result.ok, true);
    assert.equal(result.spec.width, PHOTO_SPEC.width);
    assert.equal(result.rows[0].media.illustrative, true);
    assert.equal(result.rows[0].media.approved, false);
    assert.equal(result.rows[0].centralSource.system, 'rafiqi-central');
    assert.equal(result.rows[0].centralSource.preview, true);
    assert.equal(isTestStudioId(result.rows[0].studioId), true);

    const cat = await request('/nests');
    assert.equal(cat.status, 200);
    assert.equal(cat.body.testStudios, true);
    assert.equal(cat.body.offers.length, 1);
    assert.equal(cat.body.offers[0].studioId, 'std-test-alpha');
    assert.equal(cat.body.offers[0].test, true);
    assert.match(cat.body.offers[0].terms, /No online payment/);
    assert.equal(cat.body.offers[0].photo.width, 1200);
    assert.equal(cat.body.offers[0].photo.height, 900);

    const quoted = await request('/nests/quote', { method: 'POST', body: { studioId: 'std-test-alpha', start: cat.body.start } });
    assert.equal(quoted.status, 503);
    assert.equal(quoted.body.error, 'pilot_commitments_paused');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    clearTestStudios();
  }
});

test('bulk reads remain preview-only and M0 refuses imports', async () => {
  const listed = await request('/studios/bulk');
  assert.equal(listed.status, 200);
  assert.equal(listed.body.preview, true);
  assert.deepEqual(listed.body.columns, STUDIO_SHEET_COLUMNS);

  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const blocked = await request('/studios/bulk', { method: 'POST', body: { csv: csvTemplate() } });
    assert.equal(blocked.status, 503);
    assert.equal(blocked.body.error, 'pilot_commitments_paused');
  } finally {
    process.env.NODE_ENV = previous;
  }
});

test('payments stay off and nest tiles are 4:3 cards on a flat canvas', () => {
  const src = readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
  const apple = readFileSync(new URL('../../niasave-apple-store.css', import.meta.url), 'utf8');
  const catalogue = readFileSync(new URL('./member-password.mjs', import.meta.url), 'utf8');
  assert.match(catalogue, /paymentsEnabled:\s*false/);
  assert.doesNotMatch(src, /paymentsEnabled\s*=\s*true/);
  assert.match(src, /data-action="nest-preview"/);
  assert.match(apple, /--nia-canvas:#ffffff/);
  assert.match(apple, /--nia-band:#f5f5f7/);
  assert.match(apple, /aspect-ratio:4\/3!important/);
  assert.match(apple, /body\.mesha-dark \.store-live \.nest-grid/);
  assert.doesNotMatch(apple.split('body.mesha-dark .store-live')[1] || '', /url\(/);
});

test('overlay is a no-op until TEST studios exist', () => {
  clearTestStudios();
  const cat = { start: '2026-09-18', end: '2026-10-18', offers: [{ studioId: 'std-35005', name: 'Dummy' }] };
  assert.equal(overlayTestOffers(cat, listActiveTestStudios()).offers[0].studioId, 'std-35005');
  saveTestStudios([{ ...validRow(), test: true, active: true, studioId: 'std-test-alpha' }]);
  const over = overlayTestOffers(cat, listActiveTestStudios());
  assert.equal(over.offers.length, 1);
  assert.equal(over.offers[0].studioId, 'std-test-alpha');
});
