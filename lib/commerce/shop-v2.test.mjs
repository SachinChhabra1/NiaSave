import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SHOP_CATEGORY_IDS,shopCategory,shopSearch,shopUnit,shopViewState,shopCatalogueMarkup,voiceLanguage} from '../../commerce-shop-v2.js';
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
  }
  assert.doesNotMatch(src,/Math\.min\([^)]*price/);
});
