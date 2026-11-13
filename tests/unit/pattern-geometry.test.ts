import { describe, expect, it } from 'vitest';
import manifest from '../../public/assets/art/manifest.json';
import { addition, dots, frame, getFact, getSet, ODDLING_IDS, subtraction } from '../../src/core';
import { FRIEND_PATTERNS } from '../../src/core/story/characters';
import { INK, LAYOUT, MOTION, PATTERN, UI } from '../../src/game/constants';
import { contains, encounterLayout, overlaps, rectAt, type Rect } from '../../src/game/layout';
import { dominoGeometry, dotCardGeometry, dotGeometry, panelBox, pairGeometry, squareIn, type Dot } from '../../src/ui/patternGeometry';
import { oddlingPattern } from '../../src/ui/oddlingPattern';
import { STOP_TAGS, STRINGS } from '../../src/game/strings';
import { PEBBLE_STOPS } from '../../src/core/story/pebblePath';
import { mapStopLayout, mapStyle } from '../../src/game/layout';

const expectedDice = [[], [[1, 1]], [[0, 0], [2, 2]], [[0, 0], [1, 1], [2, 2]],
  [[0, 0], [0, 2], [2, 0], [2, 2]], [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]]];
function checkDots(points: readonly Dot[], box: Rect, margin: number) {
  for (const [i, point] of points.entries()) {
    expect(point.radius).toBeGreaterThan(0);
    expect(point.x - point.radius).toBeGreaterThanOrEqual(box.x + margin - 1e-7);
    expect(point.y - point.radius).toBeGreaterThanOrEqual(box.y + margin - 1e-7);
    expect(point.x + point.radius).toBeLessThanOrEqual(box.x + box.width - margin + 1e-7);
    expect(point.y + point.radius).toBeLessThanOrEqual(box.y + box.height - margin + 1e-7);
    for (const other of points.slice(i + 1)) expect(Math.hypot(point.x - other.x, point.y - other.y)).toBeGreaterThan(point.radius + other.radius);
  }
}
describe('dice and scattered cards', () => {
  it.each([1, 2, 3, 4, 5, 6])('draws the standard %i face on a centred square and the correct symmetries', count => {
    const { card, dots, margin } = dotCardGeometry(count);
    expect(card.width).toBe(UI.model.dieSide);
    expect(card.width).toBe(card.height); expect(card.x + card.width / 2).toBe(0); expect(card.y + card.height / 2).toBe(0);
    expect(dots).toHaveLength(count); checkDots(dots, card, margin);
    const radius = dots[0]!.radius, start = card.x + radius + margin, step = (card.width - 2 * (radius + margin)) / 2;
    const grid = dots.map(dot => [Math.round((dot.x - start) / step), Math.round((dot.y - start) / step)]).sort();
    expect(grid).toEqual([...expectedDice[count]!].sort());
    for (const dot of dots) {
      expect(dots.some(other => Math.abs(other.x + dot.x) < 1e-7 && Math.abs(other.y + dot.y) < 1e-7)).toBe(true);
      if ([1, 4, 5, 6].includes(count)) {
        expect(dots.some(other => Math.abs(other.x + dot.x) < 1e-7 && Math.abs(other.y - dot.y) < 1e-7)).toBe(true);
        expect(dots.some(other => Math.abs(other.y + dot.y) < 1e-7 && Math.abs(other.x - dot.x) < 1e-7)).toBe(true);
      }
    }
  });
  it('keeps all curriculum pictures readable, separated and inside their card margins', () => {
    for (const id of getSet('see-dots').facts) {
      const fact = getFact(id), { card, dots, margin } = dotCardGeometry(fact.a, fact.layout === 'scattered');
      expect(dots).toHaveLength(fact.a); checkDots(dots, card, margin);
      expect(dots.every(dot => dot.radius * 2 >= 44)).toBe(true);
      expect(card.height).toBeLessThanOrEqual(LAYOUT.encounter.modelH);
      expect(card.width > card.height).toBe(fact.layout === 'scattered');
    }
    const scatter = dotCardGeometry(5, true).dots;
    expect(new Set(scatter.map(dot => dot.x)).size).toBeGreaterThan(3);
    expect(new Set(scatter.map(dot => dot.y)).size).toBeGreaterThan(3);
  });
  it('centres die points rather than stretching them across a wide box', () => {
    const wide = { x: 20, y: 30, width: 260, height: 108 }, square = squareIn(wide);
    expect(dotGeometry(5, wide, 18)).toEqual(dotGeometry(5, square, 18));
    expect(dotGeometry(0, wide, 22)).toEqual([]);
  });
});
describe('body pips', () => {
  it('gives Domi readable standard pips inside each half with count colours kept navy', () => {
    const panel = manifest.characters.domi.patternPanels[0]!;
    for (let count = 0; count <= 12; count++) {
      for (const fact of [frame(count), dots(count, 'dice')]) {
        const layout = dominoGeometry(fact, panel);
        expect(layout.parts).toEqual([Math.ceil(count / 2), Math.floor(count / 2)]);
        expect(layout.dots.every(dot => dot.colour === INK.navy)).toBe(true);
        for (let side = 0, start = 0; side < 2; start += layout.parts[side]!, side++)
          checkDots(layout.dots.slice(start, start + layout.parts[side]!), layout.halves[side]!, panelBox(panel).height * PATTERN.panelMargin);
      }
    }
    const add = dominoGeometry(addition(3, 4), panel);
    expect(add.dots.slice(0, 3).every(dot => dot.colour === INK.coral)).toBe(true);
    expect(add.dots.slice(3).every(dot => dot.colour === INK.navy)).toBe(true);
    expect(add.dots.every(dot => dot.radius >= panel.h * 0.12)).toBe(true);
    expect(dominoGeometry(addition(7, 7), panel).fits).toBe(false);
  });
  it('keeps pairs and the other dice patterns readable and inside their panels', () => {
    for (const id of ['domi', 'fivel', 'twoot', 'bix'] as const) {
      const drawing = oddlingPattern(id), panels = manifest.characters[id].patternPanels;
      expect(drawing.circles).toHaveLength(FRIEND_PATTERNS[id]);
      for (const circle of drawing.circles) {
        expect(panels.some(p => contains({ x: p.x, y: p.y, width: p.w, height: p.h }, rectAt(circle.x, circle.y, circle.radius * 2, circle.radius * 2)))).toBe(true);
        expect(circle.radius).toBeGreaterThanOrEqual(Math.min(...panels.map(p => p.h)) * 0.12);
      }
      for (const [i, circle] of drawing.circles.entries()) for (const other of drawing.circles.slice(i + 1))
        expect(Math.hypot(circle.x - other.x, circle.y - other.y)).toBeGreaterThan(circle.radius + other.radius);
    }
    const two = oddlingPattern('twoot').circles;
    expect(two[0]!.y).toBe(two[1]!.y);
    const box = panelBox(manifest.characters.twoot.patternPanels[0]!);
    for (let n = 1; n <= PATTERN.capacity; n++) checkDots(pairGeometry(n, box, 32, 6), box, 6);
  });
  it('shows resting marks for plain or unsupported facts and a fact only while its model fits', () => {
    for (const id of ODDLING_IDS) {
      expect(oddlingPattern(id, subtraction(5, 5), false)).toEqual(oddlingPattern(id));
      expect(oddlingPattern(id, addition(10, 10), true)).toEqual(oddlingPattern(id));
      expect(oddlingPattern(id, frame(2), true).mode).toBe('fact');
    }
    expect(oddlingPattern('twoot', subtraction(5, 5), false).circles).toHaveLength(2);
  });
  it('puts empty muddled marks at the resting positions, then fills those same positions', () => {
    for (const id of ODDLING_IDS) {
      const rest = oddlingPattern(id), muddled = oddlingPattern(id, addition(1, 2), true, true);
      expect(muddled.mode).toBe('muddled'); expect(muddled.circles.every(dot => !dot.fill)).toBe(true);
      expect(muddled.circles.every(dot => dot.outline > 0)).toBe(true);
      if (id === 'tenny') {
        expect(muddled.circles).toEqual([]);
        expect(muddled.tiles.map(({ x, y, width, height }) => ({ x, y, width, height })))
          .toEqual(rest.tiles.map(({ x, y, width, height }) => ({ x, y, width, height })));
        expect(rest.circles).toHaveLength(10); expect(muddled.tiles).toHaveLength(10);
      } else expect(muddled.circles.map(({ x, y, radius }) => ({ x, y, radius })))
        .toEqual(rest.circles.map(({ x, y, radius }) => ({ x, y, radius })));
    }
  });
});
it('fits the two within-5 labels and keeps all the other tag widths', () => {
  expect(STRINGS.quick).toBe('That was quick!');
  for (const [i, stop] of PEBBLE_STOPS.entries()) if (stop.type === 'skill') {
    const layout = mapStopLayout(i), within = ['add-within5', 'sub-within5'].includes(stop.set);
    expect(layout.tag.width).toBe(within ? LAYOUT.map.withinTagW : mapStyle().tagW);
    if (within) {
      expect(STOP_TAGS[stop.set]).toBe(stop.set.startsWith('add') ? '+ within 5' : '− within 5');
      expect(STOP_TAGS[stop.set]!.length * LAYOUT.map.tagFont * 0.7 + 8).toBeLessThan(layout.tag.width);
    }
  }
});
it('keeps every cream encounter region clear of the cloud, including its wobble', () => {
  const angle = MOTION.cloudWobble * Math.PI / 180;
  for (const id of ODDLING_IDS) for (let meter = 6; meter <= 10; meter++) {
    const layout = encounterLayout('domi', id, meter), cloud = layout.cloud;
    const width = cloud.width * Math.cos(angle) + cloud.height * Math.sin(angle), height = cloud.height * Math.cos(angle) + cloud.width * Math.sin(angle);
    const motion = rectAt(cloud.x + cloud.width / 2, cloud.y + cloud.height / 2, width, height);
    for (const region of [layout.regions.card, layout.regions.tray, layout.regions.speaker, layout.intro,
      ...layout.slots, ...Object.values(layout.cardContents)]) expect(overlaps(motion, region)).toBe(false);
  }
});
