import {
  DUMMY_DATA, ledgerOf, predictPayload, settlementsPayload, closeBeat, openBeat,
  scanOrder, connectorsPayload, resetDummy, WEEK_BEAT, STUDIOS, MEMBERS,
  STUDIO_COUNT, MEMBER_COUNT, BEAT_BAGS_PER_STOP, ordersPayload, towerPayload,
  jsonSize, TOWER_MAX_BYTES, THEATRE, addStudio, stopsPayload
} from "./engine.mjs";

const fails = [];
function ok(name, cond, extra) {
  if (!cond) fails.push(name + (extra ? " · " + extra : ""));
  else process.stdout.write("ok " + name + "\n");
}

ok("DUMMY_DATA on", DUMMY_DATA === true);
ok("one theatre", THEATRE.name === "Rajputana Theatre");
ok("40 studios", STUDIOS.length === STUDIO_COUNT && STUDIO_COUNT === 40);
ok("3000 members", MEMBERS.length === MEMBER_COUNT && MEMBER_COUNT === 3000);
ok("not 10k orders", BEAT_BAGS_PER_STOP * STUDIO_COUNT === 200);

const led = ledgerOf();
ok("beat is this week", led.beatDate === WEEK_BEAT);
ok("identity", led.balanced && led.rows.every(r => r.opening - r.collected - r.leftover === 0));
ok("has collected", led.rows.some(r => r.collected > 0));
ok("has missed", led.rows.some(r => r.missed > 0));
ok("has reserved", led.rows.some(r => r.reserved > 0));
ok("ledger has no order blob", led.orders == null && led.orderCount === 200);
ok("SKU opening sized for 40 stops", led.rows.every(r => r.opening >= 70));

const pred = predictPayload();
ok("predict miss from ledger", pred.miss_rate > 0);
ok("predict load from ledger", pred.load.some(r => r.tomorrow_qty > 0 && r.why.indexOf("collected") >= 0));
ok("chase not empty", pred.chase.length > 0 && pred.chaseCount > pred.chase.length);
ok("predict samples only", pred.members.length <= 12 && pred.quietMembers.length <= 12 && pred.sendPending.length <= 12);
ok("predict knows 3000", pred.memberCount === 3000 && pred.stopCount === 40);
ok("predict gates num/den", pred.gates && pred.gates.proposed === true && pred.gates.participation.den === 3000 && pred.gates.sellThrough.num != null);

const set = settlementsPayload({ beat: "today" });
ok("settlements after collected", set.count >= 3 && set.trigger === "collected" && set.liveUpi === false);
ok("statement matched and unmatched", set.matched >= 1 && set.unmatchedStatement >= 1 && set.unmatchedSettlements >= 1);

const conn = connectorsPayload();
ok("connectors", (conn.sources || []).map(s => s.id).join(",") === "ledger,procure,members,vendors,upi_statement");
ok("members sheet is 3000", conn.sources.find(s => s.id === "members").rows === 3000);

const listed = ordersPayload({ pickup: "today" });
ok("orders default slim", listed.orders.length === 0 && listed.orderCount === 200 && listed.stops.length === 40);
const one = ordersPayload({ pickup: "today", stop: "S01" });
ok("orders one stop", one.orders.length === BEAT_BAGS_PER_STOP && one.orders.every(o => o.stopId === "S01"));
ok("S1HOLD on S01", one.orders.some(o => o.id === "ord-s1hold" && o.pickupCode === "S1HOLD"));
ok("public pay is skip or captured", one.orders.every(o => o.payStatus === "skip" || o.payStatus === "captured"));
function noDummyWord(name, obj) {
  ok(name + " has no Dummy word", !/dummy/i.test(JSON.stringify(obj)));
}
noDummyWord("predict", pred);
noDummyWord("tower", towerPayload());
noDummyWord("orders one stop", one);
noDummyWord("connectors", connectorsPayload());
noDummyWord("settlements", set);
noDummyWord("stops", stopsPayload());

const tower = towerPayload();
const towerBytes = jsonSize(tower);
ok("tower under cap", towerBytes < TOWER_MAX_BYTES, String(towerBytes));
ok("tower has no order blob", tower.ledger && tower.ledger.orders == null);
ok("tower sized for go-live", tower.stopCount === 40 && tower.memberCount === 3000 && tower.bagsTonight === 200);
ok("tower predict has no 3000 dump", (tower.predict.members || []).length === 0);
ok("tower gates proposed", tower.gates && tower.gates.proposed === true && tower.gates.participation.den === 3000);

const added = addStudio({ name: "Nia Nest sheet row" });
ok("add studio without rewrite", added.ok && added.rewritten === false && added.stopCount === 41);
ok("stops list grew", stopsPayload().stopCount === 41 && stopsPayload().stops.some(s => s.stopId === "S41"));
resetDummy();
ok("reset back to 40", stopsPayload().stopCount === 40);

resetDummy();
const zeroOpen = {};
for (const sku of Object.keys(ledgerOf().opening)) zeroOpen[sku] = 0;
openBeat({ opening: zeroOpen, beatDate: WEEK_BEAT, replace: true });
const lastUnit = scanOrder({ type: "packed", orderId: "ord-s1hold", actor: "test" });
ok("last unit one reservation wins", lastUnit.status === 409 && lastUnit.error === "last_unit_taken");
resetDummy();

const bad = closeBeat({ closing: { groundnut_oil: 999 }, beatDate: WEEK_BEAT });
ok("close 409 on mismatch", bad.status === 409 && bad.mismatch && bad.mismatch.length);

const goodClose = closeBeat({ closing: led.leftover, beatDate: WEEK_BEAT });
ok("close 200 when leftover matches", goodClose.ok === true);

const already = openBeat({ opening: led.opening, beatDate: WEEK_BEAT });
ok("open 409 when already open", already.status === 409 && already.error === "already_open");

resetDummy();
const packed = scanOrder({ type: "packed", orderId: "ord-s1hold", actor: "test" });
ok("scan reserved to packed", packed.ok && packed.order.status === "packed");
const loaded = scanOrder({ type: "loaded", orderId: "ord-s1hold" });
const arrived = scanOrder({ type: "arrived", orderId: "ord-s1hold" });
const collected = scanOrder({ type: "collected", orderId: "ord-s1hold", pickupCode: "S1HOLD" });
ok("collected scan settles", collected.ok && collected.order.status === "collected");
ok("scan has no ledger blob", collected.ledger == null);
const after = settlementsPayload({ beat: "today" });
ok("new settlement exists", after.settlements.some(s => s.pickupCode === "S1HOLD" && s.trigger === "collected"));

if (fails.length) {
  process.stderr.write("FAIL\n" + fails.join("\n") + "\n");
  process.exit(1);
}
process.stdout.write("rabbit selftest passed\n");
