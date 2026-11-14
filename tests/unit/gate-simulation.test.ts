import { expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { areaGateOpen, createSave, currentSlot, currentStop, DAY_MS, getFact, seeStory, seededRandom,
  startEncounter, startSession, submitAnswer, syncPath } from '../../src/core';
import { PEBBLE_STOPS } from '../../src/core/story/pebblePath';

it('simulates the visible path for always-right, 95% and 85% children', () => {
  const results = [1, 0.95, 0.85].map(probability => {
    const save = createSave(), planning = seededRandom(7), child = seededRandom(11);
    const perStop = Object.fromEntries(PEBBLE_STOPS.filter(s => s.type === 'skill').map(s => [s.id, 0]));
    let encounters = 0, questions = 0, now = 0;
    startSession(save, now);
    while (!areaGateOpen(save, 1)) {
      expect(encounters).toBeLessThan(108);
      const stop = currentStop(save)!;
      if (stop.type === 'story') { seeStory(save, stop, now); continue; }
      if (encounters > 0 && encounters % 6 === 0) { now = Math.floor(encounters / 6) * DAY_MS; startSession(save, now); }
      perStop[stop.id]!++; encounters++;
      const encounter = startEncounter(save, now, planning);
      let guard = 0;
      while (encounter.phase !== 'complete') {
        expect(++guard).toBeLessThan(100);
        const fact = getFact(currentSlot(encounter).factId), correct = child.next() < probability;
        now += probability === 1 ? 2500 : probability === 0.95 ? 4000 : 5000; questions++;
        submitAnswer(save, encounter, fact.answer + Number(!correct), now, `day-${Math.floor(now / DAY_MS)}`, planning);
        if (encounter.phase === 'second' || encounter.phase === 'correction') { now += 1500; submitAnswer(save, encounter, fact.answer, now, 'day', planning); }
      }
      syncPath(save, now);
    }
    if (probability === 1) expect(encounters).toBeLessThanOrEqual(9);
    if (probability === 0.85) for (const count of Object.values(perStop)) expect(count).toBeLessThanOrEqual(12);
    return { probability, encounters, questions, perStop };
  });
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/path-simulation.json', JSON.stringify(results, null, 2));
});
