import test from 'node:test';
import assert from 'node:assert/strict';
import {presentCentralOrder,readCentralOrders} from './central-orders.mjs';

const original={orderId:'01234567-89ab-4cde-8fab-0123456789ab',pickupCode:'0123456789AB',
  siteCode:'s1',revision:1,status:'reserved',effectiveStatus:'reserved',
  totalPaise:12500,lines:[{sku:'oil',productId:'oil-1',name:'Oil',pack:'1 L',
    qty:1,pricePaise:12500,subtotalPaise:12500,revision:4}],
  location:{id:'S01',name:'Central site',address:'Verified address',
    windowStart:'2026-09-23T03:30:00.000Z',windowEnd:'2026-09-23T12:30:00.000Z'},
  reservedAt:'2026-09-23T10:00:00.000Z',updatedAt:'2026-09-23T10:00:00.000Z',
  expiresAt:'2026-09-23T10:45:00.000Z'};

test('order view uses Central snapshot and derived status without changing money or expiry',()=>{
  const row=presentCentralOrder({...original,effectiveStatus:'expired'});
  assert.deepEqual([row.id,row.pickupCode,row.status,row.amount,row.expiresAt],
    [original.orderId,original.pickupCode,'expired',125,original.expiresAt]);
  assert.equal(row.lines[0].nia,125);
  assert.deepEqual(row.location,original.location);
});
test('missing Central site snapshot or reference fails closed',()=>{
  assert.throws(()=>presentCentralOrder({...original,pickupCode:null}),/central_orders_unavailable/);
  assert.throws(()=>presentCentralOrder({...original,location:null}),/central_orders_unavailable/);
});
test('history pages through Central and refuses a repeated cursor',async()=>{
  const calls=[];
  const central={centralMemberRequest:async(kind,subject,request)=>{
    calls.push([kind,subject,request]);
    return calls.length===1?{status:200,body:{orders:[original],asOf:new Date().toISOString(),
      nextCursor:{beforeAt:original.reservedAt,beforeId:original.orderId}}}
      :{status:200,body:{orders:[],asOf:new Date().toISOString(),nextCursor:null}};
  }};
  const result=await readCentralOrders(central,'member-1');
  assert.equal(result.body.orders.length,1);
  assert.deepEqual(calls[1][2],{beforeAt:original.reservedAt,beforeId:original.orderId});
});

test('completed orders remain visible with the status decided by Central',()=>{
  assert.equal(presentCentralOrder({...original,status:'completed',effectiveStatus:'completed'}).status,'completed');
  assert.equal(presentCentralOrder({...original,effectiveStatus:'completed'}).payment,undefined);
});

test('only an authoritative matching pickup receipt reports payment received; no bank assertion or private evidence',()=>{
  const payment={status:'received',method:'at_pickup',amountPaise:12500,
    receivedAt:'2026-09-23T10:30:00Z',bankSettlementVerified:false,privateEvidence:'not for member'};
  const completed={...original,effectiveStatus:'completed',payment};
  const view=presentCentralOrder(completed);
  assert.equal(view.payment.status,'received');
  assert.equal(view.payment.bankSettlementVerified,false);
  assert.equal(view.payment.privateEvidence,undefined);
  for(const patch of [{amountPaise:1},{status:'paid'},{method:'online'},
    {bankSettlementVerified:true},{receivedAt:'invalid'}])
    assert.throws(()=>presentCentralOrder({...completed,payment:{...payment,...patch}}),/central_orders_unavailable/);
  assert.throws(()=>presentCentralOrder({...original,payment}),/central_orders_unavailable/);
});
test('an inconsistent or incomplete Central receipt fails closed',()=>{
  assert.throws(()=>presentCentralOrder({...original,totalPaise:12400}),/central_orders_unavailable/);
  assert.throws(()=>presentCentralOrder({...original,lines:[{...original.lines[0],subtotalPaise:12400}]}),/central_orders_unavailable/);
  assert.throws(()=>presentCentralOrder({...original,lines:[{...original.lines[0],revision:null}]}),/central_orders_unavailable/);
});
test('duplicate orders and cycling cursors fail closed across Central pages',async()=>{
  let calls=0;
  const central={centralMemberRequest:async()=>{
    calls++;
    return {status:200,body:{orders:[original],asOf:new Date().toISOString(),
      nextCursor:calls===1?{beforeAt:original.reservedAt,beforeId:original.orderId}:null}};
  }};
  await assert.rejects(readCentralOrders(central,'member-1'),/central_orders_unavailable/);
  calls=0;
  const cycling={centralMemberRequest:async()=>({status:200,body:{orders:[],
    asOf:new Date().toISOString(),nextCursor:calls++%2
      ?{beforeAt:'2026-09-22T10:00:00.000Z',beforeId:original.orderId}
      :{beforeAt:original.reservedAt,beforeId:original.orderId}}})};
  await assert.rejects(readCentralOrders(cycling,'member-1'),/central_orders_unavailable/);
});
