import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { STUDIO_SHEET_COLUMNS } from '../lib/commerce/studio-bulk.mjs';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const dir = join(tmpdir(), 'nia-live-studios-seed');
mkdirSync(dir, { recursive: true });

function reshape(src, dest, size) {
  const py = spawnSync('python3', ['-c', `
from PIL import Image
im = Image.open(${JSON.stringify(src)}).convert('RGB')
im = im.resize(${JSON.stringify(size)}, Image.Resampling.LANCZOS)
im.save(${JSON.stringify(dest)}, 'JPEG', quality=88)
print(im.size)
`], { encoding: 'utf8' });
  if (py.status !== 0) throw new Error(py.stderr || 'reshape failed');
  return py.stdout.trim();
}

const rows = [
  { site_code: 'TEST-ALPHA', name: 'Test Studio Alpha', picture: 'alpha.jpg', src: 'assets/studio-bunk-lockers.jpg', size: [1024, 1024] },
  { site_code: 'TEST-BETA', name: 'Test Studio Beta', picture: 'beta.jpg', src: 'assets/nest-blr-demo.jpg', size: [1600, 900] },
  { site_code: 'TEST-GAMMA', name: 'Test Studio Gamma', picture: 'gamma.jpg', src: 'assets/nest-chk-demo.jpg', size: [1536, 1024] },
  { site_code: 'TEST-DELTA', name: 'Test Studio Delta', picture: 'delta.jpg', src: 'assets/studio-bunk-lockers.jpg', size: [600, 900] }
];

const pictures = {};
const csvRows = [STUDIO_SHEET_COLUMNS.join(',')];
for (const row of rows) {
  const dest = join(dir, row.picture);
  const sourceSize = reshape(join(root, row.src), dest, row.size);
  pictures[row.picture] = readFileSync(dest).toString('base64');
  csvRows.push([
    row.site_code,
    row.name,
    'Test Theatre',
    'Bengaluru',
    'Illustrative test address. Not a real Nest.',
    row.picture,
    'true'
  ].join(','));
  process.stdout.write(`${row.site_code} source ${sourceSize} -> ${row.picture}\n`);
}

const csv = csvRows.join('\n') + '\n';
writeFileSync(join(dir, 'studios.csv'), csv);

const origin = process.env.SEED_ORIGIN || 'http://127.0.0.1:8080';
const api = process.env.SEED_API || 'http://127.0.0.1:8787';
const response = await fetch(api + '/api/commerce/studios/bulk', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin },
  body: JSON.stringify({ csv, pictures })
});
const body = await response.json();
if (!response.ok) {
  console.error(body);
  process.exit(1);
}
process.stdout.write(JSON.stringify({
  ok: true,
  count: body.count,
  spec: body.spec,
  rows: (body.rows || []).map(r => ({
    site_code: r.site_code,
    studioId: r.studioId,
    url: r.media?.url,
    width: r.media?.width,
    height: r.media?.height,
    format: r.media?.format,
    quality: r.media?.quality,
    crop: r.media?.crop,
    sourceWidth: r.media?.sourceWidth,
    sourceHeight: r.media?.sourceHeight
  }))
}, null, 2) + '\n');
