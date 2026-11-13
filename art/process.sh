#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p public/assets/art
for name in tenny domi inch moss fivel twoot bix nought muddle-cloud ring-mark; do
  magick "art/src/$name.png" -trim +repage -resize '640x640>' "public/assets/art/$name.png"
done
for name in bg-pebble-path-map bg-encounter-meadow bg-title bg-twin-falls-map bg-twin-falls-encounter bg-twin-falls-den; do
  magick "art/src/$name.png" -resize '1536x1024^' -gravity center -extent 1536x1024 -quality 85 "public/assets/art/$name.jpg"
done
