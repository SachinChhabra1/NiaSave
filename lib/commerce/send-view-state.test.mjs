import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sendViewState} from '../../commerce-books.js';
const asOf=new Date().toISOString();
const data={months:[{month:'2026-09',entries:[{reference:'r'}]}],asOf,liveAvailable:true};
test('Send preserves seven distinct source states without treating a plan as payment',()=>{
  assert.equal(sendViewState({data}),'ready');
  assert.equal(sendViewState({data:null}),'loading');
  assert.equal(sendViewState({data:{months:[]}}),'empty');
  assert.equal(sendViewState({data:{months:[],error:'timeout'}}),'unavailable');
  assert.equal(sendViewState({data:{months:[],liveAvailable:false}}),'source_missing');
  assert.equal(sendViewState({data:{...data,asOf:'2020-01-01T00:00:00Z'}}),'stale');
  assert.equal(sendViewState({data,online:false}),'offline');
});
test('Send screen keeps transfer off and avoids locally calculated paid amount',()=>{
  const src=fs.readFileSync(new URL('../../commerce.js',import.meta.url),'utf8');
  const send=src.slice(src.indexOf('function sendView(){'),src.indexOf('async function loadNests()'));
  assert.match(send,/Transfers not active/);
  assert.match(send,/Saving it does not move money/);
  assert.match(send,/Only a Nia team recorded payment appears as paid/);
  assert.doesNotMatch(send,/totals\.home|sentHome|money\(total\(\)\)/);
  for(const lang of ['hi','ta','bn']){
    const locale=fs.readFileSync(new URL('../../commerce-locales/'+lang+'.js',import.meta.url),'utf8');
    for(const key of ['Checking your money plan','Some statement sources are missing','Send is a plan. Saving it does not move money.'])
      assert.ok(locale.includes(JSON.stringify(key)),lang+': '+key);
  }
});
