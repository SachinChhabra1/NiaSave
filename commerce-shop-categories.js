// Save shop is categories, not single SKUs. Manufacturer rows are test-flagged
// and never mixed into the guest catalogue. Live guest UI may list mills and
// packs; nia/kirana amounts only render when includePrices is true (preview).

export const SHOP_THEATRE = Object.freeze({
  id: 'rajputana',
  name: 'Rajputana Theatre',
  collect: 'Nia Nest Ompal'
});

export const SHOP_CATEGORY_TILES = Object.freeze([
  {id: 'groundnut_oil', name: 'Groundnut oil', hindi: 'मूंगफली का तेल', group: 'food', photoId: 'groundnut_oil'},
  {id: 'mustard_oil', name: 'Mustard oil', hindi: 'सरसों का तेल', group: 'food', photoId: 'mustard_oil'},
  {id: 'sunflower_oil', name: 'Sunflower oil', hindi: 'सूरजमुखी का तेल', group: 'food', photoId: 'sunflower_oil'},
  {id: 'coconut_oil', name: 'Coconut oil', hindi: 'नारियल का तेल', group: 'food', photoId: 'coconut_oil'},
  {id: 'bathsoap', name: 'Bath soap', hindi: 'नहाने का साबुन', group: 'personal-care', photoId: 'bathsoap_pick'},
  {id: 'toothpaste', name: 'Toothpaste', hindi: 'टूथपेस्ट', group: 'personal-care', photoId: 'toothpaste_pick'},
  {id: 'detergent', name: 'Detergent', hindi: 'डिटर्जेंट', group: 'cleaning', photoId: 'detergent_pick'}
]);

// Real-shaped mill names already used on SKUS. test:true = not live prices.
export const TEST_MANUFACTURERS = Object.freeze([
  {category: 'groundnut_oil', theatre: 'rajputana', manufacturer: 'Cold-press Tumkur', pack: '1 L pouch', nia_price_inr: 178, kirana_price_inr: 250, test: true},
  {category: 'groundnut_oil', theatre: 'rajputana', manufacturer: 'Ghani · Raichur', pack: '1 L bottle', nia_price_inr: 185, kirana_price_inr: 255, test: true},
  {category: 'groundnut_oil', theatre: 'rajputana', manufacturer: 'Refinery Hubli', pack: '1 L pouch', nia_price_inr: 192, kirana_price_inr: 260, test: true},

  {category: 'mustard_oil', theatre: 'rajputana', manufacturer: 'Ghani · Raichur', pack: '1 L pouch', nia_price_inr: 148, kirana_price_inr: 220, test: true},
  {category: 'mustard_oil', theatre: 'rajputana', manufacturer: 'Cold-press Tumkur', pack: '1 L bottle', nia_price_inr: 155, kirana_price_inr: 225, test: true},
  {category: 'mustard_oil', theatre: 'rajputana', manufacturer: 'Refinery Hubli', pack: '1 L pouch', nia_price_inr: 162, kirana_price_inr: 230, test: true},

  {category: 'sunflower_oil', theatre: 'rajputana', manufacturer: 'Refinery Hubli', pack: '1 L pouch', nia_price_inr: 118, kirana_price_inr: 170, test: true},
  {category: 'sunflower_oil', theatre: 'rajputana', manufacturer: 'Trade pack · City', pack: '1 L bottle', nia_price_inr: 128, kirana_price_inr: 177, test: true},
  {category: 'sunflower_oil', theatre: 'rajputana', manufacturer: 'Local packer · Peenya', pack: '1 L pouch', kirana_price_inr: 177, test: true},

  {category: 'coconut_oil', theatre: 'rajputana', manufacturer: 'Copra press · Tiptur', pack: '500 ml bottle', nia_price_inr: 198, kirana_price_inr: 280, test: true},
  {category: 'coconut_oil', theatre: 'rajputana', manufacturer: 'Cold-press Tumkur', pack: '500 ml bottle', nia_price_inr: 205, kirana_price_inr: 285, test: true},
  {category: 'coconut_oil', theatre: 'rajputana', manufacturer: 'Trade pack · City', pack: '500 ml bottle', nia_price_inr: 212, kirana_price_inr: 290, test: true},

  {category: 'bathsoap', theatre: 'rajputana', manufacturer: 'Soap works · Mysore', pack: '100 g bar', nia_price_inr: 48, kirana_price_inr: 68, test: true},
  {category: 'bathsoap', theatre: 'rajputana', manufacturer: 'Soap works Mysore', pack: '125 g bar', nia_price_inr: 52, kirana_price_inr: 72, test: true},
  {category: 'bathsoap', theatre: 'rajputana', manufacturer: 'Local packer · Peenya', pack: '100 g bar', nia_price_inr: 58, kirana_price_inr: 80, test: true},

  {category: 'toothpaste', theatre: 'rajputana', manufacturer: 'Trade pack · City', pack: '150 g pack', nia_price_inr: 42, kirana_price_inr: 58, test: true},
  {category: 'toothpaste', theatre: 'rajputana', manufacturer: 'Local packer · Peenya', pack: '150 g pack', nia_price_inr: 48, kirana_price_inr: 62, test: true},
  {category: 'toothpaste', theatre: 'rajputana', manufacturer: 'Ration desk Hub', pack: '100 g pack', nia_price_inr: 44, test: true},

  {category: 'detergent', theatre: 'rajputana', manufacturer: 'Local packer Peenya', pack: '1 kg pack', nia_price_inr: 72, kirana_price_inr: 104, test: true},
  {category: 'detergent', theatre: 'rajputana', manufacturer: 'Local packer · Peenya', pack: '1 kg pack', nia_price_inr: 78, kirana_price_inr: 108, test: true},
  {category: 'detergent', theatre: 'rajputana', manufacturer: 'Soap works · Mysore', pack: '500 g pack', nia_price_inr: 95, kirana_price_inr: 125, test: true}
]);

export function youSave(row) {
  const nia = Number(row?.nia_price_inr);
  const kirana = Number(row?.kirana_price_inr);
  if (!Number.isFinite(nia) || !Number.isFinite(kirana)) return null;
  if (nia <= 0 || kirana <= 0 || kirana <= nia) return null;
  return kirana - nia;
}

export function markCheapest(rows) {
  const priced = rows.filter(r => Number.isFinite(Number(r.nia_price_inr)) && Number(r.nia_price_inr) > 0);
  const min = priced.length ? Math.min(...priced.map(r => Number(r.nia_price_inr))) : null;
  return rows.map(r => ({
    ...r,
    you_save: youSave(r),
    cheapest: min != null && Number(r.nia_price_inr) === min
  }));
}

function stripPrices(row) {
  const next = {...row};
  delete next.nia_price_inr;
  delete next.kirana_price_inr;
  return next;
}

export function shopTilesFor(group) {
  if (!group || group === 'all') return [...SHOP_CATEGORY_TILES];
  return SHOP_CATEGORY_TILES.filter(tile => tile.group === group);
}

export function manufacturersFor(category, theatre = SHOP_THEATRE.id, {includePrices = false} = {}) {
  const rows = TEST_MANUFACTURERS.filter(r => r.category === category && r.theatre === theatre);
  const visible = includePrices ? rows.map(r => ({...r})) : rows.map(stripPrices);
  return markCheapest(visible);
}
