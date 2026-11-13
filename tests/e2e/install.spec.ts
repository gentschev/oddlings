import { expect, test } from '@playwright/test';
import { launch } from './helpers';

for (const standalone of [false, true]) test(`iPadOS ${standalone ? 'Home Screen' : 'tab'} has the right install notice`, async ({ page }) => {
  await page.addInitScript(standalone => {
    Object.defineProperties(navigator, { userAgent: { get: () => 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15' },
      platform: { get: () => 'MacIntel' }, maxTouchPoints: { get: () => 5 }, standalone: { get: () => standalone } });
  }, standalone);
  await launch(page);
  const snapshot = await page.evaluate(() => window.__oddlings.state());
  expect(snapshot.channel).toBe('main');
  if (standalone) expect(snapshot.onScreen).not.toContain('Add to Home Screen to keep progress');
  else expect(snapshot.onScreen).toContain('Add to Home Screen to keep progress');
  await page.screenshot({ path: `test-results/install-title-${standalone ? 'home' : 'tab'}.png` });
  await page.goto('/parent.html'); await expect(page.locator('h1')).toContainText('progress');
  if (standalone) await expect(page.locator('#home-screen')).toHaveCount(0);
  else {
    await expect(page.locator('#home-screen')).toContainText('Tap Share, then Add to Home Screen');
    await expect(page.locator('#home-screen')).toContainText('a week of Safari use');
    await page.locator('#home-screen').screenshot({ path: 'test-results/install-parent-tab.png' });
  }
  await expect(page.locator('#copy-main')).toHaveCount(0);
  await expect(page.locator('#parent-mode')).toHaveText('For grown-ups');
});
