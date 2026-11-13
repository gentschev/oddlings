import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeviceSupport, initDeviceSupport } from '../../src/platform/device';
import { nextParentChallenge } from '../../src/core/story/parentGate';

const handle = () => ({ released: false, release: vi.fn(async function(this: { released: boolean }) { this.released = true; }) });
afterEach(() => vi.unstubAllGlobals());
describe('optional tablet features', () => {
  it('starts audio, fullscreen and persistence together and reacquires wake lock on visibility', async () => {
    let visible = true;
    const first = handle(), second = handle();
    const wake = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const fullscreen = vi.fn(async () => undefined), persist = vi.fn(async () => true), resume = vi.fn();
    const support = new DeviceSupport({ visible: () => visible, wake, fullscreen, persist });
    support.play(resume); support.play(resume);
    expect(resume).toHaveBeenCalledTimes(2); expect(fullscreen).toHaveBeenCalledTimes(2); expect(persist).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(wake).toHaveBeenCalledOnce());
    visible = false; support.visibilityChanged(); expect(first.release).toHaveBeenCalledOnce();
    visible = true; await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); support.visibilityChanged();
    await vi.waitFor(() => expect(wake).toHaveBeenCalledTimes(2));
  });
  it('does not throw when features are missing or denied', async () => {
    const support = new DeviceSupport({ visible: () => true, fullscreen: () => { throw Error('denied'); },
      persist: async () => { throw Error('denied'); }, wake: async () => { throw Error('denied'); } });
    expect(() => support.play(() => { throw Error('audio'); })).not.toThrow();
    await Promise.resolve(); expect(() => new DeviceSupport({ visible: () => true }).play(() => undefined)).not.toThrow();
    expect(() => initDeviceSupport(() => false)).not.toThrow();
  });
  it('holds browser back during play but lets title navigation through', () => {
    let title = false; const events = new Map<string, (event?: { state?: { oddlingsGuard: boolean } }) => void>();
    const history = { state: undefined as { oddlingsGuard: boolean } | undefined, pushState: vi.fn(), back: vi.fn() };
    vi.stubGlobal('document', { addEventListener: vi.fn() });
    vi.stubGlobal('location', { href: 'https://example.test/repo/' });
    vi.stubGlobal('history', history);
    vi.stubGlobal('window', { addEventListener: (name: string, callback: (event?: { state?: { oddlingsGuard: boolean } }) => void) => events.set(name, callback) });
    initDeviceSupport(() => title); expect(history.pushState).toHaveBeenCalledOnce();
    events.get('popstate')!(); expect(history.pushState).toHaveBeenCalledTimes(2); expect(history.back).not.toHaveBeenCalled();
    title = true; events.get('popstate')!(); expect(history.back).toHaveBeenCalledOnce();
    events.get('popstate')!({ state: { oddlingsGuard: true } }); expect(history.back).toHaveBeenCalledOnce();
    history.state = { oddlingsGuard: true }; initDeviceSupport(() => title);
    expect(history.pushState).toHaveBeenCalledTimes(2); // Reloading does not add another guard entry.
  });
});
it('changes the adult multiplication after each hold', () => {
  let previous = -1, last = '';
  for (let i = 0; i < 20; i++) {
    const c = nextParentChallenge(previous), text = `${c.a} x ${c.b}`;
    expect(text).not.toBe(last); expect(c.answer).toBe(c.a * c.b); expect(c.answer).toBeLessThan(100);
    last = text; previous = c.index;
  }
});
