// Transcribes generated speech files with a local Whisper model and prints the lines whose
// transcript does not match the text. A way to catch mispronunciations and stray trailing
// sounds without listening to every file. Speech recognition tends to correct odd sounds
// toward real words, so a clean result here is weaker evidence than a listen.
//
// Usage: node tools/speech/transcribe.mjs <speechDir> [idPrefix ...]
//   node tools/speech/transcribe.mjs public/assets/speech            # every line
//   node tools/speech/transcribe.mjs public/assets/speech ui- praise # only ids with these prefixes
// Also accepts .wav or .m4a paths in place of prefixes when <speechDir> is "-".
import { pipeline } from '@huggingface/transformers';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [dir, ...filters] = process.argv.slice(2);
if (!dir) throw new Error('usage: transcribe.mjs <speechDir> [idPrefix ...]');
const tmp = mkdtempSync(join(tmpdir(), 'oddlings-asr-'));

function samples(path) {
  const wav = join(tmp, 'a.wav');
  execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', path, wav]);
  const buf = readFileSync(wav);
  const at = buf.indexOf('data') + 8;
  const pcm = new Int16Array(buf.buffer, buf.byteOffset + at, (buf.length - at) >> 1);
  return Float32Array.from(pcm, (v) => v / 32768);
}
// The recogniser writes numbers as digits and joins some words; make both sides comparable.
const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\btakeaway\b/g, 'take away')
  .replace(/\b[a-z]+\b/g, (w) => { const n = NUMBERS.indexOf(w); return n < 0 ? w : String(n); })
  .replace(/\s+/g, ' ').trim();

let items;
if (dir === '-') items = filters.map((path) => ({ id: path, path, text: '' }));
else {
  const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
  items = Object.entries(index)
    .filter(([id]) => !filters.length || filters.some((f) => id.startsWith(f)))
    .map(([id, e]) => ({ id, path: join(dir, e.file), text: e.text }));
}
const asr = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-base.en', { dtype: 'q8' });
let bad = 0;
for (const item of items) {
  const audio = samples(item.path);
  const heard = (await asr(audio)).text.trim();
  const seconds = (audio.length / 16000).toFixed(2);
  if (dir === '-' || norm(heard) !== norm(item.text)) {
    bad++;
    console.log(`${item.id}\t${seconds}s\ttext: ${item.text}\theard: ${heard}`);
  }
}
rmSync(tmp, { recursive: true, force: true });
console.log(`${items.length} checked, ${dir === '-' ? 0 : bad} differ`);
