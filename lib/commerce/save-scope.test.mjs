import test from 'node:test';
import assert from 'node:assert/strict';
import {saveLocations} from '../../commerce-save-scope.js';

const product={id:'save-product',locationIds:['loc-1'],modes:['pickup','delivery']};
const catalogue=(modes,products=[product])=>({owner:'niasave',locations:[{id:'loc-1',modes}],products});
const member={id:'member-1'};

test('member mode choices follow Central-granted location modes for the selected bag',()=>{
  const both=catalogue(['pickup','delivery']);
  assert.equal(saveLocations(both,member,'pickup',{[product.id]:1}).length,1);
  assert.equal(saveLocations(both,member,'delivery',{[product.id]:1}).length,1);
  assert.equal(saveLocations(catalogue(['pickup']),member,'delivery',{[product.id]:1}).length,0);
  assert.equal(saveLocations(catalogue(['delivery']),member,'pickup',{[product.id]:1}).length,0);
});

test('a selected product mode grant can narrow the available toggle without inventing a location mode',()=>{
  const cat=catalogue(['pickup','delivery'],[{...product,modes:['delivery']}]);
  assert.equal(saveLocations(cat,member,'pickup',{[product.id]:1}).length,0);
  assert.equal(saveLocations(cat,member,'delivery',{[product.id]:1}).length,1);
});
