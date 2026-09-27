// Synthetic Central replies. Invented names and amounts only.
export const frozenAt = '2026-09-15T04:00:00.000Z';
export const staleAt = '2020-01-01T00:00:00.000Z';

const rice = {
  id: 'ex-rice-1',
  name: 'Example rice pack',
  shopCategoryId: 'rice',
  price: 37,
  available: 4,
  pack: '1 kg pouch',
  unitPricePaise: 3700,
  unit: 'kg',
  lowestUnitPriceInCategory: true,
  test: false,
  preview: false
};

const nest = {
  studioId: 'ex-nest-1',
  name: 'Example Nest North',
  available: true,
  rent: 4100,
  address: 'Example Lane',
  test: false,
  preview: false
};

export const member = {id: 'mem-example-1', role: 'member', name: 'Example Member', kind: 'member'};

export function catalogueFor(mode) {
  const withGoods = mode === 'ready' || mode === 'stale' || mode === 'signed-in';
  return {
    products: withGoods ? [rice] : [],
    locations: [],
    account: mode === 'signed-in' ? member : null,
    asOf: mode === 'stale' ? staleAt : frozenAt,
    capabilities: withGoods ? {saveReservations: true, saveShoppingOpen: true} : {saveReservations: false}
  };
}

export function nestsFor(mode) {
  const withGoods = mode === 'ready' || mode === 'stale' || mode === 'signed-in';
  return {
    offers: withGoods ? [nest] : [],
    start: '2026-09-15',
    minDate: '2026-09-15',
    maxDate: '2026-10-14'
  };
}

export const earnReady = {
  jobs: [{
    id: 'job-ex-1',
    title: 'Example packing job',
    employer: 'Example Mill',
    city: 'Example Town',
    mandateStatus: 'open',
    openPositions: 2,
    revision: 1,
    closesAt: '2026-12-01T00:00:00.000Z',
    payMin: 300,
    payMax: 400,
    payPeriod: 'day',
    shift: 'Day shift',
    requirements: 'None for this example',
    terms: '',
    preview: false,
    test: false,
    workplace: {verified: true, lat: 21.18, lng: 72.84}
  }],
  map: {
    status: 'ready',
    asOf: frozenAt,
    studio: {id: 'ex-nest-1', name: 'Example Nest North', verified: true, lat: 21.17, lng: 72.83}
  }
};

export const booksReady = {
  months: [{
    month: '2026-09',
    complete: true,
    totals: {earned: 1800000, spent: 400000, home: 250000, left: 1150000, refunds: 0},
    entries: [{
      reference: 'EX-ENTRY-1',
      date: '2026-09-02',
      kind: 'earning',
      label: 'Example wages',
      amountPaise: 1800000,
      origin: 'personal',
      status: 'settled',
      source: 'example',
      editable: false
    }]
  }],
  score: {status: 'hidden', reason: 'not_ready'},
  consent: false,
  status: 'ready',
  asOf: frozenAt,
  preview: false
};

export const planReady = {
  month: '2026-09',
  revision: 1,
  updatedAt: '2026-09-01T00:00:00.000Z',
  capabilities: {canSave: true, reason: null},
  fields: {
    incomePaise: 1800000,
    essentialsPaise: 400000,
    debtPaise: 0,
    bufferPaise: 0,
    otherPaise: 0,
    homePaise: 250000
  }
};

export function bodyFor(mode, pathname) {
  const bare = pathname.replace(/^\/api\/commerce/, '').replace(/^\/v1\/staff/, '');
  if (bare === '/catalogue') return catalogueFor(mode);
  if (bare === '/nests' || bare === '/nests/availability') return nestsFor(mode);
  if (bare === '/nests/bookings') return {bookings: []};
  if (bare === '/earn/applications') return {applications: []};
  if (bare === '/earn') return mode === 'signed-in' ? earnReady : {jobs: [], map: {status: 'unavailable'}};
  if (bare === '/membership') return {status: 'active', state: 'active'};
  if (bare === '/books') return mode === 'signed-in' ? booksReady : {months: []};
  if (bare.startsWith('/books/plan')) return planReady;
  if (bare === '/orders') return {orders: []};
  if (bare === '/support') return {issues: []};
  return {};
}

export function requestRecord(request) {
  const url = new URL(request.url());
  let fields = [];
  const raw = request.postData();
  if (raw) {
    try {
      const body = JSON.parse(raw);
      if (body && typeof body === 'object' && !Array.isArray(body)) fields = Object.keys(body);
    } catch {
      fields = [];
    }
  }
  return {method: request.method(), path: url.pathname + url.search, fields};
}

export function sortRequests(list) {
  return [...list].sort((a, b) => {
    const left = [a.method, a.path, ...a.fields].join('\0');
    const right = [b.method, b.path, ...b.fields].join('\0');
    return left < right ? -1 : left > right ? 1 : 0;
  });
}
