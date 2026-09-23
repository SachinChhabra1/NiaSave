import test from 'node:test';
import assert from 'node:assert/strict';
import {reserveFromCentral,retryReserveStatus} from './central-reserve.mjs';

const order={orderId:'01234567-89ab-4cde-8fab-0123456789ab',pickupCode:'0123456789AB',
  siteCode:'s1',revision:1,status:'reserved',totalPaise:12500,
  lines:[{sku:'oil',productId:'oil-1',name:'Oil',pack:'1 L',qty:1,pricePaise:12500,revision:4}],
  location:{id:'S01',name:'Central site',address:'Verified address',
    windowStart:'2026-09-23T03:30:00Z',windowEnd:'2026-09-23T12:30:00Z'},
  reservedAt:'2026-09-23T10:00:00Z',expiresAt:'2026-09-23T10:45:00Z'};
const quote={siteCode:'s1',mode:'pickup',lines:order.lines,totalPaise:12500,
  quotedAt:'2026-09-23T09:59:00Z',quoteExpiresAt:'2026-09-23T10:01:00Z',
  reservationExpiresAt:order.expiresAt};
const body={locationId:'S01',fulfillment:'pickup',lines:[{id:'oil-1',qty:1}],
  fingerprint:JSON.stringify(quote)};
const key='reserve-key-000000001';

test('reserve forwards revision, exact quote and key to Central; displays its receipt',async()=>{
  let request;
  const central={centralMemberRequest:async(kind,subject,payload)=>{
    request=[kind,subject,payload];return {status:201,body:{order}};
  }};
  const result=await reserveFromCentral(central,'member-1',body,key);
  assert.equal(result.status,201);
  assert.equal(result.body.pickupCode,order.pickupCode);
  assert.equal(result.body.expiresAt,order.expiresAt);
  assert.deepEqual(request,['save.reserve','member-1',{
    kind:'save.reserve',siteCode:'s1',mode:'pickup',
    lines:[{sku:'oil',qty:1,expectedRevision:4,pricePaise:12500}],
    quotedAt:quote.quotedAt,quoteExpiresAt:quote.quoteExpiresAt,idempotencyKey:key}]);
});
test('lost reserve response retrieves the same committed Central result',async()=>{
  const calls=[];
  const central={centralMemberRequest:async kind=>{
    calls.push(kind);
    if(kind==='save.reserve')throw Error('lost response');
    return {status:200,body:{kind:'save.reserve',committed:true,resultStatus:201,result:{order}}};
  }};
  const result=await reserveFromCentral(central,'member-1',body,key);
  assert.deepEqual(calls,['save.reserve','save.retryStatus']);
  assert.equal(result.body.id,order.orderId);
  assert.equal((await retryReserveStatus(central,'member-1',key)).body.id,order.orderId);
});
test('unknown timeout stays uncertain and a changed bag cannot consume its key',async()=>{
  const central={centralMemberRequest:async kind=>{
    if(kind==='save.reserve')throw Error('timeout');
    return {status:404,body:{error:'request_not_found'}};
  }};
  await assert.rejects(reserveFromCentral(central,'member-1',body,key),/service_unavailable/);
  await assert.rejects(reserveFromCentral(central,'member-1',
    {...body,lines:[{id:'oil-1',qty:2}]},key),/invalid_reservation_request/);
});
