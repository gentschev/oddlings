import { describe, expect, it } from 'vitest';
import { createSave, getSet,
  introductionSets, oddlingProgress, openSets, placementProbes, provisionalFacts, recordPlacement,
  seededRandom, setLevel, setPassed, startSession } from '../../src/core';
import { parentModel } from '../../src/parent/model';

describe('placement passes and confirmed knowledge', () => {
  it('opens prerequisites while keeping parent levels and Oddbook bars honest', () => {
    const save = createSave(); startSession(save, 0); const rng = seededRandom(1);
    for (const id of placementProbes(save, rng)) recordPlacement(save, id, true, 0);
    expect(setPassed(save, 'see-dots')).toBe(true); expect(setLevel(save, 'see-dots')).toBe(1);
    expect(openSets(save).map(s => s.id)).toContain('see-frame');
    expect(introductionSets(save).map(s => s.id)).not.toContain('see-dots');
    expect(oddlingProgress(save, 'bix')).toMatchObject({ review: 2, total: 10 });
    const placed = parentModel(save, 0).tree.nodes.flatMap(n => n.sets).find(s => s.id === 'see-dots');
    expect(placed).toMatchObject({ level: 1, passed: true, placed: true, state: 'placed, being checked' });
  });
  it('does not call provisional fast facts fluent, and checks earlier sets before harder ones', () => {
    const save = createSave();
    for (const id of ['dots:3:dice', 'dots:4:dice', 'frame:10', 'add:10+10']) {
      Object.assign(save.facts[id]!, { stage: 'review', provisional: true, fastDays: ['a', 'b', 'c'] });
    }
    expect(provisionalFacts(save)).toEqual(['dots:4:dice', 'dots:3:dice', 'frame:10', 'add:10+10']);
    for (const id of getSet('see-dots').facts) Object.assign(save.facts[id]!, { stage: 'review', provisional: true, fastDays: ['a', 'b', 'c'] });
    expect(setPassed(save, 'see-dots')).toBe(true); expect(setLevel(save, 'see-dots')).toBe(1);
    expect(oddlingProgress(save, 'bix').fluent).toBe(0);
  });
});
