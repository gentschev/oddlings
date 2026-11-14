import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../../src/ui/Controls', () => ({
  Button: class {}, arrowIcon: vi.fn(), plate: vi.fn(), soundIcon: vi.fn(), speechBubble: vi.fn(), bookIcon: vi.fn(),
  text: () => ({ destroy: vi.fn(), setBackgroundColor() { return this; }, setFixedSize() { return this; }, setAlign() { return this; } }),
}));
import { MapScene } from '../../src/game/MapScene';
import type { Runtime } from '../../src/game/Runtime';
import { SPEECH_TIMING } from '../../src/game/constants';

function arrival(passedOver: number, pals: string[] = [], duration = 0) {
  const say = vi.fn(), timers: { at: number; run: () => void }[] = [];
  const runtime = { elapsed: 0, audio: { say, duration: () => duration, stopSpeech: vi.fn() } };
  const scene = new MapScene(runtime as unknown as Runtime);
  const probe = scene as unknown as {
    passedOver: number; arrivalPals: string[]; bannerText: string; onScreen: string[];
    busy: boolean; modal: boolean; announcement: number; heading: { setVisible: ReturnType<typeof vi.fn> };
    showArrival(): void; cancelArrival(): void; speak(id: string): void; panel: (line: string) => void;
  };
  scene.time = { delayedCall: (ms: number, run: () => void) => { timers.push({ at: runtime.elapsed + ms, run }); } } as unknown as typeof scene.time;
  probe.heading = { setVisible: vi.fn() };
  probe.passedOver = passedOver; probe.arrivalPals = pals; probe.onScreen = []; probe.busy = false; probe.modal = false;
  const panel = vi.fn((line: string) => { probe.onScreen.push(line); probe.modal = true; });
  probe.panel = panel;
  const advance = (ms: number) => {
    const end = runtime.elapsed + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      if (!timers[0] || timers[0].at > end) break;
      const next = timers.shift()!; runtime.elapsed = next.at; next.run();
    }
    runtime.elapsed = end;
  };
  return { probe, say, panel, advance };
}

describe('map arrival speech on the game clock', () => {
  it('keeps a silent singular banner for two seconds without blocking controls', () => {
    const { probe, advance, say } = arrival(1);
    probe.showArrival();
    expect(probe.bannerText).toBe('You already know this one!'); expect(probe.heading.setVisible).toHaveBeenLastCalledWith(false); expect(say).toHaveBeenLastCalledWith('ui-knowThis');
    expect(probe.busy).toBe(false); expect(probe.modal).toBe(false);
    advance(1999); expect(probe.onScreen).toContain(probe.bannerText);
    advance(1); expect(probe.bannerText).toBe(''); expect(probe.onScreen).toEqual([]);
    expect(probe.heading.setVisible).toHaveBeenLastCalledWith(true);
  });
  it('finishes the plural banner and gap before the joining panel speaks', () => {
    const { probe, advance, say, panel } = arrival(2, ['domi'], 3000);
    probe.showArrival();
    expect(probe.bannerText).toBe('You already know these!'); expect(probe.modal).toBe(false);
    advance(3000 + SPEECH_TIMING.gap - 1); expect(panel).not.toHaveBeenCalled();
    advance(1); expect(probe.bannerText).toBe(''); expect(panel).toHaveBeenCalledWith('Domi joins your team!');
    expect(say.mock.calls.map(([id]) => id)).toEqual(['ui-knowThese', 'join-domi']);
    expect(probe.arrivalPals).toEqual(['domi']);
  });
  it('does not cut off the area heading when movement finishes early', () => {
    const { probe, advance, say } = arrival(1, [], 1000);
    probe.speak('area-pebblePath'); probe.showArrival();
    expect(probe.bannerText).toBe(''); advance(1000 + SPEECH_TIMING.gap);
    expect(say.mock.calls.map(([id]) => id)).toEqual(['area-pebblePath', 'ui-knowThis']);
  });
  it('cancels the queued announcement when a tap starts a walk to another stop', () => {
    const { probe, advance, panel } = arrival(2, ['domi'], 3000);
    probe.showArrival(); probe.cancelArrival(); advance(8000);
    expect(probe.bannerText).toBe(''); expect(panel).not.toHaveBeenCalled();
  });
  it('keeps area-arrival joining panels without a skip banner and preserves their hook', () => {
    const { probe, say, panel } = arrival(0, ['domi']);
    probe.showArrival();
    expect(probe.bannerText).toBe(''); expect(panel).toHaveBeenCalledWith('Domi joins your team!');
    expect(say).toHaveBeenCalledExactlyOnceWith('join-domi');
    expect(probe.arrivalPals).toEqual(['domi']);
  });
});
