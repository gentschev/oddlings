import { getArea } from '../core/areas';
import { currentSession, ODDLING_IDS, type OddlingId } from '../core';
import { text } from '../ui/Controls';
import { BaseScene } from './BaseScene';
import { campTeamLayout, centre } from './layout';
import { CENTER_X, INK, LAYOUT, TIMING, UI } from './constants';
import type { Runtime } from './Runtime';
import { STRINGS } from './strings';

export class CampScene extends BaseScene {
  constructor(runtime: Runtime) { super('camp', runtime); }
  protected details(): Record<string, unknown> { return { area: this.runtime.save.map.area, background: getArea(this.runtime.save.map.area).encounterBackground, team: this.runtime.save.team.friends, partner: this.runtime.save.team.partner }; }
  create(): void {
    this.begin(); this.ground(getArea(this.runtime.save.map.area).encounterBackground); currentSession(this.runtime.save).campOffered = true;
    const l = LAYOUT.camp;
    this.onScreen = [STRINGS.camp, STRINGS.stop, STRINGS.keepGoing];
    this.speak('ui-camp'); text(this, CENTER_X, l.headingY, STRINGS.camp, UI.titleFont);
    const label = text(this, CENTER_X, l.nameY, '', UI.subheadingFont);
    const friends = this.runtime.save.team.friends.filter((id): id is OddlingId => ODDLING_IDS.includes(id as OddlingId));
    const layout = campTeamLayout(friends);
    friends.forEach((id, i) => {
      const r = layout[i]!, c = centre(r), pal = this.pal(id, c.x, c.y, r.width);
      const target = this.add.zone(c.x, l.feetY - l.petHeight / 2, r.width, l.petHeight).setInteractive({ useHandCursor: true });
      this.controls.push({ id: `pet-${id}`, x: c.x, y: l.feetY - l.petHeight / 2, width: r.width, height: l.petHeight, enabled: true });
      target.on('pointerdown', () => {
        if (this.busy || this.modal) return;
        label.setText(STRINGS.names[id]); this.onScreen = [STRINGS.camp, STRINGS.names[id], STRINGS.stop, STRINGS.keepGoing];
        pal.hop(this.runtime.elapsed); this.runtime.audio.play('hop'); this.speak(`name-${id}`);
        const heart = this.add.graphics().setPosition(c.x, r.y - l.heartGap);
        const size = l.heartSize;
        heart.fillStyle(INK.coral).fillCircle(-size / 4, 0, size / 3).fillCircle(size / 4, 0, size / 3)
          .fillTriangle(-size * 0.56, 0, size * 0.56, 0, 0, size * 0.65);
        this.tweens.add({ targets: heart, y: heart.y - l.heartLift, alpha: 0, duration: TIMING.heart, onComplete: () => heart.destroy() });
      });
    });
    const finish = (key: string) => this.saveThen(() => this.go(key));
    this.button('stop', l.stopX, l.buttonsY, l.buttonW, STRINGS.stop, () => finish('title'));
    this.button('keepGoing', l.goX, l.buttonsY, l.buttonW, STRINGS.keepGoing, () => finish('map'));
    this.bookButton(l.bookX, l.buttonsY, () => this.go('oddbook', { returnTo: 'camp' }));
  }
}
