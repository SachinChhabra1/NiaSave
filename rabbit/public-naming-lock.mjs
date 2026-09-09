import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const livingPages = ['bison.html','bison-studios.html','bison-contracts.html','bison-clocks.html','bison-collections.html','bison-nests.html','bison-data.html'];
const units = [['/ops.html','Sikh Unit'],['/bison.html','Jat Unit'],['/tanot/','Dogra Unit'],['/desk.html','All units']];
for (const file of ['ops.html', ...livingPages]) {
 const html = read(file);
 for (const [path,label] of units) assert(html.includes(`href="${path}">${label}<`), `${file} must label ${label} on its existing route`);
 assert(!/\b(?:Bison|Polo|Tanot|Madras)\b/.test(html), `${file} contains a retired public name`);
}
assert(read('ops.html').includes('<title>Sikh Unit</title>'), 'Save title must be Sikh Unit');
assert(read('bison.html').includes('<title>Jat Unit · Control</title>'), 'Living title must be Jat Unit');
const desk=read('desk.html');
for(const name of ['Sikh Unit','Jat Unit','Dogra Unit','Assam Unit']) assert(desk.includes(`<strong>${name}</strong>`), `Para 2 must show ${name}`);
assert(!/\b(?:Bison|Polo|Tanot|Madras)\b/.test(desk),'Para 2 launcher contains a retired name');
assert(['polo','bison','tanot','madras'].every(id=>desk.includes(`data-id="${id}"`)),'Keep technical product IDs stable');
assert(read('tanot/index.html').includes('Dogra Unit'),'Enterprise demand must use Dogra Unit');
console.log('Para 2 naming contract passed: Sikh / Jat / Dogra / Assam');
