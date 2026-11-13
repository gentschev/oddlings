import { ACQUISITION_ENCOUNTERS, DEFAULT_TAP_BASELINE, FLUENT_DAYS, LATENCY_HISTORY_SIZE, MAX_LATENCY_MS, RESPONSE_LOG_LIMIT, REVIEW_INTERVALS_DAYS, SAVE_VERSION, SET_STREAK_PASS, TAP_HISTORY_SIZE } from './constants';
import { FACTS, FACT_SETS, getFact, getSet } from './curriculum/sets';
import { newFactState } from './learner';
import type { Save } from './types';
import { getArea, gateWalked, walkGate } from './areas';
import { currentStop, syncPath } from './path';

export function createSave(): Save {
  return { version: SAVE_VERSION, profile: { name: '', tapBaseline: DEFAULT_TAP_BASELINE, tapHistory: [] },
    facts: Object.fromEntries([...FACTS.keys()].map(id => [id, newFactState(id)])),
    team: { partner: null, friends: [], helped: [] }, map: { area: 1, clearedSpots: [] },
    story: { completedBeats: [], introComplete: false }, sessions: [], responses: [],
    settings: { sound: true, voice: true },
    practice: { placement: { active: true, setIndex: 0, probes: [], results: [] }, setHistory: {}, interleaved: [] } };
}

/** Version zero is the original empty foundation format, before practice state existed. */
export function migrateV0(value: Record<string, unknown>): Record<string, unknown> {
  return { ...createSave(), ...value, version: 1, practice: createSave().practice };
}
/** Keep learner evidence and team membership; infer help history from old joins. */
export function migrateV1(value: Record<string, unknown>): Save {
  const save = validateVersion(value, 1);
  const team = structuredClone(save.team);
  save.version = SAVE_VERSION;
  save.map = { area: save.map.area, clearedSpots: [] };
  syncPath(save, 0);
  save.team = { ...team, helped: team.friends.filter(id => id !== team.partner) };
  save.map.position = currentStop(save)?.id ?? getArea(save.map.area).gateId;
  return validateSave(save);
}
function object(value: unknown): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid save object');
}
function finite(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid save number');
}
function strings(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || !value.every(s => typeof s === 'string')) throw new Error('Invalid save strings');
}
function numericArray(value: unknown): asserts value is number[] {
  if (!Array.isArray(value)) throw new Error('Invalid save numbers');
  value.forEach(finite);
}
function boolean(value: unknown): asserts value is boolean {
  if (typeof value !== 'boolean') throw new Error('Invalid save boolean');
}
function count(value: unknown): asserts value is number {
  finite(value);
  if (!Number.isInteger(value) || value < 0) throw new Error('Invalid save count');
}

