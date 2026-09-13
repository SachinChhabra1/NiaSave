import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectEntry} from './route-audit.mjs';

test('a route accepting a price fails the audit',()=>{
 assert.equal(inspectEntry("export default function(req,res){save({price:req.body.price});res.end();}",'api/new.mjs').length,1);
});
test('a protected read route passes',()=>{
 const src="import {enforceP0} from '../lib/p0-boundary.mjs'; export default function(req,res){if(enforceP0(req,res))return;res.end(JSON.stringify({source:'Central'}));}";
 assert.deepEqual(inspectEntry(src,'api/read.mjs'),[]);
});
test('a guard after a write, a comment, or an unguarded export cannot certify an entry',()=>{
 for(const src of ["// if(enforceP0(req,res))return;\nexport default function(req,res){save(req.body.price);}","import {enforceP0} from '../lib/p0-boundary.mjs'; export default function(req,res){save(req.body);if(enforceP0(req,res))return;}","import {enforceP0} from '../lib/p0-boundary.mjs'; export function handler(req,res){if(enforceP0(req,res))return;} export default function bypass(req,res){save(req.body);} "])assert.equal(inspectEntry(src,'api/bypass.mjs').length,1);
});
test('a forwarding alias with a side effect fails',()=>{
 assert.deepEqual(inspectEntry("export { default } from './index.mjs';",'api/stock.mjs'),[]);
 assert.equal(inspectEntry("save({price:1});export { default } from './index.mjs';",'api/stock.mjs').length,1);
});

test('a protected GET accepting a price still fails',()=>{
 const source="import {enforceP0} from '../lib/p0-boundary.mjs';export default function(req,res){if(enforceP0(req,res))return;save({price:req.query.price});res.end();}";
 assert.ok(inspectEntry(source,'api/price.mjs').length>0);
});
