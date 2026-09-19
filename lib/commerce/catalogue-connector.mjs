/**
 * Catalogue tab of NiaSave-Backend-Data-Sheets.
 * Staff CSV → POST /api/connectors/upload kind=catalogue → shop.
 * status=active → member shop. status=test → TEST lane only (labelled).
 * status=hold → hidden. No invented SKUs in code; the sheet is the source.
 * Payments stay off.
 */
import { CATALOGUE_SKU_CAP, packIsConfirmed } from './shop-offer.mjs';
import { goodsCategory } from '../../commerce-categories.js';

export const CATALOGUE_KIND = 'catalogue';
export const CATALOGUE_COLUMNS = Object.freeze([
  'sku_id',
  'item_name',
  'category',
  'pack_size',
  'unit',
  'nia_price_inr',
  'kirana_price_inr',
  'you_keep_inr',
  'source_site_code',
  'source_sku',
  'studio_site_code',
  'status'
]);

const STATUS = new Set(['active', 'test', 'hold']);
export const CATALOGUE_SHEET_ID = '1ziaBVmk85RVW5SpvLnPD9o6q2s2IR9mcrYCxRm2TzmA';
export const CATALOGUE_TAB = 'Catalogue';

function cell(row, key) {
  const value = row?.[key];
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function money(row, key) {
  const n = Number(cell(row, key));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normStatus(value) {
  const s = String(value || '').trim().toLowerCase();
  if (s === 'active') return 'active';
  if (s === 'test') return 'test';
  if (s === 'hold' || s === 'inactive') return 'hold';
  return '';
}

export function parseCatalogueRows(upload) {
  const rows = Array.isArray(upload?.rows) ? upload.rows : [];
  const out = [];
  for (const row of rows) {
    const sku = cell(row, 'sku_id').toLowerCase().replace(/[^a-z0-9_]/g, '');
    const status = normStatus(cell(row, 'status'));
    const name = cell(row, 'item_name');
    const packSize = cell(row, 'pack_size');
    const unit = cell(row, 'unit');
    const price = money(row, 'nia_price_inr');
    if (!sku || !name || !STATUS.has(status) || !price) continue;
    const pack = [packSize, unit].filter(Boolean).join(' ').trim();
    out.push({
      id: sku,
      name,
      hindi: name,
      category: goodsCategory(cell(row, 'category')) || cell(row, 'category') || 'ration',
      pack: pack || 'Pack size to be confirmed',
      price,
      pricePaise: Math.round(price * 100),
      kirana: money(row, 'kirana_price_inr'),
      keep: money(row, 'you_keep_inr'),
      sourceSiteCode: cell(row, 'source_site_code') || null,
      sourceSku: cell(row, 'source_sku') || sku,
      locationIds: cell(row, 'studio_site_code') ? [cell(row, 'studio_site_code')] : ['S01'],
      status,
      test: status === 'test',
      connector: CATALOGUE_KIND
    });
    if (out.length >= CATALOGUE_SKU_CAP) break;
  }
  return out;
}

export function visibleCatalogueProducts(parsed, { testLane = false, testViewer = false } = {}) {
  return parsed.filter(product => {
    if (product.status === 'hold') return false;
    if (product.status === 'test') return testLane === true || testViewer === true;
    return product.status === 'active';
  }).map(product => {
    const next = { ...product };
    delete next.status;
    if (next.test && packIsConfirmed(next) && !String(next.name).includes('(TEST)')) {
      next.name = `${next.name} (TEST)`;
    }
    return next;
  });
}

/** Sheet rows override mill SKUs by id. Hold hides. Missing SKUs keep mill.
 * Production honesty: only frozen SKU ids, and nia_price must match SKUS.nia.
 * Branded / new sheet SKUs are dropped, not invented onto the shop.
 */
export function overlayCatalogueProducts(base = [], upload, opts = {}) {
  let parsed = parseCatalogueRows(upload);
  const skus = Array.isArray(opts.skus) ? opts.skus : [];
  if (skus.length) {
    const frozen = new Map(skus.map(s => [s.id, s]));
    parsed = parsed.filter(product => {
      const sku = frozen.get(product.id);
      return sku && product.price === sku.nia;
    });
  }
  if (!parsed.length) return Array.isArray(base) ? base : [];
  const visible = visibleCatalogueProducts(parsed, opts);
  const byId = new Map((base || []).map(product => [product.id, product]));
  const held = new Set(parsed.filter(p => p.status === 'hold').map(p => p.id));
  for (const id of held) byId.delete(id);
  for (const product of visible) byId.set(product.id, { ...(byId.get(product.id) || {}), ...product });
  return [...byId.values()];
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

async function googleSheetToken(env = process.env) {
  const { createSign } = await import('node:crypto');
  const raw = env.BISON_GOOGLE_SERVICE_ACCOUNT_JSON || env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  if (!raw) throw new Error('google_service_account_missing');
  const account = JSON.parse(raw);
  const at = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly', aud: 'https://oauth2.googleapis.com/token', iat: at, exp: at + 3600 }))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(account.private_key, 'base64url')}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || 'google_token_failed');
  return payload.access_token;
}

export async function pullCatalogueSheet(env = process.env, fetchImpl = fetch) {
  const spreadsheetId = String(env.NIASAVE_CATALOGUE_SHEET_ID || CATALOGUE_SHEET_ID);
  const token = await googleSheetToken(env);
  const range = encodeURIComponent(`'${CATALOGUE_TAB}'!A1:L400`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`;
  const response = await fetchImpl(url, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(8000), redirect: 'error' });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || 'google_sheet_read_failed');
  const values = Array.isArray(payload.values) ? payload.values : [];
  const headerIndex = values.findIndex(row => (row || []).some(cell => String(cell || '').trim().toLowerCase() === 'sku_id'));
  const table = headerIndex >= 0 ? values.slice(headerIndex) : values;
  const headers = (table[0] || []).map(h => String(h || '').trim());
  const rows = table.slice(1).map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] == null ? '' : row[i]]))).filter(r => String(r.sku_id || '').trim());
  return {
    kind: CATALOGUE_KIND,
    filename: 'Catalogue!GoogleSheet',
    spreadsheetId,
    tab: CATALOGUE_TAB,
    headers,
    rows,
    rowCount: rows.length,
    at: new Date().toISOString()
  };
}
