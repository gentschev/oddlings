import type { Fact } from '../core';
import type { Rect } from '../game/layout';
import { INK, MOTION, PATTERN, UI } from '../game/constants';

export interface Dot { x: number; y: number; radius: number }
export interface ColouredDot extends Dot { colour: number }
type Point = readonly [number, number];
// Coordinates are the columns and rows of a standard die's three-by-three grid.
const DICE: readonly (readonly Point[])[] = [[], [[1, 1]], [[0, 0], [2, 2]], [[1, 1], [0, 0], [2, 2]],
  [[0, 0], [2, 2], [2, 0], [0, 2]], [[1, 1], [0, 0], [2, 2], [2, 0], [0, 2]],
  [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]]];
const SCATTER: readonly Point[] = [[0, 0], [0.68, 0.1], [0.4, 0.68], [1, 0.88], [0.03, 1]];
export function squareIn(box: Rect): Rect {
  const side = Math.min(box.width, box.height);
  return { x: box.x + (box.width - side) / 2, y: box.y + (box.height - side) / 2, width: side, height: side };
}
function place(points: readonly Point[], box: Rect, requested: number, margin: number): Dot[] {
  if (!points.length) return [];
  const limit = Math.max(0, Math.min(requested, Math.min(box.width, box.height) / 2 - margin));
  const position = (point: Point, radius: number): Dot => ({
    x: box.x + margin + radius + point[0] * (box.width - 2 * (margin + radius)),
    y: box.y + margin + radius + point[1] * (box.height - 2 * (margin + radius)), radius });
  const fits = (radius: number) => {
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      const a = position(points[i]!, radius), b = position(points[j]!, radius);
      if (Math.hypot(a.x - b.x, a.y - b.y) < radius * 2 + PATTERN.gap) return false;
    }
    return true;
  };
  let radius = limit;
  if (!fits(radius)) {
    let low = 0, high = limit;
    for (let i = 0; i < PATTERN.fitSteps; i++) {
      const middle = (low + high) / 2;
      if (fits(middle)) low = middle; else high = middle;
    }
    radius = low;
  }
  return points.map(point => position(point, radius));
}
/** Dice always use a centred square; scattered counts keep the box's full width. */
export function dotGeometry(count: number, box: Rect, radius: number, scattered = false, margin: number = PATTERN.margin): Dot[] {
  if (count <= 0) return [];
  const rows = Math.ceil(count / 2);
  const points: readonly Point[] = scattered && count <= SCATTER.length ? SCATTER.slice(0, count)
    : count <= PATTERN.dieCapacity ? DICE[count]!.map(([x, y]) => [x / 2, y / 2] as const)
    : Array.from({ length: count }, (_, i) => [i % 2, Math.floor(i / 2) / (rows - 1)] as const);
  return place(points, scattered ? box : squareIn(box), radius, margin);
}
export function dotCardGeometry(count: number, scattered = false) {
  const p = UI.model, width = scattered ? p.dotWidth + p.dotPadding * 2 : p.dieSide;
  const height = scattered ? p.dotHeight + p.dotPadding * 2 : p.dieSide;
  const card = { x: -width / 2, y: -height / 2, width, height }, margin = p.dotPadding + UI.stroke / 2;
  return { card, margin, dots: dotGeometry(count, card, p.dot, scattered, margin) };
}
export function panelBox(panel: { x: number; y: number; w: number; h: number }): Rect {
  return { x: panel.x + panel.w * MOTION.panelInset, y: panel.y + panel.h * MOTION.panelInset,
    width: panel.w * (1 - 2 * MOTION.panelInset), height: panel.h * (1 - 2 * MOTION.panelInset) };
}
/** Domino counts have two navy halves. Addition keeps the two parts in distinct colours. */
export function dominoGeometry(fact: Fact, panel: { x: number; y: number; w: number; h: number }) {
  const box = panelBox(panel), width = (box.width - PATTERN.dividerGap) / 2;
  const halves = [{ x: box.x, y: box.y, width, height: box.height },
    { x: box.x + width + PATTERN.dividerGap, y: box.y, width, height: box.height }];
  const count = fact.operation === 'dots' || fact.operation === 'frame';
  const a = count ? Math.ceil(fact.a / 2) : fact.operation === 'sub' ? fact.answer : fact.a;
  const b = count ? Math.floor(fact.a / 2) : fact.operation === 'miss' ? fact.answer : fact.b;
  const parts = [a, b], colours = [count ? INK.navy : INK.coral, INK.navy];
  return { halves, parts, fits: Math.max(a, b) <= PATTERN.dieCapacity,
    dots: halves.flatMap((half, side) => dotGeometry(parts[side]!, half, panel.h * PATTERN.pipRadius, false,
      box.height * PATTERN.panelMargin).map(dot => ({ ...dot, colour: colours[side]! }))),
    divider: { x1: panel.x + panel.w / 2, y1: box.y, x2: panel.x + panel.w / 2, y2: box.y + box.height } };
}
/** Twoot keeps side-by-side pairs; extra rows fit within the same inset panel. */
export function pairGeometry(count: number, box: Rect, requested: number, margin: number): Dot[] {
  if (count <= 0) return [];
  const rows = Math.ceil(count / 2), centres = Array.from({ length: count }, (_, i) => ({
    x: box.x + box.width * (count === 1 ? 0.5 : i % 2 ? PATTERN.pairRight : PATTERN.pairLeft),
    y: box.y + box.height * (Math.floor(i / 2) + 0.5) / rows }));
  let radius = requested;
  for (const [i, point] of centres.entries()) {
    radius = Math.min(radius, point.x - box.x - margin, box.x + box.width - point.x - margin,
      point.y - box.y - margin, box.y + box.height - point.y - margin);
    for (const other of centres.slice(i + 1)) radius = Math.min(radius, (Math.hypot(point.x - other.x, point.y - other.y) - PATTERN.gap) / 2);
  }
  return centres.map(point => ({ ...point, radius: Math.max(0, radius) }));
}
