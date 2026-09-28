// Member call inventory. Line formatting can change; a call cannot.
// api()'s third argument is the method. When that argument is absent the
// record says so. api() itself defaults the parameter to POST.
// An object-literal body records its sorted keys. A spread is one of those
// keys, written as its source, so a spread cannot change unseen.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {dataLineFiles} from './data-lines.mjs';
import {root} from './scan.mjs';

export const snapshotPath = path.join(root, 'docs/ui-clarity/calls.snapshot.json');
const PATH_MARK = /\/api\/|\/v1\//;
const CALLS = new Set(['api', 'fetch', 'load', 'save']);
const OPS3 = ['===', '!==', '>>>', '>>=', '<<=', '...', '**='];
const OPS2 = ['==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '**', '=>'];

function isIdentStart(char) {
  return /[A-Za-z_$]/.test(char || '');
}

function isIdentPart(char) {
  return /[A-Za-z0-9_$]/.test(char || '');
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

function readSimpleString(src, start) {
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

function readTemplate(src, start) {
  const parts = [];
  const exprs = [];
  let i = start + 1;
  let body = '';
  while (i < src.length) {
    if (src[i] === '\\') {
      body += src.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (src[i] === '$' && src[i + 1] === '{') {
      const text = unescapeLiteral(body);
      if (text) parts.push(text);
      body = '';
      i += 2;
      const exprStart = i;
      let depth = 1;
      while (i < src.length && depth > 0) {
        if (src[i] === "'" || src[i] === '"') {
          const nested = readSimpleString(src, i);
          if (nested) {
            i = nested.end;
            continue;
          }
        }
        if (src[i] === '`') {
          i = readTemplate(src, i).end;
          continue;
        }
        if (src[i] === '/' && src[i + 1] === '/') {
          const next = src.indexOf('\n', i);
          i = next < 0 ? src.length : next + 1;
          continue;
        }
        if (src[i] === '/' && src[i + 1] === '*') {
          const next = src.indexOf('*/', i + 2);
          i = next < 0 ? src.length : next + 2;
          continue;
        }
        if (src[i] === '/' && regexCanStart(src, i)) {
          const end = skipRegex(src, i);
          if (end > i) {
            i = end;
            continue;
          }
        }
        if (src[i] === '{') depth += 1;
        else if (src[i] === '}') depth -= 1;
        if (depth > 0) i += 1;
      }
      exprs.push(src.slice(exprStart, i));
      i += 1;
      continue;
    }
    if (src[i] === '`') {
      const text = unescapeLiteral(body);
      if (text) parts.push(text);
      return {parts, exprs, end: i + 1};
    }
    body += src[i];
    i += 1;
  }
  const text = unescapeLiteral(body);
  if (text) parts.push(text);
  return {parts, exprs, end: src.length};
}

function skipTrivia(src, index) {
  let i = index;
  while (i < src.length) {
    if (/\s/.test(src[i])) {
      i += 1;
      continue;
    }
    if (src[i] === '/' && src[i + 1] === '/') {
      const next = src.indexOf('\n', i);
      i = next < 0 ? src.length : next + 1;
      continue;
    }
    if (src[i] === '/' && src[i + 1] === '*') {
      const next = src.indexOf('*/', i + 2);
      i = next < 0 ? src.length : next + 2;
      continue;
    }
    break;
  }
  return i;
}

function precededByDot(src, identStart) {
  let j = identStart - 1;
  while (j >= 0 && /\s/.test(src[j])) j -= 1;
  return j >= 0 && src[j] === '.';
}

function precededByFunction(src, identStart) {
  let j = identStart - 1;
  while (j >= 0 && /\s/.test(src[j])) j -= 1;
  if (j >= 0 && src[j] === '*') {
    j -= 1;
    while (j >= 0 && /\s/.test(src[j])) j -= 1;
  }
  const keyword = 'function';
  const start = j - keyword.length + 1;
  if (start < 0 || src.slice(start, j + 1) !== keyword) return false;
  return start === 0 || !isIdentPart(src[start - 1]);
}

function tokensOf(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const char = src[i];
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }
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
    if (char === "'" || char === '"') {
      const read = readSimpleString(src, i);
      if (read) {
        tokens.push(src.slice(i, read.end));
        i = read.end;
        continue;
      }
    }
    if (char === '`') {
      const read = readTemplate(src, i);
      tokens.push(src.slice(i, read.end));
      i = read.end;
      continue;
    }
    if (char === '/' && regexCanStart(src, i)) {
      const end = skipRegex(src, i);
      if (end > i) {
        tokens.push(src.slice(i, end));
        i = end;
        continue;
      }
    }
    if (isIdentStart(char)) {
      const start = i;
      i += 1;
      while (isIdentPart(src[i])) i += 1;
      tokens.push(src.slice(start, i));
      continue;
    }
    if (/[0-9]/.test(char)) {
      const start = i;
      i += 1;
      while (/[0-9]/.test(src[i] || '')) i += 1;
      if (src[i] === '.' && /[0-9]/.test(src[i + 1] || '')) {
        i += 1;
        while (/[0-9]/.test(src[i] || '')) i += 1;
      }
      tokens.push(src.slice(start, i));
      continue;
    }
    const three = src.slice(i, i + 3);
    const two = src.slice(i, i + 2);
    if (OPS3.includes(three)) {
      tokens.push(three);
      i += 3;
      continue;
    }
    if (OPS2.includes(two)) {
      tokens.push(two);
      i += 2;
      continue;
    }
    tokens.push(char);
    i += 1;
  }
  return tokens;
}

function joinTokens(tokens) {
  let out = '';
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const prev = tokens[i - 1];
    if (i > 0 && token !== '.' && token !== '?.' && prev !== '.' && prev !== '?.') out += ' ';
    out += token;
  }
  return out;
}

function isStringToken(token) {
  return !!token && (token[0] === "'" || token[0] === '"') && token.at(-1) === token[0] && token.length >= 2;
}

function stringTokenValue(token) {
  return unescapeLiteral(token.slice(1, -1));
}

function classify(raw) {
  const tokens = tokensOf(String(raw).trim());
  if (tokens.length === 1 && isStringToken(tokens[0])) return {lit: stringTokenValue(tokens[0])};
  if (tokens.length === 1 && tokens[0][0] === '`' && !tokens[0].includes('${')) {
    return {lit: unescapeLiteral(tokens[0].slice(1, -1))};
  }
  return {src: joinTokens(tokens)};
}

function isObjectLiteral(raw) {
  const tokens = tokensOf(String(raw).trim());
  if (tokens[0] !== '{') return false;
  let depth = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i] === '{') depth += 1;
    else if (tokens[i] === '}') {
      depth -= 1;
      if (depth === 0) return i === tokens.length - 1;
    }
  }
  return false;
}

