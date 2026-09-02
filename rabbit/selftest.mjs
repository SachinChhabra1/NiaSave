import {
  DUMMY_DATA, ledgerOf, predictPayload, settlementsPayload, closeBeat, openBeat,
  scanOrder, connectorsPayload, uploadConnector, sourcePayload, resetDummy, WEEK_BEAT, STUDIOS, MEMBERS,
  STUDIO_COUNT, MEMBER_COUNT, BEAT_BAGS_PER_STOP, ordersPayload, towerPayload,
  jsonSize, TOWER_MAX_BYTES, THEATRE, addStudio, stopsPayload, stockPayload, SKUS,
  placeMemberOrder, authOtp, authVerify, authMe, saveMemberFlags, ageingPayload, inventoryPayload,
  mutatePo, poPayload, mutateDispatch, mutateInvoice, invoicePayload,
  dispatchPayload, bikerPayload, mutateBiker, memberPayload, memberOrderGet, handleStaff
} from "./engine.mjs";
import { handler } from "../api/server.mjs";
import { readFileSync } from "fs";

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
const night = settlementsPayload({ beat: "today", unmatched: "1" });
ok("night unmatched first", night.unmatchedFirst === true && night.settlements.length === night.unmatchedSettlements && night.settlements.every(s => !s.matched));
ok("night unmatched statement lines", (night.unmatchedStatementLines || []).length === night.unmatchedStatement);

const conn = connectorsPayload();
ok("connectors", (conn.sources || []).map(s => s.id).join(",") === "ledger,procure,members,vendors,upi_statement");
ok("members sheet is 3000", conn.sources.find(s => s.id === "members").rows === 3000);
ok("upi empty until upload", conn.sources.find(s => s.id === "upi_statement").status === "empty" && conn.sources.find(s => s.id === "upi_statement").rows === 0);
ok("procure empty until upload", conn.sources.find(s => s.id === "procure").status === "empty" && conn.sources.find(s => s.id === "procure").rows === 0);
ok("source empty until upload", sourcePayload().sources.length === 0 && sourcePayload().from === "No file yet");

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
const officer = scanOrder({ type: "collected", orderId: "ord-s1hold", pickupCode: "S1HOLD", actor: "pickup" });
ok("officer collect from reserved", officer.ok && officer.order.status === "collected");
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

resetDummy();
const upiUp = uploadConnector({
  kind: "upi_statement",
  filename: "bank.csv",
  csv: "date,utr,amount,note\n2026-08-31,UTRTEST1,320,essentials\n2026-08-31,UTRTEST2,1,open\n"
});
ok("upload upi", upiUp.ok === true && upiUp.rows === 2 && upiUp.filename === "bank.csv");
const connAfter = connectorsPayload();
const upiSrc = connAfter.sources.find(s => s.id === "upi_statement");
ok("connectors reflect upi", upiSrc.status === "ok" && upiSrc.rows === 2 && upiSrc.filename === "bank.csv");
const nightAfter = settlementsPayload({ beat: "today", unmatched: "1" });
ok("recon uses uploaded statement", (nightAfter.unmatchedStatementLines || []).some(x => x.utr === "UTRTEST2"));
ok("uploaded statement matched collected", nightAfter.matched >= 1 && (nightAfter.statement || []).some(x => x.utr === "UTRTEST1" && x.matched));

const procUp = uploadConnector({
  kind: "procure",
  filename: "procure.csv",
  csv: "sku,name,vendor,buy_inr,keep_qty,lead_days,last_buy,status\ngroundnut_oil,Oil,Tumkur,185,75,3,2026-08-18,active\n"
});
ok("upload procure", procUp.ok === true && procUp.rows === 1);
ok("source uses procure rows", sourcePayload().sources[0] && sourcePayload().sources[0].sku === "groundnut_oil" && sourcePayload().from === "procure.csv");
const predAfter = predictPayload();
ok("predict uses procure rows", predAfter.source.some(r => r.sku === "groundnut_oil") && predAfter.sheetFrom.procure === "procure.csv");

