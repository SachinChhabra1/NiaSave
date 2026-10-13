import test from 'node:test';
import assert from 'node:assert/strict';
import {canAccessSaveStaff} from './save-staff-access.mjs';
test('Save staff access defaults to existing admins and exact opt-in emails only',()=>{
  const member={email:'person@nia.one',role:'living',desks:['living']};
  assert.equal(canAccessSaveStaff(null,{}),false);
  assert.equal(canAccessSaveStaff(member,{}),false);
  assert.equal(canAccessSaveStaff({...member,role:'admin'},{}),true);
  assert.equal(canAccessSaveStaff(member,{NIASAVE_SAVE_OPERATOR_EMAILS:'other@nia.one; PERSON@NIA.ONE'}),true);
  assert.equal(canAccessSaveStaff(member,{NIASAVE_SAVE_OPERATOR_EMAILS:'* @nia.one person@nia.one.attacker.example'}),false);
  assert.equal(canAccessSaveStaff({...member,email:''},{NIASAVE_SAVE_OPERATOR_EMAILS:' '}),false);
  assert.equal(member.role,'living');assert.deepEqual(member.desks,['living']);
});
