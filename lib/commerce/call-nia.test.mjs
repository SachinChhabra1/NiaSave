import test from 'node:test';
import assert from 'node:assert/strict';
import {NIA_HELP_PHONE,niaHelpHref,callNiaMarkup} from '../../commerce-support.js';

const ctx={t:s=>s,esc:s=>String(s).replace(/"/g,'&quot;'),icon:()=>'<svg class="icon"></svg>'};

test('the help number is empty unless a test passes one in',()=>{
  assert.equal(NIA_HELP_PHONE,'');
  assert.equal(niaHelpHref(),'');
  assert.equal(niaHelpHref(''),'');
  assert.equal(niaHelpHref('123'),'');
  const html=callNiaMarkup(ctx);
  assert.match(html,/data-action="help"/);
  assert.doesNotMatch(html,/tel:/);
});

test('a test number is a tel link and still has the word',()=>{
  const href=niaHelpHref('0000000000');
  assert.equal(href,'tel:0000000000');
  const html=callNiaMarkup({...ctx,phone:'0000000000',label:'Call'});
  assert.match(html,/href="tel:0000000000"/);
  assert.match(html,/>Call</);
  assert.match(html,/<svg/);
  assert.doesNotMatch(html,/data-action="help"/);
});
