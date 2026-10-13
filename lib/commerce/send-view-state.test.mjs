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
  assert.match(send,/This is only your own record\. Nia does not send money/);
  assert.doesNotMatch(send,/Log in to see your money/);
  assert.doesNotMatch(send,/This is your plan\. No money moves from here/);
  assert.match(send,/Only money the Nia team has recorded shows as sent/);
  assert.doesNotMatch(send,/totals\.home|sentHome|money\(total\(\)\)/);
  for(const lang of ['hi','ta','bn','kn','mr']){
    const locale=(await import('../../commerce-locales/'+lang+'.js')).default;
    const example=locale.Example;
    assert.equal(typeof example,'string',lang+': Example');
    assert.notEqual(example.trim(),'',lang+': Example empty');
    assert.notEqual(example,'Example',lang+': Example is still the English word');
    for(const key of ['Details did not load.','This is only your own record. Nia does not send money.','Sending money has not started','Log in to see the money you send home.'])
      assert.equal(typeof locale[key],'string',lang+': '+key);
  }
  for(const lang of ['hi','ta','bn']){
    const locale=fs.readFileSync(new URL('../../commerce-locales/'+lang+'.js',import.meta.url),'utf8');
    assert.ok(locale.includes(JSON.stringify('Checking your money plan')),lang+': Checking your money plan');
  }
});

// A "later" adverb anywhere in the same sentence as a negation. A word between
// the two used to slip through the old fixed pairs.
const LATER_ADVERB = /अभी|এখনও|এখন|இப்போது|இன்னும்|ಈಗ|ಇನ್ನೂ|आत्ता|अजून/;
const NEGATION = /नहीं|नही|मत|না|নয়|নয়|নেই|নাই|নি|இல்லை|இல்ல|வேண்டாம்|போகாது|ஆகாது|ಇಲ್ಲ|ಅಲ್ಲ|ಬೇಡ|नाहीत|नाही|नको/;
const ENGLISH_LATER = [
  /\byet\b/i,
  /\bnot yet\b/i,
  /\bfor now\b/i,
  /\bat the moment\b/i,
  /not right now/i,
  /no money moves from here/i
];
// These say "not started yet" without a separate negation word. Kept so the
// guard stays at least as strict as the old fixed pairs.
const STARTED_LATER = [
  /এখনও\s*শুরু/,
  /இன்னும்\s*தொடங்க/,
  /ಇನ್ನೂ\s*ಶುರು/,
  /अजून\s*सुरू/,
  /अभी\s*शुरू\s*नहीं/,
  /এখন\s*যাবে\s*না/,
  /இப்போது\s*போகாது/,
  /ಈಗ\s*ಹೋಗುವುದಿಲ್ಲ/,
  /आत्ता\s*जाणार\s*नाहीत/
];

function saysNotNow(text){
  if(ENGLISH_LATER.some(pattern=>pattern.test(text)))return true;
  if(STARTED_LATER.some(pattern=>pattern.test(text)))return true;
  for(const sentence of String(text).split(/[.!?।৷\n]+/)){
    if(LATER_ADVERB.test(sentence)&&NEGATION.test(sentence))return true;
  }
  return false;
}

function sendScreenKeys(src){
  const example=src.slice(src.indexOf('function sendExample('),src.indexOf('function earnView('));
  const send=src.slice(src.indexOf('function sendView('),src.indexOf('async function loadNests'));
  const keys=new Set(['This is for money you send home.']);
  for(const chunk of [example,send]){
    const re=/t\(\s*'((?:\\'|[^'])*)'/g;
    let match;
    while((match=re.exec(chunk)))keys.add(match[1].replace(/\\'/g,"'"));
  }
  return [...keys];
}

test('a Send screen string does not say the money goes later',async()=>{
  const src=fs.readFileSync(new URL('../../commerce.js',import.meta.url),'utf8');
  const keys=sendScreenKeys(src);
  const hits=[];
  const check=(where,text)=>{
    if(saysNotNow(text))hits.push(where+': '+text);
  };
  for(const key of keys)check('en '+key,key);
  for(const lang of ['hi','ta','bn','kn','mr']){
    const locale=(await import('../../commerce-locales/'+lang+'.js')).default;
    for(const key of keys){
      const line=locale[key];
      if(typeof line==='string')check(lang+' '+key,line);
    }
  }
  assert.deepEqual(hits,[]);
});
