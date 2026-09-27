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
  await expect(page.locator('#content .money-honesty-chip')).toHaveCount(0);
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
});
