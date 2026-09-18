import { PENDING_PACK, COLLECT_HINT, packIsConfirmed, canReserveProduct } from './shop-offer.mjs';
import { sendPlanContract } from './shop-waves.mjs';

export { PENDING_PACK, COLLECT_HINT, packIsConfirmed, canReserveProduct };

const LIVE = {
  loading: 'Checking places…',
  empty: 'No places available for these dates.',
  network: 'We couldn’t load places. Please try again.',
  signedOut: 'Places to stay will appear here.',
  expired: 'Please sign in again to continue.',
  personal: 'Sign in to view your accommodation details.',
  unavailable: 'No Nests yet',
  brand: 'Live',
  descriptor: 'A place to stay'
};

const EARN = {
  loading: 'Checking jobs…',
  empty: 'No jobs open right now',
  network: 'We couldn’t load jobs. Please try again.',
  signedOut: 'Open jobs are being connected',
  expired: 'Please sign in again to continue.',
  connecting: 'Your Nia team is connecting the latest Walk2Work openings.',
  unavailable: 'Open jobs are being connected',
  brand: 'Earn',
  descriptor: 'Jobs nearby'
};

const SHOP = {
  signedOut: 'Please sign in again. Your bag is still here.',
  expired: 'Please sign in again. Your bag is still here.',
  packBlocked: 'Ask Nia about this pack.',
  collect: 'Pick up your bag here.',
  payPickup: 'Pay when you collect.',
  brand: 'Save',
  descriptor: 'Everyday essentials'
};

const MONEY = {
  nav: 'Send',
  brand: 'Send',
  descriptor: 'Money home',
  transferStatus: 'Transfers not active',
  planning: 'Money does not move.',
  savePlan: 'Save plan'
};

export function recoveryCopy(domain, state) {
  const table = domain === 'live' || domain === 'stay'
    ? LIVE
    : domain === 'earn' || domain === 'jobs'
      ? EARN
      : domain === 'shop' || domain === 'save'
        ? SHOP
        : MONEY;
  return table[state] || '';
}

export function lessNavCopy() {
  return {
    live: { brand: LIVE.brand, descriptor: LIVE.descriptor, hash: 'live' },
    earn: { brand: EARN.brand, descriptor: EARN.descriptor, hash: 'earn' },
    shop: { brand: SHOP.brand, descriptor: SHOP.descriptor, hash: 'shop' },
    send: { brand: MONEY.brand, descriptor: MONEY.descriptor, hash: 'send' }
  };
}

export function moneyJourneyCopy() {
  const plan = sendPlanContract();
  return {
    nav: MONEY.nav,
    brand: MONEY.brand,
    descriptor: MONEY.descriptor,
    transferStatus: MONEY.transferStatus,
    planningOnly: plan.planningOnly === true,
    transfersEnabled: false,
    paymentsEnabled: false,
    planning: plan.copy || MONEY.planning,
    savePlan: MONEY.savePlan
  };
}

export function fulfillmentCopy(product = {}, location = {}) {
  const modes = Array.isArray(location.modes) ? location.modes : [];
  const liveDelivery = location.preview !== true && modes.includes('delivery');
  const point = product.collectHint?.name || location.name || COLLECT_HINT.name;
  if (liveDelivery) {
    return {
      method: 'delivery',
      label: 'Delivery is available at this listed location.',
      point
    };
  }
  return {
    method: 'collect',
    label: `Collect at ${point}`,
    point
  };
}

export function bagHasUnconfirmedPack(products = [], cart = {}) {
  return Object.keys(cart).some(id => {
    const product = products.find(item => item && item.id === id);
    return cart[id] > 0 && !canReserveProduct(product || { id });
  });
}

export function offerReservable(product) {
  return canReserveProduct(product);
}
