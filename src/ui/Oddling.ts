import Phaser from 'phaser';
import manifest from '../../public/assets/art/manifest.json';
import { addition, frame, ODDLING_PATTERNS, type OddlingId, type Fact } from '../core';
import { FRIEND_PATTERNS, type FriendId } from '../core/story/characters';
import { INK, MOTION, TIMING, UI } from '../game/constants';
import { dotGeometry } from './patternGeometry';
import { drawDots, drawFrame } from './PictureModels';

import type { CharacterId, Rect } from '../game/layout';
export type { CharacterId } from '../game/layout';
const SEGMENTS = manifest.characters.inch.segments;
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
  muddled = false;
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
  setSilhouette(): void { this.silhouette = true; this.image.setTint(INK.navy).setTintMode(Phaser.TintModes.FILL); this.pattern.clear(); this.lids.setVisible(false); }
  restorePattern(): void { this.showCount(FRIEND_PATTERNS[this.id as FriendId] ?? 0); }
  showCount(n: number): void { this.showFact(this.id === 'domi' ? addition(Math.floor(n / 2), Math.floor(n / 2)) : frame(n), true); }
  showFact(fact: Fact, reveal: boolean): void {
    const g = this.pattern; g.clear(); if (this.silhouette) return;
    const panels = manifest.characters[this.id].patternPanels;
    const p = panels[0];
    const pattern = ODDLING_PATTERNS[this.id as OddlingId];
    if (pattern === 'segments') {
      const fits = Math.max(fact.a, fact.b, fact.answer) <= SEGMENTS.length;
      const count = reveal && fits ? fact.answer : 0;
      for (let i = 0; i < SEGMENTS.length; i++) {
        const { x, y } = SEGMENTS[i]!;
        g.lineStyle(3, INK.navy).strokeCircle(x, y, MOTION.segmentRadius);
        if (i < count) g.fillStyle(i < fact.a ? INK.coral : INK.cream).fillCircle(x, y, MOTION.segmentRadius * 0.75);
        if (reveal && fits && fact.operation === 'sub' && i >= fact.answer && i < fact.a) {
          g.lineStyle(4, INK.navy).lineBetween(x - 13, y - 13, x + 13, y + 13);
        }
      }
      return;
    }
    if (!p) return;
    const x = p.x + p.w * MOTION.panelInset, y = p.y + p.h * MOTION.panelInset;
    const w = p.w * (1 - 2 * MOTION.panelInset), h = p.h * (1 - 2 * MOTION.panelInset);
    if (pattern === 'ten-frame') {
      if (Math.max(fact.a, fact.b, fact.answer) > 10) return;
      const cell = Math.min(w / 5.4, h / 2.2), gap = cell * 0.08;
      const displayed = reveal ? fact : frame(0);
      drawFrame(g, displayed, p.x + (p.w - (cell * 5 + gap * 4)) / 2,
        p.y + (p.h - cell * 2 - gap) / 2, cell, gap);
    } else if (pattern === 'domino') {
      g.lineStyle(3, INK.navy).lineBetween(p.x + p.w / 2, y, p.x + p.w / 2, y + h);
      if (reveal) {
        const a = fact.operation === 'frame' || fact.operation === 'dots' ? Math.ceil(fact.a / 2)
          : fact.operation === 'sub' ? fact.answer : fact.a;
        const b = fact.operation === 'frame' || fact.operation === 'dots' ? Math.floor(fact.a / 2)
          : fact.operation === 'miss' ? fact.answer : fact.b;
        drawDots(g, a, x, y, w / 2 - 4, h, INK.coral);
        drawDots(g, b, x + w / 2 + 4, y, w / 2 - 4, h, INK.navy);
        if (fact.operation === 'sub') g.lineStyle(4, INK.navy).lineBetween(x + w / 2, y, x + w, y + h);
      }
    } else if (reveal) {
      const count = fact.operation === 'sub' ? fact.a : fact.operation === 'miss' ? fact.b : fact.answer;
      const capacity = pattern === 'five-dots' ? 5 : 10;
      if (count > capacity) return;
      const mark = (index: number, xx: number, yy: number, radius: number) => {
        const colour = fact.operation === 'add' || fact.operation === 'miss' ? (index < fact.a ? INK.coral : INK.mint) : INK.navy;
        g.fillStyle(colour).fillCircle(xx, yy, radius);
        if (fact.operation === 'sub' && index >= fact.answer) {
          g.lineStyle(Math.max(3, radius / 3), INK.coral).lineBetween(xx - radius, yy - radius, xx + radius, yy + radius)
            .lineBetween(xx + radius, yy - radius, xx - radius, yy + radius);
        }
      };
      if (pattern === 'dice') {
        const left = Math.ceil(count / 2);
        panels.forEach((panel, side) => dotGeometry(side === 0 ? left : count - left,
          { x: panel.x, y: panel.y, width: panel.w, height: panel.h }, panel.h / 10)
          .forEach((d, i) => mark(i + (side === 0 ? 0 : left), d.x, d.y, d.radius)));
      } else if (pattern === 'pairs') {
        const rows = Math.ceil(count / 2), radius = Math.min(w / 8, h / Math.max(1, rows) / 3);
        for (let i = 0; i < count; i++) mark(i, x + w * (i % 2 === 0 ? 0.3 : 0.7),
          y + h * (Math.floor(i / 2) + 0.5) / rows, radius);
      } else {
        dotGeometry(count, { x: x + w * 0.13, y: y + h * 0.13, width: w * 0.74, height: h * 0.74 }, h * 0.074)
          .forEach((d, i) => mark(i, d.x, d.y, d.radius));
      }
    }
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
