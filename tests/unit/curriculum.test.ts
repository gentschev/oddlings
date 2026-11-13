import { describe, expect, it } from 'vitest';
import { FACTS, FACT_SETS, addition, subtraction, getFact, getSet, modelForFact, explanationForFact, taxonomy } from '../../src/core';

describe('curriculum', () => {
  it('covers all ordered addition pairs and every matching subtraction, exactly once in storage', () => {
    for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) {
      expect(FACTS.get(`add:${a}+${b}`)).toEqual(addition(a, b));
      expect(FACTS.get(`sub:${a + b}-${a}`)).toEqual(subtraction(a + b, a));
    }
    expect(getFact('add:3+7').id).not.toBe(getFact('add:7+3').id);
    expect(FACTS.size).toBe(329);
  });
  it('has the complete 27-set table, valid taxonomy mappings and an acyclic explicit graph', () => {
    expect(FACT_SETS).toHaveLength(27);
    const visiting = new Set<string>();
    const visited = new Set<string>();
    function visit(id: string): void {
      expect(visiting.has(id)).toBe(false);
      if (visited.has(id)) return;
      visiting.add(id);
      const set = getSet(id);
      expect(set.facts.length).toBeGreaterThan(0);
      expect(new Set(set.facts).size).toBe(set.facts.length);
      expect(taxonomy.topics.some(t => t.id === set.skillId)).toBe(true);
      for (const prerequisite of set.prerequisites) {
        expect(FACT_SETS.indexOf(getSet(prerequisite))).toBeLessThan(FACT_SETS.indexOf(set));
        visit(prerequisite);
      }
      if (set.inverse) getSet(set.inverse);
      visiting.delete(id); visited.add(id);
    }
    FACT_SETS.forEach(s => visit(s.id));
    expect(visited.size).toBe(27);
    expect(taxonomy.sourceCommit).toBe('df2d6ae43c45d75e8018252b18ae009a803fc984');
  });
  it.each([
    ['see-dots', 10], ['see-frame', 11], ['add-plus0', 21], ['add-plus1', 21],
    ['sub-minus01', 21], ['add-plus2', 21], ['add-within5', 21], ['sub-within5', 21],
    ['sub-minus2-all', 28], ['add-doubles-small', 5], ['add-near-doubles-small', 8],
    ['sub-halves-small', 5], ['add-five-and', 9], ['add-make10', 11], ['miss-make10', 11],
    ['sub-from10', 11], ['add-within10', 66], ['sub-within10', 66], ['miss-within10', 66],
    ['add-ten-plus', 21], ['sub-teen', 18], ['add-doubles-big', 5],
    ['add-near-doubles-big', 8], ['add-nine-plus', 15], ['add-eight-plus', 11],
    ['add-within20', 121], ['sub-within20', 121],
  ])('%s generates its exact fact count', (id, count) => expect(getSet(String(id)).facts).toHaveLength(Number(count)));
  it('provides model and correct worked structures for every fact in every set', () => {
    for (const set of FACT_SETS) for (const id of set.facts) {
      const explanation = explanationForFact(id, set.id);
      expect(explanation.result).toBe(getFact(id).answer);
      expect(explanation.model).toBe(set.model);
      expect(explanation.lines.length).toBeLessThanOrEqual(2);
      for (const line of explanation.lines) expect(line.split(' ').length).toBeLessThanOrEqual(8);
    }
    expect(modelForFact('add:7+3')).toBe('ten-frame');
    expect(explanationForFact('add:8+6', 'add-within20')).toMatchObject({ strategy: 'make-ten', groups: [8, 2, 4] });
    expect(explanationForFact('sub:5-2', 'sub-minus2-all').hops).toEqual([4, 3]);
    expect(explanationForFact('add:3+4', 'add-near-doubles-small').groups).toEqual([3, 3, 1]);
    expect(() => getFact('add:30+2')).toThrow();
    expect(() => modelForFact('add:7+3', 'see-dots')).toThrow();
  });
});
