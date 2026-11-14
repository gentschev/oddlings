import { describe, expect, it } from 'vitest';
import { advanceEncounterTime, createSave, currentSlot, currentStop, deferPathCompletion, disabledAnswers,
  exportSave, finishEncounterPath, getArea, getFact, getSet, importSave, markHelped, markIntroductionSeen,
  palIntroduction, pathStops, pauseEncounter, resumeEncounter, revealHint, seeStory, seededRandom,
  setPassed, startEncounter, startSession, stopIntroduction, submitAnswer, syncPath, walkGate } from '../../src/core';
import { fixture, masterThrough } from './helpers';

function question() {
  const save = fixture(); masterThrough(save, 'add-plus1');
  const rng = seededRandom(7), encounter = startEncounter(save, 0, rng);
  encounter.slots[0] = { factId: 'add:5+0', setId: 'add-plus0', source: 'known', mode: 'plain' };
  encounter.modelVisible = false;
  const tap = (answer: number, now: number) => submitAnswer(save, encounter, answer, now, 'day', rng);
  return { save, encounter, tap };
}

describe('leave check pauses', () => {
  it('freezes input and hints, resumes the same question, and excludes the panel time from hint clocks', () => {
    const { save, encounter, tap } = question();
    advanceEncounterTime(encounter, 7000); pauseEncounter(encounter, 7000); pauseEncounter(encounter, 9000);
    const saved = structuredClone(save), slot = structuredClone(currentSlot(encounter));
    advanceEncounterTime(encounter, 60000); revealHint(encounter);
    expect(tap(5, 60000).accepted).toBe(false);
    expect(encounter).toMatchObject({ modelVisible: false, hintPulsing: false, hidden: true, answered: 0, meter: 8 });
    expect(save).toEqual(saved);
    resumeEncounter(encounter, 60000); resumeEncounter(encounter, 60001);
    expect(currentSlot(encounter)).toEqual(slot); expect(encounter.phase).toBe('question');
    advanceEncounterTime(encounter, 60999); expect(encounter.hintPulsing).toBe(false);
    advanceEncounterTime(encounter, 61000); expect(encounter.hintPulsing).toBe(true);
    advanceEncounterTime(encounter, 72999); expect(encounter.modelVisible).toBe(false);
    advanceEncounterTime(encounter, 73000); expect(encounter.modelVisible).toBe(true);
  });
  it.each([true, false])('keeps correctness after returning but not speed, with correct=%s', correct => {
    const { save, encounter, tap } = question();
    pauseEncounter(encounter, 100); resumeEncounter(encounter, 60100);
    const result = tap(correct ? 5 : 6, 60200);
    expect(result.fast).toBe(false); expect(save.responses).toHaveLength(1);
    expect(save.responses[0]).toMatchObject({ correct, firstTryCorrect: correct, latency: null, score: correct ? 0.5 : 0 });
  });
  it.each(['second', 'correction'] as const)('preserves %s phase, model and first-try evidence across the panel', phase => {
    const { save, encounter, tap } = question();
    tap(6, 1000); if (phase === 'correction') tap(7, 1500);
    const evidence = structuredClone(save), blocked = disabledAnswers(encounter), shownAt = encounter.shownAt;
    pauseEncounter(encounter, 2000); advanceEncounterTime(encounter, 50000);
    expect(tap(5, 50000).accepted).toBe(false); resumeEncounter(encounter, 51000);
    expect(encounter).toMatchObject({ phase, modelVisible: true, shownAt, hintUsed: false, hidden: false });
    expect(disabledAnswers(encounter)).toEqual(blocked); expect(save).toEqual(evidence);
    tap(5, 52000); expect(save).toEqual(evidence); expect(encounter.answered).toBe(1);
  });
});

