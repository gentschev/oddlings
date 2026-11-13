import { FACTS, isFluent, type Save } from '../core';
import { getArea } from '../core/areas';
import { factSpeechId } from '../game/speechLines';

/** Stable within each priority group, including unknown future catalogue ids. */
export function orderSpeechIds(ids: readonly string[], save: Save): string[] {
  const area = getArea(save.map.area), stories = Object.keys(area.stories).map(beat => `story-${beat}-`);
  const needed = new Set<string>();
  for (const fact of FACTS.values()) if (!save.facts[fact.id] || !isFluent(save.facts[fact.id]!)) {
    needed.add(factSpeechId(fact)); needed.add(factSpeechId(fact, true));
  }
  const rank = (id: string) => {
    if (id === area.nameSpeech || /^(ui-|tap-|correction-tap-|number-|praise-|warmup-step-|new-facts-|review-facts-|cleared-stops-|joined-pals-)/.test(id)) return 0;
    if (stories.some(prefix => id.startsWith(prefix))) return 1;
    if (/^(name-|pal-|join-|friend-|better-|muddle-)/.test(id)) return 2;
    return needed.has(id) ? 3 : 4;
  };
  return [...ids].sort((a, b) => rank(a) - rank(b));
}
