import type { Save } from './types';

export interface PracticeSnapshot { seen: string[]; acquired: string[] }
/** Fact counts survive the capped response log and do not count repeats as new. */
export function practiceSnapshot(save: Save): PracticeSnapshot {
  return { seen: Object.values(save.facts).filter(f => f.seen > 0).map(f => f.id),
    acquired: Object.values(save.facts).filter(f => f.stage === 'review' && !f.provisional).map(f => f.id) };
}
export function practiceProgress(save: Save, before: PracticeSnapshot): { introduced: number; learned: number } {
  const after = practiceSnapshot(save);
  return { introduced: after.seen.filter(id => !before.seen.includes(id)).length,
    learned: after.acquired.filter(id => !before.acquired.includes(id)).length };
}