const vendUp = uploadConnector({
  kind: "vendors",
  filename: "vendors.csv",
  csv: "vendor,phone,notes\nTumkur,99999,press\n"
});
ok("upload vendors", vendUp.ok === true && vendUp.rows === 1 && connectorsPayload().sources.find(s => s.id === "vendors").status === "ok");
ok("upload bad kind rejected", uploadConnector({ kind: "razorpay", csv: "a,b\n1,2\n" }).status === 400);
noDummyWord("connectors after upload", connectorsPayload());
noDummyWord("source after upload", sourcePayload());
resetDummy();
ok("reset clears uploads", connectorsPayload().sources.find(s => s.id === "upi_statement").status === "empty");

const stock = stockPayload();
ok("stock frozen keys", ["beatDate","theatre","stopCount","opening","stock","remaining","movements","holding"].every(k => stock[k] !== undefined));
ok("sku ids frozen", SKUS.map(s => s.id).join(" ") === "groundnut_oil mustard_oil sunflower_oil coconut_oil detergent_pick nia_detergent bathsoap_pick nia_bathsoap toothpaste_pick essentials_pick");
const age = ageingPayload();
ok("ageing num/den", age.proposed === true && age.sitting.den === 10 && age.rows.length === 10 && age.rows.every(r => r.sitting.den === 90));
const inv = inventoryPayload();
ok("inventory wraps stock", inv.stock && inv.stock.beatDate === stock.beatDate && inv.ledger && inv.lots.length === 10);
noDummyWord("stock", stock);
noDummyWord("ageing", age);
noDummyWord("inventory wrap", inv);

const setBefore = settlementsPayload({ beat: "today" }).count;
const ord = placeMemberOrder({
  beatDate: WEEK_BEAT, cart: "studio", fulfillment: "hub_collect",
  member: "Ravi", memberId: "ravi", phone: "ravi",
  pickup: "after 5", slot: "17:00", upiRef: "",
  lines: [{ id: "groundnut_oil", qty: 1, nia: 185, kirana: 255 }]
});
ok("order returns pickupCode", Boolean(ord.pickupCode) && Boolean(ord.id) && ord.payStatus === "skip");
ok("order does not settle", ord.settled === false && ord.trigger === "collected" && settlementsPayload({ beat: "today" }).count === setBefore);
ok("otp skip no send", authOtp().ok === true && authOtp().sent === false);
ok("verify skip", authVerify({ phone: "9876541042" }).ok === true && authMe().memberId === "9876541042");
ok("member flags", saveMemberFlags({ flags: { fridayHours: true } }).flags.fridayHours === true);
noDummyWord("order", ord);
noDummyWord("auth me", authMe());
resetDummy();

const mem = memberPayload();
ok("GET member skip ravi", mem.skip === true && mem.memberId === "ravi" && mem.name === "Ravi");
ok("GET member frozen keys", ["memberId","name","studioId","nest","hub","theatre","hasMira","friday_send","last_bag","last_mira"].every(k => mem[k] !== undefined));
const phoneOrder = memberOrderGet();
ok("GET order 200 skip", phoneOrder.skip === true && phoneOrder.memberId === "ravi" && Array.isArray(phoneOrder.orders));
ok("GET order uses order records", phoneOrder.orders.every(o => o.id && o.memberId === "ravi" && o.pickupCode));
ok("GET orders staff still slim", ordersPayload({ pickup: "today" }).orders.length === 0 && ordersPayload({ pickup: "today" }).orderCount === 200);
noDummyWord("GET member", mem);
noDummyWord("GET order", phoneOrder);
const getMem = await handleStaff({ method: "GET" }, {}, "/member", {}, new URL("http://x/api/member"));
ok("GET /member 200", getMem.status === 200 && getMem.body.skip === true && getMem.body.memberId === "ravi");
const getOrd = await handleStaff({ method: "GET" }, {}, "/order", {}, new URL("http://x/api/order"));
ok("GET /order 200", getOrd.status === 200 && Array.isArray(getOrd.body.orders) && getOrd.body.skip === true);
const postEmpty = await handleStaff({ method: "POST" }, {}, "/order", {}, new URL("http://x/api/order"));
ok("POST /order no_lines", postEmpty.status === 400 && postEmpty.body.error === "no_lines");
ok("GET /auth/me skip", (await handleStaff({ method: "GET" }, {}, "/auth/me", {}, new URL("http://x/api/auth/me"))).body.skip === true);
ok("stock keys after phone GET", ["beatDate","theatre","stopCount","opening","stock","remaining","movements","holding"].every(k => stockPayload()[k] !== undefined));

