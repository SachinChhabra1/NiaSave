import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {earnProjectionState} from '../../commerce-earn-map.js';
const now=Date.parse('2026-09-24T12:00:00Z');
const studio={id:'s',name:'Nest',lat:12,lng:77,verified:true};
const data=jobs=>({map:{status:'ready',asOf:new Date(now-1000).toISOString(),studio},jobs});
const job={id:'j',revision:'1',mandateStatus:'open',openPositions:1,closesAt:new Date(now+60000).toISOString(),workplace:{lat:12.1,lng:77.1,verified:true}};
test('seven honest Earn states follow Central freshness and verified locations',()=>{
  assert.equal(earnProjectionState({data:data([job]),now}),'ready');
  assert.equal(earnProjectionState({data:data([]),now}),'empty');
  assert.equal(earnProjectionState({data:data([job]),now,loading:true}),'loading');
  assert.equal(earnProjectionState({data:data([job]),now,error:'timeout'}),'unavailable');
  assert.equal(earnProjectionState({data:data([job]),now,online:false}),'offline');
  assert.equal(earnProjectionState({data:data([job]),now,signedOut:true}),'source_missing');
  assert.equal(earnProjectionState({data:{map:{status:'stale'},jobs:[]},now}),'stale');
  assert.equal(earnProjectionState({data:{map:{status:'studio_missing'},jobs:[]},now}),'source_missing');
});
test('Earn page labels straight-line distance and does not display unverified fallback jobs',()=>{
  const src=fs.readFileSync(new URL('../../commerce.js',import.meta.url),'utf8');
  const view=src.slice(src.indexOf('function earnView(){'),src.indexOf('async function reviewJob('));
  assert.match(view,/straight-line distance/);
  assert.match(view,/visible=projectionState==='ready'\?model\.jobs:\[\]/);
  assert.doesNotMatch(view,/cat\.preview && model\.status==='unavailable'/);
  for(const lang of ['hi','ta','bn']){
    const locale=fs.readFileSync(new URL('../../commerce-locales/'+lang+'.js',import.meta.url),'utf8');
    for(const key of ['Checking Central jobs','Verified open jobs near your Nest','Job projection is temporarily unavailable','No verified open jobs nearby'])
      assert.ok(locale.includes(JSON.stringify(key)),lang+': '+key);
  }
});
