import { expect, it } from 'vitest';
import { ODDLING_IDS } from '../../src/core';
import { CANVAS, LAYOUT } from '../../src/game/constants';
import { contains, overlaps, rewardLayout } from '../../src/game/layout';
import { rewardPresentation, type Reward } from '../../src/game/rewardPresentation';

const base: Reward = { friend: 'bix', joinedPals: [], introduced: 3, learned: 0, completed: ['pp-see-dots'] };
it('shows all joining news alongside the stop headline and the honest fact line', () => {
  const single = rewardPresentation({ ...base, joinedPals: ['bix'] });
  expect(single.headline.text).toBe('Bix joins your team!'); expect(single.joining).toBeNull();
  const cascade = rewardPresentation({ ...base, joinedPals: ['bix', 'inch'], completed: ['a', 'b', 'c'] });
  expect(cascade.headline.text).toBe('You cleared 3 stops!');
  expect(cascade.joining).toEqual({ text: '2 pals join your team!', id: 'joined-pals-2' });
  expect(cascade.facts?.text).toBe('3 new facts!'); expect(cascade.pals).toEqual(['bix', 'inch']);
  expect(rewardPresentation({ ...base, joinedPals: ['inch'], completed: ['a', 'b'] }).joining?.text).toBe('Inch joins your team!');
  expect(rewardPresentation({ ...base, completed: [], improvingPal: 'inch' }).headline).toEqual({ text: 'Inch is getting better!', id: 'better-inch' });
  expect(rewardPresentation({ ...base, introduced: 0, completed: [], improvingPal: 'inch' }).facts).toBeNull();
  expect(rewardPresentation(base).headline.text).toBe('Bix feels better!');
  expect(rewardPresentation({ ...base, completed: [] }).headline.text).toBe('You helped a pal today.');
});
it('fits up to four new pals, including their hops, clear of text, peers and controls', () => {
  const canvas = { x: 0, y: 0, ...CANVAS };
  for (let count = 1; count <= 5; count++) for (const id of ODDLING_IDS) for (const joining of [false, true]) {
    const ids = Array.from({ length: count }, () => id);
    const layout = rewardLayout(ids, joining);
    expect(layout.pals).toHaveLength(Math.min(count, 4));
    const boxes = [...Object.values(layout.regions), ...layout.pals.map(p => p.motion)];
    for (const [i, box] of boxes.entries()) {
      expect(contains(canvas, box)).toBe(true);
      for (const other of boxes.slice(i + 1)) expect(overlaps(box, other), `${id} count ${count}`).toBe(false);
    }
    for (const pal of layout.pals) expect(pal.rect.width).toBeGreaterThanOrEqual(LAYOUT.reward.minPalW);
  }
  const five = rewardPresentation({ ...base, joinedPals: ['bix', 'inch', 'twoot', 'fivel', 'domi'] });
  expect(five.joining?.text).toBe('5 pals join your team!');
  expect(rewardLayout(five.pals, true).pals.map(p => p.id)).toEqual(['bix', 'inch', 'twoot', 'fivel']);
});
