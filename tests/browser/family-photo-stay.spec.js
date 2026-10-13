import {test, expect} from '@playwright/test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import hi from '../../commerce-locales/hi.js';
import ta from '../../commerce-locales/ta.js';
import bn from '../../commerce-locales/bn.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const KEY = 'This photo stays on this phone. Nia never sees it.';
const LINES = {
  en: KEY,
  hi: hi[KEY],
  ta: ta[KEY],
  bn: bn[KEY]
};
const FIRST_PHOTO = path.join(repoRoot, 'assets/home-rice.jpg');
const NEXT_PHOTO = path.join(repoRoot, 'assets/earn.jpg');

async function openSend(page, lang) {
  await page.setViewportSize({width: 390, height: 900});
  await page.addInitScript(language => {
    localStorage.setItem('nia-language', JSON.stringify(language));
  }, lang);
  await page.route('**/api/commerce/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pathname.endsWith('/catalogue')
        ? {products: [], locations: [], account: null, asOf: new Date().toISOString()}
        : {})
    });
  });
  await page.route('**/*openstreetmap.org/**', route => route.abort());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#send');
  // The catalogue response re-renders Send. Wait until that render has settled
  // so the file input is not replaced while a photo is being chosen.
  await expect(page.locator('#sync-state')).toHaveAttribute('data-state', 'synced');
  await expect(page.locator('.family-photo-card')).toBeVisible();
  return errors;
}

// Visible means painted on the 390px screen: a real box, ink, and a place under the picture.
async function paintedStay(page, text, {underPhoto}) {
  const line = page.locator('.family-photo-card .family-photo-stay');
  await expect(line).toHaveCount(1);
  await line.scrollIntoViewIfNeeded();
  await expect(line).toBeVisible();
  await expect(line).toHaveText(text);
  const facts = await line.evaluate(el => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const color = style.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
    const card = el.closest('.family-photo-card').getBoundingClientRect();
    const picture = el.closest('.family-photo-card').querySelector('.family-photo-picture').getBoundingClientRect();
    const actions = el.closest('.family-photo-card').querySelector('.family-photo-actions');
    const image = el.closest('.family-photo-card').querySelector('.family-photo-img');
    return {
      display: style.display,
      visibility: style.visibility,
      opacity: Number(style.opacity),
      fontSize: parseFloat(style.fontSize),
      colorAlpha: color ? Number(color[4] ?? 1) : 0,
      rgb: color ? [Number(color[1]), Number(color[2]), Number(color[3])] : [255, 255, 255],
      width: rect.width,
      height: rect.height,
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      pictureBottom: picture.bottom,
      imageBottom: image ? image.getBoundingClientRect().bottom : null,
      actionsBottom: actions ? actions.getBoundingClientRect().bottom : null,
      insideCard: rect.top >= card.top - 1 && rect.bottom <= card.bottom + 1
    };
  });
  const viewport = page.viewportSize();
  expect(facts.display).not.toBe('none');
  expect(facts.visibility).toBe('visible');
  expect(facts.opacity).toBeGreaterThan(0);
  expect(facts.colorAlpha).toBeGreaterThan(0.5);
  expect(facts.rgb).not.toEqual([255, 255, 255]);
  expect(facts.width).toBeGreaterThan(40);
  expect(facts.height).toBeGreaterThan(10);
  expect(facts.insideCard).toBe(true);
  expect(facts.top).toBeGreaterThanOrEqual(0);
  expect(facts.bottom).toBeLessThanOrEqual(viewport.height + 1);
  expect(facts.left).toBeGreaterThanOrEqual(0);
  expect(facts.right).toBeLessThanOrEqual(viewport.width + 1);
  expect(facts.top).toBeGreaterThanOrEqual(facts.pictureBottom - 1);
  if (underPhoto) {
    expect(facts.imageBottom).not.toBeNull();
    expect(facts.actionsBottom).not.toBeNull();
    expect(facts.top).toBeGreaterThanOrEqual(facts.imageBottom - 1);
    expect(facts.top).toBeGreaterThanOrEqual(facts.actionsBottom - 1);
  }
  return facts;
}

async function addPhoto(page, file) {
  await page.locator('.family-photo-card input[data-family-photo]').setInputFiles(file);
  await expect(page.locator('.family-photo-card .family-photo-img')).toBeVisible();
}

async function shot(page, lang, state) {
  if (process.env.A15_SHOTS !== '1' || (lang !== 'en' && lang !== 'hi')) return;
  const file = path.join(repoRoot, 'docs/ui-clarity/pc-screens', `a15-${state}-${lang}-390.png`);
  await page.locator('.family-photo-card').scrollIntoViewIfNeeded();
  await page.locator('.family-photo-card').screenshot({path: file});
}

for (const lang of ['en', 'hi', 'ta', 'bn']) {
  test(`empty family card shows the privacy line in ${lang}`, async ({page}) => {
    const errors = await openSend(page, lang);
    await expect(page.locator('.family-photo-img')).toHaveCount(0);
    const facts = await paintedStay(page, LINES[lang], {underPhoto: false});
    expect(facts.fontSize).toBeGreaterThanOrEqual(14);
    await shot(page, lang, 'empty');
    expect(errors).toEqual([]);
  });

  test(`added family photo keeps the privacy line under the photo in ${lang}`, async ({page}) => {
    const errors = await openSend(page, lang);
    await addPhoto(page, FIRST_PHOTO);
    const src = await page.locator('.family-photo-card .family-photo-img').getAttribute('src');
    expect(src.startsWith('data:image/jpeg')).toBe(true);
    const facts = await paintedStay(page, LINES[lang], {underPhoto: true});
    expect(facts.fontSize).toBeGreaterThanOrEqual(14);
    await shot(page, lang, 'photo');
    expect(errors).toEqual([]);
  });

  test(`changed family photo keeps the privacy line under the photo in ${lang}`, async ({page}) => {
    const errors = await openSend(page, lang);
    await addPhoto(page, FIRST_PHOTO);
    const first = await page.locator('.family-photo-card .family-photo-img').getAttribute('src');
    await addPhoto(page, NEXT_PHOTO);
    await expect.poll(() => page.locator('.family-photo-card .family-photo-img').getAttribute('src')).not.toBe(first);
    const next = await page.locator('.family-photo-card .family-photo-img').getAttribute('src');
    expect(next.startsWith('data:image/jpeg')).toBe(true);
    expect(next).not.toBe(first);
    const facts = await paintedStay(page, LINES[lang], {underPhoto: true});
    expect(facts.fontSize).toBeGreaterThanOrEqual(14);
    await shot(page, lang, 'changed');
    expect(errors).toEqual([]);
  });
}
