import {test, expect} from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
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

async function statusContrast(page) {
  return page.evaluate(() => {
    const lin = channel => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const lum = rgb => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
    const parse = color => {
      const match = String(color).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?/);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] == null ? 1 : Number(match[4])] : null;
    };
    const background = el => {
      let node = el;
      while (node) {
        const parsed = parse(getComputedStyle(node).backgroundColor);
        if (parsed && parsed[3] > 0.05) return parsed.slice(0, 3);
        node = node.parentElement;
      }
      return [255, 255, 255];
    };
    const rows = [];
    for (const el of document.querySelectorAll('[role="status"]')) {
      if (el.closest('#commerce-ops')) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      const text = el.innerText.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const fg = parse(style.color);
      if (!fg) continue;
      const back = background(el);
      const ratio = (Math.max(lum(fg), lum(back)) + 0.05) / (Math.min(lum(fg), lum(back)) + 0.05);
      rows.push({text: text.slice(0, 80), ratio: Math.round(ratio * 100) / 100, color: style.color, background: `rgb(${back.join(',')})`});
    }
    return rows;
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
        const contrast = [];
        const sizes = new Set();
        const oddType = [];
        for (const name of ['home', 'live', 'earn', 'shop', 'send']) {
          if (name !== 'home') {
            await page.locator(`#less-nav button[data-action="${name}"]`).click();
            await expect(page.locator('#less-nav button[aria-current="page"]')).toHaveAttribute('data-action', name);
          }
          expect(await iconGaps(page)).toEqual([]);
          await expect(page.locator('#commerce-ops')).toHaveCount(0);
          const file = lang + '/' + width + '/' + mode + '/' + name;
          for (const row of await statusContrast(page)) {
            contrast.push(file + ' ' + row.ratio + ' ' + row.text);
            if (row.ratio < 4.5) banned.push(file + ' contrast ' + row.ratio + ' ' + row.text + ' ' + row.color + ' on ' + row.background);
          }
          const facts = await visibleFacts(page);
          expect(facts.length).toBeGreaterThan(5);
          const seen = new Set();
          for (const fact of facts) {
            sizes.add(Math.round(fact.size));
            if (![14, 16, 24].includes(Math.round(fact.size))) oddType.push(Math.round(fact.size) + 'px ' + fact.text.slice(0, 70));
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
          if (name === 'live' && await page.locator('[data-live-date="pick"]').count()) {
            await page.locator('[data-live-date="pick"]').click();
            await expect(page.locator('[data-live-part="day"]')).toBeFocused();
            const openFile = file + '/pick';
            const openFacts = await visibleFacts(page);
            for (const fact of openFacts) {
              sizes.add(Math.round(fact.size));
            if (![14, 16, 24].includes(Math.round(fact.size))) oddType.push(Math.round(fact.size) + 'px ' + fact.text.slice(0, 70));
              if (violationKind(fact.text) && !copyCovers(fact.text, baseline.entries, name)) banned.push(openFile + ': ' + fact.text);
              if (fact.size < 14) {
                const key = openFile + '\0' + fact.text;
                if (!seen.has(key)) {
                  seen.add(key);
                  fonts.push({kind: 'font', file: openFile, screen: name, string: fact.text, size: fact.size});
                }
              }
            }
            for (const label of await visibleDates(page)) dates.push({kind: 'date', file: openFile, screen: name, string: label});
            const day = page.locator('[data-live-part="day"]');
            const before = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-live-part'));
            await day.selectOption({index: 1});
            const after = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-live-part'));
            expect(before).toBe('day');
            expect(after).toBe('day');
          }
          const login = page.locator('#content [data-action="login"]');
          if (await login.count() && await login.first().isVisible()) {
            await login.first().click();
            await expect(page.locator('#dialog[open], dialog[open]')).toHaveCount(1);
            const openFile = file + '/login';
            for (const fact of await visibleFacts(page)) {
              sizes.add(Math.round(fact.size));
            if (![14, 16, 24].includes(Math.round(fact.size))) oddType.push(Math.round(fact.size) + 'px ' + fact.text.slice(0, 70));
              if (violationKind(fact.text) && !copyCovers(fact.text, baseline.entries, name)) banned.push(openFile + ': ' + fact.text);
              if (fact.size < 14) fonts.push({kind: 'font', file: openFile, screen: name, string: fact.text, size: fact.size});
            }
            for (const label of await visibleDates(page)) dates.push({kind: 'date', file: openFile, screen: name, string: label});
            await page.locator('#dialog [data-action="close"]').click();
          }
          if (name === 'send') {
            const add = page.locator('[data-action="books-add"]');
            if (await add.count() && await add.first().isVisible()) {
              await add.first().click();
              await expect(page.locator('#books-entry-form')).toBeVisible();
              const openFile = file + '/books-add';
              for (const fact of await visibleFacts(page)) {
                sizes.add(Math.round(fact.size));
            if (![14, 16, 24].includes(Math.round(fact.size))) oddType.push(Math.round(fact.size) + 'px ' + fact.text.slice(0, 70));
                if (violationKind(fact.text) && !copyCovers(fact.text, baseline.entries, name)) banned.push(openFile + ': ' + fact.text);
                if (fact.size < 14) fonts.push({kind: 'font', file: openFile, screen: name, string: fact.text, size: fact.size});
              }
              for (const label of await visibleDates(page)) dates.push({kind: 'date', file: openFile, screen: name, string: label});
              const dialogText = await page.locator('#dialog').innerText();
              expect(dialogText.toLowerCase()).not.toContain('mm/dd/yyyy');
              await page.getByRole('button', {name: 'Close dialog', exact: true}).click();
            }
          }
        }
        expect(banned).toEqual([]);
        expect(oddType).toEqual([]);
        expect(contrast.length).toBeGreaterThan(0);
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

test('opened Send entry forms show dd/mm/yyyy and keep focus', async ({page}) => {
  test.setTimeout(90000);
  await page.setViewportSize({width: 360, height: 780});
  await prepare(page, 'en');
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.includes('openstreetmap.org')) return route.abort();
    if (!url.includes('/api/') && !url.includes('/v1/')) return route.continue();
    const parsed = new URL(url);
    const body = JSON.parse(JSON.stringify(bodyFor('signed-in', parsed.pathname)));
    if (parsed.pathname.endsWith('/books') && body.months) {
      body.months[0].entries[0].editable = true;
    }
    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(body)});
  });
  await page.goto('/#send');
  await page.locator('[data-action="books-add"]').first().click();
  await expect(page.locator('#books-entry-form input[type="date"]')).toHaveCount(0);
  await expect(page.locator('#books-entry-form [name="date"]')).toHaveValue('2026-09-15');
  await expect(page.locator('.books-date-shown')).toHaveText('15/09/2026');
  const months = await page.locator('[data-books-part="month"] option').evaluateAll(nodes => nodes.map(node => node.value));
  expect(months).toContain('9');
  await expect(page.locator('[data-books-part="month"]')).toHaveValue('9');
  const month = page.locator('[data-books-part="month"]');
  await month.focus();
  const before = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-books-part'));
  await month.selectOption('8');
  const after = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-books-part'));
  expect(before).toBe('month');
  expect(after).toBe('month');
  await expect(page.locator('#dialog')).not.toContainText('mm/dd/yyyy');
  await page.getByRole('button', {name: 'Close dialog', exact: true}).click();
  await page.locator('.books-entry summary').first().click();
  await page.locator('[data-action="books-edit"]').click();
  await expect(page.locator('#books-entry-form input[type="date"]')).toHaveCount(0);
  await expect(page.locator('#books-entry-form [name="date"]')).toHaveValue('2026-09-02');
  await expect(page.locator('.books-date-shown')).toHaveText('02/09/2026');
  expect(await visibleDates(page)).toEqual([]);
});

