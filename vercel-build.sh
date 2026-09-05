#!/bin/sh
set -eu
# Staff HTML goes in dist. Serverless functions stay at repo-root api/.
# A static-only upload that omits api/index.mjs must fail instead of shipping HTML without JSON.
test -f api/index.mjs
test -f api/server.mjs
test -f rabbit/engine.mjs
# Product naming lock. Vercel Git production copies these files as-is.
# ops.html is Operation Polo. Regiment names on this board must fail the build.
# Desk / bison / tanot unit labels stay as shipped on those pages.
lock_fail() { echo "product rail lock: $1" >&2; exit 1; }
echo "product rail lock 0843 IST: ops.html Operation Polo / Polo"
grep -q '<title>Nia Command Center</title>' desk.html || lock_fail "desk.html title must be Nia Command Center"
for unit in 'Sikh Unit' 'Jat Unit' 'Dogra Unit' 'Assam Unit'; do
  grep -q "<strong>$unit</strong>" desk.html || lock_fail "desk.html must include $unit"
done
grep -q '<title>Operation Polo</title>' ops.html || lock_fail "ops.html title must be Operation Polo"
grep -q 'name="nia-board" content="Operation Polo"' ops.html || lock_fail "ops.html must stamp Operation Polo"
grep -q '<h1>Operation Polo</h1>' ops.html || lock_fail "ops.html heading must be Operation Polo"
grep -q 'href="/ops.html">Polo<' ops.html || lock_fail "ops.html rail must label Polo"
grep -Eq 'Sikh|Jat|Dogra|Assam' ops.html && lock_fail "ops.html has regiment names"
grep -q '<title>Jat Unit' bison.html || lock_fail "bison.html title must be Jat Unit"
grep -q 'href="/bison.html">Jat Unit<' bison.html || lock_fail "bison.html rail must label Jat Unit"
for f in bison-studios.html bison-contracts.html bison-clocks.html bison-collections.html bison-nests.html bison-data.html; do
  grep -q 'Jat Unit' "$f" || lock_fail "$f must label Jat Unit"
  grep -q 'href="/ops.html">Sikh Unit<' "$f" || lock_fail "$f rail must label Sikh Unit"
  grep -q 'href="/bison.html">Jat Unit<' "$f" || lock_fail "$f rail must label Jat Unit"
done
grep -q 'Dogra Unit' tanot/src/components.jsx || lock_fail "Dogra app must label Dogra Unit"
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
