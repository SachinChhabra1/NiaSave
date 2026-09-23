import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteFromCentral} from './central-quote.mjs';

const now=Date.parse('2026-09-23T12:00:00Z');
const asOf=new Date(now-1000).toISOString();
const loc={siteCode:'s1',locationId:'S01',name:'Central studio',address:'Verified address',
  modes:['pickup'],windowStartAt:'2026-09-23T03:30:00Z',windowEndAt:'2026-09-23T12:30:00Z',
  serviceRevision:3,windowOpen:true,reserveMinutes:45};
const item={sku:'oil',siteCode:'s1',productId:'oil-1',name:'Oil',pack:'1 L',pricePaise:12500,
  available:2,revision:4,modes:['pickup']};
const quote={siteCode:'s1',mode:'pickup',lines:[{sku:'oil',productId:'oil-1',name:'Oil',
  pack:'1 L',qty:1,pricePaise:12500,revision:4}],totalPaise:12500,
  quotedAt:new Date(now).toISOString(),quoteExpiresAt:new Date(now+60000).toISOString(),
  reservationExpiresAt:new Date(now+120000).toISOString()};

test('quote forwards chosen identifiers and shows only Central money and expiry',async()=>{
  const calls=[];
  const central={centralMemberRequest:async(kind,subject,body)=>{
    calls.push([kind,subject,body]);
    return {status:200,body:kind==='save.locations'?
      {locations:[loc],asOf,freshnessSeconds:60,pilotOpen:false}:kind==='save.catalogue'?
      {siteCode:'s1',site:{siteCode:'s1',serviceRevision:3},items:[item],asOf,
        freshnessSeconds:60,pilotOpen:false}:{quote}};
  }};
  const result=await quoteFromCentral(central,'member-1',
    {locationId:'S01',fulfillment:'pickup',lines:[{id:'oil-1',qty:1}]},now);
  assert.equal(result.status,200);
  assert.deepEqual(calls[2],["save.quote",'member-1',
    {siteCode:'s1',mode:'pickup',lines:[{sku:'oil',qty:1}]}]);
  assert.deepEqual([result.body.amount,result.body.expiresAt,result.body.fingerprint],
    [125,quote.reservationExpiresAt,JSON.stringify(quote)]);
});

test('mismatched service revision cannot be projected into a quote',async()=>{
  const central={centralMemberRequest:async kind=>({status:200,body:kind==='save.locations'?
    {locations:[loc],asOf,freshnessSeconds:60,pilotOpen:false}:
    {siteCode:'s1',site:{siteCode:'s1',serviceRevision:4},items:[item],asOf,
      freshnessSeconds:60,pilotOpen:false}})};
  await assert.rejects(quoteFromCentral(central,'member-1',
    {locationId:'S01',fulfillment:'pickup',lines:[{id:'oil-1',qty:1}]},now),/central_save_stale/);
});
