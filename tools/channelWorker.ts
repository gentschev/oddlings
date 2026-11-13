import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

/** Workbox fixes its expiry database name internally. Scope that literal in next only. */
export function nextWorkboxSource(source: string): string {
  const result = source.replace(/(['"])workbox-expiration\1/g, '$1workbox-expiration-next$1');
  if (result === source) throw new Error('Workbox expiry database name not found');
  return result;
}
export function nextServiceWorkerSource(source: string): string {
  const result = source.replace(/\{\s*prefix:\s*(['"])workbox-next\1\s*\}/g,
    '{prefix:"workbox",suffix:self.registration.scope+"-next"}');
  if (result === source) throw new Error('Workbox channel cache configuration not found');
  return result;
}
/** Run after generateSW. Rehash modified runtime code so an address never changes content. */
export async function isolateNextWorkbox(directory: string): Promise<void> {
  const swPath = join(directory, 'sw.js');
  let worker = nextServiceWorkerSource(await readFile(swPath, 'utf8'));
  const files = (await readdir(directory)).filter(name => /^workbox-[A-Za-z0-9_-]+\.js$/.test(name));
  if (!files.length) throw new Error('Missing Workbox runtime');
  for (const name of files) {
    const source = nextWorkboxSource(await readFile(join(directory, name), 'utf8'));
    const hash = createHash('sha256').update(source).digest('hex').slice(0, 8), renamed = `workbox-${hash}.js`;
    const stem = name.slice(0, -3);
    if (!worker.includes(stem)) throw new Error('Workbox runtime is not referenced');
    await writeFile(join(directory, renamed), source);
    // generateSW's AMD dependencies omit .js; importScripts references can include it.
    worker = worker.split(stem).join(renamed.slice(0, -3));
    if (renamed !== name) await unlink(join(directory, name));
  }
  await writeFile(swPath, worker);
}
