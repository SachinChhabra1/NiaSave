export const CATALOGUE_SKU_CAP = 200;
export const PENDING_PACK = 'Pack size to be confirmed';

/** Existing S01 from rabbit/scale.mjs. Display hint only — not a live reserve window. */
export const COLLECT_HINT = {
  id: 'S01',
  name: 'Nia Nest Ompal',
  hub: 'Sukh Store · Theatre North',
  theatre: 'rajputana'
};

export function shopVisibleProduct(product) {
  if (!product || !product.id) return false;
  const available = Number(product.available);
  if (Number.isFinite(available) && available <= 0) return false;
  return true;
}

export function enforceCatalogueCap(products) {
  if (!Array.isArray(products) || products.length < 1) {
    const error = new Error('invalid_products');
    error.code = 'invalid_products';
    throw error;
  }
  if (products.length > CATALOGUE_SKU_CAP) {
    const error = new Error('catalogue_cap_200');
    error.code = 'catalogue_cap_200';
    throw error;
  }
  return true;
}

export function browseOfferFields(product = {}) {
  const pack = typeof product.pack === 'string' && product.pack.trim() ? product.pack.trim() : PENDING_PACK;
  const photo = typeof product.photo === 'string' && product.photo.trim() ? product.photo.trim() : null;
  const sourceSku = typeof product.sourceSku === 'string' && product.sourceSku.trim() ? product.sourceSku.trim() : null;
  const sourceSiteCode = typeof product.sourceSiteCode === 'string' && product.sourceSiteCode.trim() ? product.sourceSiteCode.trim() : null;
  const locationIds = Array.isArray(product.locationIds)
    ? [...new Set(product.locationIds.filter(id => typeof id === 'string' && id.trim()))]
    : [];
  return { pack, photo, sourceSku, sourceSiteCode, locationIds, collectHint: COLLECT_HINT };
}
