#!/bin/sh
set -eu
# Staff HTML goes in dist. Serverless functions stay at repo-root api/.
# A static-only upload that omits api/index.mjs must fail instead of shipping HTML without JSON.
test -f api/index.mjs
test -f api/server.mjs
test -f rabbit/engine.mjs
# Product rail lock. Vercel Git production copies these files as-is.
# Regiment names on ops.html / bison.html must fail the build so a git revert cannot ship.
# Instant Rollback of 329544d still bypasses this gate. A new main SHA must ship after any promote.
lock_fail() { echo "product rail lock: $1" >&2; exit 1; }
echo "product rail lock 1856 IST: Operation Polo / Polo"
grep -q '<title>Operation Polo</title>' ops.html || lock_fail "ops.html title must be Operation Polo"
grep -q 'name="nia-board" content="Operation Polo"' ops.html || lock_fail "ops.html must stamp Operation Polo"
grep -q 'href="/ops.html">Polo<' ops.html || lock_fail "ops.html rail must label Polo"
grep -Eq 'Sikh|Jat|Dogra|Assam' ops.html && lock_fail "ops.html has regiment names"
grep -q '<title>Bison' bison.html || lock_fail "bison.html title must be Bison"
grep -q 'href="/bison.html">Bison<' bison.html || lock_fail "bison.html rail must label Bison"
grep -Eq 'Sikh|Jat|Dogra|Assam' bison.html && lock_fail "bison.html has regiment names"
for f in bison-studios.html bison-contracts.html bison-clocks.html bison-collections.html bison-nests.html bison-data.html; do
  grep -q 'href="/ops.html">Polo<' "$f" || lock_fail "$f rail must label Polo"
  grep -q 'href="/bison.html">Bison<' "$f" || lock_fail "$f rail must label Bison"
  grep -Eq 'Sikh|Jat|Dogra|Assam' "$f" && lock_fail "$f has regiment names"
done
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
