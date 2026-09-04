/**
 * Stable Bison hierarchy metadata.
 *
 * The source studio ids come from the 30 Jun 2026 group master already loaded
 * into the production booking references. Keeping this small catalog separate
 * lets the durable house book migrate in place without embedding the 650 KB
 * import in the runtime engine.
 */
export const SOURCE_STUDIOS = {
  hsr: ["35005", "35429", "35442", "35477", "35513", "35514", "35515", "38741", "38743", "38760", "38763", "38765", "38768"],
  blr: ["34696"],
  chk: ["34998", "35006", "35421"],
  fn: ["34993", "35009", "35417", "35420", "35422", "35423", "35424", "35433", "35434", "35436", "35440", "35443", "35474", "35475", "35476", "35478", "35482", "35508", "35509", "38737", "38739"],
  mns: ["34989", "34999", "35003", "35010", "35011", "35414", "35419", "35425", "35445", "35511"],
  sri: ["34992", "34994", "35004", "35007", "35008", "35446", "35504", "35512"]
};

export const STUDIO_COUNT = Object.values(SOURCE_STUDIOS).reduce((n, rows) => n + rows.length, 0);

export function sourceStudioId(booking = {}) {
  if (booking.sourceStudioId) return String(booking.sourceStudioId);
  const match = String(booking.id || "").match(/^SFBOOKING_([^_]+)_/);
  return match ? match[1] : "";
}

export function studioIdForSource(sourceId) {
  return sourceId ? `std-${sourceId}` : "";
}

function activeOn(date, booking) {
  return booking.status !== "cancelled" && booking.status !== "out" && booking.arrive <= date && date < booking.depart;
}

function distributeCapacity(total, minimums) {
  const out = minimums.slice();
  let remaining = Math.max(0, Number(total || 0) - out.reduce((n, value) => n + value, 0));
  let index = 0;
  while (remaining > 0 && out.length) {
    out[index % out.length] += 1;
    index += 1;
    remaining -= 1;
  }
  return out;
}

export function buildStudioMaster(sites, bookings, date, existing = []) {
  const previous = new Map((existing || []).map(row => [String(row.sourceStudioId || ""), row]));
  const rows = [];
  let globalIndex = 0;

  for (const site of sites) {
    const sources = SOURCE_STUDIOS[site.id] || [];
    const minimums = sources.map(sourceId => {
      const nests = new Set(
        bookings
          .filter(booking => sourceStudioId(booking) === sourceId && activeOn(date, booking))
          .map(booking => String(booking.nestId || ""))
          .filter(Boolean)
      );
      return nests.size;
    });
    const capacities = distributeCapacity(site.contracted, minimums);

    sources.forEach((sourceId, localIndex) => {
      globalIndex += 1;
      const old = previous.get(sourceId) || {};
      rows.push({
        id: studioIdForSource(sourceId),
        sourceStudioId: sourceId,
        siteId: site.id,
        theatre: site.theatre,
        cluster: site.cluster,
        city: site.city,
        name: old.name || `${site.cluster} ${String(localIndex + 1).padStart(2, "0")}`,
        code: old.code || `${site.code}-D${String(Math.floor(localIndex / 25) + 1).padStart(2, "0")}-S${String(localIndex + 1).padStart(2, "0")}`,
        capacity: capacities[localIndex] || 0,
        owner: old.owner || site.owner,
        clockDueAt: old.clockDueAt || site.clockDueAt,
        createdAt: old.createdAt || new Date().toISOString(),
        ordinal: globalIndex
      });
    });
  }

  // Keep studios added from the live Bison master Sheet. The static catalog is
  // only the original baseline; it must not discard later operational studios
  // whenever durable state is normalised.
  const catalogIds = new Set(rows.map(row => String(row.sourceStudioId || "")));
  for (const studio of existing || []) {
    const sourceId = String(studio.sourceStudioId || "");
    if (!sourceId || catalogIds.has(sourceId)) continue;
    globalIndex += 1;
    rows.push({ ...studio, ordinal: globalIndex });
    catalogIds.add(sourceId);
  }
  return rows;
}
