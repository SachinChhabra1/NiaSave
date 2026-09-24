#!/bin/sh
set -eu
# Staff HTML goes in dist. Serverless functions stay at repo-root api/.
# A static-only upload that omits api/index.mjs must fail instead of shipping HTML without JSON.
test -f api/index.mjs
test -f api/server.mjs
test -f rabbit/engine.mjs
# Save operations are owned by Rafiqi Central's Sikh Unit.
node rabbit/public-naming-lock.mjs
node scripts/splice-apple-home.mjs
mkdir -p dist/products dist/assets
# Production member home is commerce.html (generic SKUs). The React P0 catalog
# (Tata Salt / Fortune / invented weekly savings) must never be dist/index.html.
if [ "${VERCEL_ENV:-}" = "production" ] || [ "${COMMERCE_STOREFRONT:-0}" = "1" ]; then
  cp commerce.html dist/index.html
elif [ -f member.html ]; then
  cp member.html dist/index.html
elif [ -f index.html ]; then
  cp index.html dist/index.html
fi
cp -f desk.html ops.html bison.html bison-studios.html bison-contracts.html bison-clocks.html bison-collections.html bison-nests.html bison-data.html pickup.html recon.html predict.html hub.html next.html cash.html source.html inventory.html ageing.html po.html dispatch.html invoice.html biker.html vendors.html payout.html save-desk.html staff.css staff.js save-desk-ui.css nia-operator.css bison.css bison.js bison-data.js dist/
cp -f desk.html dist/2para.html
cp -f staff-entry.js dist/
cp -f apple-desktop.css niasave-system.css niasave-apple-store.css niasave-ui.js dist/
cp -f live-studios.html dist/
cp -f commerce.html commerce.css commerce.js commerce-analytics.js commerce-content-qa.js commerce-capabilities.js commerce-truth.js commerce-owner.js commerce-passkeys.js commerce-member-auth.js commerce-i18n.js commerce-books.js commerce-services.js commerce-support.js commerce-plan.js commerce-earn-map.js commerce-categories.js commerce-shop-categories.js commerce-ops.js commerce-wave0.css commerce-wave0.js commerce-waves.css commerce-waves.js dist/
mkdir -p dist/commerce-locales dist/lib/commerce
cp -f lib/commerce/support.mjs lib/commerce/partner-gate.mjs lib/commerce/analytics.mjs lib/commerce/content-qa.mjs dist/lib/commerce/
cp -R commerce-locales/. dist/commerce-locales/
# Every module commerce.html imports must exist in dist, or the member UI fails to load in production.
for f in $(grep -o "from '\./[a-z-]*\.js'" commerce.js commerce-books.js commerce-services.js commerce-support.js commerce-plan.js commerce-i18n.js | sed "s/.*from '\.\///; s/'//" | sort -u); do test -f "dist/$f" || { echo "missing dist/$f"; exit 1; }; done
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