test('the week chip names the date it asked for', async ({page}) => {
  test.setTimeout(90000);
  await page.setViewportSize({width: 360, height: 780});
  await prepare(page, 'en');
  let asked = '';
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.includes('openstreetmap.org')) return route.abort();
    if (!url.includes('/api/') && !url.includes('/v1/')) return route.continue();
    const parsed = new URL(url);
    const body = JSON.parse(JSON.stringify(bodyFor('empty', parsed.pathname)));
    if (parsed.pathname.endsWith('/nests/availability')) {
      let posted = {};
      try { posted = route.request().postDataJSON(); } catch { posted = {}; }
      asked = posted && posted.start ? posted.start : '';
      if (asked) body.start = asked;
    }
    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(body)});
  });
  await page.goto('/#live');
  await page.locator('[data-live-date="week"]').click();
  expect(asked).toBe('2026-09-16');
  await expect(page.locator('.live-date-asked')).toHaveText('You are asking for: 16/09/2026');
});

for (const lang of ['en', 'hi', 'ta', 'bn']) {
  test(`bottom bar labels are written in ${lang}`, async ({page}) => {
    test.setTimeout(90000);
    await page.setViewportSize({width: 360, height: 780});
    await prepare(page, lang);
    await install(page, 'empty');
    await page.goto('/#home');
    await expect(page.locator('#less-nav button')).toHaveCount(4);
    const labels = await page.locator('#less-nav button span').allTextContents();
    expect(labels).toHaveLength(4);
    const script = {en: /[A-Za-z]/, hi: /\p{Script=Devanagari}/u, ta: /\p{Script=Tamil}/u, bn: /\p{Script=Bengali}/u}[lang];
    for (const label of labels) {
      expect(label.trim()).toMatch(script);
      if (lang !== 'en') expect(label).not.toMatch(/[A-Za-z]/);
    }
  });
}

