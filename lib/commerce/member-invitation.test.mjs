import test from 'node:test';
import assert from 'node:assert/strict';
import {memberInvitation} from './member-invitation.mjs';

const env={
  COMMERCE_STOREFRONT:'1',
  COMMERCE_MEMBER_AUTH:'passkey',
  MEMBER_SITE_ORIGIN:'https://www.nia.test',
  MEMBER_INVITE_GATE:'1',
  MEMBER_INVITE_PASSWORD:'x'.repeat(32),
};
const auth='Basic '+Buffer.from('showcase:'+env.MEMBER_INVITE_PASSWORD).toString('base64');

test('member invitation protects pages and direct member API aliases',()=>{
  for(const path of [
    '/',
    '/commerce.js',
    '/api/commerce/catalogue',
    '/api/api/commerce/catalogue',
    '/api?path=commerce/catalogue',
    '/api/index?path=/commerce/auth/passkey/options',
    '/api/index.mjs?path=api/commerce/catalogue',
  ]){
    assert.equal(memberInvitation(new Request('https://www.nia.test'+path),env).status,401);
    assert.equal(memberInvitation(new Request('https://www.nia.test'+path,{headers:{authorization:auth}}),env),undefined);
  }
});

test('member entry routes return an HTML invitation page instead of plain text',async()=>{
  const response=memberInvitation(new Request('https://www.nia.test/'),env);
  assert.equal(response.status,401);
  assert.match(response.headers.get('content-type')||'',/^text\/html\b/i);
  assert.equal(response.headers.get('www-authenticate'),'Basic realm="NiaSave invited access", charset="UTF-8"');
  assert.match(await response.text(),/NiaSave invited access/i);
});

test('member APIs keep challenge semantics and do not return the HTML invite shell',async()=>{
  const response=memberInvitation(new Request('https://www.nia.test/api/commerce/catalogue'),env);
  assert.equal(response.status,401);
  assert.equal(response.headers.get('www-authenticate'),'Basic realm="NiaSave invited access", charset="UTF-8"');
  assert.ok(!/text\/html/i.test(response.headers.get('content-type')||''));
});

test('an incomplete production gate fails closed',()=>{
  for(const change of [
    {MEMBER_INVITE_PASSWORD:''},
    {MEMBER_INVITE_GATE:'0'},
    {COMMERCE_MEMBER_AUTH:'legacy'},
    {MEMBER_SITE_ORIGIN:'http://www.nia.test'},
  ]){
    assert.equal(memberInvitation(new Request('https://www.nia.test/'),{...env,...change}).status,503);
  }
});

test('frontend aliases redirect to the exact passkey origin; foreign-origin posts do not',()=>{
  const response=memberInvitation(new Request('https://deployment.test/commerce.html?lang=hi'),env);
  assert.equal(response.status,308);
  assert.equal(response.headers.get('location'),'https://www.nia.test/commerce.html?lang=hi');
  assert.equal(memberInvitation(new Request('https://deployment.test/',{method:'POST'}),env).status,403);
});

test('a staged API still requires the invitation and keeps its own origin check in the handler',()=>{
  assert.equal(memberInvitation(new Request('https://deployment.test/api/commerce/catalogue'),env).status,401);
  assert.equal(memberInvitation(new Request('https://deployment.test/api/commerce/catalogue',{headers:{authorization:auth}}),env),undefined);
});

test('Central signed gateway and existing staff authentication remain independent',()=>{
  for(const path of ['/api/central/commerce','/api?path=central/commerce','/api/staff/me','/ops.html']){
    assert.equal(memberInvitation(new Request('https://www.nia.test'+path),env),undefined);
  }
});

test('staff module loads without an invitation while member assets and APIs remain gated',()=>{
  for(const origin of ['https://www.nia.test','https://deployment.test']){
    assert.equal(memberInvitation(new Request(origin+'/commerce-ops.js'),env),undefined);
    for(const path of ['/commerce.js','/commerce.html','/commerce-passkeys.js','/api/commerce/catalogue']){
      assert.ok(memberInvitation(new Request(origin+path),env));
    }
  }
});
