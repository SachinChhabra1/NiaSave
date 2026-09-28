import {test} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// The node commerce step does not install Playwright browsers. This check has to live here.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function sourceWindow(imgW, imgH, boxW, boxH, posY){
  const scale = Math.max(boxW / imgW, boxH / imgH);
  const offsetY = (boxH - imgH * scale) * posY;
  const start = (-offsetY / scale) / imgH;
  const end = start + (boxH / scale) / imgH;
  return {start, end};
}

function positionY(value){
  const parts = String(value).trim().split(/\s+/);
  const y = parts.length > 1 ? parts[1] : parts[0];
  if(y === 'top') return 0;
  if(y === 'center') return 0.5;
  if(y === 'bottom') return 1;
  if(String(y).endsWith('%')) return Number(String(y).slice(0, -1)) / 100;
  return 0.5;
}

test('a tall photo keeps its top band visible on Send and on Home', async ({browser}) => {
  const css = ['commerce.css', 'commerce-shell.css', 'niasave-system.css', 'apple-desktop.css', 'commerce-wave0.css', 'niasave-apple-store.css', 'commerce-waves.css']
    .map(name => fs.readFileSync(path.join(repoRoot, name), 'utf8')).join('\n').replace(/<\/style/gi, '<\\/style');
  const html = `<!doctype html><html><head><style>${css}</style></head>
<body class="mesha-dark"><div class="member-shell"><main id="content">
<section class="home-dashboard"><div class="home-tiles">
<button type="button" class="home-tile home-tile-send"><img class="family-photo-img" id="home-photo" alt=""></button>
<button type="button" class="home-tile"><img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></button>
</div></section>
<section class="store-screen store-send send-v2"><article class="family-photo-card"><div class="family-photo-picture">
<img class="family-photo-img" id="send-photo" alt="">
</div></article></section>
</main></div></body></html>`;
  const page = await browser.newPage({deviceScaleFactor: 1});
  const failures = [];
  try{
    for(const width of [390, 1280]){
      await page.setViewportSize({width, height: 900});
      await page.setContent(html, {waitUntil: 'load'});
      await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 1000;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0000ff';
        ctx.fillRect(0, 0, 400, 1000);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, 400, 50);
        const url = canvas.toDataURL('image/png');
        for(const img of document.querySelectorAll('#home-photo, #send-photo')) img.src = url;
      });
      await page.locator('#home-photo').evaluate(img => img.decode());
      await page.locator('#send-photo').evaluate(img => img.decode());
      for(const [label, selector] of [['Home tile', '#home-photo'], ['Send card', '#send-photo']]){
        const locator = page.locator(selector);
        await locator.scrollIntoViewIfNeeded();
        const box = await locator.boundingBox();
        const pos = await locator.evaluate(img => getComputedStyle(img).objectPosition);
        const y = positionY(pos);
        const window = sourceWindow(400, 1000, box.width, box.height, y);
        const shot = await page.screenshot({clip: {x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 24)}});
        const sample = await page.evaluate(async src => {
          const image = new Image();
          image.src = src;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0);
          const y = Math.min(6, canvas.height - 1);
          const row = ctx.getImageData(0, y, canvas.width, 1).data;
          let red = 0;
          for(let i = 0; i < row.length; i += 4){
            if(row[i] > 200 && row[i + 2] < 80) red += 1;
          }
          const mid = Math.floor(canvas.width / 2) * 4;
          return {red, rgb: [row[mid], row[mid + 1], row[mid + 2]], width: canvas.width, height: canvas.height};
        }, 'data:image/png;base64,' + shot.toString('base64'));
        const detail = `${label} at ${width}px is ${Math.round(box.width * 10) / 10}x${Math.round(box.height * 10) / 10}, object-position ${pos}, visible source ${(window.start * 100).toFixed(1)}% to ${(window.end * 100).toFixed(1)}%, top pixel rgb(${sample.rgb.join(',')})`;
        if(!(box.height < 500 && sample.red > 0 && window.start < 0.05)) failures.push(detail);
      }
    }
  }finally{
    await page.close();
  }
  assert.deepEqual(failures, [], 'top 5% band was cut:\n' + failures.join('\n'));
});
