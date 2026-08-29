export const fallbackCatalog = {
  studioName: "Rajputana Theatre",
  deliveryTime: "5:15 PM",
  weeklySavings: 126,
  feverPerk: "Bag ₹500 this month → fever day free.",
  products: [
    { id: "salt", name: "Tata Salt", hindi: "नमक", size: "1 kg", price: 28, mrp: 34, image: "/products/tata-salt.png", searchTerms: ["salt", "namak"] },
    { id: "sunlite", name: "Fortune Sunlite", hindi: "तेल", size: "1 L", price: 145, mrp: 160, image: "/products/fortune-oil.png", searchTerms: ["oil", "tel"] },
    { id: "maggi", name: "Maggi 2-Minute", hindi: "मैगी", size: "70 g", price: 14, mrp: 17, image: "/products/maggi.png", searchTerms: ["maggi", "noodles"] },
    { id: "rice", name: "India Gate", hindi: "चावल", size: "5 kg", price: 389, mrp: 409, image: "/products/india-gate-rice.png", searchTerms: ["rice", "chawal"] }
  ]
};

export const fallbackWork = {
  role: "Warehouse picker",
  week: { in: 4200, due: "Friday", dueAmount: 4200, cut: 0 },
  today: { start: "08:00", end: "17:00", place: "Whitefield", bus: "7:10", distance: "600 m" },
  help: { name: "Ramesh" },
  extra: { id: "extra-tonight", when: "Tonight 6–8 PM", place: "Studio", keep: 180, weekIfTaken: 5000, status: "open" },
  next: { days: 3, role: "picker+", monthly: 1500 }
};

export const fallbackNest = {
  name: "Rajputana Theatre",
  bed: "Bed 12",
  rupee: 2200,
  walk: "12 min to work",
  event: { id: "bada-khaana", title: "Bada Khaana", when: "19:00", mine: false },
  book: [{ id: "laundry", name: "Laundry", backBy: "18:00", price: 0 }, { id: "trim", name: "Trim", price: 80 }]
};

export const fallbackHome = {
  family: { name: "Maa", place: "Bhojpur" },
  leftover: { available: 9988 },
  goal: { name: "Roof", current: 9988, target: 20000 },
  recharge: { label: "Recharge", amount: 199 },
  voice: { available: false },
  ledger: [{ date: "2026-08-12", amount: 2500 }],
  transferRail: "not_configured"
};

const hindi = { salt: "नमक", sunlite: "तेल", maggi: "मैगी", rice: "चावल" };
const images = {
  salt: "/products/tata-salt.png",
  sunlite: "/products/fortune-oil.png",
  maggi: "/products/maggi.png",
  rice: "/products/india-gate-rice.png"
};

export function normalizeCatalog(payload) {
  if (!payload?.products?.length) return fallbackCatalog;
  return {
    studioName: payload.studioName || fallbackCatalog.studioName,
    deliveryTime: payload.deliveryTime || fallbackCatalog.deliveryTime,
    weeklySavings: Number(payload.weeklySavings ?? fallbackCatalog.weeklySavings),
    feverPerk: String(payload.feverPerk || fallbackCatalog.feverPerk)
      .replace("Bag 500", "Bag ₹500")
      .replace("->", "→")
      .replace(/free\.?$/, "free."),
    products: payload.products.map((product) => ({
      ...product,
      hindi: hindi[product.id] || product.hindi,
      image: images[product.id] || product.image
    }))
  };
}

export const formatRupees = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
