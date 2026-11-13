export type Model = 'dots' | 'ten-frame' | 'number-line' | 'domino' | 'double-ten-frame';
export type Operation = 'add' | 'sub' | 'miss' | 'dots' | 'frame';
export interface Fact {
  id: string;
  operation: Operation;
  a: number;
  b: number;
  answer: number;
  layout?: 'dice' | 'scattered';
}
export interface WorkedExample {
  model: Model;
  strategy: 'count' | 'join' | 'take-away' | 'count-on' | 'count-back' | 'double' | 'near-double' | 'make-ten' | 'find-part';
  start: number;
  change: number;
  result: number;
  groups: number[];
  hops: number[];
  lines: string[];
}

export function addition(a: number, b: number): Fact {
  return { id: `add:${a}+${b}`, operation: 'add', a, b, answer: a + b };
}
export function subtraction(a: number, b: number): Fact {
  return { id: `sub:${a}-${b}`, operation: 'sub', a, b, answer: a - b };
}
export function missing(a: number, total: number): Fact {
  return { id: `miss:${a}+?=${total}`, operation: 'miss', a, b: total, answer: total - a };
}
export function dots(n: number, layout: 'dice' | 'scattered'): Fact {
  return { id: `dots:${n}:${layout}`, operation: 'dots', a: n, b: 0, answer: n, layout };
}
export function frame(n: number): Fact {
  return { id: `frame:${n}`, operation: 'frame', a: n, b: 0, answer: n };
}
export const range = (max: number, min = 0): number[] =>
  Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);
export const uniqueFacts = (facts: Fact[]): Fact[] => [...new Map(facts.map(f => [f.id, f])).values()];
export const pairs = (max: number): Fact[] => range(10).flatMap(a =>
  range(10).filter(b => a + b <= max).map(b => addition(a, b)));
export const differences = (max: number): Fact[] => range(max).flatMap(c =>
  range(Math.min(c, 10)).filter(a => c - a <= 10).map(a => subtraction(c, a)));

/** Strings and structured model instructions share the same arithmetic. */
export function workItOut(fact: Fact, model: Model): WorkedExample {
  const { operation: op, a, b, answer } = fact;
  let strategy: WorkedExample['strategy'];
  let lines: string[];
  let groups = [a, b];
  if (op === 'dots' || op === 'frame') {
    strategy = 'count';
    groups = op === 'frame' ? [Math.min(5, a), Math.max(0, a - 5)] : [a];
    lines = ['Count each dot.', `There are ${answer}.`];
  } else if (op === 'miss') {
    strategy = 'find-part';
    groups = [a, answer];
    lines = [`Start with ${a}. Fill up to ${b}.`, `${answer} more makes ${b}.`];
  } else if (op === 'sub') {
    strategy = model === 'number-line' ? 'count-back' : 'take-away';
    groups = [answer, b];
    lines = [`Start with ${a}. Take away ${b}.`, `${answer} are left.`];
  } else if (model === 'domino' && a === b) {
    strategy = 'double';
    lines = [`Two groups of ${a}.`, `${a} and ${b} make ${answer}.`];
  } else if (model === 'domino' && Math.abs(a - b) === 1) {
    strategy = 'near-double';
    const small = Math.min(a, b);
    groups = [small, small, 1];
    lines = [`Double ${small}. Add one more.`, `That makes ${answer}.`];
  } else if (model === 'double-ten-frame' && a < 10 && b < 10 && answer > 10) {
    strategy = 'make-ten';
    groups = [a, 10 - a, answer - 10];
    lines = [`Add ${10 - a} to ${a}. That makes ten.`, `${answer - 10} more makes ${answer}.`];
  } else {
    strategy = model === 'number-line' ? 'count-on' : 'join';
    lines = [`Start with ${a}. Add ${b} more.`, `That makes ${answer}.`];
  }
  const hops = strategy === 'count-back' ? range(b, 1).map(n => a - n)
    : strategy === 'count-on' ? range(b, 1).map(n => a + n) : [];
  return { model, strategy, start: a, change: b, result: answer, groups, hops, lines };
}
