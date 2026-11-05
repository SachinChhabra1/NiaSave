import { test, expect } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`account phone and code stay inline at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => localStorage.setItem('nia-language', JSON.stringify('en')));
    let signedIn = false;
    const posts = [];
    await page.route('**/api/commerce/**', route => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace('/api/commerce', '');
      if (request.method() === 'POST') posts.push({ path, body: request.postDataJSON() });
      if (path === '/auth/verify') {
        if (request.postDataJSON().code === '1111') return route.fulfill({ status: 400, json: { error: 'bad_otp' } });
        signedIn = true;
        return route.fulfill({ json: { account: { role: 'member' }, next: 'authenticated' } });
      }
      return route.fulfill({ json: path === '/catalogue' ? {
        products: [], locations: [], memberAuth: 'otp',
        account: signedIn ? { id: 'fixture-member', name: 'Test member', role: 'member' } : null
      } : path === '/auth/request' ? { challenge: 'fixture-challenge' } : {} });
    });
    await page.goto('/#account');
    const card = page.locator('.account-card');
    await expect(card.locator('[data-auth-step=phone]')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Owner access', exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Contact your Nia team', exact: true })).toBeVisible();
    await card.locator('[name=phone]').fill('9876543210');
    await card.getByRole('button', { name: 'Send WhatsApp code', exact: true }).click();
    await expect(card.locator('[data-auth-step=code]')).toBeVisible();
    await expect(page.locator('#dialog')).not.toBeVisible();
    await expect(card.locator('.auth-phone')).toHaveText('+919876543210');
    await card.locator('[name=code]').fill('1111');
    await card.getByRole('button', { name: 'Verify & continue', exact: true }).click();
    await expect(card.locator('[role=alert]')).toContainText('That code is not correct');
    await expect(card.getByRole('button', { name: 'Verify & continue', exact: true })).toBeEnabled();
    await page.screenshot({ path: `/tmp/niasave-account-code-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await card.getByRole('button', { name: 'Change', exact: true }).click();
    await expect(card.locator('[name=phone]')).toHaveValue('9876543210');
    await page.screenshot({ path: `/tmp/niasave-account-phone-${width}.png`, fullPage: true });
    await card.getByRole('button', { name: 'Send WhatsApp code', exact: true }).click();
    await card.locator('[name=code]').fill('1234');
    await card.getByRole('button', { name: 'Verify & continue', exact: true }).click();
    await expect(card.getByRole('heading', { name: 'Test member' })).toBeVisible();
    for (const name of ['Membership status', 'Partner services', 'Orders & stays', 'Contact your Nia team', 'Sign out']) {
      await expect(card.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await page.screenshot({ path: `/tmp/niasave-account-member-${width}.png`, fullPage: true });
    expect(posts[0]).toEqual({ path: '/auth/request', body: { phone: '+919876543210' } });
    expect(posts[1]).toEqual({ path: '/auth/verify', body: { challenge: 'fixture-challenge', code: '1111', phone: '+919876543210' } });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
