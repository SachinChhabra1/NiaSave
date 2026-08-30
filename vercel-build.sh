#!/bin/sh
set -eu
mkdir -p dist/products dist/assets
if [ -f member.html ]; then
  cp member.html dist/index.html
elif [ -f index.html ]; then
  cp index.html dist/index.html
fi
cp -f ops.html pickup.html recon.html predict.html hub.html next.html cash.html source.html inventory.html ageing.html po.html dispatch.html invoice.html biker.html staff.css staff.js dist/
if [ -d public/products ]; then cp -r public/products/. dist/products/; fi
if [ -d assets ]; then cp -r assets/. dist/assets/; fi
if [ -f manifest.webmanifest ]; then cp -f manifest.webmanifest dist/; fi
if [ -f research/why-blue-collar-workers-quit.html ]; then
  mkdir -p dist/research
  rm -f dist/research/why-blue-collar-workers-quit
  cp -f research/why-blue-collar-workers-quit.html dist/research/why-blue-collar-workers-quit.html
fi
