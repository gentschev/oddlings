// Generates one audio file per line of in-game text, offline, with the Kokoro-82M model
// (Apache-2.0), then compresses to AAC with macOS afconvert.
//
// Usage: node tools/speech/generate.mjs <lines.json> <outDir>
//   lines.json: [{ "id": "moss.hello.1", "text": "Oh! A new face. Hello.", "voice": "af_heart" }, ...]
// Files already present with the same text and voice are skipped (see index.json in outDir).
import { KokoroTTS } from 'kokoro-js';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { endsSmooth, fileTailHissMs, HISS_LIMIT_MS } from './hiss.mjs';

const [linesPath, outDir] = process.argv.slice(2);
if (!linesPath || !outDir) throw new Error('usage: generate.mjs <lines.json> <outDir>');
const DEFAULT_VOICE = 'af_heart';
const SPEED = 0.9;

// Kokoro turns text into phonemes with eSpeak-NG's spelling rules, which guess wrong for
// some made-up names. Each entry respells a word for the speech engine only; on-screen text
// is unchanged. Check a respelling with tools/speech/phonemes.mjs before adding it.
const PRONUNCIATION = {
  Twoot: 'Twute', // rhymes with "hoot" (default reading was "TOO-aht")
  Fivel: 'Fyvel', // "FIVE-ul", rhymes with "rival" (default reading was "FIV-ul")
};
// A line with no end punctuation, or one ending in an ellipsis, tends to pick up a stray
// sound after the last word ("three" came out as "three-uh"), so the engine always gets a
// closed sentence.
const closed = (text) => {
  const t = text.trim().replace(/(…|\.\.\.)$/, '.').replace(/^[a-z]/, (c) => c.toUpperCase());
  return /[.!?]$/.test(t) ? t : `${t}.`;
};
const spokenText = (text) => closed(Object.entries(PRONUNCIATION)
  .reduce((t, [word, respelled]) => t.replace(new RegExp(`\\b${word}\\b`, 'g'), respelled), text));
// If a clip still ends in a hiss the words do not call for, try other endings in this order
// and keep the first clean one. The ending used is stored in the index as `ending`.
const ENDINGS = ['!', '.', '?', ','];
const withEnding = (spoken, mark) => spoken.replace(/[.!?]$/, mark);
// The engine leaves almost no gap after an exclamation mark inside a line: measured 0 to
// 110 ms, against 120 to 350 ms after a full stop, so "Wait! Do not go!" ran together. Other
// punctuation after the mark (an ellipsis, a dash, a full stop) did not change that. Such a
// line is recorded in parts, split after each inner exclamation mark, and the parts are
// joined with a fixed silence. The number of parts is stored in the index as `parts`.
const PAUSE_MS = 220;      // added between parts, on top of the trimmed margins (about 120 ms)
const partsOf = (spoken) => spoken.split(/(?<=!)\s+/);

// Kokoro pads each clip with about 0.35 s of silence before the speech and 0.5 s after. The
// lead makes every line start late and the tail makes waits longer than the words. Keep a
// short margin at each end so the first and last sounds are not clipped.
const SILENCE = 0.01;      // samples quieter than this count as silence (full scale is 1)
const LEAD_MS = 30;
const TAIL_MS = 90;
function trimSilence(audio) {
  const data = audio.audio, rate = audio.sampling_rate;
  let first = 0, last = data.length - 1;
  while (first < data.length && Math.abs(data[first]) < SILENCE) first++;
  while (last > first && Math.abs(data[last]) < SILENCE) last--;
  if (first >= last) return audio;
  const from = Math.max(0, first - Math.round(rate * LEAD_MS / 1000));
  const to = Math.min(data.length, last + 1 + Math.round(rate * TAIL_MS / 1000));
  return new audio.constructor(data.slice(from, to), rate);
}

const lines = JSON.parse(readFileSync(linesPath, 'utf8'));
mkdirSync(outDir, { recursive: true });
const indexPath = join(outDir, 'index.json');
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : {};

const todo = lines.filter((l) => {
  const prev = index[l.id];
  // Entries without a length predate silence trimming and are made again.
  return !(prev && prev.text === l.text && (prev.spoken ?? prev.text) === spokenText(l.text)
    && (prev.parts ?? 1) === partsOf(spokenText(l.text)).length
    && prev.voice === (l.voice ?? DEFAULT_VOICE) && typeof prev.ms === 'number' && existsSync(join(outDir, prev.file)));
});
console.log(`${lines.length} lines, ${todo.length} to generate`);
if (todo.length) {
  const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
  let n = 0;
  for (const line of todo) {
    const voice = line.voice ?? DEFAULT_VOICE;
    const file = `${line.id.replace(/[^a-zA-Z0-9._-]/g, '_')}.m4a`;
    const wav = join(outDir, `${file}.wav`);
    const spoken = spokenText(line.text);
    // Writes the compressed file and returns the clip. The hiss check reads the finished
    // file, the same way tools/speech/tails.mjs does, so the two always agree.
    const make = async (text) => {
      const pieces = [];
      for (const part of partsOf(text)) pieces.push(trimSilence(await tts.generate(part, { voice, speed: SPEED })));
      const rate = pieces[0].sampling_rate, gap = Math.round(rate * PAUSE_MS / 1000);
      const joined = new Float32Array(pieces.reduce((sum, p) => sum + p.audio.length, 0) + gap * (pieces.length - 1));
      let at = 0;
      for (const p of pieces) { joined.set(p.audio, at); at += p.audio.length + gap; }
      const clip = pieces.length === 1 ? pieces[0] : new pieces[0].constructor(joined, rate);
      await clip.save(wav);
      execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '48000', wav, join(outDir, file)]);
      rmSync(wav);
      return clip;
    };
    const hissy = () => fileTailHissMs(join(outDir, file), outDir) >= HISS_LIMIT_MS;
    let audio = await make(spoken);
    let ending;
    if (await endsSmooth(spoken) && hissy()) {
      for (const mark of ENDINGS.filter((m) => !spoken.endsWith(m))) {
        audio = await make(withEnding(spoken, mark));
        if (!hissy()) { ending = mark; break; }
      }
      if (!ending) audio = await make(spoken);
      console.log(ending ? `${line.id}: stray hiss, fixed with "${ending}" ending` : `${line.id}: STRAY HISS NOT FIXED ("${spoken}")`);
    }
    rmSync(join(outDir, 'hiss-check.wav'), { force: true });
    // ms is the spoken length; the game uses it to wait for a line before starting the next.
    const ms = Math.round(audio.audio.length / audio.sampling_rate * 1000);
    index[line.id] = { text: line.text, voice, file, ms, ...(spoken !== line.text ? { spoken } : {}), ...(ending ? { ending } : {}),
      ...(partsOf(spoken).length > 1 ? { parts: partsOf(spoken).length } : {}) };
    if (++n % 25 === 0) { console.log(`${n}/${todo.length}`); writeFileSync(indexPath, JSON.stringify(index, null, 1)); }
  }
}
// Drop index entries for lines that no longer exist.
const ids = new Set(lines.map((l) => l.id));
for (const id of Object.keys(index)) if (!ids.has(id)) { rmSync(join(outDir, index[id].file), { force: true }); delete index[id]; }
// rev is a short hash of the clip's bytes. The game puts it in the clip's address, so a
// regenerated clip is a new address and no cache can hand back the old recording.
for (const entry of Object.values(index)) {
  entry.rev = createHash('sha1').update(readFileSync(join(outDir, entry.file))).digest('hex').slice(0, 8);
}
writeFileSync(indexPath, JSON.stringify(index, null, 1));
console.log('done');
