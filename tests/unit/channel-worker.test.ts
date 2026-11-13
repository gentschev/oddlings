import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { isolateNextWorkbox, nextServiceWorkerSource, nextWorkboxSource } from '../../tools/channelWorker';

it('isolates the fixed expiry database and ends generated cache names in next', () => {
  const source = 'const db="workbox-expiration";', worker = 'w.setCacheNameDetails({prefix:"workbox-next"});';
  expect(nextWorkboxSource(source)).toBe('const db="workbox-expiration-next";');
  expect(nextServiceWorkerSource(worker)).toBe('w.setCacheNameDetails({prefix:"workbox",suffix:self.registration.scope+"-next"});');
  expect(source).toBe('const db="workbox-expiration";');
  expect(() => nextWorkboxSource('unknown runtime')).toThrow(); expect(() => nextServiceWorkerSource('unknown worker')).toThrow();
});
it.each(['.js', ''])('rehashes changed runtime code and updates the relative worker reference with extension %s', async extension => {
  await mkdir('test-results', { recursive: true }); const directory = await mkdtemp('test-results/channel-worker-');
  try {
    const runtime = 'const db="workbox-expiration";', next = nextWorkboxSource(runtime);
    const name = `workbox-${createHash('sha256').update(next).digest('hex').slice(0, 8)}.js`;
    await writeFile(join(directory, 'workbox-12345678.js'), runtime);
    await writeFile(join(directory, 'sw.js'), `define(["./workbox-12345678${extension}"],function(w){w.setCacheNameDetails({prefix:"workbox-next"});});`);
    await isolateNextWorkbox(directory);
    expect(await readdir(directory)).toEqual(expect.arrayContaining(['sw.js', name]));
    expect(await readdir(directory)).not.toContain('workbox-12345678.js');
    expect(await readFile(join(directory, name), 'utf8')).toBe(next);
    expect(await readFile(join(directory, 'sw.js'), 'utf8')).toContain(`./${extension ? name : name.slice(0, -3)}"`);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
