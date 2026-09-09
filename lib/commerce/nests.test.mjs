import test from 'node:test';
import assert from 'node:assert/strict';
import * as nests from './nests.mjs';
const time=Date.parse('2026-09-08T04:00:00Z');
const offer={studioId:'s1',name:'Verified studio',address:'Verified address',nestIds:['N1','N2'],rent:2000,deposit:500,taxPct:0,holdHours:24,terms:'Verified terms',details:'Verified facilities',validUntil:'2026-10-01T00:00:00Z'};
const state=()=>({dummy:false,studios:[{id:'s1',capacity:2}],memberCatalogue:{verified:true,offers:[structuredClone(offer)]},bookings:[],contracts:[],collectionPayments:[],members:[],auditLog:[]});
const actor={id:'one',role:'member',name:'One'};
test('Live catalogue requires verified non-seed offers; expired publication hides prices',()=>{
 const s=state();assert.equal(nests.nestCatalogue(s,false,time).offers.length,1);
 s.dummy=true;assert.equal(nests.nestCatalogue(s,false,time).offers.length,0);
 s.dummy=false;s.memberCatalogue.verified=false;assert.equal(nests.nestCatalogue(s,false,time).offers.length,0);
 s.memberCatalogue.verified=true;s.memberCatalogue.offers[0].validUntil='2026-09-01';assert.equal(nests.nestCatalogue(s,false,time).offers.length,0);
});
test('availability excludes future overlaps and checks capacity for the entire stay',()=>{
 const s=state();s.bookings=[{studioId:'s1',nestId:'N1',arrive:'2026-09-15',depart:'2026-10-15',status:'reserved'}];
 assert.equal(nests.nestCatalogue(s,false,time).offers[0].available,1);
 s.bookings.push({studioId:'s1',nestId:'OLD_UNKNOWN',arrive:'2026-09-20',depart:'2026-10-15',status:'in'});
 assert.equal(nests.nestCatalogue(s,false,time).offers[0].available,0);
});
test('prices and policy changes require renewed consent; no client price accepted',()=>{
 const s=state(),body={studioId:'s1',start:'2026-09-08',rent:1,total:1};const q=nests.nestQuote(s,actor,body,false,time);assert.equal(q.total,2500);
 s.memberCatalogue.offers[0].deposit=600;
 assert.throws(()=>nests.reserveNest(s,actor,{...body,fingerprint:q.fingerprint},'key-123456789012345',false,time,()=>assert.fail('must not create a contract')),/price_or_details_changed/);
 for(const start of ['2026-02-30','2026-09-07','2026-11-01','nonsense'])assert.throws(()=>nests.nestCatalogue(s,false,time,start),/invalid_move_in_date/);
});
test('expiry frees unpaid holds, while payment prevents automatic release and member cancellation',()=>{
 const s=state();const b={id:'booking',source:'member_storefront',memberId:'one',studioId:'s1',nestId:'N1',contractId:'contract',status:'reserved',arrive:'2026-09-08',depart:'2026-10-08',memberReservation:{expiresAt:'2026-09-08T00:00:00Z',quote:{name:'Studio',address:'Address'}}};s.bookings=[b];s.contracts=[{id:'contract',status:'pending'}];
 assert.throws(()=>nests.cancelNest(s,{...actor,id:'other'},{bookingId:'booking'},time,()=>assert.fail()),/booking_not_found/);
 // The failed direct call may perform expiry; use a fresh active hold for the paid case.
 b.status='reserved';b.memberReservation.expired=false;s.contracts[0].status='pending';s.collectionPayments=[{contractId:'contract',amount:100,reference:'receipt'}];
 nests.expireNests(s,time);assert.equal(b.status,'reserved');
 assert.throws(()=>nests.cancelNest(s,actor,{bookingId:'booking'},time,()=>assert.fail()),/contact_team_to_cancel/);
 s.collectionPayments=[];nests.expireNests(s,time);assert.equal(b.status,'cancelled');assert.equal(s.contracts[0].status,'cancelled');
});
test('publishing requires admin and explicit verified nest IDs, prices, terms and address',()=>{
 const s=state();assert.throws(()=>nests.configureNests(s,{verified:true,offers:[offer]},null,time),/admin_access_required/);
 assert.throws(()=>nests.configureNests(s,{verified:true,offers:[{...offer,nestIds:['N1','N1']}]},{role:'admin'},time),/verified_nest_ids_required/);
 nests.configureNests(s,{verified:true,offers:[offer]},{role:'admin',id:'owner'},time);assert.equal(s.memberCatalogue.verifiedBy,'owner');
});
