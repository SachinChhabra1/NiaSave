import test from 'node:test';
import assert from 'node:assert/strict';
import {loadBooksDemo,ownBooks,booksConsent,monthlyStatement,healthScore} from './books.mjs';
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
 const s=setup();assert.throws(()=>ownBooks(s,null,true,now),/sign_in_required/);assert.throws(()=>ownBooks(s,{...actor,role:'investor'},true,now),/member_access_required/);assert.equal(ownBooks(s,{...actor,id:'other'},true,now).months.length,0);assert.equal(ownBooks(s,actor,false,now).months.length,0);
 assert.throws(()=>loadBooksDemo(s,admin,fixture(),false,now),/local_demo_only/);assert.throws(()=>loadBooksDemo(s,{role:'operator'},fixture(),true,now),/local_demo_only/);
});
test('rejects duplicate source references, fractional money and malformed dates without overwriting projection',()=>{
 const s=setup();for(const mutation of [f=>f.months[1].entries[0].reference=f.months[0].entries[0].reference,f=>f.months[0].entries[0].amountPaise=0.5,f=>f.months[0].entries[0].date='2026-06-31']){const f=fixture();mutation(f);assert.throws(()=>loadBooksDemo(s,admin,f,true,now),/invalid_books_entry/);assert.equal(ownBooks(s,actor,true,now).months[0].totals.earned,1800000);}
 loadBooksDemo(s,admin,fixture(),true,now);assert.equal(ownBooks(s,actor,true,now).months.length,3);
});
