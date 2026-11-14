import { ACQUISITION_STREAK, SET_MASTERY_RATIO, SESSION_STOP_MS, STOP_HELP_DUE } from './constants';
import { getSet } from './curriculum/sets';
import { setPassed } from './mastery';
import { STARTERS, type FriendId } from './story/characters';
import { AREAS, allStops, areaForStop, areaReached, getArea, type PathDefinition, type SkillStop, type StoryStop } from './areas';
import { currentSession } from './sessions';
import type { Save } from './types';

export interface PathStop {
  id: string; type: 'story' | 'skill'; state: 'locked' | 'current' | 'complete';
  completed: boolean; progress: number; needsHelp: boolean; pal: FriendId | null; set: string | null;
}
export interface PathChange { area: number; completed: string[]; joined: FriendId[]; before: PathStop[]; after: PathStop[] }
const complete = (save: Save, stop: PathDefinition) => areaReached(save, areaForStop(stop.id).number)
  && (stop.type === 'story' ? save.story.completedBeats.includes(stop.beat) : save.map.clearedSpots.includes(stop.id));
/**
 * Part credit for the ring. A fact in review counts 1. A fact being learned counts its
 * streak out of one more than the acquisition streak, so every correct answer moves the
 * ring and only review counts in full. The best `needed` facts are summed, which makes
 * the ring full exactly when the set is passed and never before.
 */
export function stopProgress(facts: readonly { stage: string; streak: number }[]): number {
  const needed = Math.ceil(facts.length * SET_MASTERY_RATIO);
  const credit = facts.map(f => f.stage === 'review' ? 1
    : f.stage === 'learning' ? Math.min(f.streak, ACQUISITION_STREAK) / (ACQUISITION_STREAK + 1) : 0)
    .sort((a, b) => b - a).slice(0, needed);
  return needed ? credit.reduce((sum, c) => sum + c, 0) / needed : 0;
}
export function pathStops(save: Save, now: number, area = save.map.area): PathStop[] {
  const stops = getArea(area).stops;
  const first = stops.findIndex(s => !complete(save, s));
  return stops.map((stop, i) => {
    const done = complete(save, stop);
    const facts = stop.type === 'skill' ? getSet(stop.set).facts.map(id => save.facts[id]!) : [];
    return { id: stop.id, type: stop.type, completed: done,
      state: first >= 0 && i > first ? 'locked' : done ? 'complete' : 'current',
      progress: stop.type === 'skill' ? stopProgress(facts) : Number(done),
      needsHelp: done && stop.type === 'skill' && (facts.some(f => f.stage === 'learning')
        || facts.filter(f => f.stage === 'review' && !f.provisional && f.dueAt !== null && f.dueAt <= now).length >= STOP_HELP_DUE),
      pal: stop.type === 'skill' ? stop.pal : null, set: stop.type === 'skill' ? stop.set : null };
  });
}
/** Reward only the skill that was current when the encounter began. */
export function improvingStop(change: PathChange): PathStop | undefined {
  const current = change.before.find(s => s.state === 'current' && s.type === 'skill');
  if (!current) return;
  const after = change.after.find(s => s.id === current.id)!;
  const tolerance = Number.EPSILON * getSet(current.set!).facts.length;
  return after.progress - current.progress > tolerance ? after : undefined;
}
export function currentStop(save: Save, area = save.map.area): PathDefinition | undefined { return getArea(area).stops.find(s => !complete(save, s)); }
/** Record reached-area completions in path order. A scope keeps encounter rewards local. */
export function syncPath(save: Save, now: number, area?: number): PathChange {
  const active = area ?? save.map.area;
  const before = pathStops(save, now, active), completed: string[] = [], joined: FriendId[] = [];
  const all = allStops();
  const stops = all.filter(s => {
    const number = areaForStop(s.id).number;
    return areaReached(save, number) && (area === undefined || area === number);
  });
  for (const stop of stops) {
    if (save.map.clearedSpots.includes(stop.id)) continue;
    if (stop.type === 'story' ? save.story.completedBeats.includes(stop.beat) : setPassed(save, stop.set)) {
      save.map.clearedSpots.push(stop.id); completed.push(stop.id);
    }
  }
  for (const stop of stops) if (stop.type === 'skill' && complete(save, stop)
    && !save.team.friends.includes(stop.pal) && all.find(s => s.type === 'skill' && s.pal === stop.pal)?.id === stop.id) {
    save.team.friends.push(stop.pal); joined.push(stop.pal);
  }
  return { area: active, completed, joined, before, after: pathStops(save, now, active) };
}
export function seeStory(save: Save, stop: StoryStop, now: number): PathChange {
  const before = pathStops(save, now);
  if (!save.story.completedBeats.includes(stop.beat)) save.story.completedBeats.push(stop.beat);
  return { ...syncPath(save, now, areaForStop(stop.id).number), before };
}
export function encounterPals(save: Save, wild: FriendId): { wild: FriendId; helper: FriendId } {
  const partner = (save.team.partner ?? 'tenny') as FriendId;
  const helper = partner !== wild ? partner : [...save.team.friends].reverse().find(id => id !== wild) as FriendId | undefined;
  return { wild, helper: helper ?? STARTERS.find(id => id !== wild)! };
}
/** Only a cleared muddle counts as having helped this pal before. */
export function markHelped(save: Save, pal: FriendId): void {
  if (!save.team.helped.includes(pal)) save.team.helped.push(pal);
}
export function palIntroduction(save: Save, pal: FriendId): 'first' | 'again' {
  return save.team.helped.includes(pal) ? 'again' : 'first';
}
export function stopIntroduction(save: Save, stop: SkillStop, now: number): 'first' | 'again' | 'none' {
  const state = pathStops(save, now, areaForStop(stop.id).number).find(s => s.id === stop.id)!;
  if (state.state === 'complete' && !state.needsHelp) return 'none';
  return palIntroduction(save, stop.pal);
}
export function gatePracticePal(save: Save): FriendId {
  const pals = save.team.friends.filter(id => id !== save.team.partner) as FriendId[];
  if (!pals.length) return STARTERS.find(id => id !== save.team.partner)!;
  return pals[(save.map.gatePracticeIndex ?? 0) % pals.length]!;
}
export function offerCamp(save: Save, now: number): boolean {
  const session = currentSession(save);
  if (session.campOffered || now - session.start < SESSION_STOP_MS) return false;
  session.campOffered = true; return true;
}

export function earlierAreaNeedsHelp(save: Save, now: number, area = save.map.area): boolean {
  return AREAS.filter(a => a.number < area).some(a => pathStops(save, now, a.number).some(s => s.needsHelp));
}

/** The new current stop has passed all intervening skills, including newly passed sets.
 * An unseen story cannot be crossed. Neither end of the move counts as a skip. */
export function passedOverStops(before: number, target: number, states: readonly Pick<PathStop, 'completed' | 'type'>[]): number {
  if (before < 0 || target <= before + 1) return 0;
  return states.slice(before + 1, target).filter(s => s.type === 'skill' || s.completed).length;
}
