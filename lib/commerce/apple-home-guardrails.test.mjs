import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../commerce.css', import.meta.url), 'utf8');
const apple = fs.readFileSync(new URL('../../apple-desktop.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../../commerce.html', import.meta.url), 'utf8');
const homeFn = src.slice(src.indexOf('function entryHomepage'), src.indexOf('function render()'));

test('homepage is Live unit + Save unit + Earn/Send pair after language', () => {
  assert.match(homeFn, /class="mesha-home apple-home"/);
  assert.match(homeFn, /class="mesha-desire apple-unit"/);
  assert.match(homeFn, /class="apple-unit apple-save-unit"/);
  assert.match(homeFn, /class="mesha-rail apple-pair"/);
  assert.match(homeFn, /data-action="live"/);
  assert.match(homeFn, /data-action="shop"/);
  assert.match(homeFn, /\['earn','earn'/);
  assert.match(homeFn, /\['send','send'/);
  assert.match(homeFn, /data-action="\$\{action\}"/);
  assert.match(homeFn, /A bed near work\./);
  assert.match(homeFn, /Keep more\./);
  assert.match(homeFn, /Extra shifts/);
  assert.match(homeFn, /Money home\./);
});

test('homepage does not invent Nest counts, jobs, or payments', () => {
  assert.doesNotMatch(homeFn, /\d+\s*nests/i);
  assert.doesNotMatch(homeFn, /vacanc/i);
  assert.doesNotMatch(homeFn, /open roles/i);
  assert.doesNotMatch(homeFn, /\bUPI\b|pay online|wallet/i);
  assert.doesNotMatch(homeFn, /₹\d{3,}/);
  assert.match(src, /pickingLang=!languageSticky\(\)&&!owner\.active/);
  assert.match(src, /function languageCard\(/);
});

test('homepage photos are only existing Live and oil assets', () => {
  assert.match(homeFn, /studio-bunk-lockers\.jpg/);
  assert.match(apple, /oils-editorial-sheet\.png/);
  assert.doesNotMatch(homeFn, /https:\/\//);
});

test('desktop overlay is full-bleed Apple chrome; phone cage stays under 760', () => {
  assert.match(html, /apple-desktop\.css/);
  assert.match(apple, /@media \(min-width: 761px\)/);
  assert.match(apple, /body\.mesha-dark main\{max-width:none/);
  assert.match(apple, /height:48px/);
  const hideNav = css.indexOf('body.mesha-dark #desktop-nav{display:none}');
  const cageMain = css.indexOf('body.mesha-dark main{max-width:430px');
  const mobileMq = css.lastIndexOf('@media (max-width: 760px)', hideNav);
  assert.ok(hideNav > mobileMq && cageMain > mobileMq);
});

test('#53 bag and guest-browse contracts still hold', () => {
  assert.match(src, /class="mesha-bag-layer"/);
  assert.match(src, /t\('Continue'/);
  assert.doesNotMatch(src, /t\('Review your bag'/);
  assert.match(src, /if\(!account\)\{checkoutPending=true;return checkoutSignIn\(\);\}/);
  assert.doesNotMatch(src, /function openBag\(\)\{[^}]*login\(\)/);
  assert.doesNotMatch(src, /if\(action==='add'\|\|action==='minus'\)\{[^}]*login\(\)/);
});
