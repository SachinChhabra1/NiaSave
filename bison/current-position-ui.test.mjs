import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const script=readFileSync(new URL('../bison.js',import.meta.url),'utf8');
function desk(page='control'){
  const nodes=Object.fromEntries(['topmeta','kpis','recon','page-status','control-studios','control-contracts','control-clocks','control-collections','control-nests'].map(id=>[id,{innerHTML:'',textContent:''}]));
  const requests=[];
  const book={asOf:'2026-09-09',kpis:{inHouse:4092,vacant:2051,capacity:6124,studios:82,reserved:1,activeContracts:4093,bookingsOpen:4093,pending:2200,unallocated:0,overdueClocks:82}};
  let source={source:'UI_Occupancy',status:'partial',kpis:{inHouse:6194,vacant:478,capacity:6719,studios:89},missing:{inHouse:1,vacant:1,capacity:0},reportingDates:['2026-09-08'],fetchedAt:'2026-09-09T12:00:00Z'},bookFails=false;
  const context=vm.createContext({console,URLSearchParams,Date,Promise,setInterval(){},location:{},document:{body:{getAttribute:()=>page},hidden:false,getElementById:id=>nodes[id]||null,addEventListener(){},querySelectorAll:()=>[]},fetch:async url=>{requests.push(url);const result=url.includes('current-position')?source:bookFails?null:book;return{ok:!!result,json:async()=>result||{error:'unavailable'}};}});
  vm.runInContext(script,context);
  return {nodes,requests,book,context,setSource:v=>source=v,failBook:()=>bookFails=true};
}
test('control maps only requested report metrics and keeps actual operational work counts',async()=>{
  const d=desk();await d.context.LOAD_RUNNING;
  assert.match(d.nodes.kpis.innerHTML,/6194/);assert.match(d.nodes.kpis.innerHTML,/478/);assert.match(d.nodes.kpis.innerHTML,/89/);
  assert.match(d.nodes.kpis.innerHTML,/4093/);assert.match(d.nodes.kpis.innerHTML,/2,200/);
  assert.equal(d.nodes['control-studios'].textContent,'82 studios →');
  assert.match(d.nodes.topmeta.innerHTML,/6719/);assert.match(d.nodes.recon.textContent,/Unknown counts are excluded/);
  assert.equal(d.book.kpis.inHouse,4092);
  d.setSource(null);await d.context.load();
  assert.doesNotMatch(d.nodes.kpis.innerHTML,/6194|4092|2051/);assert.match(d.nodes.kpis.innerHTML,/4093/);
  assert.match(d.nodes.recon.textContent,/UI_Occupancy unavailable/);
});
test('book outage cannot hide a successful sheet projection or invent zero contracts',async()=>{
  const d=desk();await d.context.LOAD_RUNNING;d.failBook();await d.context.load();
  assert.match(d.nodes.kpis.innerHTML,/6194/);assert.doesNotMatch(d.nodes.kpis.innerHTML,/4093/);
  assert.equal(d.nodes['control-contracts'].textContent,'— active →');
  assert.match(d.nodes.recon.textContent,/operational book unavailable/);
});
test('other Bison pages do not request the new reporting projection',async()=>{
  const d=desk('other');await d.context.LOAD_RUNNING;
  assert.deepEqual(d.requests,['/api/bison/tower?city=All']);assert.match(d.nodes.topmeta.innerHTML,/6124/);
});
