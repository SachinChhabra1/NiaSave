import { test, expect } from '@playwright/test';

for (const unavailable of [false, true]) {
for (const width of [320, 390, 760, 761, 960, 1280, 1440]) {
  test(`member controls respond to pointer and keyboard at ${width}px (catalogue ${unavailable ? 'unavailable' : 'ready'})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem('nia-language', JSON.stringify('en')));
    // Exercise real markup and handlers with a read-only empty catalogue.
    // No reservation or Central decision is simulated or submitted.
    let nestReads = 0;
    await page.route('**/api/commerce/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/nests')) nestReads++;
      if (unavailable && path.endsWith('/catalogue')) return route.fulfill({ status: 503, json: { error: 'central_unreachable' } });
      await route.fulfill({ json: path.endsWith('/catalogue')
        ? { products: [], locations: [], account: null }
        : {}, status: 200 });
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(unavailable ? '/#home' : '/#shop');
    if (unavailable) {
      await expect(page.locator('.home-dashboard')).toContainText('Temporarily unavailable');
      await page.locator('#content').getByRole('button', { name: /Browse Essentials/ }).click();
    }
    await expect(page.locator('.shop-read-state')).toHaveAttribute('data-state', unavailable ? 'unavailable' : 'empty');
    const nav = page.getByRole('navigation', { name: 'LESS navigation' });
    await nav.getByRole('button', { name: 'Live', exact: true }).click();
    await expect(page.locator('#content h1')).toHaveText('Live');
    expect(nestReads).toBe(1);
    if (unavailable) {
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await expect.poll(() => nestReads).toBe(2);
    }
    await nav.getByRole('button', { name: 'Earn', exact: true }).click();
    await expect(page.locator('#content h1')).toHaveText('Earn');
    await page.locator('#sign-label').click();
    await expect(page.locator('#content h1')).toHaveText('Your account');
    await nav.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.locator('#content')).toContainText('Transfers not active');
    await page.locator('#content').getByRole('button', { name: 'Sign in', exact: true }).first().click();
    await expect(page.locator('#dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await expect(page.locator('#dialog')).not.toBeVisible();
    await nav.getByRole('button', { name: 'Shop', exact: true }).click();
    await page.locator('[data-action="open-aisle"][data-id="rice"]').click();
    await expect(page.getByRole('button', { name: 'All categories', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'All categories', exact: true }).click();
    await page.getByRole('searchbox').fill('rice');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByRole('searchbox')).toHaveValue('rice');
    await nav.getByRole('button', { name: 'Send', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#content')).toContainText('Transfers not active');
    await page.locator('#content').getByRole('button', { name: 'Sign in', exact: true }).first().focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#dialog')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
}
