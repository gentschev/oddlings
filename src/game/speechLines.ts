import { FACTS, ODDLING_IDS, type Fact } from '../core';
import { AREAS, type AreaDefinition } from '../core/areas';
import { SPOKEN_COUNT_LIMIT } from './constants';
import { NUMBER_NAMES, ODDLING_LINES, PRAISE_LINES, STRINGS } from './strings';

export interface SpeechLine { id: string; text: string; voice?: string }
export function factSpeechId(fact: Fact, correction = false): string {
  const suffix = fact.operation === 'dots' ? `${fact.a}-${fact.layout}` : fact.operation === 'frame' ? `${fact.a}` : `${fact.a}-${fact.b}`;
  return `${correction ? 'answer' : 'fact'}-${fact.operation}-${suffix}`;
}
export function factRead(fact: Fact, correction = false): string {
  const a = NUMBER_NAMES[fact.a]!, b = NUMBER_NAMES[fact.b]!, answer = NUMBER_NAMES[fact.answer]!;
  if (fact.operation === 'add') return `${a} plus ${b}${correction ? ` makes ${answer}` : ''}`;
  if (fact.operation === 'sub') return `${a} take away ${b}${correction ? ` makes ${answer}` : ''}`;
  if (fact.operation === 'miss') return correction ? `${a} plus ${answer} makes ${b}` : `${a} plus what makes ${b}`;
  return correction ? answer : STRINGS.howMany;
}
/** Shared catalogue for the offline exporter and runtime ids. No audio is generated in the app. */
export function speechLines(): SpeechLine[] {
  const lines: SpeechLine[] = [];
  for (const [key, value] of Object.entries(STRINGS)) if (typeof value === 'string' && key !== 'campIcon') lines.push({ id: `ui-${key}`, text: value });
  for (const [id, name] of Object.entries(STRINGS.names)) {
    lines.push({ id: `name-${id}`, text: name }, { id: `join-${id}`, text: STRINGS.join(name) }, { id: `friend-${id}`, text: STRINGS.friend(name) });
  }
  for (let n = 0; n <= 20; n++) lines.push({ id: `tap-${n}`, text: STRINGS.tap(n) },
    { id: `correction-tap-${n}`, text: STRINGS.correction(n) }, { id: `number-${n}`, text: NUMBER_NAMES[n]! });
  for (let n = 1; n <= AREAS.flatMap(a => a.stops.filter(s => s.type === 'skill')).length; n++) lines.push({ id: `cleared-stops-${n}`, text: STRINGS.clearedStops(n) });
  for (let n = 2; n <= 5; n++) lines.push({ id: `joined-pals-${n}`, text: STRINGS.palsJoin(n) });
  for (let n = 0; n <= 5; n++) lines.push({ id: `warmup-step-${n}`, text: STRINGS.warmupStep(n) });
  for (let n = 0; n <= SPOKEN_COUNT_LIMIT; n++) lines.push({ id: `new-facts-${n}`, text: STRINGS.newFacts(n) }, { id: `review-facts-${n}`, text: STRINGS.reviewFacts(n) });
  lines.push({ id: 'new-facts-many', text: STRINGS.newFacts(SPOKEN_COUNT_LIMIT + 1) }, { id: 'review-facts-many', text: STRINGS.reviewFacts(SPOKEN_COUNT_LIMIT + 1) });
  for (const [id, text] of Object.entries(ODDLING_LINES)) lines.push({ id: `pal-${id}`, text });
  for (const id of ODDLING_IDS) lines.push({ id: `better-${id}`, text: STRINGS.better(STRINGS.names[id]) }, { id: `muddle-${id}`, text: STRINGS.muddle(STRINGS.names[id]) },
    { id: `muddle-again-${id}`, text: STRINGS.muddleAgain(STRINGS.names[id]) });
  for (const definition of AREAS) {
    const area: AreaDefinition = definition;
    if (!lines.some(line => line.id === area.nameSpeech)) lines.push({ id: area.nameSpeech, text: area.name });
    for (const [beat, story] of Object.entries(area.stories)) story.lines.forEach((line, i) => lines.push({ id: `story-${beat}-${i}`, text: line }));
  }
  PRAISE_LINES.forEach((text, i) => lines.push({ id: `praise-${i}`, text }));
  for (const fact of FACTS.values()) lines.push({ id: factSpeechId(fact), text: factRead(fact) }, { id: factSpeechId(fact, true), text: factRead(fact, true) });
  return lines.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
