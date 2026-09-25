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
    const strapline = page.locator('.header .brand-strapline');
    await expect(strapline).toBeVisible();
    await expect(strapline).toHaveText('Spend LESS, send more.');
    await expect(strapline.locator('.brand-less')).toHaveCSS('color', 'rgb(44, 88, 128)');
    if (width >= 761) {
      const header = await page.locator('.header').boundingBox();
      const content = await page.locator('#content').boundingBox();
      const rail = await page.locator('#less-nav').boundingBox();
      expect(header.width).toBeLessThanOrEqual(440);
      expect(content.width).toBeLessThanOrEqual(440);
      expect(rail.width).toBeLessThanOrEqual(440);
      expect(Math.abs(content.x + content.width / 2 - width / 2)).toBeLessThan(2);
      expect(Math.abs(rail.x + rail.width / 2 - width / 2)).toBeLessThan(2);
      expect(rail.y + rail.height).toBeGreaterThanOrEqual(898);
      await expect(page.locator('#less-nav')).toHaveCSS('grid-template-columns', /px .*px .*px .*px/);
    }
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

const passwordAuthCapabilities = {
  mode: 'password_otp',
  entryPath: '/',
  hashTabs: ['live', 'earn', 'shop', 'send'],
  apiBasePath: '/api/commerce',
  registeredPhoneOnly: false,
  otpRequestPath: '/api/commerce/auth/request',
  otpVerifyPath: '/api/commerce/auth/verify',
  setPasswordPath: '/api/commerce/auth/set-password',
  setPasswordAliases: ['/api/commerce/auth/password', '/api/commerce/auth/password/set'],
  loginPath: '/api/commerce/auth/login',
  rememberSession: true
};

for (const width of [390, 1280]) {
  test(`fresh-browser member password screen asks for mobile number and personal password at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem('nia-language', JSON.stringify('en')));
    const posts = [];
    await page.route('**/api/commerce/**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace('/api/commerce', '');
      if (request.method() === 'POST') {
        posts.push({path, body: request.postDataJSON()});
      }
      if (request.method() === 'GET' && path === '/catalogue') {
        return route.fulfill({status: 200, json: {
          products: [],
          locations: [],
          account: null,
          memberAuth: 'password',
          memberAuthCapabilities: passwordAuthCapabilities
        }});
      }
      // All auth responses are local fixtures: no OTP, account, or credential is real.
      return route.fulfill({status: 200, json: {}});
    });

    await page.goto('/#account');
    const account = page.getByRole('main');
    await expect(account).toContainText('Your account');
    await account.getByRole('button', {name: 'Member sign in', exact: true}).click();
    await page.getByRole('button', {name: 'Already have a password? Sign in', exact: true}).click();

    const form = page.locator('#login-form');
    await expect(form).toHaveAttribute('data-auth-step', 'password-login');
    await expect(form.locator('input[name="phone"]')).toHaveAttribute('autocomplete', 'tel-national');
    await expect(form.locator('input[name="password"]')).toHaveAttribute('autocomplete', 'current-password');
    await expect(form).toContainText('Personal password');
    await expect(form.locator('input[name="remember"]')).toBeChecked();

    // The invalid HTML phone value must not produce an auth request.
    const phone = form.locator('input[name="phone"]');
    const password = form.locator('input[name="password"]');
    await password.fill('fake-password-only');
    await phone.fill('1234567890');
    expect(await phone.evaluate(input => input.validity.patternMismatch)).toBe(true);
    expect(await password.evaluate(input => input.checkValidity())).toBe(true);
    await form.getByRole('button', {name: 'Sign in and stay signed in', exact: true}).click();
    expect(posts.filter(({path}) => path === '/auth/login')).toHaveLength(0);
    await expect(form).toBeVisible();

    await phone.fill('9876543210');
    await form.getByRole('button', {name: 'Sign in and stay signed in', exact: true}).click();
    await expect.poll(() => posts.filter(({path}) => path === '/auth/login')).toHaveLength(1);
    expect(posts.filter(({path}) => path === '/auth/request')).toHaveLength(0);
    expect(posts.filter(({path}) => path === '/auth/login')[0].body).toEqual({
      phone: '+919876543210',
      password: 'fake-password-only',
      remember: true
    });
  });
}
