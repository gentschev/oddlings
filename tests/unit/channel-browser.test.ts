import { afterEach, expect, it, vi } from 'vitest';
import { readIndexedValue } from '../../src/platform/browserStorage';

afterEach(() => vi.unstubAllGlobals());
it('does not open an absent main database when enumeration is available', async () => {
  const open = vi.fn(); vi.stubGlobal('indexedDB', { databases: async () => [], open });
  expect(await readIndexedValue('oddlings', 'save', 'oddlings-save')).toBeUndefined(); expect(open).not.toHaveBeenCalled();
});
it('aborts accidental database creation when enumeration is unavailable', async () => {
  const abort = vi.fn(() => queueMicrotask(() => request.onerror?.())), request = {
    transaction: { abort }, onupgradeneeded: null as (() => void) | null, onerror: null as (() => void) | null,
  };
  const open = vi.fn(() => { queueMicrotask(() => request.onupgradeneeded?.()); return request; });
  vi.stubGlobal('indexedDB', { open });
  expect(await readIndexedValue('oddlings', 'save', 'oddlings-save')).toBeUndefined();
  expect(open).toHaveBeenCalledExactlyOnceWith('oddlings'); expect(abort).toHaveBeenCalledOnce();
});
it('only opens an existing main database without a version and reads in a readonly transaction', async () => {
  const get = vi.fn(() => ({ result: 'original bytes' }));
  const tx = { oncomplete: null as (() => void) | null, objectStore: vi.fn(() => ({ get })) };
  const database = { close: vi.fn(), transaction: vi.fn(() => { queueMicrotask(() => tx.oncomplete?.()); return tx; }) };
  const request = { result: database, onsuccess: null as (() => void) | null };
  const open = vi.fn(() => { queueMicrotask(() => request.onsuccess?.()); return request; });
  vi.stubGlobal('indexedDB', { databases: async () => [{ name: 'oddlings' }], open });
  expect(await readIndexedValue('oddlings', 'save', 'oddlings-save')).toBe('original bytes');
  expect(open).toHaveBeenCalledExactlyOnceWith('oddlings'); expect(database.transaction).toHaveBeenCalledExactlyOnceWith('save', 'readonly');
  expect(get).toHaveBeenCalledWith('oddlings-save'); expect(database.close).toHaveBeenCalledOnce();
});
