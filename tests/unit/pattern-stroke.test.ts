import { describe, expect, it } from 'vitest';
import manifest from '../../public/assets/art/manifest.json';
import { ODDLING_IDS } from '../../src/core';
import { LAYOUT, MOTION, PATTERN } from '../../src/game/constants';
import { muddleStroke } from '../../src/ui/patternStroke';
import { oddlingPattern } from '../../src/ui/oddlingPattern';

describe('muddled outline widths', () => {
  it.each(ODDLING_IDS)('%s stays at least three screen pixels in encounters and rewards, including breathing', id => {
    for (const width of [LAYOUT.encounter.creatureW, LAYOUT.reward.minPalW, LAYOUT.reward.creatureW]) {
      const scale = width / manifest.characters[id].width;
      expect(muddleStroke(scale, width) * scale * (1 - MOTION.breath)).toBeCloseTo(3);
    }
  });
  it.each(ODDLING_IDS)('%s uses one screen pixel on map pals and keeps inset outlines within the marks', id => {
    for (const width of [LAYOUT.map.friendW, LAYOUT.map.markerW]) {
      const scale = width / manifest.characters[id].width, stroke = muddleStroke(scale, width);
      expect(stroke * scale * (1 - MOTION.breath)).toBeCloseTo(PATTERN.outlineMap);
      const pattern = oddlingPattern(id, undefined, false, true);
      for (const dot of pattern.circles) {
        expect(dot.radius - stroke / 2).toBeGreaterThan(0);
        // The outer edge of the inset ring stays at the resting radius.
        expect(dot.radius - stroke / 2 + stroke / 2).toBeCloseTo(dot.radius);
      }
      for (const tile of pattern.tiles) {
        expect(tile.width - stroke).toBeGreaterThan(0);
        expect(tile.height - stroke).toBeGreaterThan(0);
      }
    }
  });
});
