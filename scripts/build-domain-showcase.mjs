// Assemble a storefront release over an explicit live-site revision, preserving
// legacy operations byte-for-byte and putting the test API in its own function.
import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const base=process.argv[2],out=resolve(process.argv[3]||resolve(root,'../niasave-domain'));
if(!/^[a-f0-9]{40}$/.test(base||''))throw Error('Pass the verified full production Git revision');
if(out===root||out.startsWith(root+'/'))throw Error('Use a separate deployment directory');
await mkdir(out,{recursive:true});
const archive=spawnSync('git',['archive',base],{cwd:root,maxBuffer:100*1024*1024});
if(archive.status!==0)throw Error('Cannot read live source revision');
const unpack=spawnSync('tar',['-x','-C',out],{input:archive.stdout});
if(unpack.status!==0)throw Error('Cannot assemble live source');
const front=['commerce.html','commerce.css','commerce.js','commerce-i18n.js','commerce-books.js','commerce-plan.js','commerce-earn-map.js','commerce-categories.js','commerce-locales'];
for(const file of front)await cp(resolve(root,file),resolve(out,file),{recursive:true});
await cp(resolve(root,'assets'),resolve(out,'assets'),{recursive:true});
const runtime=resolve(out,'showcase-runtime');await mkdir(runtime,{recursive:true});
for(const file of ['lib','rabbit','bison','showcase','commerce-categories.js','commerce-earn-map.js'])await cp(resolve(root,file),resolve(runtime,file),{recursive:true,filter:p=>!p.endsWith('.test.mjs')});
await writeFile(resolve(out,'api/showcase.mjs'),"export { default } from '../showcase-runtime/showcase/handler.mjs';\n");
await cp(resolve(root,'showcase/domain-middleware.js'),resolve(out,'middleware.js'));
let build=await readFile(resolve(out,'vercel-build.sh'),'utf8');
build+='\n# Protected member showcase; the operations build above remains intact.\ncp commerce.html dist/index.html\ncp '+front.filter(f=>f!=='commerce-locales').join(' ')+' dist/\nmkdir -p dist/commerce-locales\ncp -R commerce-locales/. dist/commerce-locales/\n';
// Carry the reviewed member import check into this assembled release too.
const memberBuild=await readFile(resolve(root,'vercel-build.sh'),'utf8');
const importGuard=memberBuild.split('\n').find(line=>line.startsWith('for f in $(grep -o '));
if(!importGuard)throw Error('Member module build guard is missing');
build+='\n'+importGuard+'\n';
await writeFile(resolve(out,'vercel-build.sh'),build);
const config=JSON.parse(await readFile(resolve(out,'vercel.json'),'utf8'));
config.functions['api/showcase.mjs']={includeFiles:'showcase-runtime/**',maxDuration:60,regions:['sin1']};
config.rewrites.unshift({source:'/api/commerce/:path*',destination:'/api/showcase?path=commerce/:path*'},{source:'/api/central/commerce',destination:'/api/showcase?path=central/commerce'},{source:'/api/showcase/health',destination:'/api/showcase?path=showcase/health'});
config.headers.push({source:'/',headers:[{key:'Cache-Control',value:'no-store'},{key:'X-Robots-Tag',value:'noindex, nofollow'}]},{source:'/commerce(.*)',headers:[{key:'Cache-Control',value:'no-store'},{key:'X-Robots-Tag',value:'noindex, nofollow'}]});
await writeFile(resolve(out,'vercel.json'),JSON.stringify(config,null,2));
await writeFile(resolve(out,'.vercelignore'),'.env*\n.qa*\nnode_modules/\n');
console.log('Domain storefront assembled over '+base+' at '+out);
