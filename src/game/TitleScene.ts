import { currentSession, WARMUP_TAPS } from '../core';
import { Button, plate, text } from '../ui/Controls';
import { BaseScene } from './BaseScene';
import { CANVAS, INK, LAYOUT, PALETTE, PARENT_GATE } from './constants';
import type { Runtime } from './Runtime';
import { STRINGS } from './strings';
import { nextParentChallenge } from '../core/story/parentGate';
import { requestPlayFeatures } from '../platform/device';
import { offlineDisplay, offlineStatus } from '../platform/offlineStatus';
import { centre, titleOfflineLayout } from './layout';
import { OFFLINE_TEXT } from './strings';

export class TitleScene extends BaseScene {
  private gate: { a: number; b: number; entered: string } | null = null;
  private offlineText = '';
  protected details(): Record<string, unknown> {
    return { gate: this.gate, offlineText: this.offlineText, onScreen: [...this.onScreen, ...(this.offlineText ? [this.offlineText] : [])] };
  }
  constructor(runtime: Runtime) { super('title', runtime); }
  create(): void {
    this.begin(); this.gate = null; this.background('bg-title');
    const l = LAYOUT.title;
    this.onScreen = [STRINGS.title];
    text(this, l.titleX, l.titleY + l.shadowOffset, STRINGS.title, l.titleSize, PALETTE.navy);
    text(this, l.titleX, l.titleY, STRINGS.title, l.titleSize, PALETTE.yellow)
      .setStroke(PALETTE.navy, l.outline).setAngle(l.angle);
    this.button('play', l.playX, l.playY, l.playW, STRINGS.play, () => {
      requestPlayFeatures(() => this.runtime.audio.unlock());
      this.runtime.audio.play('hop');
      const key = !this.runtime.save.team.partner ? 'choosePartner'
        : currentSession(this.runtime.save).warmupTaps < WARMUP_TAPS ? 'warmup' : 'map';
      this.go(key);
    }, INK.yellow, l.playH).label.setFontSize(l.playFont);
    // A tap opens the question. The first version needed a three-second hold, gave almost
    // no sign of it, and it was reported as a dead button. The multiplication question
    // is the gate; a child who taps this sees a sum she cannot do and a Back button.
    this.button('grownups', l.grownX, l.grownY, l.grownW, STRINGS.grownups, () => this.parentGate(), INK.cream);
    this.offlineIndicator();
  }
  private offlineIndicator(): void {
    const l = LAYOUT.title.offline, layout = titleOfflineLayout(), p = centre(layout.icon);
    const root = this.add.container(0, 0), ink = this.add.graphics();
    const label = text(this, layout.label.x, centre(layout.label).y, '', l.font).setOrigin(0, 0.5);
    root.add([ink, label]);
    const unsubscribe = offlineStatus.subscribe(state => {
      const mode = offlineDisplay(state); root.setVisible(mode !== 'hidden');
      this.offlineText = mode === 'hidden' ? '' : mode === 'ready' ? OFFLINE_TEXT.ready : OFFLINE_TEXT.getting(state.stored, state.total);
      label.setText(this.offlineText); ink.clear();
      ink.fillStyle(INK.cream, 0.94).fillRoundedRect(l.x, l.y, l.width, l.height, l.padding);
      ink.lineStyle(l.stroke, INK.navy);
      if (mode === 'ready') ink.lineBetween(p.x - l.icon / 3, p.y, p.x - l.icon / 12, p.y + l.icon / 4)
        .lineBetween(p.x - l.icon / 12, p.y + l.icon / 4, p.x + l.icon / 3, p.y - l.icon / 4);
      else ink.lineBetween(p.x, p.y - l.icon / 3, p.x, p.y + l.icon / 6)
        .lineBetween(p.x - l.icon / 4, p.y, p.x, p.y + l.icon / 4)
        .lineBetween(p.x, p.y + l.icon / 4, p.x + l.icon / 4, p.y)
        .lineBetween(p.x - l.icon / 3, p.y + l.icon / 2, p.x + l.icon / 3, p.y + l.icon / 2);
    });
    this.events.once('shutdown', unsubscribe);
  }
  private parentGate(): void {
    if (this.modal) return;
    let previous = this.runtime.parentGateIndex;
    try {
      const stored = sessionStorage.getItem('oddlings-parent-challenge');
      if (stored !== null && Number.isInteger(Number(stored)) && Number(stored) >= 0) previous = Number(stored);
    } catch { /* The in-memory sequence works when session storage is blocked. */ }
    const challenge = nextParentChallenge(previous);
    try { sessionStorage.setItem('oddlings-parent-challenge', String(challenge.index)); } catch { /* Optional. */ }
    this.runtime.parentGateIndex = challenge.index;
    this.gate = { a: challenge.a, b: challenge.b, entered: '' };
    this.modal = true;
    const oldControls = this.controls, oldText = this.onScreen;
    this.controls = [];
    const p = PARENT_GATE, root = this.add.container(0, 0);
    root.add(this.add.rectangle(CANVAS.width / 2, CANVAS.height / 2, CANVAS.width, CANVAS.height, INK.navy, LAYOUT.panel.shade).setInteractive());
    root.add(plate(this, p.x, p.y, p.width, p.height));
    const prompt = STRINGS.parentQuestion(challenge.a, challenge.b);
    root.add(text(this, p.x, p.questionY, prompt, p.font));
    const answer = text(this, p.x, p.answerY, '', p.font); root.add(answer);
    this.onScreen = [prompt];
    const close = () => {
      this.gate = null; this.modal = false; this.controls = oldControls; this.onScreen = oldText; root.destroy();
    };
    const key = (id: string, x: number, y: number, label: string, action: () => void, width: number = p.keySize) => {
      const b = new Button(this, id, x, y, width, p.keySize, label, action, INK.cream, p.keyFont);
      root.add(b); this.controls.push(b.control);
    };
    const show = () => { answer.setText(this.gate!.entered); this.onScreen = [prompt, this.gate!.entered].filter(Boolean); };
    for (let n = 1; n <= 9; n++) key(`parent-${n}`, p.firstX + (n - 1) % 3 * p.gap,
      p.firstY + Math.floor((n - 1) / 3) * p.gap, String(n), () => {
        if (this.gate!.entered.length < p.digits) this.gate!.entered += String(n); show();
      });
    key('parent-clear', p.firstX, p.firstY + p.gap * 3, STRINGS.clearKey, () => { this.gate!.entered = ''; show(); });
    key('parent-0', p.firstX + p.gap, p.firstY + p.gap * 3, '0', () => {
      if (this.gate!.entered.length < p.digits) this.gate!.entered += '0'; show();
    });
    key('parent-go', p.firstX + p.gap * 2, p.firstY + p.gap * 3, STRINGS.go, () => {
      const correct = this.gate!.entered !== '' && Number(this.gate!.entered) === challenge.answer;
      close();
      if (correct) { this.runtime.audio.stopSpeech(); location.assign('./parent.html'); }
    });
    key('close', p.closeX, p.closeY, STRINGS.close, close, p.closeW);
  }

}
