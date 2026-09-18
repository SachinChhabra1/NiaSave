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
  unavailable: 'No Nests yet'
};

const EARN = {
  loading: 'Checking jobs…',
  empty: 'No jobs open right now',
  network: 'We couldn’t load jobs. Please try again.',
  signedOut: 'Open jobs are being connected',
  expired: 'Please sign in again to continue.',
  connecting: 'Your Nia team is connecting the latest Walk2Work openings.',
  unavailable: 'Open jobs are being connected'
};

const SHOP = {
  signedOut: 'Please sign in again. Your bag is still here.',
  expired: 'Please sign in again. Your bag is still here.',
  packBlocked: 'Pack details unavailable — ask Nia',
  collect: 'Collect your order from this Nia point.',
  payPickup: 'Pay at pickup. Final availability is checked when you reserve.'
};

const MONEY = {
  nav: 'My money',
  transferStatus: 'Not active yet',
  planning: 'An estimate, not a transfer. Money does not move.',
  savePlan: 'Save plan'
};

export function recoveryCopy(domain, state) {
  const table = domain === 'live' || domain === 'stay'
    ? LIVE
    : domain === 'earn' || domain === 'jobs'
      ? EARN
      : domain === 'shop'
        ? SHOP
        : MONEY;
  return table[state] || '';
}

export function moneyJourneyCopy() {
  const plan = sendPlanContract();
  return {
    nav: MONEY.nav,
    transferStatus: MONEY.transferStatus,
    planningOnly: plan.planningOnly === true,
    transfersEnabled: plan.transfersEnabled === false ? false : Boolean(plan.transfersEnabled),
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
    label: `Collect from ${point}`,
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
