import type Phaser from 'phaser';
import { centre, type Rect } from '../game/layout';
import { INK, LAYOUT, MUDDLE_TIMING, UI } from '../game/constants';
import { burst } from './Oddling';
import { deliveryDuration, filledSlotCount } from './muddleSlots';

export class MuddleMeter {
  private readonly dots: Phaser.GameObjects.Arc[];
  private readonly rings: Phaser.GameObjects.Arc[] = [];
  private filled = 0;
  constructor(private readonly scene: Phaser.Scene, slots: Rect[]) {
    this.dots = slots.map(r => {
      const p = centre(r);
      this.rings.push(scene.add.circle(p.x, p.y, r.width / 2, INK.cream).setStrokeStyle(UI.stroke, INK.navy));
      return scene.add.circle(p.x, p.y, LAYOUT.encounter.dotW / 2, INK.coral).setAlpha(0);
    });
  }
  sync(meter: number): void {
    const next = filledSlotCount(this.dots.length, meter);
    if (next === this.filled) return;
    for (let i = 0; i < this.dots.length; i++) {
      if ((i < next) === (i < this.filled)) continue;
      const dot = this.dots[i]!;
      this.scene.tweens.killTweensOf(dot);
      if (i < next) {
        dot.setAlpha(1).setScale(0);
        this.scene.tweens.add({ targets: dot, scale: 1, duration: MUDDLE_TIMING.dotPop });
        burst(this.scene, dot.x, dot.y);
      } else dot.setAlpha(0).setScale(1);
    }
    this.filled = next;
  }
  deliver(target: { x: number; y: number }, done: () => void): number {
    for (let i = 0; i < this.filled; i++) {
      const dot = this.dots[i]!;
      this.scene.tweens.killTweensOf(dot);
      dot.setScale(1);
      this.scene.tweens.add({ targets: dot, x: target.x, y: target.y, alpha: 0, scale: 0.5,
        delay: i * MUDDLE_TIMING.stagger, duration: MUDDLE_TIMING.flight,
        onComplete: () => { if (i === this.filled - 1) done(); } });
    }
    const duration = deliveryDuration(this.filled);
    // The empty slots have done their job once the dots leave.
    this.scene.tweens.add({ targets: this.rings, alpha: 0, delay: duration, duration: MUDDLE_TIMING.cloudPop });
    if (!this.filled) done();
    return duration;
  }
}
