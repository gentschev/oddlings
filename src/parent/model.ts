import { treeLayout } from './treeLayout';
import { DAY_MS } from '../core/constants';
import { FACTS, FACT_SETS, getFact, taxonomy } from '../core/curriculum/sets';
import type { Fact } from '../core/curriculum/facts';
import { isFluent, median } from '../core/learner';
import { introductionSets, setLevel, setPassed, skillMastery } from '../core/mastery';
import type { Level } from '../core/mastery';
import type { FactState, Save } from '../core/types';

export const LEVELS = ['not started', 'learning', 'accurate', 'fluent'] as const;
export type State = typeof LEVELS[number];
const SYMBOLS = ['○', '◐', '✓', '★'] as const;
const REPORT_DAYS = 14;
const MINUTE_MS = 60_000;


export function stateOf(fact: FactState): State {
  if (fact.provisional) return 'learning';
  if (isFluent(fact)) return 'fluent';
  if (fact.stage === 'review') return 'accurate';
  return fact.stage === 'learning' || fact.seen > 0 ? 'learning' : 'not started';
}
function status(level: Level) {
  return { level, state: LEVELS[level], symbol: SYMBOLS[level], className: `state-${level}` };
}
function factStatus(fact: FactState) {
  return status(LEVELS.indexOf(stateOf(fact)) as Level);
}
function percentage(correct: number, seen: number): string {
  return seen ? `${Math.round(100 * correct / seen)}%` : 'No answers yet';
}
function minutes(ms: number): string { return (Math.max(0, ms) / MINUTE_MS).toFixed(1); }
function seconds(ms: number): string { return `${(ms / 1000).toFixed(2)} s`; }
function date(time: number): string { return new Date(time).toISOString().slice(0, 10); }
function dateTime(time: number): string { return `${new Date(time).toISOString().slice(0, 16).replace('T', ' ')} UTC`; }
function factName(fact: Fact): string {
  switch (fact.operation) {
    case 'add': return `${fact.a} + ${fact.b} = ${fact.answer}`;
    case 'sub': return `${fact.a} − ${fact.b} = ${fact.answer}`;
    case 'miss': return `${fact.a} + ? = ${fact.b} (answer ${fact.answer})`;
    case 'dots': return `${fact.a} dots (${fact.layout})`;
    case 'frame': return `Ten frame: ${fact.a}`;
  }
}
export function factView(save: Save, id: string, now: number) {
  const fact = save.facts[id]!;
  const recent = save.responses.filter(r => r.factId === id).slice(-5).reverse();
  return {
    id, name: factName(getFact(id)), ...factStatus(fact),
    needsReview: fact.stage === 'learning' && fact.lapses > 0,
    provisional: fact.provisional, seen: fact.seen,
    accuracy: percentage(fact.firstTryCorrect, fact.seen),
    medianLatency: fact.latencies.length ? seconds(median(fact.latencies)) : 'No recorded correct timings',
    nextReview: fact.dueAt === null ? 'Not scheduled' : `${dateTime(fact.dueAt)}${fact.dueAt <= now ? ' (due)' : ''}`,
    lapses: fact.lapses,
    recentResponses: recent.map(r => ({
      date: dateTime(r.time), latency: r.latency === null ? 'Not recorded' : seconds(r.latency),
      result: r.neededHelp ? 'Needed help' : r.firstTryCorrect ? 'First-try correct' : 'Incorrect',
    })),
  };
}
export type FactView = ReturnType<typeof factView>;
function setView(save: Save, id: string) {
  const set = FACT_SETS.find(s => s.id === id)!;
  const level = setLevel(save, id), placed = level < 2 && setPassed(save, id);
  return { id, name: id.replaceAll('-', ' '), count: set.facts.length, ...status(level),
    passed: setPassed(save, id), placed, state: placed ? 'placed, being checked' : LEVELS[level],
    introduction: save.practice.interleaved.includes(id) ? 'Mixed practice' : 'Practised on its own first' };
}
function wrap(text: string): string[] {
  const lines: string[] = [];
  for (const word of text.split(' ')) {
    const last = lines.at(-1);
    if (last && last.length + word.length < 32) lines[lines.length - 1] += ` ${word}`;
    else lines.push(word);
  }
  return lines;
}
export function skillTree(save: Save) {
  const layout = treeLayout(taxonomy.topics.map(t => t.id), taxonomy.prerequisites);
  const nodes = layout.nodes.map(node => {
    const topic = taxonomy.topics.find(t => t.id === node.id)!;
    return { ...node, name: topic.name, lines: wrap(topic.name), description: topic.description,
      evidence: [...topic.evidence], codes: topic.commonCore.join(', '),
      ...status(skillMastery(save, topic.id) ?? 0),
      sets: FACT_SETS.filter(s => s.skillId === topic.id).map(s => setView(save, s.id)) };
  });
  return { ...layout, nodes, edges: layout.edges.map((edge, i) => ({ ...taxonomy.prerequisites[i]!, ...edge })) };
}

