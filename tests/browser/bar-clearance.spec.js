import {test, expect} from '@playwright/test';
import {bodyFor} from '../ui-clarity/replies.mjs';

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
        const clippedOverlap = bottom > barBox.top + 1 && top < barBox.bottom - 1 && right > barBox.left + 1 && left < barBox.right - 1;
        // At the opening scroll, the scroller ends where the bar starts, so clipping
        // the control to the scroller hides a short button that sits across that edge.
        const openingCut = scroller.scrollTop === 0 && rect.height <= 88 && rect.top < barBox.top - 1 && rect.bottom > barBox.top + 1 && rect.right > barBox.left + 1 && rect.left < barBox.right - 1;
        if (clippedOverlap || openingCut) return (el.innerText || el.getAttribute('aria-label') || el.id || 'control').replace(/\s+/g, ' ').trim().slice(0, 80);
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

async function reachable(page) {
  return page.evaluate(() => {
    const failures = [];
    const nodes = [...document.querySelectorAll('button, a')];
    for (const el of nodes) {
      if (el.closest('[hidden]')) continue;
      const dialog = el.closest('dialog');
      if (dialog && !dialog.open) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      if (typeof el.checkVisibility === 'function' && !el.checkVisibility({checkOpacity: true, checkVisibilityCSS: true})) continue;
      const before = el.getBoundingClientRect();
      if (before.width < 2 || before.height < 2) continue;
      const onScreen = before.bottom > 0 && before.right > 0 && before.top < window.innerHeight && before.left < window.innerWidth;
      if (!onScreen && !el.closest('#content')) continue;
      el.scrollIntoView({block: 'center', inline: 'nearest', behavior: 'instant'});
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const name = (el.innerText || el.getAttribute('aria-label') || el.id || 'control').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) {
        failures.push(name + ' centre is outside the viewport');
        continue;
      }
      const hit = document.elementFromPoint(x, y);
      if (!hit || (hit !== el && !el.contains(hit))) {
        const hitName = hit ? (hit.innerText || hit.getAttribute('aria-label') || hit.id || hit.tagName).toString().replace(/\s+/g, ' ').trim().slice(0, 40) : 'nothing';
        failures.push(name + ' is covered by ' + hitName);
      }
    }
    return failures.join('\n');
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
      await expect.poll(async () => (await page.locator('#call-nia').boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      for (const name of ['home', 'live', 'earn', 'shop', 'send']) {
        if (name !== 'home') {
          await page.locator(`#less-nav button[data-action="${name}"]`).click();
          await expect(page.locator('#less-nav button[aria-current="page"]')).toHaveAttribute('data-action', name);
        }
        await expect(page.locator('#call-nia')).toBeVisible();
        if (name === 'earn') {
          await page.locator('#content').evaluate(node => { node.scrollTop = 0; });
          const opening = await page.evaluate(() => {
            const button = [...document.querySelectorAll('#content button')].find(el => {
              const label = (el.innerText || '').replace(/\s+/g, ' ').trim();
              return label === 'Log in' || label === 'लॉग इन';
            });
            const bar = document.querySelector('#less-nav').getBoundingClientRect();
            const rect = button ? button.getBoundingClientRect() : null;
            return rect ? {bottom: rect.bottom, barTop: bar.top, gap: bar.top - rect.bottom} : {missing: true};
          });
          expect(opening.gap, 'signed-out Earn login at scroll 0: ' + JSON.stringify(opening)).toBeGreaterThanOrEqual(1);
        }
        expect(await overlaps(page), name).toBe('');
        expect(await reachable(page), name).toBe('');
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
  await expect(page.locator('#shell-greeting')).toBeHidden();
  await expect(page.locator('header.header')).not.toContainText('Welcome to NiaSave');
  await expect(page.locator('#sync-state')).toHaveText('Details did not load.');
  await expect(page.locator('header.header')).not.toContainText('Catalogue synced');
  await expect(page.locator('#content')).not.toContainText('Getting your details');
  await expect(page.locator('.home-attention-card')).toHaveCount(0);
  await expect(page.locator('#call-nia')).toHaveAttribute('data-action', 'help');
  await page.locator('#call-nia').click();
  await expect(page.locator('#dialog')).toBeVisible();
  await page.locator('#dialog [data-action="close"]').click();
  await page.locator('#content .pause-note-more summary').click();
  await expect(page.locator('#content .pause-note-full')).toContainText('Browsing is open');
});

test('a ready Home shows the mockup lines without a welcome or sync line', async ({page}) => {
  await page.setViewportSize({width: 390, height: 780});
  await page.addInitScript(() => {
    localStorage.setItem('nia-language', JSON.stringify('en'));
  });
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (!url.includes('/api/') && !url.includes('/v1/')) return route.continue();
    const parsed = new URL(url);
    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(bodyFor('empty', parsed.pathname))});
  });
  await page.goto('/#home');
  await expect(page.locator('.home-dashboard h1')).toHaveText('What do you need today?');
  await expect(page.locator('.pause-note-line')).toHaveText('Booking starts soon. Call Nia for help.');
  await expect(page.locator('.home-tile-line').nth(2)).toHaveText('Rice, atta, oil at low prices');
  await expect(page.locator('.home-tile-shop img')).toHaveAttribute('src', /\/assets\/home-rice\.jpg$/);
  await expect(page.locator('#shell-greeting')).toBeHidden();
  await expect(page.locator('#sync-state')).toBeHidden();
  await expect(page.locator('header.header')).not.toContainText('Welcome to NiaSave');
  await expect(page.locator('header.header')).not.toContainText('Catalogue synced');
  await expect(page.locator('.home-dashboard')).not.toContainText('Welcome to NiaSave');
  await expect(page.locator('.home-dashboard')).not.toContainText('Catalogue synced');
});
