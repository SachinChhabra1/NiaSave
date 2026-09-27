import {test, expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bodyFor, requestRecord, sortRequests} from '../ui-clarity/replies.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const snapshotPath = path.join(root, 'docs/ui-clarity/requests.snapshot.json');
const modes = ['ready', 'empty', 'down', 'stale', 'signed-in'];

async function freeze(page) {
  await page.addInitScript(() => {
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
    for (const key of ['nia-commerce-bag', 'nia-commerce-pending', 'nia-commerce-cancel-pending', 'nia-nest-pending', 'nia-earn-pending', 'nia-earn-withdraw-pending', 'nia-send-plan']) {
      localStorage.removeItem(key);
    }
    localStorage.setItem('nia-language', JSON.stringify('en'));
  });
}

async function journey(page, mode) {
  const seen = [];
  await page.unrouteAll({behavior: 'ignoreErrors'});
  await page.route('**/*', async route => {
    const request = route.request();
    const url = request.url();
    if (url.includes('openstreetmap.org')) return route.abort();
    if (!url.includes('/api/') && !url.includes('/v1/')) return route.continue();
    const parsed = new URL(url);
    seen.push(requestRecord(request));
    if (mode === 'down') {
      await route.fulfill({status: 503, contentType: 'application/json', body: '{"error":"central_unreachable"}'});
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(bodyFor(mode, parsed.pathname))
    });
  });
  await page.goto('/?lock=' + mode + '#home');
  await expect(page.locator('.home-dashboard')).toBeVisible();
  if (mode === 'signed-in') {
    await expect(page.locator('#content')).toContainText('Example packing job');
    await expect(page.locator('.home-attention-card')).toContainText('Example packing job');
    await expect(page.locator('.home-dashboard')).not.toContainText('Central details missing');
  }
  if (mode === 'down') {
    await expect(page.locator('.home-dashboard')).toContainText('Rice, atta, oil at low prices');
    await expect(page.locator('.home-dashboard')).not.toContainText('Temporarily unavailable');
    await expect(page.locator('.home-attention-card')).toHaveCount(0);
  }
  if (mode === 'empty') await expect(page.locator('.home-dashboard')).not.toContainText('Example rice pack');
  await page.locator('#less-nav button[data-action="live"]').click();
  await expect(page.locator('#content h1')).toHaveText('Live');
  if (mode === 'ready' || mode === 'stale' || mode === 'signed-in') {
    await expect(page.locator('#content')).toContainText('Example Nest North');
  }
  await page.locator('#less-nav button[data-action="earn"]').click();
  await expect(page.locator('#content h1')).toHaveText('Earn');
  await page.locator('#less-nav button[data-action="shop"]').click();
  await expect(page.locator('#content h1')).toHaveText('Shop');
  if (mode === 'ready' || mode === 'stale' || mode === 'signed-in') {
    await expect(page.locator('#content')).toContainText('37');
    await page.locator('[data-action="open-aisle"][data-id="rice"]').click();
    await page.locator('[data-action="open-buy"]').first().click();
    await page.locator('#dialog [data-action="add"]').click();
    await page.locator('#dialog .dialog-head [data-action="close"]').click();
    await expect(page.locator('.mesha-bag h2').first()).toContainText('Bag');
    await expect(page.locator('.mesha-bag h2').first()).toContainText('1');
  }
  await page.locator('#less-nav button[data-action="send"]').click();
  await expect(page.getByRole('heading', {name: 'Send', exact: true})).toBeVisible();
  if (mode === 'signed-in') {
    await page.locator('[data-action="books-plan"]').click();
    await expect(page.locator('#books-plan-form input[name="home"]')).toHaveValue('2500');
    await page.locator('#dialog .dialog-head [data-action="close"]').click();
  }
  await page.locator('#sign-label').click();
  const login = page.locator('[data-action="login"]');
  if (await login.count()) await login.first().click();
  if (mode !== 'signed-in') await expect(page.locator('#dialog')).toBeVisible();
  return sortRequests(seen);
}

