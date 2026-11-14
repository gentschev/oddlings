import Phaser from 'phaser';
import { areaGateOpen, currentSession, currentStop, gatePracticePal, pathStops, WARMUP_TAPS, passedOverStops, type PathStop } from '../core';
import type { FriendId } from '../core/story/characters';
import { getArea, gateWalked, nextArea, previousArea, visitArea, walkGate } from '../core/areas';
import { earlierAreaNeedsHelp, syncPath } from '../core/path';
import { Button, plate, soundIcon, speechBubble, text } from '../ui/Controls';
import { BaseScene, mapPoint } from './BaseScene';
import { centre, mapArt, mapStyle, mapEntryRect, mapHomeRect, mapMarkerRect, mapStopLayout, mapHeaderLayout } from './layout';
import { CANVAS, CENTER_X, INK, LAYOUT, PALETTE, PATH_TIMING, TIMING, UI } from './constants';
import type { Runtime } from './Runtime';
import { STOP_TAGS, STRINGS } from './strings';

interface StoneVisual {
  ring?: Phaser.GameObjects.Graphics; value: { progress: number }; target: number;
  star: Phaser.GameObjects.Star; complete: boolean; radiusX: number; radiusY: number;
}
export class MapScene extends BaseScene {
  private area = 1;
  private back!: Button;
  private heading?: Phaser.GameObjects.Text;
  private nativeRings = false;
  private markerIndex = 0;
  private stones: StoneVisual[] = [];
  private animating = false;
  private motion = 0;
  private banner?: Phaser.GameObjects.Text;
  private bannerText = '';
  private bannerTapArmed = false;
  private passedOver = 0;
  private announcement = 0;
  private arrivalPals: FriendId[] = [];
  private joinedShown = false;
  constructor(runtime: Runtime) { super('map', runtime); }
  protected details(): Record<string, unknown> {
    const save = this.runtime.save, area = getArea(this.area), entry = mapEntryRect(this.area);
    return { onScreen: this.bannerText ? this.onScreen.filter(line => line !== area.name) : this.onScreen, banner: this.bannerText, passedOver: this.passedOver, arrivalJoined: this.arrivalPals, speechId: this.speechId, area: this.area, background: area.mapBackground, entry: entry ? { ...entry, id: area.entryId, needsHelp: earlierAreaNeedsHelp(save, this.runtime.now(), this.area) } : null, markerIndex: this.markerIndex, animating: this.animating, sound: save.settings.sound,
      header: mapHeaderLayout(), nextStop: currentStop(save, this.area)?.id ?? area.gateId, home: mapHomeRect(this.area),
      stops: [...pathStops(save, this.runtime.now(), this.area).map((s, i) => ({ ...s, ...mapStopLayout(i, this.area).point,
        tag: s.set ? STOP_TAGS[s.set] : null, completed: s.completed, next: s.state === 'current',
        pulsing: s.state === 'current' || s.state === 'complete' && s.needsHelp })),
      { id: area.gateId, type: 'gate', ...mapPoint(mapArt(this.area).gate.x, mapArt(this.area).gate.y, this.area),
        state: areaGateOpen(save, this.area) ? 'current' : 'locked', open: areaGateOpen(save, this.area),
        completed: gateWalked(save, this.area), progress: Number(areaGateOpen(save, this.area)),
        needsHelp: false, pal: null, set: null, tag: null }] };
  }
  create(): void {
    this.begin(); this.banner = undefined; this.bannerText = ''; this.bannerTapArmed = false; this.passedOver = 0; this.joinedShown = false; this.announcement++;
    const dismiss = () => {
      if (!this.bannerText || !this.bannerTapArmed) return;
      this.cancelArrival(); this.interruptSpeech();
      const generation = this.announcement;
      // Let the same tap activate a map control before offering the join panel.
      this.time.delayedCall(PATH_TIMING.bannerDismiss, () => {
        if (generation === this.announcement && !this.busy && !this.modal) this.showJoined();
      });
    };
    this.input.on('pointerdown', dismiss);
    this.events.once('shutdown', () => this.input.off('pointerdown', dismiss));
    this.area = this.runtime.save.map.area; const area = getArea(this.area), style = mapStyle(this.area); this.nativeRings = style.nativeRings; this.background(area.mapBackground); this.stones = []; this.animating = false; this.motion++;
    const save = this.runtime.save, l = LAYOUT.map, states = pathStops(save, this.runtime.now(), this.area);
    const change = this.runtime.pathChange?.area === this.area ? this.runtime.pathChange : undefined; this.runtime.pathChange = undefined;
    const arrival = this.runtime.arrivalJoined?.area === this.area ? this.runtime.arrivalJoined : undefined;
    const enteredArea = arrival?.from === 'area';
    this.arrivalPals = arrival?.pals ?? [];
    this.runtime.arrivalJoined = undefined;
    this.onScreen = [area.name];
    // The reserved rectangle is for layout checks; the plate hugs the name, starting at its left edge.
    this.heading = text(this, l.headingX - l.headingW / 2, l.headingY, area.name, UI.subheadingFont)
      .setOrigin(0, 0.5).setBackgroundColor(PALETTE.cream);
    this.speak(area.nameSpeech);
    const mute = new Button(this, 'mute', l.muteX, l.muteY, l.muteW, l.muteW, '', () => {
      if (this.busy || this.modal) return;
      save.settings.sound = !save.settings.sound; this.runtime.audio.muted = !save.settings.sound;
      soundIcon(this, mute, !save.settings.sound, icon); void this.runtime.persist();
    }, INK.cream, UI.buttonFont, true);
    const icon = soundIcon(this, mute, !save.settings.sound); this.controls.push(mute.control);
    this.bookButton(style.bookX, style.bookY, () => { this.cancelArrival(); this.go('oddbook', { returnTo: 'map' }); });
    this.home();
    for (let i = 0; i < area.stops.length; i++) {
      const stop = area.stops[i]!, state = states[i]!, layout = mapStopLayout(i, this.area), p = layout.point;
      const enabled = state.state === 'current' || state.state === 'complete' && stop.type === 'skill';
      const pulse = state.state === 'current' || state.state === 'complete' && state.needsHelp;
      const stone = this.add.ellipse(p.x, p.y, style.nativeRings ? layout.radiusX * 2 - UI.stroke * 2 : l.stopRadius * 2, style.nativeRings ? layout.radiusY * 2 - UI.stroke * 2 : l.stopHeight, state.state === 'current' ? INK.yellow : INK.cream, l.stopOpacity)
        .setStrokeStyle(UI.stroke, INK.navy).setAlpha(state.state === 'locked' ? l.lockedOpacity : 1);
      if (pulse) this.tweens.add({ targets: stone, scale: state.state === 'current' ? l.pulseScale : l.helpPulseScale, duration: TIMING.pattern, yoyo: true, repeat: -1 });
      const target = this.ringValue(state), old = change?.before[i];
      const value = { progress: old ? this.ringValue(old) : target };
      let ring: Phaser.GameObjects.Graphics | undefined;
      if (stop.type === 'story') speechBubble(this, p.x, p.y);
      else {
        ring = this.add.graphics().setPosition(p.x, p.y);
        this.drawRing(ring, value.progress, layout.radiusX, layout.radiusY);
        const pal = this.pal(stop.pal, p.x, p.y, l.friendW);
        if (state.state === 'locked' && !state.completed) { pal.setSilhouette(); pal.root.setAlpha(l.lockedOpacity); }
        else if (state.state === 'current' || state.needsHelp && state.state === 'complete') pal.setMuddled(true);
        if (state.state === 'current' || state.needsHelp && state.state === 'complete') {
          const cloud = centre(layout.cloud);
          this.add.image(cloud.x, cloud.y, 'muddle-cloud').setDisplaySize(layout.cloud.width, layout.cloud.height);
        }
        this.tag(stop.set, layout.tag);
      }
      const star = this.add.star(p.x + l.starOffset, p.y - l.starOffset, l.starPoints, l.starInner, l.starOuter, INK.yellow).setStrokeStyle(l.starStroke, INK.navy);
      star.setAlpha(state.completed && (!old || old.completed) ? 1 : 0);
      this.stones.push({ ring, value, target, star, radiusX: layout.radiusX, radiusY: layout.radiusY, complete: state.completed });
      const hit = centre(layout.touch);
      this.add.zone(hit.x, hit.y, layout.touch.width, layout.touch.height).setInteractive({ useHandCursor: enabled }).on('pointerdown', () => {
        if (!enabled || this.busy || this.modal) return;
        this.cancelArrival(); this.interruptSpeech();
        if (stop.type === 'skill' && currentSession(save).warmupTaps < WARMUP_TAPS) { this.go('warmup'); return; }
        this.walkTo(i, () => this.go(stop.type === 'skill' ? 'encounter' : 'story', { stop }));
      });
      this.controls.push({ id: stop.id, ...hit, width: layout.touch.width, height: layout.touch.height, enabled });
    }
    this.gate(); this.entry();
    const target = currentStop(save, this.area) ? area.stops.findIndex(s => s.id === currentStop(save, this.area)!.id) : area.stops.length;
    const saved = area.stops.findIndex(s => s.id === save.map.position);
    this.markerIndex = save.map.position === area.gateId ? area.stops.length : area.entryId && save.map.position === area.entryId ? -1 : saved >= 0 ? saved : target;
    const marker = mapMarkerRect((save.team.partner ?? 'tenny') as FriendId, this.markerIndex, this.area), p = centre(marker);
    this.pal((save.team.partner ?? 'tenny') as FriendId, p.x, p.y, marker.width);
    const changed = change && states.some((s, i) => s.state !== change.before[i]!.state || this.ringValue(s) !== this.ringValue(change.before[i]!));
    if (changed || this.markerIndex === -1) {
      const before = this.markerIndex;
      this.passedOver = !enteredArea && change ? passedOverStops(before, target, change.before) : 0;
      this.animatePath(target, () => this.showArrival(), index => {
        if (!this.passedOver || index <= before || index >= target || !(change?.before[index]?.type === 'skill' || change?.before[index]?.completed)) return;
        const star = this.stones[index]!.star;
        this.tweens.killTweensOf(star);
        this.tweens.add({ targets: star, scale: PATH_TIMING.passedStarScale, duration: PATH_TIMING.passedStar, yoyo: true });
      });
    }
    else { this.placeMarker(this.markerIndex); this.finishVisuals(); this.showArrival(); }
    // This sits above the animation's skip target, so its disabled hit area swallows taps.
    this.back = this.backButton(l.backX, l.backY, () => {
      this.cancelArrival(); this.saveThen(() => this.go('title'));
    }, l.backW);
    this.back.enable(!this.busy && !this.modal && !this.animating);
  }
  override update(): void {
    super.update();
    const enabled = !this.busy && !this.modal && !this.animating;
    if (this.back && this.back.control.enabled !== enabled) this.back.enable(enabled);
  }
  private ringValue(s: PathStop): number { return s.completed ? 1 : s.state === 'locked' ? 0 : s.progress; }
  private drawRing(g: Phaser.GameObjects.Graphics, progress: number, rx: number, ry: number): void {
    const l = LAYOUT.map, native = this.nativeRings;
    g.clear().setScale(1, native ? 1 : l.progressScaleY).lineStyle(l.progressStroke, INK.navy);
    if (!native) {
      g.strokeCircle(0, 0, rx);
      if (progress > 0) g.lineStyle(l.progressStroke, progress >= 1 ? INK.yellow : INK.coral).beginPath()
        .arc(0, 0, rx, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress, false).strokePath();
      return;
    }
    g.strokeEllipse(0, 0, rx * 2, ry * 2);
    if (progress <= 0) return;
    g.lineStyle(l.progressStroke, progress >= 1 ? INK.yellow : INK.coral);
    if (progress >= 1) { g.strokeEllipse(0, 0, rx * 2, ry * 2); return; }
    const steps = Math.ceil(l.ringSegments * progress);
    g.beginPath().moveTo(0, -ry);
    for (let i = 1; i <= steps; i++) {
      const angle = -Math.PI / 2 + Math.PI * 2 * progress * i / steps;
      g.lineTo(Math.cos(angle) * rx, Math.sin(angle) * ry);
    }
    g.strokePath();
  }
  private tag(set: string, r: { x: number; y: number; width: number; height: number }): void {
    const l = LAYOUT.map, p = centre(r);
    this.add.rectangle(p.x, p.y, r.width, r.height, INK.cream).setStrokeStyle(UI.stroke / 2, INK.navy);
    if (set === 'see-dots' || set === 'see-frame') {
      const g = this.add.graphics(), cell = l.tagCell;
      if (set === 'see-dots') for (let i = 0; i < 3; i++) g.fillStyle(INK.navy).fillCircle(p.x + (i - 1) * cell, p.y, l.tagDot);
      else {
        for (let i = 0; i < 10; i++) g.lineStyle(UI.stroke / 2, INK.navy)
          .strokeRect(p.x - cell * 2.5 + i % 5 * cell, p.y - cell + Math.floor(i / 5) * cell, cell, cell);
      }
    } else text(this, p.x, p.y, STOP_TAGS[set]!, mapStyle(this.area).tagFont).setPadding(0);
  }
  private home(): void {
    const l = LAYOUT.map, r = mapHomeRect(this.area), p = centre(r);
    plate(this, p.x, p.y, l.homeSignW, l.homeSignH);
    const sign = text(this, p.x, p.y, STRINGS.campIcon, UI.buttonFont);
    this.tweens.add({ targets: sign, scale: l.pulseScale, duration: TIMING.pattern, yoyo: true, repeat: -1 });
    this.add.zone(p.x, p.y, r.width, r.height).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (!this.busy && !this.modal) { this.cancelArrival(); this.go('camp'); }
    });
    this.controls.push({ id: 'home', ...p, width: r.width, height: r.height, enabled: true });
  }
  private changeArea(number: number): void {
    const save = this.runtime.save;
    if (!visitArea(save, number)) return;
    const change = syncPath(save, this.runtime.now(), number);
    this.runtime.pathChange = change;
    this.runtime.arrivalJoined = { area: number, pals: change.joined, from: 'area' };
    this.saveThen(() => this.go('map'));
  }
  private cancelArrival(): void {
    this.announcement++;
    this.banner?.destroy(); this.banner = undefined;
    this.onScreen = this.onScreen.filter(line => line !== this.bannerText);
    this.bannerText = ''; this.bannerTapArmed = false; this.heading?.setVisible(true);
  }
  private showArrival(): void {
    if (!this.passedOver && !this.arrivalPals.length) return;
    const generation = this.announcement;
    if (!this.passedOver) this.busy = true;
    // The heading finishes first, even when a tap skips the path animation.
    this.afterSpeech(0, () => {
      if (generation !== this.announcement) return;
      if (!this.passedOver) { this.busy = false; this.showJoined(); return; }
      const many = this.passedOver > 1, l = LAYOUT.map;
      this.bannerText = many ? STRINGS.knowThese : STRINGS.knowThis;
      this.onScreen.push(this.bannerText); this.heading?.setVisible(false);
      // The plate hugs the line; `bannerW` and `bannerH` reserve its largest rectangle for layout checks.
      this.banner = text(this, l.bannerX, l.bannerY, this.bannerText, l.bannerFont).setBackgroundColor(PALETTE.cream);
      this.speak(many ? 'ui-knowThese' : 'ui-knowThis');
      // The tap that skips movement must not also dismiss the newly shown banner.
      this.time.delayedCall(0, () => { if (generation === this.announcement) this.bannerTapArmed = true; });
      this.afterSpeech(PATH_TIMING.banner, () => {
        if (generation !== this.announcement) return;
        this.cancelArrival(); this.showJoined();
      });
    });
  }
  private showJoined(): void {
    const first = this.arrivalPals[0];
    if (!first || this.joinedShown || this.busy || this.modal) return;
    const many = this.arrivalPals.length > 1;
    this.panel(many ? STRINGS.palsJoin(this.arrivalPals.length) : STRINGS.join(STRINGS.names[first]));
    this.speak(many ? `joined-pals-${this.arrivalPals.length}` : `join-${first}`);
    this.joinedShown = true;
  }
  private entry(): void {
    const rect = mapEntryRect(this.area), previous = previousArea(this.area), area = getArea(this.area);
    if (!rect || !previous) return;
    const p = centre(rect), l = LAYOUT.map;
    if (earlierAreaNeedsHelp(this.runtime.save, this.runtime.now(), this.area)) {
      const cloud = this.add.image(p.x, p.y - l.cloudOffsetY, 'muddle-cloud').setDisplaySize(l.cloudW, l.cloudH);
      this.tweens.add({ targets: cloud, scaleX: cloud.scaleX * l.helpPulseScale, scaleY: cloud.scaleY * l.helpPulseScale,
        duration: TIMING.pattern, yoyo: true, repeat: -1 });
      const glow = this.add.circle(p.x, p.y, l.stopRadius).setStrokeStyle(l.gateStroke, INK.yellow).setFillStyle(INK.cream, 0);
      this.tweens.add({ targets: glow, alpha: l.gatePulseAlpha, duration: TIMING.pattern, yoyo: true, repeat: -1 });
    }
    this.add.zone(p.x, p.y, rect.width, rect.height).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (this.busy || this.modal) return;
      this.cancelArrival(); this.interruptSpeech(); this.walkTo(-1, () => this.changeArea(previous.number));
    });
    this.controls.push({ id: area.entryId!, ...p, width: rect.width, height: rect.height, enabled: true });
  }
  private gate(): void {
    const save = this.runtime.save, area = getArea(this.area), next = nextArea(this.area), g = mapArt(this.area).gate;
    const p = mapPoint(g.x, g.y, this.area), l = LAYOUT.map;
    if (areaGateOpen(save, this.area)) {
      const glow = this.add.circle(p.x, p.y, l.stopRadius).setStrokeStyle(l.gateStroke, INK.yellow).setFillStyle(INK.cream, 0);
      this.tweens.add({ targets: glow, alpha: l.gatePulseAlpha, duration: TIMING.pattern, yoyo: true, repeat: -1 });
    }
    const practice = () => {
      if (currentSession(save).warmupTaps < WARMUP_TAPS) { this.go('warmup'); return; }
      const wild = gatePracticePal(save); save.map.gatePracticeIndex = (save.map.gatePracticeIndex ?? 0) + 1;
      this.go('encounter', { gate: true, wild });
    };
    this.add.zone(p.x, p.y, UI.minTouch, UI.minTouch).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (this.busy || this.modal) return;
      this.cancelArrival(); this.interruptSpeech();
      if (!areaGateOpen(save, this.area)) { this.panel(STRINGS.gateClosed); return; }
      if (gateWalked(save, this.area)) {
        if (next) this.walkTo(area.stops.length, () => this.changeArea(next.number));
        else practice();
        return;
      }
      this.walkTo(area.stops.length, () => {
        walkGate(save, this.area);
        this.saveThen(() => {
          if (!next) { this.panel(STRINGS.gateOpen, () => this.panel(STRINGS.gateSoon, practice)); return; }
          this.onScreen.push(STRINGS.gateOpen); this.speak('ui-gateOpen');
          text(this, CENTER_X, LAYOUT.panel.messageY, STRINGS.gateOpen, UI.titleFont).setBackgroundColor(PALETTE.cream);
          this.busy = true;
          this.afterSpeech(TIMING.clear, () => { this.busy = false; this.changeArea(next.number); });
        });
      });
    });
    this.controls.push({ id: area.gateId, ...p, width: UI.minTouch, height: UI.minTouch, enabled: true });
  }
  private placeMarker(index: number): void {
    const area = getArea(this.area);
    this.markerIndex = index;
    const marker = this.pals[this.pals.length - 1]!, p = centre(mapMarkerRect(marker.id, index, this.area));
    marker.root.setPosition(p.x, p.y); this.runtime.save.map.position = index < 0 ? area.entryId! : area.stops[index]?.id ?? area.gateId;
  }
  private finishVisuals(): void {
    for (const s of this.stones) {
      this.tweens.killTweensOf(s.value); this.tweens.killTweensOf(s.star);
      if (s.ring) this.drawRing(s.ring, s.target, s.radiusX, s.radiusY);
      s.star.setAlpha(s.complete ? 1 : 0).setScale(1);
    }
  }
  private animatePath(target: number, arrive: () => void, landed: (index: number) => void): void {
    this.animating = true; this.busy = true;
    const skip = this.add.zone(CANVAS.width / 2, CANVAS.height / 2, CANVAS.width, CANVAS.height).setInteractive();
    this.controls.push({ id: 'path-skip', x: CANVAS.width / 2, y: CANVAS.height / 2, ...CANVAS, enabled: true });
    const finish = () => {
      if (!this.animating) return;
      this.animating = false; this.motion++;
      this.tweens.killTweensOf(this.pals[this.pals.length - 1]!.root);
      this.placeMarker(target); this.finishVisuals(); this.busy = false; skip.destroy();
      this.controls = this.controls.filter(c => c.id !== 'path-skip');
      arrive();
    };
    skip.once('pointerdown', finish);
    let stars = 0;
    for (const s of this.stones) {
      if (s.ring) this.tweens.add({ targets: s.value, progress: s.target, duration: PATH_TIMING.rings,
        onUpdate: () => this.drawRing(s.ring!, s.value.progress, s.radiusX, s.radiusY) });
      if (s.complete && s.star.alpha === 0) this.tweens.add({ targets: s.star, alpha: 1, delay: stars++ * PATH_TIMING.starGap, duration: PATH_TIMING.star });
    }
    this.time.delayedCall(PATH_TIMING.rings, () => {
      if (!this.animating) return;
      this.busy = false;
      const distance = Math.max(1, Math.abs(target - this.markerIndex));
      this.walkTo(target, finish, Math.min(TIMING.hop, PATH_TIMING.walkBudget / distance), landed);
    });
  }
  private walkTo(target: number, arrive: () => void, duration: number = TIMING.hop, landed?: (index: number) => void): void {
    this.busy = true;
    const marker = this.pals[this.pals.length - 1]!, generation = this.motion;
    const step = () => {
      if (generation !== this.motion) return;
      if (this.markerIndex === target) { this.busy = false; this.placeMarker(target); arrive(); return; }
      this.markerIndex += Math.sign(target - this.markerIndex);
      const p = centre(mapMarkerRect(marker.id, this.markerIndex, this.area));
      marker.hop(this.runtime.elapsed); this.runtime.audio.play('hop');
      this.tweens.add({ targets: marker.root, x: p.x, y: p.y, duration, onComplete: () => { if (generation !== this.motion) return; landed?.(this.markerIndex); step(); } });
    };
    step();
  }
}
