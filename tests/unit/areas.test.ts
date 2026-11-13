import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '../../public/assets/art/manifest.json';
import { AREAS, allStops, areaGateOpen, canVisitArea, createSave, currentStop, earlierAreaNeedsHelp, FACT_SETS, getArea,
  getSet, importSave, exportSave, ODDLING_IDS, ODDLING_SETS, pathStops, seeStory, storyListener, syncPath, visitArea, walkGate } from '../../src/core';
import { contains, overlaps, centre, mapArt, mapBookRect, mapEntryRect, mapGateRect, mapHomeRect, mapMarkerRect, mapStopLayout, rectAt,
  storyLayout, groundTransform, characterRegions, type Rect } from '../../src/game/layout';
import { CANVAS, INK, LAYOUT, MOTION, SCENERY, STORY_EFFECTS, UI } from '../../src/game/constants';
import { STOP_TAGS } from '../../src/game/strings';

const canvas = { x: 0, y: 0, ...CANVAS };
function pass(save = createSave(), area = 1) {
  for (const stop of getArea(area).stops) if (stop.type === 'skill') {
    for (const id of getSet(stop.set).facts) Object.assign(save.facts[id]!, { stage: 'review', provisional: true });
  }
  return save;
}
function disjoint(boxes: Record<string, { x: number; y: number; width: number; height: number }>) {
  for (const [i, [name, box]] of Object.entries(boxes).entries()) {
    expect(contains(canvas, box), name).toBe(true);
    for (const [other, rect] of Object.entries(boxes).slice(i + 1)) expect(overlaps(box, rect), `${name} / ${other}`).toBe(false);
  }
}
describe('area registry', () => {
  it('matches each area to its curriculum, art stones, stories and unique ids', () => {
    const ids: string[] = [], beats: string[] = [];
    for (const [index, area] of AREAS.entries()) {
      expect(area.number).toBe(index + 1);
      expect(area.stops.filter(s => s.type === 'skill').map(s => s.set)).toEqual(FACT_SETS.filter(s => s.area === area.number).map(s => s.id));
      for (const pal of ODDLING_IDS) expect(ODDLING_SETS[pal].filter(id => getSet(id).area === area.number))
        .toEqual(area.stops.filter(s => s.type === 'skill' && s.pal === pal).map(s => s.type === 'skill' ? s.set : ''));
      expect(manifest.maps[area.key].stops).toHaveLength(area.stops.length);
      expect(area.mapBackground in manifest.backgrounds).toBe(true); expect(area.encounterBackground in manifest.backgrounds).toBe(true);
      ids.push(...area.stops.map(s => s.id), area.gateId); beats.push(area.gateBeat, ...Object.keys(area.stories));
      for (const stop of area.stops) if (stop.type === 'story') expect(stop.beat in area.stories).toBe(true);
      for (const story of Object.values(area.stories)) {
        expect(story.background in manifest.backgrounds).toBe(true);
        for (const line of story.lines) expect(line.split(/\s+/).length).toBeLessThanOrEqual(8);
      }
    }
    expect(new Set(AREAS.map(a => a.number)).size).toBe(AREAS.length);
    expect(new Set(AREAS.map(a => a.key)).size).toBe(AREAS.length);
    expect(new Set(ids).size).toBe(ids.length); expect(new Set(beats).size).toBe(beats.length);
    expect(ODDLING_SETS.twoot).toContain('add-near-doubles-small'); expect(ODDLING_SETS.domi).not.toContain('add-near-doubles-small');
  });
  it('records learned future skills only when their area is reached', () => {
    const save = pass(); pass(save, 2);
    syncPath(save, 0);
    expect(save.team.friends).not.toContain('domi');
    expect(canVisitArea(save, 2)).toBe(false);
    walkGate(save, 1); visitArea(save, 2);
    const change = syncPath(save, 0, 2);
    expect(change.completed).toContain('tf-add-doubles-small'); expect(change.joined).toContain('domi');
    expect(currentStop(save, 2)?.id).toBe('tf-falls'); expect(pathStops(save, 0, 2)[1]!.state).toBe('locked');
    for (const stop of getArea(2).stops) if (stop.type === 'story') seeStory(save, stop, 0);
    expect(areaGateOpen(save, 2)).toBe(true);
  });
  it('requires walked gates for navigation, remembers them after lapses, and keeps maps independent', () => {
    const save = pass(); syncPath(save, 0);
    for (const stop of getArea(1).stops) if (stop.type === 'story') seeStory(save, stop, 0);
    const before = structuredClone(save); expect(visitArea(save, 2)).toBe(false); expect(save).toEqual(before);
    expect(areaGateOpen(save, 1)).toBe(true); walkGate(save, 1); expect(visitArea(save, 2)).toBe(true);
    expect(save.map).toMatchObject({ area: 2, position: 'tf-entry' }); expect(currentStop(save)?.id).toBe('tf-falls');
    expect(visitArea(save, 1)).toBe(true); expect(save.map.position).toBe('pp-gate');
    save.facts['dots:1:dice']!.stage = 'learning'; expect(earlierAreaNeedsHelp(save, 0, 2)).toBe(true);
    expect(areaGateOpen(save, 1)).toBe(true); expect(canVisitArea(save, 2)).toBe(true); expect(canVisitArea(save, 3)).toBe(false);
  });
  it('chooses the partner as listener, or the most recently joined other pal', () => {
    const save = createSave(); save.team = { partner: 'twoot', friends: ['twoot', 'tenny', 'bix'], helped: [] };
    expect(storyListener(save, 'twoot')).toBe('bix'); expect(storyListener(save, 'moss')).toBe('twoot');
    save.team.friends = ['twoot']; expect(storyListener(save, 'twoot')).not.toBe('twoot');
  });
});
describe('area save compatibility', () => {
  it('migrates the real version one fixture without losing its 65 responses or learner fields', () => {
    const json = readFileSync('tests/fixtures/save-v1-path-cleared.json', 'utf8'), old = JSON.parse(json), save = importSave(json);
    for (const key of ['profile', 'facts', 'sessions', 'responses', 'settings', 'practice'] as const) expect(save[key]).toEqual(old[key]);
    expect(save.responses).toHaveLength(65); expect(save.team.friends).toEqual(old.team.friends);
    expect(save.map.clearedSpots.every(id => allStops().some(s => s.id === id))).toBe(true);
    expect(save.map.clearedSpots.some(id => id.startsWith('tf-'))).toBe(false);
    expect(importSave(exportSave(save))).toEqual(save);
  });
  it('recognises old practice evidence even when its gate beat is absent', () => {
    const save = createSave(); save.map.gatePracticeIndex = 2;
    const restored = importSave(JSON.stringify(save));
    expect(canVisitArea(restored, 2)).toBe(true);
    expect(restored.map.gatePracticeIndex).toBe(2); expect(restored.facts).toEqual(save.facts);
  });
  it('retains a version two gate-practice save and opens the new map behind its old gate', () => {
    const save = pass(); save.team.partner = 'bix'; save.team.friends = ['bix', 'fivel']; save.team.helped = ['fivel'];
    save.story.completedBeats = ['welcome', 'ring', 'gate']; save.map.gatePracticeIndex = 7; syncPath(save, 0);
    const before = structuredClone(save), restored = importSave(JSON.stringify(save));
    expect(restored).toEqual(before); expect(canVisitArea(restored, 2)).toBe(true);
    expect(visitArea(restored, 2)).toBe(true); expect(restored.map.gatePracticeIndex).toBe(7);
    expect(restored.team).toEqual(before.team); expect(restored.facts).toEqual(before.facts);
    expect(restored.sessions).toEqual(before.sessions); expect(restored.responses).toEqual(before.responses);
    expect(importSave(exportSave(restored)).map.area).toBe(2);
  });
});
describe('Twin Falls geometry', () => {
  it('fits rings, targets and tags clear of entry, camp, gate, heading and corner controls', () => {
    const l = LAYOUT.map, regions = {
      entry: mapEntryRect(2)!, gate: mapGateRect(2), home: mapHomeRect(2), book: mapBookRect(2),
      mute: rectAt(l.muteX, l.muteY, l.muteW, l.muteW), heading: rectAt(l.headingX, l.headingY, 400, 80),
    };
    const stops = getArea(2).stops;
    const boxes = { ...regions } as Record<string, Rect>;
    for (const [i, stop] of stops.entries()) {
      const layout = mapStopLayout(i, 2), source = mapArt(2).stops[i]!;
      boxes[`stone-${i}`] = layout.touch;
      expect(contains(canvas, layout.ring)).toBe(true);
      expect(layout.radiusX).toBeCloseTo(source.rx * 1280 / 1536 + UI.stroke);
      expect(LAYOUT.map.progressStroke).toBeGreaterThanOrEqual(6);
      if (stop.type === 'skill') {
        boxes[`tag-${i}`] = layout.tag;
        expect(STOP_TAGS[stop.set]!.length * 14).toBeLessThanOrEqual(layout.tag.width);
        for (let j = 0; j < stops.length; j++) expect(overlaps(layout.tag, mapStopLayout(j, 2).ring)).toBe(false);
      }
    }
    disjoint(boxes);
    for (const id of ['tenny', 'domi', 'inch', 'fivel', 'twoot', 'bix'] as const) {
      for (let i = -1; i <= stops.length; i++) expect(contains(canvas, mapMarkerRect(id, i, 2))).toBe(true);
    }
  });
  it('anchors both new ground backgrounds and keeps the whole den page and rock above the panel', () => {
    for (const key of ['bg-twin-falls-encounter', 'bg-twin-falls-den'] as const) {
      const t = groundTransform(key), meta = manifest.backgrounds[key];
      expect(t.y + meta.groundY * t.scale).toBeCloseTo(SCENERY.groundY);
      expect(t.colour).toBe(Number.parseInt(meta.groundColour.slice(1), 16));
    }
    expect(groundTransform('bg-encounter-meadow').colour).toBe(INK.meadow);
    for (const listener of ['tenny', 'domi', 'inch', 'fivel', 'twoot', 'bix'] as const) {
      const layout = storyLayout('bg-twin-falls-den', 'twoot', listener), d = STORY_EFFECTS.den;
      const pulse = rectAt(centre(layout.outline!).x, centre(layout.outline!).y,
        layout.outline!.width * d.pagePulseScale, layout.outline!.height * d.pagePulseScale);
      disjoint({ page: pulse, speaker: layout.speaker, listener: layout.listener, dialogue: layout.dialogue });
      expect(layout.page!.y + layout.page!.height).toBeLessThan(layout.dialogue.y);
      expect(layout.rock!.y + layout.rock!.height).toBeLessThan(layout.dialogue.y);
      for (const p of layout.wallSparkles) expect(contains(canvas, rectAt(p.x, p.y, 1, 1))).toBe(true);
      const mist = storyLayout('bg-twin-falls-encounter', 'twoot', listener);
      expect(contains(canvas, { ...mist.mist, y: mist.mist.y - MOTION.bob - STORY_EFFECTS.mist.lift })).toBe(true);
      expect(overlaps(mist.mistBody, mist.speaker)).toBe(false); expect(overlaps(mist.mistBody, mist.listener)).toBe(false);
      expect(contains(canvas, mist.mistPuff)).toBe(true);
      expect(overlaps(mist.mistPuff, mist.dialogue)).toBe(false);
      for (const [id, rect] of [['twoot', mist.speaker], [listener, mist.listener]] as const) {
        const features = characterRegions(id, rect);
        if (features.face) expect(overlaps(mist.mistPuff, features.face)).toBe(false);
        for (const panel of features.panels) expect(overlaps(mist.mistPuff, panel)).toBe(false);
      }
      expect(STORY_EFFECTS.mist.width).toBe(210); expect(STORY_EFFECTS.mist.alpha).toBe(0.75);
      expect(STORY_EFFECTS.mist.puffAlpha).toBe(0.55);
    }
  });
});

