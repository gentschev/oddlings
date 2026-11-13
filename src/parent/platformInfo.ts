import type { Channel } from '../platform/channel';

export function channelCopyControls(channel: Channel): string {
  if (channel !== 'next') return '';
  return `<div class="data-actions"><button id="copy-main">Copy progress from the main game</button></div>
    <div id="copy-main-preview" class="detail" hidden>
      <p>Replace test progress with a copy from the main game? The main game's progress stays unchanged.</p>
      <button id="confirm-copy-main">Copy progress</button><button id="cancel-copy-main">Cancel</button>
    </div>`;
}
export function homeScreenSection(show: boolean): string {
  if (!show) return '';
  return `<section id="home-screen" aria-labelledby="home-screen-title">
    <h2 id="home-screen-title">Keep progress on this device</h2>
    <p>Tap Share, then Add to Home Screen. Open the game from the new icon.</p>
    <p>Safari clears a site's stored data after a week of Safari use without a visit.
    A game added to the Home Screen is kept. Export a backup too.</p>
  </section>`;
}
