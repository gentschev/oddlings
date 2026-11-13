// Checks finished clips for a stray hiss at the end (see hiss.mjs). Run after generating.
// Exits with status 1 when any clip fails, so it can gate a release.
//
// Usage: node tools/speech/tails.mjs <speechDir>
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { endsSmooth, fileTailHissMs, HISS_LIMIT_MS } from './hiss.mjs';

const dir = process.argv[2];
if (!dir) throw new Error('usage: tails.mjs <speechDir>');
const tmp = mkdtempSync(join(tmpdir(), 'oddlings-tails-'));

const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
let checked = 0, bad = 0;
for (const [id, entry] of Object.entries(index)) {
  const spoken = entry.spoken ?? entry.text;
  if (!(await endsSmooth(spoken))) continue;
  checked++;
  const ms = fileTailHissMs(join(dir, entry.file), tmp);
  if (ms >= HISS_LIMIT_MS) { bad++; console.log(`${id}\t${ms} ms of hiss after\t${spoken}`); }
}
rmSync(tmp, { recursive: true, force: true });
console.log(`${checked} lines end in a smooth sound, ${bad} have a stray hiss`);
process.exit(bad ? 1 : 0);