function skipValue(tokens, index) {
  let depth = 0;
  let i = index;
  while (i < tokens.length) {
    const token = tokens[i];
    if ((token === ',' || token === '}') && depth === 0) return i;
    if (token === '{' || token === '(' || token === '[') depth += 1;
    else if (token === '}' || token === ')' || token === ']') {
      if (depth === 0) return i;
      depth -= 1;
    }
    i += 1;
  }
  return i;
}

function objectKeys(raw) {
  const tokens = tokensOf(String(raw).trim());
  const keys = [];
  if (tokens[0] !== '{') return keys;
  let i = 1;
  let depth = 1;
  while (i < tokens.length && depth > 0) {
    const token = tokens[i];
    if (token === '}') {
      depth -= 1;
      i += 1;
      continue;
    }
    if (depth > 1) {
      if (token === '{' || token === '(' || token === '[') depth += 1;
      else if (token === ')' || token === ']') depth -= 1;
      i += 1;
      continue;
    }
    if (token === ',') {
      i += 1;
      continue;
    }
    if (token === '...') {
      const spread = ['...'];
      i += 1;
      let nested = 0;
      while (i < tokens.length) {
        const next = tokens[i];
        if ((next === ',' || next === '}') && nested === 0) break;
        if (next === '{' || next === '(' || next === '[') nested += 1;
        else if (next === '}' || next === ')' || next === ']') {
          if (nested === 0) break;
          nested -= 1;
        }
        spread.push(next);
        i += 1;
      }
      keys.push(joinTokens(spread));
      continue;
    }
    if (token === '[') {
      const computed = ['['];
      i += 1;
      let nested = 1;
      while (i < tokens.length && nested > 0) {
        const next = tokens[i];
        if (next === '{' || next === '(' || next === '[') nested += 1;
        else if (next === '}' || next === ')' || next === ']') nested -= 1;
        computed.push(next);
        i += 1;
      }
      if (tokens[i] === ':') i = skipValue(tokens, i + 1);
      keys.push(joinTokens(computed));
      continue;
    }
    if (token === '{' || token === '(') {
      depth += 1;
      i += 1;
      continue;
    }
    const name = isStringToken(token) ? stringTokenValue(token) : token;
    i += 1;
    if (tokens[i] === ':') i = skipValue(tokens, i + 1);
    else if (tokens[i] === '(') {
      let nested = 0;
      while (i < tokens.length) {
        if (tokens[i] === '(') nested += 1;
        else if (tokens[i] === ')') {
          nested -= 1;
          i += 1;
          if (nested === 0) break;
          continue;
        }
        i += 1;
      }
      if (tokens[i] === '{') {
        let braces = 0;
        while (i < tokens.length) {
          if (tokens[i] === '{') braces += 1;
          else if (tokens[i] === '}') {
            braces -= 1;
            i += 1;
            if (braces === 0) break;
            continue;
          }
          i += 1;
        }
      }
    }
    keys.push(name);
  }
  keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return keys;
}

