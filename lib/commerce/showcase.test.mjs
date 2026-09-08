import test from 'node:test';
import assert from 'node:assert/strict';
import { showcaseReady } from './showcase-mode.mjs';
import { showcaseAccess } from '../../showcase/access.mjs';
const valid={NIA_SHOWCASE:'1',NIA_SHOWCASE_ENTRY:'isolated-v1',VERCEL_ENV:'preview',SHOWCASE_INSTANCE:'showcase-test-instance',SHOWCASE_DATABASE_URL:'postgresql://test.invalid/showcase',SHOWCASE_PASSWORD:'x'.repeat(32),SHOWCASE_CENTRAL_KEY:'y'.repeat(32)};
test('showcase requires isolated entry and storage; custom-domain production requires explicit project approval',()=>{
 assert.equal(showcaseReady(valid),true);
 for(const key of Object.keys(valid).filter(k=>k!=='VERCEL_ENV')) assert.equal(showcaseReady({...valid,[key]:''}),false,key);
 assert.equal(showcaseReady({...valid,VERCEL_ENV:'production'}),false);
 const domain={...valid,VERCEL_ENV:'production',SHOWCASE_ALLOW_CUSTOM_DOMAIN:'1',SHOWCASE_PROJECT_ID:'prj_TestSite',VERCEL_PROJECT_ID:'prj_TestSite'};
 assert.equal(showcaseReady(domain),true);
 assert.equal(showcaseReady({...domain,VERCEL_PROJECT_ID:'prj_OtherSite'}),false);
 assert.equal(showcaseReady({...domain,SHOWCASE_ALLOW_CUSTOM_DOMAIN:''}),false);
 assert.equal(showcaseReady({...valid,SHOWCASE_DATABASE_URL:'',DATABASE_URL:'postgresql://live.invalid/live'}),false);
});
test('invitation auth rejects missing, malformed, wrong user and wrong password',()=>{
 const auth=s=>'Basic '+Buffer.from(s).toString('base64');
 assert.equal(showcaseAccess(auth('showcase:'+valid.SHOWCASE_PASSWORD),valid.SHOWCASE_PASSWORD),true);
 for(const h of [undefined,'','Bearer token','Basic ???',auth('admin:'+valid.SHOWCASE_PASSWORD),auth('showcase:wrong')]) assert.equal(showcaseAccess(h,valid.SHOWCASE_PASSWORD),false);
 assert.equal(showcaseAccess(auth('showcase:short'),'short'),false);
});
