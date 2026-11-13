import { AUTO_MODEL_MS, ENCOUNTER_LENGTH, HINT_PULSE_MS, MUDDLE_MOVE } from './constants';
import { explanationForFact, getFact, setsForFact } from './curriculum/sets';
import { applyAnswer } from './learner';
import { learningWindowSize, planEncounter, presentationMode, windowFacts } from './planner';
import { placementProbes, placementSlot, recordPlacement, recordSetStreak, tickEntryGap } from './placement';
import type { Random } from './random';
import { consumeRetry, readyRetries, scheduleRetry } from './retries';
import { currentSession, logResponse } from './sessions';
import type { Save, Slot } from './types';

export interface Encounter {
  id: string;
  phase: 'question' | 'correction' | 'complete';
  slots: Slot[];
  index: number;
  meter: number;
  initialMeter: number;
  shownAt: number;
  hintUsed: boolean;
  hidden: boolean;
  modelVisible: boolean;
  hintPulsing: boolean;
  answered: number;
  unknownAnswered: number;
  reviewOnly: boolean;
  placementConfirmations: number;
}
export function startEncounter(save: Save, now: number, rng: Random, length: number = ENCOUNTER_LENGTH.default, reviewOnly = false): Encounter {
  const session = currentSession(save);
  // Before any fact is seen there is nothing to replay. A fresh profile uses placement.
  reviewOnly = reviewOnly && Object.values(save.facts).some(f => f.stage !== 'new');
  if (!reviewOnly) placementProbes(save, rng);
  session.encounters++;
  const slots = planEncounter(save, now, rng, length, reviewOnly);
  const encounter: Encounter = { id: `${session.id}/encounter-${session.encounters}`,
    phase: 'question', slots, index: 0, meter: length, initialMeter: length,
    shownAt: now, hintUsed: false, hidden: false, modelVisible: false, hintPulsing: false,
    answered: 0, unknownAnswered: 0, reviewOnly, placementConfirmations: 0 };
  showQuestion(save, encounter, now);
  return encounter;
}
export function currentSlot(encounter: Encounter): Slot { return encounter.slots[encounter.index]!; }
export function revealHint(encounter: Encounter): void {
  if (encounter.phase !== 'question') return;
  encounter.hintUsed = true;
  encounter.modelVisible = true;
}
export function advanceEncounterTime(encounter: Encounter, now: number): void {
  if (encounter.phase !== 'question') return;
  const elapsed = now - encounter.shownAt;
  encounter.hintPulsing = elapsed >= HINT_PULSE_MS && !encounter.modelVisible;
  if (elapsed >= AUTO_MODEL_MS && !encounter.modelVisible) revealHint(encounter);
}
export function markEncounterHidden(encounter: Encounter): void { encounter.hidden = true; }

function showQuestion(save: Save, encounter: Encounter, now: number): void {
  let slot = currentSlot(encounter);
  // A miss can fill the teaching window after planning. Modeled introductions
  // respect that window; independent checks use the plain-first policy.
  const learning = windowFacts(save).map(id => save.facts[id]!);
  if (slot.source !== 'placement' && save.facts[slot.factId]!.stage === 'new' && presentationMode(save, slot.factId) === 'modeled' && learning.length >= learningWindowSize(save)) {
    const previous = encounter.slots[encounter.index - 1]?.factId;
    const replacement = learning.filter(f => f.id !== previous).sort((a, b) => (a.lastSeenAt ?? -Infinity) - (b.lastSeenAt ?? -Infinity))[0]
      ?? Object.values(save.facts).find(f => f.stage === 'review' && f.id !== previous);
    if (replacement) {
      slot = { factId: replacement.id, setId: setsForFact(replacement.id)[0]!.id,
        mode: 'plain', source: replacement.stage === 'review' ? 'known' : 'learning' };
      encounter.slots[encounter.index] = slot;
    }
  }
  const state = save.facts[slot.factId]!;
  if (slot.source !== 'placement' && slot.source !== 'retry' && state.stage === 'review' && state.dueAt !== null && state.dueAt > now) slot.source = 'known';
  if (slot.source === 'new' && state.stage !== 'new') slot.source = state.stage === 'review' ? 'known' : 'learning';
  slot.mode = presentationMode(save, slot.factId, slot.source === 'placement');
  encounter.shownAt = now;
  encounter.hintUsed = false;
  encounter.hidden = false;
  encounter.modelVisible = slot.mode === 'modeled';
  encounter.hintPulsing = false;
}
function nextQuestion(save: Save, encounter: Encounter, now: number, rng: Random): void {
  if (encounter.meter <= 0) { encounter.phase = 'complete'; return; }
  const previous = currentSlot(encounter).factId;
  encounter.index++;
  if (encounter.index >= encounter.slots.length) {
    // Errors never end play. Continue until the child clears every puff.
    if (!encounter.reviewOnly) placementProbes(save, rng);
    encounter.slots.push(...planEncounter(save, now, rng, ENCOUNTER_LENGTH.default, encounter.reviewOnly));
  }
  const livePlacement = !encounter.reviewOnly && placementSlot(save, rng, encounter.answered, encounter.placementConfirmations);
  if (livePlacement) encounter.slots[encounter.index] = livePlacement;
  else if (currentSlot(encounter).source === 'placement') {
    // A miss has stopped placement. Discard the optimistic preview of later probes.
    encounter.slots.splice(encounter.index, encounter.slots.length - encounter.index,
      ...planEncounter(save, now, rng, ENCOUNTER_LENGTH.default, encounter.reviewOnly));
  }
  // A live correction takes priority over the preview's known-fact quota.
  const retry = readyRetries(save).find(r => r.factId !== previous);
  if (retry) {
    const template = encounter.slots.find(s => s.factId === retry.factId) ?? {
      factId: retry.factId, setId: setsForFact(retry.factId)[0]!.id, mode: 'plain' as const,
    };
    const displaced = currentSlot(encounter);
    if (displaced.factId !== retry.factId && save.facts[displaced.factId]!.stage !== 'review') {
      // Keep planned learning when a live retry takes its slot. Move it into filler.
      const filler = encounter.slots.findIndex((s, i) => i > encounter.index && s.source !== 'placement'
        && s.source !== 'retry' && save.facts[s.factId]!.stage === 'review');
      if (filler >= 0) encounter.slots[filler] = displaced;
    }
    encounter.slots[encounter.index] = { ...template, source: 'retry' };
  }
  // A late insertion must not produce a duplicate on the following slot.
  if (currentSlot(encounter).factId === previous) {
    const replacement = encounter.slots.findIndex((s, i) => i > encounter.index && s.factId !== previous);
    if (replacement >= 0) [encounter.slots[encounter.index], encounter.slots[replacement]] = [encounter.slots[replacement]!, currentSlot(encounter)];
  }
  encounter.phase = 'question';
  showQuestion(save, encounter, now);
}

