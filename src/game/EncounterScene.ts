import Phaser from 'phaser';
import { centre, encounterLayout } from './layout';
import { factSpeechId } from './speechLines';
import { advanceEncounterTime, currentSlot, disabledAnswers, explanationForFact, getFact, markEncounterHidden, revealHint,
  encounterPals, improvingStop, markHelped, palIntroduction, pathStops, stopIntroduction, syncPath, type PathStop, practiceProgress, practiceSnapshot, startEncounter, submitAnswer, type Encounter, type Fact, type PracticeSnapshot, ODDLING_PATTERNS } from '../core';
import { type FriendId } from '../core/story/characters';
import { areaForStop, getArea, getStop, type SkillStop } from '../core/areas';
import { AnswerPad, hintIcon, plate, text, type Button } from '../ui/Controls';
import { MuddleMeter } from '../ui/MuddleMeter';
import { slotStates } from '../ui/muddleSlots';
import { burst, burstAround, type Oddling } from '../ui/Oddling';
import { pictureModel } from '../ui/PictureModels';
import { BaseScene } from './BaseScene';
import { CANVAS, INK, LAYOUT, MOTION, MUDDLE_TIMING, PALETTE, TIMING, UI } from './constants';
import type { Runtime } from './Runtime';
import { PRAISE_LINES, questionText, STRINGS } from './strings';
import { introWait } from './speechTiming';

