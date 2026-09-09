import test from 'node:test';import assert from 'node:assert/strict';
import {takePasskeySetup,passkeyMarkup}from'../../commerce-passkeys.js';
test('setup link is consumed from the fragment and scrubbed before use',()=>{
 const token='x'.repeat(43),changes=[];const loc={hash:'#setup?token='+token,pathname:'/',search:''};
 assert.equal(takePasskeySetup(loc,{replaceState:(...args)=>changes.push(args)}),token);
 assert.deepEqual(changes,[[null,'','/#account']]);
 assert.equal(takePasskeySetup({...loc,hash:'#setup?token=short'},{replaceState:()=>{}}),'');
 assert.equal(takePasskeySetup({...loc,hash:'#account'},{replaceState:()=>assert.fail()}),'');
});
test('members never need to type a setup secret',()=>{
 const t=x=>x;const normal=passkeyMarkup({t}),setup=passkeyMarkup({t,setup:true});
 assert.doesNotMatch(normal+setup,/name="setupToken"|minlength="43"/);
 assert.match(normal,/No code to type/);assert.doesNotMatch(normal,/id="passkey-setup-form"/);
 assert.match(setup,/id="passkey-setup-form"/);assert.match(setup,/name="ownPhone" required/);
});