/** Reject malformed imports before exposing them to gameplay. Unknown fields survive. */
function validateVersion(input: unknown, version: number): Save {
  object(input);
  if (input.version !== version) throw new Error('Unsupported save version');
  object(input.profile); object(input.facts); object(input.team); object(input.map);
  object(input.story); object(input.settings); object(input.practice);
  if (typeof input.profile.name !== 'string') throw new Error('Invalid profile');
  finite(input.profile.tapBaseline); numericArray(input.profile.tapHistory);
  if (input.profile.tapBaseline < 0 || input.profile.tapHistory.length > TAP_HISTORY_SIZE || input.profile.tapHistory.some(n => n < 0)) throw new Error('Invalid calibration');
  if (Object.keys(input.facts).length !== FACTS.size) throw new Error('Invalid fact inventory');
  for (const id of FACTS.keys()) {
    const f = input.facts[id]; object(f);
    if (f.id !== id || !['new', 'learning', 'review'].includes(String(f.stage))) throw new Error('Invalid fact state');
    for (const key of ['seen', 'firstTryCorrect', 'streak', 'ladder', 'lapses']) count(f[key]);
    finite(f.strength);
    if (f.strength < 0 || f.strength > 1 || (f.ladder as number) >= REVIEW_INTERVALS_DAYS.length || (f.firstTryCorrect as number) > (f.seen as number)) throw new Error('Fact out of range');
    if (f.dueAt !== null) finite(f.dueAt);
    if (f.lastSeenAt !== null) finite(f.lastSeenAt);
    numericArray(f.latencies); strings(f.fastDays); strings(f.streakEncounters);
    if (f.latencies.length > LATENCY_HISTORY_SIZE || f.latencies.some(n => n < 0 || n > MAX_LATENCY_MS)
      || f.fastDays.length > FLUENT_DAYS || new Set(f.fastDays).size !== f.fastDays.length
      || f.streakEncounters.length > ACQUISITION_ENCOUNTERS) throw new Error('Invalid fact evidence');
    boolean(f.provisional); boolean(f.needsModel);
  }
  if (input.team.partner !== null && typeof input.team.partner !== 'string') throw new Error('Invalid partner');
  strings(input.team.friends);
  if (version === SAVE_VERSION) strings(input.team.helped);
  count(input.map.area); strings(input.map.clearedSpots);
  if (input.map.position !== undefined && typeof input.map.position !== 'string') throw new Error('Invalid map position');
  if (input.map.encounteredPals !== undefined) strings(input.map.encounteredPals);
  if (input.map.gatePracticeIndex !== undefined) count(input.map.gatePracticeIndex);
  strings(input.story.completedBeats); boolean(input.story.introComplete);
  boolean(input.settings.sound); boolean(input.settings.voice);
  object(input.practice.placement);
  const p = input.practice.placement;
  boolean(p.active); count(p.setIndex); strings(p.probes);
  p.probes.forEach(getFact);
  if (p.recheckGap !== undefined) count(p.recheckGap);
  if (!Array.isArray(p.results) || !p.results.every(r => typeof r === 'boolean') || p.results.length > p.probes.length || p.setIndex > FACT_SETS.length) throw new Error('Invalid placement');
  if (input.practice.checks !== undefined) {
    object(input.practice.checks);
    for (const [id, value] of Object.entries(input.practice.checks)) {
      const set = getSet(id); object(value); strings(value.probes); count(value.recheckGap);
      if (!['checking', 'learning', 'passed'].includes(String(value.status)) || !Array.isArray(value.results)
        || !value.results.every(r => typeof r === 'boolean') || value.results.length > value.probes.length
        || value.probes.some(id => !set.facts.includes(id))) throw new Error('Invalid set check');
    }
  }
  if (input.practice.streaks !== undefined) {
    object(input.practice.streaks);
    for (const [id, value] of Object.entries(input.practice.streaks)) {
      const set = getSet(id); strings(value);
      if (value.length > SET_STREAK_PASS || value.some(id => !set.facts.includes(id))) throw new Error('Invalid set streak');
    }
  }
  object(input.practice.setHistory); strings(input.practice.interleaved);
  input.practice.interleaved.forEach(getSet);
  for (const [id, history] of Object.entries(input.practice.setHistory)) {
    getSet(id);
    if (!Array.isArray(history) || !history.every(r => typeof r === 'boolean')) throw new Error('Invalid set history');
  }
  if (!Array.isArray(input.sessions) || !Array.isArray(input.responses)) throw new Error('Invalid logs');
  if (input.responses.length > RESPONSE_LOG_LIMIT) throw new Error('Response log exceeds cap');
  for (const s of input.sessions) {
    object(s);
    if (typeof s.id !== 'string') throw new Error('Invalid session');
    finite(s.start); finite(s.end); finite(s.accuracy);
    count(s.questions); count(s.firstTryCorrect); count(s.encounters); count(s.warmupTaps);
    if (s.campOffered !== undefined) boolean(s.campOffered);
    strings(s.enteredReview); strings(s.becameFluent);
    if (!Array.isArray(s.retries)) throw new Error('Invalid retries');
    for (const r of s.retries) {
      object(r); getFact(String(r.factId)); count(r.afterQuestion); count(r.afterEncounter);
      if (![0, 1, 2].includes(r.step as number)) throw new Error('Invalid retry step');
    }
  }
  for (const r of input.responses) {
    object(r); getFact(String(r.factId)); getSet(String(r.setId)); finite(r.time);
    boolean(r.correct); boolean(r.firstTryCorrect); boolean(r.neededHelp);
    if (r.latency !== null) finite(r.latency);
    if (!['modeled', 'plain'].includes(String(r.mode)) || ![0, 0.5, 1].includes(r.score as number) || typeof r.encounterId !== 'string') throw new Error('Invalid response');
  }
  return structuredClone(input) as unknown as Save;
}
export function validateSave(input: unknown): Save { return validateVersion(input, SAVE_VERSION); }
export function importSave(json: string): Save {
  let value: unknown = JSON.parse(json);
  object(value);
  if (value.version === 0) value = migrateV0(value);
  object(value);
  if (value.version === 1) value = migrateV1(value);
  const save = validateSave(value);
  // Old last-gate practice was possible only after walking gate one.
  if ((save.map.gatePracticeIndex ?? 0) > 0 && !gateWalked(save, 1)) walkGate(save, 1);
  return save;
}
export function exportSave(save: Save): string { return JSON.stringify(validateSave(save)); }
