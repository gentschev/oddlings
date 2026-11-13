import { test, expect } from '@playwright/test';
import { click, launch, ready, state, step } from './helpers';

test('loads local art, fits the tablet, and exposes deterministic hooks and fresh flags', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const external: string[] = [];
  page.on('request', request => { if (!/^(?:blob:|data:|http:\/\/127\.0\.0\.1:5199(?:\/|$))/.test(request.url())) external.push(request.url()); });
  await launch(page);
  await expect(page.locator('canvas')).toHaveAttribute('width', '1280');
  await expect(page.locator('canvas')).toHaveAttribute('height', '800');
  expect(await state(page)).toMatchObject({ scene: 'title', profile: { partner: null } });
  expect((await state(page)).version).toMatch(/^\d{4}-\d{2}-\d{2} · (?:[a-f0-9]{7}|dev)$/);
  if (process.env.ODDLINGS_PREVIEW !== '1') expect(await state(page)).toMatchObject({ offlineText: '', offline: { stored: 0, total: 0, ready: false } });
  expect(await page.evaluate(() => document.fonts.check('800 48px "Baloo 2"'))).toBe(true);
  const before = (await state(page)).clock;
  await step(page, 1000); expect((await state(page)).clock).toBe(before + 1000);
  // A press that slides off the button does nothing; a plain tap opens the question.
  const grown = (await state(page)).controls.find(c => c.id === 'grownups')!;
  await page.mouse.move(grown.x, grown.y); await page.mouse.down(); await step(page, 300);
  await page.mouse.move(20, 20); await page.mouse.up(); await step(page, 300);
  expect((await state(page)).modal).toBe(false);
  await click(page, 'grownups'); expect((await state(page)).modal).toBe(true); await click(page, 'close');
  expect((await state(page)).modal).toBe(false);
  await page.screenshot({ path: 'test-results/boot-title.png' });
  await launch(page, '/?seed=123&fresh=1&skipIntro=1'); await ready(page, 'map');
  const map = await state(page);
  expect(map.stops).toHaveLength(12);
  expect(map.stops.filter(s => s.next).map(s => s.id)).toEqual(['pp-welcome']);
  expect(map.stops[0]!.x).toBeCloseTo(424 * 1280 / 1536);
  expect(map.stops[0]!.y).toBeCloseTo(921 * 1280 / 1536);
  await page.screenshot({ path: 'test-results/boot-map.png' });
  expect(map.stops.find(s => s.type === 'gate')!.open).toBe(false);
  await click(page, 'pp-gate'); expect((await state(page)).modal).toBe(true);
  expect((await state(page)).completedBeats).not.toContain('gate');
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test('the adult gate changes after a wrong answer and opens the existing parent page', async ({ page }) => {
  await launch(page);
  const version = (await state(page)).version;
  const holdGate = async () => {
    // A plain tap opens the question; no hold.
    await click(page, 'grownups');
    return (await state(page)).gate!;
  };
  const first = await holdGate();
  await click(page, 'parent-0'); await click(page, 'parent-go');
  expect((await state(page)).modal).toBe(false);
  const second = await holdGate();
  expect([second.a, second.b]).not.toEqual([first.a, first.b]);
  for (const digit of String(second.a * second.b)) await click(page, `parent-${digit}`);
  const go = (await state(page)).controls.find(c => c.id === 'parent-go')!;
  await Promise.all([page.waitForURL('**/parent.html'), page.mouse.click(go.x, go.y)]);
  await expect(page.locator('h1')).toContainText('progress');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('#build-version')).toHaveText(`Build ${version}`);
  await expect(page.locator('#storage-notice h2')).toHaveText('What this game stores');
  await expect(page.locator('#storage-notice')).toContainText('no accounts, no adverts and no tracking');
  await expect(page.locator('#storage-notice')).toContainText('GitHub Pages');
  if (process.env.ODDLINGS_PREVIEW !== '1') await expect(page.locator('#offline-status')).toBeHidden();
});