test('member journeys keep the same calls and still show Central values', async ({page}) => {
  test.setTimeout(180000);
  await page.setViewportSize({width: 390, height: 780});
  await freeze(page);
  const found = {};
  for (const mode of modes) {
    found[mode] = await journey(page, mode);
  }
  const saved = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  expect(found).toEqual(saved);
});

const queuedKeys = [
  'nia-commerce-bag',
  'nia-commerce-pending',
  'nia-commerce-cancel-pending',
  'nia-nest-pending',
  'nia-earn-pending',
  'nia-earn-withdraw-pending',
  'nia-send-plan'
];

test('queued taps are still read and shown', async ({page}) => {
  test.setTimeout(90000);
  await page.setViewportSize({width: 390, height: 780});
  await page.addInitScript(memberId => {
    const reads = [];
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      reads.push(String(key));
      return original.call(this, key);
    };
    window.__niaReads = reads;
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
    const put = (key, value) => localStorage.setItem(key, JSON.stringify(value));
    // Production stores the language as a JSON string, so Hindi is the characters "hi" with quotes.
    put('nia-language', 'en');
    put('nia-commerce-bag', {'ex-rice-1': 2});
    put('nia-commerce-pending', {accountId: memberId, key: 'pending-key-example', body: {locationId: 'loc-example', fulfillment: 'pickup', lines: [{id: 'ex-rice-1', qty: 1}]}});
    put('nia-commerce-cancel-pending', {orderId: 'ord-example-1', expectedRevision: 3, key: 'cancel-key-example'});
    put('nia-nest-pending', {accountId: memberId, key: 'nest-key-example', body: {studioId: 'ex-nest-1'}});
    put('nia-earn-pending', {accountId: memberId, key: 'earn-key-example', body: {jobId: 'job-ex-1', revision: 1, consent: true}});
    put('nia-earn-withdraw-pending', {accountId: memberId, applicationId: 'app-example-1', expectedRevision: 2, key: 'withdraw-key-example'});
    put('nia-send-plan', {beneficiaryName: 'Example Sister', relation: 'sister', amountInr: '800', schedule: 'month-end'});
  }, 'mem-example-1');
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.includes('openstreetmap.org')) return route.abort();
    if (!url.includes('/api/') && !url.includes('/v1/')) return route.continue();
    const parsed = new URL(url);
    const body = parsed.pathname.endsWith('/orders')
      ? {orders: [{id: 'ord-example-1', revision: 3, status: 'reserved', lines: [], location: {name: 'Example Lane', address: 'Example Lane'}, amount: 37}]}
      : bodyFor('signed-in', parsed.pathname);
    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(body)});
  });
  await page.goto('/#shop');
  await expect(page.locator('#content')).toContainText('Example rice pack');
  await expect(page.locator('#content')).toContainText('Bag');
  await expect(page.locator('#content')).toContainText('2');
  await expect(page.locator('#content')).toContainText('Requested');
  await page.locator('#less-nav button[data-action="live"]').click();
  await expect(page.locator('#content')).toContainText('A Nest request is awaiting confirmation');
  await page.locator('#less-nav button[data-action="earn"]').click();
  await expect(page.locator('#content')).toContainText('Retry application safely');
  await expect(page.locator('#sync-state')).toHaveText('Request needs retry');
  await page.locator('#less-nav button[data-action="send"]').click();
  await expect(page.getByRole('heading', {name: 'Send', exact: true})).toBeVisible();
  await page.addScriptTag({url: '/commerce-waves.js'});
  await expect(page.locator('#send-plan-form input[name="beneficiaryName"]')).toHaveValue('Example Sister');
  await expect(page.locator('#send-plan-form input[name="amountInr"]')).toHaveValue('800');
  const reads = await page.evaluate(() => window.__niaReads);
  for (const key of queuedKeys) expect(reads, key).toContain(key);
  const cancel = await page.evaluate(() => localStorage.getItem('nia-commerce-cancel-pending'));
  expect(cancel).toContain('ord-example-1');
});
