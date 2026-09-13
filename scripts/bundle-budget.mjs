import {readFile} from 'node:fs/promises';
import {resolve,dirname,extname,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseAst} from 'rolldown/parseAst';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const ROUTE_BUDGET=120000, SHELL_BUDGET=250000;
function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(n=>walk(n,visit));else if(value&&typeof value==='object')walk(value,visit);}
export async function measureRoute(directory,entry,locale='en'){
 const seen=new Set(),issues=[],scripts=new Map(),inlineScripts=new Map();let inline=0;
 async function script(spec,from){
  const language=/commerce-locales\/(en|hi|kn|mr|ta)\.js$/.exec(spec);
  if(language && language[1]!==locale)return;
  if(/^(?:https?:)?\/\//.test(spec)){issues.push('External script cannot be budgeted: '+spec);return;}
  if(!spec.startsWith('.')&&!spec.startsWith('/')){issues.push('Unresolved script: '+spec);return;}
  const file=resolve(spec.startsWith('/')?directory:dirname(from),spec.replace(/^\//,''));
  if(!file.startsWith(directory+'/'))throw Error('Script leaves build: '+spec);
  if(seen.has(file))return;seen.add(file);
  const text=await readFile(file,'utf8');scripts.set(relative(directory,file),gzipSync(text).length);
  scan(text,file);
 }
 const pending=[];
 function scan(source,file){walk(parseAst(source),node=>{
   if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source)pending.push(script(node.source.value,file));
   if(node.type==='ImportExpression'){if(typeof node.source.value==='string')pending.push(script(node.source.value,file));else issues.push('Nonliteral dynamic import: '+relative(directory,file));}
   if(node.type==='AssignmentExpression'&&node.left.property?.name==='src'&&typeof node.right.value==='string'&&/\.js(?:\?|$)/.test(node.right.value))pending.push(script(node.right.value,file));
  });}
 const file=resolve(directory,entry), html=await readFile(file,'utf8');
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  if(/type=["']application\/(?:ld\+)?json["']/.test(match[1]))continue;
  const src=/\bsrc=["']([^"']+)["']/.exec(match[1]);
  if(src)pending.push(script(src[1],file));else if(match[2].trim()){const size=gzipSync(match[2]).length;inline+=size;inlineScripts.set(createHash('sha256').update(match[2]).digest('hex'),size);scan(match[2],file);}
 }
 // Each traversal can discover more scripts. Includes lazy imports conservatively.
 for(let i=0;i<pending.length;i++)await pending[i];
 const bytes=[...scripts.values()].reduce((a,b)=>a+b,inline);
 if(!bytes)issues.push('No executable JavaScript found: '+entry);
 return {entry,locale,bytes,inline,inlineScripts:[...inlineScripts],scripts:[...scripts.keys()],issues};
}
export async function bundleBudget(directory=resolve(root,'dist')){
 const routes=[];for(const entry of ['index.html','member.html','commerce.html'])for(const locale of ['en','hi','kn','mr','ta'])routes.push(await measureRoute(directory,entry,locale));
 const files=new Set(routes.flatMap(r=>r.scripts));let shellBytes=[...new Map(routes.flatMap(r=>r.inlineScripts)).values()].reduce((n,bytes)=>n+bytes,0);
 for(const name of files)shellBytes+=gzipSync(await readFile(resolve(directory,name))).length;
 const issues=routes.flatMap(r=>[...r.issues,...(r.bytes>ROUTE_BUDGET?[`${r.entry} (${r.locale}): ${r.bytes} > ${ROUTE_BUDGET} bytes`]:[])]);
 if(shellBytes>SHELL_BUDGET)issues.push(`app shell: ${shellBytes} > ${SHELL_BUDGET} bytes`);
 return {routes,shellBytes,issues};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const i=process.argv.indexOf('--root'),result=await bundleBudget(i<0?resolve(root,'dist'):resolve(process.argv[i+1]));for(const r of result.routes)console.log(`${r.entry} (${r.locale}): ${r.bytes} / ${ROUTE_BUDGET} gzip bytes`);console.log(`app shell: ${result.shellBytes} / ${SHELL_BUDGET} gzip bytes`);for(const issue of result.issues)console.error(issue);process.exitCode=result.issues.length?1:0;}catch(e){console.error('bundle audit incomplete: '+e.message);process.exitCode=2;}}
