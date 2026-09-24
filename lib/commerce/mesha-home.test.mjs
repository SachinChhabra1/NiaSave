import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {languageOptions,validLanguage} from '../../commerce-i18n.js';

const src = fs.readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../commerce.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../../commerce.html', import.meta.url), 'utf8');
const homeFn = fs.readFileSync(new URL('./apple-home.snippet.js', import.meta.url), 'utf8');
const dashboard = fs.readFileSync(new URL('../../commerce-home.js', import.meta.url), 'utf8');

test('offered languages are English, Hindi, Tamil, Bengali', () => {
  assert.deepEqual(languageOptions.map(l => l.id), ['en', 'hi', 'ta', 'bn']);
  assert.equal(validLanguage('bn'), true);
  assert.equal(validLanguage('kn'), false);
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

test('home reads Central without an illustrative desire hero', () => {
  assert.match(homeFn,/homeDashboardModel/);
  assert.match(dashboard,/Needs attention/);
  assert.match(dashboard,/Stay and membership fee/);
  assert.match(dashboard,/Nearby job/);
  assert.doesNotMatch(homeFn,/A Nest near work/);
});
test('guest chrome does not open OTP on paint; account is later', () => {
  assert.match(src, /\$\('#sign-label'\)\.dataset\.action='account'/);
  assert.doesNotMatch(src, /dataset\.action=owner\.active\|\|account\?'account':'login'/);
  assert.match(html, /data-action="account"/);
  assert.match(html, /data-action="home"/);
});

test('member chrome keeps existing photo treatments outside the data-backed home', () => {
  assert.doesNotMatch(homeFn,/studio-bunk-lockers\.jpg/);
  assert.match(css,/oils-editorial-sheet\.png/);
  assert.match(css,/body\.mesha-dark/);
  assert.match(css,/body\.mesha-lang-open/);
});
