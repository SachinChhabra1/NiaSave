import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function rulesFrom(css) {
  const rules = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const selector = css.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth += 1;
      else if (css[j] === '}') depth -= 1;
      j += 1;
    }
    const body = css.slice(open + 1, j - 1);
    if (selector.startsWith('@')) rules.push(...rulesFrom(body));
    else if (selector) rules.push({selector, body});
    i = j;
  }
  return rules;
}

function splitSelectors(selector) {
  const parts = [];
  let current = '';
  let depth = 0;
  for (const char of selector) {
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function subject(selector) {
  let depth = 0;
  let last = '';
  let current = '';
  for (const char of selector) {
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    if (depth === 0 && ' >+~'.includes(char)) {
      if (current.trim()) last = current.trim();
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) last = current.trim();
  return last;
}

function subjectHasClass(selectorSubject, className) {
  return selectorSubject.split(/[:[]/)[0].split('.').includes(className);
}

function cascaded(css, className) {
  const decls = {};
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const rule of rulesFrom(clean)) {
    for (const selector of splitSelectors(rule.selector)) {
      if (!subjectHasClass(subject(selector), className)) continue;
      for (const part of rule.body.split(';')) {
        const idx = part.indexOf(':');
        if (idx < 0) continue;
        const prop = part.slice(0, idx).trim().toLowerCase();
        const value = part.slice(idx + 1).trim().replace(/\s*!important\s*$/i, '').trim().toLowerCase();
        if (prop) decls[prop] = value;
      }
    }
  }
  return decls;
}

function splitTracks(columns) {
  const tracks = [];
  let current = '';
  let depth = 0;
  for (const char of columns) {
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ' ' && depth === 0) {
      if (current.trim()) tracks.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) tracks.push(current.trim());
  return tracks;
}

function trackCount(columns) {
  let count = 0;
  for (const track of splitTracks(columns)) {
    const repeat = track.match(/^repeat\(\s*(\d+)/);
    count += repeat ? Number(repeat[1]) : 1;
  }
  return count;
}

function cascadedImg(css, ancestorClass) {
  const decls = {};
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const rule of rulesFrom(clean)) {
    for (const selector of splitSelectors(rule.selector)) {
      if (!/^img\b/.test(subject(selector))) continue;
      if (!selector.includes('.' + ancestorClass)) continue;
      for (const part of rule.body.split(';')) {
        const idx = part.indexOf(':');
        if (idx < 0) continue;
        const prop = part.slice(0, idx).trim().toLowerCase();
        const value = part.slice(idx + 1).trim().replace(/\s*!important\s*$/i, '').trim().toLowerCase();
        if (prop) decls[prop] = value;
      }
    }
  }
  return decls;
}

test('a Shop category photo is not capped below the card width', () => {
  const css = fs.readFileSync(path.join(root, 'commerce-shell.css'), 'utf8');
  const photo = cascaded(css, 'shop-category-photo');
  const card = cascaded(css, 'shop-category');
  assert.equal(photo.width, '100%', 'photo width ' + photo.width);
  assert.equal((photo['aspect-ratio'] || '').replace(/\s/g, ''), '1/1');
  assert.ok(!photo['max-height'] || photo['max-height'] === 'none', 'max-height caps the square photo below the card: ' + photo['max-height']);
  assert.ok(!photo['max-width'] || photo['max-width'] === 'none' || photo['max-width'] === '100%', 'max-width caps the photo below the card: ' + photo['max-width']);
  assert.ok(!photo.width.endsWith('px'), 'photo width is a fixed cap: ' + photo.width);
  assert.ok(card.padding === '0' || card.padding === '0px', 'card padding insets the photo: ' + card.padding);
});

test('an aisle photo is as wide as its card', () => {
  const css = fs.readFileSync(path.join(root, 'commerce-shell.css'), 'utf8');
  const photo = cascaded(css, 'shop-item-photo');
  const card = cascaded(css, 'shop-item');
  const detail = cascaded(css, 'shop-item-detail');
  const img = cascadedImg(css, 'shop-item-photo');
  assert.equal(photo.width, '100%', 'photo width ' + photo.width);
  assert.ok(!/px/.test(photo.width || ''), 'photo width is a fixed cap: ' + photo.width);
  assert.ok(!photo['max-width'] || photo['max-width'] === 'none' || photo['max-width'] === '100%', 'max-width caps the aisle photo below the card: ' + photo['max-width']);
  assert.ok(!photo.padding || photo.padding === '0' || photo.padding === '0px', 'photo padding insets the picture: ' + photo.padding);
  assert.equal((photo['aspect-ratio'] || '').replace(/\s/g, ''), '4/3');
  assert.equal(img['object-fit'], 'cover');
  const columns = card['grid-template-columns'] || '';
  const span = (photo['grid-column'] || '').replace(/\s/g, '');
  const spansCard = span === '1/-1';
  if (!spansCard) {
    assert.ok(trackCount(columns) <= 1, 'aisle photo is in a column narrower than the card: ' + columns);
    assert.ok(!splitTracks(columns).some(track => /\d+(\.\d+)?px/.test(track)), 'aisle photo track is a fixed width narrower than the card: ' + columns);
  }
  assert.ok(card.padding === '0' || card.padding === '0px', 'card padding insets the photo: ' + card.padding);
  assert.equal(card.overflow, 'hidden');
  assert.equal(card['border-radius'], '16px');
  assert.equal(detail.padding, '12px');
});

test('every Earn step renders with a picture', () => {
  const src = fs.readFileSync(path.join(root, 'commerce.js'), 'utf8');
  const start = src.indexOf('function earnHow()');
  const end = src.indexOf('function sendExample(', start);
  assert.ok(start >= 0 && end > start);
  const fn = src.slice(start, end);
  assert.equal(fn.includes('src?'), false, 'a step can skip its picture');
  assert.doesNotMatch(fn, /\$\{index\+1\}\.\s/);
  const steps = [...fn.matchAll(/\[t\('([^']*)'\),'([^']*)'/g)];
  assert.deepEqual(steps.map(step => [step[1], step[2]]), [
    ['Stay in a safe place near work', '/assets/nest-chk-demo.jpg'],
    ['See work near where you stay', '/assets/earn.jpg'],
    ['Walk to work', '/assets/earn-gigs-editorial-v4.jpg']
  ]);
  for (const [, words, picture] of steps) {
    assert.ok(picture.startsWith('/assets/') && picture.endsWith('.jpg'), words + ' renders without a picture');
    assert.equal(fs.existsSync(path.join(root, picture.slice(1))), true, picture);
  }
  assert.equal((fn.match(/<img\b/g) || []).length, 1);
});

test('Earn step caption stays 16px on the three-size scale', () => {
  const css = fs.readFileSync(path.join(root, 'commerce-shell.css'), 'utf8');
  const sizes = [...css.matchAll(/\.earn-how-line\{[^}]*font-size:\s*(\d+)px/g)].map(match => match[1]);
  assert.deepEqual(sizes, ['16', '16'], 'PRD section 4.2 says 17px; the founder kept 14, 16 and 24');
  const line = cascaded(css, 'earn-how-line');
  assert.equal(line['font-weight'], '600');
  assert.equal(line.color, '#101828');
  const spec = fs.readFileSync(path.join(root, 'tests/browser/ui-clarity.spec.js'), 'utf8');
  const lists = [...spec.matchAll(/if \(!(\[[^\]]+\])\.includes\(Math\.round\(fact\.size\)\)/g)].map(match => match[1]);
  assert.deepEqual(lists, ['[14, 16, 24]', '[14, 16, 24]', '[14, 16, 24]', '[14, 16, 24]']);
});
