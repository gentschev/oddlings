import type { Rect } from '../game/layout';

const DICE = [[0.5, 0.5], [0, 0], [1, 1], [1, 0], [0, 1]] as const;
const SCATTER = [[0, 0.18], [0.76, 0], [0.45, 0.65], [1, 0.85], [0.05, 1]] as const;
/** Radius is explicit so dots fill a panel and can be checked without a renderer. */
export function dotGeometry(count: number, box: Rect, radius: number, scattered = false) {
  const points = scattered ? SCATTER : DICE;
  return Array.from({ length: count }, (_, i) => {
    const point = count <= 5 ? points[scattered ? i : count % 2 === 0 ? i + 1 : i]!
      : [i % 2, Math.floor(i / 2) / (Math.ceil(count / 2) - 1)];
    return { x: box.x + radius + point[0]! * (box.width - radius * 2),
      y: box.y + radius + point[1]! * (box.height - radius * 2), radius };
  });
}
