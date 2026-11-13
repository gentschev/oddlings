import { getArea } from '../core/areas';
import { offerCamp } from '../core/path';
import { text } from '../ui/Controls';
import { burstAround } from '../ui/Oddling';
import { BaseScene } from './BaseScene';
import { CENTER_X, LAYOUT, TIMING, UI } from './constants';
import type { Runtime } from './Runtime';
import { STRINGS } from './strings';
import { centre, rewardLayout } from './layout';
import { rewardPresentation, type Reward } from './rewardPresentation';

export class RewardScene extends BaseScene {
  private reward!: Reward;
  constructor(runtime: Runtime) { super('reward', runtime); }
  protected details(): Record<string, unknown> {
    const content = rewardPresentation(this.reward), layout = rewardLayout(content.pals, !!content.joining);
    return { ...this.reward, team: this.runtime.save.team.friends, shownPals: layout.pals.map(p => p.id), layout, speechId: this.speechId };
  }
  create(data: Reward): void {
    this.begin(); this.reward = data; this.ground(getArea(this.runtime.save.map.area).encounterBackground, LAYOUT.reward.feetY);
    const l = LAYOUT.reward, content = rewardPresentation(data), layout = rewardLayout(content.pals, !!content.joining);
    const lines = [content.headline, content.joining, content.facts].filter(line => line !== null);
    this.onScreen = [...lines.map(line => line.text), STRINGS.keepGoing];
    text(this, CENTER_X, l.titleY, content.headline.text, UI.titleFont);
    if (content.joining) text(this, CENTER_X, l.joinY, content.joining.text, l.joinFont);
    if (content.facts) text(this, CENTER_X, l.progressY, content.facts.text, UI.bodyFont);
    for (const { id, rect } of layout.pals) {
      const c = centre(rect), pal = this.pal(id, c.x, c.y, rect.width);
      pal.setMuddled(true);
      this.time.delayedCall(TIMING.question, () => {
        pal.restorePattern(); pal.hop(this.runtime.elapsed); burstAround(this, rect);
      });
    }
    this.time.delayedCall(TIMING.question, () => this.runtime.audio.play(data.joinedPals.length ? 'fanfare' : 'correct'));
    const speakLine = (index: number) => {
      if (this.busy || !lines[index]) return;
      this.speak(lines[index].id);
      if (index + 1 < lines.length) this.afterSpeech(0, () => speakLine(index + 1));
    };
    speakLine(0);
    this.speaker(LAYOUT.story.speakerX, l.buttonY);
    this.button('map', CENTER_X, l.buttonY, l.buttonW, STRINGS.keepGoing, () => {
      const key = offerCamp(this.runtime.save, this.runtime.now()) ? 'camp' : 'map';
      this.saveThen(() => this.go(key));
    });
  }
}
