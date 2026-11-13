/** Resume unfinished downloads once after a hidden page returns, never in parallel. */
export class SpeechWarmup {
  private running?: Promise<void>;
  private hidden = false;
  private again = false;
  constructor(private readonly run: () => Promise<void>, private readonly complete: () => boolean) {}
  start(): Promise<void> {
    if (this.running) return this.running;
    this.running = Promise.resolve().then(this.run).catch(() => undefined).finally(() => {
      this.running = undefined;
      if (this.again && !this.complete()) { this.again = false; void this.start(); }
      else this.again = false;
    });
    return this.running;
  }
  visibilityChanged(visible: boolean): void {
    if (!visible) { this.hidden = true; return; }
    if (!this.hidden) return;
    this.hidden = false;
    if (this.complete()) return;
    if (this.running) this.again = true;
    else void this.start();
  }
}
