import manifest from '../../public/assets/art/manifest.json' with { type: 'json' };
import { getArea } from '../core/areas';
import { CANVAS, LAYOUT, MAP_LAYOUT, MOTION, PALETTE, SCENERY, STORY_EFFECTS, UI } from './constants';

export type CharacterId = keyof typeof manifest.characters;
export interface Rect { x: number; y: number; width: number; height: number }
export const centre = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
export const rectAt = (x: number, y: number, width: number, height: number): Rect => ({ x: x - width / 2, y: y - height / 2, width, height });
export function titleOfflineLayout() {
  const l = LAYOUT.title.offline;
  return { bounds: { x: l.x, y: l.y, width: l.width, height: l.height },
    icon: { x: l.x + l.padding, y: l.y + (l.height - l.icon) / 2, width: l.icon, height: l.icon },
    label: { x: l.x + l.padding + l.icon + l.gap, y: l.y,
      width: l.width - l.padding * 2 - l.icon - l.gap, height: l.height } };
}
export function titleNoticesLayout() {
  const { homeScreen, testBadge } = LAYOUT.title;
  return { homeScreen: { x: homeScreen.x, y: homeScreen.y, width: homeScreen.width, height: homeScreen.height },
    testBadge: { x: testBadge.x, y: testBadge.y, width: testBadge.width, height: testBadge.height } };
}
export function contains(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
/** Anchor the visible feet, including the transparent margin in the image bounds. */
export function standingRect(id: CharacterId, x: number, feetY: number, width: number): Rect {
  const meta = manifest.characters[id], scale = width / meta.width;
  const nativeFeet = 'feetY' in meta ? meta.feetY : meta.height;
  return { x: x - width / 2, y: feetY - nativeFeet * scale, width, height: meta.height * scale };
}
export function answerRects(): Rect[] {
  const p = UI.pad;
  return Array.from({ length: 21 }, (_, n) => rectAt(p.x + n % 7 * p.gapX, p.y + Math.floor(n / 7) * p.gapY, p.width, p.height));
}
/** Peers must not overlap. Card contents and tray buttons are tested inside their parents. */
export function encounterLayout(partner: CharacterId, wild: CharacterId, initialMeter: number, modelVisible = true) {
  const l = LAYOUT.encounter;
  const wildRect = standingRect(wild, l.wildX, l.feetY, l.creatureW);
  const wildFeatures = characterRegions(wild, wildRect);
  const cloudWidth = l.creatureW * l.cloudRatio, meta = manifest.characters['muddle-cloud'];
  const cloudHeight = cloudWidth * meta.height / meta.width;
  const headX = wildFeatures.face ? centre(wildFeatures.face).x : centre(wildRect).x;
  const cloudX = Math.max(cloudWidth / 2 + UI.stroke, Math.min(CANVAS.width - cloudWidth / 2 - UI.stroke, headX));
  const cloudBottom = Math.min(wildRect.y, wildFeatures.face?.y ?? wildRect.y) - l.cloudGap;
  const slots = Array.from({ length: initialMeter }, (_, i) => rectAt(l.cardX + (i - (initialMeter - 1) / 2) * l.meterGap, l.meterY, l.slotW, l.slotW));
  return {
    regions: {
      meter: rectAt(CANVAS.width / 2, l.meterY, (initialMeter - 1) * l.meterGap + l.slotW, l.slotW),
      partner: standingRect(partner, l.partnerX, l.feetY, l.creatureW),
      wild: wildRect,
      card: rectAt(l.cardX, l.cardY, l.cardW, l.cardH),
      tray: rectAt(l.trayX, l.trayY, l.trayW, l.trayH),
      hint: rectAt(l.hintX, l.hintY, l.hintW, UI.pad.height),
      speaker: rectAt(l.speakerX, l.speakerY, l.speakerW, l.speakerW),
    },
    cloud: rectAt(cloudX, cloudBottom - cloudHeight / 2, cloudWidth, cloudHeight),
    wildFeatures, slots,
    intro: rectAt(l.cardX, l.cardY, l.questionW, l.introTextH),
    cardContents: {
      question: rectAt(l.cardX, modelVisible ? l.questionY : l.cardY, l.questionW, l.questionH),
      ...(modelVisible ? { model: rectAt(l.modelX, l.modelY, l.modelW, l.modelH) } : {}),
      message: rectAt(l.cardX, l.correctionY, l.modelW, l.messageH),
    },
    answers: answerRects(),
  };
}
/** Convert estimated source-image features into the same canvas coordinates as the art. */
export function characterRegions(id: CharacterId, r: Rect) {
  const meta = manifest.characters[id], scale = r.width / meta.width;
  const panels = meta.patternPanels.map(p => ({ x: r.x + p.x * scale, y: r.y + p.y * scale, width: p.w * scale, height: p.h * scale }));
  const eyes = meta.eyes.map(eye => ({ x: r.x + eye.x * scale, y: r.y + eye.y * scale }));
  const padding = MOTION.blinkRadius * 2 * scale;
  const face = eyes.length ? { x: Math.min(...eyes.map(e => e.x)) - padding, y: Math.min(...eyes.map(e => e.y)) - padding,
    width: Math.max(...eyes.map(e => e.x)) - Math.min(...eyes.map(e => e.x)) + padding * 2,
    height: Math.max(...eyes.map(e => e.y)) - Math.min(...eyes.map(e => e.y)) + padding * 2 } : null;
  const target = panels.length ? { x: panels.reduce((sum, p) => sum + centre(p).x, 0) / panels.length,
    y: panels.reduce((sum, p) => sum + centre(p).y, 0) / panels.length } : centre(r);
  return { face, panels, target };
}
/** Fill the width with the top anchored. Only the bottom of the map is cropped. */
export function mapArt(area = 1) { return manifest.maps[getArea(area).key]; }
export function mapStyle(area = 1) { return MAP_LAYOUT[getArea(area).key]; }
export function mapTransform(area = 1) {
  const m = mapArt(area);
  const scale = Math.max(CANVAS.width / m.width, CANVAS.height / m.height);
  return { scale, x: (CANVAS.width - m.width * scale) / 2, y: 0 };
}
export function mapPoint(x: number, y: number, area = 1) {
  const t = mapTransform(area); return { x: t.x + x * t.scale, y: t.y + y * t.scale };
}
/** Tags sit under the oval rings, including the two lowest skill stones. */
export function mapStopLayout(index: number, area = 1) {
  const l = LAYOUT.map, style = mapStyle(area), source = mapArt(area).stops[index]!;
  const stop = getArea(area).stops[index]!;
  const tagWidth = stop.type === 'skill' && (stop.set === 'add-within5' || stop.set === 'sub-within5') ? l.withinTagW : style.tagW;
  const p = mapPoint(source.x, source.y, area), scale = mapTransform(area).scale;
  const radiusX = style.nativeRings ? source.rx * scale + UI.stroke : l.progressRadius;
  const radiusY = style.nativeRings ? source.ry * scale + UI.stroke : radiusX * l.progressScaleY;
  return { point: p, touch: mapStopTarget(p.x, p.y), radiusX, radiusY,
    ring: rectAt(p.x, p.y, radiusX * 2 + l.progressStroke, style.nativeRings ? radiusY * 2 + l.progressStroke : (radiusX * 2 + l.progressStroke) * l.progressScaleY),
    tag: rectAt(p.x + style.tagOffsetsX[index]!, p.y + style.tagOffsetsY[index]!, tagWidth, l.tagH),
    cloud: rectAt(p.x, p.y - l.cloudOffsetY, l.cloudW, l.cloudH) };
}
export function mapHomeRect(area = 1): Rect {
  const h = mapArt(area).home, t = mapTransform(area), p = mapPoint(h.x, h.y, area);
  return { ...p, width: h.w * t.scale, height: h.h * t.scale };
}
export function mapGateRect(area = 1): Rect {
  const g = mapArt(area).gate, p = mapPoint(g.x, g.y, area);
  return rectAt(p.x, p.y, UI.minTouch, UI.minTouch);
}
export function mapEntryRect(area = 1): Rect | undefined {
  const m = mapArt(area);
  if (!('entry' in m)) return;
  const p = mapPoint(m.entry.x, m.entry.y, area);
  return rectAt(p.x, p.y, UI.minTouch, UI.minTouch);
}
export function mapMarkerRect(id: CharacterId, index: number, area = 1): Rect {
  const m = mapArt(area), source = index < 0 && 'entry' in m ? m.entry : m.stops[index] ?? m.gate;
  const p = mapPoint(source.x, source.y, area), l = LAYOUT.map;
  return standingRect(id, p.x + (index < 0 ? 0 : l.markerOffsetX), p.y + l.markerFeetOffset, l.markerW);
}
interface BackgroundMeta { width: number; height: number; groundY?: number; groundColour?: string; page?: { x: number; y: number; w: number; h: number } }
export function backgroundMeta(key: string): BackgroundMeta {
  const meta = (manifest.backgrounds as Record<string, BackgroundMeta>)[key];
  if (!meta) throw new Error(`Unknown background: ${key}`);
  return meta;
}
export function groundTransform(key: string, groundY: number = SCENERY.groundY, shiftUp = 0) {
  const m = backgroundMeta(key), sourceY = m.groundY ?? SCENERY.groundSourceY;
  const scale = Math.max(CANVAS.width / m.width, CANVAS.height / m.height);
  return { scale, x: (CANVAS.width - m.width * scale) / 2, y: groundY - sourceY * scale - shiftUp,
    bottom: groundY + (m.height - sourceY) * scale - shiftUp,
    feetY: groundY - shiftUp, colour: Number.parseInt((m.groundColour ?? PALETTE.meadow).slice(1), 16) };
}
export function meadowTransform(groundY: number = SCENERY.groundY) { return groundTransform('bg-encounter-meadow', groundY); }
export function storyLayout(background: string, speaker: CharacterId, listener: CharacterId) {
  const l = LAYOUT.story, den = STORY_EFFECTS.den, meta = backgroundMeta(background);
  const t = groundTransform(background, SCENERY.groundY, meta.page ? den.shiftUp : 0);
  const source = (x: number, y: number) => ({ x: t.x + x * t.scale, y: t.y + y * t.scale });
  const page = meta.page ? { ...source(meta.page.x, meta.page.y), width: meta.page.w * t.scale, height: meta.page.h * t.scale } : undefined;
  const outline = page ? { x: page.x - den.pageInset, y: page.y - den.pageInset,
    width: page.width + den.pageInset * 2, height: page.height + den.pageInset * 2 } : undefined;
  const mist = rectAt(STORY_EFFECTS.mist.x, STORY_EFFECTS.mist.y, STORY_EFFECTS.mist.width,
    STORY_EFFECTS.mist.width * manifest.characters.nought.height / manifest.characters.nought.width);
  const scale = mist.width / manifest.characters.nought.width, body = STORY_EFFECTS.mist.body;
  return { transform: t, page, outline, rock: meta.page ? { ...source(den.rock.x, den.rock.y), width: den.rock.w * t.scale, height: den.rock.h * t.scale } : undefined,
    speaker: standingRect(speaker, page ? den.speakerX : l.creatureX, t.feetY, page ? den.speakerW : l.creatureW),
    listener: standingRect(listener, page ? den.listenerX : l.partnerX, t.feetY, page ? den.listenerW : l.partnerW),
    wallSparkles: den.wallSparkles.map(p => source(p.x, p.y)),
    dialogue: rectAt(l.lineX, l.panelY, l.panelW, l.panelH),
    mist, mistBody: { x: mist.x + body.x * scale, y: mist.y + body.y * scale, width: body.width * scale, height: body.height * scale },
    mistPuff: rectAt(STORY_EFFECTS.mist.x, STORY_EFFECTS.mist.y, mist.width * STORY_EFFECTS.mist.puffScaleX, mist.height * STORY_EFFECTS.mist.puffScaleY) };
}
/** The first oval can be near the bottom edge. Its full touch target extends upwards. */
export function mapStopTarget(x: number, y: number): Rect {
  return rectAt(x, Math.min(y, CANVAS.height - UI.minTouch / 2), UI.minTouch, UI.minTouch);
}

export function oddbookLayout() {
  const l = LAYOUT.oddbook;
  return Array.from({ length: 6 }, (_, i) => {
    const x = l.firstX + i % l.columns * (l.cardW + l.gapX);
    const y = l.firstY + Math.floor(i / l.columns) * (l.cardH + l.gapY);
    return { card: { x, y, width: l.cardW, height: l.cardH },
      name: rectAt(x + l.cardW / 2, y + l.nameY, l.nameW, l.nameH),
      portrait: { x: x + l.portraitX - l.portraitW / 2, y: y + l.portraitTop, width: l.portraitW, height: l.portraitH },
      partnerButton: rectAt(x + l.buttonX, y + l.buttonY, l.buttonW, l.buttonH),
      bar: rectAt(x + l.cardW / 2, y + l.barY, l.cardW - l.barInset * 2, l.barH) };
  });
}
export function campTeamLayout(ids: CharacterId[]) {
  const l = LAYOUT.camp;
  return ids.map((id, i) => standingRect(id, CANVAS.width / 2 + (i - (ids.length - 1) / 2) * l.teamGap,
    l.feetY, l.friendW * l.sizes[i % l.sizes.length]!));
}
export function mapBookRect(area = 1): Rect { const l = { ...LAYOUT.map, ...mapStyle(area) }; return rectAt(l.bookX, l.bookY, l.bookW, l.bookW); }

/** Include breathing, bobbing and the celebration hop when checking the reward row. */
export function rewardLayout(ids: readonly CharacterId[], joiningLine: boolean) {
  const l = LAYOUT.reward, shown = ids.slice(0, l.maxPals);
  const width = Math.min(joiningLine ? l.joinedW : l.creatureW,
    (CANVAS.width - l.palMargin * 2 - l.palGap * (shown.length - 1)) / shown.length);
  const pals = shown.map((id, i) => {
    const x = CANVAS.width / 2 + (i - (shown.length - 1) / 2) * (width + l.palGap);
    const rect = standingRect(id, x, l.feetY, width);
    const motion = { x: rect.x - width * MOTION.breath / 2,
      y: rect.y - MOTION.hop - MOTION.bob - rect.height * MOTION.breath / 2,
      width: width * (1 + MOTION.breath),
      height: rect.height * (1 + MOTION.breath) + MOTION.hop + MOTION.bob * 2 };
    return { id, rect, motion };
  });
  return { pals, regions: {
    headline: rectAt(CANVAS.width / 2, l.titleY, l.textW, l.headlineH),
    ...(joiningLine ? { joining: rectAt(CANVAS.width / 2, l.joinY, l.textW, l.joinH) } : {}),
    facts: rectAt(CANVAS.width / 2, l.progressY, l.textW, l.factH),
    button: rectAt(CANVAS.width / 2, l.buttonY, l.buttonW, UI.minTouch),
    speaker: rectAt(LAYOUT.story.speakerX, l.buttonY, UI.minTouch, UI.minTouch),
  } };
}
