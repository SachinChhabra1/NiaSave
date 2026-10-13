import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {moneyStatusState,moneyStatusMarkup} from '../../commerce-money-status.js';

const context={t:s=>s,esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
test('a request remains requested until Central acknowledges reservation or confirmation',()=>{
  assert.equal(moneyStatusState({status:'requested'}),'requested');
  assert.equal(moneyStatusState({status:'interested',centralAcknowledged:true}),'requested');
  assert.equal(moneyStatusState({status:'selected',centralAcknowledged:true}),'requested');
  assert.equal(moneyStatusState({status:'reserved'}),'requested');
  assert.equal(moneyStatusState({status:'reserved',centralAcknowledged:true}),'reserved');
  assert.equal(moneyStatusState({status:'confirmed'}),'requested');
  assert.equal(moneyStatusState({status:'confirmed',centralAcknowledged:true}),'confirmed');
  assert.equal(moneyStatusState({status:'cancelled',centralAcknowledged:true}),null);
});
test('an unsynced offline tap reads queued before any other state',()=>{
  for(const status of ['requested','reserved','confirmed']){
    const markup=moneyStatusMarkup({status,centralAcknowledged:true,offlineQueued:true,kind:'shop',record:{heldForPickupBy:'Operator'}},context);
    assert.match(markup,/data-money-state="queued"/);
    assert.doesNotMatch(markup,/data-money-state="reserved"|data-money-state="confirmed"|Held for pickup by/);
  }
  assert.equal(moneyStatusState({status:'reserved',centralAcknowledged:true,offlineQueued:false}),'reserved');
});
test('pickup operator is rendered only from an explicit Central record and escaped',()=>{
  const status={status:'reserved',centralAcknowledged:true,kind:'shop'};
  assert.match(moneyStatusMarkup({...status,record:{heldForPickupBy:'Asha <script>'}},context),/Held for pickup by.*Asha &lt;script&gt;/s);
  assert.match(moneyStatusMarkup({...status,record:{}},context),/We do not have a name for who hands you the bag/);
  assert.doesNotMatch(moneyStatusMarkup({...status,record:{location:{name:'Ompal'}}},context),/Held for pickup by/);
  assert.doesNotMatch(moneyStatusMarkup({...status,record:{heldForPickupBy:'Asha'},kind:'live'},context),/Held for pickup by/);
});
test('a Shop request chip stays visible online, offline, and on an order',()=>{
  const online=moneyStatusMarkup({status:'requested',kind:'shop'},context);
  assert.match(online,/data-money-state="requested"/);
  assert.match(online,/>Requested</);
  const offline=moneyStatusMarkup({status:'requested',offlineQueued:true,kind:'shop'},context);
  assert.match(offline,/data-money-state="queued"/);
  assert.match(offline,/>Queued on this phone</);
  const ordered=moneyStatusMarkup({status:'requested',centralAcknowledged:true,kind:'shop',record:{id:'ord-1',status:'requested'}},context);
  assert.match(ordered,/>Requested</);
  assert.doesNotMatch(ordered,/You asked Nia for this order/);
  assert.match(moneyStatusMarkup({status:'requested',kind:'earn'},context),/>Requested</);
});
test('shared renderer is wired into Shop, Live and Earn and has four locale entries',()=>{
  const src=fs.readFileSync(new URL('../../commerce.js',import.meta.url),'utf8');
  const build=fs.readFileSync(new URL('../../vercel-build.sh',import.meta.url),'utf8');
  for(const kind of ['shop','live','earn'])assert.match(src,new RegExp("kind:'"+kind+"'"));
  assert.match(build,/commerce-money-status\.js/);
  for(const lang of ['hi','ta','bn']){
    const locale=fs.readFileSync(new URL('../../commerce-locales/'+lang+'.js',import.meta.url),'utf8');
    for(const key of ['Requested','Reserved','Confirmed','Queued on this phone','Held for pickup by','We do not have a name for who hands you the bag.'])
      assert.ok(locale.includes(JSON.stringify(key)),lang+': '+key);
  }
});
