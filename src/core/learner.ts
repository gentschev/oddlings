import {
  ACQUISITION_ENCOUNTERS, ACQUISITION_STREAK, DAY_MS, DEFAULT_TAP_BASELINE,
  FAST_BOUNDS, FLUENT_DAYS, LAPSE_STEPS, LATENCY_HISTORY_SIZE, MAX_LATENCY_MS,
  RECALL_ALLOWANCE, REVIEW_INTERVALS_DAYS, STRENGTH_ALPHA, TAP_HISTORY_SIZE,
} from './constants';
import type { AnswerEvidence, FactState } from './types';

export function newFactState(id: string): FactState {
  return { id, stage: 'new', seen: 0, firstTryCorrect: 0, strength: 0, streak: 0,
    ladder: 0, dueAt: null, lastSeenAt: null, latencies: [], fastDays: [], lapses: 0,
    provisional: false, streakEncounters: [], needsModel: true };
}
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length ? (sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2) : DEFAULT_TAP_BASELINE;
}
export function calibrate(taps: readonly number[], next: number) {
  if (!Number.isFinite(next) || next < 0) throw new Error('Invalid tap latency');
  const history = [...taps, next].slice(-TAP_HISTORY_SIZE);
  return { history, baseline: median(history) };
}
export function fastThreshold(tapBaseline: number): number {
  return Math.max(FAST_BOUNDS[0], Math.min(FAST_BOUNDS[1], tapBaseline + RECALL_ALLOWANCE));
}
export function isFluent(fact: FactState): boolean {
  return fact.stage === 'review' && fact.fastDays.length >= FLUENT_DAYS;
}
export function applyAnswer(previous: FactState, evidence: AnswerEvidence, tapBaseline: number) {
  const fact = structuredClone(previous);
  const firstTryCorrect = evidence.correct && !evidence.hintUsed;
  const validLatency = !evidence.hidden && evidence.latency >= 0 && evidence.latency <= MAX_LATENCY_MS && Number.isFinite(evidence.latency);
  const fast = firstTryCorrect && validLatency && evidence.latency <= fastThreshold(tapBaseline);
  const score = firstTryCorrect ? (fast ? 1 : 0.5) : 0;
  const wasFluent = isFluent(fact);
  fact.seen++;
  fact.firstTryCorrect += Number(firstTryCorrect);
  fact.strength += STRENGTH_ALPHA * (score - fact.strength);
  fact.lastSeenAt = evidence.now;
  fact.needsModel = !firstTryCorrect;
  if (firstTryCorrect && validLatency) fact.latencies = [...fact.latencies, evidence.latency].slice(-LATENCY_HISTORY_SIZE);
  if (fast && !fact.fastDays.includes(evidence.localDate)) fact.fastDays = [...fact.fastDays, evidence.localDate].slice(-FLUENT_DAYS);
  let enteredReview = false;
  if (fact.stage === 'review') {
    if (!firstTryCorrect) {
      fact.stage = 'learning';
      fact.provisional = false;
      fact.streak = 0;
      fact.streakEncounters = [];
      fact.dueAt = null;
      fact.lapses++;
    } else {
      if (fact.provisional) { fact.provisional = false; enteredReview = true; }
      if (fact.dueAt !== null && evidence.now >= fact.dueAt) {
        fact.ladder = Math.min(fact.ladder + 1, REVIEW_INTERVALS_DAYS.length - 1);
        fact.dueAt = evidence.now + REVIEW_INTERVALS_DAYS[fact.ladder]! * DAY_MS;
      }
    }
  } else if (previous.stage === 'new' && evidence.mode === 'plain' && fast) {
    fact.stage = 'review'; fact.provisional = false; fact.ladder = 0;
    fact.dueAt = evidence.now + REVIEW_INTERVALS_DAYS[0] * DAY_MS;
    enteredReview = true;
  } else {
    fact.stage = 'learning';
    fact.streak = firstTryCorrect ? fact.streak + 1 : 0;
    fact.streakEncounters = firstTryCorrect
      ? [...new Set([...fact.streakEncounters, evidence.encounterId])].slice(-ACQUISITION_ENCOUNTERS) : [];
    if (fact.streak >= ACQUISITION_STREAK && fact.streakEncounters.length >= ACQUISITION_ENCOUNTERS) {
      fact.stage = 'review';
      fact.ladder = fact.lapses ? Math.max(0, fact.ladder - LAPSE_STEPS) : 0;
      fact.dueAt = evidence.now + REVIEW_INTERVALS_DAYS[fact.ladder]! * DAY_MS;
      fact.provisional = false;
      enteredReview = true;
    }
  }
  return { fact, firstTryCorrect, fast, score: score as 0 | 0.5 | 1, enteredReview, becameFluent: !wasFluent && isFluent(fact) };
}
