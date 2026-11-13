import { MAX_SETS_IN_INTRO, SET_MASTERY_RATIO } from './constants';
import { FACT_SETS, getSet, taxonomy } from './curriculum/sets';
import { isFluent } from './learner';
import type { Save } from './types';
import { AREAS, gateWalked } from './areas';

export type Level = 0 | 1 | 2 | 3;
export function setLevel(save: Save, setId: string): Level {
  const facts = getSet(setId).facts.map(id => save.facts[id]!);
  if (facts.filter(f => !f.provisional && isFluent(f)).length / facts.length >= SET_MASTERY_RATIO) return 3;
  if (facts.filter(f => f.stage === 'review' && !f.provisional).length / facts.length >= SET_MASTERY_RATIO) return 2;
  return facts.some(f => f.seen > 0 || f.stage !== 'new') ? 1 : 0;
}
/** Placement can open the path while its provisional facts are still being checked. */
export function setPassed(save: Save, setId: string): boolean {
  const set = getSet(setId);
  return setLevel(save, setId) >= 2 || set.facts.filter(id => save.facts[id]!.stage === 'review').length / set.facts.length >= SET_MASTERY_RATIO;
}
export function openSets(save: Save) {
  return FACT_SETS.filter(set => set.prerequisites.every(id => setPassed(save, id)));
}
export function introductionSets(save: Save) {
  return openSets(save).filter(set => !setPassed(save, set.id) && (set.facts.some(id => save.facts[id]!.stage === 'new') || save.practice.checks?.[set.id]?.status === 'checking')).slice(0, MAX_SETS_IN_INTRO);
}
export function skillMastery(save: Save, skillId: string, scope: readonly string[] = FACT_SETS.map(s => s.id)): Level | null {
  if (!taxonomy.topics.some(t => t.id === skillId)) throw new Error(`Unknown skill: ${skillId}`);
  const sets = FACT_SETS.filter(s => s.skillId === skillId && scope.includes(s.id));
  return sets.length ? Math.min(...sets.map(s => setLevel(save, s.id))) as Level : null;
}
export function areaGateOpen(save: Save, area: number): boolean {
  const definition = AREAS.find(a => a.number === area);
  return !!definition && (gateWalked(save, area) || definition.stops.every(s => s.type === 'story'
    ? save.story.completedBeats.includes(s.beat) : save.map.clearedSpots.includes(s.id)));
}
export function growthForm(save: Save, setIds: readonly string[]): 1 | 2 | 3 {
  const level = setIds.length ? Math.min(...setIds.map(id => setLevel(save, id))) : 0;
  return level >= 3 ? 3 : level >= 2 ? 2 : 1;
}
