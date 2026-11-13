import taxonomy from './taxonomy.json' with { type: 'json' };
import { addition, subtraction, missing, dots, frame, range, pairs, differences, uniqueFacts, workItOut } from './facts';
import type { Fact, Model } from './facts';

export { taxonomy };
export const SKILLS = {
  dots: 'mt_t9BICauBSI', parts: 'mt_BK5xwkrD5C', within5: 'mt_ghF3Vv6taM',
  pairs: 'mt_7XcCG43ZZW', bonds: 'mt_e8CZ7E5qW7', counting: 'mt_PpWSHA-0kv',
  missing: 'mt_ezc2m_0dzN', within10: 'mt__we2TDqnJx', teens: 'mt_xmmgAzxe5j',
  strategies20: 'mt_m1W6nTQJ2b', within20: 'mt__t4afSyZRm',
} as const;
export interface FactSet {
  id: string;
  facts: string[];
  model: Model;
  skillId: string;
  area: number;
  prerequisites: string[];
  inverse: string | null;
}
const factsById = new Map<string, Fact>();
function set(id: string, facts: Fact[], model: Model, skillId: string, area: number, prerequisites: string[], inverse: string | null = null): FactSet {
  for (const fact of facts) factsById.set(fact.id, fact);
  return { id, facts: uniqueFacts(facts).map(f => f.id), model, skillId, area, prerequisites, inverse };
}
const turns = (n: number, values: number[]) => values.flatMap(a => [addition(n, a), addition(a, n)]);

/** Explicit edges follow teaching order, including the strategies needed by mixed sets. */
export const FACT_SETS: readonly FactSet[] = [
  set('see-dots', range(5, 1).flatMap(n => [dots(n, 'dice'), dots(n, 'scattered')]), 'dots', SKILLS.dots, 1, []),
  set('see-frame', range(10).map(frame), 'ten-frame', SKILLS.parts, 1, ['see-dots']),
  set('add-plus0', turns(0, range(10)), 'ten-frame', SKILLS.counting, 1, ['see-frame'], 'sub-minus01'),
  set('add-plus1', turns(1, range(10)), 'number-line', SKILLS.counting, 1, ['add-plus0'], 'sub-minus01'),
  set('sub-minus01', range(10).flatMap(n => [subtraction(n, 0), ...(n > 0 ? [subtraction(n, 1)] : [])]), 'number-line', SKILLS.counting, 1, ['add-plus1'], 'add-plus1'),
  set('add-plus2', turns(2, range(10)), 'number-line', SKILLS.counting, 1, ['sub-minus01'], 'sub-minus2-all'),
  set('add-within5', pairs(5), 'ten-frame', SKILLS.within5, 1, ['add-plus2'], 'sub-within5'),
  set('sub-within5', differences(5), 'ten-frame', SKILLS.within5, 1, ['add-within5', 'sub-minus01'], 'add-within5'),
  set('sub-minus2-all', range(10).flatMap(n => [subtraction(n, n), ...(n > 0 ? [subtraction(n, n - 1)] : []), ...(n >= 2 ? [subtraction(n, 2)] : [])]), 'number-line', SKILLS.counting, 1, ['sub-within5', 'add-plus2'], 'add-plus2'),
  set('add-doubles-small', range(5, 1).map(n => addition(n, n)), 'domino', SKILLS.pairs, 2, ['sub-minus2-all']),
  set('add-near-doubles-small', range(4, 1).flatMap(n => [addition(n, n + 1), addition(n + 1, n)]), 'domino', SKILLS.pairs, 2, ['add-doubles-small']),
  set('sub-halves-small', range(5, 1).map(n => subtraction(n * 2, n)), 'domino', SKILLS.missing, 2, ['add-near-doubles-small'], 'add-doubles-small'),
  set('add-five-and', turns(5, range(5, 1)), 'ten-frame', SKILLS.parts, 3, ['sub-halves-small', 'see-frame']),
  set('add-make10', range(10).map(n => addition(n, 10 - n)), 'ten-frame', SKILLS.bonds, 3, ['add-five-and', 'add-doubles-small'], 'sub-from10'),
  set('miss-make10', range(10).map(n => missing(n, 10)), 'ten-frame', SKILLS.bonds, 3, ['add-make10'], 'sub-from10'),
  set('sub-from10', range(10).map(n => subtraction(10, n)), 'ten-frame', SKILLS.bonds, 3, ['miss-make10'], 'add-make10'),
  set('add-within10', pairs(10), 'ten-frame', SKILLS.within10, 3, ['sub-from10', 'add-near-doubles-small', 'add-within5'], 'sub-within10'),
  set('sub-within10', differences(10), 'ten-frame', SKILLS.within10, 3, ['add-within10', 'sub-halves-small', 'sub-within5'], 'add-within10'),
  set('miss-within10', range(10).flatMap(c => range(c).map(a => missing(a, c))), 'ten-frame', SKILLS.missing, 3, ['sub-within10', 'miss-make10'], 'sub-within10'),
  set('add-ten-plus', turns(10, range(10)), 'double-ten-frame', SKILLS.teens, 4, ['miss-within10'], 'sub-teen'),
  set('sub-teen', range(9, 1).flatMap(n => [subtraction(10 + n, n), subtraction(10 + n, 10)]), 'double-ten-frame', SKILLS.teens, 4, ['add-ten-plus'], 'add-ten-plus'),
  set('add-doubles-big', range(10, 6).map(n => addition(n, n)), 'domino', SKILLS.strategies20, 4, ['sub-teen', 'add-doubles-small']),
  set('add-near-doubles-big', range(8, 5).flatMap(n => [addition(n, n + 1), addition(n + 1, n)]), 'domino', SKILLS.strategies20, 4, ['add-doubles-big', 'add-near-doubles-small']),
  set('add-nine-plus', turns(9, range(9, 2)), 'double-ten-frame', SKILLS.strategies20, 4, ['add-near-doubles-big', 'add-make10']),
  set('add-eight-plus', turns(8, range(8, 3)), 'double-ten-frame', SKILLS.strategies20, 4, ['add-nine-plus']),
  set('add-within20', pairs(20), 'double-ten-frame', SKILLS.within20, 4, ['add-eight-plus', 'add-within10'], 'sub-within20'),
  set('sub-within20', differences(20), 'double-ten-frame', SKILLS.within20, 4, ['add-within20', 'sub-within10'], 'add-within20'),
];
export const FACTS: ReadonlyMap<string, Fact> = factsById;
export function getFact(id: string): Fact {
  const result = FACTS.get(id);
  if (!result) throw new Error(`Unknown fact: ${id}`);
  return result;
}
export function getSet(id: string): FactSet {
  const result = FACT_SETS.find(s => s.id === id);
  if (!result) throw new Error(`Unknown set: ${id}`);
  return result;
}
export function setsForFact(id: string): readonly FactSet[] {
  getFact(id);
  return FACT_SETS.filter(s => s.facts.includes(id));
}
export function modelForFact(id: string, setId?: string): Model {
  const set = setId ? getSet(setId) : setsForFact(id)[0]!;
  if (!set.facts.includes(id)) throw new Error(`${id} is not in ${set.id}`);
  return set.model;
}
export function explanationForFact(id: string, setId?: string) {
  return workItOut(getFact(id), modelForFact(id, setId));
}
