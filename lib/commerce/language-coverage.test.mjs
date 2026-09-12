import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const sources=['commerce-passkeys.js','commerce.js','commerce-member-auth.js','commerce-books.js','commerce-earn-map.js','commerce-categories.js','commerce-plan.js','commerce-services.js'];
test('all literal member UI messages have a translation in each offered non-English language',async()=>{
 const keys=new Set(),inlineHindi=new Set();for(const name of sources){const src=fs.readFileSync(new URL('../../'+name,import.meta.url),'utf8');for(const match of src.matchAll(/\bt\('((?:\\.|[^'\\])*)'(?:\s*,\s*'((?:\\.|[^'\\])*)')?/g)){const key=match[1].replace(/\\'/g,"'").replace(/\\n/g,'\n');keys.add(key);if(match[2])inlineHindi.add(key);}}
 for(const lang of ['hi','ta','kn','mr']){const dict=(await import(`../../commerce-locales/${lang}.js`)).default;const missing=[...keys].filter(key=>!(lang==='hi'&&inlineHindi.has(key))&&(typeof dict[key]!=='string'||!dict[key].trim()));assert.deepEqual(missing,[],lang+' missing translations');}
});
