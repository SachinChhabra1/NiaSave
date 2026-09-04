import test from "node:test";
import assert from "node:assert/strict";
import {
  STUDIO_COUNT,
  resetBison,
  towerPayload,
  hierarchyPayload,
  inventoryPayload,
  bookingsPayload,
  createMember,
  createContract,
  amendContract,
  contractsPayload,
  clearClock,
  clocksPayload,
  collectionsPayload,
  workCollection,
  recordCollectionPayment,
  createBooking,
  importBisonData,
  membersPayload,
  sheetConfig,
  ingestBook
} from "./engine.mjs";

test("migrates the six clusters into a reconciled 56-studio hierarchy", () => {
  resetBison();
  const tower = towerPayload({ city: "All" });
  const hierarchy = hierarchyPayload({});
  assert.equal(STUDIO_COUNT, 56);
  assert.equal(tower.kpis.studios, 56);
  assert.equal(hierarchy.studios.length, 56);
  assert.equal(new Set(hierarchy.studios.map(row => row.code)).size, 56);
  assert.equal(hierarchy.studios.reduce((n, row) => n + row.capacity, 0), 3131);
  assert.equal(tower.reconciliation.ok, true);
  assert.equal(tower.reconciliation.delta, 0);
  assert.equal(tower.reconciliation.booked, tower.reconciliation.inHouse + tower.reconciliation.reserved);
});

test("validates browser and CSV imports without mutating on dry run", () => {
  resetBison();
  const before = membersPayload({ limit: 200 }).count;
  const checked = importBisonData({ table: "members", rows: [{ member_name: "Dry Run Member", phone: "9876500000" }], commit: false, actor: "Importer" });
  assert.equal(checked.ok, true);
  assert.equal(checked.dryRun, true);
  assert.equal(membersPayload({ limit: 200 }).count, before);
  const saved = importBisonData({ table: "members", rows: [{ member_name: "Saved Member", phone: "9876500001" }], commit: true, actor: "Importer" });
  assert.equal(saved.ok, true);
  assert.equal(membersPayload({ q: "9876500001" }).count, 1);
});

test("adds and preserves a live Sheet studio outside the original catalog", () => {
  resetBison();
  const before = hierarchyPayload({}).studioCount;
  const saved = importBisonData({ table: "studios", rows: [{ theatre: "Wellington", studio_code: "WLG-HSR-LIVE-01", studio_name: "Live Studio", capacity: 12 }], commit: true, actor: "Google Sheet sync" });
  assert.equal(saved.ok, true);
  const hierarchy = hierarchyPayload({});
  assert.equal(hierarchy.studioCount, before + 1);
  assert.equal(hierarchy.studios.find(row => row.code === "WLG-HSR-LIVE-01").capacity, 12);
});

test("updates a repeated Sheet booking instead of duplicating it", () => {
  resetBison();
  const studio = hierarchyPayload({}).studios[0];
  const row = { action: "create", studio_code: studio.code, nest_id: "SYNC-N1", member_name: "Sync Member", start_date: "2026-09-04", end_date: "2026-10-04", status: "reserved", monthly_rent: 2200 };
  assert.equal(importBisonData({ table: "bookings", rows: [row], commit: true, actor: "Google Sheet sync" }).ok, true);
  assert.equal(importBisonData({ table: "bookings", rows: [{ ...row, monthly_rent: 2500 }], commit: true, actor: "Google Sheet sync" }).ok, true);
  const matches = bookingsPayload({ studioId: studio.id }).bookings.filter(item => item.nestId === "SYNC-N1");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].rate, 2500);
});

test("attaches a Sheet contract to its existing occupancy booking", () => {
  resetBison();
  const studio = hierarchyPayload({}).studios[0];
  const booking = createBooking({ studioId: studio.id, nestId: "SYNC-C1", guest: "Contract Sync", arrive: "2026-09-04", depart: "2026-10-04", status: "in", rate: 2200, actor: "Google Sheet sync" });
  const imported = importBisonData({ table: "contracts", rows: [{ member_name: "Contract Sync", phone: "9000099999", studio_code: studio.code, nest_id: "SYNC-C1", start_date: "2026-09-04", end_date: "2026-10-04", monthly_rent: 2200, document_status: "signed" }], commit: true, actor: "Google Sheet sync" });
  assert.equal(imported.ok, true);
  assert.equal(contractsPayload({ memberId: booking.booking.memberId }).contracts[0].bookingId, booking.booking.id);
  assert.equal(bookingsPayload({ studioId: studio.id }).bookings.filter(row => row.nestId === "SYNC-C1").length, 1);
});

test("rejects an entire import when any row is invalid", () => {
  resetBison();
  const before = membersPayload({ limit: 200 }).count;
  const result = importBisonData({ table: "members", rows: [{ member_name: "Valid Member", phone: "9876500010" }, { phone: "9876500011" }], commit: true, actor: "Importer" });
  assert.equal(result.error, "validation_failed");
  assert.equal(membersPayload({ limit: 200 }).count, before);
});

test("stores a future Google Sheet link without claiming it synced", () => {
  resetBison();
  const result = sheetConfig({ url: "https://docs.google.com/spreadsheets/d/test-sheet-id/edit", enabled: false, actor: "Importer" });
  assert.equal(result.ok, true);
  assert.equal(result.config.spreadsheetId, "test-sheet-id");
  assert.equal(result.config.lastSyncAt, null);
});

