import { expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  createSave, currentSession, currentSlot, DAY_MS, exportSave, FACT_SETS, getFact, importSave,
  seededRandom, setLevel, startEncounter, startSession, submitAnswer,
} from '../../src/core';

it('runs a child for thirty ten-minute days through the curriculum in teaching order', () => {
  let save = createSave();
  const planning = seededRandom(541);
  const child = seededRandom(991);
  const familiar = new Set(FACT_SETS.slice(0, 9).flatMap(s => s.facts));
  const exposures = new Map<string, number>();
  const achieved = new Map<string, number>();
  const reached = new Set<string>();
  const daily: { day: number; accuracy: number; questions: number; sets: number; correct: number }[] = [];
  let earlyReviews = 0;
  let optionalPractice = 0;
  for (let day = 0; day < 30; day++) {
    let now = day * DAY_MS;
    const end = now + 10 * 60_000;
    startSession(save, now);
    let turns = 0;
    while (now + 20_000 < end) {
      const encounter = startEncounter(save, now, planning);
      while (encounter.phase !== 'complete' && now + 6000 < end) {
        const slot = currentSlot(encounter);
        const fact = save.facts[slot.factId]!;
        const previousDue = fact.dueAt;
        const previousLadder = fact.ladder;
        const wasResting = fact.stage === 'review' && !fact.provisional && fact.dueAt! > now + 4500;
        if (wasResting) {
          earlyReviews++;
          expect(slot.source === 'known' || slot.source === 'placement' || slot.source === 'retry').toBe(true);
          if (slot.source === 'known') optionalPractice++;
        }
        const attempts = exposures.get(slot.factId) ?? 0;
        // The child already knows early sets. Other facts are acquired at a fixed
        // rate per retrieval, with an occasional slip even after acquisition.
        const probability = familiar.has(slot.factId) ? 0.995 : Math.min(0.985, 0.4 + attempts * 0.55);
        const correct = child.next() < probability;
        now += 4500;
        submitAnswer(save, encounter, getFact(slot.factId).answer + (correct ? 0 : 1), now, `day-${day + 1}`, planning);
        exposures.set(slot.factId, attempts + 1);
        if (wasResting && correct) {
          expect(save.facts[slot.factId]!.dueAt).toBe(previousDue);
          expect(save.facts[slot.factId]!.ladder).toBe(previousLadder);
        }
        if (encounter.phase === 'second' || encounter.phase === 'correction') {
          now += 1500;
          submitAnswer(save, encounter, getFact(slot.factId).answer, now, `day-${day + 1}`, planning);
        }
        for (const set of FACT_SETS) if (setLevel(save, set.id) >= 2) reached.add(set.id);
        // Shared facts can make a later, smaller set accurate incidentally.
        // Teaching progress is the completed prefix, never an artificial reset.
        while (achieved.size < FACT_SETS.length && reached.has(FACT_SETS[achieved.size]!.id)) {
          achieved.set(FACT_SETS[achieved.size]!.id, day + 1);
        }
        expect(++turns).toBeLessThan(200);
      }
      now += 15_000; // Walking and reward time between encounters.
    }
    const session = currentSession(save);
    daily.push({ day: day + 1, accuracy: session.accuracy, questions: session.questions, sets: achieved.size, correct: session.firstTryCorrect });
    save = importSave(exportSave(save));
  }
  for (const day of daily.slice(2)) {
    expect(day.accuracy, `day ${day.day}`).toBeGreaterThanOrEqual(0.75);
  }
  // Daily random fluctuations and fully mastered review days cannot have a hard
  // upper bound. The 75 to 95 percent target applies across acquisition days.
  const acquisition = daily.slice(2).filter(day => day.sets < FACT_SETS.length);
  expect(acquisition.length).toBeGreaterThan(0);
  const accuracy = acquisition.reduce((sum, d) => sum + d.correct, 0) / acquisition.reduce((sum, d) => sum + d.questions, 0);
  expect(accuracy).toBeGreaterThanOrEqual(0.75);
  expect(accuracy).toBeLessThanOrEqual(0.95);
  expect([...achieved.keys()]).toEqual(FACT_SETS.map(s => s.id));
  expect(earlyReviews).toBeGreaterThan(0);
  expect(optionalPractice).toBeGreaterThan(0);
  const summary = { days: daily.length, questions: daily.reduce((n, d) => n + d.questions, 0),
    acquisitionAccuracy: accuracy, allSetsAccurateByDay: achieved.get(FACT_SETS.at(-1)!.id),
    optionalPractice, earlyReviews };
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/simulation.json', JSON.stringify({ summary, daily, teachingProgress: [...achieved] }, null, 2));
  console.info('30-day simulation:', summary);
});
