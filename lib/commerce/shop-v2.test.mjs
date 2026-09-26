import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SHOP_CATEGORY_IDS,shopCategory,shopSearch,shopUnit,shopViewState,shopCatalogueMarkup,voiceLanguage,shopSourceCopy,shopReservationNotice,shopPhoto,shopPrice} from '../../commerce-shop-v2.js';
const ctx={t:s=>s,esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money:n=>'Rs '+n};
const data={products:[{id:'r1',name:'Rice big',pack:'5 kg',category:'rice',price:300,translations:{hi:{name:'चावल बड़ा'}}},{id:'r2',name:'Rice small',pack:'1 kg',category:'rice',price:80},{id:'x',name:'Groundnut oil',category:'food',price:52}]};
test('six category doors and unassigned Central product remain honest',()=>{
  assert.deepEqual(SHOP_CATEGORY_IDS,['rice','atta','oil','pulses','soap','tea']);
  assert.equal(shopCategory(data.products[2]),'other');
  const html=shopCatalogueMarkup({catalogue:data,lang:'en'}, {...ctx,bag:'<p>Bag</p>'});
  assert.match(html,/Other essentials/);assert.match(html,/Groundnut oil/);
  assert.match(html,/Unit price not supplied by Central/);
  assert.doesNotMatch(html,/From Rs 52|Lowest price/);
});
test('search matches Central translated names and does not fabricate rows',()=>{
  assert.deepEqual(shopSearch(data.products,'चावल','hi').map(p=>p.id),['r1']);
  assert.deepEqual(shopSearch(data.products,'groundnut','en').map(p=>p.id),['x']);
  assert.deepEqual(shopSearch(data.products,'missing','en'),[]);
  assert.equal(voiceLanguage('bn'),'bn-IN');
  assert.equal(voiceLanguage('ta'),'ta-IN');
});
test('unit price and lowest flag require explicit Central fields, never sticker comparison',()=>{
  assert.equal(shopUnit(data.products[0]),null);
  assert.equal(shopUnit({unitPricePaise:5200,unit:'kg'}).lowest,false);
  assert.equal(shopUnit({unitPricePaise:5200,unit:'kg',lowestUnitPriceInCategory:true}).lowest,true);
  const html=shopCatalogueMarkup({catalogue:{products:[{id:'r',name:'Rice',category:'rice',price:800,unitPricePaise:5200,unit:'kg',lowestUnitPriceInCategory:true}]}},ctx);
  assert.match(html,/From Rs 52 \/ kg/);
});
test('seven catalogue states and no local manufacturer list in live Shop route',()=>{
  const base={catalogue:{products:[data.products[0]],asOf:new Date().toISOString()}};
  assert.equal(shopViewState(base),'ready');
  assert.equal(shopViewState({...base,online:false}),'offline');
  assert.equal(shopViewState({...base,loading:true}),'loading');
  assert.equal(shopViewState({...base,readFailed:true}),'unavailable');
  assert.equal(shopViewState({catalogue:{}}),'source_missing');
  assert.equal(shopViewState({catalogue:{products:[]}}),'empty');
  assert.equal(shopViewState({catalogue:{products:[],asOf:'2020-01-01T00:00:00Z'}}),'stale');
  const src=fs.readFileSync(new URL('../../commerce.js',import.meta.url),'utf8');
  const active=src.slice(src.indexOf('function shop(){'),src.indexOf('function showBuy('));
  assert.match(active,/shopCatalogueMarkup/);
  assert.doesNotMatch(active,/manufacturersFor|markCheapest|makerPrice/);
  assert.match(src,/shopPhoto/);
});
test('source and all four interface languages have Search, categories and missing metadata',()=>{
  const src=fs.readFileSync(new URL('../../commerce-shop-v2.js',import.meta.url),'utf8');
  const build=fs.readFileSync(new URL('../../vercel-build.sh',import.meta.url),'utf8');
  assert.match(build,/commerce-shop-v2\.js/);
  for(const lang of ['hi','ta','bn']){
    const text=fs.readFileSync(new URL('../../commerce-locales/'+lang+'.js',import.meta.url),'utf8');
    for(const key of ['Rice','Atta','Oil','Pulses','Soap','Tea','Search by voice','Unit price not supplied by Central','Lowest price'])
      assert.ok(text.includes(JSON.stringify(key)),lang+': '+key);
    for(const key of Object.values(shopSourceCopy('niasave')))
      assert.ok(text.includes(JSON.stringify(key)),lang+': '+key);
  }
  assert.doesNotMatch(src,/Math\.min\([^)]*price/);
});
test('Nia-owned Shop names its source and leaves legacy catalogue copy unchanged',()=>{
  const catalogue={...data,owner:'niasave'};
  for(const view of [{},{aisle:'rice'},{query:'oil'}]){
    const html=shopCatalogueMarkup({catalogue,...view},ctx);
    assert.match(html,/Browse essentials from NiaSave/);
    assert.match(html,/Catalogue from NiaSave/);
    assert.doesNotMatch(html,/Central/);
  }
  const html=shopCatalogueMarkup({catalogue},ctx);
  assert.match(html,/Photo not available/);assert.match(html,/Unit price not recorded/);
  assert.match(html,/These products have no category assigned/);
  assert.match(shopPhoto({}, {...ctx,name:'Rice',sourceOwner:'niasave'}),/Photo not available/);
  assert.match(shopPrice({}, {...ctx,sourceOwner:'niasave'}),/Unit price not recorded/);
  assert.match(shopSourceCopy('niasave').review,/NiaSave/);
  for(const owner of [undefined,'central','other']){
    const legacy=shopCatalogueMarkup({catalogue:{...data,owner}},ctx);
    assert.match(legacy,/Browse Essentials from Central/);
    assert.match(legacy,/Photo not supplied by Central/);
    assert.match(shopSourceCopy(owner).review,/Central/);
  }
});
test('Nia reservation notice distinguishes guest, empty, unknown, stale and capability state',()=>{
  const catalogue={owner:'niasave',products:[]};
  const notice=patch=>shopReservationNotice({catalogue,signedIn:true,reservationsEnabled:true,...patch});
  assert.equal(notice({catalogue:data}),undefined);
  assert.match(notice({signedIn:false}),/^Sign in/);
  assert.match(notice({}),/No essentials are available.*right now/);
  assert.match(notice({catalogue:{owner:'niasave'}}),/Catalogue unavailable/);
  for(const available of [null,undefined,NaN,-1,1.5])
    assert.match(notice({catalogue:{...catalogue,products:[{available}]}}),/^Refresh/);
  assert.match(notice({catalogue:{...catalogue,products:[{available:0}]}}),/^No essentials/);
  assert.match(notice({catalogue:{...catalogue,asOf:'2020-01-01T00:00:00Z'}}),/^Refresh/);
  const stocked={...catalogue,products:[{available:2}]};
  assert.equal(notice({catalogue:stocked}),null);
  assert.match(notice({catalogue:stocked,reservationsEnabled:false}),/^Reservations are unavailable right now/);
  assert.match(notice({catalogue:{...catalogue,products:[{available:2,test:true}]}}),/^No essentials/);
});
test('empty Nia catalogue does not claim unpublished inventory for signed-out members',()=>{
  const catalogue={owner:'niasave',products:[]};
  const guest=shopCatalogueMarkup({catalogue,state:'empty',signedIn:false},ctx);
  assert.match(guest,/Sign in to see essentials for your location and reserve/);
  assert.doesNotMatch(guest,/No products published yet|No published products|No essentials are available/);
  const member=shopCatalogueMarkup({catalogue,state:'empty',signedIn:true},ctx);
  assert.match(member,/No essentials are available to reserve for your location right now/);
  assert.doesNotMatch(member,/No products published yet/);
});
