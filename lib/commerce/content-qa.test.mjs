import test from 'node:test';
import assert from 'node:assert/strict';
import {MEMBER_LANGUAGES, MIN_VIEWPORT_PX, fallbackCopy, journeyA11y, redactClientLog} from './content-qa.mjs';

test('four member languages; missing strings fall back to English', () => {
  assert.deepEqual(MEMBER_LANGUAGES, ['en','hi','ta','bn']);
  const dicts = {hi:{'Bag':'बैग'}, ta:{}, bn:{}};
  assert.equal(fallbackCopy('hi','Bag',dicts), 'बैग');
  assert.equal(fallbackCopy('ta','Bag',dicts), 'Bag');
  assert.equal(fallbackCopy('bn','Bag',dicts), 'Bag');
  assert.equal(fallbackCopy('xx','Bag',dicts), 'Bag');
  assert.equal(fallbackCopy('en','Bag',dicts), 'Bag');
});

test('core journeys need keyboard use, a name, and 320px width', () => {
  assert.equal(MIN_VIEWPORT_PX, 320);
  const ready = journeyA11y({
    minWidth: 320,
    keyboard: true,
    controls: [
      {action:'shop', ariaLabel:'Save', focusable:true},
      {action:'help', text:'Help', focusable:true}
    ]
  });
  assert.equal(ready.ok, true);
  const bad = journeyA11y({minWidth:280, keyboard:false, controls:[{action:'reserve', focusable:false}]});
  assert.ok(bad.issues.includes('viewport'));
  assert.ok(bad.issues.includes('keyboard'));
  assert.ok(bad.issues.some(i=>i.startsWith('label')));
  const iconOnly=journeyA11y({minWidth:320,keyboard:true,controls:[{action:'zoom',ariaLabel:'Zoom in',iconOnly:true,visibleLabel:'',focusable:true}]});
  assert.ok(iconOnly.issues.includes('visible-label:zoom'));
  assert.equal(journeyA11y({minWidth:320,keyboard:true,controls:[{action:'zoom',ariaLabel:'Zoom in',iconOnly:true,visibleLabel:'Zoom in',focusable:true}]}).ok,true);
});

test('staff bearer and member personal data never reach client logs', () => {
  assert.equal(redactClientLog('Bearer abc.def.ghi'), '[redacted]');
  assert.equal(redactClientLog({niaOpsToken:'secret', category:'ration'}).niaOpsToken, '[redacted]');
  assert.equal(redactClientLog({niaOpsToken:'secret', category:'ration'}).category, 'ration');
  assert.equal(redactClientLog({phone:'+919876543210'}).phone, '[redacted]');
  assert.equal(redactClientLog({staffBearerCredential:'random-secret'}).staffBearerCredential,'[redacted]');
  assert.equal(redactClientLog({nested:{sessionKey:'sensitive'}}).nested.sessionKey,'[redacted]');
  assert.equal(redactClientLog('tok_abcdefghijklmnop'),'[redacted]');
});
