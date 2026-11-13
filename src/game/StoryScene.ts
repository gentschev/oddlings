import Phaser from 'phaser';
import { areaForStop, storyListener, type StoryStop } from '../core/areas';
import { seeStory } from '../core/path';
import { plate, text } from '../ui/Controls';
import { BaseScene } from './BaseScene';
import { burst } from '../ui/Oddling';
import { centre, storyLayout } from './layout';
import { CENTER_X, INK, LAYOUT, STORY_EFFECTS, TIMING, UI } from './constants';
import type { Runtime } from './Runtime';
import { STRINGS } from './strings';

export class StoryScene extends BaseScene {
  private stop!: StoryStop;
  private line = 0;
  private ringHighlighted = false;
  private pageHighlighted = false;
  private wallsHighlighted = false;
  private shapeShown = false;
  private shapeGone = false;
  constructor(runtime: Runtime) { super('story', runtime); }
  protected details(): Record<string, unknown> {
    const area = areaForStop(this.stop.id), beat = area.stories[this.stop.beat]!;
    const listener = storyListener(this.runtime.save, beat.speaker);
    return { stop: this.stop.id, area: area.number, line: this.line, background: beat.background,
      speaker: beat.speaker, listener, ringHighlighted: this.ringHighlighted, pageHighlighted: this.pageHighlighted,
      wallsHighlighted: this.wallsHighlighted, shapeShown: this.shapeShown, shapeGone: this.shapeGone,
      layout: storyLayout(beat.background, beat.speaker, listener) };
  }
  create(data: { stop: StoryStop }): void {
    this.begin(); this.stop = data.stop; this.line = 0; this.ringHighlighted = false;
    this.pageHighlighted = false; this.wallsHighlighted = false; this.shapeShown = false; this.shapeGone = false;
    const l = LAYOUT.story, area = areaForStop(this.stop.id), beat = area.stories[this.stop.beat]!;
    const lines = beat.lines, listener = storyListener(this.runtime.save, beat.speaker);
    const layout = storyLayout(beat.background, beat.speaker, listener);
    this.ground(beat.background, l.feetY, l.feetY - layout.transform.feetY);
    const a = centre(layout.speaker), b = centre(layout.listener);
    this.pal(beat.speaker, a.x, a.y, layout.speaker.width);
    const partner = this.pal(listener, b.x, b.y, layout.listener.width); partner.root.setScale(-1, 1);
    // Keep the ground clue thick enough to see from arm's length.
    const ring = beat.clue === 'ground-ring' ? this.add.ellipse(l.ringX, l.ringY, l.ringW, l.ringH, INK.cream, l.ringFill)
      .setStrokeStyle(l.ringStroke, INK.navy) : undefined;
    let page: Phaser.GameObjects.Rectangle | undefined;
    if (beat.clue === 'den-page' && layout.outline) {
      const p = centre(layout.outline);
      page = this.add.rectangle(p.x, p.y, layout.outline.width, layout.outline.height)
        .setStrokeStyle(STORY_EFFECTS.den.pageStroke, INK.yellow).setFillStyle(INK.cream, 0).setAlpha(0);
    }
    const mist = STORY_EFFECTS.mist;
    const puff = beat.clue === 'mist-shape' ? this.add.ellipse(mist.x, mist.y, layout.mistPuff.width, layout.mistPuff.height, INK.cream).setAlpha(0) : undefined;
    const shape = beat.clue === 'mist-shape' ? this.add.image(mist.x, mist.y, 'nought').setDisplaySize(layout.mist.width, layout.mist.height).setAlpha(0) : undefined;
    const mistObjects = shape && puff ? [puff, shape] : [];
    plate(this, CENTER_X, l.panelY, l.panelW, l.panelH);
    const line = text(this, l.lineX, l.lineY, lines[0]!, UI.subheadingFont);
    this.onScreen = [lines[0]!, STRINGS.next]; this.speak(`story-${this.stop.beat}-0`);
    this.speaker(l.speakerX, l.nextY);
    this.button('next', l.nextX, l.nextY, l.nextW, STRINGS.next, () => {
      this.line++;
      if (ring && this.line === 1) {
        this.ringHighlighted = true;
        this.tweens.add({ targets: ring, scale: l.ringPulseScale, duration: TIMING.pattern, yoyo: true, repeat: 1 });
        burst(this, l.ringX, l.ringY);
      }
      if (beat.clue === 'den-page' && this.line === 1) {
        this.wallsHighlighted = true;
        for (const p of layout.wallSparkles) burst(this, p.x, p.y);
      }
      if (page && this.line === 2) {
        this.pageHighlighted = true; page.setAlpha(1);
        this.tweens.add({ targets: page, scale: STORY_EFFECTS.den.pagePulseScale, duration: TIMING.pattern, yoyo: true, repeat: 1 });
        const p = centre(layout.page!); burst(this, p.x, p.y);
      }
      if (shape && puff && this.line === 1) {
        this.shapeShown = true;
        this.tweens.add({ targets: shape, alpha: mist.alpha, duration: mist.enter });
        this.tweens.add({ targets: puff, alpha: mist.puffAlpha, duration: mist.enter });
        this.tweens.add({ targets: mistObjects, y: mist.y - mist.bob, duration: mist.bobTime, yoyo: true, repeat: -1 });
      }
      if (shape && this.line === 3) {
        this.tweens.killTweensOf(mistObjects);
        this.tweens.add({ targets: mistObjects, alpha: 0, y: shape.y - mist.lift, duration: mist.leave,
          onComplete: () => { this.shapeShown = false; this.shapeGone = true; } });
      }
      if (shape && this.line >= 4) {
        this.tweens.killTweensOf(mistObjects); shape.setAlpha(0); puff?.setAlpha(0); this.shapeShown = false; this.shapeGone = true;
      }
      if (this.line < lines.length) {
        line.setText(lines[this.line]!); this.onScreen = [lines[this.line]!, STRINGS.next]; this.speak(`story-${this.stop.beat}-${this.line}`);
      } else {
        this.runtime.pathChange = seeStory(this.runtime.save, this.stop, this.runtime.now());
        this.saveThen(() => this.go('map'));
      }
    });
  }
}
