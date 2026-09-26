import {test,expect} from '@playwright/test';
const columns='siteCode,sku,productId,name,pack,pricePaise,onHand,countedAt,priceVerifiedAt,active,expectedRevision';
const csv=columns+'\nsite-1,sku-1,product-1,Recorded item,1 pack,1250,10,2026-09-26T08:00:00Z,2026-09-26T08:00:00Z,true,0';
const inventory={siteCode:'site-1',sku:'sku-1',productId:'product-1',name:'Recorded item',pack:'1 pack',pricePaise:1250,onHand:10,reserved:1,available:9,active:true,revision:1,countedAt:'2026-09-26T08:00:00Z',priceVerifiedAt:'2026-09-26T08:00:00Z'};
const order={id:'order-1',siteCode:'site-1',status:'reserved',revision:1,totalPaise:1250,createdAt:'2026-09-26T08:00:00Z',expiresAt:'2026-09-26T12:00:00Z',lines:[{name:'Recorded item',pack:'1 pack',qty:1}]};
async function setup(page,handler){
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await page.route('**/v1/staff/me',route=>route.fulfill({json:{staff:{email:'fixture@nia.one',role:'admin'}}}));
  await page.route('**/api/commerce/staff/save/**',handler);
}
const snapshot=(extra={})=>({owner:'niasave',schemaVersion:1,asOf:'2026-09-26T08:00:00Z',sites:[{siteCode:'site-1',name:'Assigned site'}],inventory:[inventory],orders:[order],capabilities:{publish:true,complete:true,saveReservations:true},...extra});
test('CSV preview must precede publication; edit invalidates preview and interrupted retry retains key',async({page},testInfo)=>{
  const publishes=[];let previews=0;
  await setup(page,async route=>{
    const path=new URL(route.request().url()).pathname.split('/').pop();
    if(path==='snapshot')return route.fulfill({json:snapshot()});
    const body=route.request().postDataJSON();
    if(path==='inventory-preview'){previews++;return route.fulfill({json:{owner:'niasave',rows:body.rows,previewHash:'hash-'+previews,rowCount:body.rows.length}});}
    if(path==='inventory-publish'){publishes.push(body);return publishes.length===1?route.abort('failed'):route.fulfill({json:{owner:'niasave',published:true}});}
    throw Error('Unexpected API action');
  });
  await page.goto('/save-inventory.html');
  await expect(page.getByText('1 product/site records',{exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'Publish reviewed inventory'})).toBeHidden();
  await expect(page.getByLabel('Inventory CSV file')).toBeVisible();
  await page.getByLabel('Inventory CSV file').setInputFiles({name:'inventory.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await expect(page.getByLabel('CSV contents')).toHaveValue(csv);
  await page.getByRole('button',{name:'Preview changes'}).click();
  await expect(page.getByRole('button',{name:'Publish reviewed inventory'})).toBeVisible();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:testInfo.outputPath('save-inventory-desktop.png'),fullPage:true});
  await page.getByLabel('CSV contents').fill(csv+'\n');
  await expect(page.getByRole('button',{name:'Publish reviewed inventory'})).toBeHidden();
  await page.getByRole('button',{name:'Preview changes'}).click();
  await page.getByRole('button',{name:'Publish reviewed inventory'}).click();
  await expect(page.getByRole('button',{name:'Retry this publication'})).toBeEnabled();
  await page.getByRole('button',{name:'Retry this publication'}).click();
  await expect(page.getByText('Inventory published.',{exact:true})).toBeVisible();
  expect(publishes).toHaveLength(2);expect(publishes[0]).toEqual(publishes[1]);expect(publishes[0].previewHash).toBe('hash-2');expect(publishes[0].rows[0].onHand).toBe(10);
});
test('mobile pickup requires entered code, matching amount and both confirmations',async({page},testInfo)=>{
  const completed=[];await page.setViewportSize({width:390,height:900});
  await setup(page,async route=>{
    if(route.request().method()==='GET')return route.fulfill({json:snapshot({orders:completed.length?[{...order,status:'completed',payment:{status:'received',amountPaise:1250}}]:[order]})});
    completed.push(route.request().postDataJSON());return route.fulfill({json:{ok:true}});
  });
  await page.goto('/save-inventory.html');await page.getByRole('tab',{name:'Orders',exact:true}).click();
  await expect(page.getByLabel('Pickup code from the member')).toHaveValue('');
  await page.getByLabel('Pickup code from the member').fill('MEMBER-CODE');
  await page.getByLabel('Amount received (INR)').fill('12.00');
  await page.getByLabel('Payment evidence',{exact:true}).fill('Receipt checked fixture');
  await page.getByLabel('Handover evidence',{exact:true}).fill('Member collected fixture');
  await page.getByLabel('I confirm payment was received.').check();await page.getByLabel('I confirm these items were handed to the member.').check();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:testInfo.outputPath('save-orders-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'Record payment and collection'}).click();
  await expect(page.getByText('Confirm payment and handover, and enter the exact received amount.')).toBeVisible();expect(completed).toHaveLength(0);
  await page.getByLabel('Amount received (INR)').fill('12.50');await page.getByRole('button',{name:'Record payment and collection'}).click();
  await expect(page.getByText('Bank settlement has not been verified here.',{exact:false})).toBeVisible();
  expect(completed).toHaveLength(1);expect(completed[0]).toMatchObject({orderId:'order-1',expectedRevision:1,pickupCode:'MEMBER-CODE',amountPaise:1250});expect(completed[0].idempotencyKey).toBeTruthy();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('unavailable snapshot clears old records and capabilities keep writes closed',async({page})=>{
  let calls=0;
  await setup(page,route=>{calls++;return calls===1?route.fulfill({json:snapshot({capabilities:{publish:false,complete:false}})}):route.fulfill({status:503,json:{error:'save_unavailable'}});});
  await page.goto('/save-inventory.html');await expect(page.getByRole('button',{name:'Preview changes'})).toBeDisabled();
  await page.getByRole('tab',{name:'Orders',exact:true}).click();await expect(page.getByRole('heading',{name:'Order order-1'})).toBeVisible();await expect(page.getByLabel('Pickup code from the member')).toHaveCount(0);
  await page.getByRole('button',{name:'Refresh orders'}).click();await expect(page.getByText('Orders unavailable',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Order order-1'})).toHaveCount(0);
});
