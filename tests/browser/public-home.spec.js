import {test, expect} from '@playwright/test';

async function memberReplies(page) {
  await page.route('**/api/commerce/**', route => route.fulfill({status: 200, json: route.request().url().endsWith('/catalogue') ? {products: [], locations: [], account: null} : {}}));
}

for (const width of [320, 390, 700, 768, 1280, 1440]) {
  test(`public layout and navigation remain separate from member APIs at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 900});
    const memberReads = [];
    page.on('request', request => {if (request.url().includes('/api/commerce')) memberReads.push(request.url());});
    await page.goto('/');
    await expect(page.getByRole('heading', {level: 1})).toHaveText('A better lifearound work.');
    await expect(page.locator('.pillars article')).toHaveCount(4);
    await expect(page.locator('.pilot-note')).toContainText('Money transfers have not started');
    await expect(page.locator('.public-footer small')).toContainText('generated illustrations');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Force lazy cards into view before checking bytes and framing.
    await page.locator('.pillars').scrollIntoViewIfNeeded();
    await expect.poll(async () => page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
    if (width <= 800) {
      await page.getByRole('button', {name: 'Open navigation'}).click();
      await expect(page.getByRole('button', {name: 'Close navigation'})).toHaveAttribute('aria-expanded', 'true');
    }
    await page.getByRole('link', {name: 'For enterprises', exact: true}).click();
    await expect(page).toHaveURL(/#enterprises$/);
    await page.getByRole('button', {name: 'Discuss an enterprise partnership'}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', {name: 'Back to NiaSave'}).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect(memberReads).toEqual([]);
  });
}

for (const hash of ['home', 'live', 'earn', 'shop', 'send', 'bag', 'orders', 'account', 'unknown']) {
  test(`existing member fragment #${hash} keeps language entry`, async ({page}) => {
    await memberReplies(page);
    await page.goto('/#' + hash);
    await expect(page.locator('.mesha-lang')).toBeVisible();
    await expect(page.locator('.public-header')).toHaveCount(0);
    await expect(page.locator('.header')).toHaveCount(1);
  });
}

test('member login handoff, sticky language, browser history and direct member entry', async ({page}) => {
  await memberReplies(page);
  await page.addInitScript(() => localStorage.setItem('nia-language', JSON.stringify('en')));
  await page.goto('/');
  await page.getByRole('link', {name: 'Member login', exact: true}).click();
  await expect(page.locator('#content h1')).toHaveText('Your account');
  await expect(page).toHaveURL(/\/#account$/);
  await page.goBack();
  await expect(page.locator('.hero h1')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#content h1')).toHaveText('Your account');
  await page.goto('/commerce.html#send');
  await expect(page.locator('#content')).toContainText('Sending money has not started');
});

test('passkey setup fragment reaches existing member parser without leaking token into requests', async ({page}) => {
  await memberReplies(page);
  const token = 'a'.repeat(43), requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/#setup?token=' + token);
  await expect(page).toHaveURL(/#account$/);
  await expect(page.locator('.mesha-lang')).toBeVisible();
  expect(requests.some(url => url.includes(token))).toBe(false);
});

test('member entry failure provides an intact direct-entry fallback', async ({page}) => {
  await page.route('**/commerce.html', route => route.fulfill({status: 503, body: 'Unavailable'}));
  await page.goto('/?lang=hi#account');
  await expect(page.getByRole('link', {name: 'Open member services'})).toHaveAttribute('href', '/commerce.html?lang=hi#account');
});
