import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Run only against the isolated fictional showcase. Credentials are read from
// the process environment, never argv, files, response dumps or console output.
export async function checkHostedShowcase(env=process.env,fetchImpl=fetch){
  const origin=env.SHOWCASE_ACCEPTANCE_ORIGIN||'https://www.niasave.com';
  const url=new URL(origin);
  if(url.origin!==origin||url.protocol!=='https:'||url.username||url.password)throw Error('invalid_showcase_origin');
  if((env.SHOWCASE_PASSWORD||'').length<24)throw Error('showcase_password_required');
  const jobs=(env.SHOWCASE_EXPECTED_JOB_IDS||'').split(',').map(v=>v.trim()).filter(Boolean);
  let expectedApplications;
  try{expectedApplications=JSON.parse(env.SHOWCASE_EXPECTED_APPLICATIONS||'null');}catch{throw Error('expected_applications_required');}
  if(jobs.length!==4||new Set(jobs).size!==4)throw Error('four_expected_job_ids_required');
  if(!Array.isArray(expectedApplications)||!expectedApplications.length||expectedApplications.some(a=>typeof a.id!=='string'||typeof a.status!=='string'))throw Error('expected_applications_required');
  const authorization='Basic '+Buffer.from('showcase:'+env.SHOWCASE_PASSWORD).toString('base64');
  let cookie='';const checks=[];
  const check=(value,name)=>{if(!value)throw Error(name);checks.push(name);};
  async function request(path,method='GET',body,key){
    const r=await fetchImpl(origin+path,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{authorization,origin,cookie,'content-type':'application/json',...(key?{'idempotency-key':key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
    let value;try{value=await r.json();}catch{throw Error('non_json_response');}
    return {status:r.status,body:value};
  }
  let r=await request('/api/showcase/health');
  check(r.status===200&&r.body.environment==='showcase'&&r.body.sharedDemoMember===true&&r.body.payments===false,'isolated_showcase');
  r=await request('/api/commerce/auth/preview','POST',{role:'member'});
  check(r.status===200&&Boolean(cookie),'member_session');
  const earn=await request('/api/commerce/earn');
  check(earn.status===200&&earn.body.source==='central'&&earn.body.map?.status==='ready','earn_central_ready');
  check(Array.isArray(earn.body.jobs)&&earn.body.jobs.length===4&&jobs.every(id=>earn.body.jobs.some(j=>j.id===id&&/^Demo(?:\s|[·:-])/.test(j.employer||''))),'four_demo_mandates');
  const applications=await request('/api/commerce/earn/applications');
  check(applications.status===200&&Array.isArray(applications.body.applications)&&expectedApplications.every(expected=>applications.body.applications.some(a=>a.id===expected.id&&a.status===expected.status)),'held_application_states');
  const read=await request('/api/commerce/books/plan');
  check(read.status===200&&Number.isSafeInteger(read.body.revision)&&read.body.capabilities?.canSave===true,'plan_read');
  if(env.SHOWCASE_ACCEPTANCE_WRITE!=='1')return {status:'read_checks_only',checks,writeChecks:'not_run'};
  // Save the same fictional fields; do not replace the walkthrough's figures.
  const input={month:read.body.month,expectedRevision:read.body.revision,fields:read.body.fields||{}};
  const key='acceptance-'+randomUUID();
  const saved=await request('/api/commerce/books/plan','PUT',input,key);
  check(saved.status===200&&saved.body.plan?.revision===read.body.revision+1,'plan_save');
  const retry=await request('/api/commerce/books/plan','PUT',input,key);
  check(retry.status===200&&JSON.stringify(retry.body)===JSON.stringify(saved.body),'plan_exact_retry');
  const stale=await request('/api/commerce/books/plan','PUT',input,'acceptance-'+randomUUID());
  check(stale.status===409,'plan_stale_409');
  const reload=await request('/api/commerce/books/plan?month='+encodeURIComponent(input.month));
  check(reload.status===200&&reload.body.revision===saved.body.plan.revision&&JSON.stringify(reload.body.fields)===JSON.stringify(saved.body.plan.fields),'plan_reload');
  return {status:'passed',checks};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{console.log(JSON.stringify(await checkHostedShowcase()));}
  catch(error){
    // Never print an upstream response, URL, request headers or raw exception.
    const allowed=/^(invalid_showcase_origin|showcase_password_required|expected_applications_required|four_expected_job_ids_required|non_json_response|isolated_showcase|member_session|earn_central_ready|four_demo_mandates|held_application_states|plan_read|plan_save|plan_exact_retry|plan_stale_409|plan_reload)$/;
    console.error(JSON.stringify({status:'failed',check:allowed.test(error.message)?error.message:'network_or_runtime_failure'}));process.exitCode=1;
  }
}
