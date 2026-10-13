// The public entry owns only routing and marketing interactions. Member modules,
// fragments (including setup secrets), storage and API contracts remain unchanged.
const publicFragments = new Set(['', 'platform', 'enterprises', 'investors', 'public-main']);
export const isPublicEntry = hash => publicFragments.has(hash.replace(/^#/, ''));

async function memberEntry() {
  const response = await fetch('/commerce.html', { cache: 'no-store' });
  if (!response.ok) throw new Error('Member entry could not be loaded.');
  const member = new DOMParser().parseFromString(await response.text(), 'text/html');
  const scripts = [...member.querySelectorAll('script[src]')].map(script => ({ src: script.getAttribute('src'), type: script.type }));
  member.querySelectorAll('script').forEach(script => script.remove());
  document.title = member.title;
  // Replace only entry-owned metadata. The existing member document supplies its
  // styles, shell and scripts; no duplicated member markup can drift over time.
  document.head.querySelectorAll('meta[name="description"], meta[name="theme-color"], link[rel="stylesheet"]').forEach(node => node.remove());
  const styles = [];
  for (const node of member.head.querySelectorAll('meta[name="description"], meta[name="theme-color"], link[rel="stylesheet"]')) {
    const copy = document.importNode(node, true);
    // Existing CSP can reject an imported remote font while the local sheet is
    // usable. Preserve the original member page's fallback-font behavior.
    if (copy.tagName === 'LINK') styles.push(new Promise(resolve => { copy.onload = resolve; copy.onerror = resolve; }));
    document.head.append(copy);
  }
  await Promise.all(styles);
  document.body.replaceWith(document.importNode(member.body, true));
  const returnToPublic = event => {
    if (isPublicEntry(location.hash)) { event.stopImmediatePropagation(); location.reload(); }
  };
  window.addEventListener('hashchange', returnToPublic);
  window.addEventListener('popstate', returnToPublic);
  for (const entry of scripts) {
    const script = document.createElement('script');
    script.type = entry.type;
    script.src = entry.src;
    document.head.append(script);
  }
}

function publicEntry() {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet'; stylesheet.href = '/public-home.css'; document.head.append(stylesheet);
  const template = document.querySelector('#public-home');
  const content = template.content.cloneNode(true);
  document.body.replaceChildren(content);
  const toggle = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#public-navigation');
  const closeMenu = () => { toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Open navigation'); navigation.classList.remove('is-open'); };
  toggle.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); navigation.classList.toggle('is-open', open); });
  navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  window.addEventListener('hashchange', () => { if (!isPublicEntry(location.hash)) location.reload(); });
  if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
}

if (isPublicEntry(location.hash)) publicEntry();
else memberEntry().catch(() => {
  document.body.replaceChildren();
  const message = document.createElement('p'); message.textContent = 'Member services could not be loaded. Please try again.';
  const link = document.createElement('a'); link.href = '/commerce.html' + location.search + location.hash; link.textContent = 'Open member services';
  document.body.append(message, link);
});
