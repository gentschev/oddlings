import type { SaveBackend } from './saveStorage';

function database(name: string, store: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export function indexedBackend(name: string, store: string): SaveBackend {
  async function request<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await database(name, store);
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode), operation = run(tx.objectStore(store));
        tx.oncomplete = () => resolve(operation.result);
        tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); operation.onerror = () => reject(operation.error);
      });
    } finally { db.close(); }
  }
  return { get: key => request('readonly', store => store.get(key)),
    set: async (key, value) => { await request('readwrite', store => store.put(value, key)); },
    remove: async key => { await request('readwrite', store => store.delete(key)); },
    keys: async () => (await request('readonly', store => store.getAllKeys())).map(String) };
}
export const localBackend: SaveBackend = {
  get: async key => localStorage.getItem(key) ?? undefined,
  set: async (key, value) => localStorage.setItem(key, value), remove: async key => localStorage.removeItem(key),
  keys: async () => Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!).filter(Boolean),
};
/** An absent source database must not be created, and an existing one must not be upgraded. */
export async function readIndexedValue(name: string, store: string, key: string): Promise<string | undefined> {
  try {
    if (indexedDB.databases && !(await indexedDB.databases()).some(db => db.name === name)) return;
    return await new Promise(resolve => {
      const request = indexedDB.open(name);
      request.onupgradeneeded = () => request.transaction?.abort();
      request.onerror = () => resolve(undefined); request.onblocked = () => resolve(undefined);
      request.onsuccess = () => {
        const db = request.result;
        try {
          const tx = db.transaction(store, 'readonly'), get = tx.objectStore(store).get(key);
          tx.oncomplete = () => { db.close(); resolve(typeof get.result === 'string' ? get.result : undefined); };
          tx.onerror = tx.onabort = () => { db.close(); resolve(undefined); };
        } catch { db.close(); resolve(undefined); }
      };
    });
  } catch { return; }
}
