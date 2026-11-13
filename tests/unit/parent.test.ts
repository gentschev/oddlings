import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../../src/core/constants';
import { FACTS, FACT_SETS, getSet, SKILLS, taxonomy } from '../../src/core/curriculum/sets';
import { applyAnswer } from '../../src/core/learner';
import { placementProbes, recordPlacement } from '../../src/core/placement';
import { seededRandom } from '../../src/core/random';
import { createSave, exportSave, importSave } from '../../src/core/save';
import { logResponse, startSession, touchSession } from '../../src/core/sessions';
import type { Save } from '../../src/core/types';
import { dailyQuestions, factView, gridView, parentModel, sessionRows, skillTree } from '../../src/parent/model';

const NOW = Date.UTC(2026, 10, 12, 12);
function answer(save: Save, id: string, time: number, correct = true, latency = 1200, hintUsed = false, encounterId = `encounter-${time}`) {
  const result = applyAnswer(save.facts[id]!, { now: time, localDate: new Date(time).toISOString().slice(0, 10),
    encounterId, correct, hintUsed, latency, hidden: false }, save.profile.tapBaseline);
  save.facts[id] = result.fact;
  logResponse(save, { factId: id, time, correct, firstTryCorrect: result.firstTryCorrect,
    neededHelp: hintUsed, latency: latency <= 20_000 ? latency : null, mode: 'plain', score: result.score,
    encounterId, setId: FACT_SETS.find(s => s.facts.includes(id))!.id }, result.enteredReview, result.becameFluent);
}
function acquire(save: Save, id: string, time: number) {
  for (let i = 0; i < 3; i++) answer(save, id, time + i * 1500);
}
function prepared(): Save {
  const save = createSave();
  save.practice.placement.active = false;
  for (let day = 2; day >= 0; day--) {
    startSession(save, NOW - day * DAY_MS - 60_000);
    answer(save, 'add:0+0', NOW - day * DAY_MS - 50_000);
    touchSession(save, NOW - day * DAY_MS);
  }
  acquire(save, 'add:1+1', NOW - 40_000);
  answer(save, 'add:2+2', NOW - 30_000, false);
  acquire(save, 'sub:4-2', NOW - 20_000);
  answer(save, 'sub:4-2', NOW - 10_000, false);
  touchSession(save, NOW);
  return importSave(exportSave(save));
}

describe('parent summary and learning view', () => {
  it('counts distinct facts once, separates accurate from fluent, and identifies the learning window', () => {
    const vm = parentModel(prepared(), NOW);
    expect(vm.counts).toEqual({ fluent: 1, accurate: 1, learning: 2, 'not started': FACTS.size - 4 });
    expect(Object.values(vm.counts).reduce((a, b) => a + b, 0)).toBe(FACTS.size);
    expect(vm.recentMinutes).toBe('3.0');
    expect(vm.recentQuestions).toBe(11);
    expect(vm.learning.map(f => f.id)).toEqual(expect.arrayContaining(['add:2+2', 'sub:4-2']));
    expect(vm.learning).toHaveLength(2);
    expect(vm.introductions.map(s => s.id)).toContain('see-dots');
    expect(vm.placement).toBeNull();
  });
  it('handles an empty save without starting a session or mutating it', () => {
    const save = createSave();
    const before = exportSave(save);
    const vm = parentModel(save, NOW);
    expect(vm.counts['not started']).toBe(FACTS.size);
    expect(vm.recentQuestions).toBe(0);
    expect(vm.recentMinutes).toBe('0.0');
    expect(vm.sessions).toEqual([]);
    expect(vm.learning).toEqual([]);
    expect(vm.placement?.id).toBe('see-dots');
    expect(exportSave(save)).toBe(before);
    expect(parentModel(save, NOW)).toEqual(vm);
  });
  it('does not claim unconfirmed placement facts are accurate', () => {
    const save = createSave();
    startSession(save, NOW);
    const probes = placementProbes(save, seededRandom(3));
    probes.forEach(id => recordPlacement(save, id, true, NOW));
    const provisional = Object.values(save.facts).filter(f => f.provisional);
    expect(provisional.length).toBeGreaterThan(0);
    for (const f of provisional) expect(factView(save, f.id, NOW)).toMatchObject({ state: 'learning', provisional: true });
    expect(parentModel(save, NOW).counts.learning).toBeGreaterThanOrEqual(provisional.length);
  });
  it('uses full session totals even if the response log has been emptied or capped', () => {
    const save = prepared();
    save.responses = [];
    expect(parentModel(save, NOW).recentQuestions).toBe(11);
    expect(sessionRows(save, NOW)[0]!.questions).toBe(9);
  });
});

