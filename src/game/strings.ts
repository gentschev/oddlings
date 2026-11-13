import type { Fact } from '../core';
import { SPOKEN_COUNT_LIMIT } from './constants';

/** Download status is for the grown-up and has no speech clips. */
export const OFFLINE_TEXT = { getting: (stored: number, total: number) => `Getting voices ${stored} / ${total}`,
  ready: 'Ready to play offline' } as const;
/** Platform notices are never spoken. */
export const PLATFORM_TEXT = { test: 'Test version', homeScreen: 'Add to Home Screen to keep progress' } as const;

export const STRINGS = {
  yourPals: 'Your pals', bePal: 'Be my pal',
  title: 'Oddlings', map: 'Pebble Path', play: 'Play', grownups: 'For grown-ups', campIcon: '⌂',
  sideways: 'Turn me sideways', parentQuestion: (a: number, b: number) => `What is ${a} × ${b}?`, go: 'Go', clearKey: 'Clear',
  comingSoon: 'More here soon.', hold: 'Hold to open.', close: 'Back', choose: 'Pick a pal.', pick: 'Pick',
  howMany: 'How many dots?', hint: 'Show me', correction: (n: number) => `Tap ${n} to go on.`,
  muddle: (name: string) => `${name} is in a muddle!\nFill the dots to help.`,
  muddleAgain: (name: string) => `${name} is in a muddle again!`,
  warmup: 'Wake up the pad!', tap: (n: number) => `Tap ${n}`, warmupStep: (n: number) => `${n} / 5`,
  correct: 'You worked it out!', quick: 'That was quick!', clear: 'The muddle is gone!',
  next: 'Next', keepGoing: 'Keep going', stop: 'Stop for now', camp: 'Good stopping place.',
  clearedStops: (n: number) => `You cleared ${n} ${n === 1 ? 'stop' : 'stops'}!`,
  better: (name: string) => `${name} is getting better!`,
  palsJoin: (count: number) => `${count} pals join your team!`,
  join: (name: string) => `${name} joins your team!`, friend: (name: string) => `${name} feels better!`,
  newFacts: (n: number) => n > SPOKEN_COUNT_LIMIT ? 'So many new facts!' : `${n} new ${n === 1 ? 'fact' : 'facts'}!`,
  reviewFacts: (n: number) => n > SPOKEN_COUNT_LIMIT ? 'So many facts grew strong!' : `${n} ${n === 1 ? 'fact' : 'facts'} grew strong!`,
  practice: 'You helped a pal today.', mute: 'Sound on', unmute: 'Sound off',
  gateClosed: 'The gate is shut.\nHelp the pals on the path.', gateOpen: 'The path is clear!',
  gateSoon: 'A new path will come soon.', saving: 'Keeping your place…', saveError: 'Tap to keep your place.',
  loading: 'Waking up the vale…', assetError: 'A picture could not load.',
  names: { tenny: 'Tenny', domi: 'Domi', inch: 'Inch', moss: 'Moss', fivel: 'Fivel', twoot: 'Twoot', bix: 'Bix', nought: 'Nought' },
} as const;

export function questionText(fact: Fact, solved = false): string {
  const answer = solved ? String(fact.answer) : '?';
  switch (fact.operation) {
    case 'add': return `${fact.a} + ${fact.b} = ${answer}`;
    case 'sub': return `${fact.a} − ${fact.b} = ${answer}`;
    case 'miss': return `${fact.a} + ${answer} = ${fact.b}`;
    default: return solved ? String(fact.answer) : STRINGS.howMany;
  }
}

export const NUMBER_NAMES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'] as const;
export const PRAISE_LINES = ['You worked it out!', 'You kept trying!', 'You found a way!', 'Good counting!', 'You gave it a go!', 'You took your time.'] as const;

export const ODDLING_LINES = { tenny: 'Tenny knows tens.', domi: 'Domi knows doubles.', inch: 'Inch can count on.',
  fivel: 'Fivel knows five.', twoot: 'Twoot knows twos.', bix: 'Bix knows dots.' } as const;

/** Map labels are symbols, not speech lines. */
export const STOP_TAGS: Record<string, string> = { 'see-dots': 'dots', 'see-frame': 'ten-frame',
  'add-plus0': '+0', 'add-plus1': '+1', 'sub-minus01': '−1', 'add-plus2': '+2',
  'add-within5': '+ within 5', 'sub-within5': '− within 5', 'sub-minus2-all': '−2', 'add-doubles-small': 'doubles',
  'add-near-doubles-small': 'double + 1', 'sub-halves-small': 'halves' };
