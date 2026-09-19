import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../niasave-apple-store.css', import.meta.url), 'utf8');
const apple = fs.readFileSync(new URL('../../apple-desktop.css', import.meta.url), 'utf8');
const commerceCss = fs.readFileSync(new URL('../../commerce.css', import.meta.url), 'utf8');
const truth = fs.readFileSync(new URL('../../commerce-truth.js', import.meta.url), 'utf8');

test('Save grids are contained grocery cards, not a full-bleed photo wall', () => {
  assert.match(src, /save-product-card/);
  assert.match(src, /save-product-tile/);
  assert.match(src, /save-product-cta/);
  assert.match(src, /t\('Check'/);
  const mill = src.slice(src.indexOf('function millCard('), src.indexOf('function saveMakers('));
  assert.match(mill, /save-product-tile save-maker-still/);
  assert.match(mill, /save-product-pack/);
  assert.match(mill, /save-product-cta/);
  assert.doesNotMatch(mill, /inner=`<span class="save-maker-still">/);
  assert.match(css, /save-product-card/);
  assert.match(css, /save-shop-canvas/);
  assert.match(css, /padding:22px!important/);
  assert.match(css, /object-fit:contain!important/);
  assert.match(css, /overflow:visible!important/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css, /button\.save-maker-card\{display:block/);
  assert.doesNotMatch(css, /oils-editorial-sheet\.png/);
});

test('category and mill cards use complete product stills, not sprite slices', () => {
  assert.match(src, /PRODUCT_STILLS/);
  assert.match(src, /\/assets\/products\/groundnut-oil\.jpg/);
  assert.match(src, /\/assets\/products\/mustard-oil\.jpg/);
  assert.match(src, /\/assets\/products\/sunflower-oil\.jpg/);
  assert.match(src, /\/assets\/products\/coconut-oil\.jpg/);
  assert.match(src, /\/assets\/products\/bath-soap\.jpg/);
  assert.match(src, /\/assets\/products\/toothpaste\.jpg/);
  assert.match(src, /\/assets\/products\/detergent\.jpg/);
  assert.match(src, /class="photo photo-still/);
  assert.match(src, /save-maker-still/);
  assert.doesNotMatch(src, /background-position:\$\{/);
  assert.doesNotMatch(src, /Product photo pending/);
  assert.match(css, /object-fit:contain/);
  assert.match(css, /aspect-ratio:1\/1/);
  for (const name of ['groundnut-oil.jpg','mustard-oil.jpg','sunflower-oil.jpg','coconut-oil.jpg','bath-soap.jpg','toothpaste.jpg','detergent.jpg']) {
    assert.equal(fs.existsSync(new URL('../../assets/products/'+name, import.meta.url)), true, name);
  }
});

test('Sign in control is icon plus readable label at 44px, nothing clipped', () => {
  assert.match(src, /\$\('#sign-label'\)\.classList\.toggle\('mesha-avatar',false\)/);
  assert.match(css, /min-height:44px!important/);
  assert.match(css, /header-tools \.signin>span/);
  assert.match(css, /white-space:nowrap!important/);
  assert.match(apple, /min-height:44px;height:44px/);
  assert.doesNotMatch(apple, /min-height:28px;height:28px/);
});

test('Earn leads with task then factory still; punch-clock is gone', () => {
  assert.match(src, /store-task-photo/);
  assert.match(src, /\/assets\/earn\.jpg/);
  assert.doesNotMatch(src, /earn-ot-editorial-v4\.jpg/);
  assert.match(src, /Jobs near your Nest/);
  assert.match(src, /data-action="login"/);
  const earnFn = src.slice(src.indexOf('function earnView('), src.indexOf('async function reviewJob'));
  assert.ok(earnFn.indexOf('store-task') < earnFn.indexOf('store-task-photo'));
  assert.ok(earnFn.indexOf('Jobs near your Nest') < earnFn.indexOf('/assets/earn.jpg'));
});

test('Send leads with the money statement; posed family photo is gone', () => {
  assert.match(src, /\/assets\/send\.jpg/);
  assert.doesNotMatch(src, /send-purpose-family\.jpg/);
  assert.doesNotMatch(commerceCss, /send-purpose-family\.jpg/);
  const sendFn = src.slice(src.indexOf('function sendView('), src.indexOf('async function loadNests'));
  assert.ok(sendFn.indexOf('money statement') < sendFn.indexOf('/assets/send.jpg'));
  assert.match(sendFn, /Transfers not active/);
});

test('Earn signed-out visitors are not told to sign in again', () => {
  assert.match(src, /Sign in to see jobs near your Nest/);
  assert.match(src, /earnError='signed_out'/);
  assert.match(truth, /signedIn \? 'expired' : 'signedOut'/);
  assert.match(src, /data-state="\$\{esc\(kind\)\}"/);
  const panel = src.slice(src.indexOf('function earnErrorPanel('), src.indexOf('function earnView('));
  assert.match(panel, /signed-out/);
  assert.doesNotMatch(panel, /Please sign in again to continue[\s\S]*Sign in to view your job applications/);
});

test('payments stay off and Home hero copy is unchanged', () => {
  assert.doesNotMatch(src, /paymentsEnabled\s*=\s*true/);
  assert.match(src, /A Nest near work\./);
  assert.match(src, /Move in with Nia\. Roof, rest, and a short walk to the shift\./);
  assert.match(src, /Pay when you collect/);
});
