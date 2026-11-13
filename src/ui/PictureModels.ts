import Phaser from 'phaser';
import type { Fact, Model } from '../core';
import { FONT, INK, PALETTE, UI } from '../game/constants';

import { dotGeometry } from './patternGeometry';

export function drawDots(g: Phaser.GameObjects.Graphics, count: number, x: number, y: number,
  w: number, h: number, colour: number = INK.navy, scattered = false, radius = h / 10): void {
  for (const dot of dotGeometry(count, { x, y, width: w, height: h }, radius, scattered)) {
    g.fillStyle(colour).fillCircle(dot.x, dot.y, dot.radius);
  }
}

export function drawFrame(g: Phaser.GameObjects.Graphics, fact: Fact, x: number, y: number,
  cell: number, gap: number, frames = 1): void {
  const count = fact.operation === 'sub' ? fact.a : fact.operation === 'miss' ? fact.b : fact.answer;
  const first = fact.operation === 'frame' || fact.operation === 'dots' ? count : fact.a;
  for (let i = 0; i < frames * 10; i++) {
    const frame = Math.floor(i / 10);
    const xx = x + (i % 5) * (cell + gap) + frame * (cell * 5 + gap * 4 + UI.model.frameGap);
    const yy = y + (Math.floor(i / 5) % 2) * (cell + gap);
    g.lineStyle(Math.max(1, cell * 0.06), INK.navy).strokeRoundedRect(xx, yy, cell, cell, cell * 0.1);
    if (i < count) {
      g.fillStyle(i < first ? INK.coral : INK.mint).fillCircle(xx + cell / 2, yy + cell / 2, cell * 0.33);
      if (fact.operation === 'sub' && i >= fact.answer) {
        g.lineStyle(Math.max(2, cell * 0.09), INK.navy);
        g.lineBetween(xx + cell * 0.18, yy + cell * 0.18, xx + cell * 0.82, yy + cell * 0.82);
        g.lineBetween(xx + cell * 0.82, yy + cell * 0.18, xx + cell * 0.18, yy + cell * 0.82);
      }
    }
  }
}

export class TenFrame extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, fact: Fact, double = false) {
    super(scene, x, y); scene.add.existing(this);
    const { cell, gap } = UI.model;
    const g = scene.add.graphics(); this.add(g);
    const singleWidth = cell * 5 + gap * 4;
    const width = double ? singleWidth * 2 + UI.model.frameGap : singleWidth;
    const height = cell * 2 + gap;
    drawFrame(g, fact, -width / 2, -height / 2, cell, gap, double ? 2 : 1);
  }
}
export class DotCard extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, fact: Fact) {
    super(scene, x, y); scene.add.existing(this);
    const g = scene.add.graphics(); this.add(g);
    const { dotWidth, dotHeight, dot, dotPadding } = UI.model;
    const w = dotWidth + dotPadding * 2, h = dotHeight + dotPadding * 2;
    g.fillStyle(INK.cream).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.lineStyle(UI.stroke, INK.navy).strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    drawDots(g, fact.a, -dotWidth / 2, -dotHeight / 2, dotWidth, dotHeight, INK.navy, fact.layout === 'scattered', dot);
  }
}
export class Domino extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, fact: Fact) {
    super(scene, x, y); scene.add.existing(this);
    const w = UI.model.dominoWidth, h = UI.model.dominoHeight;
    const g = scene.add.graphics(); this.add(g);
    g.fillStyle(INK.cream).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.lineStyle(UI.stroke, INK.navy).strokeRoundedRect(-w / 2, -h / 2, w, h, 12).lineBetween(0, -h / 2, 0, h / 2);
    const left = fact.operation === 'sub' ? fact.answer : fact.a;
    const right = fact.operation === 'miss' ? fact.answer : fact.b;
    drawDots(g, left, -w / 2 + 8, -h / 2 + 8, w / 2 - 16, h - 16, INK.coral);
    drawDots(g, right, 8, -h / 2 + 8, w / 2 - 16, h - 16, INK.mint);
    if (fact.operation === 'sub') {
      g.lineStyle(UI.stroke, INK.navy).lineBetween(10, -h / 2 + 10, w / 2 - 10, h / 2 - 10);
    }
  }
}
export class NumberLine extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, fact: Fact) {
    super(scene, x, y); scene.add.existing(this);
    const g = scene.add.graphics(); this.add(g);
    const length = UI.model.lineLength, step = length / 20;
    g.lineStyle(UI.model.lineWidth, INK.navy).lineBetween(-length / 2, 0, length / 2, 0);
    for (let n = 0; n <= 20; n++) {
      const xx = -length / 2 + n * step;
      g.lineBetween(xx, -UI.model.tick / 2, xx, UI.model.tick / 2);
      this.add(scene.add.text(xx, UI.model.tick, String(n), { fontFamily: FONT, fontSize: 17, color: PALETTE.navy }).setOrigin(0.5, 0));
    }
    const change = fact.operation === 'miss' ? fact.answer : fact.b;
    const direction = fact.operation === 'sub' ? -1 : 1;
    const end = fact.a + change * direction;
    for (let i = 0; i < change; i++) {
      const from = fact.a + i * direction, to = from + direction;
      const xx = -length / 2 + (from + to) / 2 * step;
      g.lineStyle(UI.model.lineWidth, INK.coral).beginPath();
      g.arc(xx, 0, step / 2, Math.PI, Math.PI * 2, false); g.strokePath();
      const tip = -length / 2 + to * step;
      g.lineBetween(tip, 0, tip - direction * 5, -8);
    }
    g.fillStyle(INK.navy).fillCircle(-length / 2 + fact.a * step, 0, 6);
    g.fillStyle(INK.coral).fillCircle(-length / 2 + end * step, 0, 6);
  }
}
export function pictureModel(scene: Phaser.Scene, x: number, y: number, fact: Fact, model: Model): Phaser.GameObjects.Container {
  if (fact.operation === 'dots') return new DotCard(scene, x, y, fact);
  if (fact.operation === 'frame') return new TenFrame(scene, x, y, fact);
  if (model === 'number-line') return new NumberLine(scene, x, y, fact);
  if (model === 'domino') return new Domino(scene, x, y, fact);
  const total = fact.operation === 'sub' ? fact.a : fact.operation === 'miss' ? fact.b : fact.answer;
  return new TenFrame(scene, x, y, fact, model === 'double-ten-frame' || total > 10);
}
