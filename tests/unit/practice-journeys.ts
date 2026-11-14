import { readFileSync } from 'node:fs';
import { areaGateOpen, createSave, currentSlot, currentStop, getFact, importSave, pathStops, seeStory,
  seededRandom, startEncounter, startSession, submitAnswer, syncPath, FACT_SETS } from '../../src/core';
import { allStops, areaForStop, getArea, visitArea, walkGate } from '../../src/core/areas';

export type Child = 'fixture' | 'fluffed' | 'slow' | 'learner';
/** Seeded practice journeys. The fixture trial uses one slip per ten scored questions. */
export function practiceJourney(kind: Child, limit = 160, targetArea = 1) {
  const save = kind === 'fixture' ? importSave(readFileSync('tests/fixtures/save-v1-path-cleared.json', 'utf8')) : createSave();
  const planning = seededRandom(7), child = seededRandom(11), exposures = new Map<string, number>();
  const familiar = new Set(FACT_SETS.slice(0, 3).flatMap(s => s.facts));
  const perStop: Record<string, number> = Object.fromEntries(allStops().filter(s => areaForStop(s.id).number <= targetArea && s.type === 'skill').map(s => [s.id, 0]));
  const flatEncounters: { stop: string; encounter: number; correctLearning: number; before: number; after: number }[] = [];
  let encounters = 0, questions = 0, now = Math.max(0, ...save.sessions.map(s => s.end));
  startSession(save, now);
  while (!areaGateOpen(save, targetArea) && encounters < limit) {
    const stop = currentStop(save);
    if (!stop) {
      walkGate(save, save.map.area);
      if (!visitArea(save, save.map.area + 1)) throw new Error('No next area');
      syncPath(save, now, save.map.area);
      continue;
    }
    if (stop.type === 'story') { seeStory(save, stop, now); continue; }
    perStop[stop.id] = (perStop[stop.id] ?? 0) + 1; encounters++;
    const before = pathStops(save, now).find(s => s.id === stop.id)!.progress;
    const correctLearning = new Set<string>();
    const encounter = startEncounter(save, now, planning);
    let guard = 0;
    while (encounter.phase !== 'complete' && ++guard < 400) {
      const slot = currentSlot(encounter), fact = getFact(slot.factId), state = save.facts[fact.id]!;
      const seen = exposures.get(fact.id) ?? 0;
      const probability = kind === 'learner' ? familiar.has(fact.id) ? 0.97 : Math.min(0.97, 0.4 + seen * 0.25)
        : kind === 'fixture' ? 0.9 : 0.95;
      const forced = kind !== 'fixture' && kind !== 'learner' && slot.source === 'placement' && slot.setId === 'add-plus0';
      // The fixture child slips once in ten answers. Other profiles use seeded draws.
      const correct = (kind === 'fixture' ? (questions + 1) % 10 !== 0 : child.next() < probability) && !forced;
      if (correct && state.stage === 'learning' && FACT_SETS.find(s => s.id === stop.set)!.facts.includes(fact.id)) correctLearning.add(fact.id);
      now += kind === 'slow' ? 6000 : 1200; questions++;
      submitAnswer(save, encounter, fact.answer + Number(!correct), now, 'day-1', planning);
      exposures.set(fact.id, seen + 1);
      if (encounter.phase === 'second' || encounter.phase === 'correction') { now += 1000; submitAnswer(save, encounter, fact.answer, now, 'day-1', planning); }
    }
    if (guard >= 400) throw new Error(`Encounter failed to finish for ${kind}`);
    syncPath(save, now, save.map.area);
    const after = pathStops(save, now).find(s => s.id === stop.id)!.progress;
    if (correctLearning.size >= 2 && after <= before) flatEncounters.push({ stop: stop.id, encounter: encounters, correctLearning: correctLearning.size, before, after });
  }
  return { kind, encounters, questions, complete: areaGateOpen(save, targetArea), area: getArea(save.map.area).name, perStop, flatEncounters };
}
