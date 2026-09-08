import { withSaveState, SKUS } from '../rabbit/engine.mjs';
import { withLivingState } from '../bison/engine.mjs';
import { initialise } from '../lib/commerce/core.mjs';
import { seedDemo } from '../lib/commerce/earn.mjs';
import { loadBooksDemo, booksConsent } from '../lib/commerce/books.mjs';
import { memberCommerceDemo } from './earn-fixtures.mjs';
import { memberBooksDemo } from './books-fixtures.mjs';

// One-time bootstrap from the same synthetic fixtures used by Central's local demo.
// Never import a live member, phone, KYC document, or bank record.
export async function bootstrapShowcase(time = Date.now()) {
  const living = await withLivingState(s => {
    if(s.dummy !== true) return {status:503,body:{error:'showcase_requires_synthetic_records'}};
    return {status:200,body:{studio:s.studios.find(s=>s.capacity>0)}};
  });
  if(living.status !== 200) return living;
  return withSaveState(s => {
    if(s.dummy !== true) return {status:503,body:{error:'showcase_requires_synthetic_records'}};
    const c = initialise(s,SKUS,true,time);
    if(c.showcaseBootstrap) return {status:200,body:{ok:true}};
    const actor={id:'central-showcase-fixtures',role:'admin'};
    const jobs=memberCommerceDemo(time);
    if(living.body.studio) jobs.studio.id=living.body.studio.id;
    seedDemo(s,actor,jobs,true,time);
    loadBooksDemo(s,actor,memberBooksDemo(time),true,time);
    booksConsent(s,{id:'preview-member',role:'member'},{enabled:true},time);
    c.config.locations[0].windowEnd=new Date(time+30*86400000).toISOString();
    c.showcaseBootstrap={version:1,at:new Date(time).toISOString(),source:'Central synthetic presentation fixtures'};
    return {status:200,body:{ok:true}};
  });
}
