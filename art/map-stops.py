#!/usr/bin/env python3
"""Measure the cream path stops and render a numbered visual check."""
from collections import deque
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
image = Image.open(root / 'public/assets/art/bg-pebble-path-map.jpg').convert('RGB')
pixels = image.load()
# Approximate seeds establish path order; flood fill finds each cream interior.
seeds = [(425,922), (645,874), (925,870), (1185,813), (1386,698), (1185,625), (536,538), (445,429), (637,359), (861,384), (1107,389)]
# The map contains eleven large outlined stops; the small ovals near the arch are paving stones.
def measure(seed):
    sx, sy = seed
    q = deque([seed]); seen = {seed}; points = []
    while q:
        x, y = q.popleft()
        r, g, b = pixels[x, y]
        if not (r > 210 and g > 190 and b > 155 and r >= g and g >= b and abs(x-sx) < 65 and abs(y-sy) < 60):
            continue
        points.append((x, y))
        for p in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            if p not in seen and 0 <= p[0] < image.width and 0 <= p[1] < image.height:
                seen.add(p); q.append(p)
    if not points:
        raise ValueError(f'No cream region at {seed}')
    xs, ys = zip(*points)
    return {'x': round((min(xs)+max(xs))/2), 'y': round((min(ys)+max(ys))/2), 'rx': round((max(xs)-min(xs))/2), 'ry': round((max(ys)-min(ys))/2)}

stops = [measure(seed) for seed in seeds]
check = image.copy(); draw = ImageDraw.Draw(check)
font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 26)
for i, s in enumerate(stops, 1):
    x,y,rx,ry = (s[k] for k in ('x','y','rx','ry'))
    draw.ellipse((x-rx,y-ry,x+rx,y+ry), outline='red', width=3)
    draw.text((x,y), str(i), font=font, anchor='mm', fill='red', stroke_width=1, stroke_fill='white')
check.save(root / 'art/map-stops-check.png')
print(json.dumps(stops, indent=2))
