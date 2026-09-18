import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { STUDIO_NAMES } from '../../rabbit/scale.mjs';
import { PHOTO_SPEC, normalizeStudioPhoto } from './studio-photo.mjs';
import { saveTestStudios, mediaPath, mediaUrl } from './studio-bulk-store.mjs';

export const STUDIO_SHEET_COLUMNS = Object.freeze([
  'site_code', 'name', 'theatre', 'city', 'address', 'picture', 'active'
]);

export const STUDIO_BULK_CAP = 100;
export const TEST_SITE = /^TEST-[A-Z0-9][A-Z0-9_-]{1,32}$/;
const POLO_STOP = /^S(0[1-9]|[1-3][0-9]|40)$/i;
const REAL_NEST = new Set(STUDIO_NAMES.map(name => name.toLowerCase()));
const PICTURE_NAME = /^[A-Za-z0-9._-]{1,80}\.(jpe?g|png|webp)$/i;

export function isTestStudioId(id) {
  return /^std-test-/.test(String(id || '').toLowerCase());
}

export function parseCsv(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quote = false;
  const pushCell = () => { row.push(cell); cell = ''; };
  const pushRow = () => {
    if (row.some(value => String(value).trim())) rows.push(row);
    row = [];
  };
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    const n = raw[i + 1];
    if (c === '"' && quote && n === '"') { cell += '"'; i += 1; }
    else if (c === '"') quote = !quote;
    else if (c === ',' && !quote) pushCell();
    else if ((c === '\n' || c === '\r') && !quote) {
      if (c === '\r' && n === '\n') i += 1;
      pushCell();
      pushRow();
    } else cell += c;
  }
  pushCell();
  pushRow();
  if (rows.length < 2) return { columns: [], rows: [] };
  const columns = rows[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, '_').replace(/\*/g, ''));
  const data = rows.slice(1).map(values => {
    const out = {};
    columns.forEach((key, i) => { out[key] = String(values[i] ?? '').trim(); });
    return out;
  });
  return { columns, rows: data };
}

export function csvTemplate() {
  return STUDIO_SHEET_COLUMNS.join(',') + '\r\n';
}

export function columnsMatch(columns) {
  return STUDIO_SHEET_COLUMNS.every(c => (columns || []).includes(c));
}

function truthy(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'active'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'inactive', ''].includes(v)) return false;
  return null;
}

function pictureKey(name) {
  return String(name || '').split(/[/\\]/).pop().toLowerCase();
}

export function validateStudioRow(row, pictures, index = 0) {
  const site_code = String(row.site_code || '').trim().toUpperCase();
  const name = String(row.name || '').trim();
  const theatre = String(row.theatre || '').trim();
  const city = String(row.city || '').trim();
  const address = String(row.address || '').trim();
  const picture = String(row.picture || '').trim();
  const active = truthy(row.active);
  const problems = [];
  if (!TEST_SITE.test(site_code)) problems.push('test_site_code_required');
  if (POLO_STOP.test(site_code) || /^S\d+$/i.test(site_code)) problems.push('polo_stop_forbidden');
  if (!name || name.length > 80) problems.push('invalid_name');
  if (!/^Test\b/i.test(name)) problems.push('test_name_required');
  const nestHint = name.replace(/^test\s+(studio\s+)?/i, '').trim().toLowerCase();
  if (REAL_NEST.has(nestHint) || /nia nest/i.test(name)) problems.push('real_studio_name_forbidden');
  if (!theatre || theatre.length > 80) problems.push('invalid_theatre');
  if (!/^Test\b/i.test(theatre)) problems.push('test_theatre_required');
  if (!city || city.length > 80) problems.push('invalid_city');
  if (!address || address.length > 200) problems.push('invalid_address');
  if (!/illustrative|test/i.test(address) || !/not a real/i.test(address)) {
    problems.push('test_address_required');
  }
  if (!picture) problems.push('picture_required');
  if (picture && !PICTURE_NAME.test(picture.split(/[/\\]/).pop())) problems.push('picture_name_invalid');
  if (picture && pictures && !pictures[picture] && !pictures[pictureKey(picture)]) problems.push('picture_file_missing');
  if (active === null) problems.push('invalid_active');
  if (problems.length) return { ok: false, row: index + 2, errors: problems, site_code };
  return {
    ok: true,
    row: index + 2,
    record: {
      site_code,
      name,
      theatre,
      city,
      address,
      picture: picture.split(/[/\\]/).pop(),
      active,
      test: true,
      owner: 'central',
      studioId: 'std-' + site_code.toLowerCase(),
      centralSource: {
        system: 'rafiqi-central',
        siteCode: site_code,
        preview: true,
        pulledAt: null
      }
    }
  };
}

