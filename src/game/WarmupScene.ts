import { currentSession, recordWarmupTap, WARMUP_TAPS } from '../core';
import { AnswerPad, text } from '../ui/Controls';
import { BaseScene } from './BaseScene';
import { CENTER_X, LAYOUT, TIMING, UI } from './constants';
import type { Runtime } from './Runtime';
import { STRINGS } from './strings';

export class WarmupScene extends BaseScene {
  private target: number = LAYOUT.warmup.taps[0];
  private accepting = false;
  constructor(runtime: Runtime) { super('warmup', runtime); }
  protected details(): Record<string, unknown> {
    return { correctAnswer: this.target, inputAccepted: this.accepting,
      taps: currentSession(this.runtime.save).warmupTaps };
  }
  create(): void {
    this.begin(); this.background('bg-encounter-meadow'); this.accepting = false;
    const l = LAYOUT.warmup;
    text(this, CENTER_X, l.titleY, STRINGS.warmup, UI.titleFont);
    const prompt = text(this, CENTER_X, l.promptY, '', l.promptSize);
    const steps = text(this, CENTER_X, l.stepsY, '', UI.smallFont);
    let shownAt = 0;
    const pad = new AnswerPad(this, n => {
      this.runtime.audio.play('tap', n);
      if (!this.accepting || n !== this.target) return;
      // The answer tap may interrupt its own prompt before the next one is scheduled.
      this.interruptSpeech();
      this.accepting = false; pad.enable(false);
      recordWarmupTap(this.runtime.save, this.runtime.now() - shownAt);
      if (currentSession(this.runtime.save).warmupTaps >= WARMUP_TAPS) this.saveThen(() => this.go('map'));
      else this.afterSpeech(TIMING.warmup, show);
    });
    this.controls.push(...pad.buttons.map(b => b.control));
    this.speaker(LAYOUT.encounter.speakerX, LAYOUT.encounter.speakerY, LAYOUT.encounter.speakerW);
    const show = () => {
      const taps = currentSession(this.runtime.save).warmupTaps;
      this.target = l.taps[taps]!;
      prompt.setText(STRINGS.tap(this.target)); steps.setText(STRINGS.warmupStep(taps));
      this.onScreen = [STRINGS.warmup, STRINGS.tap(this.target), STRINGS.warmupStep(taps)];
      this.speak(`tap-${this.target}`);
      // Begin the motor measurement only after the prompt is fully presented.
      this.time.delayedCall(TIMING.question, () => { shownAt = this.runtime.now(); this.accepting = true; pad.enable(true); });
    };
    pad.enable(false); show();
  }
}
