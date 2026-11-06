import {test,expect} from '@playwright/test';
import {bodyFor} from '../ui-clarity/replies.mjs';

test('member tabs keep a single usable header row and omit unavailable home savings',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>localStorage.setItem('nia-language',JSON.stringify('en')));
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname.includes('openstreetmap'))return route.abort();
    if(url.pathname.includes('/api/')||url.pathname.includes('/v1/')){
      const body=bodyFor('signed-in',url.pathname);
      if(url.pathname.endsWith('/catalogue'))body.capabilities={saveReservations:false};
      return route.fulfill({json:body});
    }
    return route.continue();
  });
  await page.goto('/#home');
  await expect(page.locator('.home-dashboard')).toBeVisible();
  await expect(page.locator('.home-savings')).toHaveCount(0);
  const title=await page.locator('.home-title').boundingBox();
  const banner=await page.locator('[data-pilot-paused]').boundingBox();
  if(banner)expect(banner.y).toBeGreaterThanOrEqual(title.y+title.height);
  for(const tab of ['home','live','earn','shop','send','account']){
    if(tab!=='home')await page.locator(tab==='account'?'#sign-label':`#less-nav [data-action="${tab}"]`).click();
    const header=await page.locator('header.header').boundingBox();
    expect(header.height).toBeLessThanOrEqual(64);
    for(const selector of ['.header .brand','#sign-label','#call-nia','#header-language button']){
      const control=page.locator(selector);
      await expect(control).toBeVisible();
      const rect=await control.boundingBox();
      expect(rect.y).toBeGreaterThanOrEqual(header.y);
      expect(rect.y+rect.height).toBeLessThanOrEqual(header.y+header.height);
      expect(rect.x+rect.width).toBeLessThanOrEqual(390);
    }
    if(tab==='earn')await expect(page.getByText('Jobs near where you stay',{exact:true})).toHaveCount(1);
  }
  await page.getByRole('button',{name:'Change language',exact:true}).click();
  await expect(page.locator('#dialog .mesha-lang-list')).toBeVisible();
});
