/** Fixed logical tablet canvas. */
export const CANVAS = { width: 1280, height: 800 } as const;
/** Shared screenprint palette, also used for counters and celebrations. */
export const PALETTE = { cream: '#FFF8EA', navy: '#1B2A4A', coral: '#F2543D', yellow: '#F9C22E', mint: '#5FD3A6', meadow: '#6AC7A1' } as const;
export const INK = { cream: 0xfff8ea, navy: 0x1b2a4a, coral: 0xf2543d, yellow: 0xf9c22e, mint: 0x5fd3a6, meadow: 0x6ac7a1 } as const;
/** All typography uses the bundled font, loaded before starting Phaser. */
export const FONT = '"Baloo 2"';
/** Canvas centre used for centred labels and actions. */
export const CENTER_X = CANVAS.width / 2;
/** Clock hook advances in frame-sized steps. */
export const CLOCK_STEP_MS = 1000 / 60;
/** Stable default until a URL seed is supplied. */
export const DEFAULT_SEED = 123;
/** Shared transition, feedback, warm-up, hold and idle timings in milliseconds. */
export const TIMING = { fade: 160, press: 90, feedback: 720, question: 220, clear: 1400,
  hold: 3000, demo: 210, warmup: 160, breath: 2400, blink: 4400, blinkLength: 130,
  hop: 420, heart: 900, pattern: 500, burst: 650 } as const;
/** Pause after a spoken line, with a bound for damaged or stale clip metadata. */
export const SPEECH_TIMING = { gap: 160, maxWait: 6000, quietIntro: 2200 } as const;
/** Earned dots reach the friend in at most 576 ms for a ten-slot meter. */
export const MUDDLE_TIMING = { dotPop: 240, flight: 360, stagger: 24, cloudPop: 240 } as const;
/** Reusable controls and picture-model geometry. */
export const UI = { minTouch: 88, stroke: 4, radius: 24, buttonFont: 32, bodyFont: 32,
  titleFont: 64, subheadingFont: 42, smallFont: 25, selectedStroke: 7,
  pad: { x: 322, y: 514, width: 96, height: 96, gapX: 106, gapY: 106, font: 48 },
  model: { cell: 56, gap: 0, dot: 24, dotWidth: 260, dotHeight: 108, dotPadding: 4, lineWidth: 4, frameGap: 16, lineLength: 520,
    tick: 12, arc: 34, dominoWidth: 320, dominoHeight: 112 },
  burstCount: 14, burstRadius: 9, burstDistance: 110, burstStart: 0.66, burstTravel: 38 } as const;
/** Scene layout in logical pixels. */
export const LAYOUT = {
  title: { titleX: 640, titleY: 188, titleSize: 150, playX: 640, playY: 558, playW: 320, playH: 112, playFont: 56,
    grownX: 1090, grownY: 732, grownW: 306, shadowOffset: 7, outline: 9, angle: -3,
    offline: { x: 32, y: 708, width: 560, height: 56, font: 26, padding: 12, icon: 30, gap: 12, stroke: 3 },
    homeScreen: { x: 32, y: 768, width: 560, height: 28, font: 22, padding: 2 },
    testBadge: { x: 32, y: 20, width: 390, height: 76, font: 22, padding: 8 },
    },
  choose: { headingY: 100, cardY: 382, cardW: 360, cardH: 350, xs: [230, 640, 1050],
    creatureY: 370, creatureW: 320, nameY: 525, pickY: 686, pickW: 288 },
  map: { headingX: 208, headingY: 66, bookX: 64, bookY: 736, bookW: 88, muteX: 1216, muteY: 736, muteW: 88,
    markerW: 72, markerOffsetX: -80, markerFeetOffset: 18, stopRadius: 44, stopHeight: 54, stopFont: 29, stopOpacity: 0.94, lockedOpacity: 0.6,
    pulseScale: 1.12, helpPulseScale: 1.06, friendW: 58, friendH: 45, cloudW: 32, cloudH: 20, cloudOffsetY: 48, iconOpacity: 0.85,
    starOffset: 34, starPoints: 5, starInner: 8, starOuter: 17, starStroke: 2, gateStroke: 6, gatePulseAlpha: 0.3,
    ringSegments: 96, progressRadius: 48, progressScaleY: 0.62, progressStroke: 10,
    tagW: 100, tagH: 34, tagOffsetY: 52, tagOffsetsX: [0, 0, 0, 0, 0, 0, 0, -36, 0, 0, 0], tagFont: 20, tagCell: 13, tagDot: 4,
    homeSignW: 72, homeSignH: 44 },
  encounter: { partnerX: 170, wildX: 1110, feetY: 430, creatureW: 240,
    cloudRatio: 0.45, cloudAlpha: 0.85, cloudGap: 16, cloudMinScale: 0.55,
    meterY: 45, meterGap: 62, slotW: 44, dotW: 26,
    cardX: 640, cardY: 265, cardW: 620, cardH: 330, questionY: 176, questionSize: 112, countSize: 64,
    questionW: 596, questionH: 144, modelX: 640, modelY: 314, modelW: 580, modelH: 120,
    correctionY: 400, correctionSize: 30, messageH: 40, hintX: 140, hintY: 620, hintW: 200,
    hintIconX: -72, hintLabelX: 16, hintIconSize: 26, introSize: 48, introTextH: 180,
    speakerX: 1140, speakerY: 620, speakerW: 96,
    trayX: 640, trayY: 620, trayW: 764, trayH: 332,
    clearY: 170, clearSize: 62, ringX: 1080, ringY: 432, ringW: 130, ringH: 30, ringAlpha: 0.18 },
  warmup: { titleY: 140, promptY: 330, promptSize: 92, stepsY: 440, taps: [7, 2, 9, 4, 6] },
  story: { creatureX: 380, feetY: 430, creatureW: 360, partnerX: 900, partnerW: 290,
    ringX: 650, ringY: 462, ringW: 230, ringH: 52, ringStroke: 7, ringFill: 0.55, ringPulseScale: 1.18,
    lineX: 640, lineY: 564, nextX: 1010, nextY: 710, nextW: 250, speakerX: 260,
    panelY: 562, panelW: 1100, panelH: 126 },
  camp: { headingY: 110, feetY: 430, friendW: 180, teamGap: 188,
    sizes: [0.95, 1.04, 0.90, 1, 0.94, 1.06], nameY: 550,
    stopX: 420, goX: 860, bookX: 640, buttonsY: 690, buttonW: 330,
    petHeight: 220, heartSize: 22, heartLift: 42, heartGap: 24 },
  oddbook: { headingY: 42, headingSize: 48, headingH: 80, lineY: 112, lineSize: 26, lineH: 48,
    backX: 1160, backY: 64, backW: 184, firstX: 58, firstY: 154,
    columns: 3, gapX: 42, gapY: 24, cardW: 360, cardH: 292, nameY: 28,
    portraitX: 108, portraitFeet: 235, portraitW: 168, portraitTop: 60, portraitH: 188, hop: 14,
    nameW: 240, nameH: 56,
    buttonX: 268, buttonY: 150, buttonW: 136, buttonH: 88, buttonFont: 24,
    barInset: 24, barY: 264, barH: 20, starX: 330, starY: 28, starSize: 16 },
  reward: { joinY: 190, joinFont: 40, headlineH: 112, joinH: 72, factH: 64, textW: 1120,
    palMargin: 80, palGap: 60, joinedW: 260, maxPals: 4, minPalW: 150, titleY: 90, creatureX: 640, feetY: 520, creatureW: 320,
    progressY: 606, buttonY: 718, buttonW: 300 },
  panel: { x: 640, y: 400, width: 800, height: 400, messageY: 350, closeY: 500, closeW: 240, shade: 0.45 },
} as const;
/** Oddling motion is computed from elapsed time without allocating each frame. */
export const MOTION = { breath: 0.018, bob: 4, hop: 38, quickHop: 72, tilt: 9,
  blinkRadius: 15, blinkLine: 5, cloudWobble: 3,
  panelInset: 0.08, segmentRadius: 20, demoSteps: 10, hintPulse: 0.06 } as const;
