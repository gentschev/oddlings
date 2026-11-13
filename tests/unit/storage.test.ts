import { describe, expect, it } from 'vitest';
import { createSave, importSave } from '../../src/core';
import { BACKUP_PREFIX, RESTORED_KEY, SAVE_KEY, SaveStorage, type SaveBackend } from '../../src/platform/saveStorage';

function fake() {
  const values = new Map<string, string>();
  const backend: SaveBackend = { get: async key => values.get(key), set: async (key, value) => { values.set(key, value); },
    remove: async key => { values.delete(key); }, keys: async () => [...values.keys()] };
  return { values, backend };
}
const stamp = (date: string) => Date.parse(`${date}T12:00:00Z`);
const named = (name: string) => { const save = createSave(); save.profile.name = name; return save; };
describe('daily save safety', () => {
  it('keeps the final saves from the previous three days, at most one per day', async () => {
    const primary = fake(), local = fake(); let now = stamp('2026-11-10');
    const storage = new SaveStorage([primary.backend, local.backend], () => now);
    await storage.store(named('A')); await storage.store(named('B'));
    expect([...primary.values.keys()].filter(k => k.startsWith(BACKUP_PREFIX))).toHaveLength(0);
    for (const [date, name] of [['11', 'C'], ['11', 'D'], ['12', 'E'], ['13', 'F'], ['14', 'G']]) {
      now = stamp(`2026-11-${date}`); await storage.store(named(name!));
    }
    const keys = [...primary.values.keys()].filter(k => k.startsWith(BACKUP_PREFIX)).sort();
    expect(keys).toEqual(['2026-11-11', '2026-11-12', '2026-11-13'].map(d => BACKUP_PREFIX + d));
    expect(keys.map(k => importSave(primary.values.get(k)!).profile.name)).toEqual(['D', 'E', 'F']);
    expect(local.values).toEqual(primary.values);
  });
  it('skips corrupt main copies and corrupt newest backups, heals the main save and retains the parent flag', async () => {
    const primary = fake(), local = fake(); let now = stamp('2026-11-10');
    const storage = new SaveStorage([primary.backend, local.backend], () => now);
    for (const [date, name] of [['10', 'A'], ['11', 'B'], ['12', 'C'], ['13', 'D']]) {
      now = stamp(`2026-11-${date}`); await storage.store(named(name!));
    }
    for (const port of [primary, local]) {
      port.values.set(SAVE_KEY, '{broken'); port.values.set(`${BACKUP_PREFIX}2026-11-12`, '{broken');
    }
    const restored = await storage.load();
    expect(restored.profile.name).toBe('B'); expect(storage.restored).toEqual({ date: '2026-11-11' });
    expect(importSave(primary.values.get(SAVE_KEY)!).profile.name).toBe('B');
    const parentPage = new SaveStorage([primary.backend, local.backend], () => now);
    expect((await parentPage.load()).profile.name).toBe('B');
    expect(parentPage.restored).toEqual({ date: '2026-11-11' });
    await parentPage.load(true);
    expect([...primary.values.keys()].some(k => k.startsWith(BACKUP_PREFIX))).toBe(false);
    expect(primary.values.has(RESTORED_KEY)).toBe(false); expect(parentPage.restored).toBeNull();
  });
  it('prefers a valid current local copy over a daily backup and handles unavailable storage', async () => {
    const primary = fake(), local = fake(), storage = new SaveStorage([primary.backend, local.backend]);
    primary.values.set(SAVE_KEY, '{}'); local.values.set(SAVE_KEY, JSON.stringify(named('Current')));
    primary.values.set(`${BACKUP_PREFIX}2026-11-10`, JSON.stringify(named('Old')));
    expect((await storage.load()).profile.name).toBe('Current'); expect(storage.restored).toBeNull();
    const failed: SaveBackend = { get: async () => { throw Error('blocked'); }, set: async () => { throw Error('quota'); },
      keys: async () => { throw Error('blocked'); }, remove: async () => { throw Error('blocked'); } };
    const fallback = new SaveStorage([failed, local.backend]); await fallback.store(named('Local only'));
    expect((await fallback.load()).profile.name).toBe('Local only');
    const none = new SaveStorage([failed]);
    await expect(none.store(named('Lost'))).rejects.toThrow();
    expect(await none.load()).toEqual(createSave()); expect(await none.load(true)).toEqual(createSave());
  });
});