export class EncounterScene extends BaseScene {
  private encounter!: Encounter;
  private stop?: SkillStop;
  private helperId!: FriendId;
  private gate = false;
  private backgroundKey = '';
  private introduction: 'first' | 'again' | 'none' = 'first';
  private pathBefore: PathStop[] = [];
  private wildId!: FriendId;
  private partner!: Oddling;
  private wild!: Oddling;
  private cloud!: Phaser.GameObjects.Image;
  private meter!: MuddleMeter;
  private introActive = false;
  private friendRestored = false;
  private replay = false;
  private returning = false;
  private pad!: AnswerPad;
  private hint!: Button;
  private card!: Phaser.GameObjects.Graphics;
  private question!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private model?: Phaser.GameObjects.Container;
  private displayed!: Fact;
  private accepting = false;
  private previousModel = false;
  private displayedMode = 'modeled';
  private cloudScaleX = 1;
  private cloudScaleY = 1;
  private speakerButton!: Button;
  private tray!: Phaser.GameObjects.Graphics;
  private progressBefore!: PracticeSnapshot;
  constructor(runtime: Runtime) { super('encounter', runtime); }
  markHidden(): void { if (this.encounter) markEncounterHidden(this.encounter); }
  protected details(): Record<string, unknown> {
    if (!this.encounter) return {};
    const shownText = this.introActive ? '' : this.question.text;
    return { stop: this.stop?.id ?? getArea(this.runtime.save.map.area).gateId, background: this.backgroundKey, area: this.runtime.save.map.area, replay: this.replay, returning: this.returning, reviewOnly: this.encounter.reviewOnly,
      factId: this.displayed.id, question: { ...this.displayed, text: shownText },
      questionText: shownText, correctAnswer: this.displayed.answer,
      presentation: this.displayedMode,
      modelVisible: this.previousModel, hintPulsing: this.encounter.hintPulsing,
      phase: this.introActive ? 'intro' : this.encounter.phase, inputAccepted: this.accepting && !this.busy && !this.modal,
      disabledAnswers: this.pad.buttons.flatMap((b, n) => b.control.enabled ? [] : [n]),
      intro: this.introActive, friendRestored: this.friendRestored,
      meter: this.encounter.meter, initialMeter: this.encounter.initialMeter,
      slots: slotStates(this.encounter.initialMeter, this.encounter.meter),
      wild: this.wildId, partner: this.helperId, savedPartner: this.runtime.save.team.partner, partnerPattern: ODDLING_PATTERNS[this.helperId],
      helperPatternMode: this.partner.patternMode, wildPatternMode: this.wild.patternMode,
      onScreen: this.introActive ? this.onScreen : this.encounter.phase === 'complete' ? [STRINGS.clear] :
        [this.question.text, this.message.text, STRINGS.hint, ...this.pad.buttons.map(b => b.label.text)].filter(Boolean),
      layout: encounterLayout(this.helperId, this.wildId, this.encounter.initialMeter, this.previousModel),
      speechId: this.speechId, feedback: this.message.text, pad: this.pad.buttons.map(b => b.control) };
  }
  create(data: { stop?: SkillStop; gate?: boolean; wild?: FriendId }): void {
    this.begin();
    this.stop = data.stop; this.gate = data.gate === true;
    const area = data.stop ? areaForStop(data.stop.id) : getArea(this.runtime.save.map.area);
    this.backgroundKey = area.encounterBackground; this.ground(this.backgroundKey);
    this.wildId = data.stop?.pal ?? data.wild ?? 'bix';
    this.helperId = encounterPals(this.runtime.save, this.wildId).helper;
    this.accepting = false; this.previousModel = false; this.model = undefined;
    this.introActive = false; this.friendRestored = false;
    this.progressBefore = practiceSnapshot(this.runtime.save);
    this.pathBefore = pathStops(this.runtime.save, this.runtime.now());
    this.replay = !!this.stop && this.runtime.save.map.clearedSpots.includes(this.stop.id);
    this.introduction = this.stop ? stopIntroduction(this.runtime.save, this.stop, this.runtime.now()) : palIntroduction(this.runtime.save, this.wildId);
    this.returning = this.replay && this.introduction === 'again';
    this.encounter = startEncounter(this.runtime.save, this.runtime.now(), this.runtime.rng, undefined, this.replay);
    this.displayed = getFact(currentSlot(this.encounter).factId);
    this.displayedMode = currentSlot(this.encounter).mode;
    const l = LAYOUT.encounter;
    const geometry = encounterLayout(this.helperId, this.wildId, this.encounter.initialMeter);
    this.partner = this.standingPal(this.helperId, l.partnerX, l.feetY, l.creatureW);
    this.wild = this.standingPal(this.wildId, l.wildX, l.feetY, l.creatureW);
    this.wild.setMuddled(true);
    if (this.stop?.groundRing) {
      this.add.image(l.ringX, l.ringY, 'ring-mark').setDisplaySize(l.ringW, l.ringH).setAlpha(l.ringAlpha);
    }
    const cloud = geometry.cloud, cloudCentre = centre(cloud);
    this.cloud = this.add.image(cloudCentre.x, cloudCentre.y, 'muddle-cloud').setDisplaySize(cloud.width, cloud.height).setAlpha(l.cloudAlpha);
    this.cloudScaleX = this.cloud.scaleX; this.cloudScaleY = this.cloud.scaleY;
    this.meter = new MuddleMeter(this, geometry.slots);
    this.card = plate(this, l.cardX, l.cardY, l.cardW, l.cardH);
    this.question = text(this, l.cardX, l.questionY, '', l.questionSize);
    this.message = text(this, l.cardX, l.correctionY, '', l.correctionSize);
    this.tray = plate(this, l.trayX, l.trayY, l.trayW, l.trayH);
    this.pad = new AnswerPad(this, answer => this.answer(answer));
    this.controls.push(...this.pad.buttons.map(b => b.control));
    this.hint = this.button('hint', l.hintX, l.hintY, l.hintW, STRINGS.hint, () => {
      if (!this.accepting || this.encounter.phase !== 'question') return;
      // The engine owns both voluntary and automatic help evidence.
      revealHint(this.encounter);
      this.showModel();
    }, INK.yellow, UI.pad.height);
    hintIcon(this, this.hint);
    this.speakerButton = this.speaker(l.speakerX, l.speakerY, l.speakerW);
    if (this.introduction === 'none') this.renderQuestion();
    else this.introduce();
  }
  private introduce(): void {
    const l = LAYOUT.encounter, id = `muddle-${this.introduction === 'again' ? 'again-' : ''}${this.wildId}`;
    const line = this.introduction === 'again' ? STRINGS.muddleAgain(STRINGS.names[this.wildId]) : STRINGS.muddle(STRINGS.names[this.wildId]);
    this.introActive = true; this.onScreen = [line];
    this.pad.enable(false); this.hint.enable(false); this.speakerButton.enable(false);
    this.question.setVisible(false); this.message.setVisible(false); this.tray.setVisible(false);
    this.hint.setVisible(false); this.speakerButton.setVisible(false);
    for (const b of this.pad.buttons) b.setVisible(false);
    const label = text(this, l.cardX, l.cardY, line, l.introSize).setAlign('center');
    const target = this.add.zone(CANVAS.width / 2, CANVAS.height / 2, CANVAS.width, CANVAS.height).setInteractive();
    this.controls.push({ id: 'intro-continue', x: CANVAS.width / 2, y: CANVAS.height / 2, ...CANVAS, enabled: true });
    const finish = (tapped: boolean) => {
      if (!this.introActive) return;
      this.introActive = false;
      if (tapped) this.interruptSpeech();
      label.destroy(); target.destroy(); this.controls = this.controls.filter(c => c.id !== 'intro-continue');
      this.tray.setVisible(true); this.hint.setVisible(true); this.speakerButton.setVisible(true).enable(true);
      for (const b of this.pad.buttons) b.setVisible(true);
      this.renderQuestion();
    };
    target.once('pointerdown', () => finish(true));
    this.speak(id);
    this.afterSpeech(introWait(this.runtime.audio.duration(id)), () => finish(false));
  }
  private renderQuestion(): void {
    const e = this.encounter, l = LAYOUT.encounter;
    this.accepting = false; this.pad.enable(false); this.hint.enable(false);
    if (e.phase === 'question') { this.model?.destroy(); this.model = undefined; this.previousModel = false; }
    this.displayed = getFact(currentSlot(e).factId);
    this.displayedMode = currentSlot(e).mode;
    const isCount = this.displayed.operation === 'dots' || this.displayed.operation === 'frame';
    this.question.setFontSize(isCount && e.phase !== 'correction' ? l.countSize : l.questionSize)
      .setText(questionText(this.displayed, e.phase === 'correction')).setAlpha(0);
    this.question.setFixedSize(l.questionW, l.questionH).setAlign('center')
      .setY(isCount || e.modelVisible ? l.questionY : l.cardY);
    this.speak(e.phase === 'second' ? 'ui-tryAgain' : factSpeechId(this.displayed, e.phase === 'correction'));
    this.message.setText(e.phase === 'correction' ? STRINGS.correction(this.displayed.answer) : e.phase === 'second' ? STRINGS.tryAgain : '');
    this.pad.highlight(e.phase === 'correction' ? this.displayed.answer : null);
    this.pad.enable(false);
    if (e.modelVisible || this.displayed.operation === 'dots' || this.displayed.operation === 'frame') this.showModel();
    else this.partner.showFact(this.displayed, false);
    this.onScreen = [this.question.text, this.message.text];
    this.tweens.add({ targets: this.question, alpha: 1, duration: TIMING.question });
    this.time.delayedCall(TIMING.question, () => {
      // Do not include feedback, transitions or card entry in response latency.
      if (e.phase === 'question') e.shownAt = this.runtime.now();
      this.accepting = true; this.pad.acceptExcept(disabledAnswers(e));
      this.hint.enable(e.phase === 'question');
    });
    this.card.setVisible(true); this.question.setVisible(true); this.message.setVisible(true);

  }
  private showModel(): void {
    if (this.model) return;
    const e = this.encounter, l = LAYOUT.encounter;
    this.model = pictureModel(this, l.modelX, l.modelY, this.displayed,
      explanationForFact(this.displayed.id, currentSlot(e).setId).model);
    this.previousModel = true; this.question.setY(l.questionY);
    this.partner.showFact(this.displayed, true);
    this.hint.setScale(1);
  }
  private answer(answer: number): void {
    if (!this.accepting || this.busy || this.modal) return;
    this.runtime.audio.play('tap', answer);
    const e = this.encounter, second = e.phase === 'second';
    const result = submitAnswer(this.runtime.save, e, answer, this.runtime.now(), this.runtime.localDate(), this.runtime.rng);
    this.meter.sync(e.meter);
    if (!result.accepted) { this.partner.tilt(this.runtime.elapsed); return; }
    this.accepting = false; this.pad.enable(false); this.hint.enable(false);
    if (result.correction) { this.renderQuestion(); return; }
    if (answer !== this.displayed.answer) {
      this.runtime.audio.play('hmm'); this.partner.tilt(this.runtime.elapsed);
      this.renderQuestion(); return;
    }
    this.runtime.audio.play(result.fast ? 'quick' : 'correct');
    this.partner.hop(this.runtime.elapsed, result.fast);
    burstAround(this, encounterLayout(this.partner.id, this.wild.id, e.initialMeter).regions.partner);
    this.question.setText(questionText(this.displayed, true));
    if (e.phase === 'complete') this.cleared();
    else {
      const index = second ? 0 : e.answered % PRAISE_LINES.length;
      this.message.setText(result.fast ? STRINGS.quick : PRAISE_LINES[index]!);
      this.onScreen = [this.question.text, this.message.text];
      this.speak(result.fast ? 'ui-quick' : `praise-${index}`);
      this.shrinkCloud();
      this.afterSpeech(TIMING.feedback, () => this.renderQuestion());
    }
  }
  private shrinkCloud(): void {
    const ratio = Math.max(LAYOUT.encounter.cloudMinScale, this.encounter.meter / this.encounter.initialMeter);
    this.tweens.killTweensOf(this.cloud);
    this.tweens.add({ targets: this.cloud, scaleX: this.cloudScaleX * ratio, scaleY: this.cloudScaleY * ratio, duration: TIMING.feedback });
  }
  private cleared(): void {
    const save = this.runtime.save, l = LAYOUT.encounter;
    this.accepting = false;
    this.model?.destroy(); this.model = undefined;
    this.card.setVisible(false); this.question.setVisible(false); this.message.setVisible(false); this.hint.setVisible(false); this.tray.setVisible(false); this.speakerButton.setVisible(false);
    for (const b of this.pad.buttons) b.setVisible(false);
    const geometry = encounterLayout(this.partner.id, this.wild.id, this.encounter.initialMeter);
    this.meter.deliver(geometry.wildFeatures.target, () => {
      this.wild.restorePattern(); this.friendRestored = true;
      this.wild.hop(this.runtime.elapsed, true); this.runtime.audio.play('pop');
      this.tweens.killTweensOf(this.cloud); burst(this, this.cloud.x, this.cloud.y);
      this.tweens.add({ targets: this.cloud, alpha: 0, scale: 0, duration: MUDDLE_TIMING.cloudPop });
    });
    text(this, l.cardX, l.clearY, STRINGS.clear, l.clearSize, PALETTE.navy);
    this.onScreen = [STRINGS.clear]; this.speak('ui-clear');
    markHelped(save, this.wildId);
    const change = syncPath(save, this.runtime.now(), save.map.area); change.before = this.pathBefore;
    this.runtime.pathChange = change;
    const first = change.completed.map(getStop).find(s => s.type === 'skill');
    const friend = change.completed.length === 1 && first?.type === 'skill' ? first.pal : change.joined[0] ?? this.wildId;
    const improvingPal = improvingStop(change)?.pal ?? undefined;
    const { introduced, learned } = practiceProgress(save, this.progressBefore);
    this.afterSpeech(TIMING.clear, () => this.saveThen(() => this.go('reward', {
      friend, improvingPal, joinedPals: change.joined, introduced, learned, completed: change.completed, gate: this.gate })));

  }
  override update(): void {
    super.update();
    if (!this.encounter) return;
    if (this.accepting && this.encounter.phase === 'question') {
      advanceEncounterTime(this.encounter, this.runtime.now());
      if (this.encounter.modelVisible && !this.model) this.showModel();
    }
    if (this.hint && this.accepting && this.encounter.hintPulsing && !this.encounter.modelVisible) {
      this.hint.setScale(1 + Math.sin(this.runtime.elapsed / TIMING.pattern * Math.PI * 2) * MOTION.hintPulse);
    }
    if (this.cloud && this.encounter.phase !== 'complete') {
      this.cloud.angle = Math.sin(this.runtime.elapsed / TIMING.pattern) * MOTION.cloudWobble;
    }
  }
}
