import { offlineDisplay, type OfflineState } from '../platform/offlineStatus';

export function offlineSettingsText(state: OfflineState): string {
  if (offlineDisplay(state) === 'hidden') return '';
  const count = `${state.stored} / ${state.total} voices stored.`;
  return offlineDisplay(state) === 'ready' ? `Ready to play offline. ${count}`
    : `Getting voices for offline play. ${count} Not ready yet.`;
}

export function storageNotice(): string {
  return `<section id="storage-notice" aria-labelledby="storage-title">
    <h2 id="storage-title">What this game stores</h2>
    <p>The game has no accounts, no adverts and no tracking, and asks for no name.</p>
    <p>Progress is kept only in this browser on this device. Nothing about the child is sent anywhere.
    Clearing the browser's data or using another device starts again. Export on this page makes a backup file.</p>
    <p>One device holds one player's progress. If children share a device, they share that progress.</p>
    <p>The game's files come from GitHub Pages. Like any web host, it sees the device's internet address when files are downloaded.</p>
    <p>After the first full download, the game works without a connection. Wait for Ready to play offline before leaving a connection.</p>
  </section>`;
}
