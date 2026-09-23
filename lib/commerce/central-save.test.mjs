import test from 'node:test';
import assert from 'node:assert/strict';
import {presentCentralSave} from './central-save.mjs';

const now=Date.parse('2026-09-23T12:00:00Z');
const asOf=new Date(now-1000).toISOString();
const source={asOf,freshnessSeconds:60,pilotOpen:false,
  locations:[{siteCode:'s1',locationId:'S01',name:'Central studio',address:'Verified address',
    modes:['pickup'],windowStartAt:'2026-09-23T03:30:00.000Z',
    windowEndAt:'2026-09-23T12:30:00.000Z',windowOpen:true,
    serviceRevision:3,reserveMinutes:45}]};
const catalogue={asOf,freshnessSeconds:60,pilotOpen:false,siteCode:'s1',
  site:{siteCode:'s1',serviceRevision:3},items:[{sku:'oil',siteCode:'s1',productId:'oil-1',name:'Oil',pack:'1 L',
    pricePaise:12500,available:2,revision:4,modes:['pickup']}]};

test('member catalogue formats only Central verified prices, availability and window',()=>{
  const view=presentCentralSave(source,catalogue,now);
  assert.equal(view.products[0].pricePaise,12500);
  assert.equal(view.products[0].price,125);
  assert.equal(view.products[0].available,2);
  assert.equal(view.products[0].revision,4);
  assert.equal(view.locations[0].windowEnd,'2026-09-23T12:30:00.000Z');
  assert.equal(view.pilotOpen,false);
});
test('stale, mismatched or ambiguous Central snapshots fail closed',()=>{
  assert.throws(()=>presentCentralSave({...source,asOf:new Date(now-61000).toISOString()},catalogue,now),/central_save_stale/);
  assert.throws(()=>presentCentralSave(source,{...catalogue,siteCode:'other'},now),/central_save_stale/);
  assert.throws(()=>presentCentralSave(source,{...catalogue,site:{...catalogue.site,serviceRevision:4}},now),/central_save_stale/);
  assert.throws(()=>presentCentralSave({...source,locations:[...source.locations,...source.locations]},catalogue,now),/central_save_stale/);
  assert.throws(()=>presentCentralSave(source,{...catalogue,items:[{...catalogue.items[0],revision:0}]},now),/central_save_stale/);
});
test('no verified site is an empty browse state without a local offer',()=>{
  const view=presentCentralSave({...source,locations:[]},null,now);
  assert.deepEqual([view.ready,view.products.length,view.locations.length],[false,0,0]);
});
