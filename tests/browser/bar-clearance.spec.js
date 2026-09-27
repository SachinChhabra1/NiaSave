import {test, expect} from '@playwright/test';

async function prepare(page, lang) {
  await page.addInitScript(language => {
    localStorage.setItem('nia-language', JSON.stringify(language));
  }, lang);
  await page.route('**/api/**', route => route.fulfill({status: 503, contentType: 'application/json', body: '{"error":"central_unreachable"}'}));
  await page.route('**/v1/**', route => route.fulfill({status: 503, contentType: 'application/json', body: '{}'}));
}

async function overlaps(page) {
  return page.evaluate(() => {
    const bar = document.querySelector('#less-nav');
    const scroller = document.querySelector('#content');
    if (!bar || !scroller) return 'missing bar or content';
    const hitAt = () => {
      const barBox = bar.getBoundingClientRect();
      const nodes = [...document.querySelectorAll('button, a')];
      for (const el of nodes) {
        if (el.closest('#less-nav')) continue;
        const dialog = el.closest('dialog');
        if (dialog && !dialog.open) continue;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        const port = el.closest('#content') ? scroller.getBoundingClientRect() : {top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight};
        const top = Math.max(rect.top, port.top, 0);
        const bottom = Math.min(rect.bottom, port.bottom, window.innerHeight);
        const left = Math.max(rect.left, port.left, 0);
        const right = Math.min(rect.right, port.right, window.innerWidth);
        if (bottom - top < 1 || right - left < 1) continue;
        const overlapsBar = bottom > barBox.top + 1 && top < barBox.bottom - 1 && right > barBox.left + 1 && left < barBox.right - 1;
        if (overlapsBar) return (el.innerText || el.getAttribute('aria-label') || el.id || 'control').replace(/\s+/g, ' ').trim().slice(0, 80);
      }
      return '';
    };
    const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      scroller.scrollTop = max <= 0 ? 0 : Math.round((max * i) / steps);
      const hit = hitAt();
      if (hit) return `scroll ${scroller.scrollTop}: ${hit}`;
    }
    return '';
  });
}

for (const width of [360, 390]) {
  for (const lang of ['en', 'hi']) {
    test(`no control sits under the bar at ${width}px in ${lang}`, async ({page}) => {
      test.setTimeout(90000);
      await page.setViewportSize({width, height: 780});
      await prepare(page, lang);
      await page.goto('/#home');
      await expect(page.locator('#call-nia')).toBeVisible();
      await expect(page.locator('#call-nia')).toContainText(lang === 'hi' ? 'निया को फ़ोन करें' : 'Call Nia');
      const box = await page.locator('#call-nia').boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      for (const name of ['home', 'live', 'earn', 'shop', 'send']) {
        if (name !== 'home') {
          await page.locator(`#less-nav button[data-action="${name}"]`).click();
          await expect(page.locator('#less-nav button[aria-current="page"]')).toHaveAttribute('data-action', name);
        }
        await expect(page.locator('#call-nia')).toBeVisible();
        expect(await overlaps(page), name).toBe('');
      }
    });
  }
}

test('an empty help number opens Help and the pause line stays short', async ({page}) => {
  await page.setViewportSize({width: 390, height: 780});
  await prepare(page, 'en');
  await page.goto('/#home');
  await expect(page.locator('.pause-note-line')).toHaveText('Booking starts soon. Call Nia for help.');
  await expect(page.locator('.home-dashboard')).not.toContainText('Getting your details');
  await expect(page.locator('.home-attention-card')).toHaveCount(0);
  await expect(page.locator('#call-nia')).toHaveAttribute('data-action', 'help');
  await page.locator('#call-nia').click();
  await expect(page.locator('#dialog')).toBeVisible();
  await page.locator('#dialog [data-action="close"]').click();
  await page.locator('#content .pause-note-more summary').click();
  await expect(page.locator('#content .pause-note-full')).toContainText('Browsing is open');
});
