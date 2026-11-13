import Phaser from 'phaser';
import manifest from '../../public/assets/art/manifest.json';
import { addition, frame, type Fact } from '../core';
import { INK, MOTION, TIMING, UI } from '../game/constants';
import { oddlingPattern, type PatternDrawing, type PatternMode } from './oddlingPattern';

import type { CharacterId, Rect } from '../game/layout';
export type { CharacterId } from '../game/layout';
const LIDS: Partial<Record<CharacterId, number>> = { tenny: INK.mint, domi: INK.coral, fivel: INK.coral,
  twoot: INK.cream, moss: INK.cream, nought: INK.mint, bix: INK.navy, inch: INK.mint };

/** Static textures with code-drawn patterns. Motion never rebuilds the display list. */
export class Oddling {
  readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Container;
  private readonly image: Phaser.GameObjects.Image;
  private silhouette = false;
  private readonly pattern: Phaser.GameObjects.Graphics;
  private readonly lids: Phaser.GameObjects.Graphics;
  private readonly scale: number;
  private hopAt = -Infinity;
  private hopHeight: number = MOTION.hop;
  private tiltAt = -Infinity;
  private readonly offset: number;
  private blinking = false;
  private muddled = false;
  private demonstration?: Phaser.Time.TimerEvent;
  constructor(private readonly scene: Phaser.Scene, readonly id: CharacterId, x: number, y: number, width: number) {
    const meta = manifest.characters[id];
    this.root = scene.add.container(x, y);
    this.body = scene.add.container(0, 0); this.root.add(this.body);
    this.scale = width / meta.width; this.body.setScale(this.scale);
    this.image = scene.add.image(0, 0, id); this.body.add(this.image);
    this.pattern = scene.add.graphics().setPosition(-meta.width / 2, -meta.height / 2);
    this.body.add(this.pattern);
    this.lids = scene.add.graphics().setPosition(-meta.width / 2, -meta.height / 2);
    this.body.add(this.lids);
    for (const eye of meta.eyes) {
      this.lids.fillStyle(LIDS[id] ?? INK.mint).fillEllipse(eye.x, eye.y, MOTION.blinkRadius * 2.6, MOTION.blinkRadius * 2.2);
      this.lids.lineStyle(MOTION.blinkLine, INK.navy).lineBetween(eye.x - MOTION.blinkRadius, eye.y, eye.x + MOTION.blinkRadius, eye.y);
    }
    this.lids.setVisible(false);
    this.offset = x * 7;
    this.restorePattern();
  }
  setSilhouette(): void { this.mode = 'hidden'; this.silhouette = true; this.image.setTint(INK.navy).setTintMode(Phaser.TintModes.FILL); this.pattern.clear(); this.lids.setVisible(false); }
  private mode: PatternMode | 'hidden' = 'resting';
  get patternMode(): PatternMode | 'hidden' { return this.mode; }
  restorePattern(): void { this.setMuddled(false); }
  setMuddled(muddled: boolean): void {
    this.muddled = muddled;
    this.drawPattern(oddlingPattern(this.id, undefined, false, muddled));
  }
  showCount(n: number): void { this.showFact(this.id === 'domi' ? addition(Math.floor(n / 2), Math.floor(n / 2)) : frame(n), true); }
  showFact(fact: Fact, reveal: boolean): void { this.drawPattern(oddlingPattern(this.id, fact, reveal, this.muddled)); }
  private drawPattern(drawing: PatternDrawing): void {
    const g = this.pattern; g.clear();
    this.mode = this.silhouette ? 'hidden' : drawing.mode;
    if (this.silhouette) return;
    for (const tile of drawing.tiles) g.lineStyle(tile.stroke, INK.navy).strokeRoundedRect(tile.x, tile.y, tile.width, tile.height, tile.corner);
    for (const dot of drawing.circles) {
      if (dot.fill) g.fillStyle(dot.colour).fillCircle(dot.x, dot.y, dot.fillRadius ?? dot.radius);
      if (dot.outline) g.lineStyle(dot.outline, INK.navy).strokeCircle(dot.x, dot.y, dot.radius);
    }
    for (const line of drawing.lines) g.lineStyle(line.width, line.colour).lineBetween(line.x1, line.y1, line.x2, line.y2);
  }

  hop(now: number, quick = false, height?: number): void { this.hopAt = now; this.hopHeight = height ?? (quick ? MOTION.quickHop : MOTION.hop); }
  tilt(now: number): void { this.tiltAt = now; }
  update(now: number): void {
    const breath = Math.sin((now + this.offset) / TIMING.breath * Math.PI * 2);
    this.body.setScale(this.scale * (1 - breath * MOTION.breath), this.scale * (1 + breath * MOTION.breath));
    const hop = Math.min(1, (now - this.hopAt) / TIMING.hop);
    this.body.y = breath * MOTION.bob - (hop < 1 ? Math.sin(hop * Math.PI) * this.hopHeight : 0);
    const tilt = Math.min(1, (now - this.tiltAt) / TIMING.feedback);
    this.body.angle = tilt < 1 ? Math.sin(tilt * Math.PI) * MOTION.tilt
      : this.muddled ? Math.sin(now / TIMING.pattern) * MOTION.cloudWobble : 0;
    const blink = (now + this.offset) % TIMING.blink < TIMING.blinkLength;
    if (blink !== this.blinking) { this.blinking = blink; this.lids.setVisible(blink && !this.silhouette); }
  }
  demo(): void {
    this.demonstration?.remove();
    this.showCount(0);
    let step = 0;
    this.demonstration = this.scene.time.addEvent({ delay: TIMING.demo, repeat: MOTION.demoSteps - 1, callback: () => this.showCount(++step) });
  }
}
export function burst(scene: Phaser.Scene, x: number, y: number): void {
  const colours = [INK.coral, INK.yellow, INK.mint];
  for (let i = 0; i < UI.burstCount; i++) {
    const angle = i / UI.burstCount * Math.PI * 2;
    const shape = scene.add.circle(x, y, UI.burstRadius, colours[i % colours.length]);
    scene.tweens.add({ targets: shape, x: x + Math.cos(angle) * UI.burstDistance,
      y: y + Math.sin(angle) * UI.burstDistance, alpha: 0, scale: 0.2, duration: TIMING.burst,
      onComplete: () => shape.destroy() });
  }
}

/** Celebration starts outside the creature, leaving its number panel unobscured. */
export function burstAround(scene: Phaser.Scene, box: Rect): void {
  const colours = [INK.coral, INK.yellow, INK.mint];
  for (let i = 0; i < UI.burstCount; i++) {
    const angle = i / UI.burstCount * Math.PI * 2;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const x = box.x + box.width / 2 + dx * box.width * UI.burstStart;
    const y = box.y + box.height / 2 + dy * box.height * UI.burstStart;
    const shape = scene.add.circle(x, y, UI.burstRadius, colours[i % colours.length]);
    scene.tweens.add({ targets: shape, x: x + dx * UI.burstTravel, y: y + dy * UI.burstTravel,
      alpha: 0, scale: 0.2, duration: TIMING.burst, onComplete: () => shape.destroy() });
  }
}
