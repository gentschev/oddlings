import { AREAS } from '../../src/core/areas';
import { expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { practiceJourney } from './practice-journeys';
it('lets able children recover from slips without grinding, and keeps learner progress visible', () => {
  const rows = (['fixture', 'fluffed', 'slow', 'learner'] as const).map(kind => practiceJourney(kind));
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/m10-after.json', JSON.stringify(rows, null, 2));
  for (const row of rows) {
    expect(row.complete, row.kind).toBe(true);
    if (row.kind === 'fixture' || row.kind === 'fluffed') expect(row.encounters, row.kind).toBeLessThanOrEqual(10);
    if (row.kind === 'slow') expect(row.encounters).toBeLessThanOrEqual(12);
    if (row.kind === 'fixture') for (const count of Object.values(row.perStop)) expect(count).toBeLessThanOrEqual(4);
    if (row.kind === 'learner') {
      for (const count of Object.values(row.perStop)) expect(count).toBeLessThanOrEqual(15);
      expect(row.flatEncounters).toEqual([]);
    }
  }
}, 120_000);

it('plays the fixture, able child and learner through both built areas', () => {
  const rows = (['fixture', 'fluffed', 'learner'] as const).map(kind => practiceJourney(kind, 160, 2));
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/m11-journeys.json', JSON.stringify(rows, null, 2));
  for (const row of rows) {
    expect(row.complete, row.kind).toBe(true);
    if (row.kind === 'fluffed') expect(row.encounters).toBeLessThanOrEqual(16);
    if (row.kind === 'learner') for (const stop of AREAS[1].stops) {
      if (stop.type === 'skill') expect(row.perStop[stop.id]).toBeLessThanOrEqual(15);
    }
  }
}, 120_000);
