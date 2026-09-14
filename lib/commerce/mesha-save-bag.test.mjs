import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../commerce.css', import.meta.url), 'utf8');

test('Save bag is a sheet or drawer, not a permanent sidebar', () => {
  assert.doesNotMatch(src, /aside class="sidebar"/);
  assert.doesNotMatch(src, /class="how"/);
  assert.doesNotMatch(src, /Choose your essentials/);
  assert.doesNotMatch(src, /A few essentials\.<br>A little less to worry about\./);
  assert.match(src, /class="mesha-bag-layer"/);
  assert.match(src, /data-action="open-bag"/);
  assert.match(src, /data-action="close-bag"/);
  assert.match(src, /function closeBag\(/);
  assert.match(css, /\.mesha-bag-layer/);
  assert.match(css, /\.mesha-bag-chip/);
});

test('bag copy matches Mesha locks: one title, empty hard, Continue CTA', () => {
  assert.doesNotMatch(src, /page==='bag'\?`<div class="page"><h1>\$\{t\('Your bag'/);
  assert.doesNotMatch(src, /t\('Review your bag'/);
  assert.doesNotMatch(src, /\$\{count\(\)\} \$\{t\('items'/);
  assert.doesNotMatch(src, /1 item|items ·/);
  assert.match(src, /Your bag is empty/);
  assert.match(src, /Add oils or soap from Save\. Browse free\./);
  assert.match(src, /Back to Save/);
  assert.match(src, /t\('Continue'/);
  assert.match(src, /t\('Bag'[^)]*\)\} · \$\{count\(\)\} · \$\{money\(total\(\)\)\}/);
  assert.match(src, /Phone only on the next step\. Nothing to pay online\./);
  assert.match(src, /class="mesha-bag-thumb"/);
});

test('guest browse and Add stay free; phone is only after Continue', () => {
  assert.match(src, /if\(!account\)\{checkoutPending=true;return checkoutSignIn\(\);\}/);
  assert.match(src, /function checkoutSignIn\(/);
  assert.match(src, /Your phone/);
  assert.match(src, /We'll send a code to reserve this bag\. Pay at pickup — not online\./);
  assert.match(src, /Only asked at checkout · bag stays on this phone/);
  assert.match(src, /if\(action==='open-bag'\)return await openBag\(\)/);
  assert.doesNotMatch(src, /function openBag\(\)\{[^}]*login\(\)/);
  assert.match(src, /if\(action==='add'\|\|action==='minus'\)/);
  assert.doesNotMatch(src, /if\(action==='add'\|\|action==='minus'\)\{[^}]*login\(\)/);
});

test('Save aisle keeps short pills and kills the icon tile grid', () => {
  assert.match(src, /save-pills/);
  assert.match(src, /function savePill\(/);
  assert.doesNotMatch(src, /\$\{icon\(c\.icon\)\}<span>\$\{t\(c\.name/);
  assert.match(css, /\.save-categories\.save-pills/);
  assert.match(src, /groundnut_oil','mustard_oil'/);
  assert.doesNotMatch(src, /groundnut_oil','mustard_oil','detergent_pick'/);
});

test('mesha-dark phone cage is only inside max-width 760px; desktop nav is wide', () => {
  const hideNav = css.indexOf('body.mesha-dark #desktop-nav{display:none}');
  const cageMain = css.indexOf('body.mesha-dark main{max-width:430px');
  const mobileMq = css.lastIndexOf('@media(max-width:760px)', hideNav);
  assert.ok(hideNav > 0 && mobileMq >= 0 && hideNav > mobileMq);
  assert.ok(cageMain > mobileMq);
  assert.match(css, /@media\(min-width:761px\)[\s\S]*body\.mesha-dark #desktop-nav\{display:flex\}/);
  assert.match(css, /@media\(min-width:761px\)[\s\S]*body\.mesha-dark main\{[^}]*max-width:1500px/);
  assert.match(css, /@media\(min-width:761px\)[\s\S]*body\.mesha-dark \.mobile-nav\{display:none\}/);
});

test('pickup and how-to leave the bag sheet; quiet pay-at-pickup stays', () => {
  assert.match(src, /pay at pickup/);
  assert.match(src, /show\(t\('Pay at pickup'/);
  assert.doesNotMatch(src, /function bag\(\)\{[^;]*fulfillmentToggle\(\)/);
});
