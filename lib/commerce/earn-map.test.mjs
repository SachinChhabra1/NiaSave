import test from 'node:test';
import assert from 'node:assert/strict';
import { mapModel, verifiedPoint, distanceKm, mapMarkup } from '../../commerce-earn-map.js';
const now=Date.parse('2026-09-08T12:00:00Z');
const point={lat:12.92,lng:77.62,verified:true};
const job=(id,overrides={})=>({id,mandateStatus:'open',openPositions:2,closesAt:new Date(now+86400000).toISOString(),workplace:{...point,lat:13.01},...overrides});
const source=jobs=>({map:{status:'ready',asOf:new Date(now).toISOString(),studio:{...point,name:'Test Nest'}},jobs});
test('map never interprets absent, stale or unverified location data as zero jobs',()=>{
 assert.equal(mapModel({jobs:[]},now).status,'unavailable');
 assert.equal(mapModel({...source([]),map:{...source([]).map,asOf:new Date(now-300001).toISOString()}},now).status,'stale');
 assert.equal(mapModel({...source([]),map:{...source([]).map,studio:{...point,verified:false}}},now).status,'studio_missing');
 assert.equal(mapModel(source([]),now).status,'ready');
});
test('map rejects missing/string/out-of-range coordinates, without converting missing to zero',()=>{
 for(const p of [null,{}, {...point,lat:null},{...point,lat:'12.92'},{...point,lng:181},{...point,lat:86}])assert.equal(verifiedPoint(p),false);
 assert.equal(verifiedPoint({...point,lat:0,lng:0}),true);
 assert.equal(distanceKm(point,point),0);
 assert.ok(Math.abs(distanceKm({lat:0,lng:0},{lat:0,lng:1})-111.195)<0.01);
});
test('map includes only open unexpired mandates with verified workplaces and sorts by distance',()=>{
 const data=source([job('far'),job('close',{workplace:{...point,lat:12.93}}),job('filled',{openPositions:0}),job('closed',{mandateStatus:'closed'}),job('expired',{closesAt:new Date(now-1).toISOString()}),job('unverified',{workplace:{...point,verified:false}})]);
 assert.deepEqual(mapModel(data,now).jobs.map(j=>j.id),['close','far']);
});
test('studio names are escaped in the map header',()=>{
 const model=mapModel(source([]),now);model.studio.name='<img src=x onerror=alert(1)>';
 const html=mapMarkup(model,a=>a,()=>'<svg></svg>');assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));
});
