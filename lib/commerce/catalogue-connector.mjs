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

function cell(row, key) {
  const value = row?.[key];
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function money(row, key) {
  const n = Number(cell(row, key));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseCatalogueRows(upload) {
  const rows = Array.isArray(upload?.rows) ? upload.rows : [];
  const out = [];
  for (const row of rows) {
    const sku = cell(row, 'sku_id').toLowerCase().replace(/[^a-z0-9_]/g, '');
    const status = cell(row, 'status').toLowerCase();
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

/** Sheet rows override mill SKUs by id. Hold hides. Missing SKUs keep mill. */
export function overlayCatalogueProducts(base = [], upload, opts = {}) {
  const parsed = parseCatalogueRows(upload);
  if (!parsed.length) return Array.isArray(base) ? base : [];
  const visible = visibleCatalogueProducts(parsed, opts);
  const byId = new Map((base || []).map(product => [product.id, product]));
  const held = new Set(parsed.filter(p => p.status === 'hold').map(p => p.id));
  for (const id of held) byId.delete(id);
  for (const product of visible) byId.set(product.id, { ...(byId.get(product.id) || {}), ...product });
  return [...byId.values()];
}
