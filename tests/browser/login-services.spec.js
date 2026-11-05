import { test, expect } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`logged-out service overview and replacing auth steps at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 900});
    await page.addInitScript(() => localStorage.setItem('nia-language', JSON.stringify('en')));
    await page.route('**/api/commerce/**', route => {
      const path = new URL(route.request().url()).pathname;
      return route.fulfill({json: path.endsWith('/catalogue')
        ? {products: [], locations: [], account: null, memberAuth: 'otp'}
        : path.endsWith('/auth/request') ? {challenge: 'layout-fixture'} : {}});
    });
    await page.goto('/#account');
    const services = page.locator('.login-service-card');
    const card = page.locator('.account-card');
    await expect(services).toHaveCount(7);
    for (const name of ['Nests','Studios','Essentials','Walk2Work','Send home','Bed & locker','Delivery']) {
      await expect(services.getByRole('heading', {name, exact: true})).toBeVisible();
    }
    await expect(card.locator('[data-auth-step=phone]')).toBeVisible();
    await expect(card.getByRole('button', {name:'Owner access', exact:true})).toBeVisible();
    await expect(card.getByRole('button', {name:'Contact your Nia team', exact:true})).toBeVisible();
    const first = await services.nth(0).boundingBox();
    const fourth = await services.nth(3).boundingBox();
    const fifth = await services.nth(4).boundingBox();
    const login = await card.boundingBox();
    if (width >= 1000) {
      expect(login.x).toBeGreaterThan(fourth.x + fourth.width);
      expect(login.y).toBeLessThan(first.y);
      await expect(card).toHaveCSS('position', 'sticky');
    } else {
      expect(login.y).toBeGreaterThanOrEqual(fourth.y + fourth.height);
      expect(fifth.y).toBeGreaterThanOrEqual(login.y + login.height);
    }
    await card.locator('[name=phone]').fill('9876543210');
    await card.getByRole('button', {name:'Send WhatsApp code', exact:true}).click();
    await expect(card.locator('[data-auth-step=code]')).toBeVisible();
    await expect(card.locator('[data-auth-step=phone]')).toHaveCount(0);
    await expect(card.locator('[name=phone]')).toHaveCount(0);
    await expect(page.locator('#dialog')).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const width of [390, 1440]) {
  test(`login popup keeps services behind it at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height:900});
    await page.addInitScript(() => localStorage.setItem('nia-language', JSON.stringify('en')));
    await page.route('**/api/commerce/**', route => route.fulfill({json: new URL(route.request().url()).pathname.endsWith('/catalogue')
      ? {products:[], locations:[], account:null, memberAuth:'otp'} : {}}));
    await page.goto('/#earn');
    await page.locator('.store-earn [data-action=login]').click();
    const dialog = page.locator('#dialog');
    await expect(dialog.locator('[data-auth-step=phone]')).toBeVisible();
    await expect(dialog.getByRole('button',{name:'Owner access',exact:true})).toBeVisible();
    await expect(dialog.getByRole('button',{name:'Contact your Nia team',exact:true})).toBeVisible();
    await expect(page.locator('#auth-services-backdrop')).toBeVisible();
    await expect(page.locator('#auth-services-backdrop')).toHaveAttribute('inert','');
    const box = await dialog.boundingBox();
    if (width < 1000) {
      expect(box.width).toBe(width);
      expect(Math.abs(box.y + box.height - 900)).toBeLessThan(2);
    } else {
      expect(Math.abs(box.x + box.width/2 - width/2)).toBeLessThan(2);
      expect(box.width).toBe(420);
    }
    await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();
    await expect(page.locator('#auth-services-backdrop')).not.toBeVisible();
    await expect(page.locator('.store-earn')).toBeVisible();
  });
}
