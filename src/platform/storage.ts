import type { Save } from '../core/types';
import { SaveStorage, type SaveBackend } from './saveStorage';
import { canVisitArea, getArea } from '../core/areas';
import { currentStop, syncPath } from '../core/path';

const STORE = 'save';
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('oddlings', 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function request<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const operation = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(operation.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      operation.onerror = () => reject(operation.error);
    });
  } finally { db.close(); }
}
const primary: SaveBackend = {
  get: key => request('readonly', store => store.get(key)),
  set: async (key, value) => { await request('readwrite', store => store.put(value, key)); },
  remove: async key => { await request('readwrite', store => store.delete(key)); },
  keys: async () => (await request('readonly', store => store.getAllKeys())).map(String),
};
const local: SaveBackend = {
  get: async key => localStorage.getItem(key) ?? undefined,
  set: async (key, value) => localStorage.setItem(key, value),
  remove: async key => localStorage.removeItem(key),
  keys: async () => Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!).filter(Boolean),
};
const storage = new SaveStorage([primary, local]);
export async function loadSave(fresh: boolean): Promise<Save> {
  const save = await storage.load(fresh);
  if (!canVisitArea(save, save.map.area)) save.map.area = 1;
  syncPath(save, Date.now(), save.map.area);
  save.map.position = currentStop(save)?.id ?? getArea(save.map.area).gateId;
  try { await storage.store(save); } catch { /* Read-only play still works. */ }
  return save;
}
export const storeSave = (save: Save): Promise<void> => storage.store(save);
export const getRestoreStatus = () => storage.restored;
