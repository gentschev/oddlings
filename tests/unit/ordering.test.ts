import { describe, expect, it } from 'vitest';
import { getFact, planEncounter, seededRandom, type Slot } from '../../src/core';
import { spreadSlots } from '../../src/core/ordering';
import { fixture, masterSet } from './helpers';

describe('encounter ordering after selection', () => {
  it('spreads new and learning slots between known facts without changing the selected facts', () => {
    const save = fixture(); masterSet(save, 'see-dots');
    const slots: Slot[] = ['dots:1:dice', 'frame:6', 'frame:7', 'dots:2:dice', 'dots:3:dice', 'dots:4:dice', 'dots:5:dice', 'dots:2:scattered']
      .map((factId, i) => ({ factId, setId: i === 1 || i === 2 ? 'see-frame' : 'see-dots',
        source: i === 1 ? 'new' : i === 2 ? 'learning' : 'known', mode: 'plain' }));
    save.facts['frame:7']!.stage = 'learning';
    const ordered = spreadSlots(save, slots);
    expect(ordered.map(s => s.factId).sort()).toEqual(slots.map(s => s.factId).sort());
    const unknown = ordered.map(s => save.facts[s.factId]!.stage !== 'review');
    expect(unknown[0]).toBe(false); expect(unknown.at(-1)).toBe(false);
    for (let i = 1; i < ordered.length; i++) {
      expect(unknown[i] && unknown[i - 1]).toBe(false);
      expect(ordered[i]!.factId).not.toBe(ordered[i - 1]!.factId);
      expect(getFact(ordered[i]!.factId).answer).not.toBe(getFact(ordered[i - 1]!.factId).answer);
    }
  });
  it('spreads the actual planner output over many seeds', () => {
    const save = fixture(); masterSet(save, 'see-dots');
    for (let seed = 1; seed <= 30; seed++) {
      const slots = planEncounter(save, 0, seededRandom(seed), 10);
      const unknown = slots.map(s => save.facts[s.factId]!.stage !== 'review');
      expect(unknown.filter(Boolean).length).toBeGreaterThan(0);
      expect(unknown[0]).toBe(false); expect(unknown.at(-1)).toBe(false);
      for (let i = 1; i < slots.length; i++) expect(unknown[i] && unknown[i - 1], `seed ${seed}`).toBe(false);
    }
  });
  it('keeps scheduled retry positions while arranging the other slots', () => {
    const save = fixture(); masterSet(save, 'see-dots');
    const slots = planEncounter(save, 0, seededRandom(1));
    slots[3] = { factId: 'frame:9', setId: 'see-frame', source: 'retry', mode: 'modeled' };
    const result = spreadSlots(save, slots);
    expect(result[3]).toBe(slots[3]);
    expect(result).toHaveLength(slots.length);
  });
});
