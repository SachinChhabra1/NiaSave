import test from 'node:test';
import assert from 'node:assert/strict';
import {loadBooksDemo,ownBooks,booksConsent,monthlyStatement,healthScore,writePersonalEntry,saveEntries,livingEntries,mergeBooks} from './books.mjs';
const now=Date.parse('2026-09-08T04:00:00Z'),actor={id:'preview-member',role:'member'},admin={id:'admin',role:'admin'};
const fixture=()=>({memberId:actor.id,months:['2026-06','2026-07','2026-08'].map((month,i)=>({month,complete:true,entries:[['earning',1800000+i*150000],['expense',900000+i*90000],['home',700000+i*50000]].map(([kind,amountPaise],j)=>({kind,amountPaise,reference:`DEMO-BOOKS-${i}-${j}`,date:month+'-10',label:kind,source:'Demo source',status:'settled',verified:true}))}))});
function setup(){const s={commerce:{}};loadBooksDemo(s,admin,fixture(),true,now);return s;}
test('statement uses settled cash movements and does not count pending/failed payments; refund offsets spend',()=>{
 const m=fixture().months[0];m.entries.push({...m.entries[0],kind:'refund',amountPaise:10000},{...m.entries[0],kind:'home',amountPaise:50000,status:'pending'},{...m.entries[0],kind:'expense',amountPaise:50000,status:'failed'});
 assert.deepEqual(monthlyStatement(m).totals,{earned:1800000,spent:900000,home:700000,refunds:10000,left:210000});assert.equal(monthlyStatement(m).pending,1);
});
test('score requires consent, three complete consecutive verified months, positive income and fresh source',()=>{
 const s=setup();assert.equal(ownBooks(s,actor,true,now).score.reason,'consent_required');booksConsent(s,actor,{enabled:true},now);const b=ownBooks(s,actor,true,now);assert.equal(b.score.value,66);assert.equal(b.score.retainedPoints,32);assert.equal(b.score.stabilityPoints,34);
 assert.equal(healthScore(b.months,b.asOf,now+86400001,true).reason,'source_stale');assert.equal(healthScore(b.months.slice(1),b.asOf,now,true).reason,'history_incomplete');
 b.months[0].complete=false;assert.equal(healthScore(b.months,b.asOf,now,true).value,null);
 booksConsent(s,actor,{enabled:false},now);assert.equal(ownBooks(s,actor,true,now).score.value,null);
});
test('member isolation, production exclusion and admin-only demo import',()=>{
 const s=setup();assert.throws(()=>ownBooks(s,null,true,now),/sign_in_required/);assert.throws(()=>ownBooks(s,{...actor,role:'investor'},true,now),/member_access_required/);assert.equal(ownBooks(s,{...actor,id:'other'},true,now).months.flatMap(m=>m.entries).length,0);assert.equal(ownBooks(s,actor,false,now).months.flatMap(m=>m.entries).length,0);
 assert.throws(()=>loadBooksDemo(s,admin,fixture(),false,now),/local_demo_only/);assert.throws(()=>loadBooksDemo(s,{role:'operator'},fixture(),true,now),/local_demo_only/);
});
test('rejects duplicate source references, fractional money and malformed dates without overwriting projection',()=>{
 const s=setup();for(const mutation of [f=>f.months[1].entries[0].reference=f.months[0].entries[0].reference,f=>f.months[0].entries[0].amountPaise=0.5,f=>f.months[0].entries[0].date='2026-06-31']){const f=fixture();mutation(f);assert.throws(()=>loadBooksDemo(s,admin,f,true,now),/invalid_books_entry/);assert.equal(ownBooks(s,actor,true,now).months[0].totals.earned,1800000);}
 loadBooksDemo(s,admin,fixture(),true,now);assert.equal(ownBooks(s,actor,true,now).months.length,4);
});
test('personal entries create once, edit with revision, remove, reject another member and never overwrite source rows',()=>{
 const s=setup(),body={date:'2026-08-15',kind:'expense',amountPaise:7500,label:'Bus fare'};
 writePersonalEntry(s,actor,body,'personal-create-0001',now);writePersonalEntry(s,actor,body,'personal-create-0001',now);
 let rows=ownBooks(s,actor,true,now).months.flatMap(m=>m.entries).filter(e=>e.editable);assert.equal(rows.length,1);assert.equal(rows[0].verified,false);
 booksConsent(s,actor,{enabled:true},now);assert.equal(ownBooks(s,actor,true,now).score.reason,'history_incomplete');
 const edit={...body,id:rows[0].reference,revision:1,amountPaise:9000};assert.throws(()=>writePersonalEntry(s,{...actor,id:'other'},edit,'personal-other-0001',now),/entry_not_found/);
 assert.throws(()=>writePersonalEntry(s,actor,{...edit,id:'save-payment-1'},'personal-other-0002',now),/entry_not_found/);
 writePersonalEntry(s,actor,edit,'personal-edit-0001',now);assert.throws(()=>writePersonalEntry(s,actor,edit,'personal-edit-0002',now),/entry_changed/);
 writePersonalEntry(s,actor,{id:rows[0].reference,revision:2,remove:true},'personal-remove-001',now);assert.equal(ownBooks(s,actor,true,now).months.flatMap(m=>m.entries).filter(e=>e.editable).length,0);
 assert.throws(()=>writePersonalEntry(s,actor,{...body,amountPaise:5},'personal-create-0001',now),/idempotency_conflict/);
 assert.throws(()=>writePersonalEntry(s,actor,{...body,date:'2026-09-09'},'personal-future-0001',now),/valid_date/);
});
test('automatic Save uses one canonical payment and refund; Live uses exact contract identity, excludes unpaid bookings',()=>{
 const s=setup();s.orders=[{id:'a',source:'commerce',memberId:actor.id,payment:{amount:100,verifiedAt:'2026-09-08T02:00:00Z'},refund:{amount:100,verifiedAt:'2026-09-08T03:00:00Z'}},{id:'b',source:'commerce',memberId:actor.id},{id:'c',source:'commerce',memberId:'other',payment:{amount:999,verifiedAt:'2026-09-08'}}];
 assert.equal(saveEntries(s,actor,true).length,2);const data=ownBooks(s,actor,true,now);assert.equal(data.months.at(-1).totals.left,0);assert.equal(mergeBooks(data,saveEntries(s,actor,true),now).months.at(-1).entries.length,2);
 const live={receivables:[{id:'rent',kind:'membership'},{id:'deposit',kind:'deposit'}],bookings:[{source:'member_storefront',memberId:actor.id,contractId:'ours'}],collectionPayments:[{id:'1',receivableId:'rent',contractId:'ours',amount:2464,at:'2026-09-08',reference:'paid'},{id:'3',receivableId:'deposit',contractId:'ours',amount:200,at:'2026-09-08',reference:'deposit'},{id:'2',contractId:'theirs',amount:100,at:'2026-09-08',reference:'other'}]};
 const entries=livingEntries(live,actor,true);assert.equal(entries.length,1);assert.equal(entries[0].amountPaise,246400);assert.equal(entries[0].editable,false);assert.equal(entries[0].verified,false);
});
