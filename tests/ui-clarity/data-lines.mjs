// Frozen list of member data lines. Order inside a file does not matter.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {root} from './scan.mjs';

export const snapshotPath = path.join(root, 'docs/ui-clarity/data-lines.snapshot.json');
const needles = ['api(', 'fetch(', 'API_PREFIX', 'localStorage', 'sessionStorage', 'load(', 'save(', 'idempotency', 'JSON.stringify('];
const pathMark = /\/api\/|\/v1\//;

export function dataLineFiles() {
  return fs.readdirSync(root).filter(name => /^commerce.*\.js$/.test(name) || name === 'commerce.html').sort();
}

export function collectDataLines() {
  const found = {};
  for (const name of dataLineFiles()) {
    const lines = fs.readFileSync(path.join(root, name), 'utf8').split(/\n/);
    const hits = [];
    for (const line of lines) {
      if (needles.some(needle => line.includes(needle)) || pathMark.test(line)) hits.push(line);
    }
    found[name] = hits.sort();
  }
  return found;
}

export function readDataLines() {
  return JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
}

export function dataLineChanges(found, saved) {
  const files = [...new Set([...Object.keys(found), ...Object.keys(saved)])].sort();
  const changes = [];
  const tally = lines => {
    const map = new Map();
    for (const line of lines || []) map.set(line, (map.get(line) || 0) + 1);
    return map;
  };
  for (const file of files) {
    const next = tally(found[file]);
    const prev = tally(saved[file]);
    for (const [line, count] of next) {
      const before = prev.get(line) || 0;
      if (count > before) changes.push(file + ' added: ' + line);
    }
    for (const [line, count] of prev) {
      const after = next.get(line) || 0;
      if (count > after) changes.push(file + ' removed: ' + line);
    }
  }
  return changes;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const changes = dataLineChanges(collectDataLines(), readDataLines());
  if (changes.length) {
    console.error(changes.join('\n'));
    process.exit(1);
  }
}
