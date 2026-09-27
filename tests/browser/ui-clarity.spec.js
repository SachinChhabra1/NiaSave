import {test, expect} from '@playwright/test';
import {BASELINE_MAX} from '../ui-clarity/limits.mjs';
import {copyCovers, readBaseline, violationKind} from '../ui-clarity/scan.mjs';
import {bodyFor} from '../ui-clarity/replies.mjs';

async function prepare(page, lang) {
  await page.addInitScript(language => {
    const fixed = Date.parse('2026-09-15T04:00:00.000Z');
    const Original = Date;
    function FrozenDate(...args) {
      return args.length ? new Original(...args) : new Original(fixed);
    }
    FrozenDate.now = () => fixed;
    FrozenDate.parse = Original.parse;
    FrozenDate.UTC = Original.UTC;
    FrozenDate.prototype = Original.prototype;
    window.Date = FrozenDate;
    localStorage.setItem('nia-language', JSON.stringify(language));
  }, lang);
}

async function install(page, mode) {
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.includes('openstreetmap.org')) return route.abort();
    if (!url.includes('/api/') && !url.includes('/v1/')) return route.continue();
    if (mode === 'down') {
      await route.fulfill({status: 503, contentType: 'application/json', body: '{"error":"central_unreachable"}'});
      return;
    }
    const parsed = new URL(url);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(bodyFor('empty', parsed.pathname))
    });
  });
}

async function visibleFacts(page) {
  return page.evaluate(() => {
    const facts = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const el = node.parentElement;
      if (!el || el.closest('script, style, noscript, svg')) continue;
      const dialog = el.closest('dialog');
      if (dialog && !dialog.open) continue;
      if (el.closest('[hidden]')) continue;
      const style = getComputedStyle(el);
      if (el.closest('#commerce-ops')) continue;
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      if (style.clip && style.clip !== 'auto') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      facts.push({text, size: parseFloat(style.fontSize)});
    }
    return facts;
  });
}

async function iconGaps(page) {
  return page.evaluate(() => {
    const gaps = [];
    const word = el => el.innerText.replace(/\s+/g, ' ').trim();
    const hasIcon = el => {
      if (el.querySelector('svg, img')) return true;
      return [el, ...el.querySelectorAll('*')].some(node => {
        const image = getComputedStyle(node).backgroundImage;
        return Boolean(image) && image !== 'none';
      });
    };
    for (const el of document.querySelectorAll('#less-nav button, .home-tile, .shop-category, .home-attention-card')) {
      if (el.closest('#commerce-ops')) continue;
      if (hasIcon(el) && !word(el)) gaps.push((el.className || 'tile') + ' has an icon and no word');
    }
    return gaps;
  });
}

async function visibleDates(page) {
  return page.evaluate(() => {
    const found = [];
    for (const input of document.querySelectorAll('input[type="date"]')) {
      if (input.closest('#commerce-ops')) continue;
      const style = getComputedStyle(input);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      const rect = input.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      const label = input.labels && input.labels[0] ? input.labels[0].innerText.replace(/\s+/g, ' ').trim() : '';
      found.push(label || input.getAttribute('aria-label') || 'input[type=date]');
    }
    return found;
  });
}

for (const width of [360, 390]) {
  for (const lang of ['en', 'hi']) {
    for (const mode of ['down', 'empty']) {
      test(`member screens stay clear at ${width}px in ${lang} when Central is ${mode}`, async ({page}) => {
        test.setTimeout(90000);
        const baseline = readBaseline();
        assertBaselineSize(baseline);
        await page.setViewportSize({width, height: 780});
        await prepare(page, lang);
        await install(page, mode);
        await page.goto('/#home');
        await expect(page.locator('#less-nav button')).toHaveCount(4);
        const fonts = [];
        const banned = [];
        const dates = [];
        for (const name of ['home', 'live', 'earn', 'shop', 'send']) {
          if (name !== 'home') {
            await page.locator(`#less-nav button[data-action="${name}"]`).click();
            await expect(page.locator('#less-nav button[aria-current="page"]')).toHaveAttribute('data-action', name);
          }
          expect(await iconGaps(page)).toEqual([]);
          await expect(page.locator('#commerce-ops')).toHaveCount(0);
          const facts = await visibleFacts(page);
          expect(facts.length).toBeGreaterThan(5);
          const file = lang + '/' + width + '/' + mode + '/' + name;
          const seen = new Set();
          for (const fact of facts) {
            if (violationKind(fact.text) && !copyCovers(fact.text, baseline.entries, name)) banned.push(file + ': ' + fact.text);
            if (fact.size < 14) {
              const key = file + '\0' + fact.text;
              if (!seen.has(key)) {
                seen.add(key);
                fonts.push({kind: 'font', file, screen: name, string: fact.text, size: fact.size});
              }
            }
          }
          const seenDates = new Set();
          for (const label of await visibleDates(page)) {
            const key = file + '\0' + label;
            if (seenDates.has(key)) continue;
            seenDates.add(key);
            dates.push({kind: 'date', file, screen: name, string: label});
          }
        }
        expect(banned).toEqual([]);
        const allowedFonts = new Map();
        for (const entry of baseline.entries) {
          if (entry.kind !== 'font') continue;
          const size = Number(entry.size);
          if (!Number.isFinite(size)) continue;
          const key = entry.file + '\0' + entry.string;
          const prior = allowedFonts.get(key);
          if (prior == null || size < prior) allowedFonts.set(key, size);
        }
        const freshFonts = fonts.filter(entry => {
          const recorded = allowedFonts.get(entry.file + '\0' + entry.string);
          return recorded == null || entry.size < recorded;
        });
        expect(freshFonts).toEqual([]);
        const allowedDates = new Set(baseline.entries.filter(entry => entry.kind === 'date').map(entry => entry.file + '\0' + entry.string));
        const freshDates = dates.filter(entry => !allowedDates.has(entry.file + '\0' + entry.string));
        expect(freshDates).toEqual([]);
      });
    }
  }
}

function assertBaselineSize(baseline) {
  expect(baseline.entries.length).toBeLessThanOrEqual(BASELINE_MAX);
}