const poDraft = poPayload();
ok("po draft from load", (poDraft.draft || []).length > 0 && poDraft.draft.every(r => r.sku && r.qty > 0));
const created = mutatePo({ action: "create" });
ok("create PO returns poId", created.ok === true && /^PO-\d+$/.test(created.poId));
const sentPo = mutatePo({ action: "send", poId: created.poId });
ok("mark PO sent", sentPo.ok === true && sentPo.po.status === "sent");
const inboundSku = (created.po.lines[0] && created.po.lines[0].sku) || "groundnut_oil";
const openBefore = stockPayload().opening[inboundSku] || 0;
const recvPo = mutatePo({ action: "receive", poId: created.poId });
ok("mark PO received inbound", recvPo.ok === true && recvPo.inbound === true && recvPo.po.status === "received");
ok("receive posts inbound not qty field", stockPayload().opening[inboundSku] > openBefore && stockPayload().movements[inboundSku].inbound === stockPayload().opening[inboundSku]);
ok("stock keys after receive", ["beatDate","theatre","stopCount","opening","stock","remaining","movements","holding"].every(k => stockPayload()[k] !== undefined));
noDummyWord("po", poPayload());

resetDummy();
const loadTooSoon = mutateDispatch({ action: "load", stopId: "S01" });
ok("unpacked cannot load", loadTooSoon.status === 409 && loadTooSoon.error === "unpacked_remain");
const packedStop = mutateDispatch({ action: "pack", stopId: "S01" });
ok("pack remaining", packedStop.ok === true && packedStop.packed >= 1);
const dispatched = mutateDispatch({ action: "dispatch", stopId: "S01" });
ok("dispatch note", dispatched.ok === true && /^DN-\d+$/.test(dispatched.noteId) && dispatched.note && dispatched.note.stopId === "S01" && dispatched.note.slot === "17:00");

const collectedBag = ordersPayload({ pickup: "today", stop: "S02" }).orders.find(o => o.status === "collected");
ok("has collected bag for receipt", Boolean(collectedBag && collectedBag.pickupCode));
const receipt = mutateInvoice({ action: "receipt", pickupCode: collectedBag && collectedBag.pickupCode });
ok("member invoice on collected", receipt.ok === true && receipt.invoiceId && receipt.invoice.trigger === "collected" && receipt.invoice.gstin === "this phone" && receipt.invoice.liveUpi === false);
resetDummy();
const po2 = mutatePo({ action: "create" });
mutatePo({ action: "send", poId: po2.poId });
mutatePo({ action: "receive", poId: po2.poId });
const bill = mutateInvoice({ action: "vendor_bill", poId: po2.poId });
ok("vendor bill vs PO", bill.ok === true && bill.invoiceId === "INV-V-" + po2.poId && bill.invoice.poId === po2.poId);
noDummyWord("invoice", invoicePayload());
resetDummy();

const dStops = dispatchPayload().stops || [];
const s01 = dStops.find(s => s.stopId === "S01");
const s30 = dStops.find(s => s.stopId === "S30");
const s31 = dStops.find(s => s.stopId === "S31");
ok("S01 pin", Boolean(s01 && s01.lat === 21.2266 && s01.lng === 72.83613 && s01.seq === 1));
ok("S30 pin", Boolean(s30 && s30.lat === 21.2324 && s30.lng === 72.84387 && s30.seq === 30));
ok("30 shop pins", dStops.filter(s => s.lat != null && s.lng != null).length === 30);
ok("S31 off biker run", Boolean(s31 && s31.lat == null && s31.lng == null));

