// Local-only fake store. Hosted handler never imports this file.
import http from 'node:http';
import https from 'node:https';
import {execFileSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFile} from 'node:fs/promises';
import {enableShowcaseEntry} from '../lib/commerce/showcase-mode.mjs';
process.env.NODE_ENV='test';process.env.NIA_SHOWCASE='1';process.env.NIASAVE_INVESTOR_DEMO='1';
enableShowcaseEntry();
const {createInvestorHandler}=await import('../showcase/investor-http.mjs');
const {demoHeaders}=await import('../showcase/investor-mode.mjs');
let state={},queue=Promise.resolve();
const run=work=>{const next=queue.then(async()=>{const candidate=structuredClone(state);const result=await work(candidate);if(result.status<400)state=candidate;return result;});queue=next.catch(()=>{});return next;};
const api=createInvestorHandler(run);
const serve=async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path.startsWith('/api/commerce/'))return api(req,res,path.slice('/api/commerce'.length));
 const files={'/':'index.html','/ops.html':'index.html','/demo.js':'demo.js','/demo.css':'demo.css'};
 if(!files[path]){res.writeHead(404);return res.end();}
 const file=files[path];
 res.writeHead(200,{...demoHeaders,'content-type':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
 res.end(await readFile(new URL('../showcase/investor-public/'+file,import.meta.url)));
};
http.createServer(serve).listen(4196,'127.0.0.1');
// Ephemeral localhost TLS only, so Chromium can exercise actual CHIPS cookies.
const tlsDir=await mkdtemp(join(tmpdir(),'niasave-demo-tls-'));
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(tlsDir,'key.pem'),'-out',join(tlsDir,'cert.pem'),'-days','1','-subj','/CN=localhost'],{stdio:'ignore'});
https.createServer({key:await readFile(join(tlsDir,'key.pem')),cert:await readFile(join(tlsDir,'cert.pem'))},serve).listen(4197,'127.0.0.1');
await rm(tlsDir,{recursive:true,force:true});
