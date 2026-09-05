#!/bin/sh
set -eu
# Staff HTML goes in dist. Serverless functions stay at repo-root api/.
# A static-only upload that omits api/index.mjs must fail instead of shipping HTML without JSON.
test -f api/index.mjs
test -f api/server.mjs
test -f rabbit/engine.mjs
# Product rail lock. Fail closed. Never require regiment or Unit product names.
lock_fail() { echo "product rail lock: $1" >&2; exit 1; }
echo "product rail lock 0937: Operation Polo / Bison / Tanot / All products. Regiment names fail the build."
grep -q '<title>Operation Polo</title>' ops.html || lock_fail "ops.html title must be Operation Polo"
grep -q '<h1>Operation Polo</h1>' ops.html || lock_fail "ops.html heading must be Operation Polo"
grep -q 'href="/ops.html">Polo<' ops.html || lock_fail "ops.html rail must label Polo"
grep -q 'href="/bison.html">Bison<' ops.html || lock_fail "ops.html rail must label Bison"
grep -q 'href="/tanot/">Tanot<' ops.html || lock_fail "ops.html rail must label Tanot"
grep -q 'href="/desk.html">All products<' ops.html || lock_fail "ops.html rail must label All products"
grep -Eq 'Sikh|Jat|Dogra|Assam' ops.html && lock_fail "ops.html has regiment names"
grep -q '<title>Bison' bison.html || lock_fail "bison.html title must be Bison"
grep -q 'href="/ops.html">Polo<' bison.html || lock_fail "bison.html rail must label Polo"
grep -q 'href="/bison.html">Bison<' bison.html || lock_fail "bison.html rail must label Bison"
grep -q 'href="/tanot/">Tanot<' bison.html || lock_fail "bison.html rail must label Tanot"
grep -q 'href="/desk.html">All products<' bison.html || lock_fail "bison.html rail must label All products"
grep -Eq 'Sikh|Jat|Dogra|Assam' bison.html && lock_fail "bison.html has regiment names"
for f in bison-studios.html bison-contracts.html bison-clocks.html bison-collections.html bison-nests.html bison-data.html; do
  grep -q 'href="/ops.html">Polo<' "$f" || lock_fail "$f rail must label Polo"
  grep -q 'href="/bison.html">Bison<' "$f" || lock_fail "$f rail must label Bison"
  grep -q 'href="/tanot/">Tanot<' "$f" || lock_fail "$f rail must label Tanot"
  grep -q 'href="/desk.html">All products<' "$f" || lock_fail "$f rail must label All products"
  grep -Eq 'Sikh|Jat|Dogra|Assam' "$f" && lock_fail "$f has regiment names"
done
grep -q '<strong>Polo</strong>' desk.html || lock_fail "desk.html must label Polo"
grep -q '<strong>Bison</strong>' desk.html || lock_fail "desk.html must label Bison"
grep -q '<strong>Tanot</strong>' desk.html || lock_fail "desk.html must label Tanot"
grep -Eq 'Sikh|Jat|Dogra|Assam' desk.html && lock_fail "desk.html has regiment names"
# staff.js must never rewrite Polo / Bison / Tanot to Unit names on the live board.
grep -q 'Polo: "Sikh Unit"' staff.js && lock_fail "staff.js rewrites Polo to Sikh Unit"
grep -q 'Bison: "Jat Unit"' staff.js && lock_fail "staff.js rewrites Bison to Jat Unit"
mkdir -p dist/products dist/assets
if [ -f member.html ]; then
  cp member.html dist/index.html
elif [ -f index.html ]; then
  cp index.html dist/index.html
fi
cp -f desk.html ops.html bison.html bison-studios.html bison-contracts.html bison-clocks.html bison-collections.html bison-nests.html bison-data.html pickup.html recon.html predict.html hub.html next.html cash.html source.html inventory.html ageing.html po.html dispatch.html invoice.html biker.html staff.css staff.js bison.css bison.js bison-data.js dist/
cp -f desk.html dist/2para.html
if [ -d public/products ]; then cp -r public/products/. dist/products/; fi
if [ -d assets ]; then cp -r assets/. dist/assets/; fi
if [ -f manifest.webmanifest ]; then cp -f manifest.webmanifest dist/; fi
if [ -f tanot/index.html ]; then
  npx vite build tanot --base=/tanot/ --outDir=../dist/tanot --emptyOutDir=false
fi
if [ -f research/why-blue-collar-workers-quit.html ]; then
  mkdir -p dist/research
  rm -f dist/research/why-blue-collar-workers-quit
  cp -f research/why-blue-collar-workers-quit.html dist/research/why-blue-collar-workers-quit.html
fi