describe('parent fact grids and histories', () => {
  it('renders all ordered additions and only tracked, nonnegative subtractions', () => {
    const save = prepared();
    const add = gridView(save, 'add', NOW);
    expect(add.columns).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(add.rows).toHaveLength(11);
    expect(add.rows.flatMap(r => r.cells).filter(c => c.fact)).toHaveLength(121);
    expect(add.rows[0]!.cells[0]!.fact?.state).toBe('fluent');
    expect(add.rows[1]!.cells[1]!.fact?.state).toBe('accurate');
    expect(add.rows[2]!.cells[2]!.fact?.state).toBe('learning');
    expect(add.rows[10]!.cells[10]!.fact?.state).toBe('not started');
    expect(add.rows[1]!.cells[0]!.fact?.id).not.toBe(add.rows[0]!.cells[1]!.fact?.id);
    const sub = gridView(save, 'sub', NOW);
    expect(sub.rows).toHaveLength(21);
    expect(sub.rows[0]!.cells[1]).toMatchObject({ valid: false, outsideCurriculum: false, fact: null });
    expect(sub.rows[20]!.cells[0]).toMatchObject({ valid: true, outsideCurriculum: true, fact: null });
    expect(sub.rows[20]!.cells[10]!.fact?.id).toBe('sub:20-10');
    expect(sub.rows.flatMap(r => r.cells).filter(c => c.fact)).toHaveLength(121);
    expect(sub.rows[4]!.cells[2]!.fact).toMatchObject({ state: 'learning', needsReview: true });
    expect(add.rows[2]!.cells[2]!.fact?.needsReview).toBe(false);
  });
  it('shows lifetime counts, median correct timings, due dates and latest five response results', () => {
    const save = prepared();
    const f = factView(save, 'sub:4-2', NOW);
    expect(f.seen).toBe(4);
    expect(f.accuracy).toBe('75%');
    expect(f.medianLatency).toBe('1.20 s');
    expect(f.nextReview).toBe('Not scheduled');
    expect(f.recentResponses[0]!.result).toBe('Incorrect');
    const accurate = factView(save, 'add:1+1', NOW);
    expect(accurate.nextReview).toContain('2026-11-13');
    expect(accurate.nextReview).not.toContain('(due)');
    expect(factView(save, 'add:1+1', NOW + 2 * DAY_MS).nextReview).toContain('(due)');
    expect(factView(save, 'add:10+10', NOW).medianLatency).toBe('No recorded correct timings');
    for (let i = 0; i < 6; i++) answer(save, 'add:1+1', NOW + i * 1000, true, 1000 + 100 * i, i === 5);
    const recent = factView(save, 'add:1+1', NOW + DAY_MS);
    expect(recent.recentResponses).toHaveLength(5);
    expect(recent.recentResponses[0]!.result).toBe('Needed help');
    expect(recent.recentResponses[0]!.latency).toBe('1.50 s');
    expect(recent.medianLatency).toBe('1.20 s');
  });
});

