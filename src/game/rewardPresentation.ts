import type { FriendId } from '../core/story/characters';
import { SPOKEN_COUNT_LIMIT } from './constants';
import { STRINGS } from './strings';

export interface Reward {
  friend: FriendId; joinedPals: FriendId[]; introduced: number; learned: number; completed: string[]; gate?: boolean; improvingPal?: FriendId;
}
interface Line { text: string; id: string }
/** Keep the joining news separate when the headline describes several cleared stops. */
export function rewardPresentation(data: Reward) {
  const name = STRINGS.names[data.friend], joined = data.joinedPals.includes(data.friend);
  const headline: Line = data.completed.length > 1
    ? { text: STRINGS.clearedStops(data.completed.length), id: `cleared-stops-${data.completed.length}` }
    : data.completed.length === 1
      ? { text: joined ? STRINGS.join(name) : STRINGS.friend(name), id: `${joined ? 'join' : 'friend'}-${data.friend}` }
      : data.improvingPal ? { text: STRINGS.better(STRINGS.names[data.improvingPal]), id: `better-${data.improvingPal}` }
        : { text: STRINGS.practice, id: 'ui-practice' };
  const first = data.joinedPals[0];
  const joining: Line | null = data.joinedPals.length > 1
    ? { text: STRINGS.palsJoin(data.joinedPals.length), id: `joined-pals-${data.joinedPals.length}` }
    : first ? { text: STRINGS.join(STRINGS.names[first]), id: `join-${first}` } : null;
  const countId = (prefix: string, count: number) => `${prefix}-${count > SPOKEN_COUNT_LIMIT ? 'many' : count}`;
  const facts: Line = data.introduced > 0 ? { text: STRINGS.newFacts(data.introduced), id: countId('new-facts', data.introduced) }
    : data.learned > 0 ? { text: STRINGS.reviewFacts(data.learned), id: countId('review-facts', data.learned) }
      : { text: STRINGS.practice, id: 'ui-practice' };
  return { headline, joining: joining?.text === headline.text ? null : joining,
    facts: facts.text === headline.text || !data.completed.length && data.improvingPal && facts.id === 'ui-practice' ? null : facts,
    pals: data.joinedPals.length ? data.joinedPals : [data.friend] };
}
