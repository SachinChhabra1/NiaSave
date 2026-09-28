import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {dataLineFiles} from '../../tests/ui-clarity/data-lines.mjs';
import {root} from '../../tests/ui-clarity/scan.mjs';
import {homeDashboardMarkup} from '../../commerce-home.js';
import {
  FAMILY_PHOTO_KEY,
  readFamilyPhoto,
  storeFamilyPhoto,
  clearFamilyPhoto,
  markFamilyPhotoFailure,
  clearFamilyPhotoNotice,
  familyPhotoArt,
  familyPhotoCard
} from '../../commerce-books.js';

const PHOTO = /nia-family-photo|readFamilyPhoto|storeFamilyPhoto|clearFamilyPhoto|FAMILY_PHOTO_KEY/;

function memoryStorage(initial){
  const store = new Map(initial || []);
  return {
    getItem(key){return store.has(key) ? store.get(key) : null;},
    setItem(key, value){store.set(key, String(value));},
    removeItem(key){store.delete(key);},
    _store: store
  };
}

function canvasDocument(record){
  return {
    createElement(){
      const canvas = {
        width: 0,
        height: 0,
        getContext(){return {drawImage(){}};},
        toDataURL(type, quality){
          record.type = type;
          record.quality = quality;
          record.width = canvas.width;
          record.height = canvas.height;
          return 'data:image/jpeg;base64,abc';
        }
      };
      return canvas;
    }
  };
}

async function withRoom(run){
  const prev = {
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    createImageBitmap: globalThis.createImageBitmap,
    Image: globalThis.Image,
    URL: globalThis.URL
  };
  const had = {
    document: 'document' in globalThis,
    localStorage: 'localStorage' in globalThis,
    createImageBitmap: 'createImageBitmap' in globalThis,
    Image: 'Image' in globalThis,
    URL: 'URL' in globalThis
  };
  try{
    return await run();
  }finally{
    clearFamilyPhotoNotice();
    for(const key of Object.keys(prev)){
      if(had[key]) globalThis[key] = prev[key];
      else delete globalThis[key];
    }
  }
}

