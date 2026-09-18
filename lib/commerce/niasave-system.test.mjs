import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {claimStateMarkup,viewStateMarkup,youKeepMarkup,CLAIM_STATES,VIEW_STATES} from '../../niasave-ui.js';

const css = fs.readFileSync(new URL('../../niasave-system.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../../commerce.html', import.meta.url), 'utf8');
const build = fs.readFileSync(new URL('../../vercel-build.sh', import.meta.url), 'utf8');

test('X0 tokens lock type, color, radius, touch, keep-green', () => {
  for (const token of ['--nia-ground-dark:#1d1d1f','--nia-ground-light:#f5f5f7','--nia-ink:#1d1d1f','--nia-accent:#0066cc','--nia-keep:#1B7A4A','--nia-radius:18px','--nia-touch:52px','--nia-type-body:17px']) {
    assert.match(css, new RegExp(token.replace(/[.#]/g,'\\$&')));
  }
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('X0 ships Call for help on every screen without a browser dialog', () => {
  assert.match(html, /niasave-system\.css/);
  assert.match(html, /class="nia-help"/);
  assert.match(html, /data-action="help"/);
  assert.match(html, /Call for help/);
  assert.doesNotMatch(html, /window\.alert|confirm\(/);
  assert.match(build, /niasave-system\.css/);
});

test('X0 seven view states and seven claim states render', () => {
  assert.equal(VIEW_STATES.length, 7);
  assert.equal(CLAIM_STATES.length, 7);
  for (const state of VIEW_STATES) {
    const htmlState = viewStateMarkup(state);
    assert.match(htmlState, new RegExp(`data-view="${state}"`));
    assert.doesNotMatch(htmlState, /spinner-only/);
  }
  assert.match(viewStateMarkup('loading'), /nia-skel/);
  for (const state of CLAIM_STATES) {
    assert.match(claimStateMarkup(state), new RegExp(`data-claim="${state}"`));
  }
  assert.match(claimStateMarkup('confirmed','₹ terms from Central'), /terms from Central/);
});

test('You keep is absent unless Central hands a reference', () => {
  assert.equal(youKeepMarkup(null), '');
  assert.equal(youKeepMarkup(''), '');
  assert.match(youKeepMarkup('₹75'), /You keep ₹75/);
});

test('X0 does not touch connector or env contracts', () => {
  const ui = fs.readFileSync(new URL('../../niasave-ui.js', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /CENTRAL_ORIGIN|CENTRAL_COMMERCE_KEY|EARN_SOURCE|EARN_MAX_AGE_MS/);
  assert.doesNotMatch(ui, /niasave-to-central-v1/);
  assert.doesNotMatch(css, /CENTRAL_ORIGIN/);
});