test("keeps identical source nest labels separate across studios", () => {
  resetBison();
  const studios = hierarchyPayload({}).studios.filter(row => row.siteId === "hsr").slice(0, 2);
  const first = createBooking({ studioId: studios[0].id, nestId: "R99N1", arrive: "2026-09-02", depart: "2026-10-02", actor: "Test" });
  const second = createBooking({ studioId: studios[1].id, nestId: "R99N1", arrive: "2026-09-02", depart: "2026-10-02", actor: "Test" });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.notEqual(first.booking.nestCode, second.booking.nestCode);
  assert.equal(inventoryPayload({ date: "2026-09-02" }).reconciliation.ok, true);
});

test("reconciles unique named nests while surfacing overlapping open stays", () => {
  resetBison();
  const studio = hierarchyPayload({}).studios[0];
  ingestBook({ bookings: [
    { id: "overlap-in", studioId: studio.id, siteId: studio.siteId, nestId: "R98N1", arrive: "2026-09-01", depart: "2026-10-01", status: "in" },
    { id: "overlap-reserved", studioId: studio.id, siteId: studio.siteId, nestId: "R98N1", arrive: "2026-09-02", depart: "2026-10-02", status: "reserved" }
  ], actor: "Test" });
  const reconciliation = inventoryPayload({ date: "2026-09-02" }).reconciliation;
  assert.equal(reconciliation.ok, true);
  assert.equal(reconciliation.delta, 0);
  assert.equal(reconciliation.openStays - reconciliation.booked, 1);
  assert.equal(reconciliation.overlaps, 1);
});

test("creates an auditable member contract, booking and opening charge", () => {
  resetBison();
  const studio = hierarchyPayload({}).studios.find(row => row.vacant > 0);
  const member = createMember({ name: "Test Member", phone: "9000000001", verificationStatus: "verified", actor: "Admin" });
  assert.equal(member.ok, true);
  const before = collectionsPayload({}).total;
  const result = createContract({ memberId: member.member.id, studioId: studio.id, nestId: "QA-N1", startDate: "2026-09-02", endDate: "2026-10-02", monthlyRent: 2400, deposit: 1000, signedStatus: "signed", checkIn: true, actor: "Admin" });
  assert.equal(result.ok, true);
  assert.equal(result.contract.status, "active");
  assert.equal(result.booking.memberId, member.member.id);
  assert.equal(collectionsPayload({}).total, before + 2400);
  assert.equal(amendContract({ contractId: result.contract.id, monthlyRent: 2500, actor: "Admin" }).error, "reason_required");
  const amended = amendContract({ contractId: result.contract.id, monthlyRent: 2500, reason: "Approved renewal", actor: "Admin" });
  assert.equal(amended.ok, true);
  assert.equal(amended.contract.amendments.length, 1);
  assert.equal(contractsPayload({ memberId: member.member.id }).count, 1);
});

test("requires evidence and all checks before closing a studio clock", () => {
  resetBison();
  const studio = hierarchyPayload({}).studios[0];
  assert.equal(clearClock({ studioId: studio.id, actor: "Satish" }).error, "evidence_required");
  assert.equal(clearClock({ studioId: studio.id, actor: "Satish", evidence: "Register 42" }).error, "checklist_incomplete");
  const closed = clearClock({ studioId: studio.id, actor: "Satish", evidence: "Register 42 and photo 7", checks: { physicalCount: true, vacantVerified: true, collectionsReviewed: true }, countedNests: studio.booked, vacantNests: studio.vacant });
  assert.equal(closed.ok, true);
  assert.match(closed.studio.clock, /^Due/);
  assert.equal(clocksPayload({ studioId: studio.id }).events[0].actor, "Satish");
});

test("splits historic roll-ups before member payment and preserves the control total", () => {
  resetBison();
  const studio = hierarchyPayload({}).studios.find(row => row.vacant > 0);
  const member = createMember({ name: "Collection Member", phone: "9000000002", actor: "Kavita" });
  const contract = createContract({ memberId: member.member.id, studioId: studio.id, nestId: "QA-C1", startDate: "2026-09-02", endDate: "2026-10-02", monthlyRent: 2200, firstCharge: false, actor: "Kavita" }).contract;
  const before = collectionsPayload({});
  const legacy = before.receivables.find(row => !row.memberId && row.siteId === studio.siteId);
  assert.equal(recordCollectionPayment({ receivableId: legacy.id, amount: 10, reference: "UTR-X", actor: "Kavita" }).error, "allocate_first");
  const allocated = workCollection({ receivableId: legacy.id, contractId: contract.id, allocationAmount: 500, owner: "Kavita", note: "Source statement checked", actor: "Kavita" });
  assert.equal(allocated.ok, true);
  assert.notEqual(allocated.receivable.id, legacy.id);
  assert.equal(collectionsPayload({}).total, before.total);
  assert.equal(collectionsPayload({}).unallocated, before.unallocated - 500);
  const paid = recordCollectionPayment({ receivableId: allocated.receivable.id, amount: 200, reference: "UTR-TEST-1", actor: "Kavita" });
  assert.equal(paid.ok, true);
  assert.equal(paid.receivable.status, "partial");
  assert.equal(collectionsPayload({}).total, before.total - 200);
});
