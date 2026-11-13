import { DAY_MS, PLACEMENT_RECHECK_GAP, PLACEMENT_MISS_LIMIT, PLACEMENT_CONFIRMATION_LIMIT, PLACEMENT_CONFIRMATION_GAP, PLACEMENT_PROBES, REVIEW_INTERVALS_DAYS, SET_STREAK_PASS } from './constants';
import { FACT_SETS, getFact, getSet, setsForFact } from './curriculum/sets';
import { introductionSets, setPassed } from './mastery';
import { currentSession } from './sessions';
import type { Random } from './random';
import type { Response, Save, SetCheck, Slot } from './types';

/** Largest quantities first, then the larger parts. Stable ids break equal-number ties. */
export function hardestFirst(left: string, right: string): number {
  const a = getFact(left), b = getFact(right);
  return Math.max(b.a, b.b, b.answer) - Math.max(a.a, a.b, a.answer)
    || b.a + b.b - a.a - a.b || b.answer - a.answer || b.a - a.a
    || (left < right ? -1 : left > right ? 1 : 0);
}
const TEACHING_RANK = new Map<string, number>();
FACT_SETS.forEach((set, index) => { for (const id of set.facts) if (!TEACHING_RANK.has(id)) TEACHING_RANK.set(id, index); });
export function confirmationOrder(left: string, right: string): number {
  return TEACHING_RANK.get(left)! - TEACHING_RANK.get(right)! || hardestFirst(left, right);
}
export function provisionalFacts(save: Save): string[] {
  return Object.values(save.facts).filter(f => f.provisional).map(f => f.id).sort(confirmationOrder);
}
/** Retain a pending old check, but never let its stopped flag disable later sets. */
function checks(save: Save): Record<string, SetCheck> {
  if (save.practice.checks) return save.practice.checks;
  const result: Record<string, SetCheck> = {};
  const old = save.practice.placement, set = FACT_SETS[old.setIndex];
  if (set && old.results.length) {
    const misses = old.results.filter(r => !r).length;
    const attempted = old.probes.slice(0, old.results.length);
    const pending = [...set.facts].sort(hardestFirst).filter(id => !attempted.includes(id));
    result[set.id] = { status: misses >= PLACEMENT_MISS_LIMIT ? 'learning' : 'checking',
      probes: [...attempted, ...pending.slice(0, Math.max(1, PLACEMENT_PROBES - old.results.filter(Boolean).length))],
      results: [...old.results], recheckGap: old.recheckGap ?? (misses ? PLACEMENT_RECHECK_GAP : 0) };
  }
  save.practice.checks = result;
  return result;
}
export function entryCheck(save: Save): { setId: string; check: SetCheck } | undefined {
  const records = checks(save), set = introductionSets(save)[0];
  if (!set) { save.practice.placement.active = false; return; }
  let check = records[set.id];
  if (!check && !save.responses.some(r => r.setId === set.id)
    && set.facts.some(id => save.facts[id]!.stage === 'new')) {
    check = records[set.id] = { status: 'checking', probes: [...set.facts].sort(hardestFirst).slice(0, PLACEMENT_PROBES), results: [], recheckGap: 0 };
  }
  // This legacy summary remains readable by older tools and the parent area.
  save.practice.placement = { active: check?.status === 'checking', setIndex: FACT_SETS.indexOf(set),
    probes: check?.probes ?? [], results: check?.results ?? [], recheckGap: check?.recheckGap ?? 0 };
  return check?.status === 'checking' ? { setId: set.id, check } : undefined;
}
export function placementProbes(save: Save, _rng: Random): string[] {
  void _rng;
  const pending = entryCheck(save);
  return pending?.check.probes.slice(pending.check.results.length) ?? [];
}
export function placementSlot(save: Save, rng: Random, answered: number, confirmations: number, previousId = save.responses.at(-1)?.factId): Slot | undefined {
  const probes = placementProbes(save, rng), pending = entryCheck(save);
  if (!probes.length || !pending) return;
  const { check, setId } = pending, set = getSet(setId);
  if (check.recheckGap > 0) {
    const waiting = currentSession(save).retries.map(r => r.factId);
    const eligible = (id: string) => id !== previousId && !check.probes.includes(id) && !waiting.includes(id);
    let pool = [...set.facts].sort(hardestFirst).filter(eligible);
    if (!pool.length) pool = Object.values(save.facts).filter(f => f.stage === 'review' && !f.provisional && eligible(f.id)).map(f => f.id);
    if (!pool.length) return;
    const previousAnswer = previousId ? getFact(previousId).answer : null;
    const factId = pool.find(id => getFact(id).answer !== previousAnswer) ?? pool[0]!;
    const state = save.facts[factId]!;
    return { factId, setId: set.facts.includes(factId) ? setId : setsForFact(factId)[0]!.id,
      source: state.stage === 'review' ? 'known' : state.stage === 'new' ? 'new' : 'learning',
      mode: state.stage === 'new' || !state.needsModel ? 'plain' : 'modeled' };
  }
  if (answered % PLACEMENT_CONFIRMATION_GAP === PLACEMENT_CONFIRMATION_GAP - 1 && confirmations < PLACEMENT_CONFIRMATION_LIMIT) {
    const provisional = provisionalFacts(save).find(id => id !== previousId);
    if (provisional) return { factId: provisional, setId: setsForFact(provisional)[0]!.id, source: 'due', mode: 'plain' };
  }
  return { factId: probes[0]!, setId, source: 'placement', mode: 'plain' };
}
/** Provisionally skip only unseen material. Confirmed shared facts keep their ladders. */
function skipNew(save: Save, setId: string, now: number): void {
  for (const id of getSet(setId).facts) {
    const fact = save.facts[id]!;
    if (fact.stage !== 'new') continue;
    Object.assign(fact, { stage: 'review', provisional: true, needsModel: false, ladder: 0, dueAt: now });
  }
}
export function recordPlacement(save: Save, factId: string, correct: boolean, now: number): void {
  const pending = entryCheck(save);
  if (!pending || pending.check.probes[pending.check.results.length] !== factId) return;
  const { check, setId } = pending;
  check.results.push(correct);
  if (check.results.filter(r => !r).length >= PLACEMENT_MISS_LIMIT) check.status = 'learning';
  else if (check.results.filter(Boolean).length >= PLACEMENT_PROBES || check.results.includes(false) && correct) {
    const session = currentSession(save);
    for (const [i, id] of check.probes.entries()) {
      if (!check.results[i]) continue;
      const state = save.facts[id]!;
      if (state.stage === 'review' && !state.provisional || state.stage === 'learning' && state.seen > state.firstTryCorrect) continue;
      Object.assign(state, { stage: 'review', provisional: false, needsModel: false, streak: 0,
        streakEncounters: [], ladder: 0, dueAt: now + REVIEW_INTERVALS_DAYS[0] * DAY_MS });
      if (!session.enteredReview.includes(id)) session.enteredReview.push(id);
    }
    skipNew(save, setId, now);
    check.status = 'passed';
    session.retries = session.retries.filter(r => save.facts[r.factId]!.stage !== 'review');
  } else {
    if (!correct) check.recheckGap = PLACEMENT_RECHECK_GAP;
    if (check.probes.length === check.results.length) {
      const next = [...getSet(setId).facts].sort(hardestFirst).find(id => !check.probes.includes(id));
      if (next) check.probes.push(next);
    }
  }
  entryCheck(save);
}
export function tickEntryGap(save: Save): void {
  for (const check of Object.values(checks(save))) if (check.status === 'checking' && check.recheckGap > 0) check.recheckGap--;
}
/** Other sets may interleave; only showings of this set affect its independent-recall streak. */
export function recordSetStreak(save: Save, response: Response): void {
  const streaks = save.practice.streaks ??= {};
  for (const set of introductionSets(save)) {
    if (!set.facts.includes(response.factId)) continue;
    const qualified = response.firstTryCorrect && !response.neededHelp && response.mode === 'plain';
    const streak = qualified ? [...new Set([...(streaks[set.id] ?? []), response.factId])].slice(-SET_STREAK_PASS) : [];
    streaks[set.id] = streak;
    if (streak.length === SET_STREAK_PASS && new Set(streak).size === SET_STREAK_PASS) {
      skipNew(save, set.id, response.time);
      const check = checks(save)[set.id];
      if (check && setPassed(save, set.id)) check.status = 'passed';
    }
  }
}
