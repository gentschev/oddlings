// Shared check for a stray hiss at the end of a clip. Kokoro sometimes adds a soft "s"-like
// sound after a short phrase: "How many?" came out as "how manies". A line whose last sound
// is a vowel, nasal, l or r should end without hiss.
import { phonemize } from 'phonemizer';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FRAME_MS = 25;
const QUIET = 0.004;           // a frame quieter than this (full scale is 1) is silence
const HISS_PER_SECOND = 4800;  // more zero crossings than this in a second is hiss
export const HISS_LIMIT_MS = 75;
const SMOOTH_END = /[aeiouəɚɝɜɑɔɪʊɛæʌymnŋlɹrwː]$/;

/** True when the text's last sound is one that cannot itself sound like a hiss. */
export async function endsSmooth(text) {
  const phonemes = (await phonemize(text, 'en-us')).join(' ').replace(/[^\p{L}ː]/gu, '');
  return SMOOTH_END.test(phonemes);
}

/** The same measure for a finished .m4a file, decoded at 16 kHz. `tmp` is a scratch folder. */
export function fileTailHissMs(path, tmp) {
  const rate = 16000, wav = join(tmp, 'hiss-check.wav');
  execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEI16@${rate}`, '-c', '1', path, wav]);
  const buf = readFileSync(wav);
  const at = buf.indexOf('data') + 8;
  const pcm = new Int16Array(buf.buffer.slice(buf.byteOffset + at, buf.byteOffset + at + ((buf.length - at) & ~1)));
  return tailHissMs(Float32Array.from(pcm, (v) => v / 32768), rate);
}

/** Length of hiss, in ms, between the last voiced sound and the closing silence. */
export function tailHissMs(samples, rate) {
  const size = Math.round(rate * FRAME_MS / 1000);
  const frames = [];
  for (let i = 0; i + size <= samples.length; i += size) {
    let energy = 0, crossings = 0;
    for (let j = i; j < i + size; j++) {
      energy += samples[j] * samples[j];
      if (j > i && (samples[j] >= 0) !== (samples[j - 1] >= 0)) crossings++;
    }
    const rms = Math.sqrt(energy / size);
    frames.push(rms < QUIET ? 'quiet' : crossings * 1000 / FRAME_MS > HISS_PER_SECOND ? 'hiss' : 'voice');
  }
  while (frames.length && frames.at(-1) === 'quiet') frames.pop();
  let n = 0;
  while (frames.length && frames.at(-1) === 'hiss') { frames.pop(); n++; }
  return n * FRAME_MS;
}
