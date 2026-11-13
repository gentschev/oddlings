import { createSave, exportSave, importSave } from '../core/save';
import type { Save } from '../core/types';

export interface SaveBackend {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
}
export const SAVE_KEY = 'oddlings-save';
export const SAVE_TIME_KEY = 'oddlings-save-time';
export const BACKUP_PREFIX = 'oddlings-backup-';
export const RESTORED_KEY = 'oddlings-restored';
/** Retain three different days, archiving the prior valid save before a new day's write. */
export const BACKUP_DAYS = 3;
export interface RestoreStatus { date: string }
const day = (time: number) => new Date(time).toISOString().slice(0, 10);
const validDay = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date);
function decode(json: string | undefined): Save | undefined {
  if (!json) return undefined;
  try { return importSave(json); } catch { return undefined; }
}

/** Storage ports make recovery and quota failures testable without a browser. */
export class SaveStorage {
  restored: RestoreStatus | null = null;
  private writes = Promise.resolve();
  constructor(private readonly backends: readonly SaveBackend[], private readonly now: () => number = Date.now) {}
  private async archive(backend: SaveBackend): Promise<void> {
    try {
      const previous = await backend.get(SAVE_KEY);
      if (!decode(previous)) return;
      const time = Number(await backend.get(SAVE_TIME_KEY));
      const date = time > 0 && Number.isFinite(time) ? day(time) : day(this.now());
      // Preserve the final save of a previous day, rather than a half-played save today.
      if (time > 0 && date === day(this.now())) return;
      const key = `${BACKUP_PREFIX}${date}`;
      if (!await backend.get(key)) await backend.set(key, previous!);
      const backups = (await backend.keys()).filter(k => k.startsWith(BACKUP_PREFIX) && validDay(k.slice(BACKUP_PREFIX.length))).sort().reverse();
      for (const old of backups.slice(BACKUP_DAYS)) await backend.remove(old);
    } catch { /* Backup failure must not block a current save in the other storage. */ }
  }
  private async publish(json: string, archive: boolean): Promise<void> {
    const stamp = String(this.now());
    const results = await Promise.all(this.backends.map(async backend => {
      try {
        if (archive) await this.archive(backend);
        await backend.set(SAVE_KEY, json);
        // The JSON write still succeeded if metadata ran out of space.
        try { await backend.set(SAVE_TIME_KEY, stamp); } catch { /* Keep the successful copy. */ }
        return true;
      } catch { return false; }
    }));
    if (!results.some(Boolean)) throw new Error('Could not store either save copy');
  }
  store(save: Save): Promise<void> {
    const json = exportSave(save);
    const write = this.writes.catch(() => undefined).then(() => this.publish(json, true));
    this.writes = write;
    return write;
  }
  async load(fresh = false): Promise<Save> {
    await this.writes.catch(() => undefined);
    this.restored = null;
    if (fresh) {
      await Promise.all(this.backends.map(async backend => {
        try {
          for (const key of await backend.keys()) if (key.startsWith(BACKUP_PREFIX) || [SAVE_KEY, SAVE_TIME_KEY, RESTORED_KEY].includes(key)) await backend.remove(key);
        } catch { /* A writable copy will still receive the fresh save below. */ }
      }));
      const empty = createSave();
      try { await this.publish(exportSave(empty), false); } catch { /* Continue in memory. */ }
      return empty;
    }
    const copies = await Promise.all(this.backends.map(async backend => {
      try {
        const save = decode(await backend.get(SAVE_KEY));
        const rawTime = Number(await backend.get(SAVE_TIME_KEY));
        const timestamp = Number.isFinite(rawTime) ? rawTime : 0;
        const restoredDate = await backend.get(RESTORED_KEY);
        return { save, timestamp, restoredDate };
      } catch { return { save: undefined, timestamp: 0, restoredDate: undefined }; }
    }));
    const dates = copies.map(c => c.restoredDate).filter((d): d is string => typeof d === 'string' && validDay(d)).sort().reverse();
    if (dates[0]) this.restored = { date: dates[0] };
    const current = copies.filter(c => c.save).sort((a, b) => b.timestamp - a.timestamp)[0]?.save;
    if (current) return current;
    const daily = (await Promise.all(this.backends.map(async backend => {
      try { return (await backend.keys()).filter(key => key.startsWith(BACKUP_PREFIX) && validDay(key.slice(BACKUP_PREFIX.length))).map(key => ({ backend, key })); }
      catch { return []; }
    }))).flat().sort((a, b) => b.key.localeCompare(a.key));
    for (const { backend, key } of daily) {
      try {
        const save = decode(await backend.get(key));
        if (!save) continue;
        const date = key.slice(BACKUP_PREFIX.length);
        this.restored = { date };
        try { await this.publish(exportSave(save), false); } catch { /* Read-only recovery still works. */ }
        await Promise.all(this.backends.map(async b => { try { await b.set(RESTORED_KEY, date); } catch { /* Keep the in-memory flag. */ } }));
        return save;
      } catch { /* Try the next dated copy, including one in the other backend. */ }
    }
    return createSave();
  }
}
