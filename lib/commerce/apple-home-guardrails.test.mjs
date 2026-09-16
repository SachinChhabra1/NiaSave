import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const src = fs.readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../commerce.css', import.meta.url), 'utf8');
const apple = fs.readFileSync(new URL('../../apple-desktop.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../../commerce.html', import.meta.url), 'utf8');
const build = fs.readFileSync(new URL('../../vercel-build.sh', import.meta.url), 'utf8');
const splice = fs.readFileSync(new URL('../../scripts/splice-apple-home.mjs', import.meta.url), 'utf8');
const homeFn = fs.readFileSync(new URL('./apple-home.snippet.js', import.meta.url), 'utf8');

const extractHome = from => {
  const a = from.indexOf('function entryHomepage');
  const b = from.indexOf('function render()');
  assert.ok(a >= 0 && b > a, 'entryHomepage must sit immediately before render()');
  return from.slice(a, b).trim();
};

test('snippet splices into commerce.js and is the only homepage source', () => {
  const a = src.indexOf('function entryHomepage');
  const b = src.indexOf('function render()');
  assert.ok(a >= 0 && b > a, 'commerce.js must keep entryHomepage immediately before render()');
  const spliced = src.slice(0, a) + homeFn.trim() + '\n' + src.slice(b);
  assert.equal(extractHome(spliced), homeFn.trim());
  assert.match(build, /node scripts\/splice-apple-home\.mjs/);
  assert.match(splice, /exactly one Live apple-unit/);
  assert.match(splice, /apple-save-unit/);
  assert.match(splice, /forbidden/);
});

