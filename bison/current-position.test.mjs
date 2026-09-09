import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createCurrentPositionReader, projectCurrentPosition } from './current-position.mjs';
const headers=['Sample_Live','Reporting_Date','Reporting_Time','Studio_ID','Contracted_Nests','Occupied_Nests','Vacant_Nests'];
const row=(id,cap,occ,vac,day='2026-09-08')=>['Live',day,'12:00',id,cap,occ,vac];

test('current position uses latest unique Live studio rows, without promoting samples or unknowns to zero',()=>{
  const source=[headers,['Sample','2026-09-08','12:00','SAMPLE',999,999,0],row('A',100,80,20),row('A',100,70,30,'2026-09-07'),row('B',47,'-','#VALUE!'),row('C',20,20,0)];
  const before=JSON.stringify(source), result=projectCurrentPosition(source,'2026-09-09T12:00:00Z');
  assert.deepEqual(result.kpis,{capacity:167,inHouse:100,vacant:20,studios:3});
  assert.deepEqual(result.missing,{capacity:0,inHouse:1,vacant:1});
  assert.equal(result.status,'partial');
  assert.deepEqual(result.reportingDates,['2026-09-08']);
  assert.equal(JSON.stringify(source),before);
  assert.equal('bookings' in result,false);
});
test('duplicate conflicting source rows and malformed sources fail rather than double count',()=>{
  assert.throws(()=>projectCurrentPosition([headers,row('A',10,5,5),row('A',10,6,4)]),/duplicate/);
  assert.throws(()=>projectCurrentPosition([['Studio_ID'],['A']]),/headers/);
  assert.throws(()=>projectCurrentPosition([headers]),/empty/);
  assert.throws(()=>projectCurrentPosition([headers,row('A',10,5,5,'bad')]),/identity/);
  const result=projectCurrentPosition([headers,row('A',10,'-','-')]);
  assert.equal(result.kpis.inHouse,null);assert.equal(result.kpis.vacant,null);
});
test('mixed dates and inconsistent source counts remain explicit',()=>{
  const result=projectCurrentPosition([headers,row('A',10,9,4),row('B',10,4,6,'2026-09-07')]);
  assert.equal(result.status,'partial');assert.equal(result.inconsistent,1);
  assert.deepEqual(result.reportingDates,['2026-09-07','2026-09-08']);
});
test('Google reader is read-only, shares concurrent reads, expires cache and does not serve stale success after a failure',async()=>{
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  const env={BISON_GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({client_email:'test@example.invalid',private_key:privateKey.export({type:'pkcs8',format:'pem'})})};
  let at=100000, calls=[],fail=false,occupied=4;
  const fetchImpl=async(url,init)=>{
    calls.push({url,init});
    if(url.includes('oauth2')){
      const claims=JSON.parse(Buffer.from(init.body.get('assertion').split('.')[1],'base64url'));
      assert.equal(claims.scope,'https://www.googleapis.com/auth/spreadsheets.readonly');
      return {ok:true,json:async()=>({access_token:'test-token'})};
    }
    assert.equal(init.method,undefined);assert.ok(url.includes('UI_Occupancy'));
    assert.equal(init.redirect,'error');
    return fail?{ok:false,status:403}:{ok:true,json:async()=>({values:[headers,row('A',10,occupied,10-occupied)]})};
  };
  const read=createCurrentPositionReader({fetchImpl,env,now:()=>at});
  const results=await Promise.all([read(),read()]);assert.equal(calls.length,2);assert.equal(results[0],results[1]);
  occupied=6;assert.equal((await read()).kpis.inHouse,4);assert.equal(calls.length,2);
  at+=61000;assert.equal((await read()).kpis.inHouse,6);assert.equal(calls.length,4);
  at+=61000;fail=true;await assert.rejects(read(),/access_denied/);
  fail=false;occupied=7;assert.equal((await read()).kpis.inHouse,7);
});
