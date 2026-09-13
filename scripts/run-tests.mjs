import {spawnSync} from 'node:child_process';
import {relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {filesBelow} from './route-audit.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=(await filesBelow(root)).filter(f=>f.endsWith('.test.mjs')).map(f=>relative(root,f)).sort();
if(!files.length)throw Error('No tests discovered');
// Do not let a developer shell turn an isolated test into a production request.
const env={PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',DEMO:'1',DUMMY_DATA:'1'};
const result=spawnSync(process.execPath,['--test','--test-reporter=tap',...files],{cwd:root,env,stdio:'inherit'});
process.exitCode=result.status??1;
