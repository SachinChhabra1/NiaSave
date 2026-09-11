import test from 'node:test';
import assert from 'node:assert/strict';
import {memberInvitation} from './member-invitation.mjs';
const env={COMMERCE_STOREFRONT:'1',COMMERCE_MEMBER_AUTH:'passkey',MEMBER_SITE_ORIGIN:'https://www.nia.test'};

test('first-visit pages and assets reach persistent login without a Basic challenge',()=>{
  for(const path of ['/','/index.html','/commerce.html','/commerce.js','/commerce.css','/commerce-passkeys.js','/commerce-locales/hi.json','/member.html','/member-services.html']){
    for(const method of ['GET','HEAD'])assert.equal(memberInvitation(new Request('https://www.nia.test'+path,{method}),env),undefined);
  }
});
test('retired invitation settings cannot add a shared password prompt',()=>{
  for(const change of [{MEMBER_INVITE_GATE:'1',MEMBER_INVITE_PASSWORD:'old-setting'},{MEMBER_INVITE_GATE:'0'},{MEMBER_INVITE_PASSWORD:''}])assert.equal(memberInvitation(new Request('https://www.nia.test/'),{...env,...change}),undefined);
});
test('API aliases pass to server identity verification',()=>{
  for(const path of ['/api/commerce/catalogue','/api/api/commerce/orders','/api?path=commerce/orders','/api/index?path=/commerce/auth/passkey/options','/api/index.mjs?path=api/commerce/orders'])assert.equal(memberInvitation(new Request('https://www.nia.test'+path),env),undefined);
});
test('invalid canonical origin or legacy member auth still fails closed',()=>{
  for(const change of [{MEMBER_SITE_ORIGIN:''},{MEMBER_SITE_ORIGIN:'http://www.nia.test'},{MEMBER_SITE_ORIGIN:'https://www.nia.test/path'},{COMMERCE_MEMBER_AUTH:'legacy'}])assert.equal(memberInvitation(new Request('https://www.nia.test/'),{...env,...change}).status,503);
});
test('frontend aliases redirect to exact passkey origin; foreign-origin posts do not',()=>{
  const r=memberInvitation(new Request('https://deployment.test/commerce.html?lang=hi'),env);
  assert.equal(r.status,308);assert.equal(r.headers.get('location'),'https://www.nia.test/commerce.html?lang=hi');
  assert.equal(memberInvitation(new Request('https://deployment.test/',{method:'POST'}),env).status,403);
});
test('Central signed gateway and staff checks remain independent',()=>{
  for(const path of ['/api/central/commerce','/api?path=central/commerce','/api/staff/me','/ops.html','/commerce-ops.js'])assert.equal(memberInvitation(new Request('https://www.nia.test'+path),env),undefined);
});