describe('parent skill graph', () => {
  it('uses core set levels and the lowest level of each skill, including later sets', () => {
    const save = createSave();
    startSession(save, NOW);
    for (const id of getSet('see-dots').facts.slice(0, 9)) acquire(save, id, NOW);
    let tree = skillTree(save);
    expect(tree.nodes.find(n => n.id === SKILLS.dots)?.state).toBe('accurate');
    for (const id of getSet('see-dots').facts.slice(0, 9)) {
      answer(save, id, NOW + DAY_MS);
      answer(save, id, NOW + 2 * DAY_MS);
    }
    for (const id of getSet('see-frame').facts) acquire(save, id, NOW);
    tree = skillTree(save);
    expect(tree.nodes.find(n => n.id === SKILLS.dots)?.state).toBe('fluent');
    const parts = tree.nodes.find(n => n.id === SKILLS.parts)!;
    expect(parts.sets.find(s => s.id === 'see-frame')?.state).toBe('accurate');
    expect(parts.sets.find(s => s.id === 'add-five-and')?.state).toBe('not started');
    expect(parts.state).toBe('not started');
    expect(tree.nodes.find(n => n.id === SKILLS.within5)?.codes).toBe('K.OA.5');
  });
  it('preserves all 11 topics, descriptions, evidence and typed prerequisite edges, laid out top to bottom', () => {
    const tree = skillTree(createSave());
    expect(tree.nodes).toHaveLength(11);
    expect(tree.edges).toHaveLength(taxonomy.prerequisites.length);
    for (const node of tree.nodes) {
      const source = taxonomy.topics.find(t => t.id === node.id)!;
      expect(node.description).toBe(source.description);
      expect(node.evidence).toEqual(source.evidence);
      expect(node.x + node.width).toBeLessThanOrEqual(tree.width);
      expect(node.y + node.height).toBeLessThanOrEqual(tree.height);
      expect(node.lines.join(' ')).toBe(node.name);
    }
    for (const edge of tree.edges) {
      const from = tree.nodes.find(n => n.id === edge.prerequisiteId)!;
      const to = tree.nodes.find(n => n.id === edge.topicId)!;
      expect(from.y + from.height).toBeLessThan(to.y);
      expect(['hard', 'soft']).toContain(edge.strength);
    }
  });
});

describe('parent sessions and daily chart', () => {
  it('shows newest sessions first with minutes, first-try accuracy and named mastery changes', () => {
    const rows = sessionRows(prepared(), NOW);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ date: '2026-11-12 11:59 UTC', minutes: '1.0', questions: 9, accuracy: '78%' });
    expect(rows[0]!.enteredReview).toEqual(expect.arrayContaining(['0 + 0 = 0', '1 + 1 = 2', '4 − 2 = 2']));
    expect(rows[0]!.becameFluent).toEqual(['0 + 0 = 0']);
    expect(rows[2]!.date).toBe('2026-11-10 11:59 UTC');
  });
  it('limits rows to 14, includes zero-question sessions, and excludes future sessions and old summary activity', () => {
    const save = createSave();
    for (let i = 16; i >= 0; i--) {
      startSession(save, NOW - i * DAY_MS);
      if (i % 2 === 0) answer(save, 'add:0+0', NOW - i * DAY_MS + 1000);
      touchSession(save, NOW - i * DAY_MS + 60_000);
    }
    startSession(save, NOW + DAY_MS);
    const rows = sessionRows(save, NOW);
    expect(rows).toHaveLength(14);
    expect(rows[0]!.date).toBe('2026-11-12 12:00 UTC');
    expect(rows[0]!.minutes).toBe('0.0');
    expect(rows[1]!.accuracy).toBe('No answers yet');
    expect(rows[13]!.date).toBe('2026-10-30 12:00 UTC');
    const vm = parentModel(save, NOW);
    expect(vm.recentQuestions).toBe(4);
    expect(vm.recentMinutes).toBe('7.0');
    expect(vm.days).toHaveLength(14);
    expect(vm.days[0]!.date).toBe('2026-10-30');
    expect(vm.days.at(-1)).toMatchObject({ date: '2026-11-12', questions: 1 });
  });
  it('groups whole sessions by their UTC start day, including sessions spanning midnight', () => {
    const save = createSave();
    startSession(save, Date.UTC(2026, 10, 11, 23, 59));
    answer(save, 'add:0+0', Date.UTC(2026, 10, 12, 0, 1));
    const days = dailyQuestions(save, NOW);
    expect(days.at(-2)?.questions).toBe(1);
    expect(days.at(-1)?.questions).toBe(0);
    expect(dailyQuestions(createSave(), NOW).every(d => d.height === 0 && Number.isFinite(d.y))).toBe(true);
  });
});