test('first load transfers at most 500KB before below-the-fold images', async ({page}) => {
  test.setTimeout(90000);
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..', 'dist');
  if (!fs.existsSync(path.join(root, 'commerce.html'))) throw new Error('dist/commerce.html is missing. Run npm run build:production first.');
  const types = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json'};
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = urlPath === '/' ? 'commerce.html' : urlPath.replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }
    const body = fs.readFileSync(file);
    const gz = zlib.gzipSync(body);
    const type = types[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, {'Content-Type': type, 'Content-Encoding': 'gzip', 'Content-Length': String(gz.length), 'Cache-Control': 'no-store'});
    res.end(gz);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
  await page.setViewportSize({width: 360, height: 780});
  await prepare(page, 'en');
  const fontBytes = [];
  page.on('response', response => {
    const url = response.url();
    if (!/fonts\.(googleapis|gstatic)\.com/.test(url)) return;
    fontBytes.push((async () => {
      const header = Number(response.headers()['content-length'] || 0);
      let bytes = header;
      let text = '';
      if (!bytes || /fonts\.googleapis\.com/.test(url)) {
        try {
          const body = await response.body();
          if (!bytes) bytes = body.length;
          if (/fonts\.googleapis\.com/.test(url)) text = body.toString('utf8');
        } catch { /* already consumed, or no body */ }
      }
      return {url, bytes, text};
    })());
  });
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.includes('/api/') || url.includes('/v1/')) {
      const parsed = new URL(url);
      await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(bodyFor('empty', parsed.pathname))});
      return;
    }
    if (!url.startsWith(`http://127.0.0.1:${port}`)) {
      if (/fonts\.(googleapis|gstatic)\.com/.test(url)) return route.continue();
      return route.abort();
    }
    return route.continue();
  });
  await page.goto(`http://127.0.0.1:${port}/commerce.html#home`, {waitUntil: 'networkidle'});
  const measured = await page.evaluate(() => {
    const fold = window.innerHeight;
    const below = new Set();
    for (const img of document.images) {
      if (img.getBoundingClientRect().top >= fold) below.add(img.currentSrc || img.src);
    }
    const resources = performance.getEntriesByType('resource').map(entry => ({
      name: entry.name,
      size: entry.transferSize || entry.encodedBodySize || 0,
      type: entry.initiatorType
    }));
    const nav = performance.getEntriesByType('navigation')[0];
    let total = nav ? (nav.transferSize || nav.encodedBodySize || 0) : 0;
    const kept = [];
    for (const entry of resources) {
      const image = entry.type === 'img' || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(entry.name);
      if (image && [...below].some(src => entry.name === src || src.endsWith(entry.name))) continue;
      if (image && below.has(entry.name)) continue;
      total += entry.size;
      kept.push(entry.name.split('/').pop() + ':' + entry.size);
    }
    return {total, kept};
  });
  const seen = new Set();
  const fonts = await Promise.all(fontBytes);
  for (const font of fonts) {
    if (!font.bytes || seen.has(font.url)) continue;
    seen.add(font.url);
    const name = font.url.split('/').pop();
    const counted = measured.kept.some(row => row.startsWith(name + ':') && !row.endsWith(':0'));
    if (!counted) {
      measured.total += font.bytes;
      measured.kept.push(name + ':' + font.bytes);
    }
    if (!font.text) continue;
    const latin = new Set();
    for (const block of font.text.split('/*').slice(1)) {
      const label = block.slice(0, 24);
      if (!/latin/i.test(label) || /latin-ext/i.test(label)) continue;
      const file = (block.match(/url\(([^)]+)\)/) || [])[1];
      if (file) latin.add(file.replace(/['"]/g, ''));
    }
    for (const file of latin) {
      if (seen.has(file) || fonts.some(item => item.url === file)) continue;
      seen.add(file);
      const reply = await page.request.get(file);
      const size = Number(reply.headers()['content-length'] || 0) || (await reply.body()).length;
      measured.total += size;
      measured.kept.push(file.split('/').pop() + ':' + size);
    }
  }
  expect(measured.total, measured.kept.join('\n')).toBeLessThanOrEqual(500 * 1024);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
