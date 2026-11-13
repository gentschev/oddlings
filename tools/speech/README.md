# Speech files

From the repository root:

```
pnpm speech:lines
node tools/speech/generate.mjs tools/speech/lines.json public/assets/speech
```

The export uses Vite's TypeScript loader without listening on a port. It includes story,
UI variants, number names, all curriculum questions and corrections, and six effort lines.
Ids are stable and safe as filenames. Re-export after changing strings or curriculum data.
The generator checks the text and voice in the existing index before skipping a recording.

Generation runs outside the Codex sandbox. It uses the separate speech tool's existing
Kokoro setup and macOS `afconvert`. No model downloads or audio generation run in the game.

The index is an object keyed by stable line id. Each entry has `text`, `voice`, `file`
and `ms`, the trimmed clip length in milliseconds. For example:

```json
"praise-0": { "text": "You worked it out!", "voice": "af_heart", "file": "praise-0.m4a", "ms": 1090 }
```

The generator trims silence from both ends and records the resulting duration. The game
preloads `assets/speech/index.json` when Play unlocks audio. Length lookups are synchronous;
an unloaded index, an unknown id or an older entry without `ms` gives zero. Muted speech,
voice off and locked audio also give zero. Missing recordings remain silent.

Automatic game handoffs wait for that length plus the gap in `SPEECH_TIMING`, on the game
clock so manual test advances stay deterministic. The wait has a limit for bad metadata.
Correct-answer feedback also keeps its minimum animation time. Silent or older-index
encounter introductions have a fixed readable interval. A tap can skip an introduction
or interrupt a line. The speaker button repeats the current line and extends an automatic
handoff if needed. Muting the map stops speech. Regenerate clips after changing text;
the catalogue includes one two-line `muddle-{id}` introduction per friend.

## What the generator changes in the spoken text

The on-screen text is never changed. Before a line goes to the speech engine:

- Made-up names are respelled from the `PRONUNCIATION` table in `generate.mjs`
  (check a respelling with `node tools/speech/phonemes.mjs Twoot Twute`).
- The line is closed as a sentence: first letter capitalised, an ellipsis or a missing end
  mark replaced by a full stop. Unclosed short lines picked up stray sounds ("three-uh").
- If the finished clip ends in a hiss the words do not call for, the generator tries other
  end marks (`!`, `.`, `?`, `,`) and keeps the first clean one. The mark used is stored in
  the index as `ending`. This is what fixes "How many?" sounding like "how manies".

## Checking the clips without listening

```
pnpm speech:check                                         # stray hiss at the end of any clip; exits 1 if found
node tools/speech/transcribe.mjs public/assets/speech     # local Whisper transcript of every clip, prints mismatches
node tools/speech/transcribe.mjs public/assets/speech ui- praise-   # only ids with these prefixes
```

`speech:check` is a measurement (zero crossings in the last frames of the clip) and found
exactly the lines a listener reported. The transcript check is weaker: the recogniser
corrects odd sounds toward real words and garbles made-up names and one-word clips, so
read its output as a list of clips worth a listen. The first run downloads the Whisper
model (about 80 MB) from Hugging Face.

## Clip addresses

Each index entry has `rev`, a short hash of the clip's bytes, added by the generator on
every run. The game requests `assets/speech/<file>?v=<rev>`. A regenerated clip therefore
has a new address, and neither the service worker cache, the browser's own cache nor the
host's ten-minute cache can return the old recording under it. The warm-up deletes
addresses that the new index no longer uses. Before this, a clip refreshed within ten
minutes of an update could be stored again as the old recording.
