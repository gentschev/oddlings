import { describe, expect, it } from 'vitest';
import { choosePartner, createSave, getSet, ODDLING_IDS, ODDLING_SETS, oddlingProgress } from '../../src/core';

describe('Oddbook progress', () => {
  it('counts only confirmed review facts, with fluent as a separate brighter segment', () => {
    const save = createSave(), ids = getSet('see-dots').facts;
    for (const id of ids.slice(0, 4)) save.facts[id]!.stage = 'review';
    save.facts[ids[0]!]!.fastDays = ['one', 'two', 'three'];
    save.facts[ids[3]!]!.provisional = true;
    save.facts[ids[4]!]!.stage = 'learning';
    expect(oddlingProgress(save, 'bix')).toEqual({ total: 10, review: 3, accurate: 2, fluent: 1,
      reviewShare: 0.3, accurateShare: 0.2, fluentShare: 0.1 });
    expect(oddlingProgress(save, 'tenny').review).toBe(0);
  });
  it('deduplicates shared facts in each pal and shares knowledge across pals', () => {
    const save = createSave();
    for (const id of ODDLING_IDS) {
      const facts = new Set(ODDLING_SETS[id].flatMap(set => getSet(set).facts));
      for (const fact of facts) Object.assign(save.facts[fact]!, { stage: 'review', provisional: false, fastDays: ['a', 'b', 'c'] });
      expect(oddlingProgress(save, id)).toMatchObject({ total: facts.size, review: facts.size,
        fluent: facts.size, accurate: 0, reviewShare: 1, fluentShare: 1, accurateShare: 0 });
    }
    const shared = createSave(); shared.facts['add:3+2']!.stage = 'review';
    for (const id of ['fivel', 'twoot'] as const) expect(oddlingProgress(shared, id).review).toBe(1);
  });
  it('reports the six pals against the same partially learned save', () => {
    const save = createSave();
    for (const id of ['frame:10', 'add:5+5', 'add:2+2', 'add:3+2', 'sub:4-2', 'dots:5:dice', 'add:4+1']) save.facts[id]!.stage = 'review';
    for (const id of ['frame:10', 'add:2+2', 'dots:5:dice']) save.facts[id]!.fastDays = ['a', 'b', 'c'];
    save.facts['add:4+1']!.provisional = true;
    save.facts['sub:10-3']!.stage = 'learning';
    const expected = { tenny: [52, 2, 1], domi: [23, 3, 1], inch: [61, 0, 0],
      fivel: [42, 3, 1], twoot: [53, 3, 1], bix: [10, 1, 1] } as const;
    for (const id of ODDLING_IDS) {
      const [total, review, fluent] = expected[id];
      expect(oddlingProgress(save, id), id).toEqual({ total, review, accurate: review - fluent, fluent,
        reviewShare: review / total, accurateShare: (review - fluent) / total, fluentShare: fluent / total });
    }
  });
  it('can choose any met pal, and cannot choose a silhouette', () => {
    const save = createSave(); save.team = { partner: 'tenny', friends: ['tenny', 'bix'], helped: [] };
    expect(choosePartner(save, 'domi')).toBe(false); expect(save.team.partner).toBe('tenny');
    expect(choosePartner(save, 'bix')).toBe(true); expect(save.team.partner).toBe('bix');
  });
});
