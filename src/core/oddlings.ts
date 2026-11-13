import { getSet } from './curriculum/sets';
import { isFluent } from './learner';
import type { Save } from './types';

/** Shared facts appear only once in each pal's collection progress. */
export const ODDLING_SETS = {
  tenny: ['see-frame', 'add-five-and', 'add-make10', 'miss-make10', 'sub-from10'],
  domi: ['add-doubles-small', 'add-doubles-big', 'add-near-doubles-big', 'sub-halves-small'],
  inch: ['add-plus0', 'add-plus1', 'sub-minus01'],
  fivel: ['add-within5', 'sub-within5'],
  twoot: ['add-plus2', 'sub-minus2-all', 'add-near-doubles-small'],
  bix: ['see-dots'],
} as const;
export type OddlingId = keyof typeof ODDLING_SETS;
export const ODDLING_IDS = Object.keys(ODDLING_SETS) as OddlingId[];
export const ODDLING_PATTERNS = { tenny: 'ten-frame', domi: 'domino', inch: 'segments', fivel: 'five-dots', twoot: 'pairs', bix: 'dice' } as const;
export function oddlingProgress(save: Save, id: OddlingId) {
  const ids = [...new Set(ODDLING_SETS[id].flatMap(setId => getSet(setId).facts))];
  const review = ids.filter(id => save.facts[id]!.stage === 'review' && !save.facts[id]!.provisional);
  const fluent = review.filter(id => isFluent(save.facts[id]!)).length;
  const accurate = review.length - fluent;
  return { total: ids.length, review: review.length, accurate, fluent,
    reviewShare: review.length / ids.length, accurateShare: accurate / ids.length, fluentShare: fluent / ids.length };
}
export function choosePartner(save: Save, id: OddlingId): boolean {
  if (!save.team.friends.includes(id)) return false;
  save.team.partner = id; return true;
}
