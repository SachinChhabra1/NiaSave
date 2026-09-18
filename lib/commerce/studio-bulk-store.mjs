import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHOTO_SPEC } from './studio-photo.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const MEDIA_DIR = join(root, 'assets/studio-media/test');
export const MANIFEST = join(MEDIA_DIR, 'manifest.json');
export const PUBLIC_PREFIX = '/assets/studio-media/test';

let memory = { rows: [], updatedAt: null };
let loaded = false;

function persistEnabled() {
  return process.env.NODE_ENV !== 'test';
}

function readDisk() {
  if (!existsSync(MANIFEST)) return { rows: [], updatedAt: null };
  try {
    const parsed = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    if (!parsed || !Array.isArray(parsed.rows)) return { rows: [], updatedAt: null };
    return { rows: parsed.rows, updatedAt: parsed.updatedAt || null, spec: parsed.spec || PHOTO_SPEC };
  } catch {
    return { rows: [], updatedAt: null };
  }
}

export function loadTestStudios() {
  if (loaded) return memory;
  loaded = true;
  if (!persistEnabled()) return memory;
  memory = readDisk();
  return memory;
}

export function listActiveTestStudios() {
  return loadTestStudios().rows.filter(row => row.test === true && row.active !== false);
}

export function saveTestStudios(rows, time = new Date().toISOString()) {
  memory = { rows, updatedAt: time, spec: PHOTO_SPEC };
  loaded = true;
  if (!persistEnabled()) return memory;
  mkdirSync(MEDIA_DIR, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify({
    owner: 'central',
    preview: true,
    test: true,
    spec: PHOTO_SPEC,
    updatedAt: time,
    rows
  }, null, 2));
  const keep = new Set(rows.map(row => `${row.site_code}.webp`));
  for (const name of readdirSync(MEDIA_DIR)) {
    if (name.endsWith('.webp') && !keep.has(name)) unlinkSync(join(MEDIA_DIR, name));
  }
  return memory;
}

export function clearTestStudios() {
  memory = { rows: [], updatedAt: null };
  loaded = true;
}

export function mediaPath(siteCode) {
  return join(MEDIA_DIR, `${siteCode}.webp`);
}

export function mediaUrl(siteCode) {
  return `${PUBLIC_PREFIX}/${siteCode}.webp`;
}
