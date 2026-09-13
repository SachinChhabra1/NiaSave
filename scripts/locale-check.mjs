import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {parseAst} from 'rolldown/parseAst';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(n=>walk(n,visit));else if(value&&typeof value==='object')walk(value,visit);}
export function translationKeys(source){const keys=new Map();walk(parseAst(source),node=>{if(node.type==='CallExpression'&&node.callee.name==='t'&&typeof node.arguments[0]?.value==='string')keys.set(node.arguments[0].value,typeof node.arguments[1]?.value==='string'?node.arguments[1].value:null);});return keys;}
export async function checkLocales(directory=root){
 const keys=new Map(),issues=[];
 const names=(await readdir(directory)).filter(n=>/^commerce.*\.js$/.test(n));
 if(!names.includes('commerce.js'))throw Error('commerce.js is missing');
 for(const name of names)for(const [key,hindi]of translationKeys(await readFile(resolve(directory,name),'utf8')))keys.set(key,hindi||keys.get(key)||null);
 if(keys.size===0)throw Error('No translation keys found');
 for(const lang of ['en','hi','kn','mr','ta']){
  // English keys are the canonical dictionary in this pre-P1 runtime.
  const dict=lang==='en'?Object.fromEntries([...keys.keys()].map(k=>[k,k])):(await import(pathToFileURL(resolve(directory,'commerce-locales',lang+'.js')))).default;
  if(!dict||typeof dict!=='object')throw Error(lang+' dictionary missing');
  for(const [key,hindi]of keys){const value=lang==='hi'&&hindi?hindi:dict[key];if(typeof value!=='string'||!value.trim())issues.push({lang,key});}
 }
 return {issues,keys:keys.size};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const i=process.argv.indexOf('--root'),result=await checkLocales(i<0?root:resolve(process.argv[i+1]));if(process.argv.includes('--count'))console.log(result.issues.length);else{for(const x of result.issues)console.error(x.lang+': '+x.key);console.log(`locales: ${result.issues.length} missing (${result.keys} keys; en, hi, kn, mr, ta)`);}process.exitCode=result.issues.length?1:0;}catch(e){console.error('locale audit incomplete: '+e.message);process.exitCode=2;}}
