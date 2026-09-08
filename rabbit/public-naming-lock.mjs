import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const regiment = /Jat|Dogra|Assam/;
const poloPages = ["ops.html"];
const bisonPages = [
  "bison.html", "bison-studios.html", "bison-contracts.html", "bison-clocks.html",
  "bison-collections.html", "bison-nests.html", "bison-data.html"
];

function read(file) {
  return readFileSync(new URL(file, root), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const file of poloPages) {
  const html = read(file);
  assert(html.includes("<title>Sikh Unit</title>"), `${file} title must be Sikh Unit`);
  assert(html.includes("<h1>Sikh Unit</h1>"), `${file} heading must be Sikh Unit`);
  assert(html.includes('href="/ops.html">Sikh Unit<'), `${file} rail must label Sikh Unit`);
  assert(html.includes('href="/bison.html">Bison<'), `${file} rail must label Bison`);
  assert(html.includes('href="/tanot/">Tanot<'), `${file} rail must label Tanot`);
  assert(html.includes('href="/desk.html">All products<'), `${file} rail must label All products`);
  assert(html.includes("Could not load Sikh Unit."), `${file} empty-state must say Sikh Unit`);
  assert(!regiment.test(html), `${file} has regiment names`);
}

for (const file of bisonPages) {
  const html = read(file);
  assert(html.includes('href="/ops.html">Sikh Unit<'), `${file} rail must label Sikh Unit`);
  assert(html.includes('href="/bison.html">Bison<'), `${file} rail must label Bison`);
  assert(html.includes('href="/tanot/">Tanot<'), `${file} rail must label Tanot`);
  assert(html.includes('href="/desk.html">All products<'), `${file} rail must label All products`);
  assert(!regiment.test(html), `${file} has regiment names`);
}

const desk = read("desk.html");
assert(desk.includes("<strong>Polo</strong>"), "desk.html must label existing Save card");
assert(desk.includes("<strong>Bison</strong>"), "desk.html must label Bison");
assert(desk.includes("<strong>Tanot</strong>"), "desk.html must label Tanot");
assert(!regiment.test(desk), "desk.html has regiment names");

const staffJs = read("staff.js");
assert(!/Polo:\s*"Sikh Unit"/.test(staffJs), "staff.js rewrites Polo to Sikh Unit");
assert(!/"Sikh Unit":\s*"Sikh Unit"/.test(staffJs), "staff.js rewrites Sikh Unit to Sikh Unit");
assert(!/label:\s*"Sikh Unit"/.test(staffJs), "staff.js injects Sikh Unit rail labels");
assert(!/unitLinks\s*=/.test(staffJs), "staff.js must not inject a Unit directory");

process.stdout.write("Public naming lock passed\n");
