import test from 'node:test';
import assert from 'node:assert/strict';
import {discardTestCommerceBook} from './discard-test-book.mjs';

test('discard removes only the founder-classified test commerce book and preserves identity and support',()=>{
  const raw={orders:[{id:'ord-test'}],reservations:[{orderId:'ord-test'}],
    settlements:[{orderId:'ord-test'}],payments:[{orderId:'ord-test'}],scans:[],
    commerce:{requests:{key:{orderId:'ord-test'}},config:{products:[{test:true}]},
      sessions:{sid:{accountId:'member'}},accounts:{member:{id:'member'}},
      tickets:[{id:'support'}],audit:[{action:'reserved'},{action:'phone_recovery'},
        {action:'support_resolved'}]},other:{saved:true}};
  const {state,manifest}=discardTestCommerceBook(raw);
  assert.deepEqual(manifest.counts,{orders:1,reservations:1,settlements:1,payments:1,
    scans:0,idempotencyKeys:1,auditHistory:1,catalogueConfig:1});
  assert.deepEqual(state.orders,[]);
  assert.deepEqual(state.commerce.requests,{});
  assert.equal(state.commerce.config,null);
  assert.deepEqual(state.commerce.audit,[{action:'phone_recovery'},
    {action:'support_resolved'}]);
  assert.deepEqual(state.commerce.sessions,raw.commerce.sessions);
  assert.deepEqual(state.commerce.accounts,raw.commerce.accounts);
  assert.deepEqual(state.commerce.tickets,raw.commerce.tickets);
  assert.deepEqual(state.other,raw.other);
  assert.equal(raw.orders.length,1);
  assert.match(manifest.removedHash,/^[0-9a-f]{64}$/);
});

test('unrecognized book shape fails before a partial discard',()=>{
  assert.throws(()=>discardTestCommerceBook({orders:{id:'ord-test'}}),/invalid_test_book_orders/);
  assert.throws(()=>discardTestCommerceBook({commerce:{requests:[]}}),/invalid_test_book_requests/);
});
