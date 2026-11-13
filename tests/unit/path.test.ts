import { describe, expect, it } from 'vitest';
import { areaGateOpen, createSave, currentStop, encounterPals, gatePracticePal, getSet, importSave,
  exportSave, markHelped, migrateV1, offerCamp, palIntroduction, pathStops, seeStory, SESSION_STOP_MS, setPassed, startSession, stopIntroduction, syncPath } from '../../src/core';
import { PEBBLE_STOPS } from '../../src/core/story/pebblePath';

function pass(save = createSave(), id = 'see-dots') {
  for (const fact of getSet(id).facts) Object.assign(save.facts[fact]!, { stage: 'review', provisional: true });
  return save;
}
describe('skill path state', () => {
  it('starts at the welcome, exposes exact progress and cascades every passed skill', () => {
    const save = createSave(); save.team = { partner: 'inch', friends: ['inch'], helped: [] };
    expect(pathStops(save, 0).map(s => s.state)).toEqual(['current', ...Array(10).fill('locked')]);
    seeStory(save, PEBBLE_STOPS[0], 0);
    const dots = getSet('see-dots').facts;
    for (const id of dots.slice(0, 3)) save.facts[id]!.stage = 'review';
    expect(pathStops(save, 0)[1]).toMatchObject({ state: 'current', progress: 3 / 9 });
    pass(save); pass(save, 'see-frame'); pass(save, 'add-plus0');
    const changed = syncPath(save, 0);
    expect(changed.completed).toEqual(['pp-see-dots', 'pp-see-frame', 'pp-add-plus0']);
    expect(changed.joined).toEqual(['bix', 'tenny']);
    expect(currentStop(save)?.id).toBe('pp-add-plus1');
    expect(syncPath(save, 0).completed).toEqual([]); expect(syncPath(save, 0).joined).toEqual([]);
  });
  it('keeps completions sticky and shows a cloud only for learning or three confirmed due facts', () => {
    const save = pass(); seeStory(save, PEBBLE_STOPS[0], 0); syncPath(save, 0);
    const ids = getSet('see-dots').facts;
    expect(pathStops(save, 100)[1]!.needsHelp).toBe(false);
    for (const id of ids.slice(0, 2)) Object.assign(save.facts[id]!, { provisional: false, dueAt: 100 });
    expect(pathStops(save, 100)[1]!.needsHelp).toBe(false);
    Object.assign(save.facts[ids[2]!]!, { provisional: false, dueAt: 100 });
    expect(pathStops(save, 99)[1]!.needsHelp).toBe(false);
    expect(pathStops(save, 100)[1]!.needsHelp).toBe(true);
    for (const id of ids) Object.assign(save.facts[id]!, { stage: 'learning', provisional: false });
    syncPath(save, 100);
    expect(setPassed(save, 'see-dots')).toBe(false);
    expect(pathStops(save, 100)[1]).toMatchObject({ state: 'complete', progress: 0, needsHelp: true });
  });
  it('records passed skills behind a story, but keeps later stones locked until it is seen', () => {
    const save = createSave();
    for (const stop of PEBBLE_STOPS) if (stop.type === 'skill') pass(save, stop.set);
    syncPath(save, 0); expect(areaGateOpen(save, 1)).toBe(false);
    seeStory(save, PEBBLE_STOPS[0], 0);
    expect(currentStop(save)?.id).toBe('pp-ring');
    expect(pathStops(save, 0)[6]!.state).toBe('locked');
    seeStory(save, PEBBLE_STOPS[5], 0);
    expect(areaGateOpen(save, 1)).toBe(true); expect(currentStop(save)).toBeUndefined();
    save.facts['dots:1:dice']!.stage = 'learning'; syncPath(save, 0);
    expect(areaGateOpen(save, 1)).toBe(true);
  });
  it('uses the stop pal even when it is the partner, with a temporary helper and honest intros', () => {
    const save = createSave(); save.team = { partner: 'bix', friends: ['tenny', 'bix', 'twoot'], helped: [] };
    expect(encounterPals(save, 'bix')).toEqual({ wild: 'bix', helper: 'twoot' });
    expect(save.team.partner).toBe('bix');
    save.team.friends = ['bix']; expect(encounterPals(save, 'bix').helper).toBe('tenny');
    expect(stopIntroduction(save, PEBBLE_STOPS[1], 0)).toBe('first');
    markHelped(save, 'bix'); markHelped(save, 'bix');
    expect(save.team.helped).toEqual(['bix']);
    expect(stopIntroduction(save, PEBBLE_STOPS[1], 0)).toBe('again');
    expect(stopIntroduction(save, PEBBLE_STOPS[4], 0)).toBe('first');
    pass(save); seeStory(save, PEBBLE_STOPS[0], 0); syncPath(save, 0);
    expect(stopIntroduction(save, PEBBLE_STOPS[1], 0)).toBe('none');
    save.facts['dots:1:dice']!.stage = 'learning'; expect(stopIntroduction(save, PEBBLE_STOPS[1], 0)).toBe('again');
  });
  it('keeps newly joined pals first-time until their own muddle is cleared, including later stops', () => {
    const save = createSave(); save.team.partner = 'tenny'; save.team.friends = ['tenny'];
    expect(save.team.helped).toEqual([]);
    seeStory(save, PEBBLE_STOPS[0], 0);
    for (const set of ['see-dots', 'see-frame', 'add-plus0', 'add-plus1', 'sub-minus01', 'add-plus2', 'add-within5']) pass(save, set);
    syncPath(save, 0); seeStory(save, PEBBLE_STOPS[5], 0);
    expect(save.team.friends).toContain('inch'); expect(save.team.friends).toContain('fivel');
    expect(save.team.helped).toEqual([]);
    expect(stopIntroduction(save, PEBBLE_STOPS[9], 0)).toBe('first');
    save.facts[getSet('add-plus1').facts[0]!]!.stage = 'learning';
    expect(stopIntroduction(save, PEBBLE_STOPS[4], 0)).toBe('first');
    markHelped(save, 'inch');
    expect(stopIntroduction(save, PEBBLE_STOPS[4], 0)).toBe('again');
    expect(palIntroduction(save, 'fivel')).toBe('first');
    expect(importSave(exportSave(save)).team.helped).toEqual(['inch']);
    expect(() => importSave(JSON.stringify({ ...save, team: { ...save.team, helped: [7] } }))).toThrow();
  });
  it('rotates gate pals and offers camp once per session after ten minutes', () => {
    const save = createSave(); save.team = { partner: 'tenny', friends: ['tenny', 'bix', 'inch'], helped: [] }; startSession(save, 0);
    expect(gatePracticePal(save)).toBe('bix'); save.map.gatePracticeIndex = 1; expect(gatePracticePal(save)).toBe('inch');
    save.map.gatePracticeIndex = 2; expect(gatePracticePal(save)).toBe('bix');
    expect(offerCamp(save, SESSION_STOP_MS - 1)).toBe(false);
    expect(offerCamp(save, SESSION_STOP_MS)).toBe(true); expect(offerCamp(save, SESSION_STOP_MS + 1)).toBe(false);
    startSession(save, SESSION_STOP_MS * 2); expect(offerCamp(save, SESSION_STOP_MS * 3)).toBe(true);
  });
});
describe('version one map migration', () => {
  it.each(['fresh', 'mixed', 'gate'] as const)('preserves every learner field in an old %s save', kind => {
    const save = createSave(); startSession(save, 100);
    if (kind !== 'fresh') save.team = { partner: 'domi', friends: ['domi', 'fivel'], helped: [] };
    if (kind !== 'fresh') {
      pass(save); pass(save, 'add-plus1');
      save.story.completedBeats = ['welcome', 'ring', ...(kind === 'gate' ? ['gate'] : [])];
      if (kind === 'gate') for (const stop of PEBBLE_STOPS) if (stop.type === 'skill') pass(save, stop.set);
    }
    const old = { ...save, team: { partner: save.team.partner, friends: save.team.friends }, version: 1, map: { area: 1, clearedSpots: Array.from({ length: 11 }, (_, i) => `pebble-${i + 1}`), position: 'pebble-11' } };
    const before = structuredClone(old), migrated = migrateV1(old);
    expect(old).toEqual(before); expect(migrated.version).toBe(2);
    expect(migrated.team).toEqual({ ...old.team, helped: kind === 'fresh' ? [] : ['fivel'] });
    for (const key of ['profile', 'facts', 'sessions', 'responses', 'settings', 'practice', 'story'] as const) expect(migrated[key]).toEqual(old[key]);
    expect(migrated.map.clearedSpots.some(id => id.startsWith('pebble-'))).toBe(false);
    expect(migrated.map.position).toBe(currentStop(migrated)?.id ?? 'pp-gate');
    expect(migrated.map.clearedSpots).toEqual(kind === 'fresh' ? [] : kind === 'gate' ? PEBBLE_STOPS.map(s => s.id)
      : ['pp-welcome', 'pp-see-dots', 'pp-add-plus1', 'pp-ring']);
    expect(importSave(JSON.stringify(old))).toEqual(migrated);
  });
});
