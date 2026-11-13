import { currentSession, startSession, touchSession, type Random, type Save } from '../core';
import { AudioManager } from '../audio/AudioManager';
import { storeSave } from '../platform/storage';
import type { FriendId } from '../core/story/characters';
import type { PathChange } from '../core/path';

export class Runtime {
  pathChange?: PathChange;
  arrivalJoined?: { area: number; pals: FriendId[] };
  parentGateIndex = -1;
  elapsed = 0;
  delta = 0;
  readonly epoch: number;
  readonly audio = new AudioManager();
  snapshot: () => Record<string, unknown> = () => ({ scene: 'boot' });
  pendingSaves = 0;
  saveError = false;
  private saving = Promise.resolve();
  private hiddenAt: number | null = null;
  constructor(readonly save: Save, readonly rng: Random, readonly skipIntro: boolean, epoch: number) {
    this.epoch = epoch;
    startSession(save, this.now());
    this.audio.muted = !save.settings.sound;
    this.audio.voiceEnabled = save.settings.voice;
  }
  now(): number { return this.epoch + this.elapsed; }
  localDate(): string {
    const d = new Date(this.now());
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }
  persist(): Promise<void> {
    touchSession(this.save, this.now());
    // Snapshot before queueing. Older asynchronous writes must never win a race.
    const snapshot = structuredClone(this.save);
    this.pendingSaves++;
    const write = this.saving.catch(() => undefined).then(() => storeSave(snapshot));
    this.saving = write;
    return write.then(() => { this.saveError = false; }, () => { this.saveError = true; })
      .finally(() => { this.pendingSaves--; });
  }
  visibility(hidden: boolean): boolean {
    if (hidden) { touchSession(this.save, this.now()); this.hiddenAt = Date.now(); return false; }
    if (this.hiddenAt === null) return false;
    this.elapsed += Math.max(0, Date.now() - this.hiddenAt);
    this.hiddenAt = null;
    const previous = currentSession(this.save);
    startSession(this.save, this.now(), false);
    return previous !== currentSession(this.save);
  }
}
