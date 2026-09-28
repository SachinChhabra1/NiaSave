import {test, expect} from '@playwright/test';

async function openShop(page, {width, lang, status, body}) {
  await page.setViewportSize({width, height: 780});
  await page.addInitScript(language => {
    localStorage.setItem('nia-language', JSON.stringify(language));
  }, lang);
  await page.route('**/api/commerce/**', route => route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
  }));
  await page.goto('/#shop');
  await expect(page.locator('.shop-v2 h1')).toBeVisible();
}

test('empty Shop at 360px stays under 1500px with photos and no placeholder box', async ({page}) => {
  await openShop(page, {
    width: 360,
    lang: 'en',
    status: 200,
    body: {products: [], locations: [], account: null}
  });
  await expect(page.locator('.shop-category')).toHaveCount(6);
  await expect(page.locator('.shop-category img')).toHaveCount(6);
  await expect(page.locator('.shop-v2 .shop-photo-missing')).toHaveCount(0);
  await expect(page.locator('.shop-v2')).toContainText('Search for rice, oil, soap');
  await expect(page.locator('.shop-v2')).toContainText('These goods');
  await expect(page.locator('.shop-v2')).toContainText('Prices are not up yet. To order now, call Nia.');
  await expect(page.locator('.shop-v2')).not.toContainText('Shop is closed for now');
  await expect(page.locator('.shop-v2')).toContainText('Nothing to add yet. Call Nia to order.');
  const columns = await page.locator('.shop-category-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(2);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(height).toBeLessThan(1500);
});

test('a closed Shop shows only the closed line', async ({page}) => {
  await openShop(page, {
    width: 360,
    lang: 'en',
    status: 503,
    body: {error: 'central_unreachable'}
  });
  await expect(page.locator('.shop-read-state')).toHaveText('Shop is closed for now. Please try later.');
  await expect(page.locator('.shop-rank-note')).toHaveCount(0);
  await expect(page.locator('.shop-category img')).toHaveCount(6);
  await expect(page.locator('#sync-state')).toHaveText('Details did not load.');
});

const guestBody = {
  preview: false,
  owner: 'niasave',
  account: null,
  products: [],
  locations: [],
  asOf: new Date().toISOString(),
  capabilities: {saveShoppingOpen: true, saveReservations: false}
};

test('signed out, a catalogue 200 is sign-in and not a failed read', async ({page}) => {
  await openShop(page, {width: 390, lang: 'en', status: 200, body: guestBody});
  await expect(page.locator('#sync-state')).toHaveText('Log in to see what is here');
  await expect(page.locator('#sync-state')).toHaveAttribute('data-state', 'signin');
  await expect(page.locator('header.header')).not.toContainText('Details did not load.');
});

for (const status of [401, 403]) {
  test(`signed out, a catalogue ${status} is sign-in and not a failed read`, async ({page}) => {
    await openShop(page, {width: 390, lang: 'en', status, body: {error: 'forbidden'}});
    await expect(page.locator('#sync-state')).toHaveText('Log in to see what is here');
    await expect(page.locator('#sync-state')).toHaveAttribute('data-state', 'signin');
    await expect(page.locator('header.header')).not.toContainText('Details did not load.');
  });
}

test('a catalogue 500 still says details did not load', async ({page}) => {
  await openShop(page, {width: 390, lang: 'en', status: 500, body: {error: 'central_unreachable'}});
  await expect(page.locator('#sync-state')).toHaveText('Details did not load.');
  await expect(page.locator('#sync-state')).not.toHaveText('Log in to see what is here');
});

test('a catalogue network error still says details did not load', async ({page}) => {
  await page.setViewportSize({width: 390, height: 780});
  await page.addInitScript(() => localStorage.setItem('nia-language', JSON.stringify('en')));
  await page.route('**/api/commerce/**', route => route.abort('failed'));
  await page.goto('/#shop');
  await expect(page.locator('.shop-v2 h1')).toBeVisible();
  await expect(page.locator('#sync-state')).toHaveText('Details did not load.');
});

test('home stays quiet for a signed-out denial and speaks up on a real failure', async ({page}) => {
  await page.setViewportSize({width: 390, height: 780});
  await page.addInitScript(() => localStorage.setItem('nia-language', JSON.stringify('en')));
  await page.route('**/api/commerce/**', route => route.fulfill({
    status: 403,
    contentType: 'application/json',
    body: '{"error":"forbidden"}'
  }));
  await page.goto('/#home');
  await expect(page.locator('.home-dashboard h1')).toHaveText('What do you need today?');
  await expect(page.locator('#sync-state')).toBeHidden();
  await expect(page.locator('header.header')).not.toContainText('Details did not load.');
  await page.unroute('**/api/commerce/**');
  await page.route('**/api/commerce/**', route => route.abort('failed'));
  await page.reload();
  await expect(page.locator('#sync-state')).toHaveText('Details did not load.');
});