export function gridView(save: Save, operation: 'add' | 'sub', now: number) {
  const columns = Array.from({ length: 11 }, (_, i) => i);
  const rows = Array.from({ length: operation === 'add' ? 11 : 21 }, (_, a) => ({
    number: a,
    cells: columns.map(b => {
      const valid = operation === 'add' || a >= b;
      const id = operation === 'add' ? `add:${a}+${b}` : `sub:${a}-${b}`;
      return { valid, outsideCurriculum: valid && !FACTS.has(id),
        fact: valid && FACTS.has(id) ? factView(save, id, now) : null };
    }),
  }));
  return { operation, columns, rows };
}
export function sessionRows(save: Save, now: number) {
  return save.sessions.filter(s => s.start <= now).slice().sort((a, b) => b.start - a.start).slice(0, REPORT_DAYS).map(s => ({
    id: s.id, date: dateTime(s.start), minutes: minutes(Math.min(s.end, now) - s.start), questions: s.questions,
    accuracy: percentage(s.firstTryCorrect, s.questions),
    enteredReview: [...s.enteredReview].map(id => factName(getFact(id))),
    becameFluent: [...s.becameFluent].map(id => factName(getFact(id))),
  }));
}
export function dailyQuestions(save: Save, now: number) {
  const today = Math.floor(now / DAY_MS) * DAY_MS;
  const days = Array.from({ length: REPORT_DAYS }, (_, i) => {
    const start = today - (REPORT_DAYS - 1 - i) * DAY_MS;
    return { date: date(start), questions: save.sessions.filter(s => s.start >= start && s.start < start + DAY_MS && s.start <= now)
      .reduce((sum, s) => sum + s.questions, 0) };
  });
  const max = Math.max(1, ...days.map(d => d.questions));
  return days.map((day, i) => ({ ...day, x: 24 + i * 52, y: 152 - 120 * day.questions / max,
    width: 32, height: 120 * day.questions / max, label: day.date.slice(5) }));
}
export function parentModel(save: Save, now: number) {
  const counts = { 'not started': 0, learning: 0, accurate: 0, fluent: 0 };
  for (const id of FACTS.keys()) counts[stateOf(save.facts[id]!)]++;
  const recentSessions = save.sessions.filter(s => s.start >= now - 7 * DAY_MS && s.start <= now);
  const recentMinutes = recentSessions.reduce((sum, s) => sum + Math.max(0, Math.min(now, s.end) - s.start), 0);
  const recentQuestions = recentSessions.reduce((sum, s) => sum + s.questions, 0);
  const intro = introductionSets(save);
  const placement = save.practice.placement;
  return {
    name: save.profile.name || 'Your learner', asOf: dateTime(now), counts,
    summary: `${counts.fluent} facts fluent · ${counts.accurate} accurate · ${counts.learning} being learned · ${counts['not started']} not started. ${minutes(recentMinutes)} minutes played and ${recentQuestions} questions answered in the last 7 days.`,
    recentMinutes: minutes(recentMinutes), recentQuestions,
    tree: skillTree(save), addition: gridView(save, 'add', now), subtraction: gridView(save, 'sub', now),
    learning: [...FACTS.keys()].filter(id => save.facts[id]!.stage === 'learning').map(id => factView(save, id, now)),
    introductions: intro.map(s => setView(save, s.id)),
    placement: placement.active && FACT_SETS[placement.setIndex] ? setView(save, FACT_SETS[placement.setIndex]!.id) : null,
    sessions: sessionRows(save, now), days: dailyQuestions(save, now), sound: save.settings.sound,
    exportFilename: `oddlings-save-${date(now)}.json`,
  };
}
export type ParentModel = ReturnType<typeof parentModel>;
