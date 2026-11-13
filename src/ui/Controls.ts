import Phaser from 'phaser';
import { answerRects, centre } from '../game/layout';
import { FONT, INK, LAYOUT, PALETTE, SCENERY, TIMING, UI } from '../game/constants';

export interface Control { id: string; x: number; y: number; width: number; height: number; enabled: boolean }
export function text(scene: Phaser.Scene, x: number, y: number, value: string, size: number = UI.bodyFont,
  colour: string = PALETTE.navy): Phaser.GameObjects.Text {
  return scene.add.text(x, y, value, { fontFamily: FONT, fontSize: size, fontStyle: 'bold', color: colour,
    padding: { left: 4, right: 4, top: 4, bottom: 4 } }).setOrigin(0.5);
}
export function plate(scene: Phaser.Scene, x: number, y: number, w: number, h: number,
  colour: number = INK.cream): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(INK.navy, 0.13).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 7, w, h, UI.radius);
  g.fillStyle(colour).fillRoundedRect(x - w / 2, y - h / 2, w, h, UI.radius);
  g.lineStyle(UI.stroke, INK.navy).strokeRoundedRect(x - w / 2, y - h / 2, w, h, UI.radius);
  return g;
}
export class Button extends Phaser.GameObjects.Container {
  readonly label: Phaser.GameObjects.Text;
  readonly control: Control;
  readonly zone: Phaser.GameObjects.Zone;
  private pressed = false;
  constructor(scene: Phaser.Scene, id: string, x: number, y: number, w: number, h: number, value: string,
    action: () => void, colour: number = INK.yellow, fontSize: number = UI.buttonFont, round = false) {
    super(scene, x, y); scene.add.existing(this);
    this.control = { id, x, y, width: w, height: h, enabled: true };
    if (round) this.add(scene.add.circle(0, 0, w / 2, colour).setStrokeStyle(UI.stroke, INK.navy));
    else this.add(plate(scene, 0, 0, w, h, colour));
    this.label = text(scene, 0, 0, value, fontSize); this.add(this.label);
    this.zone = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true }); this.add(this.zone);
    this.zone.on('pointerdown', () => {
      if (!this.control.enabled) return;
      this.pressed = true; this.setScale(0.94, 0.92);
    });
    this.zone.on('pointerout', () => { this.pressed = false; this.setScale(1); });
    this.zone.on('pointerup', () => {
      const fire = this.pressed && this.control.enabled;
      this.pressed = false;
      scene.tweens.add({ targets: this, scaleX: 1, scaleY: 1, duration: TIMING.press });
      if (fire) action();
    });
  }
  enable(enabled: boolean): this { this.control.enabled = enabled; this.setAlpha(enabled ? 1 : 0.45); return this; }
}
export class AnswerPad {
  readonly buttons: Button[];
  constructor(scene: Phaser.Scene, action: (n: number) => void) {
    const p = UI.pad;
    this.buttons = answerRects().map((rect, n) => {
      const c = centre(rect);
      return new Button(scene, `answer-${n}`, c.x, c.y, rect.width, rect.height,
        String(n), () => action(n), INK.cream, p.font);
    });
  }
  enable(enabled: boolean): void { for (const b of this.buttons) b.enable(enabled); }
  highlight(answer: number | null): void {
    for (let n = 0; n < this.buttons.length; n++) {
      this.buttons[n]!.setAlpha(answer === null || n === answer ? 1 : 0.55);
    }
  }
}

export function soundIcon(scene: Phaser.Scene, button: Button, muted = false, graphics?: Phaser.GameObjects.Graphics): Phaser.GameObjects.Graphics {
  const g = graphics ?? scene.add.graphics();
  if (!graphics) button.add(g);
  g.clear();
  const s = SCENERY.iconSize;
  g.fillStyle(INK.navy).fillRect(-s / 2, -s / 7, s / 5, s / 3);
  g.fillTriangle(-s / 3, -s / 7, -s / 12, -s / 2, -s / 12, s / 2);
  g.lineStyle(SCENERY.iconStroke, INK.navy);
  if (muted) g.lineBetween(s / 8, -s / 3, s / 2, s / 3).lineBetween(s / 2, -s / 3, s / 8, s / 3);
  else {
    g.beginPath().arc(0, 0, s / 3, -Math.PI / 3, Math.PI / 3, false).strokePath();
    g.beginPath().arc(0, 0, s * 0.6, -Math.PI / 3, Math.PI / 3, false).strokePath();
  }
  return g;
}
export function hintIcon(scene: Phaser.Scene, button: Button): void {
  const l = LAYOUT.encounter, s = l.hintIconSize;
  const g = scene.add.graphics().setPosition(l.hintIconX, 0);
  g.lineStyle(SCENERY.iconStroke, INK.navy).strokeCircle(0, -s / 6, s / 3)
    .lineBetween(-s / 6, s / 6, -s / 6, s / 3).lineBetween(s / 6, s / 6, s / 6, s / 3)
    .lineBetween(-s / 6, s / 3, s / 6, s / 3).lineBetween(-s / 8, s / 2, s / 8, s / 2);
  button.add(g); button.label.setX(l.hintLabelX);
}
export function speechBubble(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Graphics {
  const s = SCENERY.iconSize;
  const g = scene.add.graphics().setPosition(x, y);
  g.fillStyle(INK.navy).fillRoundedRect(-s / 2, -s / 2, s, s * 0.75, 8);
  g.fillTriangle(-s / 4, s / 5, -s / 4, s / 2, s / 5, s / 5);
  return g;
}

export function bookIcon(scene: Phaser.Scene, button: Button): void {
  const g = scene.add.graphics(), s = SCENERY.iconSize;
  g.fillStyle(INK.cream).fillRoundedRect(-s * 0.6, -s * 0.45, s * 1.2, s * 0.9, 4);
  g.lineStyle(SCENERY.iconStroke, INK.navy).strokeRoundedRect(-s * 0.6, -s * 0.45, s * 1.2, s * 0.9, 4)
    .lineBetween(0, -s * 0.45, 0, s * 0.45);
  g.lineStyle(2, INK.navy).lineBetween(-s * 0.43, -s * 0.17, -s * 0.17, -s * 0.17)
    .lineBetween(s * 0.17, -s * 0.17, s * 0.43, -s * 0.17);
  button.add(g);
}
