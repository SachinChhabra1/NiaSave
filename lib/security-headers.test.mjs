import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const headers=Object.fromEntries(config.headers.find(r=>r.source==='/(.*)').headers.map(h=>[h.key.toLowerCase(),h.value]));
test('all routes carry transport, framing, MIME, referrer and device restrictions',()=>{
  assert.equal(headers['x-content-type-options'],'nosniff');
  assert.equal(headers['x-frame-options'],'DENY');
  assert.equal(headers['strict-transport-security'],'max-age=31536000');
  assert.equal(headers['referrer-policy'],'same-origin');
  for(const directive of ['camera=()','payment=()','usb=()']) assert.ok(headers['permissions-policy'].includes(directive));
  for(const directive of ["frame-ancestors 'none'","object-src 'none'","form-action 'self'","base-uri 'self'"]) assert.ok(headers['content-security-policy'].includes(directive));
});
test('production member documents use same-origin scripts without inline or eval execution',()=>{
  for(const source of ['/','/index.html','/commerce(.*)']) {
    const policy=config.headers.filter(r=>r.source===source).flatMap(r=>r.headers).findLast(h=>h.key==='Content-Security-Policy').value;
    assert.match(policy,/script-src 'self';/);
    assert.doesNotMatch(policy,/unsafe-eval|script-src[^;]*unsafe-inline/);
    assert.match(policy,/https:\/\/tile.openstreetmap.org/);
  }
  const html=readFileSync(new URL('../commerce.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i);
  assert.doesNotMatch(html,/\son\w+\s*=/i);
});
