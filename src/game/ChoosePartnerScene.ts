import { STARTERS } from '../core/story/characters';
import Phaser from 'phaser';
import { plate, text } from '../ui/Controls';
import { BaseScene } from './BaseScene';
import { CENTER_X, INK, LAYOUT, UI } from './constants';
import type { Runtime } from './Runtime';
import { STRINGS } from './strings';

export class ChoosePartnerScene extends BaseScene {
  private selected: typeof STARTERS[number] | null = null;
  constructor(runtime: Runtime) { super('choosePartner', runtime); }
  protected details(): Record<string, unknown> { return { selected: this.selected, partners: STARTERS }; }
  create(): void {
    this.begin(); this.selected = null; this.background('bg-encounter-meadow');
    const l = LAYOUT.choose;
    text(this, CENTER_X, l.headingY, STRINGS.choose, UI.titleFont); this.speak('ui-choose'); this.onScreen = [STRINGS.choose];
    const pick = this.button('pick', CENTER_X, l.pickY, l.pickW, STRINGS.pick, () => {
      if (!this.selected) return;
      const save = this.runtime.save;
      save.team.partner = this.selected;
      if (!save.team.friends.includes(this.selected)) save.team.friends.push(this.selected);
      save.story.introComplete = true;
      this.saveThen(() => this.go('warmup'));
    }).enable(false);
    const cards: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < STARTERS.length; i++) {
      const id = STARTERS[i]!, x = l.xs[i]!;
      plate(this, x, l.cardY, l.cardW, l.cardH);
      const pal = this.pal(id, x, l.creatureY, l.creatureW);
      text(this, x, l.nameY, STRINGS.names[id], UI.subheadingFont);
      // A transparent full-card target lets a child tap the creature itself.
      const zone = this.add.zone(x, l.cardY, l.cardW, l.cardH).setInteractive({ useHandCursor: true });
      this.controls.push({ id, x, y: l.cardY, width: l.cardW, height: l.cardH, enabled: true });
      zone.on('pointerdown', () => {
        if (this.busy || this.modal) return;
        this.selected = id; pick.enable(true); pal.hop(this.runtime.elapsed); pal.demo();
        this.runtime.audio.play('hop'); this.speak(`name-${id}`);
        for (const card of cards) card.setVisible(false);
        selected.setVisible(true);
      });
      const selected = this.add.rectangle(x, l.cardY, l.cardW, l.cardH).setStrokeStyle(UI.selectedStroke, INK.mint).setFillStyle(INK.mint, 0).setVisible(false);
      // Store a small visual wrapper, not another input target.
      cards.push(selected);
    }
  }
}
