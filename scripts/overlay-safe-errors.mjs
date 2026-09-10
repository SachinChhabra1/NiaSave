import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

// The domain assembler preserves an archived API. Apply only the reviewed log
// changes there, rather than replacing its handlers or database configuration.
export async function overlaySafeErrors(out) {
  const file = resolve(out, 'api/server.mjs');
  let source = await readFile(file, 'utf8');
  for (const event of ['member_state_load_failed', 'server_error', 'member_state_conflict', 'member_state_save_failed']) {
    const pattern = new RegExp('console\\.error\\("' + event + '", \\{[^\\n]*\\}\\);', 'g');
    const matches = source.match(pattern) || [];
    if (matches.length !== 1) throw new Error('Archived error log changed: ' + event);
    source = source.replace(pattern, `console.error("${event}");`);
  }
  source = source.replace('if (err.message === "invalid_json")', 'if (err?.message === "invalid_json")');
  await writeFile(file, source);
}
