import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { TintModes: { FILL: 1 } } }));
import { Oddling } from '../../src/ui/Oddling';
import { addition, frame, ODDLING_IDS, subtraction } from '../../src/core';
import manifest from '../../public/assets/art/manifest.json';
import { MOTION } from '../../src/game/constants';
import { oddlingPattern } from '../../src/ui/oddlingPattern';
import { FRIEND_PATTERNS } from '../../src/core/story/characters';

function fixture(id: typeof ODDLING_IDS[number], width = 240) {
  type Circle = { x: number; y: number; radius: number; stroke?: number };
  const graphics: { fills: Circle[]; outlines: Circle[]; tiles: number[][] }[] = [];
  function graphic() {
    const fills: Circle[] = [], outlines: Circle[] = [], tiles: number[][] = [];
    let stroke = 0;
    const g = { fills, outlines, tiles,
      clear() { fills.length = outlines.length = tiles.length = 0; return g; },
      setPosition() { return g; }, setVisible() { return g; }, fillStyle() { return g; }, lineStyle(value: number) { stroke = value; return g; },
      fillEllipse() { return g; }, lineBetween() { return g; },
      fillCircle(x: number, y: number, radius: number) { fills.push({ x, y, radius }); return g; },
      strokeCircle(x: number, y: number, radius: number) { outlines.push({ x, y, radius, stroke }); return g; },
      strokeRoundedRect(x: number, y: number, w: number, h: number) { tiles.push([x, y, w, h, stroke]); return g; } };
    graphics.push(g); return g;
  }
  const container = () => { const c = { add() { return c; }, setScale() { return c; } }; return c; };
  const image = () => { const i = { setTint() { return i; }, setTintMode() { return i; } }; return i; };
  const scene = { add: { container, image, graphics: graphic } } as unknown as Phaser.Scene;
  return { pal: new Oddling(scene, id, 170, 300, width), ink: graphics[0]! };
}
describe('Oddling rendering', () => {
  it.each(ODDLING_IDS)('%s shows its filled resting pattern on every plain question', id => {
    const { pal, ink } = fixture(id), rest = structuredClone(ink.fills);
    expect(rest).toHaveLength(FRIEND_PATTERNS[id]);
    pal.showFact(frame(2), true); expect(pal.patternMode).toBe('fact'); expect(ink.fills).toHaveLength(2);
    pal.showFact(subtraction(5, 5), false); expect(pal.patternMode).toBe('resting'); expect(ink.fills).toEqual(rest);
    pal.showFact(addition(10, 10), true); expect(pal.patternMode).toBe('resting'); expect(ink.fills).toEqual(rest);
  });
  it.each(ODDLING_IDS)('%s draws outlines while muddled and restores the resting fills afterwards', id => {
    const { pal, ink } = fixture(id), rest = structuredClone(ink.fills), tiles = structuredClone(ink.tiles);
    pal.setMuddled(true); expect(pal.patternMode).toBe('muddled'); expect(ink.fills).toEqual([]);
    if (id === 'tenny') expect(ink.tiles.map(([x, y, w, h]) => [x! + w! / 2, y! + h! / 2]))
      .toEqual(tiles.map(([x, y, w, h]) => [x! + w! / 2, y! + h! / 2]));
    else expect(ink.outlines).toHaveLength(FRIEND_PATTERNS[id]);
    pal.showFact(frame(2), true); expect(pal.patternMode).toBe('muddled'); expect(ink.fills).toEqual([]);
    pal.restorePattern(); expect(pal.patternMode).toBe('resting'); expect(ink.fills).toEqual(rest);
  });
  it.each(ODDLING_IDS)('%s renders thick inset strokes at encounter, reward and map sizes', id => {
    for (const width of [240, 150, 58]) {
      const { pal, ink } = fixture(id, width), scale = width / manifest.characters[id].width;
      pal.setMuddled(true);
      const expected = width === 58 ? 1 : 3;
      const native = oddlingPattern(id, undefined, false, true);
      ink.outlines.forEach((dot, i) => {
        expect(dot.stroke! * scale * (1 - MOTION.breath)).toBeCloseTo(expected);
        expect(dot.radius + dot.stroke! / 2).toBeCloseTo(native.circles[i]!.radius);
        expect(dot.x).toBe(native.circles[i]!.x); expect(dot.y).toBe(native.circles[i]!.y);
      });
      ink.tiles.forEach(([x, y, w, h, stroke], i) => {
        expect(stroke! * scale * (1 - MOTION.breath)).toBeCloseTo(expected);
        expect(x! - stroke! / 2).toBeCloseTo(native.tiles[i]!.x);
        expect(y! - stroke! / 2).toBeCloseTo(native.tiles[i]!.y);
        expect(w! + stroke!).toBeCloseTo(native.tiles[i]!.width);
        expect(h! + stroke!).toBeCloseTo(native.tiles[i]!.height);
      });
    }
  });
  it('keeps locked silhouettes empty and preserves the doubles demonstration', () => {
    const domi = fixture('domi'); domi.pal.showCount(4); expect(domi.ink.fills).toHaveLength(4);
    domi.pal.setSilhouette(); expect(domi.pal.patternMode).toBe('hidden'); expect(domi.ink.fills).toEqual([]);
    domi.pal.setMuddled(true); expect(domi.pal.patternMode).toBe('hidden'); expect(domi.ink.outlines).toEqual([]);
  });
});
