import {
  ENCOUNTER_LENGTH, LEARNING_WINDOW, PLACEMENT_CONFIRMATION_LIMIT, MAX_DUE_RATIO, MIN_KNOWN_RATIO, MIN_KNOWN_RATIO_HIGH,
  WINDOW_HIGH_ACCURACY, WINDOW_LOW_ACCURACY, WINDOW_MIN_ANSWERS,
} from './constants';
import { FACT_SETS, getFact, getSet, setsForFact } from './curriculum/sets';
import { introductionSets, openSets } from './mastery';
import { confirmationOrder, entryCheck, placementSlot, provisionalFacts, recordPlacement } from './placement';
import { shuffled } from './random';
import type { Random } from './random';
import { readyRetries } from './retries';
import { spreadSlots } from './ordering';
import { currentSession } from './sessions';
import type { Mode, Save, Slot } from './types';

export function learningWindowSize(save: Save): number {
  const session = currentSession(save);
  if (session.questions < WINDOW_MIN_ANSWERS) return LEARNING_WINDOW.normal;
  return session.accuracy < WINDOW_LOW_ACCURACY ? LEARNING_WINDOW.low
    : session.accuracy > WINDOW_HIGH_ACCURACY ? LEARNING_WINDOW.high : LEARNING_WINDOW.normal;
}
export function knownRatio(save: Save): number {
  const session = currentSession(save);
  return session.questions >= WINDOW_MIN_ANSWERS && session.accuracy >= WINDOW_HIGH_ACCURACY ? MIN_KNOWN_RATIO_HIGH : MIN_KNOWN_RATIO;
}
export function plainFirst(save: Save): boolean {
  const session = currentSession(save), previous = save.sessions.at(-2);
  return session.questions > 0 && session.accuracy >= WINDOW_LOW_ACCURACY
    || session.questions < WINDOW_MIN_ANSWERS && !!previous && previous.accuracy >= WINDOW_LOW_ACCURACY;
}
export function presentationMode(save: Save, factId: string, probe = false): Mode {
  const state = save.facts[factId]!;
  if (probe) return 'plain';
  return state.stage === 'new' ? plainFirst(save) ? 'plain' : 'modeled' : state.needsModel ? 'modeled' : 'plain';
}
/** Old lapses keep their retries, but do not occupy a new set's acquisition window. */
export function windowFacts(save: Save): string[] {
  const sets = introductionSets(save);
  return Object.values(save.facts).filter(f => f.stage === 'learning' && sets.some(s => s.facts.includes(f.id))).map(f => f.id);
}
export function isBlocked(save: Save, setId: string): boolean { return !save.practice.interleaved.includes(setId); }

/** Planning uses a copy: callers can preview without changing placement or learner state. */
export function planEncounter(save: Save, now: number, rng: Random, length: number = ENCOUNTER_LENGTH.default, reviewOnly = false): Slot[] {
  if (!Number.isInteger(length) || length < ENCOUNTER_LENGTH.min || length > ENCOUNTER_LENGTH.max) throw new Error('Encounter length must be 6 to 10');
  const copy = structuredClone(save);
  if (!reviewOnly && entryCheck(copy)) {
    const preview: Slot[] = [];
    let confirmations = 0;
    for (let i = 0; i < length; i++) {
      const next = placementSlot(copy, rng, i, confirmations, preview.at(-1)?.factId);
      if (!next) break;
      preview.push(next);
      if (next.source === 'placement') recordPlacement(copy, next.factId, true, now);
      else {
        if (copy.facts[next.factId]!.provisional) { confirmations++; copy.facts[next.factId]!.provisional = false; }
        const pending = entryCheck(copy); if (pending && pending.check.recheckGap > 0) pending.check.recheckGap--;
      }
    }
    // A final placement set can end during this preview. Ordinary practice fills it.
    if (preview.length < length) preview.push(...buildPlan(copy, now, rng, length, false).slice(0, length - preview.length));
    return preview;
  }
  return buildPlan(copy, now, rng, length, reviewOnly);
}

