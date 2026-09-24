import assert from 'node:assert/strict';
import test from 'node:test';
import {loadLanguage,translate} from '../../commerce-i18n.js';
import {memberProducts,shopCatalogueMarkup,shopViewState} from '../../commerce-shop-v2.js';

const iconLabels=['Live','Earn','Shop','Send','Rice','Atta','Oil','Pulses','Soap','Tea',
  'Search by voice','Search','All categories','View item','Close dialog','Add one','Remove one',
  'Requested','Reserved','Confirmed','Queued on this phone','Held for pickup by'];

test('member icon and money labels render safely in every supported language',async()=>{
  for(const lang of ['en','hi','ta','bn']){
    await loadLanguage(lang);
    for(const label of iconLabels){
      const copy=translate(lang,label);
      assert.ok(typeof copy==='string'&&copy.trim(),lang+': '+label);
      assert.doesNotMatch(copy,/^(?:TBD|TODO|placeholder|lorem|TEST|DEMO)$/i);
    }
    assert.equal(translate(lang,'A missing member message'), 'A missing member message');
  }
});

test('production catalogue presentation excludes test and preview products',()=>{
  const real={id:'real',name:'Rice',shopCategoryId:'rice',price:52};
  const testItem={id:'test',name:'TEST PRODUCT',test:true,shopCategoryId:'rice',price:1};
  const previewItem={id:'demo',name:'DEMO PRODUCT',preview:true,shopCategoryId:'rice',price:1};
  const catalogue={preview:false,products:[real,testItem,previewItem]};
  assert.deepEqual(memberProducts(catalogue),[real]);
  const esc=value=>String(value);
  const html=shopCatalogueMarkup({catalogue,lang:'en',state:'ready'},{t:value=>value,esc,money:value=>'Rs '+value,bag:''});
  assert.doesNotMatch(html,/TEST PRODUCT|DEMO PRODUCT/);
  assert.equal(shopViewState({catalogue:{...catalogue,products:[testItem,previewItem]}}),'empty');
  assert.equal(memberProducts({...catalogue,preview:true}).length,3);
});