function callArgs(src){
  const sites = [];
  const re = /(?:^|[^\w$.])(api|fetch)\s*\(/g;
  let match;
  while((match = re.exec(src))){
    const open = match.index + match[0].length - 1;
    let depth = 0;
    let i = open;
    let quote = '';
    for(; i < src.length; i += 1){
      const char = src[i];
      if(quote){
        if(char === '\\'){i += 1; continue;}
        if(char === quote) quote = '';
        continue;
      }
      if(char === "'" || char === '"' || char === '`'){quote = char; continue;}
      if(char === '(') depth += 1;
      else if(char === ')'){
        depth -= 1;
        if(depth === 0){i += 1; break;}
      }
    }
    sites.push(src.slice(open, i));
  }
  return sites;
}

function photoLeaks(src){
  const leaks = [];
  const lines = src.split('\n');
  lines.forEach((line, index) => {
    if(PHOTO.test(line) && /(?:^|[^\w$.])(?:api|fetch)\s*\(/.test(line)) leaks.push('line ' + (index + 1) + ': ' + line.trim());
  });
  const names = new Set();
  for(const match of src.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:readFamilyPhoto|storeFamilyPhoto)\s*\(/g)) names.add(match[1]);
  for(const args of callArgs(src)){
    if(PHOTO.test(args)) leaks.push('call ' + args.slice(0, 180));
    for(const name of names){
      if(new RegExp('(?:^|[^\\w$])' + name + '(?:$|[^\\w$])').test(args)) leaks.push('value ' + name + ' in ' + args.slice(0, 180));
    }
  }
  return leaks;
}

test('family photo storage stays on the device and out of every request', async () => {
  await withRoom(async () => {
    const record = {};
    globalThis.document = canvasDocument(record);
    globalThis.localStorage = memoryStorage();
    globalThis.createImageBitmap = async () => ({width: 1800, height: 3200, close(){}});
    assert.equal(FAMILY_PHOTO_KEY, 'nia-family-photo');
    assert.equal(readFamilyPhoto(), '');
    globalThis.localStorage.setItem(FAMILY_PHOTO_KEY, 'hello');
    assert.equal(readFamilyPhoto(), '');
    globalThis.localStorage.setItem(FAMILY_PHOTO_KEY, '"data:image/jpeg;base64,x"');
    assert.equal(readFamilyPhoto(), '');
    globalThis.localStorage.setItem(FAMILY_PHOTO_KEY, 'data:image/png;base64,x');
    assert.equal(readFamilyPhoto(), 'data:image/png;base64,x');
    clearFamilyPhoto();
    assert.equal(readFamilyPhoto(), '');

    await assert.rejects(() => storeFamilyPhoto({type: 'application/pdf', size: 1200}), /not-image/);
    await assert.rejects(() => storeFamilyPhoto({type: 'image/jpeg', size: 25 * 1024 * 1024}), /too-large/);
    await assert.rejects(() => storeFamilyPhoto({type: 'image/jpeg', size: 20 * 1024 * 1024 + 1}), /too-large/);
    assert.equal(readFamilyPhoto(), '');

    const saved = await storeFamilyPhoto({type: 'image/jpeg', size: 20 * 1024 * 1024});
    assert.equal(saved, 'data:image/jpeg;base64,abc');
    assert.equal(readFamilyPhoto(), saved);
    assert.equal(record.type, 'image/jpeg');
    assert.equal(record.quality, 0.82);
    assert.equal(record.width, 506);
    assert.equal(record.height, 900);

    globalThis.localStorage.setItem = () => {throw new Error('quota');};
    await assert.rejects(() => storeFamilyPhoto({type: 'image/jpeg', size: 40}), /storage/);

    globalThis.localStorage.getItem = () => {throw new Error('blocked');};
    assert.equal(readFamilyPhoto(), '');
    globalThis.localStorage.removeItem = () => {throw new Error('blocked');};
    assert.doesNotThrow(() => clearFamilyPhoto());

    delete globalThis.createImageBitmap;
    const revoked = [];
    globalThis.URL = {
      createObjectURL(){return 'blob:local';},
      revokeObjectURL(url){revoked.push(url);}
    };
    globalThis.Image = class {
      set src(value){
        this._src = value;
        queueMicrotask(() => this.onload());
      }
      get naturalWidth(){return 100;}
      get naturalHeight(){return 400;}
    };
    globalThis.localStorage = memoryStorage();
    const fallback = await storeFamilyPhoto({type: 'image/png', size: 80});
    assert.equal(fallback, 'data:image/jpeg;base64,abc');
    assert.deepEqual(revoked, ['blob:local']);
    assert.equal(record.width, 225);
    assert.equal(record.height, 900);
  });
});

test('the family photo card and the home tile never upload the picture', () => {
  const t = value => value;
  const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const icon = name => `<svg class="icon" data-icon="${name}"></svg>`;
  const emptyArt = familyPhotoArt({photo: '', t, esc});
  assert.match(emptyArt, /Add your family photo/);
  assert.match(emptyArt, /family-photo-camera/);
  assert.doesNotMatch(emptyArt, /<input|data-family-photo|send-purpose-family|<button/);
  const photo = 'data:image/jpeg;base64,abc';
  const filledArt = familyPhotoArt({photo, t, esc});
  assert.match(filledArt, /src="data:image\/jpeg;base64,abc"/);
  assert.match(filledArt, /Your family photo/);
  assert.doesNotMatch(filledArt, /<input|<button/);

  clearFamilyPhotoNotice();
  const emptyCard = familyPhotoCard({photo: '', t, esc, icon});
  assert.match(emptyCard, /<h2>Your family<\/h2>/);
  assert.match(emptyCard, /type="file"/);
  assert.match(emptyCard, /accept="image\/\*"/);
  assert.match(emptyCard, /class="visually-hidden"/);
  assert.match(emptyCard, /data-family-photo/);
  assert.doesNotMatch(emptyCard, /capture=/);
  assert.match(emptyCard, /This photo stays on this phone\. Nia never sees it\./);
  assert.doesNotMatch(emptyCard, /data-family-photo-remove|data-action/);
  markFamilyPhotoFailure();
  const failed = familyPhotoCard({photo: '', t, esc, icon});
  assert.match(failed, /This photo could not be added\. Try another photo\./);
  assert.doesNotMatch(failed, /src="data:image/);
  const kept = familyPhotoCard({photo, t, esc, icon});
  assert.match(kept, /src="data:image\/jpeg;base64,abc"/);
  assert.match(kept, /data-family-photo-remove/);
  assert.match(kept, /Change photo/);
  assert.match(kept, /Remove photo/);
  assert.match(kept, /data-icon="pencil"/);
  assert.doesNotMatch(kept, /data-action/);
  assert.doesNotMatch(kept, /capture=/);
  clearFamilyPhotoNotice();

  const home = homeDashboardMarkup({stay: {state: 'empty'}, job: {state: 'empty'}, fee: {state: 'empty'}, tiles: {}, shopPrice: null}, {t, esc, icon});
  assert.match(home, /Add your family photo/);
  assert.match(home, /home-tile-send/);
  assert.match(home, /data-action="send"/);
  assert.match(home, /\/assets\/home-rice\.jpg/);
  assert.match(home, /\/assets\/studio-bunk-lockers\.jpg/);
  assert.match(home, /\/assets\/earn\.jpg/);
  assert.doesNotMatch(home, /send-purpose-family/);
  assert.doesNotMatch(home, /<input|data-family-photo-remove/);

  const commerce = fs.readFileSync(path.join(root, 'commerce.js'), 'utf8');
  const send = commerce.slice(commerce.indexOf('function sendView('), commerce.indexOf('async function loadNests'));
  const example = commerce.slice(commerce.indexOf('function sendExample('), commerce.indexOf('function earnView('));
  assert.ok(send.indexOf('</header>') < send.indexOf('familyPhotoCard('));
  assert.ok(send.indexOf('familyPhotoCard(') < send.indexOf('pillar-state'));
  assert.doesNotMatch(example, /<img/);
  assert.match(example, /Money earned/);
  assert.match(example, /Money spent/);
  assert.match(example, /Sent home/);
  assert.match(example, /Money left/);
  assert.match(example, /Example/);
  assert.match(example, /In one month/);
  const listeners = commerce.split('\n').filter(line => line.includes('data-family-photo'));
  assert.equal(listeners.length, 2);
  assert.match(listeners[0], /^document\.addEventListener\('change'/);
  assert.match(listeners[1], /^document\.addEventListener\('click'/);
  const css = fs.readFileSync(path.join(root, 'commerce.css'), 'utf8');
  assert.match(css, /\.home-tile-send img\{object-position:center 25%\}/);
  assert.match(css, /font-size:14px!important/);
  assert.match(css, /#EEF3F8/);
  assert.match(css, /#6A8CAE/);
  assert.match(css, /min-height:48px/);
  const build = fs.readFileSync(path.join(root, 'vercel-build.sh'), 'utf8');
  assert.match(build, /\bcommerce-books\.js\b/);
  assert.equal(fs.existsSync(path.join(root, 'commerce-family-photo.js')), false);
});

test('the family photo value never reaches a request body or a URL', () => {
  const leaks = [];
  for(const name of dataLineFiles()){
    if(!name.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(root, name), 'utf8');
    for(const leak of photoLeaks(src)) leaks.push(name + ' ' + leak);
  }
  assert.deepEqual(leaks, []);
});

test('a planted send of the family photo is the leak this guard catches', () => {
  const planted = "await api('/books',{photo:readFamilyPhoto()});";
  const leaks = photoLeaks(planted);
  assert.ok(leaks.length > 0);
  const across = photoLeaks("const shot = readFamilyPhoto();\nfetch('/upload?p=' + shot);");
  assert.ok(across.some(leak => leak.includes('shot')));
});