function buildPlan(save: Save, now: number, rng: Random, length: number, reviewOnly: boolean): Slot[] {
  const session = currentSession(save);
  const active = introductionSets(save);
  const blocked = active.find(s => isBlocked(save, s.id));
  const intro = reviewOnly ? [] : blocked ? [blocked] : active;
  const available = openSets(save);
  const defaultSet = (id: string) => available.find(s => s.facts.includes(id)) ?? setsForFact(id)[0]!;
  const slot = (factId: string, source: Slot['source'], setId = defaultSet(factId).id): Slot => ({
    factId, setId, source, mode: presentationMode(save, factId),
  });
  // Replays still respect the placement confirmation cap, without probing new sets.
  const checksRemain = FACT_SETS.some(s => s.facts.some(id => save.facts[id]!.stage === 'new'))
    || Object.values(save.practice.checks ?? {}).some(c => c.status === 'checking');
  const allowedProvisional = checksRemain ? new Set(provisionalFacts(save).slice(0, PLACEMENT_CONFIRMATION_LIMIT)) : null;
  const known = Object.values(save.facts).filter(f => f.stage === 'review'
    && (!f.provisional || !allowedProvisional || allowedProvisional.has(f.id)));
  const due = known.filter(f => f.dueAt !== null && f.dueAt <= now).sort((a, b) =>
    a.provisional && b.provisional ? confirmationOrder(a.id, b.id)
      : Number(a.provisional) - Number(b.provisional) || a.dueAt! - b.dueAt!);
  const focus = new Set(intro[0]?.facts ?? []);
  const recalled = new Set(save.practice.streaks?.[intro[0]?.id ?? ''] ?? []);
  const fillerRank = (id: string) => focus.has(id) ? recalled.has(id) ? 2 : 0 : 1;
  const resting = known.filter(f => f.dueAt === null || f.dueAt > now).sort((a, b) =>
    fillerRank(a.id) - fillerRank(b.id) || (a.lastSeenAt ?? -Infinity) - (b.lastSeenAt ?? -Infinity));
  const learning = Object.values(save.facts).filter(f => f.stage === 'learning').sort((a, b) =>
    Number(!focus.has(a.id)) - Number(!focus.has(b.id)) || Number(recalled.has(a.id)) - Number(recalled.has(b.id)) || (a.lastSeenAt ?? -Infinity) - (b.lastSeenAt ?? -Infinity));
  const newFacts = shuffled(intro.flatMap(s => s.facts.filter(id => save.facts[id]!.stage === 'new').map(id => slot(id, 'new', s.id))), rng);
  const ratio = knownRatio(save);
  const enoughKnown = known.length >= Math.ceil(length * ratio);
  const maxUnknown = enoughKnown ? length - Math.ceil(length * ratio) : length;
  const maxDue = Math.floor(length * MAX_DUE_RATIO);
  const introduced = new Set<string>();
  const used = new Set<string>();
  const result: Slot[] = [];
  let unknownCount = 0;
  let dueCount = 0;
  const windowRoom = plainFirst(save) ? length : Math.max(0, learningWindowSize(save) - windowFacts(save).length);
  const lastResponse = save.responses.at(-1);
  for (let index = 0; index < length; index++) {
    const previousId = result.at(-1)?.factId ?? lastResponse?.factId;
    const previousAnswer = previousId ? getFact(previousId).answer : null;
    const mustKnow = enoughKnown && (index === 0 || index === length - 1 || unknownCount >= maxUnknown);
    const retries = readyRetries(save, session.questions + index).filter(r => !used.has(r.factId)).map(r => slot(r.factId, 'retry'));
    const learningSlots = learning.map(f => slot(f.id, 'learning'));
    const fresh = newFacts.filter(s => introduced.has(s.factId) || introduced.size < windowRoom);
    const acquisition = unknownCount % 2 === 0 ? [...learningSlots, ...fresh] : [...fresh, ...learningSlots];
    let candidates = [
      ...retries,
      ...(dueCount < maxDue ? due.filter(f => !used.has(f.id)).map(f => slot(f.id, 'due')) : []),
      ...acquisition.filter(s => !used.has(s.factId)),
      ...resting.filter(f => !used.has(f.id)).map(f => slot(f.id, 'known')),
    ].filter(s => !mustKnow || save.facts[s.factId]!.stage === 'review');
    // Once the priority pools are exhausted, repeat only what can actually be asked.
    if (!candidates.length) candidates = [
      ...resting.map(f => slot(f.id, 'known')),
      ...(dueCount < maxDue ? due.map(f => slot(f.id, 'due')) : []),
      ...(!mustKnow ? [...learningSlots, ...fresh.filter(s => introduced.has(s.factId))] : []),
    ];
    // A fully due pool may exceed the review cap so play never deadlocks.
    if (!candidates.length) {
      const remainingDue = due.filter(f => !used.has(f.id));
      candidates = (remainingDue.length ? remainingDue : due).map(f => slot(f.id, 'due'));
    }
    if (!candidates.length) throw new Error('No practice facts available');
    const distinct = candidates.filter(s => s.factId !== previousId);
    if (distinct.length) candidates = distinct;
    const varied = candidates.filter(s => getFact(s.factId).answer !== previousAnswer);
    if (varied.length) candidates = varied;
    // An interleaved set uses its inverse and older sets through the known pool.
    const previousOperation = previousId ? getFact(previousId).operation : null;
    const needInverse = previousOperation === 'add' ? 'sub' : previousOperation === 'sub' ? 'add' : null;
    const preferredSource = candidates[0]!.source;
    if (needInverse && available.some(s => s.facts.some(id => getFact(id).operation === needInverse))) {
      const inverse = candidates.filter(s => s.source === preferredSource && getFact(s.factId).operation === needInverse);
      if (inverse.length) candidates = inverse;
    }
    const chosen = candidates[0]!;
    result.push(chosen);
    used.add(chosen.factId);
    if (save.facts[chosen.factId]!.stage !== 'review') unknownCount++;
    if (chosen.source === 'due') dueCount++;
    if (chosen.source === 'new') introduced.add(chosen.factId);
  }
  return spreadSlots(save, result);
}

/** Identify whether a planned question carries the inverse of its set. */
export function inverseSet(setId: string): string | null { return getSet(setId).inverse; }
