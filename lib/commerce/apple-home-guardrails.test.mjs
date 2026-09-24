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
const dashboard = fs.readFileSync(new URL('../../commerce-home.js', import.meta.url), 'utf8');
const shellCss = fs.readFileSync(new URL('../../commerce-shell.css', import.meta.url), 'utf8');

const extractHome = from => {
  const a = from.indexOf('function entryHomepage');
  const b = from.indexOf('function render()');
  assert.ok(a >= 0 && b > a, 'entryHomepage must sit immediately before render()');
  return from.slice(a, b).trim();
};

test('the build splices one dashboard home source into commerce.js', () => {
  const a=src.indexOf('function entryHomepage'), b=src.indexOf('function render()');
  assert.ok(a>=0&&b>a);
  assert.equal(src.slice(a,b).trim(),homeFn.trim());
  assert.match(build,/node scripts\/splice-apple-home\.mjs/);
  assert.match(splice,/homeDashboardModel/);
  assert.equal((src.match(/function entryHomepage/g)||[]).length,1);
});
test('splice script runs cleanly against a tip-tree copy', () => {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'home-dashboard-splice-'));
  try{
    fs.mkdirSync(path.join(tmp,'scripts'),{recursive:true});
    fs.mkdirSync(path.join(tmp,'lib/commerce'),{recursive:true});
    fs.copyFileSync(new URL('../../commerce.js',import.meta.url),path.join(tmp,'commerce.js'));
    fs.copyFileSync(new URL('../../scripts/splice-apple-home.mjs',import.meta.url),path.join(tmp,'scripts/splice-apple-home.mjs'));
    fs.copyFileSync(new URL('./apple-home.snippet.js',import.meta.url),path.join(tmp,'lib/commerce/apple-home.snippet.js'));
    const stdout=execFileSync(process.execPath,['scripts/splice-apple-home.mjs'],{cwd:tmp,encoding:'utf8'});
    assert.match(stdout,/spliced Central-backed home dashboard/);
    assert.equal(extractHome(fs.readFileSync(path.join(tmp,'commerce.js'),'utf8')),homeFn.trim());
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('home has two attention cards and four LESS tiles at desktop width', () => {
  assert.match(dashboard,/home-attention-grid/);
  assert.match(dashboard,/home-tiles/);
  for(const route of ['live','earn','shop','send'])assert.match(dashboard,new RegExp("\\['"+route+"',t\\('"));
  assert.match(shellCss,/home-attention-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(shellCss,/home-tiles\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(homeFn,/studio-bunk-lockers\.jpg/);
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

test('home controls only navigate to existing LESS routes', () => {
  assert.match(dashboard,/data-action="\$\{action\}"/);
  assert.match(dashboard,/data-action="live"/);
  assert.match(dashboard,/const tiles=/);
  assert.doesNotMatch(homeFn,/https:\/\//);
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

test('home exposes state and no illustrative photo', () => {
  assert.match(dashboard,/role="status"/);
  assert.match(dashboard,/Membership fee details are not available from Central/);
  assert.doesNotMatch(dashboard,/studio-bunk-lockers\.jpg/);
});
test('#53 bag and guest-browse contracts still hold', () => {
  assert.match(src, /class="mesha-bag-layer"/);
  assert.match(src, /t\('Continue'/);
  assert.doesNotMatch(src, /t\('Review your bag'/);
  assert.match(src, /if\(!account\)\{checkoutPending=true;return checkoutSignIn\(\);\}/);
  assert.doesNotMatch(src, /function openBag\(\)\{[^}]*login\(\)/);
  assert.doesNotMatch(src, /if\(action==='add'\|\|action==='minus'\)\{[^}]*login\(\)/);
});
