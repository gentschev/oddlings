import { createSave, DAY_MS, FACT_SETS, newFactState, startSession } from '../../src/core';
import type { Save } from '../../src/core';

export function fixture(): Save {
  const save = createSave();
  // Ordinary-planning tests begin after entry checks have failed.
  save.practice.placement.active = false;
  save.practice.checks = Object.fromEntries(FACT_SETS.map(s => [s.id, { status: 'learning', probes: [], results: [], recheckGap: 0 }]));
  startSession(save, 0);
  return save;
}
export function masterSet(save: Save, id: string, now = 0): void {
  const set = FACT_SETS.find(s => s.id === id)!;
  for (const factId of set.facts) {
    save.facts[factId] = { ...newFactState(factId), stage: 'review', seen: 3,
      firstTryCorrect: 3, strength: 0.8, dueAt: now + DAY_MS, lastSeenAt: now, needsModel: false };
  }
}
export function masterThrough(save: Save, id: string, now = 0): void {
  for (const set of FACT_SETS) {
    masterSet(save, set.id, now);
    if (set.id === id) break;
  }
}
