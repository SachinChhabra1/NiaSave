import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOGUE_COLUMNS,
  parseCatalogueRows,
  visibleCatalogueProducts,
  overlayCatalogueProducts
} from './catalogue-connector.mjs';

const csvRow = {
  sku_id: 'groundnut_oil',
  item_name: 'Groundnut oil',
  category: 'oil',
  pack_size: '1 L',
  unit: 'bottle',
  nia_price_inr: '185',
  kirana_price_inr: '255',
  you_keep_inr: '75',
  source_site_code: 'S01',
  source_sku: 'groundnut_oil',
  studio_site_code: 'S01',
  status: 'test'
};

test('sheet columns match the Catalogue tab contract', () => {
  assert.deepEqual([...CATALOGUE_COLUMNS], [
    'sku_id', 'item_name', 'category', 'pack_size', 'unit',
    'nia_price_inr', 'kirana_price_inr', 'you_keep_inr',
    'source_site_code', 'source_sku', 'studio_site_code', 'status'
  ]);
});

test('status=test is labelled TEST on the TEST lane; hold is hidden; active stays', () => {
  const upload = { rows: [
    csvRow,
    { ...csvRow, sku_id: 'mustard_oil', item_name: 'Mustard oil', status: 'hold', nia_price_inr: '155' },
    { ...csvRow, sku_id: 'sunflower_oil', item_name: 'Sunflower oil', status: 'active', nia_price_inr: '128', pack_size: '1 L', unit: 'pouch' }
  ] };
  const parsed = parseCatalogueRows(upload);
  assert.equal(parsed.length, 3);
  const guest = visibleCatalogueProducts(parsed, { testLane: false, testViewer: false });
  assert.deepEqual(guest.map(p => p.id), ['sunflower_oil']);
  const testLane = visibleCatalogueProducts(parsed, { testLane: true });
  assert.deepEqual(testLane.map(p => p.id).sort(), ['groundnut_oil', 'sunflower_oil']);
  assert.match(testLane.find(p => p.id === 'groundnut_oil').name, /\(TEST\)/);
  assert.equal(testLane.find(p => p.id === 'groundnut_oil').pack, '1 L bottle');
  const mill = [{ id: 'mustard_oil', name: 'Mustard oil', pack: '1 L pouch' }];
  const overlaid = overlayCatalogueProducts(mill, upload, { testLane: true });
  assert.equal(overlaid.some(p => p.id === 'mustard_oil'), false);
  assert.ok(overlaid.some(p => p.id === 'groundnut_oil' && p.sourceSiteCode === 'S01'));
});

test('honesty lock drops branded / unknown SKUs and mismatched prices', () => {
  const skus = [
    { id: 'groundnut_oil', nia: 185 },
    { id: 'mustard_oil', nia: 155 }
  ];
  const upload = { rows: [
    csvRow,
    { ...csvRow, sku_id: 'STA-TAT-32', item_name: 'Tata Salt', status: 'active', nia_price_inr: '31' },
    { ...csvRow, sku_id: 'groundnut_oil', nia_price_inr: '999', status: 'active' }
  ] };
  const overlaid = overlayCatalogueProducts([], upload, { testLane: true, skus });
  assert.equal(overlaid.some(p => p.id === 'STA-TAT-32' || p.id === 'statat32'), false);
  assert.equal(overlaid.some(p => p.id === 'groundnut_oil' && p.price === 999), false);
});
