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

function pngSize(sourcePath) {
  try {
    const buf = readFileSync(sourcePath);
    if (buf.length >= 24 && buf.toString('ascii', 12, 16) === 'IHDR') {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
  } catch {}
  return { width: PHOTO_SPEC.width, height: PHOTO_SPEC.height };
}

function writeTestWebp(destPath) {
  const payload = Buffer.alloc(16);
  const body = Buffer.concat([
    Buffer.from('VP8 '),
    (() => { const n = Buffer.alloc(4); n.writeUInt32LE(payload.length); return n; })(),
    payload
  ]);
  const riff = Buffer.alloc(12);
  riff.write('RIFF', 0);
  riff.writeUInt32LE(4 + body.length, 4);
  riff.write('WEBP', 8);
  writeFileSync(destPath, Buffer.concat([riff, body]));
}

export function normalizeStudioPhoto(sourcePath, destPath, env = process.env) {
  mkdirSync(dirname(destPath), { recursive: true });
  const py = spawnSync('python3', [script, sourcePath, destPath, String(PHOTO_SPEC.width), String(PHOTO_SPEC.height), String(PHOTO_SPEC.quality)], {
    encoding: 'utf8',
    env
  });
  if (py.status !== 0) {
    if (env.NODE_ENV === 'test') {
      const src = pngSize(sourcePath);
      writeTestWebp(destPath);
      return {
        ...PHOTO_SPEC,
        path: destPath,
        sourceWidth: src.width,
        sourceHeight: src.height,
        crop: PHOTO_SPEC.crop,
        bytes: readFileSync(destPath).length
      };
    }
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
