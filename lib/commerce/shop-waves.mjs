import {
  browseOfferFields,
  shopVisibleProduct,
  enforceCatalogueCap,
  COLLECT_HINT,
  CATALOGUE_SKU_CAP
} from './shop-offer.mjs';

/** Existing S01 from rabbit/shops-30.mjs. Not invented. */
export const COLLECT_MAP = Object.freeze({
  stopId: 'S01',
  name: 'Nia Nest Ompal',
  lat: 21.2266,
  lng: 72.83613,
  seq: 1,
  area: 'Ved Road',
  source: 'rabbit/shops-30.mjs'
});

export function stampSourceFromConnector(products, connectorStock = []) {
  if (!Array.isArray(products)) return [];
  if (!Array.isArray(connectorStock) || connectorStock.length < 1) return products;
  return products.map(product => {
    const row = connectorStock.find(item => item && (item.sku === product.id || item.sku === product.sourceSku));
    if (!row) return product;
    const sourceSku = typeof row.sku === 'string' && row.sku.trim() ? row.sku.trim() : product.sourceSku || null;
    const sourceSiteCode = typeof row.site_code === 'string' && row.site_code.trim() ? row.site_code.trim() : product.sourceSiteCode || null;
    const pack = typeof row.pack === 'string' && row.pack.trim() ? row.pack.trim() : product.pack;
    return { ...product, sourceSku, sourceSiteCode, pack };
  });
}

export function decorateBrowseProducts(products, connectorStock = []) {
  const stamped = stampSourceFromConnector(products, connectorStock);
  const visible = stamped
    .map(product => ({ ...product, ...browseOfferFields(product) }))
    .filter(shopVisibleProduct);
  if (visible.length) enforceCatalogueCap(visible);
  return visible;
}

export function sendPlanContract() {
  return {
    transfersEnabled: false,
    paymentsEnabled: false,
    planningOnly: true,
    fields: ['beneficiaryName', 'relation', 'amountInr', 'schedule'],
    copy: 'Money does not move.'
  };
}

export function waveCatalogueExtras() {
  return {
    paymentsEnabled: false,
    collectHint: COLLECT_HINT,
    collectMap: COLLECT_MAP,
    sendPlan: sendPlanContract(),
    catalogueSkuCap: CATALOGUE_SKU_CAP,
    waves: {
      0: 'shipped',
      1: 'shop-complete',
      2: 'send-plan-and-source-stamp',
      3: 'collect-map'
    }
  };
}
