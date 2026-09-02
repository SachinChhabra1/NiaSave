import test from "node:test";
import assert from "node:assert/strict";
import {
  STUDIO_COUNT,
  resetBison,
  towerPayload,
  hierarchyPayload,
  inventoryPayload,
  createMember,
  createContract,
  amendContract,
  contractsPayload,
  clearClock,
  clocksPayload,
  collectionsPayload,
  workCollection,
  recordCollectionPayment,
  createBooking
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
