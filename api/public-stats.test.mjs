import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicStatsHttp, safePublicStats } from './public-stats.mjs';
const payload = () => ({ studios: 12, capacity: null, occupiedBeds: 0, asOf: new Date().toISOString(), member: { name: 'must not escape' } });
function response() { return { headers: {}, setHeader(k,v) { this.headers[k] = v; }, end(body) { this.body = JSON.parse(body); } }; }
test('proxy uses Central only, timeout, aggregate allowlist and shared cache', async () => {
  const res = response();
  await publicStatsHttp({method:'GET'}, res, { env: {CENTRAL_ORIGIN:'https://central.example'}, fetchImpl: async (url, options) => {
    assert.equal(url.href, 'https://central.example/api/public-stats'); assert.ok(options.signal); assert.equal(options.redirect, 'error');
    return {ok:true,json:async()=>payload()};
  }});
  assert.equal(res.statusCode,200); assert.match(res.headers['Cache-Control'], /s-maxage=\d+/); assert.equal(res.body.member,undefined); assert.equal(res.body.occupiedBeds,0);
});
test('failure and stale readings cannot become numbers or a cached fallback', async () => {
  for (const fetchImpl of [async()=>{throw new Error();}, async()=>({ok:false}), async()=>({ok:true,json:async()=>({...payload(),asOf:'2000-01-01'})})]) {
    const res=response(); await publicStatsHttp({method:'GET'},res,{env:{CENTRAL_ORIGIN:'https://central.example'},fetchImpl});
    assert.equal(res.statusCode,503); assert.equal(res.headers['Cache-Control'],'no-store'); assert.deepEqual(res.body,{error:'stats_unavailable'});
  }
  assert.equal(safePublicStats({...payload(),studios:-1}).studios,null);
});
