import Phaser from 'phaser';
import { getArea } from '../core/areas';
import { Button, arrowIcon, bookIcon, plate, soundIcon, text, type Control } from '../ui/Controls';
import { Oddling, type CharacterId } from '../ui/Oddling';
import { CANVAS, FADE_RGB, INK, LAYOUT, SCENERY, TIMING, UI } from './constants';
import type { Runtime } from './Runtime';
import { STRINGS } from './strings';
import { centre, standingRect, groundTransform, backgroundMeta, mapTransform } from './layout';
import { speechWait } from './speechTiming';
import { RENDER_SCALE } from '../platform/renderScale';
export { mapPoint } from './layout';

export class BaseScene extends Phaser.Scene {
  protected controls: Control[] = [];
  protected pals: Oddling[] = [];
  protected busy = false;
  protected modal = false;
  protected onScreen: string[] = [];
  protected speechId = '';
  private speechUntil = 0;
  private speechRevision = 0;
  constructor(key: string, protected readonly runtime: Runtime) { super(key); }
  protected begin(): void {
    this.controls = []; this.pals = []; this.busy = false; this.modal = false; this.onScreen = [];
    this.input.enabled = true; this.speechId = ''; this.speechUntil = 0; this.speechRevision++;
    this.runtime.audio.stopSpeech();
    // Phaser 4 tweens otherwise read Date.now. Share the game delta with the hook.
    this.tweens.getDelta = () => this.runtime.delta;
    // Scenes are laid out in logical pixels; the camera maps them onto the larger canvas.
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(CANVAS.width / 2, CANVAS.height / 2);
    this.cameras.main.fadeIn(TIMING.fade, ...FADE_RGB);
    this.runtime.snapshot = () => ({ scene: this.scene.key, onScreen: this.onScreen,
      controls: this.controls, busy: this.busy, modal: this.modal, ...this.details() });
  }
  protected details(): Record<string, unknown> { return {}; }
  protected background(key: string): void {
    if (key === getArea(this.runtime.save.map.area).mapBackground) {
      const t = mapTransform(this.runtime.save.map.area);
      this.add.image(t.x, t.y, key).setOrigin(0).setScale(t.scale); return;
    }
    const meta = backgroundMeta(key);
    const scale = Math.max(CANVAS.width / meta.width, CANVAS.height / meta.height);
    this.add.image(CANVAS.width / 2, CANVAS.height / 2, key).setScale(scale);
  }
  protected meadow(groundY: number = SCENERY.groundY): void { this.ground('bg-encounter-meadow', groundY); }
  protected ground(key: string, groundY: number = SCENERY.groundY, shiftUp = 0): void {
    const t = groundTransform(key, groundY, shiftUp);
    this.add.rectangle(CANVAS.width / 2, CANVAS.height / 2, CANVAS.width, CANVAS.height, t.colour);
    this.add.image(t.x, t.y, key).setOrigin(0).setScale(t.scale);
    // Alpha strips soften the image edge in both renderers.
    const blend = this.add.graphics(), strip = SCENERY.seamHeight / SCENERY.seamSteps;
    for (let i = 0; i < SCENERY.seamSteps; i++) blend.fillStyle(t.colour, (i + 1) / SCENERY.seamSteps)
      .fillRect(0, t.bottom - SCENERY.seamHeight + i * strip, CANVAS.width, strip);
  }
  protected standingPal(id: CharacterId, x: number, feet: number, width: number): Oddling {
    const c = centre(standingRect(id, x, feet, width)); return this.pal(id, c.x, c.y, width);
  }
  protected speak(id: string): void {
    this.speechId = id; this.speechRevision++;
    this.speechUntil = this.runtime.elapsed + speechWait(0, this.runtime.audio.duration(id));
    this.runtime.audio.say(id);
  }
  protected interruptSpeech(): void {
    this.speechRevision++; this.speechUntil = 0; this.runtime.audio.stopSpeech();
  }
  protected afterSpeech(minimum: number, action: () => void): void {
    const earliest = this.runtime.elapsed + minimum;
    const check = () => {
      const remaining = Math.max(earliest, this.speechUntil) - this.runtime.elapsed;
      // A repeat tap can extend the deadline while this timer is waiting.
      if (remaining > 0) this.time.delayedCall(remaining, check);
      else action();
    };
    check();
  }
  protected speakSequence(ids: readonly string[]): void {
    const next = (index: number) => {
      if (!ids[index]) return;
      this.speak(ids[index]);
      const revision = this.speechRevision;
      if (index + 1 < ids.length) this.afterSpeech(0, () => {
        if (revision === this.speechRevision) next(index + 1);
      });
    };
    next(0);
  }
  protected speaker(x: number, y: number, size: number = UI.minTouch): Button {
    const b = new Button(this, 'speaker', x, y, size, size, '', () => {
      if (!this.busy && !this.modal && this.speechId) this.speak(this.speechId);
    }, INK.cream, UI.buttonFont, true);
    soundIcon(this, b); this.controls.push(b.control); return b;
  }
  protected bookButton(x: number, y: number, action: () => void): Button {
    const b = new Button(this, 'oddbook', x, y, UI.minTouch, UI.minTouch, '', () => {
      if (!this.busy && !this.modal) { this.runtime.audio.play('tap'); action(); }
    }, INK.cream, UI.buttonFont, true);
    bookIcon(this, b); this.controls.push(b.control); return b;
  }
  protected backButton(x: number, y: number, action: () => void, size: number = UI.minTouch): Button {
    const b = new Button(this, 'back', x, y, size, size, '', () => {
      if (this.busy || this.modal) return;
      this.interruptSpeech(); this.runtime.audio.play('tap'); action();
    }, INK.cream, UI.buttonFont, true);
    // One arrow tap must not also reach a scene's tap-anywhere listener.
    b.zone.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number,
      event: Phaser.Types.Input.EventData) => event.stopPropagation());
    arrowIcon(this, b); this.controls.push(b.control); return b;
  }
  protected pal(id: CharacterId, x: number, y: number, width: number): Oddling {
    const pal = new Oddling(this, id, x, y, width); this.pals.push(pal); return pal;
  }
  protected button(id: string, x: number, y: number, w: number, label: string, action: () => void,
    colour: number = INK.yellow, height: number = UI.minTouch): Button {
    const button = new Button(this, id, x, y, w, height, label, () => {
      if (this.busy || this.modal) return;
      this.interruptSpeech();
      this.runtime.audio.play('tap'); action();
    }, colour);
    this.controls.push(button.control); return button;
  }
  protected go(key: string, data: object = {}): void {
    if (this.busy) return;
    this.busy = true; this.input.enabled = false; this.interruptSpeech();
    this.cameras.main.fadeOut(TIMING.fade, ...FADE_RGB);
    this.time.delayedCall(TIMING.fade, () => this.scene.start(key, data));
  }
  protected saveThen(action: () => void): void {
    this.busy = true;
    void this.runtime.persist().then(() => {
      if (!this.sys.isActive()) return;
      this.busy = false;
      if (this.runtime.saveError) this.panel(STRINGS.saveError, () => this.saveThen(action));
      else action();
    });
  }
  protected panel(message: string, close?: () => void): void {
    if (this.modal) return;
    this.modal = true;
    const previous = this.controls;
    const previousText = this.onScreen;
    this.onScreen = [...previousText, message];
    const messageKey = Object.entries(STRINGS).find(([, value]) => value === message)?.[0];
    if (messageKey) this.speak(`ui-${messageKey}`);
    const p = LAYOUT.panel;
    const cover = this.add.rectangle(CANVAS.width / 2, CANVAS.height / 2, CANVAS.width, CANVAS.height, INK.navy, LAYOUT.panel.shade)
      .setInteractive();
    const paper = plate(this, p.x, p.y, p.width, p.height);
    const label = text(this, p.x, p.messageY, message, UI.subheadingFont);
    const button = new Button(this, 'close', p.x, p.closeY, p.closeW, UI.minTouch, STRINGS.close, () => {
      this.interruptSpeech();
      this.modal = false; this.controls = previous; this.onScreen = previousText;
      cover.destroy(); paper.destroy(); label.destroy(); button.destroy(); close?.();
    });
    this.controls = [button.control];
  }
  update(): void {
    for (let i = 0; i < this.pals.length; i++) this.pals[i]!.update(this.runtime.elapsed);
  }
}
