import test from 'node:test';
import assert from 'node:assert/strict';
import {
  usesPhoneAuth, usesPasswordAuth, e164In, nationalMobile, rememberOn,
  authErrorText, needsSetPassword, setPasswordToken, setPasswordPaths,
  passwordBody, setPasswordIssue, submitSetPassword,
  phoneFormMarkup, verifyFormMarkup, setPasswordFormMarkup, rememberFormMarkup, passwordFormMarkup
} from '../../commerce-member-auth.js';

const t = (en) => en;

test('catalogue modes pick phone OTP set-password without treating passkey as phone', () => {
  assert.equal(usesPhoneAuth({memberAuth: 'passkey'}), false);
  assert.equal(usesPhoneAuth({memberAuth: 'password'}), false);
  assert.equal(usesPhoneAuth({memberAuth: 'legacy'}), true);
  assert.equal(usesPhoneAuth({memberAuth: 'phone'}), true);
  assert.equal(usesPhoneAuth({memberAuth: 'phone_otp_password'}), true);
  assert.equal(usesPhoneAuth({memberAuth: 'password', capabilities: {phoneOtp: true}}), true);
  assert.equal(usesPasswordAuth({memberAuth: 'password'}), true);
  assert.equal(usesPasswordAuth({memberAuth: 'legacy'}), false);
});

test('Indian mobile numbers normalise to +91 without inventing members', () => {
  assert.equal(e164In('9876543210'), '+919876543210');
  assert.equal(e164In('+91 98765 43210'), '+919876543210');
  assert.equal(e164In('09876543210'), '+919876543210');
  assert.equal(e164In('1234567890'), '');
  assert.equal(e164In('98765'), '');
  assert.equal(nationalMobile('+919876543210'), '9876543210');
});

test('agreed error codes map to English copy and do not invent success', () => {
  assert.match(authErrorText('not_registered', t), /not registered for NiaSave/);
  assert.match(authErrorText('access_not_granted', t), /not registered for NiaSave/);
  assert.match(authErrorText('bad_otp', t), /not correct/);
  assert.match(authErrorText('weak_password', t), /8 characters/);
  assert.equal(authErrorText('unknown_code', t), undefined);
  assert.equal(setPasswordIssue({password: 'short', confirm: 'short'}), 'weak_password');
  assert.equal(setPasswordIssue({password: 'long-enough', confirm: 'different'}), 'password_mismatch');
  assert.equal(setPasswordIssue({password: 'long-enough', confirm: 'long-enough'}), '');
});

test('verify payload decides set-password versus existing session', () => {
  assert.equal(needsSetPassword({account: {id: 'm1'}}, {memberAuth: 'legacy'}), false);
  assert.equal(needsSetPassword({needsPassword: true}, {memberAuth: 'legacy'}), true);
  assert.equal(needsSetPassword({next: 'set_password', setPasswordToken: 'tok'}, {memberAuth: 'phone'}), true);
  assert.equal(setPasswordToken({passwordToken: 'abc'}), 'abc');
  assert.deepEqual(setPasswordPaths({passwordPath: '/auth/password'}, {}), [
    '/auth/password', '/auth/set-password', '/auth/password/set', '/auth/update-password'
  ]);
});

test('remember flag and password body stay defensive for Codex field names', () => {
  assert.equal(rememberOn({remember: 'on'}), true);
  assert.equal(rememberOn({}), false);
  const body = passwordBody({password: 'secret-pass', confirm: 'secret-pass', remember: 'on'}, {
    phone: '+919876543210', challenge: 'ch', token: 'tok'
  });
  assert.equal(body.password, 'secret-pass');
  assert.equal(body.remember, true);
  assert.equal(body.phone, '+919876543210');
  assert.equal(body.token, 'tok');
  assert.equal(body.setPasswordToken, 'tok');
});

test('set-password tries agreed paths and does not invent success on 404', async () => {
  const calls = [];
  const api = async (path) => {
    calls.push(path);
    throw {status: 404, code: 'not_found'};
  };
  await assert.rejects(() => submitSetPassword(api, {password: 'secret-pass'}, {memberAuth: 'phone'}), e => e.code === 'not_found');
  assert.deepEqual(calls, ['/auth/password', '/auth/set-password', '/auth/password/set', '/auth/update-password']);
  const ok = await submitSetPassword(async (path) => {
    if (path !== '/auth/set-password') throw {status: 404, code: 'not_found'};
    return {ok: true};
  }, {password: 'secret-pass'}, {memberAuth: 'phone'});
  assert.deepEqual(ok, {ok: true});
});

test('presentation markup covers the four founder steps', () => {
  const phone = phoneFormMarkup({t, esc: s => s, phone: '9876543210', passwordLink: true});
  assert.match(phone, /id="login-form"/);
  assert.match(phone, /\+91/);
  assert.match(phone, /name="phone"/);
  assert.match(phone, /Use your mobile number|Already have a password/);
  const verify = verifyFormMarkup({t, esc: s => s, phone: '+919876543210'});
  assert.match(verify, /id="verify-form"/);
  assert.match(verify, /\+919876543210/);
  const set = setPasswordFormMarkup({t});
  assert.match(set, /id="set-password-form"/);
  assert.match(set, /name="remember"/);
  const remember = rememberFormMarkup({t});
  assert.match(remember, /id="remember-form"/);
  const password = passwordFormMarkup({t, phoneLink: true});
  assert.match(password, /name="remember"/);
  assert.match(password, /data-action="phone-login"/);
});
