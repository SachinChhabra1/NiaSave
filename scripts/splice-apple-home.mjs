import fs from 'node:fs';

const srcPath='commerce.js';
const snippet=fs.readFileSync('lib/commerce/apple-home.snippet.js','utf8').trim()+'\n';
if(!snippet.startsWith('function entryHomepage()')||!snippet.includes('homeDashboardModel(')||!snippet.includes('homeDashboardMarkup('))throw new Error('home dashboard snippet missing');
const src=fs.readFileSync(srcPath,'utf8');
const start=src.indexOf('function entryHomepage');
const end=src.indexOf('function render()',start);
if(start<0||end<=start)throw new Error('home entry point missing');
const out=src.slice(0,start)+snippet+src.slice(end);
if((out.match(/function entryHomepage/g)||[]).length!==1)throw new Error('multiple home entry points');
fs.writeFileSync(srcPath,out);
console.log('spliced Central-backed home dashboard into commerce.js');
