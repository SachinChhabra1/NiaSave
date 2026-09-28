import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {memberShellState,lessNavIcon,catalogueDenialIsSignIn,shellStatusWord} from '../../commerce-shell.js';

const asOf='2026-09-24T10:00:00.000Z';
const at=Date.parse(asOf);
const base={online:true,readAsOf:asOf,readAt:at,now:at+1000};

test('synced requires a successful Central-validated read and expires as a display signal',()=>{
  assert.equal(memberShellState(base),'synced');
  assert.equal(memberShellState({...base,readAsOf:null}),'checking');
  assert.equal(memberShellState({...base,readFailed:true}),'stale');
  assert.equal(memberShellState({...base,now:at+61000}),'stale');
});
test('an unsynced tap is queued offline and needs a retry online, never presented as accepted',()=>{
  assert.equal(memberShellState({...base,online:false,pendingCount:1}),'queued');
  assert.equal(memberShellState({...base,pendingCount:1}),'retry');
  assert.equal(memberShellState({...base,online:false,pendingCount:0}),'offline');
});
test('one four-item LESS nav uses outline icons with the specified stroke',()=>{
  for(const name of ['live','earn','shop','send'])assert.match(lessNavIcon(name),/stroke-width="1.5"/);
  assert.equal(lessNavIcon('home'),'');
});
test('successful public Nia catalogue requests sign-in without claiming stock is synced',()=>{
  const guest={...base,readAsOf:null,sourceOwner:'niasave',signedIn:false};
  assert.equal(memberShellState(guest),'signin');
  assert.equal(memberShellState({...guest,readAt:undefined}),'checking');
  assert.equal(memberShellState({...guest,readFailed:true}),'stale');
  assert.equal(memberShellState({...guest,now:at+61000}),'stale');
  assert.equal(memberShellState({...guest,readAt:at+2000}),'stale');
  assert.equal(memberShellState({...guest,online:false}),'offline');
  assert.equal(memberShellState({...guest,pendingCount:1}),'retry');
  assert.equal(memberShellState({...guest,sourceOwner:'central'}),'checking');
  assert.equal(memberShellState({...guest,signedIn:true}),'checking');
  assert.equal(memberShellState({...base,sourceOwner:'niasave',signedIn:true}),'synced');
});

const FAILURE='Details did not load.';
const SIGNIN='Log in to see what is here';

test('signed out and the catalogue read succeeds is sign-in, not a failed read',()=>{
  const guest={...base,readAsOf:null,sourceOwner:'niasave',signedIn:false,readFailed:false};
  assert.equal(memberShellState(guest),'signin');
  assert.equal(shellStatusWord({readFailed:false,homeQuiet:false,state:'signin'}),SIGNIN);
  assert.notEqual(shellStatusWord({readFailed:false,homeQuiet:false,state:'signin'}),FAILURE);
  assert.equal(shellStatusWord({readFailed:false,homeQuiet:true,state:'signin'}),'');
});

test('signed out and the catalogue read is 403 is sign-in',()=>{
  assert.equal(catalogueDenialIsSignIn({status:403,message:'forbidden'},{hadSession:false}),true);
  assert.equal(memberShellState({online:true,signedIn:false,guestAuth:true,readFailed:false,readAt:at,now:at+1000,readAsOf:null}),'signin');
  assert.equal(shellStatusWord({readFailed:false,homeQuiet:false,state:'signin'}),SIGNIN);
  assert.notEqual(shellStatusWord({readFailed:false,homeQuiet:false,state:'signin'}),FAILURE);
});

test('signed out and the catalogue read is 401 is sign-in',()=>{
  assert.equal(catalogueDenialIsSignIn({status:401},{hadSession:false}),true);
  assert.equal(memberShellState({online:true,signedIn:false,guestAuth:true,readFailed:false,readAt:at,now:at+1000}),'signin');
  assert.equal(shellStatusWord({readFailed:false,homeQuiet:false,state:'signin'}),SIGNIN);
});

test('a real catalogue failure still says details did not load',()=>{
  assert.equal(catalogueDenialIsSignIn({uncertain:true,message:'Connection interrupted.'},{hadSession:false}),false);
  assert.equal(catalogueDenialIsSignIn({status:500},{hadSession:false}),false);
  assert.equal(catalogueDenialIsSignIn({status:503},{hadSession:false}),false);
  assert.equal(catalogueDenialIsSignIn({status:403},{hadSession:true}),false);
  assert.equal(catalogueDenialIsSignIn({status:401},{hadSession:true}),false);
  for(const state of ['checking','stale','offline','signin','synced']){
    assert.equal(shellStatusWord({readFailed:true,homeQuiet:false,state}),FAILURE);
    assert.equal(shellStatusWord({readFailed:true,homeQuiet:true,state}),FAILURE);
    assert.notEqual(shellStatusWord({readFailed:true,homeQuiet:false,state}),SIGNIN);
  }
  assert.equal(shellStatusWord({readFailed:false,homeQuiet:false,state:'retry'}),'Request needs retry');
});

test('the catalogue call is unchanged and a guest denial is decided after it returns',()=>{
  const src=fs.readFileSync(new URL('../../commerce.js',import.meta.url),'utf8');
  const refresh=src.slice(src.indexOf('async function refresh(){'),src.indexOf('async function go('));
  const call=refresh.indexOf("cat=await api('/catalogue')");
  const had=refresh.indexOf('const hadSession=Boolean(account||owner.active)');
  assert.ok(call>0);
  assert.ok(had>=0&&had<call);
  assert.equal(refresh.split("api('/catalogue')").length-1,1);
  const caught=refresh.slice(refresh.indexOf('}catch(e){'));
  assert.match(caught,/catalogueDenialIsSignIn\(e,\{hadSession\}\)/);
  assert.match(caught,/shellGuestAuth=guestSignIn/);
  assert.match(caught,/shellReadFailed=!guestSignIn/);
  assert.match(caught,/if\(guestSignIn\)\{shellReadAt=Date\.now\(\);entryError='';\}else\{entryError=e\.message;throw e;\}/);
  assert.doesNotMatch(caught,/shellReadFailed=true/);
  assert.match(src,/guestAuth:shellGuestAuth/);
  assert.match(src,/shellStatusWord\(\{readFailed:shellReadFailed,homeQuiet,state\}\)/);
  assert.doesNotMatch(src,/shellReadFailed&&state==='checking'/);
});
