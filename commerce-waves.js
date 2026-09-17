/* Waves 1-3 Save surfaces. Payments stay off. No invented SKUs. */
const COLLECT = Object.freeze({
  stopId: 'S01',
  name: 'Nia Nest Ompal',
  lat: 21.2266,
  lng: 72.83613,
  area: 'Ved Road'
});
const SEND_KEY = 'nia-send-plan';
const PENDING_PACK = 'Pack size to be confirmed';

function page() {
  return location.hash.slice(1) || 'home';
}

function loadPlan() {
  try {
    return JSON.parse(localStorage.getItem(SEND_KEY)) || {};
  } catch {
    return {};
  }
}

function savePlan(value) {
  try {
    localStorage.setItem(SEND_KEY, JSON.stringify(value));
  } catch {}
}

function packLine(product) {
  const pack = product?.pack || PENDING_PACK;
  const hint = product?.collectHint?.name || COLLECT.name;
  const source = product?.sourceSiteCode ? `Source ${product.sourceSiteCode}` : '';
  return `<span class="pack-line">${pack} · Collect at ${hint}</span>${source ? `<span class="source-line">${source}</span>` : ''}`;
}

function decorateProducts(root) {
  root.querySelectorAll('[data-id], .product, article.product').forEach(card => {
    if (card.querySelector('.pack-line')) return;
    const host = card.querySelector('.product-copy, .copy, figcaption, .meta') || card;
    const line = document.createElement('div');
    line.innerHTML = packLine({
      pack: card.getAttribute('data-pack') || PENDING_PACK,
      sourceSiteCode: card.getAttribute('data-source-site') || '',
      collectHint: { name: COLLECT.name }
    });
    host.append(...line.childNodes);
  });
}

function collectCard() {
  return `<section class="save-collect-card" data-collect-stop="S01">
    <h2>Collect at ${COLLECT.name}</h2>
    <p>Pickup window at ${COLLECT.area}. This is a collect point, not a 10-minute doorstep delivery.</p>
    <div id="save-collect-map" role="region" aria-label="Collect map for Nia Nest Ompal"></div>
  </section>`;
}

function sendCard() {
  const plan = loadPlan();
  const selected = value => plan.schedule === value ? 'selected' : '';
  return `<section class="send-plan-card">
    <h2>Plan money home</h2>
    <p>An estimate, not a transfer. Money does not move.</p>
    <form id="send-plan-form">
      <label>Beneficiary name<input name="beneficiaryName" maxlength="80" value="${plan.beneficiaryName || ''}" autocomplete="name"></label>
      <label>Relation<input name="relation" maxlength="40" value="${plan.relation || ''}" placeholder="Mother, father, spouse"></label>
      <label>Amount in rupees<input name="amountInr" type="number" min="0" max="1000000" step="1" inputmode="numeric" value="${plan.amountInr || ''}"></label>
      <label>Schedule<select name="schedule">
        <option value="this-week" ${selected('this-week')}>This week</option>
        <option value="month-end" ${selected('month-end')}>Month end</option>
        <option value="after-wages" ${selected('after-wages')}>After wages</option>
      </select></label>
      <button type="submit">Save this plan</button>
    </form>
    <p class="send-plan-status" id="send-plan-status">Nothing is sent from this screen.</p>
  </section>`;
}

let leafletPromise;
function leaflet() {
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      if (window.L) return resolve(window.L);
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = '/assets/leaflet/leaflet.css';
      const script = document.createElement('script');
      script.src = '/assets/leaflet/leaflet.js';
      const failed = () => {
        script.remove();
        css.remove();
        leafletPromise = null;
        reject(Error('map_unavailable'));
      };
      let ready = 0;
      const done = () => {
        ready += 1;
        if (ready === 2) resolve(window.L);
      };
      css.onload = done;
      script.onload = done;
      css.onerror = failed;
      script.onerror = failed;
      document.head.append(css, script);
    });
  }
  return leafletPromise;
}

let map;
function mountCollectMap() {
  const container = document.querySelector('#save-collect-map');
  if (!container || map) return;
  leaflet().then(L => {
    if (!container.isConnected) return;
    map = L.map(container, { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    L.marker([COLLECT.lat, COLLECT.lng]).addTo(map).bindPopup(`${COLLECT.name} · ${COLLECT.area}`);
    map.setView([COLLECT.lat, COLLECT.lng], 16);
  }).catch(() => {
    container.textContent = 'Map unavailable. Collect at Nia Nest Ompal, Ved Road.';
  });
}

function bindSendForm() {
  const form = document.querySelector('#send-plan-form');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = '1';
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    savePlan(data);
    const status = document.querySelector('#send-plan-status');
    if (status) status.textContent = 'Plan saved on this phone. Money does not move.';
  });
}

function paint() {
  const current = page();
  const main = document.querySelector('#content');
  if (!main) return;
  if (current === 'shop' || current === 'save') {
    decorateProducts(document);
    if (!document.querySelector('.save-collect-card')) main.insertAdjacentHTML('beforeend', collectCard());
    mountCollectMap();
  }
  if (current === 'send') {
    if (!document.querySelector('.send-plan-card')) main.insertAdjacentHTML('beforeend', sendCard());
    bindSendForm();
  }
}

const root = document.querySelector('#content');
if (root) new MutationObserver(() => paint()).observe(root, { childList: true, subtree: true });
window.addEventListener('hashchange', () => {
  map = null;
  paint();
});
document.addEventListener('DOMContentLoaded', paint);
paint();
