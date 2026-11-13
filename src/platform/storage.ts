import type { Save } from '../core/types';
import { SaveStorage } from './saveStorage';
import { canVisitArea, getArea } from '../core/areas';
import { currentStop, syncPath } from '../core/path';
import { CHANNEL, STORAGE_NAMES, storageNames } from './channel';
import { channelBackend, copyMainSave } from './channelStorage';
import { indexedBackend, localBackend, readIndexedValue } from './browserStorage';

const backends = [indexedBackend(STORAGE_NAMES.database, STORAGE_NAMES.store), localBackend].map(backend => channelBackend(backend, CHANNEL));
const storage = new SaveStorage(backends);
const mainNames = storageNames('main');
const mainSources = [{ get: (key: string) => readIndexedValue(mainNames.database, mainNames.store, key) }, { get: localBackend.get }];
export async function copyProgressFromMain(): Promise<Save | undefined> {
  return copyMainSave(CHANNEL, mainSources, backends, storage, true);
}
export async function loadSave(fresh: boolean): Promise<Save> {
  if (!fresh) {
    try { await copyMainSave(CHANNEL, mainSources, backends, storage); } catch { /* Unavailable storage still permits ordinary play. */ }
  }
  const save = await storage.load(fresh);
  if (!canVisitArea(save, save.map.area)) save.map.area = 1;
  syncPath(save, Date.now(), save.map.area);
  save.map.position = currentStop(save)?.id ?? getArea(save.map.area).gateId;
  try { await storage.store(save); } catch { /* Read-only play still works. */ }
  return save;
}
export const storeSave = (save: Save): Promise<void> => storage.store(save);
export const getRestoreStatus = () => storage.restored;
