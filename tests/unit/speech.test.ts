import { AREAS, type AreaDefinition } from '../../src/core/areas';
import { describe, expect, it, vi } from 'vitest';
import { SpeechPlayer, type SpeechAudio, type SpeechIndex } from '../../src/audio/SpeechPlayer';
import { AudioManager } from '../../src/audio/AudioManager';
import { FACTS, getFact, ODDLING_IDS } from '../../src/core';
import { SPEECH_TIMING, TIMING } from '../../src/game/constants';
import { introWait, speechWait } from '../../src/game/speechTiming';
import { STORY_LINES } from '../../src/core/story/pebblePath';
import { factRead, factSpeechId, speechLines } from '../../src/game/speechLines';
import { NUMBER_NAMES, ODDLING_LINES, PRAISE_LINES, questionText, STRINGS } from '../../src/game/strings';

function audio() { return { play: vi.fn(async () => undefined), pause: vi.fn(), onerror: null } satisfies SpeechAudio; }
describe('local speech', () => {
  it('looks up lengths synchronously after preload, with zero for older or missing entries', async () => {
    const load = vi.fn(async () => ({ hello: { file: 'hello.m4a', ms: 1090 }, old: { file: 'old.m4a' },
      bad: { file: 'bad.m4a', ms: NaN }, negative: { file: 'negative.m4a', ms: -5 } }));
    const player = new SpeechPlayer(load);
    expect(player.duration('hello')).toBe(0);
    await player.preload(); await player.preload(); expect(load).toHaveBeenCalledOnce();
    expect(player.duration('hello')).toBe(1090);
    for (const id of ['old', 'missing', 'bad', 'negative']) expect(player.duration(id)).toBe(0);
    const missing = new SpeechPlayer(async () => { throw new Error('404'); });
    await missing.preload(); expect(missing.duration('hello')).toBe(0);
  });
  it('preloads on unlock and reports zero while locked, muted or voice is off', async () => {
    const resume = vi.fn(async () => undefined);
    vi.stubGlobal('AudioContext', class { resume = resume; });
    try {
      const load = vi.fn(async () => ({ hello: { file: 'hello.m4a', ms: 1090 } }));
      const player = new SpeechPlayer(load), manager = new AudioManager(player);
      await player.preload(); expect(manager.duration('hello')).toBe(0);
      manager.unlock(); await player.preload(); expect(resume).toHaveBeenCalledOnce();
      expect(manager.duration('hello')).toBe(1090);
      manager.muted = true; expect(manager.duration('hello')).toBe(0);
      manager.muted = false; manager.voiceEnabled = false; expect(manager.duration('hello')).toBe(0);
      manager.voiceEnabled = true; expect(manager.duration('unknown')).toBe(0);
      const lazyLoad = vi.fn(async () => ({})), lazy = new AudioManager(new SpeechPlayer(lazyLoad));
      expect(lazyLoad).not.toHaveBeenCalled(); lazy.unlock(); expect(lazyLoad).toHaveBeenCalledOnce();
    } finally { vi.unstubAllGlobals(); }
  });
  it('loads the index lazily, reuses it, stops the previous line and ignores missing ids', async () => {
    const load = vi.fn(async () => ({ hello: { file: 'hello.m4a' }, next: { file: 'next.m4a' } }));
    const first = audio(), second = audio();
    const create = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const player = new SpeechPlayer(load, create);
    expect(load).not.toHaveBeenCalled();
    await player.say('hello'); expect(create).toHaveBeenCalledWith('assets/speech/hello.m4a');
    await player.say('next'); expect(first.pause).toHaveBeenCalled(); expect(second.play).toHaveBeenCalledOnce();
    await player.say('absent'); expect(second.pause).toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(2); expect(load).toHaveBeenCalledOnce();
  });
  it('keeps the newest line when index loading is slow, and cancels pending lines on stop', async () => {
    let release!: (index: SpeechIndex) => void;
    const pending = new Promise<SpeechIndex>(resolve => { release = resolve; });
    const create = vi.fn(() => audio()), player = new SpeechPlayer(() => pending, create);
    const old = player.say('old'), latest = player.say('latest');
    release({ old: { file: 'old.m4a' }, latest: { file: 'latest.m4a' } });
    await Promise.all([old, latest]); expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith('assets/speech/latest.m4a');
    const cancelled = player.say('old'); player.stop(); await cancelled;
    expect(create).toHaveBeenCalledOnce();
  });
  it('silently handles a missing index, a missing recording and unsafe filenames', async () => {
    const create = vi.fn(() => audio());
    await expect(new SpeechPlayer(async () => { throw new Error('404'); }, create).say('anything')).resolves.toBeUndefined();
    const failing = audio(); failing.play.mockRejectedValue(new Error('missing file'));
    await expect(new SpeechPlayer(async () => ({ hello: { file: 'hello.m4a' } }), () => failing).say('hello')).resolves.toBeUndefined();
    await new SpeechPlayer(async () => ({ bad: { file: '../remote.m4a' } }), create).say('bad');
    expect(create).not.toHaveBeenCalled();
  });
  it('reads a card name then its line, skips missing recordings and cancels the queue on another tap', async () => {
    const created: SpeechAudio[] = [];
    const create = vi.fn(() => { const a: SpeechAudio = audio(); created.push(a); return a; });
    const player = new SpeechPlayer(async () => ({ name: { file: 'name.m4a' }, line: { file: 'line.m4a' } }), create);
    await player.saySequence(['name', 'missing', 'line']);
    expect(create).toHaveBeenCalledTimes(1);
    created[0]!.onended?.call({} as GlobalEventHandlers, {} as Event);
    await Promise.resolve();
    expect(create).toHaveBeenNthCalledWith(2, 'assets/speech/line.m4a');
    await player.saySequence(['name', 'line']);
    expect(created[1]!.pause).toHaveBeenCalled();
    await player.say('name');
    created[2]!.onended?.call({} as GlobalEventHandlers, {} as Event);
    await Promise.resolve();
    expect(create).toHaveBeenCalledTimes(4);
  });
});
describe('offline speech catalogue', () => {
  it('has stable filename-safe ids, every fact and correction, every number and all story lines', () => {
    const lines = speechLines(), ids = new Set(lines.map(l => l.id));
    expect(ids.size).toBe(lines.length); expect(speechLines()).toEqual(lines);
    for (const line of lines) expect(line.id).toMatch(/^[a-zA-Z0-9._-]+$/);
    for (const fact of FACTS.values()) {
      expect(ids.has(factSpeechId(fact))).toBe(true); expect(ids.has(factSpeechId(fact, true))).toBe(true);
    }
    for (const [beat, text] of Object.entries(STORY_LINES)) text.forEach((text, i) => expect(lines).toContainEqual({ id: `story-${beat}-${i}`, text }));
    NUMBER_NAMES.forEach((text, n) => {
      expect(lines).toContainEqual({ id: `number-${n}`, text }); expect(lines).toContainEqual({ id: `tap-${n}`, text: STRINGS.tap(n) });
    });
    for (const [key, text] of Object.entries(STRINGS)) if (typeof text === 'string' && key !== 'campIcon') expect(lines).toContainEqual({ id: `ui-${key}`, text });
    expect(PRAISE_LINES).toHaveLength(6);
    for (const [id, text] of Object.entries(ODDLING_LINES)) expect(lines).toContainEqual({ id: `pal-${id}`, text });
    for (const id of ODDLING_IDS) {
      expect(lines).toContainEqual({ id: `muddle-${id}`, text: STRINGS.muddle(STRINGS.names[id]) });
      expect(lines).toContainEqual({ id: `muddle-again-${id}`, text: STRINGS.muddleAgain(STRINGS.names[id]) });
    }
    for (const id of ODDLING_IDS) expect(lines).toContainEqual({ id: `better-${id}`, text: STRINGS.better(STRINGS.names[id]) });
    expect(ids.has('new-facts-20')).toBe(true); expect(ids.has('new-facts-21')).toBe(false);
    expect(ids.has('new-facts-many')).toBe(true);
    expect(STRINGS.newFacts(294)).toBe('So many new facts!');
    expect(STRINGS.reviewFacts(294)).toBe('So many facts grew strong!');
    for (let n = 1; n <= 9; n++) expect(lines).toContainEqual({ id: `cleared-stops-${n}`, text: STRINGS.clearedStops(n) });
    for (let n = 2; n <= 5; n++) expect(lines).toContainEqual({ id: `joined-pals-${n}`, text: STRINGS.palsJoin(n) });
    for (const definition of AREAS) {
      const area: AreaDefinition = definition;
      expect(lines).toContainEqual({ id: area.nameSpeech, text: area.name });
      for (const [beat, story] of Object.entries(area.stories)) story.lines.forEach((text, i) => expect(lines).toContainEqual({ id: `story-${beat}-${i}`, text }));
    }
    expect(lines.length).toBe(903);
  });
  it('reads equations and corrections without giving away a counting question', () => {
    expect(factRead(getFact('add:7+3'))).toBe('seven plus three');
    expect(factRead(getFact('add:7+3'), true)).toBe('seven plus three makes ten');
    expect(factRead(getFact('sub:10-4'))).toBe('ten take away four');
    expect(factRead(getFact('miss:7+?=10'))).toBe('seven plus what makes ten');
    expect(factRead(getFact('dots:5:dice'))).toBe('How many dots?');
    expect(questionText(getFact('dots:5:dice'))).toBe('How many dots?');
    expect(questionText(getFact('frame:9'))).toBe('How many dots?');
    expect(questionText(getFact('add:3+1'))).toBe('3 + 1 = ?');
  });
});
describe('game-clock speech waits', () => {
  it('keeps feedback visible until its clip and gap finish, with a bounded fallback', () => {
    expect(speechWait(TIMING.feedback, 1090)).toBe(1090 + SPEECH_TIMING.gap);
    expect(speechWait(TIMING.feedback, 100)).toBe(TIMING.feedback);
    expect(speechWait(TIMING.feedback, 0)).toBe(TIMING.feedback);
    expect(speechWait(TIMING.clear, 1800)).toBe(1800 + SPEECH_TIMING.gap);
    expect(speechWait(TIMING.feedback, 99_999)).toBe(SPEECH_TIMING.maxWait);
    for (const invalid of [-1, NaN, Infinity]) expect(speechWait(TIMING.feedback, invalid)).toBe(TIMING.feedback);
  });
  it('gives silent or older-index introductions a fixed readable interval', () => {
    expect(introWait(0)).toBe(SPEECH_TIMING.quietIntro);
    expect(introWait(3000)).toBe(3000 + SPEECH_TIMING.gap);
    expect(introWait(99_999)).toBe(SPEECH_TIMING.maxWait);
  });
});
