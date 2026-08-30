import {
  DUMMY_DATA, ledgerOf, predictPayload, settlementsPayload, closeBeat, openBeat,
  scanOrder, connectorsPayload, resetDummy, WEEK_BEAT
} from "./engine.mjs";

const fails = [];
function ok(name, cond, extra) {
  if (!cond) fails.push(name + (extra ? " · " + extra : ""));
  else process.stdout.write("ok " + name + "\n");
}

ok("DUMMY_DATA on", DUMMY_DATA === true);
const led = ledgerOf();
ok("beat is this week", led.beatDate === WEEK_BEAT);
ok("identity", led.balanced && led.rows.every(r => r.opening - r.collected - r.leftover === 0));
ok("has collected", led.rows.some(r => r.collected > 0));
ok("has missed", led.rows.some(r => r.missed > 0));
ok("has reserved", led.rows.some(r => r.reserved > 0));

const pred = predictPayload();
ok("predict miss from ledger", pred.miss_rate > 0);
ok("predict load from ledger", pred.load.some(r => r.tomorrow_qty > 0 && r.why.indexOf("collected") >= 0));
ok("chase not empty", pred.chase.length > 0);

const set = settlementsPayload({ beat: "today" });
ok("settlements after collected", set.count >= 3 && set.trigger === "collected" && set.liveUpi === false);
ok("statement matched and unmatched", set.matched >= 1 && set.unmatchedStatement >= 1 && set.unmatchedSettlements >= 1);

const conn = connectorsPayload();
ok("connectors", (conn.sources || []).map(s => s.id).join(",") === "ledger,procure,members,vendors,upi_statement");

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
const after = settlementsPayload({ beat: "today" });
ok("new settlement exists", after.settlements.some(s => s.pickupCode === "S1HOLD" && s.trigger === "collected"));

if (fails.length) {
  process.stderr.write("FAIL\n" + fails.join("\n") + "\n");
  process.exit(1);
}
process.stdout.write("rabbit selftest passed\n");