export function validateBulk(rows, pictures = {}) {
  if (!Array.isArray(rows) || !rows.length) return { ok: false, error: 'rows_required', valid: 0, errors: [{ row: 1, errors: ['rows_required'] }] };
  if (rows.length > STUDIO_BULK_CAP) return { ok: false, error: 'studio_cap_100', valid: 0, errors: [{ row: 1, errors: ['studio_cap_100'] }] };
  const seen = new Set();
  const errors = [];
  const records = [];
  rows.forEach((row, index) => {
    const result = validateStudioRow(row, pictures, index);
    if (!result.ok) {
      errors.push(result);
      return;
    }
    if (seen.has(result.record.site_code)) {
      errors.push({ ok: false, row: result.row, errors: ['duplicate_site_code'], site_code: result.record.site_code });
      return;
    }
    seen.add(result.record.site_code);
    records.push(result.record);
  });
  if (errors.length) return { ok: false, error: 'validation_failed', valid: records.length, errors, records };
  return { ok: true, valid: records.length, records };
}

export function publicTestOffer(record, start, end) {
  return {
    studioId: record.studioId,
    name: record.name,
    address: record.city + ' · ' + record.address,
    photo: record.media || null,
    test: true,
    start,
    end,
    periodDays: 30,
    rent: 2200,
    deposit: 0,
    taxPct: 12,
    tax: 264,
    total: 2464,
    available: record.active ? 1 : 0,
    holdHours: 24,
    terms: 'Illustrative test studio. Not a real Nest. No online payment.',
    details: 'Normalized still for layout only. Central will own production media.',
    theatre: record.theatre,
    city: record.city,
    site_code: record.site_code
  };
}

export function overlayTestOffers(catalogue, records) {
  const active = (records || []).filter(row => row.test === true && row.active !== false);
  if (!active.length) return catalogue;
  return {
    ...catalogue,
    offers: active.map(row => publicTestOffer(row, catalogue.start, catalogue.end)),
    testStudios: true,
    owner: 'central'
  };
}

export function mediaRecord(record, photo, url, pulledAt) {
  return {
    ...record,
    centralSource: { ...record.centralSource, pulledAt },
    media: {
      assetId: record.studioId + '-hero',
      url,
      width: PHOTO_SPEC.width,
      height: PHOTO_SPEC.height,
      aspect: PHOTO_SPEC.aspect,
      format: PHOTO_SPEC.format,
      quality: PHOTO_SPEC.quality,
      crop: PHOTO_SPEC.crop,
      mime: PHOTO_SPEC.mime,
      illustrative: true,
      approved: false,
      sourceWidth: photo.sourceWidth,
      sourceHeight: photo.sourceHeight
    }
  };
}

export function publicStudioRow(record) {
  return {
    site_code: record.site_code,
    name: record.name,
    theatre: record.theatre,
    city: record.city,
    address: record.address,
    active: record.active,
    test: true,
    owner: record.owner,
    studioId: record.studioId,
    centralSource: record.centralSource,
    media: record.media
  };
}

export function ingestStudioBulk({ csvText, pictures = {}, time = new Date().toISOString() }) {
  const parsed = parseCsv(csvText);
  if (!columnsMatch(parsed.columns) || !parsed.rows.length) {
    return { ok: false, error: parsed.rows.length ? 'columns_required' : 'rows_required', valid: 0, errors: [{ row: 1, errors: [parsed.rows.length ? 'columns_required' : 'rows_required'] }] };
  }
  const indexed = {};
  for (const [name, bytes] of Object.entries(pictures || {})) indexed[pictureKey(name)] = bytes;
  const validated = validateBulk(parsed.rows, indexed);
  if (!validated.ok) return validated;
  const dir = mkdtempSync(join(tmpdir(), 'nia-studio-'));
  try {
    const rows = [];
    for (const record of validated.records) {
      const bytes = indexed[pictureKey(record.picture)];
      if (!bytes || !bytes.length) {
        return { ok: false, error: 'validation_failed', valid: rows.length, errors: [{ row: record.row || 2, errors: ['picture_file_missing'], site_code: record.site_code }] };
      }
      const src = join(dir, record.picture);
      writeFileSync(src, bytes);
      const dest = mediaPath(record.site_code);
      const photo = normalizeStudioPhoto(src, dest);
      rows.push(mediaRecord(record, photo, mediaUrl(record.site_code) + '?v=' + Date.parse(time), time));
    }
    saveTestStudios(rows, time);
    return { ok: true, spec: PHOTO_SPEC, count: rows.length, rows: rows.map(publicStudioRow) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
