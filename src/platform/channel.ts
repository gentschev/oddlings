export type Channel = 'main' | 'next';
export function parseChannel(value: string | undefined): Channel {
  if (value === undefined || value === 'main') return 'main';
  if (value === 'next') return 'next';
  throw new Error('ODDLINGS_CHANNEL must be main or next');
}
export const CHANNEL: Channel = typeof __ODDLINGS_CHANNEL__ === 'undefined' ? 'main' : parseChannel(__ODDLINGS_CHANNEL__);
export const channelName = (name: string, channel: Channel) => name + (channel === 'next' ? '-next' : '');
/** Main names are part of the installed app's storage contract. */
export function storageNames(channel: Channel) {
  const name = (value: string) => channelName(value, channel);
  return { database: name('oddlings'), store: name('save'), save: name('oddlings-save'), saveTime: name('oddlings-save-time'),
    restored: name('oddlings-restored'), challenge: name('oddlings-parent-challenge'), historyGuard: name('oddlingsGuard'),
    speech: name('oddlings-speech-v1'), speechIndex: name('oddlings-speech-index-v1'), expiration: name('workbox-expiration'),
    backup: (date: string) => name(`oddlings-backup-${date}`) };
}
export const STORAGE_NAMES = storageNames(CHANNEL);
export const precacheName = (scope: string, channel: Channel) => channelName(`workbox-precache-v2-${scope}`, channel);
