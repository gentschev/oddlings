import { expect, type Page } from '@playwright/test';
import { createSave, newFactState } from '../../src/core';

export interface Snapshot {
  version: string; offline: { stored: number; total: number; ready: boolean }; offlineText?: string;
  arrivalJoined: string[];
  area: number; background: string; speaker: string; listener: string; line: number;
  wallsHighlighted: boolean; pageHighlighted: boolean; shapeShown: boolean; shapeGone: boolean;
  entry: { id: string; needsHelp: boolean } | null;
  gate?: { a: number; b: number; entered: string }; scene: string; busy: boolean; modal: boolean; clock: number; selected?: string;
  correctAnswer: number; inputAccepted: boolean; taps: number; meter: number; initialMeter: number;
  leaving: boolean; pad: Snapshot['controls']; disabledAnswers: number[]; banner: string; passedOver: number;
  phase: string; factId: string; questionText: string; question: { text: string }; onScreen: string[]; presentation: string;
  modelVisible: boolean; hintPulsing: boolean; responses: number;
  intro: boolean; slots: boolean[]; friendRestored: boolean; speechId: string; feedback: string;
  helped: string[]; joinedPals: string[]; shownPals: string[]; team: string[]; clearedSpots: string[]; completedBeats: string[];
  pendingSaves: number; saveError: boolean; nextStop: string;
  profile: { partner: string; tapBaseline: number };
  partner?: string; partnerPattern?: string;
  helperPatternMode: string; wildPatternMode: string;
  returning: boolean; replay: boolean; reviewOnly: boolean; completed: string[]; markerIndex: number; wild: string;
  cards?: { id: string; met: boolean; partner: boolean; progress: { total: number; review: number; fluent: number } | null }[];
  controls: { id: string; x: number; y: number; width: number; height: number; enabled: boolean }[];
  stops: { id: string; type: string; completed: boolean; next: boolean; x: number; y: number;
    open?: boolean; pulsing?: boolean; state?: string; progress?: number; needsHelp?: boolean; pal?: string; set?: string; tag?: string }[];
}
export async function state(page: Page): Promise<Snapshot> {
  return page.evaluate(() => window.__oddlings.state()) as unknown as Promise<Snapshot>;
}
export async function step(page: Page, ms = 600): Promise<void> {
  await page.evaluate(ms => window.__oddlings.advanceTime(ms), ms);
}
export async function ready(page: Page, scene?: string): Promise<Snapshot> {
  for (let i = 0; i < 80; i++) {
    const s = await state(page);
    if ((!scene || s.scene === scene) && !s.busy && !s.pendingSaves) return s;
    await step(page, 180);
    await page.waitForTimeout(5); // Yield for IndexedDB, not game time.
  }
  throw new Error(`Scene did not settle: ${JSON.stringify(await state(page))}`);
}
export async function click(page: Page, id: string, ms = 600, touch = false): Promise<void> {
  const s = await state(page), control = s.controls.find(c => c.id === id);
  expect(control, `Missing control ${id} in ${s.scene}`).toBeDefined();
  expect(control!.enabled, `${id} disabled`).toBe(true);
  if (touch) await page.touchscreen.tap(control!.x, control!.y);
  else await page.mouse.click(control!.x, control!.y);
  await step(page, ms);
}
export async function launch(page: Page, url = '/?seed=123&fresh=1'): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => window.__oddlings && window.__oddlings.state().scene !== 'boot');
  await step(page, 400);
}
export async function warmup(page: Page, touch = false): Promise<void> {
  await ready(page, 'warmup'); await step(page, 400);
  for (let i = 0; i < 5; i++) {
    const s = await state(page);
    expect(s.scene).toBe('warmup'); expect(s.inputAccepted).toBe(true);
    await click(page, `answer-${s.correctAnswer}`, 600, touch);
  }
  await ready(page, 'map');
}
export async function story(page: Page): Promise<void> {
  await ready(page, 'story');
  while ((await state(page)).scene === 'story') {
    await click(page, 'next'); await ready(page);
  }
  await ready(page, 'map');
}
export async function questionReady(page: Page): Promise<Snapshot> {
  await ready(page, 'encounter');
  if ((await state(page)).intro) await click(page, 'intro-continue', 300);
  for (let i = 0; i < 60; i++) {
    const s = await state(page);
    if (s.scene === 'encounter' && s.inputAccepted) return s;
    await step(page, 180);
  }
  throw new Error(`Question did not become ready: ${JSON.stringify(await state(page))}`);
}
export async function finishEncounter(page: Page, wrong = false): Promise<void> {
  await questionReady(page);
  let missed = false;
  for (let i = 0; i < 100; i++) {
    const s = await state(page);
    if (s.scene !== 'encounter') { await ready(page, 'reward'); return; }
    if (!s.inputAccepted) { await step(page, 800); await page.waitForTimeout(5); continue; }
    if (wrong && !missed) {
      const responses = s.responses, meter = s.meter, id = s.factId;
      await click(page, `answer-${(s.correctAnswer + 1) % 21}`, 400);
      const second = await state(page);
      expect(second).toMatchObject({ phase: 'second', meter, modelVisible: true, factId: id, responses: responses + 1, disabledAnswers: [(s.correctAnswer + 1) % 21] });
      await click(page, `answer-${(s.correctAnswer + 2) % 21}`, 400);
      const correction = await state(page);
      expect(correction).toMatchObject({ phase: 'correction', meter, modelVisible: true, factId: id, responses: responses + 1 });
      await click(page, `answer-${correction.correctAnswer}`, 400);
      expect((await state(page)).responses).toBe(responses + 1);
      missed = true;
    } else await click(page, `answer-${s.correctAnswer}`, 1100);
  }
  throw new Error('Encounter did not clear');
}
/** A prepared, mastered profile makes the first question a reproducible plain review. */
export function reviewFixture(factId = 'add:4+1') {
  const save = createSave();
  for (const id of Object.keys(save.facts)) save.facts[id] = { ...newFactState(id), stage: 'review',
    seen: 6, firstTryCorrect: 6, strength: 1, needsModel: false, dueAt: 9e15, lastSeenAt: 1000 };
  save.facts[factId]!.lastSeenAt = 0;
  save.team = { partner: 'tenny', friends: ['tenny'], helped: [] }; save.story.introComplete = true;
  save.practice.placement.active = false;
  return save;
}
