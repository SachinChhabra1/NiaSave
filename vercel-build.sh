#!/bin/sh
set -eu
mkdir -p dist/products dist/assets
if [ -f member.html ]; then
  cp member.html dist/index.html
elif [ -f index.html ]; then
  cp index.html dist/index.html
fi
cp -f ops.html pickup.html recon.html predict.html hub.html next.html cash.html source.html staff.css dist/
if [ -d public/products ]; then cp -r public/products/. dist/products/; fi
if [ -d assets ]; then cp -r assets/. dist/assets/; fi
