import Phaser from 'phaser';
import { choosePartner, ODDLING_IDS, oddlingProgress, type OddlingId } from '../core';
import { plate, text } from '../ui/Controls';
import { BaseScene } from './BaseScene';
import { centre, oddbookLayout, standingRect } from './layout';
import { CENTER_X, INK, LAYOUT, UI } from './constants';
import type { Runtime } from './Runtime';
import { ODDLING_LINES, STRINGS } from './strings';

interface BookData { returnTo?: 'map' | 'camp'; selected?: OddlingId }
export class OddbookScene extends BaseScene {
  private returnTo: 'map' | 'camp' = 'map';
  private selected: OddlingId | null = null;
  constructor(runtime: Runtime) { super('oddbook', runtime); }
  protected details(): Record<string, unknown> {
    const save = this.runtime.save;
    return { returnTo: this.returnTo, selected: this.selected, partner: save.team.partner,
      cards: ODDLING_IDS.map((id, i) => ({ id, met: save.team.friends.includes(id), partner: save.team.partner === id,
        progress: save.team.friends.includes(id) ? oddlingProgress(save, id) : null, ...oddbookLayout()[i] })) };
  }
  create(data: BookData = {}): void {
    this.begin(); this.background('bg-title');
    this.returnTo = data.returnTo ?? 'map';
    const save = this.runtime.save, l = LAYOUT.oddbook, layout = oddbookLayout();
    this.selected = null;
    this.onScreen = [STRINGS.yourPals, ...ODDLING_IDS.map(id => save.team.friends.includes(id) ? STRINGS.names[id] : '?'), STRINGS.close];
    text(this, CENTER_X, l.headingY, STRINGS.yourPals, l.headingSize);
    const line = text(this, CENTER_X, l.lineY, '', l.lineSize);
    this.button('back', l.backX, l.backY, l.backW, STRINGS.close, () => this.go(this.returnTo), INK.cream);
    const outlines: Phaser.GameObjects.Rectangle[] = [];
    const select = (id: OddlingId) => {
      if (this.busy || this.modal) return;
      this.selected = id; line.setText(ODDLING_LINES[id]);
      this.onScreen = [STRINGS.yourPals, ODDLING_LINES[id], ...ODDLING_IDS.map(id => save.team.friends.includes(id) ? STRINGS.names[id] : '?'),
        ...(save.team.friends.some(id => id !== save.team.partner) ? [STRINGS.bePal] : []), STRINGS.close];
      this.speakSequence([`name-${id}`, `pal-${id}`]);
      for (let i = 0; i < outlines.length; i++) outlines[i]!.setVisible(ODDLING_IDS[i] === id);
      const pal = this.pals[ODDLING_IDS.indexOf(id)]!; pal.hop(this.runtime.elapsed, false, l.hop);
    };
    ODDLING_IDS.forEach((id, i) => {
      const r = layout[i]!, c = centre(r.card), met = save.team.friends.includes(id), partner = save.team.partner === id;
      plate(this, c.x, c.y, r.card.width, r.card.height);
      const target = this.add.zone(c.x, c.y, r.card.width, r.card.height);
      if (met) target.setInteractive({ useHandCursor: true }).on('pointerdown', () => select(id));
      this.controls.push({ id: `card-${id}`, ...c, width: r.card.width, height: r.card.height, enabled: met });
      text(this, c.x, r.card.y + l.nameY, met ? STRINGS.names[id] : '?', UI.bodyFont);
      const position = centre(standingRect(id, r.card.x + l.portraitX, r.card.y + l.portraitFeet, l.portraitW));
      const pal = this.pal(id, position.x, position.y, l.portraitW);
      if (!met) pal.setSilhouette();
      if (partner) this.add.star(r.card.x + l.starX, r.card.y + l.starY, 5, l.starSize / 2, l.starSize, INK.yellow).setStrokeStyle(UI.stroke / 2, INK.navy);
      if (met && !partner) this.button(`partner-${id}`, r.card.x + l.buttonX, r.card.y + l.buttonY,
        l.buttonW, STRINGS.bePal, () => {
          if (!choosePartner(save, id)) return;
          this.saveThen(() => this.go('oddbook', { returnTo: this.returnTo, selected: id }));
        }, INK.yellow, l.buttonH).label.setFontSize(l.buttonFont);
      const g = this.add.graphics(), bar = r.bar;
      g.fillStyle(INK.navy, 0.12).fillRoundedRect(bar.x, bar.y, bar.width, bar.height, bar.height / 2);
      if (met) {
        const progress = oddlingProgress(save, id), accurateW = progress.accurateShare * bar.width, fluentW = progress.fluentShare * bar.width;
        if (accurateW) g.fillStyle(INK.mint).fillRect(bar.x, bar.y, accurateW, bar.height);
        if (fluentW) g.fillStyle(INK.yellow).fillRect(bar.x + accurateW, bar.y, fluentW, bar.height);
      }
      g.lineStyle(UI.stroke / 2, INK.navy).strokeRoundedRect(bar.x, bar.y, bar.width, bar.height, bar.height / 2);
      outlines.push(this.add.rectangle(c.x, c.y, r.card.width, r.card.height).setStrokeStyle(UI.selectedStroke, INK.mint).setFillStyle(INK.cream, 0).setVisible(false));
    });
    const initial = data.selected ?? (ODDLING_IDS.includes(save.team.partner as OddlingId) ? save.team.partner as OddlingId : ODDLING_IDS.find(id => save.team.friends.includes(id)));
    if (initial && save.team.friends.includes(initial)) select(initial);
  }
}
