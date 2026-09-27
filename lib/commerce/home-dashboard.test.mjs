import test from 'node:test';
import assert from 'node:assert/strict';
import {homeDashboardModel,homeDashboardMarkup} from '../../commerce-home.js';

const ready=data=>({status:'ready',data});
const base=()=>({stay:ready({bookings:[]}),earn:ready({map:{status:'ready',asOf:new Date().toISOString(),studio:{id:'s1',name:'Nest',lat:12,lng:77,verified:true}},jobs:[]}),fee:ready({next:'ready'}),send:ready({months:[]}),catalogue:ready({products:[]})});
const model=(changes={})=>homeDashboardModel({...base(),...changes});
test('home never invents a membership fee or presents preview jobs as real nearby work',()=>{
  const m=model({earn:ready({...base().earn.data,jobs:[{id:'demo',preview:true,mandateStatus:'open',openPositions:2,closesAt:new Date(Date.now()+3600000).toISOString(),workplace:{lat:12.1,lng:77.1,verified:true}}]})});
  assert.equal(m.fee.state,'source_missing');
  assert.equal(m.job.state,'empty');
  assert.equal(m.job.job,null);
});
test('home uses a Central booking and fresh verified job; offline suppresses ready labels',()=>{
  const job={id:'j1',title:'Role',employer:'Employer',preview:false,mandateStatus:'open',openPositions:1,closesAt:new Date(Date.now()+3600000).toISOString(),workplace:{lat:12.1,lng:77.1,verified:true}};
  const data={stay:ready({bookings:[{name:'Nest',status:'in'}]}),earn:ready({...base().earn.data,jobs:[job]})};
  const m=model(data);assert.equal(m.stay.booking.name,'Nest');assert.equal(m.job.job.id,'j1');
  const html=homeDashboardMarkup(m,{t:s=>s,esc:s=>String(s),icon:()=>''});
  assert.match(html,/Employer/);assert.match(html,/Example role|Role/);assert.doesNotMatch(html,/Membership fee details are not available from Central/);assert.doesNotMatch(html,/₹|confirmed/i);
  assert.equal(model({...data,online:false}).job.state,'offline');
});
test('home hides attention unless a stay or job is ready, and shows a server price line as sent',()=>{
  const hidden=homeDashboardMarkup(model(),{t:s=>s,esc:s=>String(s),icon:()=>''});
  assert.doesNotMatch(hidden,/Needs attention/);
  assert.doesNotMatch(hidden,/Temporarily unavailable/);
  assert.doesNotMatch(hidden,/Getting your details/);
  const loading=homeDashboardMarkup(homeDashboardModel({stay:{status:'loading'},earn:{status:'loading'},fee:{status:'loading'},send:{status:'loading'},catalogue:{status:'loading'}}),{t:s=>s,esc:s=>String(s),icon:()=>''});
  assert.doesNotMatch(loading,/home-attention-card/);
  const priced=model({catalogue:{status:'ready',data:{products:[{id:'a',name:'Atta',shopCategoryId:'atta',unitPricePaise:5200,unit:'kg',lowestUnitPriceInCategory:true},{id:'b',name:'Rice',shopCategoryId:'rice',unitPricePaise:3000,unit:'kg',lowestUnitPriceInCategory:true}]}}});
  assert.equal(priced.shopPrice.category,'Atta');
  assert.match(homeDashboardMarkup(priced,{t:s=>s,esc:s=>String(s),icon:()=>''}),/Atta: ₹52 a kilo/);
  assert.doesNotMatch(homeDashboardMarkup(priced,{t:s=>s,esc:s=>String(s),icon:()=>''}),/Rice: ₹30/);
  const sent=model({catalogue:{status:'ready',data:{lowestUnitPriceLine:'Atta: Rs 40 a kilo',products:[{shopCategoryId:'atta',unitPricePaise:100,unit:'kg',lowestUnitPriceInCategory:true}]}}});
  assert.equal(sent.shopPrice.line,'Atta: Rs 40 a kilo');
  assert.match(homeDashboardMarkup(sent,{t:s=>s,esc:s=>String(s),icon:()=>''}),/Atta: Rs 40 a kilo/);
  assert.doesNotMatch(homeDashboardMarkup(sent,{t:s=>s,esc:s=>String(s),icon:()=>''}),/₹1/);
});
test('seven source states remain distinct and malformed Central payloads are not empty',()=>{
  const data=base();
  for(const status of ['loading','ready','stale','source_missing','unavailable','empty','offline']){
    const m=model({...data,stay:{status,data:{bookings:status==='ready'?[{name:'Nest',status:'in'}]:[]}},online:status!=='offline'});
    assert.equal(m.stay.state,status);
  }
  assert.equal(model({stay:ready({})}).stay.state,'source_missing');
  assert.equal(model({earn:ready({map:{status:'stale'},jobs:[]})}).job.state,'stale');
});
