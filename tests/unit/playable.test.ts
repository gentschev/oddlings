import { describe, expect, it } from 'vitest';
import { createSave, currentSlot, getFact, newFactState, practiceProgress, practiceSnapshot,
  seededRandom, startEncounter, startSession, submitAnswer } from '../../src/core';

const NOW = 1_800_000_000_000;
describe('replay practice', () => {
  it('reviews existing facts and keeps new facts out even after correction extends the encounter', () => {
    const save = createSave(); startSession(save, NOW);
    const ids = ['dots:1:dice', 'dots:2:dice', 'dots:3:dice'];
    for (const id of ids) save.facts[id] = { ...newFactState(id), stage: 'learning', seen: 1 };
    const rng = seededRandom(32);
    const encounter = startEncounter(save, NOW, rng, 6, true);
    for (let i = 0; i < 9; i++) {
      const slot = currentSlot(encounter);
      expect(ids).toContain(slot.factId);
      expect(encounter.slots.every(s => ids.includes(s.factId))).toBe(true);
      expect(slot.source).not.toBe('placement');
      submitAnswer(save, encounter, 20, NOW + i * 1000, '2026-11-12', rng);
      expect(encounter.phase).toBe('second');
      submitAnswer(save, encounter, getFact(slot.factId).answer, NOW + i * 1000 + 500, '2026-11-12', rng);
    }
    expect(encounter.slots.length).toBeGreaterThan(6);
    expect(Object.values(save.facts).filter(f => f.seen > 0).map(f => f.id).sort()).toEqual(ids.sort());
  });
  it('falls back to placement if a replay is requested before anything is learned', () => {
    const save = createSave(); startSession(save, NOW);
    const encounter = startEncounter(save, NOW, seededRandom(5), 8, true);
    expect(encounter.reviewOnly).toBe(false);
    expect(encounter.slots.some(s => s.source === 'placement')).toBe(true);
  });
});

describe('honest reward counts', () => {
  it('counts distinct introduced facts and confirmed acquisition, independent of response history', () => {
    const save = createSave(), before = practiceSnapshot(save);
    const first = save.facts['add:1+1']!;
    first.seen = 3; first.stage = 'learning';
    const acquired = save.facts['add:2+2']!;
    acquired.seen = 4; acquired.stage = 'review';
    const provisional = save.facts['add:3+3']!;
    provisional.stage = 'review'; provisional.provisional = true;
    expect(practiceProgress(save, before)).toEqual({ introduced: 2, learned: 1 });
    const again = practiceSnapshot(save);
    first.seen++;
    expect(practiceProgress(save, again)).toEqual({ introduced: 0, learned: 0 });
  });
});
