import { describe, expect, it } from 'vitest';
import { AREAS, ODDLING_IDS } from '../../src/core';
import { CANVAS, LAYOUT, UI } from '../../src/game/constants';
import { centre, contains, encounterLayout, leaveLayout, mapBookRect, mapEntryRect, mapGateRect, mapHeaderLayout,
  mapHomeRect, mapStopLayout, overlaps, rectAt } from '../../src/game/layout';
import { STRINGS } from '../../src/game/strings';
const canvas = { x: 0, y: 0, ...CANVAS };

describe('back controls in logical pixels', () => {
  it.each(AREAS)('keeps the $name arrow, heading and banner clear of the gate, stones and controls', area => {
    const header = mapHeaderLayout(), l = LAYOUT.map;
    for (const r of Object.values(header)) expect(contains(canvas, r)).toBe(true);
    expect(header.back.width).toBeGreaterThanOrEqual(88); expect(header.back.height).toBeGreaterThanOrEqual(88);
    expect(overlaps(header.back, header.heading)).toBe(false); expect(overlaps(header.back, header.banner)).toBe(false);
    const other = [mapGateRect(area.number), mapHomeRect(area.number), mapBookRect(area.number),
      rectAt(l.muteX, l.muteY, l.muteW, l.muteW)];
    const entry = mapEntryRect(area.number); if (entry) other.push(entry);
    for (const [i, stop] of area.stops.entries()) {
      const stone = mapStopLayout(i, area.number); other.push(stone.touch, stone.ring);
      if (stop.type === 'skill') other.push(stone.tag, stone.cloud);
    }
    for (const [name, r] of Object.entries(header)) for (const target of other) expect(overlaps(r, target), name).toBe(false);
    expect(area.name.length * UI.subheadingFont * 0.7 + 8).toBeLessThan(header.heading.width);
    for (const line of [STRINGS.knowThis, STRINGS.knowThese]) expect(line.length * l.bannerFont * 0.7 + 8).toBeLessThan(header.banner.width);
  });
  it('keeps the encounter arrow clear of every pal, card, meter and cloud', () => {
    for (const helper of ODDLING_IDS) for (const wild of ODDLING_IDS) {
      const layout = encounterLayout(helper, wild, 10);
      const { back, ...rest } = layout.regions;
      expect(contains(canvas, back)).toBe(true); expect(back.width).toBeGreaterThanOrEqual(88);
      for (const r of [...Object.values(rest), layout.cloud]) expect(overlaps(back, r)).toBe(false);
    }
  });
  it('fits the leave check over the card with equal, separate touch choices and one prompt line', () => {
    const { panel, prompt, yes, no } = leaveLayout();
    expect(contains(canvas, panel)).toBe(true);
    for (const r of [prompt, yes, no]) expect(contains(panel, r)).toBe(true);
    expect(overlaps(prompt, yes)).toBe(false); expect(overlaps(prompt, no)).toBe(false); expect(overlaps(yes, no)).toBe(false);
    expect([yes.width, yes.height]).toEqual([no.width, no.height]);
    expect(yes.width).toBeGreaterThanOrEqual(88); expect(yes.height).toBeGreaterThanOrEqual(88);
    expect(centre(yes).y).toBe(centre(no).y);
    expect(STRINGS.leaveAsk.length * LAYOUT.leave.promptFont * 0.7 + 8).toBeLessThan(prompt.width);
  });
});
