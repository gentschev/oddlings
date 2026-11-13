import { importSave } from '../core/save';
import type { Save } from '../core/types';
import { channelName, type Channel } from './channel';
import { BACKUP_PREFIX, RESTORED_KEY, SAVE_KEY, SAVE_TIME_KEY, type SaveBackend, type SaveStorage } from './saveStorage';

type ReadSave = Pick<SaveBackend, 'get'>;
const logicalKey = (key: string) => [SAVE_KEY, SAVE_TIME_KEY, RESTORED_KEY].includes(key) || key.startsWith(BACKUP_PREFIX);
/** SaveStorage sees logical keys. Only this adapter can reach the channel's physical keys. */
export function channelBackend(backend: SaveBackend, channel: Channel): SaveBackend {
  const physical = (key: string) => {
    if (!logicalKey(key)) throw new Error('Unknown save key');
    return channelName(key, channel);
  };
  return { get: key => backend.get(physical(key)), set: (key, value) => backend.set(physical(key), value),
    remove: key => backend.remove(physical(key)), keys: async () => (await backend.keys()).flatMap(key => {
      if (channel === 'next') {
        const base = key.endsWith('-next') ? key.slice(0, -5) : '';
        return logicalKey(base) ? [base] : [];
      }
      return !key.endsWith('-next') && logicalKey(key) ? [key] : [];
    }) };
}
/** Read and migrate a copy. Never run main-channel storage's load or repair routines. */
export async function readMainSave(sources: readonly ReadSave[]): Promise<Save | undefined> {
  const copies = await Promise.all(sources.map(async source => {
    try {
      const json = await source.get(SAVE_KEY); if (!json) return;
      const save = importSave(json), time = Number(await source.get(SAVE_TIME_KEY));
      return { save, time: Number.isFinite(time) ? time : 0 };
    } catch { return; }
  }));
  return copies.filter((copy): copy is NonNullable<typeof copy> => !!copy).sort((a, b) => b.time - a.time)[0]?.save;
}
async function hasOwnSave(backends: readonly SaveBackend[]): Promise<boolean> {
  const results = await Promise.all(backends.map(async backend => {
    try { return (await backend.get(SAVE_KEY)) !== undefined || (await backend.keys()).some(key => key.startsWith(BACKUP_PREFIX)); }
    catch { return true; } // An unreadable store may contain test progress. Do not replace it.
  }));
  return results.some(Boolean);
}
export async function copyMainSave(channel: Channel, sources: readonly ReadSave[], own: readonly SaveBackend[],
  target: Pick<SaveStorage, 'store'>, force = false): Promise<Save | undefined> {
  if (channel !== 'next' || !force && await hasOwnSave(own)) return;
  const save = await readMainSave(sources); if (!save) return;
  // Another load may have stored test progress while the source reads were pending.
  if (!force && await hasOwnSave(own)) return;
  await target.store(save); return save;
}
