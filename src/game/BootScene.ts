import manifest from '../../public/assets/art/manifest.json';
import { text } from '../ui/Controls';
import { BaseScene } from './BaseScene';
import { CANVAS, UI } from './constants';
import { STRINGS } from './strings';
import type { Runtime } from './Runtime';

export class BootScene extends BaseScene {
  constructor(runtime: Runtime) { super('boot', runtime); }
  preload(): void {
    this.begin();
    this.onScreen = [STRINGS.loading];
    const label = text(this, CANVAS.width / 2, CANVAS.height / 2, STRINGS.loading, UI.titleFont);
    this.load.on('loaderror', () => label.setText(STRINGS.assetError));
    for (const [id, meta] of Object.entries(manifest.characters)) this.load.image(id, `assets/art/${meta.file}`);
    for (const [id, meta] of Object.entries(manifest.backgrounds)) this.load.image(id, `assets/art/${meta.file}`);
  }
  create(): void { this.scene.start(this.runtime.skipIntro ? 'map' : 'title'); }
}
