// Looks up t('English') keys in the five member language files.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {root} from './scan.mjs';

export const gapPath = path.join(root, 'docs/ui-clarity/translation-gaps.snapshot.json');
export const languages = ['bn', 'hi', 'kn', 'mr', 'ta'];

function unescapeLiteral(body) {
  return body.replace(/\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})|\\(.)/g, (_, unicode, hex, char) => {
    if (unicode) return String.fromCharCode(parseInt(unicode, 16));
    if (hex) return String.fromCharCode(parseInt(hex, 16));
    if (char === 'n') return '\n';
    if (char === 'r') return '\r';
    if (char === 't') return '\t';
    return char;
  });
}

function readString(src, start) {
  const quote = src[start];
  if (quote !== "'" && quote !== '"') return null;
  let i = start + 1;
  let body = '';
  while (i < src.length) {
    if (src[i] === '\\') {
      body += src.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (src[i] === quote) return {value: unescapeLiteral(body), end: i + 1};
    if (src[i] === '\n') return null;
    body += src[i];
    i += 1;
  }
  return null;
}

export function extractTCalls(src) {
  const calls = [];
  let i = 0;
  while (i < src.length) {
    const at = src.indexOf('t(', i);
    if (at < 0) break;
    if (at > 0 && /[\w$]/.test(src[at - 1])) {
      i = at + 2;
      continue;
    }
    let j = at + 2;
    while (/\s/.test(src[j] || '')) j += 1;
    const first = readString(src, j);
    if (!first) {
      i = at + 2;
      continue;
    }
    calls.push(first.value);
    i = first.end;
  }
  return calls;
}

export function memberJsFiles() {
  return fs.readdirSync(root).filter(name => /^commerce.*\.js$/.test(name)).sort();
}

export async function missingTranslations() {
  const keys = new Set();
  for (const name of memberJsFiles()) {
    const src = fs.readFileSync(path.join(root, name), 'utf8');
    for (const key of extractTCalls(src)) keys.add(key);
  }
  const missing = {};
  for (const lang of languages) {
    const file = path.join(root, 'commerce-locales', lang + '.js');
    const dict = (await import(pathToFileURL(file).href)).default;
    missing[lang] = [...keys].filter(key => typeof dict[key] !== 'string' || !dict[key].trim()).sort();
  }
  return missing;
}

export function readGaps() {
  return JSON.parse(fs.readFileSync(gapPath, 'utf8'));
}

export function gapCount(gaps) {
  return languages.reduce((sum, lang) => sum + (Array.isArray(gaps[lang]) ? gaps[lang].length : 0), 0);
}
