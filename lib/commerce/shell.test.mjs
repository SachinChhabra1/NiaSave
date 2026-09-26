import test from 'node:test';
import assert from 'node:assert/strict';
import {memberShellState,lessNavIcon} from '../../commerce-shell.js';

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