const bike0 = bikerPayload();
ok("biker skip liveUpi", bike0.skip === true && bike0.liveUpi === false && bike0.shops.length === 30);
ok("biker shops have lat lng", bike0.shops.every(s => typeof s.lat === "number" && typeof s.lng === "number" && s.seq >= 1 && s.seq <= 30));
ok("biker hub this phone", bike0.hub && bike0.hub.label === "this phone, not surveyed" && bike0.rider === "this phone" && bike0.bikeId === "BIKE-01");
const loadNoRun = mutateBiker({ action: "load" });
ok("load needs a run", loadNoRun.status === 404 || loadNoRun.error === "run_required");
const booked = mutateBiker({ action: "book" });
ok("book biker runId", booked.ok === true && /^RUN-\d+$/.test(booked.runId) && booked.run && booked.run.bikeId === "BIKE-01");
const loadTooSoonBike = mutateBiker({ action: "load", runId: booked.runId });
ok("unpacked cannot load bike", loadTooSoonBike.status === 409 && loadTooSoonBike.error === "unpacked_remain");
for (let i = 1; i <= 30; i++) {
  mutateDispatch({ action: "pack", stopId: "S" + String(i).padStart(2, "0") });
}
const loadedBike = mutateBiker({ action: "load", runId: booked.runId });
ok("load at hub after pack", loadedBike.ok === true && loadedBike.loaded >= 1);
const dropped = mutateBiker({ action: "drop", runId: booked.runId, stopId: "S01" });
ok("drop at shop pin", dropped.ok === true && dropped.stopId === "S01" && dropped.lat === 21.2266 && dropped.lng === 72.83613 && dropped.seq === 1);
const back = mutateBiker({ action: "return", runId: booked.runId });
ok("return to hub", back.ok === true && back.run && back.run.status === "returned");
noDummyWord("biker", bikerPayload());
ok("stock keys after biker", ["beatDate","theatre","stopCount","opening","stock","remaining","movements","holding"].every(k => stockPayload()[k] !== undefined));
resetDummy();