/** Fade colour as camera RGB components. */
export const FADE_RGB = [255, 248, 234] as const;

/** Ground source coordinate and scenery placement, shared by all meadow scenes. */
export const SCENERY = { groundSourceY: 700, groundY: 430,
  iconStroke: 4, iconSize: 34, seamHeight: 64, seamSteps: 32 } as const;

/** Counts above this use one unnumbered reward line in text and speech. */
export const SPOKEN_COUNT_LIMIT = 20;
/** Parent gate dimensions, touch sizes and digit limit. */
export const PARENT_GATE = { width: 800, height: 680, x: 640, y: 400, questionY: 142,
  answerY: 224, firstX: 534, firstY: 330, gap: 106, keySize: 96,
  closeX: 956, closeY: 142, closeW: 136, font: 48, keyFont: 32, digits: 2 } as const;

/** Path progress animation runs concurrently, then walks in a bounded time. */
export const PATH_TIMING = { rings: 600, starGap: 60, star: 220, walkBudget: 1800 } as const;

/** Per-map presentation data. New maps add rows here without changing scene logic. */
export const MAP_LAYOUT = {
  pebblePath: { bookX: 64, bookY: 736, tagW: 100, tagFont: 20, tagOffsetsX: [0, 0, 0, 0, 0, 0, 0, -36, 0, 0, 0],
    tagOffsetsY: [52, 52, 52, 52, 52, 52, 52, 52, 52, 52, 52], nativeRings: false },
  twinFalls: { bookX: 1108, bookY: 736, tagW: 180, tagFont: 24, tagOffsetsX: [0, 0, 0, 0, 0, 0],
    tagOffsetsY: [52, 64, 52, 64, 64, 52], nativeRings: true },
} as const;
/** Story clues use game-clock tweens and source coordinates from the art. */
export const STORY_EFFECTS = {
  den: { shiftUp: 120, speakerX: 300, listenerX: 1000, speakerW: 300, listenerW: 270,
    rock: { x: 510, y: 730, w: 500, h: 150 }, pageInset: 10, pageStroke: 5, pagePulseScale: 1.06,
    wallSparkles: [{ x: 880, y: 405 }, { x: 785, y: 470 }, { x: 665, y: 438 }] },
  // Main ink bounds exclude the PNG's translucent print specks and empty margins.
  mist: { x: 650, y: 270, width: 210, alpha: 0.75, puffAlpha: 0.55, puffScaleX: 1.2, puffScaleY: 1.15,
    body: { x: 73, y: 35, width: 478, height: 507 }, bob: 8, bobTime: 1800, enter: 600, leave: 500, lift: 56 },
} as const;
