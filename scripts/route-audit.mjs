import {readFile, readdir} from 'node:fs/promises';
import {resolve, relative, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseAst} from 'rolldown/parseAst';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function filesBelow(dir) {
  const files=[];
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    if (['node_modules','.git','dist'].includes(entry.name)) continue;
    const file=resolve(dir,entry.name);
    if(entry.isSymbolicLink()) throw Error('Symlink requires route review: '+file);
    if(entry.isDirectory()) files.push(...await filesBelow(file)); else files.push(file);
  }
  return files;
}
function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(n=>walk(n,visit));else if(value&&typeof value==='object')walk(value,visit);}
export function inspectEntry(source, file) {
  let ast;
  try { ast=parseAst(source); } catch { return [`${file}: cannot parse entry`]; }
  // The thin aliases must contain only the re-export, with no side effects.
  if(ast.body.length===1 && ast.body[0].type==='ExportNamedDeclaration' &&
     ast.body[0].source && /^\.\.?\/(index|server)\.mjs$/.test(ast.body[0].source.value) &&
     ast.body[0].specifiers.length===1 && ast.body[0].specifiers[0].local.name==='default' &&
     ast.body[0].specifiers[0].exported.name==='default') return [];
  const imported=ast.body.some(n=>n.type==='ImportDeclaration' && /\/lib\/p0-boundary\.mjs$/.test(n.source.value) && n.specifiers.some(s=>s.imported?.name==='enforceP0' && s.local.name==='enforceP0'));
  const functions=ast.body.filter(n=>/^Export/.test(n.type)).map(n=>n.declaration).filter(n=>n?.type==='FunctionDeclaration');
  if(imported && functions.length && functions.every(fn=>{
    const first=fn.body.body[0];
    return first?.type==='IfStatement' && first.test.type==='CallExpression' && first.test.callee.name==='enforceP0' &&
      first.test.arguments.length===2 && first.test.arguments[0].name===fn.params[0]?.name && first.test.arguments[1].name===fn.params[1]?.name && first.consequent.type==='ReturnStatement' && !first.consequent.argument;
  })) {
    const issues=[];
    for(const fn of functions){
      for(const statement of fn.body.body){
        walk(statement,node=>{
          if(node.type==='MemberExpression' && node.object.name===fn.params[0]?.name && ['body','query'].includes(node.property.name||node.property.value))issues.push(`${file}: direct request data in entry requires contract review`);
          if(node.type==='AssignmentExpression' || node.type==='UpdateExpression')issues.push(`${file}: entry mutates state outside reviewed dispatch`);
          if(node.type==='CallExpression'){
            const callee=node.callee;
            const safe=callee.type==='Identifier' && (callee.name==='enforceP0' || (file==='api/server.mjs' && ['withP0Request','dispatchLegacyRequest'].includes(callee.name))) || callee.type==='MemberExpression' && ((callee.object.name===fn.params[1]?.name && ['writeHead','end'].includes(callee.property.name)) || callee.object.name==='JSON'&&callee.property.name==='stringify');
            if(!safe)issues.push(`${file}: unreviewed call in entry`);
          }
        });
        if(statement.type==='ReturnStatement')break;
      }
    }
    return [...new Set(issues)];
  }
  return [`${file}: entry is not protected before dispatch (including read handlers)`];
}
export async function auditRoutes(directory=root, built=false) {
  const issues=[];
  const middleware=parseAst(await readFile(resolve(directory,'middleware.js'),'utf8'));
  const entry=middleware.body.find(n=>n.type==='ExportDefaultDeclaration')?.declaration;
  let first=entry?.body?.body[0]?.argument;
  while(first?.type==='LogicalExpression')first=first.left;
  if(first?.type!=='CallExpression'||first.callee.name!=='p0WebResponse')issues.push('middleware: shutdown must precede authentication');
  const api=await filesBelow(resolve(directory,'api'));
  for(const file of api.filter(f=>/\.(?:mjs|js|ts)$/.test(f)&&!f.endsWith('.test.mjs'))) {
    const source=await readFile(file,'utf8');
    issues.push(...inspectEntry(source,relative(directory,file)));
    const ast=parseAst(source);
    if(ast.body.length===1&&ast.body[0].source){const target=resolve(dirname(file),ast.body[0].source.value);if(!api.includes(target))issues.push(relative(directory,file)+': alias escapes audited API entries');}
  }
  for(const entry of ['api/index.mjs','api/server.mjs','lib/p0-boundary.mjs']) await readFile(resolve(directory,entry),'utf8');
  const policy=await import(pathToFileURL(resolve(directory,'lib/p0-boundary.mjs')));
  // Unknown writes and every known operating path must stay shut for all verbs.
  const candidates=['/new-route','/stock','/orders','/commerce/quote','/commerce/orders','/commerce/nests/quote','/commerce/nests/bookings','/commerce/nests/config','/commerce/staff/config','/central/commerce','/bison/bookings','/living/data/import','/dogra/state','/v1/payments','/v1/save/checkout'];
  for(const path of candidates)for(const method of ['POST','PUT','PATCH','DELETE','TRACE','CONNECT']) {
    if(!policy.p0Decision(method,path))issues.push(`${method} ${path}: disallowed write open`);
  }
  for(const path of ['/bison/data/sync','/living/data/sync','/central/commerce']) {
    if(!policy.p0Decision('GET',path))issues.push(`GET ${path}: side effect open`);
  }
  const base=built?resolve(directory,'dist'):directory;
  const staff=['ops','polo','pickup','recon','hub','next','cash','inventory','po','dispatch','invoice','biker','bison','bison-studios','bison-contracts','bison-clocks','bison-collections','bison-nests','bison-data'];
  for(const page of staff) {
    let source;
    try {source=await readFile(resolve(base,page+'.html'),'utf8');} catch {issues.push(`${page}.html: missing redirect destination`);continue;}
    if(!source.includes('https://rafiqicentral.com/') || /<script|<form|<input|<textarea|<select/i.test(source))issues.push(`${page}.html: staff controls or redirect missing`);
  }
  const enterprise=await readFile(resolve(base,'tanot/index.html'),'utf8');
  if(!enterprise.includes('https://rafiqicentral.com/') || /<script|<form/i.test(enterprise))issues.push('tanot: local staff writer remains');
  for(const file of ['commerce-ops.js','bison.js','bison-data.js']) {
    const source=await readFile(resolve(base,file),'utf8');
    if(!source.includes("location.replace('https://rafiqicentral.com/") || /fetch\s*\(|Storage|<form/.test(source))issues.push(`${file}: staff write script remains`);
  }
  if(!built) {
    issues.push(...inspectEntry(await readFile(resolve(directory,'showcase/handler.mjs'),'utf8'),'showcase/handler.mjs'));
    const archived=await readFile(resolve(directory,'scripts/build-domain-showcase.mjs'),'utf8');
    if(!archived.startsWith("throw new Error('P0:"))issues.push('archived assembly can reopen legacy writers');
    const demo=await readFile(resolve(directory,'scripts/load-connected-demo.py'),'utf8');
    if(!/^#.*\nraise SystemExit\(/.test(demo))issues.push('demo loader is not disabled before imports');
  }
  return issues;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const i=process.argv.indexOf('--root'), directory=i<0?root:resolve(process.argv[i+1]);
    const issues=await auditRoutes(directory,process.argv.includes('--dist'));
    if(process.argv.includes('--count'))console.log(issues.length);
    else {for(const issue of issues)console.error(issue);console.log(`write routes: ${issues.length} disallowed`);}
    process.exitCode=issues.length?1:0;
  } catch(error) {console.error('route audit incomplete: '+error.message);process.exitCode=2;}
}
