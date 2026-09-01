import assert from "node:assert/strict";
import { resetBison, towerPayload, assignNest, vacateNest, clearClock, isBisonPath, bisonPath } from "./engine.mjs";

resetBison();
assert.equal(isBisonPath("/bison/tower"), true);
assert.equal(bisonPath("/api/bison/clock", "bison/clock"), "/bison/clock");

const tower = towerPayload({ city: "All" });
assert.equal(tower.product, "bison");
assert.ok(tower.source && /Stayflexi/i.test(tower.source));
assert.ok(tower.kpis.occupied >= 2000);
assert.ok(tower.sites.length >= 50);

const vacantSite = tower.sites.find(s => s.vacant > 0 && (s.pendingPerNest || 0) <= 2000) || tower.sites.find(s => s.vacant > 0);
assert.ok(vacantSite, "need a Stayflexi site");
const before = vacantSite.vacant;
const assigned = assignNest({ siteId: vacantSite.id, nests: 1, force: true });
assert.equal(assigned.ok, true);
assert.equal(assigned.site.vacant, before - 1);

const vacated = vacateNest({ siteId: vacantSite.id, nests: 1 });
assert.equal(vacated.ok, true);
assert.equal(vacated.site.vacant, before);

const clock = clearClock({ siteId: vacantSite.id, nextHours: 18 });
assert.equal(clock.ok, true);
assert.ok(String(clock.site.clock).startsWith("Due"));

const heavy = tower.sites.find(s => (s.pendingPerNest || 0) > 2000 && s.vacant > 0);
if (heavy) {
  const hold = assignNest({ siteId: heavy.id, nests: 1 });
  assert.equal(hold.error, "hold_fill");
}

process.stdout.write("Operation Bison self-test passed\n");
