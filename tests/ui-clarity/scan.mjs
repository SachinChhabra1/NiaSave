// Member-copy scan for the UI clarity guard. Strings only, not comments.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const baselinePath = path.join(root, 'docs/ui-clarity/BASELINE.json');

const ENGLISH = /(?:^|[^A-Za-z0-9_-])(?:central|projection|catalogue|source|supplied|published)(?=$|[^A-Za-z0-9_-])|explore\s+less/i;
const DATE_PLACEHOLDER = /mm\/dd\/yyyy/i;
const EM_DASH = '\u2014';
const TRANSLATED = [
  'सेंट्रल',
  'সেন্ট্রাল',
  'சென்ட்ரல்',
  'लेस देखें',
  'লেস দেখুন',
  'லெஸ் பகுதிகளைப் பார்க்கவும்',
  'प्रकाशित',
  'প্রকাশিত',
  'வெளியிடப்பட்ட',
  'வெளியிடப்பட',
  'स्रोत',
  'மூலப் பதிவு'
];
const EXACT_TRANSLATED = ['மூலம்'];

export function hasBannedWord(text) {
  return ENGLISH.test(text) || TRANSLATED.some(token => text.includes(token)) || EXACT_TRANSLATED.includes(text);
}

export function violationKind(text) {
  const reasons = [];
  if (hasBannedWord(text)) reasons.push('banned');
  if (text.includes(EM_DASH)) reasons.push('emdash');
  if (DATE_PLACEHOLDER.test(text)) reasons.push('date');
  return reasons.join('+');
}

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

function readQuoted(src, start) {
  const quote = src[start];
  if (quote !== "'" && quote !== '"' && quote !== '`') return null;
  let i = start + 1;
  let body = '';
  const parts = [];
  while (i < src.length) {
    const char = src[i];
    if (char === '\\') {
      body += src.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (quote === '`' && char === '$' && src[i + 1] === '{') {
      const text = unescapeLiteral(body).replace(/\s+/g, ' ').trim();
      if (text) parts.push(text);
      body = '';
      i += 2;
      let depth = 1;
      while (i < src.length && depth > 0) {
        if (src[i] === "'" || src[i] === '"' || src[i] === '`') {
          const nested = readQuoted(src, i);
          if (nested) {
            parts.push(...nested.parts);
            i = nested.end;
            continue;
          }
        }
        if (src[i] === '{') depth += 1;
        else if (src[i] === '}') depth -= 1;
        if (depth > 0) i += 1;
      }
      i += 1;
      continue;
    }
    if (char === quote) {
      const text = unescapeLiteral(body).replace(/\s+/g, ' ').trim();
      if (text) parts.push(text);
      return {parts, end: i + 1};
    }
    if ((quote === "'" || quote === '"') && char === '\n') return null;
    body += char;
    i += 1;
  }
  return null;
}

function regexCanStart(src, index) {
  let j = index - 1;
  while (j >= 0 && /\s/.test(src[j])) j -= 1;
  if (j < 0) return true;
  const char = src[j];
  if ('([{:;,=!?&|~^+-*%<>'.includes(char)) return true;
  const tail = src.slice(Math.max(0, j - 12), j + 1);
  return /(?:^|[^$\w])(?:return|case|throw|typeof|delete|void|in|of)$/.test(tail);
}

function skipRegex(src, index) {
  let j = index + 1;
  let inClass = false;
  while (j < src.length) {
    const char = src[j];
    if (char === '\\') {
      j += 2;
      continue;
    }
    if (char === '[' && !inClass) inClass = true;
    else if (char === ']' && inClass) inClass = false;
    else if (char === '/' && !inClass) {
      j += 1;
      while (/[a-z]/i.test(src[j] || '')) j += 1;
      return j;
    } else if (char === '\n') return index;
    j += 1;
  }
  return index;
}

export function extractStrings(src) {
  const found = [];
  let i = 0;
  while (i < src.length) {
    const char = src[i];
    if (char === '/' && src[i + 1] === '/') {
      const next = src.indexOf('\n', i);
      i = next < 0 ? src.length : next + 1;
      continue;
    }
    if (char === '/' && src[i + 1] === '*') {
      const next = src.indexOf('*/', i + 2);
      i = next < 0 ? src.length : next + 2;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      const read = readQuoted(src, i);
      if (read) {
        found.push(...read.parts);
        i = read.end;
        continue;
      }
    }
    if (char === '/' && regexCanStart(src, i)) {
      const end = skipRegex(src, i);
      if (end > i) {
        i = end;
        continue;
      }
    }
    i += 1;
  }
  return found;
}

function extractHtml(src) {
  const stripped = src.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const found = [];
  const attrs = /(?:alt|aria-label|title|placeholder|content)\s*=\s*"([^"]*)"/gi;
  for (const match of stripped.matchAll(attrs)) {
    const text = match[1].replace(/\s+/g, ' ').trim();
    if (text) found.push(text);
  }
  const text = stripped.replace(/<[^>]+>/g, '\n');
  for (const part of text.split('\n')) {
    const line = part.replace(/\s+/g, ' ').trim();
    if (line) found.push(line);
  }
  return found;
}

function keepString(text) {
  const kind = violationKind(text);
  if (!kind) return false;
  if (kind === 'banned') {
    if (text.startsWith('/') || text.includes('/api/') || text.includes('/v1/')) return false;
    if (!/\s/.test(text) && !/^(?:central|projection|catalogue|source|supplied|published)$/i.test(text) && !EXACT_TRANSLATED.includes(text) && !TRANSLATED.includes(text)) return false;
    if (/^[A-Za-z0-9_.:/-]+$/.test(text) && !/^(?:central|projection|catalogue|source|supplied|published)$/i.test(text)) return false;
  }
  return true;
}

export function memberSourceFiles() {
  const names = fs.readdirSync(root).filter(name => /^commerce.*\.js$/.test(name) || name === 'commerce.html');
  const locales = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) locales.push(full);
    }
  };
  walk(path.join(root, 'commerce-locales'));
  return [...names.map(name => path.join(root, name)), ...locales];
}

export function scanCopyViolations() {
  const entries = [];
  const seen = new Set();
  for (const full of memberSourceFiles()) {
    const rel = path.relative(root, full).split(path.sep).join('/');
    const src = fs.readFileSync(full, 'utf8');
    const strings = rel.endsWith('.html') ? extractHtml(src) : extractStrings(src);
    for (const text of strings) {
      if (!keepString(text)) continue;
      const key = rel + '\0' + text;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({kind: 'copy', file: rel, string: text, rule: violationKind(text)});
    }
  }
  entries.sort((a, b) => (a.file + a.string).localeCompare(b.file + b.string));
  return entries;
}

export function readBaseline() {
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}

export function samePair(left, right) {
  return left.file === right.file && left.string === right.string && (left.kind || 'copy') === (right.kind || 'copy');
}

export function normalizeVisible(text) {
  return String(text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

export function copyCovers(text, entries) {
  const visible = normalizeVisible(text);
  if (!visible || !violationKind(visible)) return true;
  return entries.some(entry => {
    if (entry.kind !== 'copy') return false;
    const known = normalizeVisible(entry.string);
    return known === visible || known.includes(visible);
  });
}
