import { test, expect, type Page } from '@playwright/test';
import { launch, state, step } from './helpers';

async function cachedVoices(page: Page) {
  return page.evaluate(async () => {
    const index = await (await fetch('assets/speech/index.json')).json() as Record<string, { file: string; rev?: string }>;
    const cache = await caches.open('oddlings-speech-v1');
    const missing: string[] = [];
    for (const [id, entry] of Object.entries(index)) {
      const revision = entry.rev && /^[a-f0-9]{8}$/.test(entry.rev) ? `?v=${entry.rev}` : '';
      const url = new URL(`assets/speech/${entry.file}${revision}`, document.baseURI).href;
      if (!await cache.match(url)) missing.push(id);
    }
    return { total: Object.keys(index).length, missing };
  });
}

test('production shell and parent page load offline after worker activation', async ({ page, context }) => {
  test.skip(process.env.ODDLINGS_PREVIEW !== '1', 'Run against dist with ODDLINGS_PREVIEW=1 pnpm test:e2e');
  await launch(page);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect.poll(async () => (await state(page)).offlineText).toMatch(/^(?:Getting voices \d+ \/ \d+|Ready to play offline)$/);
  const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifest).toBe('./manifest.webmanifest');
  await expect.poll(async () => (await state(page)).offline.ready, { timeout: 60_000 }).toBe(true);
  const voices = await cachedVoices(page);
  expect(voices.total).toBeGreaterThan(0); expect(voices.total).toBe((await state(page)).offline.total);
  expect(voices.missing).toEqual([]);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.__oddlings?.state().scene === 'title');
  await page.goto('/parent.html');
  await expect(page.locator('h1')).toContainText('progress');
  await expect(page.locator('#storage-notice h2')).toHaveText('What this game stores');
  await expect(page.locator('#offline-status')).toBeVisible();
  await expect(page.locator('#offline-status')).toHaveText(`Ready to play offline. ${voices.total} / ${voices.total} voices stored.`, { timeout: 10_000 });
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', './manifest.webmanifest');
});

test('the title updates to ready when every indexed voice is stored and the worker controls it', async ({ page, context, browserName }) => {
  test.skip(process.env.ODDLINGS_PREVIEW !== '1', 'Needs the production worker');
  // Playwright intercepts a worker's requests only in Chromium. On WebKit the real index
  // is used, and the game was seen to store all 900 clips there.
  test.skip(browserName !== 'chromium', 'Needs request interception inside workers');
  // A tiny catalogue checks real cache status without downloading 900 recordings.
  await context.route('**/assets/speech/index.json', route => route.fulfill({ json: {
    'ui-play': { file: 'ui-play.m4a', rev: '11111111' }, 'ui-next': { file: 'ui-next.m4a', rev: '11111111' },
  } }));
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await context.route('**/assets/speech/*.m4a*', async route => {
    if (route.request().url().includes('ui-next.m4a')) await held;
    await route.fulfill({ status: 200, contentType: 'audio/mp4', body: 'test clip' });
  });
  await launch(page); await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await expect.poll(async () => (await state(page)).offline).toEqual({ stored: 1, total: 2, ready: false });
  await step(page, 50);
  expect((await state(page)).offlineText).toBe('Getting voices 1 / 2');
  await page.screenshot({ path: 'test-results/offline-getting-voices.png' });
  release(); await expect.poll(async () => (await state(page)).offline.ready).toBe(true);
  const cached = await cachedVoices(page);
  expect(cached).toEqual({ total: 2, missing: [] });
  await step(page, 50); expect((await state(page)).offlineText).toBe('Ready to play offline');
  await page.screenshot({ path: 'test-results/offline-ready.png' });
  const version = (await state(page)).version;
  await context.setOffline(true); await page.goto('/parent.html');
  await expect(page.locator('#offline-status')).toHaveText('Ready to play offline. 2 / 2 voices stored.');
  await expect(page.locator('#build-version')).toHaveText(`Build ${version}`);
});
