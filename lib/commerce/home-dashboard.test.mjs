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
  assert.match(html,/Employer/);assert.match(html,/Membership fee details are not available from Central/);assert.doesNotMatch(html,/₹|confirmed/i);
  assert.equal(model({...data,online:false}).job.state,'offline');
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
