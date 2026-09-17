import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const commerce = fs.readFileSync(new URL('../../commerce.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../commerce.css', import.meta.url), 'utf8');
const waves = fs.readFileSync(new URL('../../commerce-waves.js', import.meta.url), 'utf8');

test('photo tap opens a buy sheet with Add, not a photo-only dialog', () => {
  assert.match(commerce, /function showBuy\(/);
  assert.match(commerce, /if\(action==='detail'\)\{return showBuy\(id\);\}/);
  assert.match(commerce, /data-buy-id/);
  assert.match(commerce, /data-action="add"/);
  assert.match(commerce, /You keep/);
  assert.match(commerce, /Collect at Nia Nest Ompal/);
  assert.match(commerce, /Pay at pickup/);
  assert.doesNotMatch(commerce, /if\(action==='detail'\)[^;]*go\('home'\)/);
});

test('add from the buy sheet re-shows the sheet instead of leaving a stale photo dialog', () => {
  assert.match(commerce, /fromBuy/);
  assert.match(commerce, /if\(fromBuy\)return showBuy\(id\)/);
});

test('mesha-dark product dialog keeps dark ink on white so buy copy is visible', () => {
  assert.match(css, /body\.mesha-dark dialog:not\(\.mesha-checkout\)\{color:#161b24;background:#fff\}/);
  assert.doesNotMatch(css, /dialog\{[^}]*color:var\(--fg\)[^}]*background:#fff/);
});

test('pack/collect lines stamp product cards only, not category chips', () => {
  assert.match(waves, /querySelectorAll\('article\.product, \.mesha-save-card'\)/);
  assert.doesNotMatch(waves, /querySelectorAll\('\[data-id\], \.product, article\.product'\)/);
});

test('photo buy sheet does not flip payments on', () => {
  assert.doesNotMatch(commerce, /paymentsEnabled\s*=\s*true/);
});
