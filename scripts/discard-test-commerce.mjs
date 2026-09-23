// One-time M1 operator command. Run in the authorized production database
// environment and retain stdout as the external discard manifest.
import {discardTestCommerceBook} from '../lib/commerce/discard-test-book.mjs';
import {hasDurableStore,loadExistingRuntimeState,saveRuntimeState} from '../lib/runtime-store.mjs';

const key=process.env.NIA_RUNTIME_STATE_KEY||'operation-polo';
const apply=process.argv.includes('--apply');
if(!hasDurableStore()||!process.env.DATABASE_URL)throw new Error('production_database_required');
const source=await loadExistingRuntimeState(key,null);
if(source.storage!=='postgres'||!source.value||!Number.isSafeInteger(source.version)||source.version<1)
  throw new Error('existing_production_row_required');
const {state,manifest}=discardTestCommerceBook(source.value);
const evidence={event:'m1_test_book_inventory',at:new Date().toISOString(),
  databaseHost:new URL(process.env.DATABASE_URL).hostname,stateKey:key,
  sourceVersion:source.version,...manifest};
console.log(JSON.stringify(evidence));
if(!apply){console.log(JSON.stringify({event:'m1_dry_run_no_discard'}));process.exit(0);}

const result=await saveRuntimeState(key,state,source.version);
if(!result.ok||result.storage!=='postgres')throw new Error('discard_cas_failed_no_success_claim');
const verified=await loadExistingRuntimeState(key,null);
if(verified.storage!=='postgres'||verified.version!==result.version||!verified.value)
  throw new Error('discard_postcheck_failed');
const post=discardTestCommerceBook(verified.value);
if(post.manifest.remainingHash!==manifest.remainingHash||
   Object.entries(post.manifest.counts).some(([,count])=>count!==0))
  throw new Error('discard_postcheck_failed');
console.log(JSON.stringify({event:'m1_test_book_discard_verified',at:new Date().toISOString(),
  stateKey:key,sourceVersion:source.version,version:verified.version,
  removedHash:manifest.removedHash,remainingHash:post.manifest.remainingHash,
  postCounts:post.manifest.counts}));
