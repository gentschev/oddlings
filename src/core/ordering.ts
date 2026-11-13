import { getFact } from './curriculum/sets';
import type { Save, Slot } from './types';

/** Select first, then arrange. Scheduled retry positions and selection priority are retained. */
export function spreadSlots(save: Save, slots: Slot[]): Slot[] {
  const unknown = slots.map(s => s.source === 'placement' || save.facts[s.factId]!.stage !== 'review');
  const unknownCount = unknown.filter(Boolean).length, knownCount = slots.length - unknownCount;
  const pinned = new Map(slots.flatMap((s, i) => s.source === 'retry' ? [[i, i] as const] : []));
  if (!unknown[0]) pinned.set(0, 0); // Preserve the oldest due review or known opener.
  const firstKnown = knownCount >= 2 && !(pinned.has(0) && unknown[pinned.get(0)!]);
  const lastKnown = knownCount >= 2 && !(pinned.has(slots.length - 1) && unknown[pinned.get(slots.length - 1)!]);
  const canSeparate = unknownCount <= knownCount + 1 - Number(firstKnown) - Number(lastKnown);
  const previous = save.responses.at(-1)?.factId;
  const answers = slots.map(s => getFact(s.factId).answer);
  const find = (separate: boolean, varied: boolean): Slot[] | undefined => {
    const dead = new Set<string>();
    const order: number[] = [];
    const search = (mask: number, last: number, usedUnknown: number): boolean => {
      const pos = order.length;
      if (pos === slots.length) return true;
      const key = `${mask}/${last}`;
      if (dead.has(key)) return false;
      const prevId = last < 0 ? previous : slots[last]!.factId;
      const prevAnswer = last < 0 ? (previous ? getFact(previous).answer : null) : answers[last];
      const wantUnknown = pos >= Math.floor((usedUnknown + 1) * slots.length / (unknownCount + 1));
      const candidates = pinned.has(pos) ? [pinned.get(pos)!] : slots.map((_, i) => i)
        .sort((a, b) => Number(unknown[a] !== wantUnknown) - Number(unknown[b] !== wantUnknown) || a - b);
      const tried = new Set<string>();
      for (const i of candidates) {
        if (mask & 1 << i || [...pinned].some(([position, index]) => index === i && position !== pos)) continue;
        if (pos === 0 && firstKnown && unknown[i] || pos === slots.length - 1 && lastKnown && unknown[i]) continue;
        if (slots[i]!.factId === prevId || varied && answers[i] === prevAnswer) continue;
        if (separate && unknown[i] && last >= 0 && unknown[last]) continue;
        const signature = `${slots[i]!.factId}/${slots[i]!.source}`;
        if (tried.has(signature)) continue;
        tried.add(signature); order.push(i);
        if (search(mask | 1 << i, i, usedUnknown + Number(unknown[i]))) return true;
        order.pop();
      }
      dead.add(key); return false;
    };
    return search(0, -1, 0) ? order.map(i => slots[i]!) : undefined;
  };
  // Scarce pools can make answer variety or separation impossible. Never prevent play.
  return find(canSeparate, true) ?? find(false, true) ?? find(canSeparate, false) ?? find(false, false) ?? slots;
}
