import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import {
  currentSession, currentSlot, DAY_MS, getFact, getSet, learningWindowSize, logResponse, newFactState,
  planEncounter, readyRetries, placementProbes, recordPlacement, seededRandom, startEncounter, submitAnswer,
} from '../../src/core';
import { fixture, masterSet } from './helpers';

describe('integration regressions', () => {
  it('keeps all planned slots even when quick reviews would otherwise skip learning', () => {
    const save = fixture(); masterSet(save, 'see-dots'); const rng = seededRandom(42);
    for (const id of getSet('see-dots').facts.slice(0, 6)) save.facts[id]!.dueAt = 0;
    const encounter = startEncounter(save, 0, rng);
    let newAnswers = 0;
    while (encounter.phase !== 'complete') {
      const slot = currentSlot(encounter);
      newAnswers += Number(save.facts[slot.factId]!.stage === 'new');
      submitAnswer(save, encounter, getFact(slot.factId).answer, encounter.shownAt + 1000, '2026-11-12', rng);
      expect(encounter.answered).toBeLessThanOrEqual(8);
    }
    expect(encounter.answered).toBe(8); expect(newAnswers).toBeGreaterThan(0);
    expect(encounter.meter).toBe(0);
  });
  it('delivers a newly lapsed review after two intervening questions even when the planned slot was known', () => {
    const save = fixture(); masterSet(save, 'see-dots'); const rng = seededRandom(7);
    const encounter = startEncounter(save, 0, rng);
    const missed = currentSlot(encounter).factId;
    submitAnswer(save, encounter, 99, 1000, '2026-11-12', rng);
    submitAnswer(save, encounter, getFact(missed).answer, 2000, '2026-11-12', rng);
    const others: string[] = [];
    for (let i = 0; i < 2; i++) {
      const id = currentSlot(encounter).factId;
      others.push(id);
      submitAnswer(save, encounter, getFact(id).answer, encounter.shownAt + 1000, '2026-11-12', rng);
    }
    expect(others).not.toContain(missed);
    expect(currentSlot(encounter).factId).toBe(missed);
    expect(currentSlot(encounter).mode).toBe('modeled');
    expect(currentSlot(encounter).source).toBe('retry');
  });
  it('prioritises ready retries in planning without introducing extra learning-window facts', () => {
    const save = fixture(); masterSet(save, 'see-dots');
    const id = 'frame:0';
    save.facts[id] = { ...newFactState(id), stage: 'learning', seen: 1 };
    currentSession(save).retries.push({ factId: id, step: 0, afterQuestion: 0, afterEncounter: 0 });
    const plan = planEncounter(save, 0, seededRandom(2));
    expect(plan.find(s => s.source === 'retry')?.factId).toBe(id);
    expect(new Set(plan.filter(s => s.source === 'new').map(s => s.factId)).size).toBeLessThanOrEqual(learningWindowSize(save) - 1);
  });
  it('rechecks the window when a miss fills it after planning', () => {
    const save = fixture(); masterSet(save, 'see-dots'); const rng = seededRandom(4);
    const encounter = startEncounter(save, 0, rng);
    for (const id of getSet('see-frame').facts.slice(0, 3)) save.facts[id]!.stage = 'learning';
    for (let i = 0; encounter.phase !== 'complete' && i < 12; i++) {
      const slot = currentSlot(encounter);
      submitAnswer(save, encounter, getFact(slot.factId).answer, encounter.shownAt + 1000, '2026-11-12', rng);
      if (encounter.meter > 0 && save.facts[currentSlot(encounter).factId]!.stage === 'new') expect(currentSlot(encounter).mode).toBe('plain');
    }
  });
  it('clears placement retries when a set was already known', () => {
    const save = fixture();
    delete save.practice.checks;
    const probes = placementProbes(save, seededRandom(1));
    currentSession(save).retries.push({ factId: probes[0]!, step: 0, afterQuestion: 0, afterEncounter: 0 });
    for (const id of probes) recordPlacement(save, id, true, 0);
    expect(currentSession(save).retries).toEqual([]);
    expect(save.practice.placement.setIndex).toBe(1);
    expect(currentSession(save).enteredReview).toEqual(probes);
    expect(save.facts[getSet('see-dots').facts[2]!]!.provisional).toBe(true);
  });
  it('caps response history at 2000 while preserving complete session totals and unique achievements', () => {
    const save = fixture();
    for (let i = 0; i < 2005; i++) logResponse(save, { factId: 'dots:1:dice', time: i,
      correct: true, firstTryCorrect: true, neededHelp: false, latency: 1000, mode: 'plain', score: 1,
      encounterId: 'a', setId: 'see-dots' }, true, true);
    expect(save.responses).toHaveLength(2000); expect(save.responses[0]!.time).toBe(5);
    expect(currentSession(save)).toMatchObject({ questions: 2005, firstTryCorrect: 2005, accuracy: 1,
      enteredReview: ['dots:1:dice'], becameFluent: ['dots:1:dice'] });
    expect(save.practice.setHistory['see-dots']).toHaveLength(10);
  });
  it('never lets optional practice advance a review ladder before its due time', () => {
    const save = fixture(); masterSet(save, 'see-dots'); const rng = seededRandom(4);
    const encounter = startEncounter(save, 0, rng);
    const id = currentSlot(encounter).factId;
    submitAnswer(save, encounter, getFact(id).answer, 1000, '2026-11-12', rng);
    expect(save.facts[id]).toMatchObject({ dueAt: DAY_MS, ladder: 0 });
    expect(readyRetries(save).filter(r => r.factId === id)).toEqual([]);
  });
});

it('keeps every core module independent of Phaser, browser globals and wall-clock randomness', () => {
  function check(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) check(path);
      else if (path.endsWith('.ts')) {
        const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { removeComments: true } }).outputText;
        expect(source, path).not.toMatch(/\b(?:Date|Math\.random|window|document|localStorage|indexedDB)\s*[.(]|from\s+['"]phaser/);
      }
    }
  }
  check('src/core');
});
