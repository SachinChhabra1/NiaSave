/* Browser sibling for commerce.js. Do not import lib/. Payments stay off. */
export const PENDING_PACK = 'Pack size to be confirmed';

export const LESS_NAV = Object.freeze({
  live: { brand: 'Live', meaningEn: 'Places to stay', meaningHi: 'रहने की जगह', hash: 'live' },
  earn: { brand: 'Earn', meaningEn: 'Jobs nearby', meaningHi: 'नौकरी', hash: 'earn' },
  shop: { brand: 'Save', meaningEn: 'Everyday essentials', meaningHi: 'रोज़ का सामान', hash: 'shop' },
  send: { brand: 'Send', meaningEn: 'Money plan', meaningHi: 'पैसे की योजना', hash: 'send' }
});

export function packReady(product = {}) {
  const pack = typeof product.pack === 'string' ? product.pack.trim() : '';
  return Boolean(pack) && pack !== PENDING_PACK && !/to be confirmed/i.test(pack);
}

export function reserveReady(product = {}) {
  const price = Number(product.price ?? product.nia);
  const available = Number(product.available);
  if (!product?.id || !packReady(product)) return false;
  if (!Number.isFinite(price) || price <= 0) return false;
  if (Number.isFinite(available) && available <= 0) return false;
  return true;
}

export function bagHasUnconfirmedPack(products = [], cart = {}) {
  return (products || []).some(product => cart[product.id] && !packReady(product));
}

export function stayErrorKind(error) {
  const message = String(error || '');
  if (!message) return 'empty';
  if (/sign_in_required|please sign in again|bag is still/i.test(message)) return 'expired';
  if (/network|offline|failed to fetch|unavailable|timeout/i.test(message)) return 'network';
  return 'failed';
}

export function sendSafetyCopy() {
  return {
    brand: 'Send',
    transferStatus: 'Transfers not active',
    planning: 'This is a money statement and a plan to send home. Saving a plan does not move money.',
    transfersEnabled: false
  };
}
