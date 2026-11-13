import { describe, expect, it } from 'vitest';
import {
  areaGateOpen, syncPath, createSave, currentSession, DAY_MS, exportSave, FACT_SETS, getSet,
  growthForm, importSave, placementProbes, recordPlacement, recordWarmupTap, seededRandom,
  setLevel, setPassed, skillMastery, SKILLS, startSession, stoppingPlace, touchSession, validateSave,
} from '../../src/core';
import { fixture, masterSet } from './helpers';

describe('placement', () => {
  it('probes the two hardest distinct facts, marks the rest provisional due now, and proceeds in order', () => {
    const save = createSave(); startSession(save, 0);
    const probes = placementProbes(save, seededRandom(42));
    expect(probes).toEqual(['dots:5:dice', 'dots:5:scattered']);
    expect(placementProbes(save, seededRandom(999))).toEqual(probes);
    for (const id of probes) recordPlacement(save, id, true, 1000);
    expect(save.practice.placement.setIndex).toBe(1);
    for (const id of getSet('see-dots').facts) expect(save.facts[id]).toMatchObject({
      stage: 'review', provisional: !probes.includes(id), dueAt: probes.includes(id) ? 1000 + DAY_MS : 1000,
    });
    expect(setLevel(save, 'see-dots')).toBe(1);
    expect(placementProbes(save, seededRandom(42)).every(id => id.startsWith('frame:'))).toBe(true);
  });
  it('stops at the first set with two missed probes', () => {
    const save = createSave(); startSession(save, 0);
    for (let i = 0; i < 2; i++) recordPlacement(save, placementProbes(save, seededRandom(1))[0]!, false, 0);
    expect(save.practice.placement).toMatchObject({ active: false, setIndex: 0 });
    expect(Object.values(save.facts).every(f => !f.provisional)).toBe(true);
    expect(placementProbes(save, seededRandom(1))).toEqual([]);
  });
  it('reaches the end when every set is known without resetting shared confirmed facts', () => {
    const save = createSave(); startSession(save, 0);
    for (const set of FACT_SETS) {
      if (!setPassed(save, set.id)) placementProbes(save, seededRandom(1)).forEach(id => recordPlacement(save, id, true, 0));
      expect(setPassed(save, set.id), set.id).toBe(true);
    }
    expect(save.practice.placement.active).toBe(false);
  });
});
describe('mastery and growth', () => {
  it('distinguishes unseen, learning, accurate, fluent and excludes provisional facts', () => {
    const save = fixture(); const set = getSet('see-dots');
    expect(setLevel(save, set.id)).toBe(0);
    save.facts[set.facts[0]!]!.seen = 1; expect(setLevel(save, set.id)).toBe(1);
    masterSet(save, set.id);
    save.facts[set.facts[0]!]!.provisional = true;
    save.facts[set.facts[1]!]!.provisional = true; expect(setLevel(save, set.id)).toBe(1);
    save.facts[set.facts[1]!]!.provisional = false; expect(setLevel(save, set.id)).toBe(2);
    set.facts.slice(0, 9).forEach(id => { save.facts[id]!.fastDays = ['a', 'b', 'c']; save.facts[id]!.provisional = false; });
    expect(setLevel(save, set.id)).toBe(3); expect(growthForm(save, [set.id])).toBe(3);
  });
  it('uses the lowest set in skill scope and opens area gates only when all sets are accurate', () => {
    const save = fixture(); masterSet(save, 'see-frame');
    expect(skillMastery(save, SKILLS.parts)).toBe(0);
    expect(skillMastery(save, SKILLS.parts, ['see-frame'])).toBe(2);
    expect(skillMastery(save, SKILLS.parts, [])).toBeNull();
    expect(growthForm(save, ['see-frame'])).toBe(2);
    expect(growthForm(save, ['see-frame', 'see-dots'])).toBe(1);
    expect(areaGateOpen(save, 1)).toBe(false);
    FACT_SETS.filter(s => s.area === 1).forEach(s => masterSet(save, s.id));
    save.story.completedBeats.push('welcome', 'ring'); syncPath(save, 0);
    expect(areaGateOpen(save, 1)).toBe(true); expect(areaGateOpen(save, 2)).toBe(false);
  });
});
describe('sessions and saves', () => {
  it('starts at app start or five minutes away, retains short resumes and offers a stop at ten minutes', () => {
    const save = fixture();
    touchSession(save, 1000);
    expect(startSession(save, 300999, false).id).toBe('session-1');
    expect(startSession(save, 600999, false).id).toBe('session-2');
    expect(stoppingPlace(save, 1200998)).toBe(false);
    expect(stoppingPlace(save, 1200999)).toBe(true);
    startSession(save, 1201000); expect(save.sessions).toHaveLength(3);
  });
  it('takes exactly five warm-up taps each session and keeps fifteen across sessions', () => {
    const save = fixture();
    for (let session = 0; session < 4; session++) {
      if (session) startSession(save, session * DAY_MS);
      for (const tap of [1000, 1500, 2000, 5000, 1200]) expect(recordWarmupTap(save, tap)).toBe(true);
      expect(recordWarmupTap(save, 1)).toBe(false);
    }
    expect(currentSession(save).warmupTaps).toBe(5);
    expect(save.profile.tapHistory).toHaveLength(15); expect(save.profile.tapBaseline).toBe(1500);
  });
  it('round-trips all state as JSON without aliases, including retries and placement', () => {
    const save = fixture(); masterSet(save, 'see-dots'); save.team.partner = 'Tenny';
    save.story.completedBeats.push('hello'); save.map.clearedSpots.push('one');
    const restored = importSave(exportSave(save));
    expect(restored).toEqual(save);
    restored.facts['dots:1:dice']!.seen++;
    expect(restored).not.toEqual(save);
  });
  it('migrates the version-zero scaffold, leaves the original alone, and rejects damaged or future saves', () => {
    const old = { ...createSave(), version: 0, practice: undefined };
    const original = JSON.stringify(old);
    const migrated = importSave(original);
    expect(migrated.version).toBe(2); expect(migrated.practice).toEqual(createSave().practice);
    expect(JSON.stringify(old)).toBe(original);
    for (const json of ['null', '{}', '{', '{"version":99}', '{"version":1}']) expect(() => importSave(json)).toThrow();
    const corrupt = createSave(); corrupt.facts['add:1+1']!.ladder = 90;
    expect(() => validateSave(corrupt)).toThrow();
    const badSettings = { ...createSave(), settings: { sound: 'yes' } };
    expect(() => validateSave(badSettings)).toThrow();
  });
  it('restores a seeded random stream exactly', () => {
    const first = seededRandom(123);
    const values = Array.from({ length: 100 }, () => first.next());
    expect(values.every(v => v >= 0 && v < 1)).toBe(true);
    expect(new Set(values).size).toBe(100);
    const resumed = seededRandom(first.state());
    expect(resumed.next()).toBe(first.next());
    expect(seededRandom(0).next()).toBe(seededRandom(0).next());
  });
});
