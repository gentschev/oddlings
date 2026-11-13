import { describe, expect, it } from 'vitest';
import manifest from '../../public/assets/art/manifest.json';
import { CANVAS, LAYOUT, MOTION, PATH_TIMING, SCENERY, UI } from '../../src/game/constants';
import { campTeamLayout, centre, contains, encounterLayout, mapHomeRect, mapMarkerRect, mapStopLayout, mapBookRect, mapPoint, mapStopTarget, mapTransform, meadowTransform, oddbookLayout, overlaps, rectAt, standingRect, titleOfflineLayout } from '../../src/game/layout';
import { ODDLING_IDS } from '../../src/core';
import { PEBBLE_STOPS } from '../../src/core/story/pebblePath';
import { dotGeometry } from '../../src/ui/patternGeometry';
import { advanceWithoutIntermediateRenders } from '../../src/game/manualClock';
import { deliveryDuration, filledSlotCount, slotStates } from '../../src/ui/muddleSlots';

const canvas = { x: 0, y: 0, ...CANVAS };
it('fits the title offline indicator clear of both buttons with space for the longest label', () => {
  const layout = titleOfflineLayout(), l = LAYOUT.title;
  expect(contains(canvas, layout.bounds)).toBe(true);
  expect(contains(layout.bounds, layout.icon)).toBe(true); expect(contains(layout.bounds, layout.label)).toBe(true);
  expect(overlaps(layout.icon, layout.label)).toBe(false);
  for (const button of [rectAt(l.playX, l.playY, l.playW, l.playH), rectAt(l.grownX, l.grownY, l.grownW, UI.minTouch)])
    expect(overlaps(layout.bounds, button)).toBe(false);
  expect('Getting voices 900 / 900'.length * l.offline.font * 0.7).toBeLessThan(layout.label.width);
  expect(l.offline.font + 8).toBeLessThan(layout.label.height);
});
function noOverlap(boxes: Record<string, { x: number; y: number; width: number; height: number }>) {
  const entries = Object.entries(boxes);
  for (const [i, [name, box]] of entries.entries()) {
    expect(contains(canvas, box), name).toBe(true);
    for (const [other, second] of entries.slice(i + 1)) expect(overlaps(box, second), `${name} overlaps ${other}`).toBe(false);
  }
}
describe('encounter geometry shared with the scenes', () => {
  it('keeps every peer region inside the canvas and disjoint for every starter and wild pal', () => {
    for (const partner of ODDLING_IDS) for (const wild of ODDLING_IDS) for (const modelVisible of [true, false]) {
      const layout = encounterLayout(partner, wild, 10, modelVisible);
      noOverlap(layout.regions); noOverlap(layout.cardContents);
      expect(contains(canvas, layout.cloud)).toBe(true);
      expect(overlaps(layout.cloud, layout.regions.card)).toBe(false);
      expect(overlaps(layout.cloud, layout.regions.tray)).toBe(false);
      expect(overlaps(layout.cloud, layout.regions.wild)).toBe(false);
      expect(layout.cloud.width).toBeCloseTo(LAYOUT.encounter.creatureW * 0.45);
      expect(layout.cloud.y + layout.cloud.height).toBeLessThan(layout.regions.wild.y);
      if (layout.wildFeatures.face) expect(overlaps(layout.cloud, layout.wildFeatures.face)).toBe(false);
      for (const panel of layout.wildFeatures.panels) expect(overlaps(layout.cloud, panel)).toBe(false);
      expect(contains(layout.regions.card, layout.intro)).toBe(true);
      const hint = layout.regions.hint;
      expect(hint.height).toBeGreaterThanOrEqual(88);
      expect(overlaps(rectAt(centre(hint).x, centre(hint).y, hint.width * (1 + MOTION.hintPulse), hint.height * (1 + MOTION.hintPulse)), layout.regions.tray)).toBe(false);
      expect(layout.slots).toHaveLength(10);
      for (const [i, slot] of layout.slots.entries()) {
        expect(contains(canvas, slot)).toBe(true); expect(slot.width).toBe(44);
        expect(overlaps(slot, layout.regions.card)).toBe(false);
        for (const other of layout.slots.slice(i + 1)) expect(overlaps(slot, other)).toBe(false);
      }
      for (const content of Object.values(layout.cardContents)) expect(contains(layout.regions.card, content)).toBe(true);
      for (const [i, answer] of layout.answers.entries()) {
        expect(contains(layout.regions.tray, answer)).toBe(true);
        expect(answer.width).toBe(96); expect(answer.height).toBe(96);
        for (const other of layout.answers.slice(i + 1)) expect(overlaps(answer, other)).toBe(false);
      }
      const meta = manifest.characters[partner];
      expect(layout.regions.partner.y + meta.feetY * layout.regions.partner.width / meta.width).toBe(430);
    }
  });
  it('fits large picture models in the card, with readable dots and full double ten frames', () => {
    expect(UI.model.cell).toBeGreaterThanOrEqual(56);
    const doubleWidth = (UI.model.cell * 5 + UI.model.gap * 4) * 2 + UI.model.frameGap;
    expect(doubleWidth).toBeLessThanOrEqual(LAYOUT.encounter.modelW);
    expect(UI.model.cell * 2 + UI.model.gap).toBeLessThanOrEqual(LAYOUT.encounter.modelH);
    expect(UI.model.dotHeight + UI.model.dotPadding * 2 + UI.stroke).toBeLessThanOrEqual(LAYOUT.encounter.modelH);
    for (const scattered of [true, false]) for (let n = 1; n <= 5; n++) {
      const box = { x: 0, y: 0, width: UI.model.dotWidth, height: UI.model.dotHeight };
      for (const dot of dotGeometry(n, box, UI.model.dot, scattered)) {
        expect(dot.radius * 2).toBeGreaterThanOrEqual(44);
        expect(contains(box, rectAt(dot.x, dot.y, dot.radius * 2, dot.radius * 2))).toBe(true);
      }
    }
    const five = dotGeometry(5, { x: 0, y: 0, width: 100, height: 100 }, 10);
    expect(new Set(five.map(d => `${d.x},${d.y}`)).size).toBe(5);
    expect(five[0]).toMatchObject({ x: 50, y: 50 });
  });
  it('anchors scenery, story pals, reward pals and the map without cropping the arch', () => {
    const t = meadowTransform(); expect(t.y + SCENERY.groundSourceY * t.scale).toBe(430);
    const map = mapTransform(), m = manifest.maps.pebblePath;
    expect(map.x).toBe(0); expect(map.y).toBe(0);
    expect(m.width * map.scale).toBe(CANVAS.width); expect(m.height * map.scale).toBeGreaterThan(CANVAS.height);
    for (const stop of m.stops) {
      const p = mapPoint(stop.x, stop.y); expect(contains(canvas, mapStopTarget(p.x, p.y))).toBe(true);
    }
    const first = mapPoint(m.stops[0]!.x, m.stops[0]!.y);
    expect(contains(canvas, rectAt(first.x, first.y, (LAYOUT.map.stopRadius * 2 + UI.stroke) * LAYOUT.map.pulseScale, (LAYOUT.map.stopHeight + UI.stroke) * LAYOUT.map.pulseScale))).toBe(true);
    const sound = rectAt(LAYOUT.map.muteX, LAYOUT.map.muteY, LAYOUT.map.muteW, LAYOUT.map.muteW);
    const arch = mapPoint(m.gate.x, m.gate.y);
    expect(overlaps(sound, rectAt(arch.x, arch.y, 200, 180))).toBe(false);
    const l = LAYOUT.story;
    noOverlap({ moss: standingRect('moss', l.creatureX, l.feetY, l.creatureW),
      partner: standingRect('tenny', l.partnerX, l.feetY, l.partnerW),
      dialogue: rectAt(l.lineX, l.panelY, l.panelW, l.panelH) });
    for (const id of ['fivel', 'twoot', 'bix'] as const) {
      const r = LAYOUT.reward, pal = standingRect(id, r.creatureX, r.feetY, r.creatureW);
      expect(pal.y - 38).toBeGreaterThan(r.titleY + UI.titleFont);
      expect(centre(pal).y).toBeLessThan(r.feetY);
    }
  });
});
it('fits every skill tag clear of neighbouring stones, heading, controls and gate', () => {
  const l = LAYOUT.map, gate = mapPoint(manifest.maps.pebblePath.gate.x, manifest.maps.pebblePath.gate.y);
  const entries = PEBBLE_STOPS.flatMap((s, i) => s.type === 'skill' ? [{ index: i, tag: mapStopLayout(i).tag }] : []);
  const tags = entries.map(e => e.tag);
  noOverlap(Object.fromEntries(tags.map((r, i) => [`tag-${i}`, r])));
  expect(l.progressStroke * l.progressScaleY).toBeGreaterThanOrEqual(6);
  expect(PATH_TIMING.rings + PATH_TIMING.walkBudget).toBeLessThan(3000);
  for (const { index, tag } of entries) {
    for (let i = 0; i < PEBBLE_STOPS.length; i++) {
      expect(overlaps(tag, mapStopLayout(i).ring)).toBe(false);
      if (i !== index) expect(overlaps(tag, mapStopLayout(i).touch)).toBe(false);
    }
    expect(overlaps(tag, rectAt(gate.x, gate.y, UI.minTouch, UI.minTouch))).toBe(false);
    expect(overlaps(tag, rectAt(l.headingX, l.headingY, 400, 80))).toBe(false);
    expect(overlaps(tag, mapBookRect())).toBe(false);
    expect(overlaps(tag, mapHomeRect())).toBe(false);
    expect(overlaps(tag, rectAt(l.muteX, l.muteY, l.muteW, l.muteW))).toBe(false);
  }
  const home = mapHomeRect(); expect(home.width).toBeGreaterThanOrEqual(88); expect(home.height).toBeGreaterThanOrEqual(88);
  expect(contains(canvas, home)).toBe(true); expect(overlaps(home, mapBookRect())).toBe(false);
  for (const id of ODDLING_IDS) for (let i = 0; i <= PEBBLE_STOPS.length; i++) expect(contains(canvas, mapMarkerRect(id, i))).toBe(true);
});
it('puts the ground ellipse between both characters, clear of the dialogue even while pulsing', () => {
  const l = LAYOUT.story;
  const ring = rectAt(l.ringX, l.ringY, l.ringW + l.ringStroke, l.ringH + l.ringStroke);
  const pulse = rectAt(l.ringX, l.ringY, ring.width * l.ringPulseScale, ring.height * l.ringPulseScale);
  expect(l.ringW).toBeGreaterThanOrEqual(180); expect(l.ringY).toBeGreaterThanOrEqual(l.feetY);
  expect(l.ringX).toBeGreaterThan(l.creatureX); expect(l.ringX).toBeLessThan(l.partnerX);
  noOverlap({ pulse, dialogue: rectAt(l.lineX, l.panelY, l.panelW, l.panelH) });
  // The ellipse's empty corners can share the transparent corners of the art bounds.
  const touchesEllipse = (r: ReturnType<typeof standingRect>) => {
    const x = Math.max(r.x, Math.min(l.ringX, r.x + r.width));
    const y = Math.max(r.y, Math.min(l.ringY, r.y + r.height));
    return ((x - l.ringX) / (ring.width / 2)) ** 2 + ((y - l.ringY) / (ring.height / 2)) ** 2 <= 1;
  };
  expect(touchesEllipse(standingRect('moss', l.creatureX, l.feetY, l.creatureW))).toBe(false);
  for (const partner of ODDLING_IDS) expect(touchesEllipse(standingRect(partner, l.partnerX, l.feetY, l.partnerW))).toBe(false);
});
it('fills slots from the left, removes the last earned dots when work rises, and delivers under 700 ms', () => {
  for (const count of [6, 7, 8, 9, 10]) {
    expect(slotStates(count, count)).toEqual(Array(count).fill(false));
    expect(slotStates(count, count - 2)).toEqual([true, true, ...Array(count - 2).fill(false)]);
    expect(slotStates(count, count - 1)).toEqual([true, ...Array(count - 1).fill(false)]);
    expect(slotStates(count, 0)).toEqual(Array(count).fill(true));
    expect(filledSlotCount(count, -1)).toBe(count); expect(filledSlotCount(count, count + 1)).toBe(0);
    expect(deliveryDuration(count)).toBeLessThan(700);
  }
});
describe('Oddbook and camp geometry', () => {
  it('keeps six cards, their content, and header controls in separate canvas regions', () => {
    const l = LAYOUT.oddbook, cards = oddbookLayout();
    noOverlap({ ...Object.fromEntries(cards.map((r, i) => [`card-${i}`, r.card])),
      heading: rectAt(CANVAS.width / 2, l.headingY, 380, l.headingH),
      description: rectAt(CANVAS.width / 2, l.lineY, 600, l.lineH),
      back: rectAt(l.backX, l.backY, l.backW, UI.minTouch) });
    for (const [i, { card, ...contents }] of cards.entries()) {
      noOverlap(contents);
      for (const content of Object.values(contents)) expect(contains(card, content)).toBe(true);
      expect(contents.partnerButton.width).toBeGreaterThanOrEqual(88);
      expect(contents.partnerButton.height).toBeGreaterThanOrEqual(88);
      const pal = standingRect(ODDLING_IDS[i]!, card.x + l.portraitX, card.y + l.portraitFeet, l.portraitW);
      // Breathing and the card's short hop have clearance above and below the art.
      const motion = { ...pal, y: pal.y - l.hop - MOTION.bob - pal.height * MOTION.breath / 2,
        height: pal.height * (1 + MOTION.breath) + l.hop + MOTION.bob * 2 };
      expect(contains(card, motion)).toBe(true);
      expect(overlaps(motion, contents.name)).toBe(false);
      expect(overlaps(motion, contents.bar)).toBe(false);
      expect(overlaps(motion, contents.partnerButton)).toBe(false);
    }
  });
  it('fits the full camp team, pet targets, equal exit choices and book', () => {
    const l = LAYOUT.camp, pals = campTeamLayout(ODDLING_IDS);
    noOverlap(Object.fromEntries(pals.map((r, i) => [`pal-${i}`, r])));
    noOverlap({ ...Object.fromEntries(pals.map((r, i) => [`pet-${i}`, rectAt(centre(r).x, l.feetY - l.petHeight / 2, r.width, l.petHeight)])),
      stop: rectAt(l.stopX, l.buttonsY, l.buttonW, UI.minTouch),
      keepGoing: rectAt(l.goX, l.buttonsY, l.buttonW, UI.minTouch),
      oddbook: rectAt(l.bookX, l.buttonsY, UI.minTouch, UI.minTouch) });
    const book = mapBookRect(), lmap = LAYOUT.map;
    noOverlap({ book, mute: rectAt(lmap.muteX, lmap.muteY, lmap.muteW, lmap.muteW) });
    for (const stop of manifest.maps.pebblePath.stops) {
      const p = mapPoint(stop.x, stop.y);
      expect(overlaps(book, mapStopTarget(p.x, p.y))).toBe(false);
    }
  });
});
it('advances all simulation frames but renders only the last, including a partial final step', () => {
  const logic: number[] = [], render: number[] = [];
  const game = { headlessStep: (_time: number, delta: number) => logic.push(delta),
    step: (_time: number, delta: number) => { logic.push(delta); render.push(delta); } };
  expect(advanceWithoutIntermediateRenders(game, 10, 601)).toBeCloseTo(611);
  expect(logic.reduce((a, b) => a + b, 0)).toBeCloseTo(601);
  expect(render).toHaveLength(1); expect(logic.length).toBeGreaterThan(30);
  advanceWithoutIntermediateRenders(game, 611, 0); expect(render).toHaveLength(1);
  expect(() => advanceWithoutIntermediateRenders(game, 0, -1)).toThrow();
});
