import {test,expect} from '@playwright/test';
import {bodyFor} from '../ui-clarity/replies.mjs';

async function fictionalMember(page,{auditBlock=false}={}){
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{
    localStorage.setItem('nia-language',JSON.stringify('en'));
    const Original=Date,fixed=Original.parse('2026-09-15T04:00:00Z');
    function FrozenDate(...args){return args.length?new Original(...args):new Original(fixed);}
    FrozenDate.now=()=>fixed;FrozenDate.parse=Original.parse;FrozenDate.UTC=Original.UTC;FrozenDate.prototype=Original.prototype;window.Date=FrozenDate;
  });
  const requests=[];
  await page.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.hostname.includes('openstreetmap'))return route.abort();
    if(url.pathname.includes('/api/')||url.pathname.includes('/v1/')){
      const method=request.method(),availability=url.pathname==='/api/commerce/nests/availability'&&method==='POST';
      requests.push({path:url.pathname,method,body:request.postDataJSON()});
      // Availability is a read-only POST. Fulfil it locally; every other write stays blocked.
      if(!['GET','HEAD','OPTIONS'].includes(method)&&(auditBlock||!availability))return route.fulfill({status:204,body:''});
      const body=structuredClone(bodyFor('signed-in',url.pathname));
      if(availability)body.start=request.postDataJSON().start;
      return route.fulfill({json:body});
    }
    return route.continue();
  });
  return requests;
}

for(const entry of ['direct','hash']){
  test(`bag panel is reachable by ${entry} entry and browser history restores Shop`,async({page})=>{
    await fictionalMember(page);
    await page.goto('/#shop');
    await expect(page.locator('.shop-v2')).toBeVisible();
    if(entry==='direct')await page.goto('/#bag');
    else await page.evaluate(()=>{location.hash='bag';});
    await expect(page).toHaveURL(/#bag$/);
    await expect(page.getByRole('heading',{name:'Your bag is empty',exact:true})).toBeInViewport();
    await expect(page.locator('.bag-page [data-action="close-bag"]')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/#shop$/);
    await expect(page.locator('.shop-v2')).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/#bag$/);
    await expect(page.getByRole('heading',{name:'Your bag is empty',exact:true})).toBeInViewport();
    await page.locator('.bag-page [data-action="close-bag"]').click();
    await expect(page).toHaveURL(/#shop$/);
    await expect(page.locator('.shop-v2')).toBeVisible();
    await page.locator('#less-nav [data-action="live"]').click();
    await page.locator('#less-nav [data-action="shop"]').click();
    await expect(page.locator('.shop-v2')).toBeVisible();
  });
}

test('the filled-bag entry opens its panel without losing quantities or the Shop aisle',async({page})=>{
  await fictionalMember(page);
  await page.goto('/#shop');
  await page.locator('[data-action="open-aisle"][data-id="rice"]').click();
  await page.locator('[data-action="open-buy"]').first().click();
  await page.locator('#dialog [data-action="add"]').click();
  await page.locator('#dialog .dialog-head [data-action="close"]').click();
  await page.locator('[data-action="open-bag"]').click();
  await expect(page).toHaveURL(/#bag$/);
  await expect(page.locator('.bag-page')).toBeFocused();
  await expect(page.locator('.bag-page')).toContainText('Example rice pack');
  await expect(page.locator('.bag-page .stepper > span')).toHaveText('1');
  // Check rendered glyphs and labels against their actual painted background.
  for(const selector of ['.stepper > span','.stepper button > span']){
    for(const text of await page.locator(`.bag-page ${selector}`).all()){
      await expect(text).toBeVisible();
      const contrast=await text.evaluate(el=>{
        const rgb=value=>value.match(/[\d.]+/g).map(Number);
        const luminance=channels=>channels.slice(0,3).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);
        let parent=el,bg;
        while(parent){bg=rgb(getComputedStyle(parent).backgroundColor);if(bg.length===3||bg[3]===1)break;parent=parent.parentElement;}
        const a=luminance(rgb(getComputedStyle(el).color)),b=luminance(bg);
        return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      });
      expect(contrast,await text.textContent()).toBeGreaterThanOrEqual(4.5);
    }
  }
  await page.locator('.bag-page').getByRole('button',{name:'Add one Example rice pack',exact:true}).click();
  await expect(page.locator('.bag-page .stepper > span')).toHaveText('2');
  await page.locator('.bag-page').getByRole('button',{name:'Remove one Example rice pack',exact:true}).click();
  await expect(page.locator('.bag-page .stepper > span')).toHaveText('1');
  await page.locator('.bag-page [data-action="close-bag"]').click();
  await expect(page.locator('.shop-catalogue [data-action="close-aisle"]')).toBeVisible();
  await expect(page.locator('.shop-bag-inline .stepper > span')).toHaveText('1');
});

for(const auditBlock of [true,false]){
  test(`Shop dialog close then Live dates: ${auditBlock?'reproduce incomplete audit fixture':'complete read-only fixture'}`,async({page})=>{
    const requests=await fictionalMember(page,{auditBlock});
    await page.goto('/#live');
    await expect(page.locator('#content')).toContainText('Example Nest North');
    await expect(page.locator('[data-live-date="today"]')).toBeVisible();
    await page.locator('#less-nav [data-action="shop"]').click();
    await page.locator('[data-action="open-aisle"][data-id="rice"]').click();
    await page.locator('[data-action="open-buy"]').first().click();
    await expect(page.locator('#dialog')).toBeVisible();
    await page.locator('#dialog .dialog-head [data-action="close"]').click();
    await expect(page.locator('#dialog')).not.toBeVisible();
    await page.locator('#less-nav [data-action="live"]').click();
    await expect.poll(()=>requests.filter(r=>r.path.endsWith('/nests/availability')).length).toBe(1);
    expect(requests.find(r=>r.path.endsWith('/nests/availability'))).toEqual({path:'/api/commerce/nests/availability',method:'POST',body:{start:'2026-09-15'}});
    if(auditBlock){
      await expect(page.locator('#content')).toContainText('We could not get the dates');
      await expect(page.locator('#content')).not.toContainText('Example Nest North');
    }else{
      await expect(page.locator('#content')).toContainText('Example Nest North');
      await expect(page.locator('[data-live-date="today"]')).toBeVisible();
      await expect(page.locator('#content')).not.toContainText('We could not get the dates');
      await expect(page.locator('#content')).not.toContainText('No Nests yet');
      await page.locator('[data-live-date="week"]').click();
      await expect(page.locator('.live-date-asked')).toHaveText('You are asking for: 16/09/2026');
      await expect(page.locator('#content')).toContainText('Example Nest North');
    }
  });
}