/** The correction tap is acknowledgement, never another scored response. */
export function submitAnswer(save: Save, encounter: Encounter, answer: number, now: number, localDate: string, rng: Random) {
  if (encounter.phase === 'complete') return { accepted: false, correction: false, fast: false };
  const slot = currentSlot(encounter);
  const fact = getFact(slot.factId);
  if (encounter.phase === 'correction') {
    if (answer !== fact.answer) return { accepted: false, correction: true, fast: false };
    nextQuestion(save, encounter, now, rng);
    return { accepted: true, correction: true, fast: false };
  }
  advanceEncounterTime(encounter, now);
  const previous = save.facts[fact.id]!;
  if (previous.provisional && slot.source !== 'placement') encounter.placementConfirmations++;
  const wasNew = previous.stage === 'new';
  encounter.unknownAnswered += Number(previous.stage !== 'review');
  const result = applyAnswer(previous, { now, localDate, encounterId: encounter.id,
    correct: answer === fact.answer, hintUsed: encounter.hintUsed,
    latency: now - encounter.shownAt, hidden: encounter.hidden, mode: slot.mode }, save.profile.tapBaseline);
  consumeRetry(save, fact.id);
  save.facts[fact.id] = result.fact;
  logResponse(save, { factId: fact.id, time: now, correct: answer === fact.answer,
    firstTryCorrect: result.firstTryCorrect, neededHelp: encounter.hintUsed,
    latency: !encounter.hidden && now - encounter.shownAt <= AUTO_MODEL_MS ? now - encounter.shownAt : null,
    mode: slot.mode, score: result.score, encounterId: encounter.id, setId: slot.setId }, result.enteredReview, result.becameFluent);
  if ((wasNew && !result.enteredReview) || !result.firstTryCorrect) scheduleRetry(save, fact.id);
  if (result.fact.stage === 'review' && !result.fact.provisional) currentSession(save).retries = currentSession(save).retries.filter(r => r.factId !== fact.id);
  if (slot.source !== 'placement') tickEntryGap(save);
  if (slot.source === 'placement') recordPlacement(save, fact.id, result.firstTryCorrect && slot.mode === 'plain', now);
  recordSetStreak(save, save.responses.at(-1)!);
  encounter.answered++;
  if (answer !== fact.answer) {
    encounter.phase = 'correction';
    encounter.modelVisible = true;
  } else {
    // Keep the final puff until every planned question has had a turn. Otherwise
    // fast reviews can clear the encounter before any learning slot is reached.
    const floor = encounter.index < encounter.initialMeter - 1 ? 1 : 0;
    encounter.meter = Math.max(floor, encounter.meter - (result.fast ? MUDDLE_MOVE.fast : MUDDLE_MOVE.correct));
    nextQuestion(save, encounter, now, rng);
  }
  return { accepted: true, correction: false, fast: result.fast };
}
export function encounterSnapshot(encounter: Encounter) {
  const slot = currentSlot(encounter);
  return { scene: 'encounter', phase: encounter.phase, question: getFact(slot.factId),
    correctAnswer: getFact(slot.factId).answer, meter: encounter.meter,
    onScreen: { mode: slot.mode, modelVisible: encounter.modelVisible, hintPulsing: encounter.hintPulsing,
      correctionAnswer: encounter.phase === 'correction' ? getFact(slot.factId).answer : null,
      workedExample: encounter.modelVisible ? explanationForFact(slot.factId, slot.setId) : null } };
}
