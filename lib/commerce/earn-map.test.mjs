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
test('job labels escape company/role, preserve pay basis and do not invent CTC or live fares',async()=>{
 const {mapJobDetails,jobTravel}=await import('../../commerce-earn-map.js');
 const j={employer:'<img src=x>',title:'<script>role</script>',payMin:15000,payMax:17000,payPeriod:'month',distanceKm:.4,preview:false};
 const html=mapJobDetails(j,0,{id:'home'},x=>x);assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.match(html,/CTC not confirmed/);assert.match(html,/Return fare awaiting route estimate/);assert.equal(jobTravel(j,{id:'home'},now),null);
 const demo={...j,preview:true,employer:'Demo \u00b7 Example'};assert.equal(jobTravel(demo,{id:'home'},now).max,0);assert.equal(jobTravel({...demo,distanceKm:2},{id:'home'},now).max,50);
});
test('live commute estimate must match residence and job revision, with a current verified route',async()=>{
 const {jobTravel}=await import('../../commerce-earn-map.js');
 const c={studioId:'home',jobRevision:'rev1',mode:'bus',returnMin:24,returnMax:36,asOf:new Date(now-1000).toISOString(),validUntil:new Date(now+60000).toISOString(),source:'Operator checked route 1',routeVerified:true};
 const j={preview:false,revision:'rev1',commute:c};assert.equal(jobTravel(j,{id:'home'},now).min,24);
 for(const change of [{studioId:'other'},{jobRevision:'old'},{routeVerified:false},{returnMin:-1},{returnMax:0},{asOf:new Date(now-86400001).toISOString()},{validUntil:new Date(now-1).toISOString()}])assert.equal(jobTravel({...j,commute:{...c,...change}},{id:'home'},now),null);
});