function staffGet(path) {
  return new Promise((resolve, reject) => {
    const req = { method: "GET", url: path, headers: {} };
    const res = {
      statusCode: 0,
      writeHead(code) { this.statusCode = code; },
      end(s) {
        try {
          resolve({ status: this.statusCode, raw: s, body: JSON.parse(s || "{}") });
        } catch (e) {
          reject(e);
        }
      }
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}
const skipBar = ["/api/orders", "/api/ledger", "/api/predict", "/api/biker", "/api/po", "/api/invoice", "/api/connectors", "/api/beat"];
for (const path of skipBar) {
  const got = await staffGet(path);
  ok(path + " unauth 200 JSON", got.status === 200 && got.body && got.body.error !== "staff_required" && typeof got.raw === "string" && !/^<!DOCTYPE|^<html/i.test(got.raw));
  ok(path + " skip liveUpi", got.body.skip === true && got.body.liveUpi === false);
  noDummyWord(path, got.body);
}
const getMemberLive = await staffGet("/api/member");
ok("GET /api/member still 200", getMemberLive.status === 200 && getMemberLive.body.skip === true);
const getStockLive = await staffGet("/api/stock");
ok("GET /api/stock keys frozen", ["beatDate","theatre","stopCount","opening","stock","remaining","movements","holding"].every(k => getStockLive.body[k] !== undefined));

const staffPages = [
  "ops.html","po.html","dispatch.html","invoice.html","pickup.html","recon.html",
  "hub.html","source.html","predict.html","inventory.html","ageing.html","biker.html",
  "cash.html","next.html"
];
for (const file of staffPages) {
  const html = readFileSync(new URL("../" + file, import.meta.url), "utf8");
  ok(file + " says Operation Polo", /Operation Polo/.test(html));
  ok(file + " has no Rabbit", !/Rabbit|RABBIT/.test(html));
  ok(file + " has no Jabali", !/Jabali|Jamali|JABALI|JAMALI/.test(html));
  ok(file + " has no Dummy", !/Dummy/.test(html));
  ok(file + " has no polo-icon", !/polo-icon/.test(html));
  ok(file + " has no Beat board", !/Beat board|beat board/.test(html));
}
const opsHtml = readFileSync(new URL("../ops.html", import.meta.url), "utf8");
const staffCss = readFileSync(new URL("../staff.css", import.meta.url), "utf8");
ok("staff.css has no IBM Plex", !/IBM Plex|Plex Sans|Plex Mono|fonts\.googleapis/.test(staffCss));
ok("staff.css phone --font", /--font:-apple-system,"SF Pro Display","SF Pro Text","Helvetica Neue","Segoe UI",Arial,sans-serif/.test(staffCss));
ok("staff.css phone --mono", /--mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace/.test(staffCss));
ok("ops nia then Operation Polo", /class="nia-logo"[\s\S]{0,200}Operation Polo/.test(opsHtml));
ok("ops has no polo-icon", !/polo-icon/.test(opsHtml));
ok("ops job icons in source", /id="i-biker"/.test(opsHtml) && /id="i-po"/.test(opsHtml) && /id="i-dispatch"/.test(opsHtml));
const rail = (opsHtml.split('class="rail"')[1] || "").split('class="pane"')[0];
ok("ops load says 40 studios", /40 studios/.test(opsHtml) && /One theatre\. 40 studios\. 3000 members/.test(opsHtml));
ok("ops load has no 40 stops", !/40 stops/.test(opsHtml) && !/\+' stops/.test(opsHtml) && !/\['Stops'/.test(opsHtml));
ok("ops sequence 1 to 5", /1<\/b> Member ordered[\s\S]*→[\s\S]*2<\/b> Hub loaded[\s\S]*→[\s\S]*3<\/b> Member collected or returned[\s\S]*→[\s\S]*4<\/b> Hub settled with officer[\s\S]*→[\s\S]*5<\/b> Nia paid vendor/.test(opsHtml));
ok("ops vendor pay is last", opsHtml.indexOf("5</b> Nia paid vendor") > opsHtml.indexOf("4</b> Hub settled with officer") && opsHtml.indexOf("5</b> Nia paid vendor") > opsHtml.indexOf("2</b> Hub loaded"));
ok("ops no bare Settled or Paid labels", !/<b>\d<\/b> Settled/.test(opsHtml) && !/<b>\d<\/b> Paid/.test(opsHtml) && !/'Settled'/.test(opsHtml) && !/'Paid'/.test(opsHtml));
ok("ops h1 is Operation Polo once", (opsHtml.match(/<h1>Operation Polo<\/h1>/g) || []).length === 1);
ok("ops header has no brand kicker", !/<div class="brand">/.test(opsHtml));
ok("ops rail Reports and Ops", /<h2 class="rail-h"[^>]*>Reports<\/h2>/.test(rail) && /<h2 class="rail-h"[^>]*>Ops<\/h2>/.test(rail));
ok("inventory under Reports", rail.indexOf("Reports") < rail.indexOf(">Inventory<") && rail.indexOf(">Inventory<") < rail.indexOf(">Ops<"));
ok("biker po dispatch under Ops", rail.indexOf(">Ops<") < rail.indexOf(">Biker<") && rail.indexOf(">Ops<") < rail.indexOf(">Purchase order<") && rail.indexOf(">Ops<") < rail.indexOf(">Dispatch<"));
ok("biker desk exists", /Book biker/.test(readFileSync(new URL("../biker.html", import.meta.url), "utf8")));

if (fails.length) {
  process.stderr.write("FAIL\n" + fails.join("\n") + "\n");
  process.exit(1);
}
process.stdout.write("polo selftest passed\n");
