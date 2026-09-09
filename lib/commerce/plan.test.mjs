import test from 'node:test';import assert from 'node:assert/strict';import {calculatePlan} from '../../commerce-plan.js';
const plan={income:'21000',essentials:'9500',debt:'1000',buffer:'2000',other:'500',home:'8000'};
test('monthly plan subtracts each planned total once and exposes the remittance gap',()=>{assert.deepEqual(calculatePlan(plan),{status:'ready',available:800000,home:800000,remaining:0,shortfall:0,amounts:{income:2100000,essentials:950000,debt:100000,buffer:200000,other:50000,home:800000}});assert.equal(calculatePlan({...plan,home:'9000'}).shortfall,100000);assert.equal(calculatePlan({...plan,income:'5000'}).available,-800000);});
test('unknown budgets are not zero, invalid amounts do not calculate, and paise stay exact',()=>{for(const value of ['',null,undefined])assert.equal(calculatePlan({...plan,income:value}).status,'incomplete');for(const value of ['-1','NaN','1.001','Infinity','1000001'])assert.equal(calculatePlan({...plan,income:value}).status,'invalid');const r=calculatePlan({income:'0.30',essentials:'0.10',debt:'0',buffer:'0',other:'0',home:'0.20'});assert.equal(r.remaining,0);assert.equal(r.shortfall,0);});
import {fieldsFromValues,valuesFromFields,sameFields} from '../../commerce-plan.js';
test('rupee inputs map to Central paise and back; blank stays unknown and never becomes zero',()=>{
  assert.deepEqual(fieldsFromValues({income:'21000',essentials:'9500.50',debt:'0',buffer:'',other:'500',home:'8000'}),{incomePaise:2100000,essentialsPaise:950050,debtPaise:0,bufferPaise:null,otherPaise:50000,homePaise:800000});
  assert.equal(fieldsFromValues({income:'abc'}),null);assert.equal(fieldsFromValues({income:'1000001'}),null);
  assert.deepEqual(valuesFromFields({incomePaise:2100000,essentialsPaise:950050,debtPaise:0,bufferPaise:null,otherPaise:50000,homePaise:800000}),{income:'21000',essentials:'9500.50',debt:'0',buffer:'',other:'500',home:'8000'});
  assert.deepEqual(valuesFromFields(null),{income:'',essentials:'',debt:'',buffer:'',other:'',home:''});
  assert.equal(sameFields(fieldsFromValues(valuesFromFields({incomePaise:1,essentialsPaise:null,debtPaise:0,bufferPaise:null,otherPaise:null,homePaise:99})),{incomePaise:1,essentialsPaise:null,debtPaise:0,bufferPaise:null,otherPaise:null,homePaise:99}),true);
  assert.equal(sameFields({incomePaise:1},{incomePaise:2}),false);
});
test('saved-state comparison ignores key order and treats missing keys as unknown',()=>{
  assert.equal(sameFields({homePaise:1,incomePaise:2,essentialsPaise:null,debtPaise:null,bufferPaise:null,otherPaise:null},{incomePaise:2,homePaise:1}),true);
  assert.equal(sameFields({incomePaise:2},{incomePaise:3}),false);assert.equal(sameFields(null,{incomePaise:1}),false);assert.equal(sameFields(null,null),true);
});