function propertyValue(raw, prop) {
  const tokens = tokensOf(String(raw).trim());
  let depth = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === '{' || token === '(' || token === '[') {
      depth += 1;
      continue;
    }
    if (token === '}' || token === ')' || token === ']') {
      depth -= 1;
      continue;
    }
    if (depth !== 1 || token === ',' || token === ':') continue;
    const name = isStringToken(token) ? stringTokenValue(token) : token;
    if (name !== prop || tokens[i + 1] !== ':') continue;
    const value = [];
    let nested = 0;
    for (let j = i + 2; j < tokens.length; j += 1) {
      const next = tokens[j];
      if ((next === ',' || next === '}') && nested === 0) return joinTokens(value);
      if (next === '{' || next === '(' || next === '[') nested += 1;
      else if (next === '}' || next === ')' || next === ']') {
        if (nested === 0) return joinTokens(value);
        nested -= 1;
      }
      value.push(next);
    }
    return joinTokens(value);
  }
  return null;
}

function splitArgs(src, openIndex) {
  const args = [];
  let i = openIndex + 1;
  let depth = 1;
  let start = i;
  while (i < src.length && depth > 0) {
    const char = src[i];
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }
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
    if (char === "'" || char === '"') {
      const read = readSimpleString(src, i);
      i = read ? read.end : i + 1;
      continue;
    }
    if (char === '`') {
      i = readTemplate(src, i).end;
      continue;
    }
    if (char === '/' && regexCanStart(src, i)) {
      const end = skipRegex(src, i);
      if (end > i) {
        i = end;
        continue;
      }
    }
    if (char === '(' || char === '[' || char === '{') {
      depth += 1;
      i += 1;
      continue;
    }
    if (char === ')' || char === ']' || char === '}') {
      depth -= 1;
      if (depth === 0 && char === ')') {
        const last = src.slice(start, i).trim();
        if (last) args.push(last);
        return {args, end: i + 1};
      }
      i += 1;
      continue;
    }
    if (char === ',' && depth === 1) {
      const piece = src.slice(start, i).trim();
      if (piece) args.push(piece);
      i += 1;
      start = i;
      continue;
    }
    i += 1;
  }
  return {args, end: i};
}

