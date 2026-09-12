// Assemble the reviewed member runtime for isolated passkey acceptance testing.
// No showcase identity, seed records, staff password routes or payment endpoints.
import {cp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(process.argv[2]||resolve(root,'../niasave-access-uat'));
if(out===root||out.startsWith(root+'/'))throw Error('Use a separate deployment directory');
await mkdir(resolve(out,'public'),{recursive:true});
for(const name of ['commerce.html','commerce.css','commerce.js','commerce-i18n.js','commerce-books.js','commerce-plan.js','commerce-passkeys.js','commerce-member-auth.js','commerce-services.js','commerce-earn-map.js','commerce-categories.js','commerce-locales','assets'])await cp(resolve(root,name),resolve(out,'public',name),{recursive:true});
await cp(resolve(root,'public/products'),resolve(out,'public/products'),{recursive:true});
await cp(resolve(root,'commerce.html'),resolve(out,'public/index.html'));
// Fail packaging before deployment if a member module's static import is missing.
const checked=new Set();
async function checkImports(file){if(checked.has(file))return;checked.add(file);const source=await readFile(file,'utf8');for(const match of source.matchAll(/\b(?:from|import)\s*(?:\(\s*)?['\"](\.\/[^'\"]+\.js)['\"]/g)){const dependency=resolve(dirname(file),match[1]);if(!dependency.startsWith(resolve(out,'public')+'/'))throw Error('Member import leaves public directory');await checkImports(dependency);}}
await checkImports(resolve(out,'public/commerce.js'));
await writeFile(resolve(out,'public/robots.txt'),'User-agent: *\nDisallow: /\n');
for(const name of ['lib','rabbit','bison','commerce-categories.js','commerce-earn-map.js'])await cp(resolve(root,name),resolve(out,name),{recursive:true,filter:p=>!p.endsWith('.test.mjs')});
await mkdir(resolve(out,'api'),{recursive:true});
await writeFile(resolve(out,'api/index.mjs'),`import {commerceHttp} from '../lib/commerce/http.mjs';
import {centralCommerceHttp} from '../lib/commerce/central-http.mjs';
export default async function handler(req,res){
 const fail=(status,error)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({error}));};
 if(process.env.ACCESS_UAT_ENABLED!=='1'||process.env.NIA_SHOWCASE==='1'||process.env.COMMERCE_MEMBER_AUTH!=='passkey')return fail(503,'access_test_not_configured');
 const url=new URL(req.url,'https://'+req.headers.host),path='/'+(url.searchParams.get('path')||url.pathname.replace(/^\\/api\\/?/,''));
 if(path==='/central/commerce')return centralCommerceHttp(req,res);
 if(!path.startsWith('/commerce/'))return fail(404,'not_found');
 return commerceHttp(req,res,path.slice('/commerce'.length),()=>null);
}
`);
await writeFile(resolve(out,'middleware.js'),`import {timingSafeEqual} from 'node:crypto';
export const config={runtime:'nodejs',matcher:'/:path*'};
export default function middleware(request){
 const headers={'cache-control':'no-store','x-robots-tag':'noindex, nofollow, noarchive'};
 if(process.env.ACCESS_UAT_ENABLED!=='1'||(process.env.ACCESS_UAT_PASSWORD||'').length<24)return new Response('Access testing is not configured.',{status:503,headers});
 const url=new URL(request.url),origin=process.env.ACCESS_UAT_ORIGIN;
 if(!origin||!origin.startsWith('https://'))return new Response('Access testing origin is not configured.',{status:503,headers});
 if(url.origin!==origin){if(!['GET','HEAD'].includes(request.method))return new Response('Use the configured access-test address.',{status:403,headers});return Response.redirect(origin+url.pathname+url.search,308);}
 if(url.pathname==='/api/central/commerce')return;
 const actual=Buffer.from(request.headers.get('authorization')||''),expected=Buffer.from('Basic '+Buffer.from('showcase:'+process.env.ACCESS_UAT_PASSWORD).toString('base64'));
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return new Response('NiaSave private access testing. Use your showcase invitation credentials.',{status:401,headers:{...headers,'www-authenticate':'Basic realm="NiaSave access testing", charset="UTF-8"'}});
}
`);
const pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
await writeFile(resolve(out,'package.json'),JSON.stringify({name:'niasave-access-uat',private:true,type:'module',engines:{node:'24.x'},dependencies:{'@neondatabase/serverless':pkg.dependencies['@neondatabase/serverless']}},null,2));
await writeFile(resolve(out,'vercel.json'),JSON.stringify({version:2,framework:null,buildCommand:'',outputDirectory:'public',regions:['sin1'],functions:{'api/index.mjs':{includeFiles:'{lib,rabbit,bison}/**',maxDuration:60}},rewrites:[{source:'/api/:path*',destination:'/api?path=:path*'}],headers:[{source:'/(.*)',headers:[{key:'Cache-Control',value:'no-store'},{key:'X-Robots-Tag',value:'noindex, nofollow, noarchive'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'same-origin'}]}]},null,2));
await writeFile(resolve(out,'.gitignore'),'.env*\n.vercel/\nnode_modules/\n');
await writeFile(resolve(out,'.vercelignore'),'.env*\n.qa*\nnode_modules/\n');
console.log('Isolated access-test artifact assembled at '+out);
