import type { FriendId } from './story/characters';
import type { Save } from './types';

export interface SkillStop { id: string; type: 'skill'; set: string; pal: FriendId; groundRing?: boolean }
export interface StoryStop { id: string; type: 'story'; beat: string }
export type PathDefinition = SkillStop | StoryStop;
export interface StoryBeat {
  speaker: FriendId | 'moss'; background: string; lines: readonly string[];
  clue?: 'ground-ring' | 'den-page' | 'mist-shape';
}
export interface AreaDefinition {
  number: number; key: string; name: string; nameSpeech: string; mapBackground: string; encounterBackground: string;
  gateId: string; gateBeat: string; entryId?: string;
  stops: readonly PathDefinition[]; stories: Record<string, StoryBeat>;
}
/** Map stones and story order live here, independently of the presentation code. */
export const AREAS = [
  { number: 1, key: 'pebblePath', name: 'Pebble Path', nameSpeech: 'ui-map', mapBackground: 'bg-pebble-path-map',
    encounterBackground: 'bg-encounter-meadow', gateId: 'pp-gate', gateBeat: 'gate',
    stops: [
      { id: 'pp-welcome', type: 'story', beat: 'welcome' },
      { id: 'pp-see-dots', type: 'skill', set: 'see-dots', pal: 'bix' },
      { id: 'pp-see-frame', type: 'skill', set: 'see-frame', pal: 'tenny', groundRing: true },
      { id: 'pp-add-plus0', type: 'skill', set: 'add-plus0', pal: 'inch' },
      { id: 'pp-add-plus1', type: 'skill', set: 'add-plus1', pal: 'inch' },
      { id: 'pp-ring', type: 'story', beat: 'ring' },
      { id: 'pp-sub-minus01', type: 'skill', set: 'sub-minus01', pal: 'inch' },
      { id: 'pp-add-plus2', type: 'skill', set: 'add-plus2', pal: 'twoot', groundRing: true },
      { id: 'pp-add-within5', type: 'skill', set: 'add-within5', pal: 'fivel' },
      { id: 'pp-sub-within5', type: 'skill', set: 'sub-within5', pal: 'fivel', groundRing: true },
      { id: 'pp-sub-minus2-all', type: 'skill', set: 'sub-minus2-all', pal: 'twoot' },
    ],
    stories: {
      welcome: { speaker: 'moss', background: 'bg-encounter-meadow', lines: ['Oh! A new face. Hello.', 'I am Moss. I keep the Count Book.',
        'We had six buns. Now we have five.', 'The count is wrong. It makes us muddled.', 'Pick a pal. Go and help.'] },
      ring: { speaker: 'moss', background: 'bg-encounter-meadow', clue: 'ground-ring', lines: ['Stop! Look at the ground.', 'A ring mark. Right here.',
        'A bun sat here. Now it is gone.', 'Who made the ring? Odd. Very odd.'] },
    } },
  { number: 2, key: 'twinFalls', name: 'Twin Falls', nameSpeech: 'area-twinFalls', mapBackground: 'bg-twin-falls-map',
    encounterBackground: 'bg-twin-falls-encounter', gateId: 'tf-gate', gateBeat: 'gate-twin-falls', entryId: 'tf-entry',
    stops: [
      { id: 'tf-falls', type: 'story', beat: 'falls' },
      { id: 'tf-add-doubles-small', type: 'skill', set: 'add-doubles-small', pal: 'domi' },
      { id: 'tf-den', type: 'story', beat: 'den' },
      { id: 'tf-add-near-doubles-small', type: 'skill', set: 'add-near-doubles-small', pal: 'twoot' },
      { id: 'tf-sub-halves-small', type: 'skill', set: 'sub-halves-small', pal: 'domi' },
      { id: 'tf-mist', type: 'story', beat: 'mist' },
    ],
    stories: {
      falls: { speaker: 'twoot', background: 'bg-twin-falls-encounter', lines: [
        'Hoo! You made it to Twin Falls.', 'We have two of everything here.',
        'Two falls. Two trees. Two big rocks.', 'But our counts come out wrong too.', 'Help my pals. Then look for clues.',
      ] },
      den: { speaker: 'twoot', background: 'bg-twin-falls-den', clue: 'den-page', lines: [
        'Look! A den behind the falls.', 'Ring marks. All over the walls.', 'And a page from the Count Book!',
        'It counts past nine. Ten. Eleven. Twelve.', 'Why did the counts stop at nine?',
      ] },
      mist: { speaker: 'twoot', background: 'bg-twin-falls-encounter', clue: 'mist-shape', lines: [
        'Hush. Look at the falls.', 'A round shape, in the mist.', 'It looks at us. It looks sad.',
        'Wait! Do not go!', 'It is gone. We must find it.',
      ] },
    } },
] as const satisfies readonly AreaDefinition[];
export type AreaKey = typeof AREAS[number]['key'];
export function getArea(number: number): AreaDefinition & { key: AreaKey } {
  const area = AREAS.find(a => a.number === number);
  if (!area) throw new Error(`Unknown area: ${number}`);
  return area;
}
export const allStops = (): readonly PathDefinition[] => AREAS.flatMap(a => [...a.stops]);
export function areaForStop(id: string): ReturnType<typeof getArea> {
  const area = AREAS.find(a => a.stops.some(s => s.id === id));
  if (!area) throw new Error(`Unknown stop: ${id}`);
  return area;
}
export function getStop(id: string): PathDefinition { return areaForStop(id).stops.find(s => s.id === id)!; }
export const lastArea = () => AREAS[AREAS.length - 1]!;
export const nextArea = (number: number) => AREAS.find(a => a.number > number);
export const previousArea = (number: number) => [...AREAS].reverse().find(a => a.number < number);
export function gateWalked(save: Save, number: number): boolean { return save.story.completedBeats.includes(getArea(number).gateBeat); }
export function areaReached(save: Save, number: number): boolean {
  if (!AREAS.some(a => a.number === number)) return false;
  const previous = previousArea(number);
  return !previous || gateWalked(save, previous.number);
}
export function canVisitArea(save: Save, number: number): boolean { return areaReached(save, number); }
export function walkGate(save: Save, number: number): void {
  const beat = getArea(number).gateBeat;
  if (!save.story.completedBeats.includes(beat)) save.story.completedBeats.push(beat);
}
export function visitArea(save: Save, number: number): boolean {
  if (!canVisitArea(save, number)) return false;
  const area = getArea(number), forward = number > save.map.area;
  save.map.area = number;
  save.map.position = forward ? area.entryId ?? area.stops[0]!.id : area.gateId;
  return true;
}
export function storyListener(save: Save, speaker: StoryBeat['speaker']): FriendId {
  const partner = (save.team.partner ?? 'tenny') as FriendId;
  if (partner !== speaker) return partner;
  return [...save.team.friends].reverse().find(id => id !== speaker) as FriendId | undefined
    ?? (speaker === 'tenny' ? 'domi' : 'tenny');
}
