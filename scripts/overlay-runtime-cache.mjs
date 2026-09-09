import {readFile,writeFile,cp} from 'node:fs/promises';
import {resolve} from 'node:path';

// Apply the reviewed transfer fix to archived operations without importing the
// showcase's database selection or member commerce handlers into that runtime.
export async function overlayRuntimeCache(root,out) {
 let source=await readFile(resolve(root,'lib/runtime-store.mjs'),'utf8');
 const boundary=source.indexOf('let client;');
 if(boundary<0||!source.includes('const cache = new Map();'))throw Error('Reviewed runtime cache implementation missing');
 source='import { neon } from "@neondatabase/serverless";\n\nconst DATABASE_URL = process.env.DATABASE_URL || "";\nconst keyFor = key => key;\n'+source.slice(boundary);
 await writeFile(resolve(out,'lib/runtime-store.mjs'),source);
 for(const [file,initial] of [['bison/engine.mjs','snapshotState()'],['rabbit/engine.mjs','snapshotState(createState())']]){
  let engine=await readFile(resolve(out,file),'utf8');
  const oldImport='import { hasDurableStore, loadRuntimeState, saveRuntimeState } from "../lib/runtime-store.mjs";';
  if(!engine.includes(oldImport))throw Error('Archived runtime import changed: '+file);
  engine=engine.replace(oldImport,oldImport.replace('saveRuntimeState }','saveRuntimeState, storageStatus }'));
  const probe=`const loaded = await loadRuntimeState(RUNTIME_STATE_KEY, ${initial});\n    return { storage: loaded.storage, connected: loaded.storage === "postgres", version: loaded.version`;
  if(!engine.includes(probe))throw Error('Archived health probe changed: '+file);
  engine=engine.replace(probe,'const status = await storageStatus(RUNTIME_STATE_KEY);\n    return { storage: status.storage, connected: status.connected, version: status.version');
  await writeFile(resolve(out,file),engine);
 }
 for(const file of ['bison.js','bison-data.js'])await cp(resolve(root,file),resolve(out,file));
}
