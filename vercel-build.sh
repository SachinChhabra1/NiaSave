#!/bin/sh
set -eu
# Staff HTML goes in dist. Serverless functions stay at repo-root api/.
# A static-only upload that omits api/index.mjs must fail instead of shipping HTML without JSON.
test -f api/index.mjs
test -f api/server.mjs
test -f rabbit/engine.mjs
# Save operations are owned by Rafiqi Central's Sikh Unit.
node rabbit/public-naming-lock.mjs
mkdir -p dist/products dist/assets
if [ "${COMMERCE_STOREFRONT:-0}" = "1" ]; then
  cp commerce.html dist/index.html
elif [ -f member.html ]; then
  cp member.html dist/index.html
elif [ -f index.html ]; then
  cp index.html dist/index.html
fi
cp -f desk.html ops.html bison.html bison-studios.html bison-contracts.html bison-clocks.html bison-collections.html bison-nests.html bison-data.html pickup.html recon.html predict.html hub.html next.html cash.html source.html inventory.html ageing.html po.html dispatch.html invoice.html biker.html staff.css staff.js bison.css bison.js bison-data.js dist/
cp -f desk.html dist/2para.html
cp -f commerce.html commerce.css commerce.js commerce-i18n.js commerce-ops.js dist/
mkdir -p dist/commerce-locales
cp -f commerce-locales/*.js dist/commerce-locales/
cp -f member.html dist/member-services.html
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
