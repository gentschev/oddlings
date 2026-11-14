import Phaser from 'phaser';
import { seededRandom } from './core';
import { STARTERS } from './core/story/characters';
import { BaseScene } from './game/BaseScene';
import { BootScene } from './game/BootScene';
import { CampScene } from './game/CampScene';
import { ChoosePartnerScene } from './game/ChoosePartnerScene';
import { EncounterScene } from './game/EncounterScene';
import { OddbookScene } from './game/OddbookScene';
import { MapScene } from './game/MapScene';
import { RewardScene } from './game/RewardScene';
import { Runtime } from './game/Runtime';
import { StoryScene } from './game/StoryScene';
import { TitleScene } from './game/TitleScene';
import { WarmupScene } from './game/WarmupScene';
import { CANVAS, DEFAULT_SEED, PALETTE } from './game/constants';
import { advanceWithoutIntermediateRenders } from './game/manualClock';
import { loadSave } from './platform/storage';
import { initDeviceSupport } from './platform/device';
import { startOfflineSupport } from './platform/offline';
import { offlineSnapshot, offlineStatus } from './platform/offlineStatus';
import { BUILD_VERSION } from './platform/version';
import { CHANNEL } from './platform/channel';
import { RENDER_SCALE } from './platform/renderScale';
import { STRINGS } from './game/strings';
import './font.css';
import './style.css';

document.querySelector('#orientation-text')!.textContent = STRINGS.sideways;

const params = new URLSearchParams(location.search);
const flags = { fresh: params.get('fresh') === '1', skipIntro: params.get('skipIntro') === '1' };
const parsedSeed = Number(params.get('seed') ?? DEFAULT_SEED);
const seed = Number.isFinite(parsedSeed) ? parsedSeed : DEFAULT_SEED;
const save = await loadSave(flags.fresh);
// The direct-to-map test route needs a pal without visiting the choice screen.
if (flags.skipIntro && !save.team.partner) {
  save.team.partner = STARTERS[0];
  if (!save.team.friends.includes(STARTERS[0])) save.team.friends.push(STARTERS[0]);
  save.story.introComplete = true;
}
// Canvas text measures against the real font from its first frame.
await Promise.all([document.fonts.load('800 48px "Baloo 2"'), document.fonts.load('400 32px "Baloo 2"'), document.fonts.ready]);
const runtime = new Runtime(save, seededRandom(seed), flags.skipIntro, Date.now());
const scenes = [new BootScene(runtime), new TitleScene(runtime), new ChoosePartnerScene(runtime),
  new MapScene(runtime), new EncounterScene(runtime), new RewardScene(runtime), new WarmupScene(runtime),
  new StoryScene(runtime), new CampScene(runtime), new OddbookScene(runtime)];
const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: CANVAS.width * RENDER_SCALE, height: CANVAS.height * RENDER_SCALE,
  backgroundColor: PALETTE.cream, banner: false, audio: { noAudio: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // Applies to power-of-two textures only: the padded pal art (see ui/mipTexture.ts).
  render: { mipmapFilter: 'LINEAR_MIPMAP_LINEAR' },
  scene: scenes,
});
game.events.on(Phaser.Core.Events.PRE_STEP, (_time: number, delta: number) => {
  runtime.delta = delta; runtime.elapsed += delta;
});
initDeviceSupport(() => runtime.snapshot().scene === 'title');
const launched = new Promise<void>(resolve => {
  const rendered = () => {
    if (runtime.snapshot().scene === 'boot') return;
    game.events.off(Phaser.Core.Events.POST_RENDER, rendered); resolve();
  };
  game.events.on(Phaser.Core.Events.POST_RENDER, rendered);
});
startOfflineSupport(launched, () => runtime.save);
let controlledTime: number | null = null;
let advancedMs = 0;
window.__oddlings = {
  state: () => ({ ...runtime.snapshot(), canvas: CANVAS, renderScale: RENDER_SCALE, flags, seed, channel: CHANNEL, version: BUILD_VERSION, offline: offlineSnapshot(offlineStatus.get()),
    randomState: runtime.rng.state(), clock: advancedMs,
    profile: { name: save.profile.name, partner: save.team.partner, tapBaseline: save.profile.tapBaseline },
    area: save.map.area, team: [...save.team.friends], helped: [...save.team.helped], clearedSpots: [...save.map.clearedSpots],
    completedBeats: [...save.story.completedBeats], responses: save.responses.length,
    pendingSaves: runtime.pendingSaves, saveError: runtime.saveError }),
  advanceTime(ms: number) {
    if (!Number.isFinite(ms) || ms < 0) throw new Error('Invalid clock advance');
    if (controlledTime === null) { game.loop.stop(); controlledTime = game.loop.time; }
    controlledTime = advanceWithoutIntermediateRenders(game, controlledTime, ms);
    advancedMs += ms;
  },
};
document.addEventListener('visibilitychange', () => {
  const hidden = document.hidden;
  const encounter = scenes.find(s => s instanceof EncounterScene) as EncounterScene;
  if (hidden && encounter.sys.isActive()) encounter.markHidden();
  if (runtime.visibility(hidden)) {
    const active = scenes.find(s => s.sys.isActive());
    if (active instanceof BaseScene) active.scene.start('warmup');
  }
});
declare global {
  interface Window { __oddlings: { state(): Record<string, unknown>; advanceTime(ms: number): void } }
}
