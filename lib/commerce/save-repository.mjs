import {hasDurableStore,loadExistingRuntimeState,loadRuntimeState,saveRuntimeState} from '../runtime-store.mjs';
import {createStateRunner} from './transaction.mjs';
import {emptySaveBook,assertSaveBook} from './save-book.mjs';
import {CommerceError} from './core.mjs';

// Separate authority; never restore/normalize a legacy Rabbit or Living book.
export const SAVE_BOOK_KEY='niasave-save-v1';
export function createSaveRepository({durable,load,initialize,save}){
  let current=emptySaveBook();
  const run=createStateRunner({durable,load,save,snapshot:()=>current,
    restore:value=>{current=structuredClone(assertSaveBook(value));}});
  return {
    async read(work){
      if(!durable())throw new CommerceError('save_storage_unavailable',503);
      const loaded=await load();
      if(loaded.storage!=='postgres')throw new CommerceError('save_storage_unavailable',503);
      const book=loaded.version===0&&loaded.value===null?emptySaveBook():assertSaveBook(loaded.value);
      return work(structuredClone(book),loaded.version);
    },
    async write(work,{create=false}={}){
      if(!durable())throw new CommerceError('save_storage_unavailable',503);
      if(create){
        const loaded=await initialize();
        if(loaded.storage!=='postgres'||loaded.version<1)throw new CommerceError('save_storage_unavailable',503);
        assertSaveBook(loaded.value);
      }
      return run(true,()=>({status:200,body:work(current)}),true);
    },
  };
}
export const saveRepository=createSaveRepository({durable:hasDurableStore,
  load:()=>loadExistingRuntimeState(SAVE_BOOK_KEY,null),
  initialize:()=>loadRuntimeState(SAVE_BOOK_KEY,emptySaveBook()),
  save:(value,version)=>saveRuntimeState(SAVE_BOOK_KEY,value,version)});
