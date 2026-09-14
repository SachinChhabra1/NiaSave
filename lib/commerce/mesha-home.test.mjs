import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {languageOptions,validLanguage} from '../../commerce-i18n.js';

const src = fs.readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../commerce.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../../commerce.html', import.meta.url), 'utf8');
const homeFn = fs.readFileSync(new URL('./apple-home.snippet.js', import.meta.url), 'utf8');

test('offered languages are the Mesha set en/hi/bn/ta/kn', () => {
  assert.deepEqual(languageOptions.map(l => l.id), ['en', 'hi', 'bn', 'ta', 'kn']);
  assert.equal(validLanguage('bn'), true);
  assert.equal(validLanguage('mr'), false);
});

test('first land is a language card until nia-language is sticky', () => {
  assert.match(src, /function languageCard\(/);
  assert.match(src, /readStickyLanguage/);
  assert.match(src, /localStorage\.getItem\('nia-language'\)/);
  assert.match(src, /pickingLang=!languageSticky\(\)&&!owner\.active/);
  assert.match(html, /apple-desktop\.css/);
  assert.doesNotMatch(html, /localStorage\.setItem\('nia-language'/);
  assert.match(src, /First step/);
  assert.match(src, /Choose your language/);
  assert.match(src, /No sign-in yet\. Browse first\. Phone only when you check out\./);
  assert.match(src, /data-action="choose-lang"/);
  assert.match(src, /save\('nia-language',lang\)/);
  assert.match(src, /function languageChip\(/);
});

test('temptation home is Live unit, Save unit, then Earn/Send pair', () => {
  assert.match(src, /A bed near work\./);
  assert.match(src, /See Nest/);
  assert.match(src, /How it works/);
  assert.match(src, /class="mesha-rail"/);
  assert.match(src, /Extra shifts/);
  assert.doesNotMatch(src, /store-go-grid/);
  assert.doesNotMatch(src, /Near work\./);
  assert.match(homeFn, /A bed near work\./);
  assert.match(homeFn, /See Nest/);
  assert.match(homeFn, /apple-live-unit/);
  assert.match(homeFn, /apple-save-unit/);
  assert.match(homeFn, /Keep more\./);
  assert.doesNotMatch(homeFn, /store-go-grid/);
  assert.match(homeFn, /class="mesha-rail apple-pair"/);
  assert.doesNotMatch(homeFn, /\['shop','save'/);
  assert.match(homeFn, /Extra shifts/);
  assert.match(homeFn, /Money home\./);
});

test('guest chrome does not open OTP on paint; account is later', () => {
  assert.match(src, /\$\('#sign-label'\)\.dataset\.action='account'/);
  assert.doesNotMatch(src, /dataset\.action=owner\.active\|\|account\?'account':'login'/);
  assert.match(html, /data-action="account"/);
  assert.match(html, /data-action="home"/);
});

test('Mesha chrome uses existing Live and oil editorial photos', () => {
  assert.match(src, /studio-bunk-lockers\.jpg/);
  assert.match(homeFn, /studio-bunk-lockers\.jpg/);
  assert.match(css, /oils-editorial-sheet\.png/);
  assert.match(css, /body\.mesha-dark/);
  assert.match(css, /body\.mesha-lang-open/);
});
