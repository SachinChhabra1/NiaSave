import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomUUID} from 'node:crypto';
import * as c from './core.mjs';
import {memberServiceParams} from './member-services.mjs';
process.env.COMMERCE_PREVIEW='1';process.env.DATABASE_URL='';process.env.NODE_ENV='test';delete process.env.VERCEL;
const {handler}=await import('../../api/server.mjs');
const {resetDummy}=await import('../../rabbit/engine.mjs');
const time=Date.parse('2026-09-09T06:00:00Z'),skus=[{id:'groundnut_oil',nia:185}],actor={id:'test-member',name:'Test member',role:'member',locationIds:['S01'],locationPinCodes:{S01:'560102'}},admin={id:'test-admin',role:'admin',staff:true};
function state(){const s={beat:{beatDate:'2026-09-09',open:true,opening:{groundnut_oil:3}},orders:[],reservations:[],studios:[{id:'S01'}],payments:[],settlements:[],scans:[]};c.initialise(s,skus,true,time);return s;}
function config(s,{price=100,onHand=3}={}){return {...structuredClone(s.commerce.config),verified:true,products:[{id:'groundnut_oil',name:'Oil',pack:'1 litre',category:'ration',price,pricePaise:Math.round(price*100),onHand,verifiedAt:new Date(time).toISOString(),countedAt:new Date(time).toISOString(),sourceSku:'external-oil',sourceSiteCode:'HSR',centralSource:{system:'rafiqi-central',pulledAt:new Date(time).toISOString()}}],locations:[{id:'S01',name:'HSR',address:'Test address',sourceSiteCode:'HSR',modes:['pickup','delivery'],deliveryPinCodes:['560102'],reserveMinutes:30,windowStart:new Date(time-60000).toISOString(),windowEnd:new Date(time+3600000).toISOString()}]};}
const intent={locationId:'S01',fulfillment:'pickup',lines:[{id:'groundnut_oil',qty:1}]};
function reserve(s){const q=c.quote(s,actor,intent,skus,true,time);return c.reserve(s,actor,{...intent,fingerprint:q.fingerprint},randomUUID(),skus,true,time);}
test('verified price and opening drive catalogue, quote, reservation and single settlement',()=>{
 const s=state();c.configure(s,skus,config(s),admin,time);assert.equal(c.catalogue(s,skus,true,time).products[0].price,100);
 const o=reserve(s);assert.equal(o.amount,100);assert.equal(o.lines[0].sourceSku,'external-oil');assert.equal(o.location.sourceSiteCode,'HSR');assert.equal(c.catalogue(s,skus,true,time).products[0].available,2);
 for(const action of ['packed','loaded','at_stop'])c.staffAction(s,admin,{orderId:o.id,action},time);
 const receipt={orderId:o.id,action:'verify_payment',reference:'888888888888',amount:100,receiptVerified:true};c.staffAction(s,admin,receipt,time);c.staffAction(s,admin,receipt,time);
 c.staffAction(s,admin,{orderId:o.id,action:'collected',pickupCode:o.pickupCode},time);c.staffAction(s,admin,{orderId:o.id,action:'reconcile',statementVerified:true,note:'Test settlement'},time);
 c.staffAction(s,admin,{orderId:o.id,action:'reconcile',statementVerified:true,note:'Test settlement'},time);assert.equal(s.payments.length,1);assert.equal(s.settlements.length,1);assert.equal(c.catalogue(s,skus,true,time).products[0].available,2);
 assert.throws(()=>c.configure(s,skus,config(s,{onHand:0}),admin,time),/count_below_committed_stock/);
});
test('zero stock, unverified member delivery and wrong site fail closed; client cannot override postcode',()=>{
 const s=state();c.configure(s,skus,config(s,{onHand:0}),admin,time);assert.equal(c.catalogue(s,skus,true,time).products[0].available,0);assert.throws(()=>reserve(s),/stock_changed/);
 c.configure(s,skus,config(s),admin,time);assert.equal(c.quote(s,actor,{...intent,fulfillment:'delivery'},skus,true,time).amount,100);
 assert.throws(()=>c.quote(s,{...actor,locationPinCodes:{}},{...intent,fulfillment:'delivery',pinCode:'560102'},skus,true,time),/delivery_location_unverified/);
 const bad=config(s);bad.locations[0].sourceSiteCode='OTHER';assert.throws(()=>c.configure(s,skus,bad,admin,time),/product_location_mismatch/);assert.equal(s.commerce.config.locations[0].sourceSiteCode,'HSR');
});
test('republication is atomic and cannot overwrite reserved stock, stale proof or order prices',()=>{
 const s=state();c.configure(s,skus,config(s),admin,time);const q=c.quote(s,actor,intent,skus,true,time);const o=reserve(s);
 const low=config(s,{onHand:0});assert.throws(()=>c.configure(s,skus,low,admin,time),/count_below_committed_stock/);assert.equal(s.beat.opening.groundnut_oil,3);
 const stale=config(s);stale.products[0].countedAt=new Date(time-2*86400000).toISOString();assert.throws(()=>c.configure(s,skus,stale,admin,time),/verified_price_and_stock_required/);
 c.configure(s,skus,config(s,{price:101}),admin,time);assert.equal(o.amount,100);assert.throws(()=>c.reserve(s,actor,{...intent,fingerprint:q.fingerprint},randomUUID(),skus,true,time),/price_or_details_changed/);
 c.expire(s,time+31*60000);assert.equal(s.orders[0].status,'expired');assert.equal(c.catalogue(s,skus,true,time+31*60000).products[0].available,3);
});
test('member service requests cannot replace the signed subject or self-verify a phone',()=>{
 assert.throws(()=>memberServiceParams('member.enrol',actor,{phone:'+919999999999',consent:true}),/verified_phone_required/);
 const verified={...actor,verifiedPhone:'+919999999999'};
 assert.deepEqual(memberServiceParams('member.enrol',verified,{fullName:'Fictional member',preferredLanguage:'hi',consent:true,phone:'+918888888888',subject:'other',kind:'plan.write',kycReference:'1234'}),{fullName:'Fictional member',preferredLanguage:'hi',consent:true,phone:'+919999999999'});
 assert.deepEqual(memberServiceParams('member.recover',verified,{oldPhone:'+918888888888',newPhone:'+917777777777'}),{oldPhone:'+918888888888',newPhone:'+919999999999',reason:''});
 assert.throws(()=>memberServiceParams('partner.refer',actor,{partnerId:'freed-shield',consent:true,fields:['phone']}),/consent_required/);
});
function request(path,body,cookie,method,headers={}){return new Promise(resolve=>{const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);Object.assign(req,{method:method||(body===undefined?'GET':'POST'),url:'/api/commerce'+path,headers:{host:'localhost:8787',origin:'http://localhost:8787',...(cookie?{cookie}:{}),...headers},socket:{remoteAddress:'test'}});const res={writeHead(status,h){this.status=status;this.headers=h;},end(raw){resolve({status:this.status,headers:this.headers,body:JSON.parse(raw)});}};handler(req,res);});}
test('HTTP routes use session identity, explicit consent and Central acknowledgements; no local fallback',async()=>{
 const save=resetDummy();process.env.CENTRAL_ORIGIN='https://central.test';process.env.CENTRAL_COMMERCE_KEY='k'.repeat(40);const original=globalThis.fetch,seen=[];
 globalThis.fetch=async(_url,init)=>{const e=JSON.parse(init.body);seen.push(e);return {status:e.request.kind==='partner.refer'?201:200,json:async()=>e.request.kind==='partner.refer'?{referralId:'ref-1',status:'held'}:{enrolled:true,memberId:'canonical-1'}};};
 try{
  assert.equal((await request('/membership')).status,401);
  const cookie=(await request('/auth/preview',{role:'member'})).headers['set-cookie'].split(';')[0];
  assert.equal((await request('/membership',undefined,cookie)).body.memberId,'canonical-1');
  const referral=await request('/partners/referrals',{partnerId:'freed-shield',consent:true,consentVersion:1,fields:['phone'],kind:'member.enrol',subject:'someone-else'},cookie);
  assert.equal(referral.status,201);assert.equal(referral.body.status,'held');assert.equal(seen.at(-1).member.subject,'preview-member');assert.equal(seen.at(-1).request.kind,'partner.refer');assert.equal(seen.at(-1).request.subject,undefined);
  assert.equal((await request('/membership/enrol',{consent:true,phone:'+919999999999'},cookie)).status,409);
  // A trusted identity-provider session can submit, but cannot choose approval or another subject.
  save.commerce.accounts['preview-member'].verifiedPhone='+919999999999';
  assert.equal((await request('/membership/enrol',{fullName:'Fictional member',preferredLanguage:'hi',consent:true,kycApproved:true,subject:'other'},cookie)).status,200);
  assert.equal(seen.at(-1).request.kind,'member.enrol');assert.equal(seen.at(-1).request.phone,'+919999999999');assert.equal(seen.at(-1).request.kycApproved,undefined);
  assert.equal((await request('/membership/recovery',{oldPhone:'+918888888888',newPhone:'+917777777777'},cookie)).status,200);
  assert.equal(seen.at(-1).request.kind,'member.recover');assert.equal(seen.at(-1).request.newPhone,'+919999999999');
  assert.equal((await request('/partners/referrals',{consent:true},cookie,'POST',{origin:'https://other.invalid'})).status,403);
  globalThis.fetch=async()=>{throw Error('down');};assert.equal((await request('/partners',undefined,cookie)).status,503);
 }finally{globalThis.fetch=original;delete process.env.CENTRAL_ORIGIN;delete process.env.CENTRAL_COMMERCE_KEY;}
});