describe('dropped rounds', () => {
  it('keeps answers and passed sets, holds the marker and awards the stop and pal at the next finished round', () => {
    const save = createSave(); save.team.partner = 'tenny'; save.team.friends = ['tenny']; startSession(save, 0);
    const welcome = getArea(1).stops[0]!; if (welcome.type !== 'story') throw Error('Expected story');
    seeStory(save, welcome, 0); save.map.position = 'pp-see-dots';
    const rng = seededRandom(4), encounter = startEncounter(save, 0, rng);
    for (let i = 0; i < 2; i++) submitAnswer(save, encounter, getFact(currentSlot(encounter).factId).answer, 1000 + i * 1200, 'day', rng);
    expect(encounter.phase).toBe('question'); expect(encounter.meter).toBeGreaterThan(0); expect(setPassed(save, 'see-dots')).toBe(true);
    const evidence = structuredClone({ facts: save.facts, practice: save.practice, responses: save.responses, sessions: save.sessions });
    deferPathCompletion(save); syncPath(save, 3000);
    expect({ facts: save.facts, practice: save.practice, responses: save.responses, sessions: save.sessions }).toEqual(evidence);
    expect(save.responses).toHaveLength(2); expect(save.team.friends).toEqual(['tenny']); expect(save.team.helped).toEqual([]);
    expect(save.map.position).toBe('pp-see-dots'); expect(currentStop(save)?.id).toBe('pp-see-dots');
    expect(pathStops(save, 3000)[1]).toMatchObject({ state: 'current', completed: false, progress: 1 });
    // A reload or a story sync must not silently spend the deferred completion.
    const loaded = importSave(exportSave(save)); syncPath(loaded, 5000);
    expect(currentStop(loaded)?.id).toBe('pp-see-dots'); expect(loaded.team.friends).toEqual(['tenny']);
    const change = finishEncounterPath(loaded, 6000);
    expect(change.completed).toContain('pp-see-dots'); expect(change.joined).toEqual(['bix']);
    expect(change.before[1]).toMatchObject({ state: 'current', completed: false });
    expect(change.after[1]).toMatchObject({ state: 'complete', completed: true });
    expect(loaded.map.position).toBe('pp-see-dots'); expect(loaded.map.deferredStops).toBeUndefined();
    expect(finishEncounterPath(loaded, 6001).joined).toEqual([]);
  });
  it('keeps the next round empty and never records the unanswered question on a drop', () => {
    const { save, encounter, tap } = question(); tap(5, 1000);
    const evidence = structuredClone({ facts: save.facts, responses: save.responses, practice: save.practice });
    deferPathCompletion(save);
    expect({ facts: save.facts, responses: save.responses, practice: save.practice }).toEqual(evidence);
    const next = startEncounter(save, 2000, seededRandom(8));
    expect(next).toMatchObject({ meter: 8, initialMeter: 8, answered: 0, index: 0 });
    expect(encounter.answered).toBe(1); expect(save.responses).toHaveLength(1);
  });
  it('rechecks mastery before applying deferred completions and scopes them to the finished area', () => {
    const save = createSave(); walkGate(save, 1);
    for (const set of ['see-dots', 'add-doubles-small']) for (const id of getSet(set).facts) save.facts[id]!.stage = 'review';
    deferPathCompletion(save, 1); deferPathCompletion(save, 2);
    expect(finishEncounterPath(save, 0, 2).completed).toContain('tf-add-doubles-small');
    expect(save.map.deferredStops).toEqual(['pp-see-dots']);
    for (const id of getSet('see-dots').facts) save.facts[id]!.stage = 'learning';
    expect(finishEncounterPath(save, 0, 1).completed).not.toContain('pp-see-dots');
  });
  it('validates optional deferred ids and reads saves written before the field existed', () => {
    const save = createSave(); expect(importSave(exportSave(save))).toEqual(save);
    for (const deferredStops of [['bad'], ['pp-welcome'], ['pp-see-dots', 'pp-see-dots'], [1]])
      expect(() => importSave(JSON.stringify({ ...save, map: { ...save.map, deferredStops } }))).toThrow();
  });
  it.each([false, true])('remembers a shown introduction across a drop, with earlier help=%s', helped => {
    const save = createSave(); if (helped) markHelped(save, 'bix');
    expect(palIntroduction(save, 'bix')).toBe(helped ? 'again' : 'first');
    markIntroductionSeen(save, 'bix'); markIntroductionSeen(save, 'bix'); deferPathCompletion(save);
    expect(save.map.encounteredPals).toEqual(['bix']);
    const loaded = importSave(exportSave(save));
    expect(palIntroduction(loaded, 'bix')).toBe('none');
    const stop = getArea(1).stops[1]!; if (stop.type !== 'skill') throw Error('Expected skill');
    expect(stopIntroduction(loaded, stop, 0)).toBe('none');
    expect(loaded.team.helped).toEqual(helped ? ['bix'] : []);
    markHelped(loaded, 'bix'); expect(palIntroduction(loaded, 'bix')).toBe('again');
  });
});
