import manifest from '../../public/assets/art/manifest.json';
import { addition, frame, ODDLING_PATTERNS, type OddlingId, type Fact } from '../core';
import { FRIEND_PATTERNS, type FriendId } from '../core/story/characters';
import { INK, MOTION, PATTERN } from '../game/constants';
import type { CharacterId, Rect } from '../game/layout';
import { dominoGeometry, dotGeometry, pairGeometry, panelBox, type ColouredDot } from './patternGeometry';

export type PatternMode = 'resting' | 'fact' | 'muddled';
export interface PatternCircle extends ColouredDot { fill: boolean; outline: number; fillRadius?: number }
export interface PatternTile extends Rect { stroke: number; corner: number }
export interface PatternLine { x1: number; y1: number; x2: number; y2: number; width: number; colour: number }
export interface PatternDrawing { mode: PatternMode; circles: PatternCircle[]; tiles: PatternTile[]; lines: PatternLine[] }
function restingFact(id: CharacterId): Fact {
  const n = FRIEND_PATTERNS[id as FriendId] ?? 0;
  return id === 'domi' ? addition(n / 2, n / 2) : frame(n);
}
function fits(id: CharacterId, fact: Fact): boolean {
  const pattern = ODDLING_PATTERNS[id as OddlingId];
  if (pattern === 'domino') return dominoGeometry(fact, manifest.characters.domi.patternPanels[0]!).fits;
  if (pattern === 'ten-frame' || pattern === 'segments') return Math.max(fact.a, fact.b, fact.answer) <= PATTERN.capacity;
  const count = fact.operation === 'sub' ? fact.a : fact.operation === 'miss' ? fact.b : fact.answer;
  return count <= (pattern === 'five-dots' ? 5 : PATTERN.capacity);
}
/** One layout supplies modeled facts, filled resting marks and their empty counterparts. */
export function oddlingPattern(id: CharacterId, fact?: Fact, reveal = false, muddled = false): PatternDrawing {
  const mode: PatternMode = muddled ? 'muddled' : fact && reveal && fits(id, fact) ? 'fact' : 'resting';
  const shown = mode === 'fact' ? fact! : restingFact(id), meta = manifest.characters[id];
  const pattern = ODDLING_PATTERNS[id as OddlingId];
  const drawing: PatternDrawing = { mode, circles: [], tiles: [], lines: [] };
  const line = (x1: number, y1: number, x2: number, y2: number, width: number = PATTERN.cross, colour: number = INK.coral) => {
    drawing.lines.push({ x1, y1, x2, y2, width, colour });
  };
  if (pattern === 'segments') {
    manifest.characters.inch.segments.forEach((point, i) => {
      drawing.circles.push({ ...point, radius: MOTION.segmentRadius, colour: i < shown.a ? INK.coral : INK.cream,
        fill: mode !== 'muddled' && i < shown.answer, fillRadius: MOTION.segmentRadius * PATTERN.segmentFill,
        outline: mode === 'muddled' ? PATTERN.outline : PATTERN.segmentOutline });
      if (mode !== 'muddled' && shown.operation === 'sub' && i >= shown.answer && i < shown.a)
        line(point.x - PATTERN.segmentCross, point.y - PATTERN.segmentCross, point.x + PATTERN.segmentCross, point.y + PATTERN.segmentCross, PATTERN.cross, INK.navy);
    });
    return drawing;
  }
  const panel = meta.patternPanels[0]; if (!panel) return drawing;
  const box = panelBox(panel);
  const count = shown.operation === 'sub' ? shown.a : shown.operation === 'miss' ? shown.b : shown.answer;
  if (pattern === 'ten-frame') {
    const cell = Math.min(box.width / PATTERN.tileWidth, box.height / PATTERN.tileHeight), gap = cell * PATTERN.tileGap;
    const x = panel.x + (panel.w - (cell * 5 + gap * 4)) / 2, y = panel.y + (panel.h - cell * 2 - gap) / 2;
    const first = shown.operation === 'frame' || shown.operation === 'dots' ? count : shown.a;
    for (let i = 0; i < PATTERN.capacity; i++) {
      const xx = x + i % 5 * (cell + gap), yy = y + Math.floor(i / 5) * (cell + gap);
      drawing.tiles.push({ x: xx, y: yy, width: cell, height: cell,
        stroke: Math.max(mode === 'muddled' ? PATTERN.outline : 1, cell * PATTERN.tileStroke), corner: cell * PATTERN.tileCorner });
      if (mode !== 'muddled' && i < count) {
        drawing.circles.push({ x: xx + cell / 2, y: yy + cell / 2, radius: cell * PATTERN.tileDot,
          colour: i < first ? INK.coral : INK.mint, fill: true, outline: 0 });
        if (shown.operation === 'sub' && i >= shown.answer) {
          const inset = cell * PATTERN.tileCrossInset, stroke = Math.max(2, cell * PATTERN.tileCrossStroke);
          line(xx + inset, yy + inset, xx + cell - inset, yy + cell - inset, stroke, INK.navy);
          line(xx + cell - inset, yy + inset, xx + inset, yy + cell - inset, stroke, INK.navy);
        }
      }
    }
    return drawing;
  }
  if (pattern === 'domino') {
    const layout = dominoGeometry(shown, panel), d = layout.divider;
    line(d.x1, d.y1, d.x2, d.y2, PATTERN.dividerStroke, INK.navy);
    drawing.circles = layout.dots.map(dot => ({ ...dot, fill: mode !== 'muddled', outline: mode === 'muddled' ? PATTERN.outline : 0 }));
    if (mode !== 'muddled' && shown.operation === 'sub') line(box.x + box.width / 2, box.y, box.x + box.width, box.y + box.height, PATTERN.cross, INK.navy);
    return drawing;
  }
  const mark = (dot: ColouredDot, index: number) => {
    drawing.circles.push({ ...dot, fill: mode !== 'muddled', outline: mode === 'muddled' ? PATTERN.outline : 0 });
    if (mode !== 'muddled' && shown.operation === 'sub' && index >= shown.answer) {
      const width = Math.max(PATTERN.minDotCross, dot.radius * PATTERN.dotCross);
      line(dot.x - dot.radius, dot.y - dot.radius, dot.x + dot.radius, dot.y + dot.radius, width);
      line(dot.x + dot.radius, dot.y - dot.radius, dot.x - dot.radius, dot.y + dot.radius, width);
    }
  };
  const colour = (index: number) => shown.operation === 'add' || shown.operation === 'miss' ? index < shown.a ? INK.coral : INK.mint : INK.navy;
  if (pattern === 'dice') {
    const left = Math.ceil(count / 2);
    meta.patternPanels.forEach((p, side) => dotGeometry(side === 0 ? left : count - left, panelBox(p), p.h * PATTERN.pipRadius,
      false, p.h * PATTERN.panelMargin).forEach((dot, i) => {
        const index = i + (side ? left : 0); mark({ ...dot, colour: colour(index) }, index);
      }));
  } else {
    const dots = pattern === 'pairs' ? pairGeometry(count, box, panel.h * PATTERN.pipRadius, panel.h * PATTERN.panelMargin)
      : dotGeometry(count, box, panel.h * PATTERN.pipRadius, false, panel.h * PATTERN.panelMargin);
    dots.forEach((dot, i) => mark({ ...dot, colour: colour(i) }, i));
  }
  return drawing;
}