test('splice script runs cleanly against a tip-tree copy', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apple-home-splice-'));
  try {
    fs.mkdirSync(path.join(tmp, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'lib/commerce'), { recursive: true });
    fs.copyFileSync(new URL('../../commerce.js', import.meta.url), path.join(tmp, 'commerce.js'));
    fs.copyFileSync(new URL('../../scripts/splice-apple-home.mjs', import.meta.url), path.join(tmp, 'scripts/splice-apple-home.mjs'));
    fs.copyFileSync(new URL('./apple-home.snippet.js', import.meta.url), path.join(tmp, 'lib/commerce/apple-home.snippet.js'));

    const stdout = execFileSync(process.execPath, ['scripts/splice-apple-home.mjs'], { cwd: tmp, encoding: 'utf8' });
    assert.match(stdout, /spliced Apple home into commerce\.js/);
    const spliced = fs.readFileSync(path.join(tmp, 'commerce.js'), 'utf8');
    assert.match(spliced, /class="[^"]*\bapple-home\b[^"]*"/);
    assert.match(spliced, /class="[^"]*\bapple-unit\b[^"]*"/);
    assert.match(spliced, /class="[^"]*\bapple-rail\b[^"]*"/);
    assert.equal((spliced.match(/function entryHomepage/g) || []).length, 1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('homepage is one Live hero plus Earn/Save/Send secondary rail', () => {
  assert.match(homeFn, /class="mesha-home apple-home/);
  assert.match(homeFn, /class="mesha-desire apple-unit/);
  assert.equal((homeFn.match(/apple-unit/g) || []).length, 1);
  assert.doesNotMatch(homeFn, /apple-save-unit/);
  assert.doesNotMatch(homeFn, /store-go-grid/);
  assert.match(homeFn, /class="mesha-rail apple-rail/);
  assert.match(homeFn, /data-action="live"/);
  assert.match(homeFn, /data-action="how-live"/);
  assert.match(homeFn, /\['earn','earn'/);
  assert.match(homeFn, /\['shop','save'/);
  assert.match(homeFn, /\['send','send'/);
  assert.match(homeFn, /A Nest near work\./);
  assert.match(homeFn, /See Nest/);
  assert.match(homeFn, /Extra shifts/);
  assert.match(homeFn, /Shop less/);
  assert.match(homeFn, /Money home\./);
  assert.doesNotMatch(homeFn, /An upskilled job\./);
  assert.doesNotMatch(homeFn, /Shop at wholesale rates\./);
  assert.doesNotMatch(homeFn, /A bed near work\./);
  assert.match(homeFn, />\$\{t\('Live'\)\}</);
  assert.doesNotMatch(homeFn, />\$\{t\('Nia'\)\}</);
  assert.match(homeFn, /nia-home-card-copy/);
  assert.match(src, /pickingLang=!languageSticky\(\)&&!owner\.active/);
  assert.match(src, /function languageCard\(/);
});

test('homepage does not invent Nest counts, jobs, payments, or capital', () => {
  assert.doesNotMatch(homeFn, /\d+\s*nests/i);
  assert.doesNotMatch(homeFn, /vacanc/i);
  assert.doesNotMatch(homeFn, /open roles/i);
  assert.doesNotMatch(homeFn, /\bUPI\b|pay online|\bwallet\b/i);
  assert.doesNotMatch(homeFn, /₹\d{3,}/);
  assert.doesNotMatch(homeFn, /Series A|fundraise|OTP/i);
  assert.doesNotMatch(html, /localStorage\.setItem\('nia-language'/);
  assert.doesNotMatch(html, /nia-language',\s*'en'/);
});

test('homepage actions stay on the allowlist', () => {
  const actions = [...homeFn.matchAll(/data-action="([^"$]+)"/g)].map(m => m[1]);
  assert.deepEqual([...new Set(actions)].sort(), ['how-live', 'live']);
  assert.match(homeFn, /data-action="\$\{action\}"/);
});

test('homepage photos are only existing Live and oil assets', () => {
  assert.match(homeFn, /studio-bunk-lockers\.jpg/);
  assert.match(apple, /oils-editorial-sheet\.png/);
  assert.match(apple, /earn\.jpg/);
  assert.match(apple, /send\.jpg/);
  assert.doesNotMatch(homeFn, /https:\/\//);
  assert.doesNotMatch(homeFn, /niasave-apple-store-shots/);
});

test('desktop overlay is full-bleed Apple chrome; phone cage stays under 760', () => {
  assert.match(html, /apple-desktop\.css/);
  assert.match(build, /apple-desktop\.css/);
  assert.match(apple, /@media \(min-width: 761px\)/);
  assert.doesNotMatch(apple, /@media \(max-width:/);
  assert.match(apple, /body\.mesha-dark main\{max-width:none/);
  assert.match(apple, /height:48px/);
  const hideNav = css.indexOf('body.mesha-dark #desktop-nav{display:none}');
  const cageMain = css.indexOf('body.mesha-dark main{max-width:430px');
  const mobileMq = css.lastIndexOf('@media (max-width: 760px)', hideNav);
  assert.ok(hideNav > mobileMq && cageMain > mobileMq);
});

test('AX14 home hero copy is stacked off the photo; bunk is the product', () => {
  assert.match(homeFn, /nia-home-hero/);
  assert.match(homeFn, /nia-home-copy/);
  assert.match(apple, /\.nia-home-photo/);
  assert.match(apple, /object-fit:cover/);
  assert.match(apple, /object-position:12% 14%/);
  assert.match(apple, /order:-1/);
  assert.match(apple, /nia-home-hero\.mesha-desire:after\{display:none/);
  assert.match(apple, /background:#0B0B0C/);
  assert.doesNotMatch(apple, /max-width:160px/);
  assert.match(apple, /border-radius:24px/);
  assert.match(homeFn, /nia-home-card-copy/);
});

test('#53 bag and guest-browse contracts still hold', () => {
  assert.match(src, /class="mesha-bag-layer"/);
  assert.match(src, /t\('Continue'/);
  assert.doesNotMatch(src, /t\('Review your bag'/);
  assert.match(src, /if\(!account\)\{checkoutPending=true;return checkoutSignIn\(\);\}/);
  assert.doesNotMatch(src, /function openBag\(\)\{[^}]*login\(\)/);
  assert.doesNotMatch(src, /if\(action==='add'\|\|action==='minus'\)\{[^}]*login\(\)/);
});
