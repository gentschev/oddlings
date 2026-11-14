import { describe, expect, it } from 'vitest';
import { passedOverStops, type PathStop } from '../../src/core';

const skill = (completed = true): Pick<PathStop, 'type' | 'completed'> => ({ type: 'skill', completed });
const story = (completed = true): Pick<PathStop, 'type' | 'completed'> => ({ type: 'story', completed });
describe('automatic path skips', () => {
  it('explains a completed skill behind the falls story, from index zero to two', () => {
    expect(passedOverStops(0, 2, [story(false), skill(), story(false)])).toBe(1);
  });
  it('explains the completed halves stop after an encounter at index three, moving to five', () => {
    expect(passedOverStops(3, 5, [story(), skill(), story(), skill(false), skill(), story(false)])).toBe(1);
  });
  it('includes skills that the encounter just passed, and excludes the source and destination', () => {
    expect(passedOverStops(1, 4, [story(), skill(false), skill(false), skill(false), skill(false)])).toBe(2);
  });
  it('does not call a one-step move, a stationary marker, a return walk or an entry a skip', () => {
    const stops = [story(), skill(), skill(), skill()];
    for (const [from, to] of [[0, 1], [2, 2], [3, 0], [-1, 3]]) expect(passedOverStops(from!, to!, stops)).toBe(0);
  });
  it('does not count an unseen story, or a gate beyond the stones', () => {
    expect(passedOverStops(0, 3, [skill(), story(false), skill()])).toBe(1);
    expect(passedOverStops(0, 3, [skill(), story(), skill()])).toBe(2);
  });
});
