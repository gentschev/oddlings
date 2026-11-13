#!/bin/sh
# Original project art composed locally. The maskable artwork stays in the safe circle.
set -eu
cd "$(dirname "$0")/.."
mkdir -p public/icons
for size in 192 512; do
  art_width=$((size * 78 / 100))
  radius=$((size * 18 / 100))
  edge=$((size - 1))
  magick -size "${size}x${size}" xc:none \
    -fill '#F9C22E' -draw "roundrectangle 0,0,$edge,$edge,$radius,$radius" \
    \( public/assets/art/tenny.png -resize "${art_width}x${art_width}" \) \
    -gravity center -compose over -composite "public/icons/icon-${size}.png"
done
magick -size 512x512 xc:'#F9C22E' \
  \( public/assets/art/tenny.png -resize 320x320 \) \
  -gravity center -compose over -composite public/icons/icon-maskable-512.png
