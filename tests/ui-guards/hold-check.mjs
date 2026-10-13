// Fails a pull request that is marked hold, or listed in HOLDS.md.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const holdsPath = process.env.HOLDS_PATH || path.join(root, 'docs/ui-clarity/HOLDS.md');
const number = String(process.env.PR_NUMBER || '').trim();
const labels = String(process.env.PR_LABELS || '').split(',').map(label => label.trim()).filter(Boolean);

if (!/^\d+$/.test(number)) {
  console.error('No pull request number was provided.');
  process.exit(1);
}
if (labels.includes('hold')) {
  console.error('This PR carries the hold label.');
  process.exit(1);
}
const text = fs.readFileSync(holdsPath, 'utf8');
const listed = text.split(/\r?\n/).some(line => {
  if (line.trim() === number) return true;
  if (new RegExp('(?:^|\\s)#' + number + '(?:\\s|$)').test(line)) return true;
  if (new RegExp('(?:^|\\s)PR\\s+' + number + '(?:\\s|$)', 'i').test(line)) return true;
  return false;
});
if (listed) {
  console.error('docs/ui-clarity/HOLDS.md lists PR ' + number + '.');
  process.exit(1);
}
console.log('No hold on PR ' + number + '.');
