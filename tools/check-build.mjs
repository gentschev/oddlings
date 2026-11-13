// Static production checks. Does not start a server or browser.
import { readFile, readdir, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve('dist');
function relative(value) {
  if (value.startsWith('/') || value.startsWith('\\')) throw new Error(`Root-relative build path: ${value}`);
}
async function reference(value, owner) {
  if (/^(?:https?:|data:|blob:|#)/.test(value)) return;
  relative(value);
  const path = value.split(/[?#]/)[0];
  if (path) await access(resolve(dirname(owner), path));
}
for (const name of ['index.html', 'parent.html']) {
  const path = resolve(root, name), html = await readFile(path, 'utf8');
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) await reference(match[1], path);
}
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.webmanifest'), 'utf8'));
for (const path of [manifest.start_url, manifest.scope]) relative(path);
if (manifest.display !== 'fullscreen' || manifest.orientation !== 'landscape') throw new Error('Incorrect app display');
for (const icon of manifest.icons) {
  await reference(icon.src, resolve(root, 'manifest.webmanifest'));
  const png = await readFile(resolve(root, icon.src));
  if (`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}` !== icon.sizes) throw new Error(`Wrong icon dimensions: ${icon.src}`);
}
for (const file of await readdir(resolve(root, 'assets'))) if (file.endsWith('.css')) {
  const path = resolve(root, 'assets', file), css = await readFile(path, 'utf8');
  for (const match of css.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)) await reference(match[1], path);
}
const sw = await readFile(resolve(root, 'sw.js'), 'utf8');
const precache = [...sw.matchAll(/\burl\s*:\s*["']([^"']+)["']/g)].map(m => m[1]);
if (!precache.includes('parent.html') || !precache.includes('index.html')) throw new Error('Both HTML pages must be precached');
const assets = await readdir(resolve(root, 'assets'));
const speechWorkers = assets.filter(name => /^speechWorker-[A-Za-z0-9_-]+\.js$/.test(name));
if (!speechWorkers.length) throw new Error('Speech download worker must be bundled');
for (const name of speechWorkers) if (!precache.includes(`assets/${name}`)) throw new Error(`Speech worker is not precached: ${name}`);
// Vite emits the worker reference relative to its importing chunk under base './'.
const scripts = await Promise.all(assets.filter(name => name.endsWith('.js') && !speechWorkers.includes(name))
  .map(async name => ({ name, code: await readFile(resolve(root, 'assets', name), 'utf8') })));
for (const name of speechWorkers) {
  let linked = false;
  for (const script of scripts) for (const match of script.code.matchAll(/new URL\(["']([^"']*speechWorker-[^"']+\.js)["'],import\.meta\.url\)/g)) {
    if (match[1].split('/').pop() !== name) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(match[1])) throw new Error(`Speech worker reference must be relative: ${match[1]}`);
    await reference(match[1], resolve(root, 'assets', script.name)); linked = true;
  }
  if (!linked) throw new Error(`No relative module reference to speech worker: ${name}`);
}
if (!precache.some(p => p.endsWith('.ttf')) || !precache.some(p => p.includes('assets/art/'))) throw new Error('Art and fonts must be precached');
if (/url:["']assets\/(?:art|fonts)\/[^"']+["'],revision:null/.test(sw)) throw new Error('Unhashed public assets must have content revisions');
for (const path of precache) {
  relative(path);
  if (path.includes('assets/speech/')) throw new Error('Speech must not be precached');
  await access(resolve(root, path));
}
for (const match of sw.matchAll(/["']([^"']*workbox-[^"']+\.js)["']/g)) await reference(match[1], resolve(root, 'sw.js'));
console.log(`Production files verified: both pages, manifest, service and speech workers, icons and ${precache.length} relative precache entries. Speech is excluded.`);
