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
test('Send screen keeps transfer off and avoids locally calculated paid amount',async()=>{
  const src=fs.readFileSync(new URL('../../commerce.js',import.meta.url),'utf8');
  const send=src.slice(src.indexOf('function sendView(){'),src.indexOf('async function loadNests()'));
  assert.match(send,/Sending money has not started/);
  assert.match(send,/This is your plan\. No money moves from here/);
  assert.match(send,/Only money the Nia team has recorded shows as sent/);
  assert.doesNotMatch(send,/totals\.home|sentHome|money\(total\(\)\)/);
  for(const lang of ['hi','ta','bn','kn','mr']){
    const locale=(await import('../../commerce-locales/'+lang+'.js')).default;
    const example=locale.Example;
    assert.equal(typeof example,'string',lang+': Example');
    assert.notEqual(example.trim(),'',lang+': Example empty');
    assert.notEqual(example,'Example',lang+': Example is still the English word');
    for(const key of ['Details did not load.','This is your plan. No money moves from here.','Sending money has not started','Log in to see your money.'])
      assert.equal(typeof locale[key],'string',lang+': '+key);
  }
  for(const lang of ['hi','ta','bn']){
    const locale=fs.readFileSync(new URL('../../commerce-locales/'+lang+'.js',import.meta.url),'utf8');
    assert.ok(locale.includes(JSON.stringify('Checking your money plan')),lang+': Checking your money plan');
  }
});
