// Run with the local Vite server: pnpm dev, then node tools/screens.mjs.
// Uses the installed Chromium. This script does not download or install browsers.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.ODDLINGS_URL ?? 'http://127.0.0.1:5199';
const output = 'test-results/screens';
await mkdir(output, { recursive: true });
const started = Date.now();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
context.setDefaultTimeout(10_000);
const page = await context.newPage();
const errors = [];
context.on('page', p => p.on('pageerror', error => errors.push(error.message)));
page.on('pageerror', error => errors.push(error.message));
const state = p => p.evaluate(() => window.__oddlings.state());
const step = (p, ms = 600) => p.evaluate(ms => window.__oddlings.advanceTime(ms), ms);
async function ready(p, scene) {
  for (let i = 0; i < 120; i++) {
    const s = await state(p);
    if ((!scene || s.scene === scene) && !s.busy && !s.pendingSaves) return s;
    await step(p, 180); await p.waitForTimeout(5);
  }
  throw new Error(`Did not reach ${scene}: ${JSON.stringify(await state(p))}`);
}
async function click(p, id, ms = 600) {
  const s = await state(p), c = s.controls.find(c => c.id === id);
  if (!c?.enabled) throw new Error(`No active ${id} in ${s.scene}`);
  await p.mouse.click(c.x, c.y); await step(p, ms);
}
const shot = (p, name) => p.screenshot({ path: `${output}/${name}.png` });
async function launch(p, path) {
  await p.goto(`${base}/${path}`);
  await p.waitForFunction(() => window.__oddlings && window.__oddlings.state().scene !== 'boot');
  await step(p, 400);
}
async function warmup(p, screenshot = false) {
  await ready(p, 'warmup'); await step(p, 400);
  if (screenshot) await shot(p, 'warmup');
  for (let i = 0; i < 5; i++) await click(p, `answer-${(await state(p)).correctAnswer}`);
  await ready(p, 'map');
}
async function story(p, screenshot) {
  await ready(p, 'story');
  let n = 0;
  while ((await state(p)).scene === 'story') {
    if (screenshot && (await state(p)).stop === 'tf-mist' && (await state(p)).line === 1) await step(p, 450);
    if (screenshot) await shot(p, `${screenshot}-${++n}`);
    await click(p, 'next', 200); await ready(p);
  }
}
let modeled = false, plain = false, corrected = false, correct = false, cleared = false;
async function encounter(p, name) {
  await ready(p, 'encounter');
  if ((await state(p)).intro) {
    await shot(p, `muddle-intro-${name}`); await click(p, 'intro-continue', 520);
    // About 300 ms after the question finishes appearing, for the cloud-clipping review.
    await shot(p, `early-question-${name}`);
  }
  let deliberateMiss = false;
  for (let i = 0; i < 140; i++) {
    const s = await state(p);
    if (s.scene === 'reward') {
      await step(p, 700); await shot(p, `reward-${name}`);
      if (s.joinedPals.length > 1) await shot(p, `reward-new-pals-${name}`);
      return;
    }
    if (s.phase === 'complete' && !cleared) { await shot(p, 'muddle-cleared'); cleared = true; }
    if (!s.inputAccepted) { await step(p, 200); await p.waitForTimeout(5); continue; }
    if (s.presentation === 'modeled' && !modeled) { await shot(p, 'question-modeled'); modeled = true; }
    if (s.presentation === 'plain' && !s.modelVisible && !plain) { await shot(p, 'question-plain'); plain = true; }
    if (!corrected && !deliberateMiss) {
      await click(p, `answer-${(s.correctAnswer + 1) % 21}`, 400);
      await shot(p, 'second-try');
      await click(p, `answer-${(s.correctAnswer + 2) % 21}`, 400);
      await shot(p, 'wrong-answer-correction'); corrected = true; deliberateMiss = true;
    } else {
      await click(p, `answer-${s.correctAnswer}`, s.phase === 'correction' ? 400 : 220);
      if (s.phase !== 'correction' && !correct) { await shot(p, 'after-correct-answer'); correct = true; }
      // Keep the zero-meter state on screen before its automatic transition.
      if ((await state(p)).phase === 'complete') {
        await shot(p, `earned-dots-flying-${name}`);
        await step(p, 600); await shot(p, `muddle-cleared-${name}`); cleared = true;
      }
      await step(p, 900);
    }
  }
  throw new Error(`Encounter ${name} did not end`);
}
async function captureAll() {
  // Hold one local image response to capture the real preload screen.
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/art/tenny.png', async route => { await held; await route.continue(); });
  await page.goto(`${base}/?fresh=1&seed=123`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__oddlings?.state().scene === 'boot' && window.__oddlings.state().onScreen?.length);
  await shot(page, 'boot'); release();
  await page.waitForFunction(() => window.__oddlings.state().scene === 'title');
  await page.unroute('**/assets/art/tenny.png'); await step(page, 400);
  await shot(page, 'title');
  const c = (await state(page)).controls.find(c => c.id === 'grownups');
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await step(page, 3200); await page.mouse.up();
  await shot(page, 'grown-ups'); await click(page, 'close');
  await click(page, 'play'); await ready(page, 'choosePartner'); await shot(page, 'choose-partner');
  for (const id of ['tenny', 'domi', 'inch']) {
    await click(page, id, 2400); await shot(page, `partner-${id}-pattern`);
  }
  await click(page, 'tenny'); await click(page, 'pick'); await warmup(page, true);
  await shot(page, 'map-start');
  await click(page, 'oddbook'); await ready(page, 'oddbook'); await shot(page, 'oddbook-first-pal');
  await click(page, 'back'); await ready(page, 'map');
  let completedPath = false;
  for (let n = 0; n < 30; n++) {
    const map = await ready(page, 'map');
    await shot(page, `path-${n}`);
    if (map.banner) await shot(page, `known-skip-banner-${n}`);
    const stop = map.stops.find(s => s.state === 'current');
    if (stop.type === 'gate') { completedPath = true; break; }
    await click(page, stop.id);
    if (stop.type === 'story') await story(page, stop.id === 'pp-ring' ? 'ring-story' : 'welcome-story');
    else { await encounter(page, `skill-${n}`); await click(page, 'map'); }
    await ready(page, 'map');
  }
  if (!completedPath) throw new Error('Path did not finish in 30 encounters');
  await shot(page, 'map-complete');
  await click(page, 'oddbook'); await ready(page, 'oddbook'); await shot(page, 'oddbook-area-one-pals');
  await click(page, 'back'); await ready(page, 'map');
  await click(page, 'home'); await ready(page, 'camp'); await shot(page, 'camp');
  await click(page, 'pet-fivel', 160); await shot(page, 'camp-pet-heart');
  await click(page, 'keepGoing'); await ready(page, 'map');
  await click(page, 'pp-gate'); await ready(page, 'map'); await shot(page, 'gate-one-to-twin-falls');
  if ((await state(page)).modal && (await state(page)).arrivalJoined.length) {
    await shot(page, 'twin-falls-arrival-new-pal'); await click(page, 'close');
    await shot(page, 'twin-falls-arrival-stars');
  }
  if ((await state(page)).area !== 2) throw new Error('Gate one did not open Twin Falls');
  let completedTwin = false;
  for (let n = 0; n < 30; n++) {
    const map = await ready(page, 'map'); await shot(page, `twin-falls-path-${n}`);
    if (map.banner) await shot(page, `twin-falls-known-skip-banner-${n}`);
    const stop = map.stops.find(s => s.state === 'current');
    if (stop.type === 'gate') { completedTwin = true; break; }
    await click(page, stop.id);
    if (stop.type === 'story') await story(page, stop.id);
    else { await encounter(page, `twin-falls-${n}`); await click(page, 'map'); }
    await ready(page, 'map');
  }
  if (!completedTwin) throw new Error('Twin Falls did not finish in 30 encounters');
  await shot(page, 'twin-falls-complete');
  await click(page, 'home'); await ready(page, 'camp'); await shot(page, 'twin-falls-camp');
  await click(page, 'keepGoing'); await ready(page, 'map');
  await click(page, 'tf-entry'); await ready(page, 'map'); await shot(page, 'pebble-path-return');
  await click(page, 'pp-gate'); await ready(page, 'map'); await shot(page, 'twin-falls-return');
  await click(page, 'tf-gate'); await ready(page, 'map'); await shot(page, 'last-gate');
  while ((await state(page)).scene === 'map' && (await state(page)).modal) await click(page, 'close');
  if ((await state(page)).scene === 'encounter') {
    await encounter(page, 'last-gate-practice'); await click(page, 'map'); await ready(page, 'map');
  }

  // Prepared review profiles exercise every reusable model without grinding later areas.
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('oddlings-save')));
  for (const [name, factId, partner] of [
    ['ten-frame', 'add:7+3', 'tenny'], ['subtraction', 'sub:5-2', 'tenny'],
    ['number-line', 'add:4+1', 'inch'], ['domino', 'add:4+4', 'domi'],
    ['double-ten-frame', 'add:10+4', 'tenny'], ['dots-dice', 'dots:5:dice', 'bix'],
    ['dots-scattered', 'dots:5:scattered', 'fivel'], ['paired-pips', 'add:4+2', 'twoot'],
    ['resting-domi', 'sub:5-5', 'domi'], ['resting-twoot', 'sub:5-5', 'twoot'],
    ['domi-count-two', 'dots:2:dice', 'domi'], ['domi-count-four', 'dots:4:dice', 'domi'],
  ]) {
    const fixture = structuredClone(original);
    fixture.responses = [];
    fixture.team.partner = partner; if (!fixture.team.friends.includes(partner)) fixture.team.friends.push(partner);
    fixture.map.area = 1; fixture.map.clearedSpots = []; fixture.map.position = 'pp-ring'; fixture.story.completedBeats = ['welcome'];
    fixture.practice.placement.active = false;
    for (const f of Object.values(fixture.facts)) Object.assign(f, { stage: 'review', seen: 6,
      firstTryCorrect: 6, strength: 1, needsModel: false, dueAt: 9e15, lastSeenAt: 1000, provisional: false });
    fixture.facts[factId].lastSeenAt = 0;
    const gallery = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await gallery.addInitScript(json => localStorage.setItem('oddlings-save', json), JSON.stringify(fixture));
    gallery.setDefaultTimeout(10_000);
    const p = await gallery.newPage(); p.on('pageerror', error => errors.push(error.message));
    const spot = partner === 'bix' ? 'pp-see-frame' : 'pp-see-dots';
    await launch(p, '?skipIntro=1&seed=12'); await click(p, spot); await warmup(p);
    await click(p, spot); await ready(p, 'encounter'); await step(p, 400);
    if ((await state(p)).intro) { await shot(p, `muddle-intro-${name}`); await click(p, 'intro-continue', 400); }
    const s = await state(p);
    if (s.factId !== factId) throw new Error(`Gallery expected ${factId}, got ${s.factId}`);
    if (!s.modelVisible) {
      await shot(p, `plain-${name}`);
      if (!plain) await shot(p, 'question-plain');
      plain = true;
      await step(p, 8200); await shot(p, `hint-pulse-${name}`);
      await click(p, 'hint', 400);
    }
    await shot(p, `model-${name}`);
    await click(p, `answer-${(s.correctAnswer + 1) % 21}`, 400);
    await shot(p, `second-try-${name}`);
    await click(p, `answer-${(s.correctAnswer + 2) % 21}`, 400);
    await shot(p, `correction-${name}`);
    await gallery.close();
  }
  const reminder = structuredClone(original);
  reminder.map.area = 2; reminder.facts['dots:1:dice'].stage = 'learning';
  const olderReview = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await olderReview.addInitScript(json => localStorage.setItem('oddlings-save', json), JSON.stringify(reminder));
  const reviewPage = await olderReview.newPage();
  await launch(reviewPage, '?skipIntro=1&seed=12'); await ready(reviewPage, 'map');
  await shot(reviewPage, 'twin-falls-older-review-at-entry'); await olderReview.close();
  if (!modeled || !plain || !corrected || !correct || !cleared) throw new Error('Missing key encounter screenshot');
  if (errors.length) throw new Error(`Browser errors: ${errors.join('\n')}`);
  console.log(`Screenshots saved to ${output}/. Review every PNG at 1280 x 800.`);
}
let deadline;
try {
  await Promise.race([captureAll(), new Promise((_, reject) => {
    deadline = setTimeout(() => reject(new Error('Screenshot run exceeded its 120 second budget')), Math.max(1, 120_000 - (Date.now() - started)));
  })]);
  console.log(`Capture time: ${((Date.now() - started) / 1000).toFixed(1)} seconds`);
} finally { clearTimeout(deadline); await browser.close(); }
