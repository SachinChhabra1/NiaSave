import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CSV_COLUMNS,parseInventoryCsv,receivedAmountPaise} from '../../save-inventory.js';
const row=['site-1','sku-1','product-1','Recorded item','1 pack','1250','0','2026-09-26T08:00:00Z','2026-09-26T08:00:00Z','true','0'];
const csv=(values=row)=>CSV_COLUMNS.join(',')+'\r\n'+values.join(',');
test('received rupees convert exactly to whole paise without rounding or blank zero',()=>{
  assert.equal(receivedAmountPaise('12.50'),1250);assert.equal(receivedAmountPaise('12.5'),1250);assert.equal(receivedAmountPaise('0'),0);
  for(const value of ['', '-1','12.501','1e2','9007199254740991'])assert.equal(receivedAmountPaise(value),null);
});
test('inventory CSV keeps zero, whole paise, revisions and quoted text without inventing rows',()=>{
  const values=[...row];values[3]='"Recorded, ""quoted"" item"';
  const [actual]=parseInventoryCsv('\uFEFF'+csv(values));
  assert.equal(actual.name,'Recorded, "quoted" item');assert.equal(actual.pricePaise,1250);assert.equal(actual.onHand,0);assert.equal(actual.expectedRevision,0);assert.equal(actual.active,true);
  values[9]='false';assert.equal(parseInventoryCsv(csv(values))[0].active,false);
});
test('inventory CSV rejects missing/duplicate columns, partial rows, blank numbers and invalid counts',()=>{
  for(const index of [5,6,10])for(const invalid of ['', '-1','1.5','9007199254740993']){
    const values=[...row];values[index]=invalid;assert.throws(()=>parseInventoryCsv(csv(values)),/CSV row 2/);
  }
  for(const invalid of ['TRUE','yes','1']){const values=[...row];values[9]=invalid;assert.throws(()=>parseInventoryCsv(csv(values)));}
  assert.throws(()=>parseInventoryCsv(CSV_COLUMNS.join(',')+'\n'+row.slice(0,-1).join(',')),/CSV row 2/);
  assert.throws(()=>parseInventoryCsv(CSV_COLUMNS.map((x,i)=>i===1?'siteCode':x).join(',')+'\n'+row.join(',')),/11 columns/);
  assert.throws(()=>parseInventoryCsv(csv().replace('countedAt','extra')),/11 columns/);
  assert.throws(()=>parseInventoryCsv(CSV_COLUMNS.join(',')),/between 1 and 100/);
});
test('inventory CSV validates quoting and bounded input',()=>{
  assert.throws(()=>parseInventoryCsv(csv().replace('Recorded item','"unfinished')),/unclosed/);
  assert.throws(()=>parseInventoryCsv(csv().replace('Recorded item','"item"extra')),/closing quote/);
  assert.throws(()=>parseInventoryCsv('x'.repeat(200001)),/200 KB/);
  assert.throws(()=>parseInventoryCsv(CSV_COLUMNS.join(',')+'\n'+Array(101).fill(row.join(',')).join('\n')),/100/);
});
test('new staff UI assets are packaged and use existing staff authentication without inline handlers',()=>{
  const html=readFileSync(new URL('../../save-inventory.html',import.meta.url),'utf8'),build=readFileSync(new URL('../../vercel-build.sh',import.meta.url),'utf8');
  assert.match(html,/src="\/staff.js"/);assert.match(html,/src="\/save-inventory.js"/);
  assert.doesNotMatch(html,/\son(?:click|submit|load)=|<script>/i);
  for(const asset of ['save-inventory.html','save-inventory.js','save-inventory.css'])assert.ok(build.includes(asset));
  assert.match(readFileSync(new URL('../../save-desk.html',import.meta.url),'utf8'),/href="\/save-inventory.html"/);
});
