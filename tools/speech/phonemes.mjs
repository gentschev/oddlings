// Prints the phonemes the speech engine will use for each argument, so a name's
// pronunciation can be checked (and a respelling tried) without listening.
// Usage: node tools/speech/phonemes.mjs Twoot Twute "Fivel feels better!"
import { phonemize } from 'phonemizer';

for (const text of process.argv.slice(2)) {
  console.log(text.padEnd(28), (await phonemize(text, 'en-us')).join(' '));
}
