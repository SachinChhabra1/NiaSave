import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const retiredPublicNames = /\b(?:Polo|Bison|Tanot|Madras)\b/i;
const staffPages = [
  "ops.html", "po.html", "dispatch.html", "invoice.html", "pickup.html", "recon.html",
  "hub.html", "source.html", "predict.html", "inventory.html", "ageing.html", "biker.html",
  "cash.html", "next.html"
];
const jatPages = [
  "bison.html", "bison-studios.html", "bison-contracts.html", "bison-clocks.html",
  "bison-collections.html", "bison-nests.html", "bison-data.html"
];

function read(file) {
  return readFileSync(new URL(file, root), "utf8");
}

function publicText(html) {
  const metadata = Array.from(html.matchAll(
    /<meta\b(?=[^>]*(?:name|property)=["'](?:description|og:title|og:description|twitter:title|twitter:description)["'])[^>]*content=["']([^"']*)["'][^>]*>/gi
  ), match => match[1]);
  const visible = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [visible, ...metadata].join(" ");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const file of staffPages) {
  const html = read(file);
  assert(publicText(html).includes("Sikh Unit"), `${file} must identify Sikh Unit`);
  assert(!retiredPublicNames.test(publicText(html)), `${file} exposes a retired public name`);
}

for (const file of jatPages) {
  const html = read(file);
  assert(publicText(html).includes("Jat Unit"), `${file} must identify Jat Unit`);
  assert(!retiredPublicNames.test(publicText(html)), `${file} exposes a retired public name`);
}

const desk = read("desk.html");
assert(publicText(desk).includes("Nia Command Center"), "desk.html must identify Nia Command Center");
for (const unit of ["Sikh Unit", "Jat Unit", "Dogra Unit", "Assam Unit"]) {
  assert(publicText(desk).includes(unit), `desk.html must include ${unit}`);
}
assert(!retiredPublicNames.test(publicText(desk)), "desk.html exposes a retired public name");

const ops = read("ops.html");
for (const [href, unit] of [
  ['/ops.html', 'Sikh Unit'],
  ['/bison.html', 'Jat Unit'],
  ['/tanot/', 'Dogra Unit'],
  ['https://para-2-madras.vercel.app/', 'Assam Unit']
]) {
  assert(ops.includes(`href="${href}">${unit}<`), `ops.html directory must link ${unit}`);
}

process.stdout.write("Public naming lock passed\n");
