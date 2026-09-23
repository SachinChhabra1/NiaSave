import test from 'node:test';
import assert from 'node:assert/strict';
import {cancelFromCentral} from './central-cancel.mjs';

const orderId='01234567-89ab-4cde-8fab-0123456789ab';
const body={orderId,expectedRevision:3};
const key='cancel-key-000000001';

test('cancel forwards exact revision and key; Central conflict is unchanged',async()=>{
  let args;
  const central={centralMemberRequest:async(...value)=>{
    args=value;return {status:409,body:{error:'revision_conflict'}};
  }};
  const result=await cancelFromCentral(central,'member-1',body,key);
  assert.deepEqual(args,['save.cancel','member-1',{orderId,expectedRevision:3,
    idempotencyKey:key}]);
  assert.deepEqual(result,{status:409,body:{error:'revision_conflict'}});
});
test('lost cancel response reads the committed Central result',async()=>{
  const calls=[];
  const result={order:{orderId,status:'cancelled',revision:4}};
  const central={centralMemberRequest:async kind=>{
    calls.push(kind);
    if(kind==='save.cancel')throw Error('lost response');
    return {status:200,body:{committed:true,kind:'save.cancel',resultStatus:200,result}};
  }};
  assert.deepEqual(await cancelFromCentral(central,'member-1',body,key),{status:200,body:result});
  assert.deepEqual(calls,['save.cancel','save.retryStatus']);
});
test('unknown timeout keeps the same pending tap and no local cancellation occurs',async()=>{
  const central={centralMemberRequest:async kind=>{
    if(kind==='save.cancel')throw Error('timeout');
    return {status:404,body:{error:'request_not_found'}};
  }};
  await assert.rejects(cancelFromCentral(central,'member-1',body,key),/service_unavailable/);
  await assert.rejects(cancelFromCentral(central,'member-1',
    {...body,expectedRevision:0},key),/invalid_cancel_request/);
});
