import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PHOTO_SPEC = Object.freeze({
  width: 1200,
  height: 900,
  aspect: '4:3',
  format: 'webp',
  quality: 80,
  crop: 'cover-attention',
  color: 'sRGB',
  mime: 'image/webp'
});

const script = join(dirname(fileURLToPath(import.meta.url)), '../../scripts/normalize-studio-photo.py');

export function cropWindow(width, height, targetW = PHOTO_SPEC.width, targetH = PHOTO_SPEC.height) {
  const srcRatio = width / height;
  const targetRatio = targetW / targetH;
  let cropW, cropH;
  if (srcRatio >= targetRatio) {
    cropH = height;
    cropW = Math.round(height * targetRatio);
  } else {
    cropW = width;
    cropH = Math.round(width / targetRatio);
  }
  const marginX = Math.round(cropW * 0.04);
  const marginY = Math.round(cropH * 0.04);
  return {
    cropW,
    cropH,
    minX: marginX,
    minY: marginY,
    maxX: Math.max(marginX, width - cropW - marginX),
    maxY: Math.max(marginY, height - cropH - marginY)
  };
}

export function normalizeStudioPhoto(sourcePath, destPath, env = process.env) {
  mkdirSync(dirname(destPath), { recursive: true });
  const py = spawnSync('python3', [script, sourcePath, destPath, String(PHOTO_SPEC.width), String(PHOTO_SPEC.height), String(PHOTO_SPEC.quality)], {
    encoding: 'utf8',
    env
  });
  if (py.status !== 0) {
    const err = (py.stderr || py.stdout || 'photo_normalize_unavailable').trim();
    const error = new Error(err.includes('photo_') ? err.split('\n').at(-1) : 'photo_normalize_unavailable');
    error.code = 'photo_normalize_unavailable';
    throw error;
  }
  const line = (py.stdout || '').trim().split('\n').at(-1);
  let info;
  try { info = JSON.parse(line); } catch {
    const error = new Error('photo_normalize_unavailable');
    error.code = 'photo_normalize_unavailable';
    throw error;
  }
  if (!existsSync(destPath)) {
    const error = new Error('photo_normalize_unavailable');
    error.code = 'photo_normalize_unavailable';
    throw error;
  }
  return {
    ...PHOTO_SPEC,
    path: destPath,
    sourceWidth: info.sourceWidth,
    sourceHeight: info.sourceHeight,
    crop: info.crop || PHOTO_SPEC.crop,
    bytes: readFileSync(destPath).length
  };
}

export function writeBuffer(destPath, bytes) {
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, bytes);
}
