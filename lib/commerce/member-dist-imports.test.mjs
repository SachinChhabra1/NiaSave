import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LOCAL_IMPORT = /(?:from\s+|import\s*\(\s*|import\s+)['"](\.\/commerce-[a-z0-9-]+\.js|\.\/lib\/commerce\/[a-z0-9-]+\.mjs)['"]/g;

function logicalLines(script) {
  const lines = [];
  let pending = '';
  for (const raw of script.split('\n')) {
    const piece = pending ? pending + raw.trim() : raw;
    if (piece.trimEnd().endsWith('\\')) {
      pending = piece.trimEnd().slice(0, -1) + ' ';
      continue;
    }
    lines.push(piece);
    pending = '';
  }
  if (pending) lines.push(pending);
  return lines;
}

function stripComment(line) {
  let quote = '';
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quote) {
      if (char === quote && line[i - 1] !== '\\') quote = '';
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === '#') return line.slice(0, i);
  }
  return line;
}

function copiedSources(script) {
  const copied = new Set();
  for (const raw of logicalLines(script)) {
    const code = stripComment(raw);
    for (const part of code.split(';')) {
      const command = part.trim().replace(/^then\s+/, '');
      if (!command.startsWith('cp ') && !command.startsWith('cp\t')) continue;
      const args = command.split(/\s+/).slice(1).filter(token => token !== 'cp' && !token.startsWith('-'));
      if (args.length < 2) continue;
      const dest = args[args.length - 1];
      if (dest !== 'dist' && !dest.startsWith('dist/')) continue;
      for (const source of args.slice(0, -1)) copied.add(source.replace(/^\.\//, ''));
    }
  }
  return copied;
}

function localCommerceImports(text) {
  return [...text.matchAll(LOCAL_IMPORT)].map(match => match[1]);
}

test('every member import of a commerce module is copied into dist', () => {
  const build = fs.readFileSync(path.join(root, 'vercel-build.sh'), 'utf8');
  const copied = copiedSources(build);
  const memberFiles = [...copied].filter(name => /^commerce.*\.js$/.test(name)).sort();
  assert.ok(memberFiles.includes('commerce.js'));
  assert.ok(memberFiles.includes('commerce-home.js'));
  assert.ok(copied.has('commerce-support.js'));
  assert.ok(copied.has('lib/commerce/support.mjs'));
  const found = [];
  const missing = [];
  for (const file of memberFiles) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const spec of localCommerceImports(text)) {
      found.push(file + ' ' + spec);
      const rel = spec.slice(2);
      if (!copied.has(rel)) missing.push(file + ' imports ' + spec + ', and vercel-build.sh does not copy ' + rel + ' into dist');
    }
  }
  assert.ok(found.some(row => row.includes('./commerce-')), 'no ./commerce-*.js import was scanned');
  assert.ok(found.some(row => row.includes('./lib/commerce/') && row.endsWith('.mjs')), 'no ./lib/commerce/*.mjs import was scanned');
  assert.ok(found.includes('commerce-home.js ./commerce-support.js'));
  assert.deepEqual(missing, []);
});
