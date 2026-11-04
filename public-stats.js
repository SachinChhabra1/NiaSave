const MAX_AGE = 300000;
export async function loadPublicStats(root, fetchImpl = fetch) {
  const cards = [...root.querySelectorAll('[data-public-stat]')];
  const source = root.querySelector('.traction-source');
  const hide = () => { cards.forEach(card => { card.hidden = true; card.querySelector('strong').textContent = ''; }); source.hidden = true; source.textContent = ''; };
  hide();
  try {
    const response = await fetchImpl('/api/public-stats', { cache: 'no-store', signal: AbortSignal.timeout(4500) });
    if (!response.ok) return;
    const stats = await response.json(), at = Date.parse(stats.asOf), age = Date.now() - at;
    if (!Number.isFinite(at) || age < 0 || age >= MAX_AGE) return;
    for (const card of cards) {
      const value = stats[card.dataset.publicStat];
      if (!Number.isSafeInteger(value) || value < 0) continue;
      card.querySelector('strong').textContent = value.toLocaleString('en-IN');
      card.hidden = false;
    }
    if (cards.some(card => !card.hidden)) {
      source.textContent = `Live from Nia Central · as of ${new Date(at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZoneName: undefined })}`;
      source.hidden = false;
      // An open tab must not keep displaying an expired reading.
      const timer = setTimeout(hide, MAX_AGE - age);
      timer.unref?.();
    }
  } catch { hide(); }
}
