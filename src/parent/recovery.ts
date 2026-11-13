/** Storage owns the recovery flag. This banner preserves its date across page navigation. */
export function recoveryBanner(date: string | undefined): string {
  if (!date) return '';
  const safe = date.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
  return `<aside class="recovery-banner" role="status">Restored from backup of ${safe}.</aside>`;
}
