import {test, expect} from '@playwright/test';

test('logged-out account keeps the language gate and fits phone entry at 390px', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/commerce/**', route => route.fulfill({json:route.request().url().endsWith('/catalogue')?{products:[],locations:[],account:null,memberAuth:'otp'}:{}}));
  await page.goto('/#account');
  await expect(page.locator('.mesha-lang')).toBeVisible();
  await page.locator('.mesha-lang-btn[data-id=en]').click();
  const card=page.locator('.account-card.member-entry');
  await expect(card.locator('[data-auth-step=phone]')).toBeVisible();
  for(const selector of ['.shell-heading','#sign-label','.header #call-nia','.account-page > h1','.account-brand','.account-card .entry-language','.pause-note-line']) await expect(page.locator(selector)).toBeHidden();
  await expect(page.locator('.header .brand')).toBeVisible();
  await expect(page.locator('#header-language button')).toBeVisible();
  await expect(page.locator('#header-language button span')).toBeHidden();
  const phone=await card.locator('[name=phone]').boundingBox();
  const submit=await card.getByRole('button',{name:'Send WhatsApp code',exact:true}).boundingBox();
  expect(phone.y).toBeGreaterThan(0);
  expect(submit.y+submit.height).toBeLessThan(844);
  expect((await page.locator('#less-nav').boundingBox()).y).toBeGreaterThanOrEqual(844);
  const call=page.locator('.account-call-nia');
  await expect(call).toHaveText('Call Nia');
  expect((await call.boundingBox()).y).toBeGreaterThanOrEqual((await card.boundingBox()).y+(await card.boundingBox()).height);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.locator('#header-language button').click();
  await expect(page.locator('#dialog .mesha-lang-list')).toBeVisible();
});