describe('reached-area completions', () => {
  it('leaves unseen areas uncompleted and their pals unmet while preserving passed facts', () => {
    const save = pass(); pass(save, 2);
    const facts = structuredClone(save.facts);
    const change = syncPath(save, 0);
    expect(change.completed.every(id => getArea(1).stops.some(s => s.id === id))).toBe(true);
    expect(save.map.clearedSpots.some(id => id.startsWith('tf-'))).toBe(false);
    expect(change.joined).not.toContain('domi'); expect(save.team.friends).not.toContain('domi');
    expect(save.facts).toEqual(facts);
    expect(syncPath(save, 0, 2)).toMatchObject({ completed: [], joined: [] });
  });
  it('completes ready arrival stops in order, joins once, and keeps the unseen opening story current', () => {
    const save = pass(); pass(save, 2); syncPath(save, 0);
    walkGate(save, 1); visitArea(save, 2);
    const arrived = syncPath(save, 0, 2);
    expect(arrived.area).toBe(2);
    expect(arrived.completed).toEqual(['tf-add-doubles-small', 'tf-add-near-doubles-small', 'tf-sub-halves-small']);
    expect(arrived.joined).toEqual(['domi']);
    expect(arrived.before.filter(s => s.type === 'skill').every(s => s.progress === 1 && !s.completed && s.state === 'locked')).toBe(true);
    expect(arrived.after.filter(s => s.type === 'skill').every(s => s.completed && s.state === 'locked')).toBe(true);
    expect(currentStop(save)?.id).toBe('tf-falls'); expect(save.story.completedBeats).not.toContain('falls');
    expect(syncPath(save, 0, 2)).toMatchObject({ completed: [], joined: [] });
    const opening = getArea(2).stops[0]!;
    if (opening.type !== 'story') throw new Error('Expected an opening story');
    seeStory(save, opening, 0);
    expect(currentStop(save)?.id).toBe('tf-den');
  });
  it('keeps encounter changes in their own area, even when other reached sets have passed', () => {
    const save = pass(); syncPath(save, 0); walkGate(save, 1); pass(save, 2);
    expect(syncPath(save, 0, 1)).toMatchObject({ completed: [], joined: [] });
    expect(save.team.friends).not.toContain('domi');
    expect(save.map.clearedSpots.some(id => id.startsWith('tf-'))).toBe(false);
    expect(syncPath(save, 0, 2).joined).toEqual(['domi']);
  });
  it.each([1, 2])('does not complete unreached stops while importing version %s', version => {
    const save = pass(); pass(save, 2);
    save.team.partner = 'tenny'; save.team.friends = ['tenny'];
    const json = JSON.stringify({ ...save, version });
    const loaded = importSave(json); syncPath(loaded, 0, loaded.map.area);
    expect(loaded.map.clearedSpots.some(id => id.startsWith('tf-'))).toBe(false);
    expect(loaded.team.friends).not.toContain('domi');
    expect(loaded.facts).toEqual(save.facts);
    expect(loaded.responses).toEqual(save.responses);
  });
});
