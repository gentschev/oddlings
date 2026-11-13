import { afterEach, expect, it, vi } from 'vitest';
import { homeScreenPromptNeeded, shouldSuggestHomeScreen, type HomeScreenDevice } from '../../src/platform/homeScreen';
import { homeScreenSection } from '../../src/parent/platformInfo';
import { titleNoticesLayout, titleOfflineLayout, contains, overlaps, rectAt } from '../../src/game/layout';
import { CANVAS, LAYOUT, UI } from '../../src/game/constants';
import { PLATFORM_TEXT } from '../../src/game/strings';

const device = (patch: Partial<HomeScreenDevice>): HomeScreenDevice => ({ userAgent: '', platform: '', touchPoints: 0,
  standalone: false, displayModeStandalone: false, ...patch });
afterEach(() => vi.unstubAllGlobals());
it('shows the prompt for iPhone, iPod, iPad, and an iPadOS Mac in a browser tab', () => {
  for (const sample of [device({ userAgent: 'Mozilla iPhone Safari', platform: 'iPhone' }),
    device({ userAgent: 'Mozilla iPod Safari' }), device({ platform: 'iPad' }), device({ userAgent: 'iPad Safari' }),
    device({ userAgent: 'Mozilla Macintosh Safari', platform: 'MacIntel', touchPoints: 5 }),
    device({ platform: 'MacIntel', touchPoints: 1 }),
    device({ userAgent: 'iPhone CriOS', platform: 'iPhone' })]) expect(shouldSuggestHomeScreen(sample)).toBe(true);
});
it('hides it for both Home Screen flags, desktop Macs, Android and other platforms', () => {
  for (const flags of [{ standalone: true }, { displayModeStandalone: true }, { standalone: true, displayModeStandalone: true }])
    expect(shouldSuggestHomeScreen(device({ userAgent: 'iPhone Safari', ...flags }))).toBe(false);
  for (const sample of [device({ userAgent: 'Macintosh Safari', platform: 'MacIntel' }),
    device({ userAgent: 'Android Chrome', platform: 'Linux', touchPoints: 5 }),
    device({ userAgent: 'Windows Chrome', platform: 'Win32', touchPoints: 10 }), device({})]) expect(shouldSuggestHomeScreen(sample)).toBe(false);
});
it('reads optional browser flags without throwing when features are missing', () => {
  vi.stubGlobal('navigator', { userAgent: 'iPad', platform: 'MacIntel', maxTouchPoints: 5 });
  vi.stubGlobal('window', {}); expect(homeScreenPromptNeeded()).toBe(true);
  vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) }); expect(homeScreenPromptNeeded()).toBe(false);
  vi.stubGlobal('window', { matchMedia: () => { throw Error('unsupported'); } }); expect(homeScreenPromptNeeded()).toBe(true);
  vi.stubGlobal('navigator', undefined); expect(homeScreenPromptNeeded()).toBe(false);
});
it('only renders the parent instructions when the prompt applies', () => {
  expect(homeScreenSection(false)).toBe('');
  const section = homeScreenSection(true);
  for (const text of ['Tap Share', 'Add to Home Screen', 'new icon', 'a week of Safari use', 'Home Screen is kept']) expect(section).toContain(text);
});
it('places the Home Screen line below status and fits the badge clear of the title and both buttons', () => {
  const notices = titleNoticesLayout(), status = titleOfflineLayout(), l = LAYOUT.title, canvas = { x: 0, y: 0, ...CANVAS };
  const regions = { ...notices, status: status.bounds, play: rectAt(l.playX, l.playY, l.playW, l.playH),
    grown: rectAt(l.grownX, l.grownY, l.grownW, UI.minTouch), title: rectAt(l.titleX, l.titleY, 1000, l.titleSize + l.outline * 2) };
  const entries = Object.entries(regions);
  for (const [i, [name, region]] of entries.entries()) {
    expect(contains(canvas, region), name).toBe(true);
    for (const [other, otherRegion] of entries.slice(i + 1)) expect(overlaps(region, otherRegion), `${name} / ${other}`).toBe(false);
  }
  expect(notices.homeScreen.y).toBeGreaterThan(status.bounds.y + status.bounds.height);
  expect(PLATFORM_TEXT.homeScreen.length * l.homeScreen.font * 0.7 + l.homeScreen.padding * 2).toBeLessThan(notices.homeScreen.width);
  expect(l.homeScreen.font + l.homeScreen.padding * 2).toBeLessThanOrEqual(notices.homeScreen.height);
  expect('2026-11-13 · abcdefg'.length * l.testBadge.font * 0.7).toBeLessThan(notices.testBadge.width - l.testBadge.padding * 2);
});
