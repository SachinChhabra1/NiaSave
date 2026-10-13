// Compares this branch with the pull request base. A later PR may remove a
// baseline or translation-gap row. It must not add one, and the totals must not grow.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {baselinePath, root} from './scan.mjs';
import {gapPath} from './translations.mjs';

export function entryKey(entry) {
  return (entry.kind || 'copy') + '\0' + entry.file + '\0' + entry.string;
}

export function gapRows(gaps) {
  const rows = [];
  for (const lang of Object.keys(gaps || {}).sort()) {
    const list = Array.isArray(gaps[lang]) ? gaps[lang] : [];
    for (const string of list) rows.push({kind: 'gap', file: lang, string});
  }
  return rows;
}

export function ratchetProblems({baseline, baseBaseline, gaps, baseGaps}) {
  const problems = [];
  const knownBaseline = new Set((baseBaseline.entries || []).map(entryKey));
  for (const entry of baseline.entries || []) {
    if (!knownBaseline.has(entryKey(entry))) problems.push('BASELINE.json added ' + entry.kind + ' ' + entry.file + ': ' + entry.string);
  }
  const nextBaseline = (baseline.entries || []).length;
  const prevBaseline = (baseBaseline.entries || []).length;
  if (nextBaseline > prevBaseline) problems.push('BASELINE.json grew from ' + prevBaseline + ' to ' + nextBaseline);
  const knownGaps = new Set(gapRows(baseGaps).map(entryKey));
  for (const entry of gapRows(gaps)) {
    if (!knownGaps.has(entryKey(entry))) problems.push('translation-gaps.snapshot.json added ' + entry.file + ': ' + entry.string);
  }
  const nextGaps = gapRows(gaps).length;
  const prevGaps = gapRows(baseGaps).length;
  if (nextGaps > prevGaps) problems.push('translation gaps grew from ' + prevGaps + ' to ' + nextGaps);
  return problems;
}

function refResolves(ref) {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--end-of-options', ref], {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
    return true;
  } catch {
    return false;
  }
}

function readGit(ref, file) {
  try {
    return execFileSync('git', ['show', ref + ':' + file], {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  } catch {
    return null;
  }
}

function main() {
  const ref = process.argv[2];
  if (!ref) {
    console.error('Pass the base ref, for example origin/main.');
    process.exit(1);
  }
  if (!refResolves(ref)) {
    console.error('Base ref ' + ref + ' does not resolve.');
    process.exit(1);
  }
  const baselineFile = path.relative(root, baselinePath).split(path.sep).join('/');
  const gapsFile = path.relative(root, gapPath).split(path.sep).join('/');
  const baselineText = readGit(ref, baselineFile);
  const gapsText = readGit(ref, gapsFile);
  if (baselineText == null || gapsText == null) {
    console.log('Base ' + ref + ' has no frozen baseline yet. This pull request establishes it.');
    process.exit(0);
  }
  const problems = ratchetProblems({
    baseline: JSON.parse(fs.readFileSync(baselinePath, 'utf8')),
    baseBaseline: JSON.parse(baselineText),
    gaps: JSON.parse(fs.readFileSync(gapPath, 'utf8')),
    baseGaps: JSON.parse(gapsText)
  });
  if (problems.length) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
  console.log('No new baseline entry against ' + ref + '.');
}

if (process.argv[1] && process.argv[1].endsWith('ratchet.mjs')) main();