function apiRecord(args) {
  const pathArg = args.length ? classify(args[0]) : {src: ''};
  const method = args.length >= 3 ? classify(args[2]) : {absent: true};
  let body = null;
  if (args.length >= 2) {
    body = isObjectLiteral(args[1]) ? {keys: objectKeys(args[1])} : classify(args[1]);
  }
  return {kind: 'api', path: pathArg, method, body, key: args.length >= 4 ? classify(args[3]) : null};
}

function fetchRecord(args) {
  const url = args.length ? classify(args[0]) : {src: ''};
  let method = {lit: 'GET'};
  if (args.length >= 2) {
    if (isObjectLiteral(args[1])) {
      const value = propertyValue(args[1], 'method');
      if (value) method = classify(value);
    } else method = classify(args[1]);
  }
  return {kind: 'fetch', url, method};
}

function storageRecord(name, args) {
  return {kind: name, key: args.length ? classify(args[0]) : {src: ''}};
}

function recordFor(name, args) {
  if (name === 'api') return apiRecord(args);
  if (name === 'fetch') return fetchRecord(args);
  return storageRecord(name, args);
}

function scan(src) {
  const records = [];
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
    if (char === "'" || char === '"') {
      const read = readSimpleString(src, i);
      if (read) {
        if (PATH_MARK.test(read.value)) records.push({kind: 'string', value: read.value});
        i = read.end;
        continue;
      }
    }
    if (char === '`') {
      const read = readTemplate(src, i);
      for (const part of read.parts) {
        if (PATH_MARK.test(part)) records.push({kind: 'string', value: part});
      }
      for (const expr of read.exprs) records.push(...scan(expr));
      i = read.end;
      continue;
    }
    if (char === '/' && regexCanStart(src, i)) {
      const end = skipRegex(src, i);
      if (end > i) {
        i = end;
        continue;
      }
    }
    if (isIdentStart(char)) {
      const start = i;
      i += 1;
      while (isIdentPart(src[i])) i += 1;
      const name = src.slice(start, i);
      if (CALLS.has(name)) {
        const open = skipTrivia(src, i);
        if (src[open] === '(' && !precededByFunction(src, start) && !precededByDot(src, start)) {
          records.push(recordFor(name, splitArgs(src, open).args));
        }
      }
      continue;
    }
    i += 1;
  }
  return records;
}

function compareRecords(a, b) {
  const left = JSON.stringify(a);
  const right = JSON.stringify(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function extractCallRecords(src) {
  return scan(src).sort(compareRecords);
}

export function collectFromSources(sources) {
  const found = {};
  for (const name of Object.keys(sources).sort()) found[name] = extractCallRecords(sources[name]);
  return found;
}

export function collectCalls() {
  const sources = {};
  for (const name of dataLineFiles()) sources[name] = fs.readFileSync(path.join(root, name), 'utf8');
  return collectFromSources(sources);
}

export function collectCallsAt(ref) {
  const sources = {};
  for (const name of dataLineFiles()) {
    sources[name] = execFileSync('git', ['show', `${ref}:${name}`], {cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
  }
  return collectFromSources(sources);
}

export function readCalls() {
  return JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
}

export function callChanges(found, saved) {
  const files = [...new Set([...Object.keys(found || {}), ...Object.keys(saved || {})])].sort();
  const changes = [];
  const tally = list => {
    const map = new Map();
    for (const record of list || []) {
      const key = JSON.stringify(record);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  };
  for (const file of files) {
    const next = tally(found?.[file]);
    const prev = tally(saved?.[file]);
    for (const [line, count] of next) {
      const before = prev.get(line) || 0;
      if (count > before) changes.push(file + ' added: ' + line);
    }
    for (const [line, count] of prev) {
      const after = next.get(line) || 0;
      if (count > after) changes.push(file + ' removed: ' + line);
    }
  }
  return changes.sort();
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const ref = process.argv[2] || 'origin/main';
  const found = collectCallsAt(ref);
  process.stdout.write(JSON.stringify(found, null, 2) + '\n');
}
