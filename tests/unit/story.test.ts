import { describe, expect, it } from 'vitest';
import { FACT_SETS, getSet, ODDLING_IDS, ODDLING_SETS } from '../../src/core';
import { PEBBLE_STOPS, STORY_LINES } from '../../src/core/story/pebblePath';

describe('Pebble Path content', () => {
  it('has exactly nine skill stops in area one teaching order and two stories', () => {
    expect(PEBBLE_STOPS).toHaveLength(11);
    const skills = PEBBLE_STOPS.filter(s => s.type === 'skill');
    expect(skills.map(s => s.set)).toEqual(FACT_SETS.filter(s => s.area === 1).map(s => s.id));
    expect(PEBBLE_STOPS[0]).toMatchObject({ id: 'pp-welcome', beat: 'welcome' });
    expect(PEBBLE_STOPS[5]).toMatchObject({ id: 'pp-ring', beat: 'ring' });
    expect(skills.map(s => s.pal)).toEqual(['bix', 'tenny', 'inch', 'inch', 'inch', 'twoot', 'fivel', 'fivel', 'twoot']);
    for (const id of ODDLING_IDS) expect(ODDLING_SETS[id].filter(set => getSet(set).area === 1))
      .toEqual(skills.filter(s => s.pal === id).map(s => s.set));
  });
  it('keeps the missing bun setup and a ring beat the child can understand alone', () => {
    expect(STORY_LINES.welcome).toContain('We had six buns. Now we have five.');
    expect(STORY_LINES.ring).toEqual(['Stop! Look at the ground.', 'A ring mark. Right here.',
      'A bun sat here. Now it is gone.', 'Who made the ring? Odd. Very odd.']);
    for (const line of Object.values(STORY_LINES).flat()) expect(line.split(/\s+/).length).toBeLessThanOrEqual(8);
  });
});
