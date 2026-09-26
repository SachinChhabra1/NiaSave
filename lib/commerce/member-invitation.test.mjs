import test from 'node:test';
import assert from 'node:assert/strict';
import {memberInvitation} from './member-invitation.mjs';
import middleware from '../../middleware.js';
const env={COMMERCE_STOREFRONT:'1',COMMERCE_MEMBER_AUTH:'passkey',MEMBER_SITE_ORIGIN:'https://www.nia.test'};

test('first-visit pages and assets reach persistent login without a Basic challenge',()=>{
  for(const path of ['/','/index.html','/commerce.html','/commerce.js','/commerce.css','/commerce-passkeys.js','/commerce-member-auth.js','/commerce-locales/hi.json','/member.html','/member-services.html']){
    for(const method of ['GET','HEAD'])assert.equal(memberInvitation(new Request('https://www.nia.test'+path,{method}),env),undefined);
  }
});
test('retired invitation settings cannot add a shared password prompt',()=>{
  for(const change of [{MEMBER_INVITE_GATE:'1',MEMBER_INVITE_PASSWORD:'old-setting'},{MEMBER_INVITE_GATE:'0'},{MEMBER_INVITE_PASSWORD:''}])assert.equal(memberInvitation(new Request('https://www.nia.test/'),{...env,...change}),undefined);
});
test('API aliases pass to server identity verification',()=>{
  for(const path of ['/api/commerce/catalogue','/api/api/commerce/orders','/api?path=commerce/orders','/api/index?path=/commerce/auth/passkey/options','/api/index.mjs?path=api/commerce/orders'])assert.equal(memberInvitation(new Request('https://www.nia.test'+path),env),undefined);
});
test('password member auth still reaches persistent login without a Basic challenge',()=>{
  assert.equal(memberInvitation(new Request('https://www.nia.test/'),{...env,COMMERCE_MEMBER_AUTH:'password'}),undefined);
});

test('actual storefront middleware permits OTP entry and API aliases without bypassing origin or staff guards',async()=>{
  const keys=['COMMERCE_STOREFRONT','COMMERCE_MEMBER_AUTH','MEMBER_SITE_ORIGIN'];
  const saved=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  Object.assign(process.env,{...env,COMMERCE_MEMBER_AUTH:'otp'});
  try {
    for(const path of ['/','/index.html','/commerce.js','/commerce-member-auth.js','/api/commerce/catalogue','/api?path=commerce/catalogue','/api/index.mjs?path=api/commerce/auth/verify','/api/api/commerce/orders']){
      assert.equal(await middleware(new Request('https://www.nia.test'+path)),undefined,path+' must reach its existing handler');
    }
    assert.equal(await middleware(new Request('https://www.nia.test/api/commerce/auth/verify',{method:'POST'})),undefined);
    const redirected=await middleware(new Request('https://deployment.test/?lang=hi'));
    assert.equal(redirected.status,308);assert.equal(redirected.headers.get('location'),'https://www.nia.test/?lang=hi');
    assert.equal((await middleware(new Request('https://deployment.test/',{method:'POST'}))).status,403);
    assert.equal((await middleware(new Request('https://www.nia.test/ops.html'))).status,401,'OTP member configuration grants no staff access');
    for(const mode of ['legacy','', 'OTP','unconfigured']){
      process.env.COMMERCE_MEMBER_AUTH=mode;
      for(const path of ['/','/api/commerce/catalogue','/api?path=commerce/orders'])assert.equal((await middleware(new Request('https://www.nia.test'+path))).status,503);
    }
    process.env.COMMERCE_MEMBER_AUTH='otp';process.env.MEMBER_SITE_ORIGIN='http://www.nia.test';
    assert.equal((await middleware(new Request('https://www.nia.test/'))).status,503);
  } finally {
    for(const [key,value] of Object.entries(saved))if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
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
