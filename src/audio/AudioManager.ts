import { SpeechPlayer } from './SpeechPlayer';

/** Soft, local synthesis. The context is created only by the Play gesture. */
export class AudioManager {
  private context?: AudioContext;
  private silence = false;
  constructor(private readonly speech = new SpeechPlayer()) {}
  voiceEnabled = true;
  get muted(): boolean { return this.silence; }
  set muted(value: boolean) { this.silence = value; if (value) this.speech.stop(); }
  say(id: string): void { if (this.context && !this.muted && this.voiceEnabled) void this.speech.say(id); }
  saySequence(ids: readonly string[]): void { if (this.context && !this.muted && this.voiceEnabled) void this.speech.saySequence(ids); }
  duration(id: string): number { return this.context && !this.muted && this.voiceEnabled ? this.speech.duration(id) : 0; }
  stopSpeech(): void { this.speech.stop(); }
  unlock(): void {
    void this.speech.preload();
    this.context ??= new AudioContext();
    void this.context.resume().catch(() => undefined);
  }
  play(effect: 'tap' | 'correct' | 'quick' | 'hmm' | 'pop' | 'hop' | 'fanfare', value = 0): void {
    if (!this.context || this.muted) return;
    const notes = effect === 'fanfare' ? [392, 494, 587, 784]
      : effect === 'quick' ? [523, 659, 784] : effect === 'correct' ? [440, 659]
      : effect === 'hmm' ? [220, 196] : effect === 'pop' ? [660, 330]
      : effect === 'hop' ? [330, 494] : [262 * 2 ** ((value % 7) / 12)];
    const length = effect === 'fanfare' ? 0.18 : 0.1;
    notes.forEach((frequency, i) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const at = this.context!.currentTime + i * length;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.065, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, at + length * 1.8);
      oscillator.connect(gain); gain.connect(this.context!.destination);
      oscillator.start(at); oscillator.stop(at + length * 2);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }
}
