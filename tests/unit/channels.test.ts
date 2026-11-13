import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createSave, exportSave, importSave } from '../../src/core';
import { channelName, parseChannel, precacheName, storageNames } from '../../src/platform/channel';
import { channelBackend, copyMainSave } from '../../src/platform/channelStorage';
import { SaveStorage, SAVE_KEY, SAVE_TIME_KEY, type SaveBackend } from '../../src/platform/saveStorage';
import { channelCopyControls } from '../../src/parent/platformInfo';

function fake() {
  const values = new Map<string, string>();
  const backend: SaveBackend = { get: vi.fn(async key => values.get(key)),
    set: vi.fn(async (key, value) => { values.set(key, value); }), remove: vi.fn(async key => { values.delete(key); }),
    keys: vi.fn(async () => [...values.keys()]) };
  return { values, backend };
}
function setup(json = ` \n${JSON.stringify(createSave(), null, 2)}`) {
  const main = fake(), own = fake(); main.values.set(SAVE_KEY, json);
  main.values.set(SAVE_TIME_KEY, '100');
  const port = channelBackend(own.backend, 'next'), storage = new SaveStorage([port], () => 1000);
  const copy = (force = false) => copyMainSave('next', [main.backend], [port], storage, force);
  return { main, own, port, storage, copy, json };
}
describe('channel names', () => {
  it('pins every main name to the deployed storage contract', () => {
    const { backup, ...names } = storageNames('main');
    expect(names).toEqual({ database: 'oddlings', store: 'save', save: 'oddlings-save', saveTime: 'oddlings-save-time',
      restored: 'oddlings-restored', challenge: 'oddlings-parent-challenge', historyGuard: 'oddlingsGuard',
      speech: 'oddlings-speech-v1', speechIndex: 'oddlings-speech-index-v1', expiration: 'workbox-expiration' });
    expect(backup('2026-11-13')).toBe('oddlings-backup-2026-11-13');
    expect(precacheName('https://example.test/oddlings/', 'main')).toBe('workbox-precache-v2-https://example.test/oddlings/');
  });
  it('suffixes next database, store, local and session keys and all cache names', () => {
    const main = storageNames('main'), next = storageNames('next');
    for (const [key, value] of Object.entries(main)) if (typeof value === 'string') expect(next[key as keyof typeof next]).toBe(`${value}-next`);
    expect(next.backup('2026-11-13')).toBe('oddlings-backup-2026-11-13-next');
    expect(precacheName('https://example.test/oddlings-next/', 'next')).toBe('workbox-precache-v2-https://example.test/oddlings-next/-next');
    expect(channelName('oddlings-save', 'main')).toBe(SAVE_KEY);
  });
  it('defaults to main and rejects misspelled channel builds', () => {
    expect(parseChannel(undefined)).toBe('main'); expect(parseChannel('main')).toBe('main'); expect(parseChannel('next')).toBe('next');
    for (const invalid of ['', 'Next', 'test', 'next ']) expect(() => parseChannel(invalid)).toThrow('ODDLINGS_CHANNEL');
  });
  it('keeps the copy button and its inline confirmation out of the main parent page', () => {
    expect(channelCopyControls('main')).toBe('');
    const controls = channelCopyControls('next');
    expect(controls).toContain('Copy progress from the main game'); expect(controls).toContain('id="copy-main-preview" class="detail" hidden');
    expect(controls).toContain('confirm-copy-main'); expect(controls).toContain('cancel-copy-main');
  });
});
describe('copying main progress', () => {
  it('copies once into an empty next store and never changes main bytes or metadata', async () => {
    const f = setup(), before = new Map(f.main.values);
    expect(await f.copy()).toEqual(createSave());
    expect(f.own.values.get('oddlings-save-next')).toBe(exportSave(createSave()));
    const copied = await f.storage.load(); copied.settings.sound = false; await f.storage.store(copied);
    const reads = vi.mocked(f.main.backend.get).mock.calls.length;
    expect(await f.copy()).toBeUndefined(); expect(vi.mocked(f.main.backend.get).mock.calls).toHaveLength(reads);
    expect((await f.storage.load()).settings.sound).toBe(false);
    expect(f.main.values).toEqual(before); expect(f.main.backend.set).not.toHaveBeenCalled(); expect(f.main.backend.remove).not.toHaveBeenCalled();
    expect([...f.own.values.keys()].every(key => key.endsWith('-next'))).toBe(true);
  });
  it('migrates the copied version one fixture without touching the original', async () => {
    const json = readFileSync('tests/fixtures/save-v1-path-cleared.json', 'utf8'), f = setup(json);
    const copy = await f.copy(); expect(copy!.version).toBe(2); expect(copy!.responses).toHaveLength(65);
    expect(copy!.facts).toEqual(JSON.parse(json).facts); expect(copy!.team.friends).toEqual(JSON.parse(json).team.friends);
    expect(f.main.values.get(SAVE_KEY)).toBe(json); expect(importSave(f.own.values.get('oddlings-save-next')!)).toEqual(copy);
  });
  it('can explicitly replace test progress from the newest valid main copy', async () => {
    const f = setup(); await f.copy();
    const source = fake(), next = createSave(); next.settings.voice = false;
    source.values.set(SAVE_KEY, exportSave(next)); source.values.set(SAVE_TIME_KEY, '200');
    const before = new Map(source.values), original = new Map(f.main.values);
    expect(await copyMainSave('next', [f.main.backend, source.backend], [f.port], f.storage)).toBeUndefined();
    expect(await copyMainSave('next', [f.main.backend, source.backend], [f.port], f.storage, true)).toEqual(next);
    expect((await f.storage.load()).settings.voice).toBe(false);
    expect(source.values).toEqual(before); expect(f.main.values).toEqual(original);
  });
  it.each([undefined, '{broken', '{}'])('ignores an absent or damaged main save: %s', async json => {
    const f = setup(); if (json === undefined) f.main.values.delete(SAVE_KEY); else f.main.values.set(SAVE_KEY, json);
    const before = new Map(f.main.values);
    await expect(f.copy()).resolves.toBeUndefined(); expect(f.main.values).toEqual(before); expect(f.own.values.size).toBe(0);
  });
  it('never copies on main and preserves existing damaged next saves and daily backups', async () => {
    const f = setup();
    expect(await copyMainSave('main', [f.main.backend], [f.port], f.storage, true)).toBeUndefined();
    expect(f.main.backend.get).not.toHaveBeenCalled();
    f.own.values.set('oddlings-save-next', '{broken'); expect(await f.copy()).toBeUndefined();
    f.own.values.clear(); f.own.values.set('oddlings-backup-2026-11-13-next', exportSave(createSave()));
    expect(await f.copy()).toBeUndefined(); expect(f.main.backend.get).not.toHaveBeenCalled();
  });
  it('rechecks own progress after slow source reads before copying', async () => {
    const f = setup();
    vi.mocked(f.main.backend.get).mockImplementation(async key => {
      if (key === SAVE_KEY) f.own.values.set('oddlings-save-next', 'already here');
      return f.main.values.get(key);
    });
    expect(await f.copy()).toBeUndefined(); expect(f.own.values.get('oddlings-save-next')).toBe('already here');
  });
  it('keeps next resets and backup cleanup away from main keys, and main resets away from next', async () => {
    const raw = fake(), mainNames = storageNames('main'), nextNames = storageNames('next');
    const original = exportSave(createSave());
    raw.values.set(mainNames.save, original); raw.values.set(mainNames.saveTime, '1');
    raw.values.set(mainNames.backup('2026-11-10'), original); raw.values.set('unrelated', 'keep');
    const mainBefore = new Map(raw.values), next = new SaveStorage([channelBackend(raw.backend, 'next')], () => 1000);
    await next.store(createSave()); await next.load(true);
    for (const [key, value] of mainBefore) expect(raw.values.get(key)).toBe(value);
    raw.values.set(nextNames.backup('2026-11-11'), original);
    const nextBefore = [...raw.values.entries()].filter(([key]) => key.endsWith('-next'));
    const main = new SaveStorage([channelBackend(raw.backend, 'main')], () => 1000); await main.load(true);
    expect([...raw.values.entries()].filter(([key]) => key.endsWith('-next'))).toEqual(nextBefore);
    expect(raw.values.get('unrelated')).toBe('keep');
  });
});
