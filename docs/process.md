# How this project is built

What we have learned about the working process that the code does not show. Written for a
person or an agent picking the project up. Dated entries at the end record where each
lesson came from.

## Roles

- **The owner** sets direction, runs playtests with children of the target age, and
  answers questions of principle. The owner is not expected to review code.
- **Claude Code** (the orchestrator) writes the design documents and briefs, launches
  Codex, reviews its work by running tests and looking at screenshots, generates the voice
  files, and deploys.
- **Codex CLI** does the implementation. `gpt-6.1-sol` at high effort for game and engine
  code. `gpt-6.1-terra` at medium effort for art, using Codex's built-in image generation.
  `gpt-6-luna` is reserved for bulk mechanical work and has not been needed yet.

## Working with Codex

Launch from the repository root, in the background:

```
codex exec -m gpt-6.1-sol -c model_reasoning_effort="high" -s workspace-write -o .codex-runs/<name>.last.txt - < .codex-runs/<name>.md > .codex-runs/<name>.log 2>&1
codex exec resume <session-id> -m gpt-6.1-sol -c model_reasoning_effort="high" -o .codex-runs/<name>.last.txt - < .codex-runs/<name>.md > .codex-runs/<name>.log 2>&1
```

The session id is printed at the top of the log. Resuming the same session keeps what
Codex already knows about the code, which made later briefs much shorter. Briefs, logs and
probe scripts live in `.codex-runs/` (git-ignored).

What a brief needs, learned from the ones that went well and badly:

- The observation, in the words of whoever saw it ("it sounds like 'You can-'"), and the
  cause if it is already known. Codex fixes a stated cause well and guesses badly at a
  vague complaint.
- What has already been changed by someone else, so it does not redo or undo it.
- The acceptance check for each item, as something a test can assert. For anything
  visual, ask for the geometry to be put in `src/game/layout.ts` with a unit test, because
  Codex cannot look at the screen.
- "No network" and "you cannot run a browser", every time. Install any new package
  yourself before the launch.
- The writing rules (plain prose, no em dashes) and the instruction not to commit.
- A request for a final message that lists files changed, what was verified and how, and
  what could not be verified.

What Codex cannot do here:

- **It cannot run a browser.** Chromium does not start inside its sandbox. Every report it
  writes says "not verified in a browser". Treat its work as unverified until the browser
  tests and screenshots have been run outside the sandbox.
- **It cannot reach the network** in the form we launch it. Launching it with network
  access, or running its scripts through a helper outside the sandbox, was blocked by
  Claude Code's permission checks and should not be retried.

## The verification loop

Unit tests pass long before the game is right. The loop that has worked:

1. Codex implements and runs `pnpm lint && pnpm test`.
2. The orchestrator runs `pnpm test:e2e`, then a Playwright probe script that plays the
   game through `window.__oddlings.state()` and saves screenshots at 1280 x 800.
3. The orchestrator looks at the screenshots. Most visual faults were found this way and
   none by tests: floating characters, a card too large for its content, an invisible
   button, a scribble over a character's face.
4. Findings go back to Codex as a review brief with the measured numbers.

Notes on the probes:

- Read control positions and the correct answer from `state()`; do not guess field names.
- Log only when the scene or the on-screen text changes, or the output floods.
- The dev server can serve stale dependencies after Codex runs a build ("504 Outdated
  Optimize Dep"). Restart `pnpm dev`.
- Stepping the game clock by hand renders in software and is slow. `advanceTime` renders
  only the last frame for that reason.
- `ODDLINGS_PREVIEW=1 pnpm test:e2e` runs against the production build and includes the
  offline test. Run it before every deploy.

## Simulate the whole journey, not only the engine

The practice engine had 141 passing tests and a thirty-day simulation, and the game still
dead-ended on the first evening: the path had 11 stops and the gate needed about 35
encounters. Each part was correct by its own specification. Nothing checked that the
content on the map was enough to meet the rule that unlocks the next part.

Before shipping any area, run simulated children (always right, 95%, 85%) through real
encounters and check: how many encounters until the gate opens, how that compares with the
number of stops, and that the map always offers a next action. Keep that as a unit test.

Simulate the unlucky child as well as the average one. The seeded 85% child passed every
placement check and finished the path in six encounters. A 90% child played in a real
browser slipped on both probes of one set, placement stopped for good, and the same path
would have taken dozens of encounters with a progress ring that did not move. Averages hid
it; one concrete save showed it. Keep real saves as fixtures
(`tests/fixtures/save-v1-path-cleared.json`) and play them forward in tests.

Test an update the way it will happen. Before a deploy that changes the save format, play
the currently live version in a persistent browser profile, then load the new build on
top of that profile (`.codex-runs/update-phase1.mjs`, `update-phase2.mjs`). This checks
the migration on a save the old code really wrote, and it is how the pacing fault above
was found.

The same applies to time. Measure how long things take for the child (seconds between
questions, length of an introduction), because a wait that looks fine in a specification
can be a cut-off sentence in practice.

## Voice

Voice lines are generated offline with Kokoro and committed as `.m4a` files. See
`tools/speech/README.md` for commands. What is not obvious:

- Kokoro guesses the pronunciation of made-up names from spelling. Check with
  `tools/speech/phonemes.mjs` and fix by respelling in the `PRONUNCIATION` table.
- Kokoro pads each clip with about 0.35 s of silence before and 0.5 s after. The
  generator trims it. Untrimmed, every line started late and overlapped the next.
- Short lines, lines without end punctuation and lines ending in "?" or "…" can pick up a
  stray sound at the end. "How many?" came out as "how manies". The generator closes each
  line as a sentence and retries with another end mark when it measures a hiss.
- The orchestrator cannot hear. Two substitutes exist: `pnpm speech:check` measures a
  stray hiss at the end of each clip, and `tools/speech/transcribe.mjs` transcribes clips
  with a local Whisper model. The hiss check found exactly the lines a listener reported. The
  transcript is weaker evidence: it corrects odd sounds toward real words and garbles
  names and one-word clips.
- A human ear is the real test. Both audio faults reported after the first playtest were
  real and measurable once we knew where to look.
- The game must never cut off a line by its own action. It waits for the clip length
  stored in the speech index. Only a tap may interrupt.
- A file whose content can change must not keep one address. The first update test left
  an old recording in the device cache because the clip kept its name and the browser was
  allowed to reuse its copy for ten minutes. Clips now carry a content hash in their
  address.
- A full regeneration of about 850 lines takes around an hour on the Mac. Unchanged lines
  are skipped, so normal runs take seconds.

## Art direction

How the look was chosen, how the art is made with Codex, and what went wrong on the way.

### Choosing a look with playtesters

Round one, before the first build. Three style tests of one scene were made
(`docs/art-tests/style-A.jpg` to `style-C.jpg`) for a playtester to choose from. The build
went ahead on the orchestrator's pick (C, screenprint); no playtester had chosen it. The
first playtest verdict was that the game looked like a preschool game. The style was well
executed and aimed at the wrong age. The choice of register (how old the game looks) has
to be made with someone of the target age, before a full set of assets exists.

Round two, for area 2. What was done, and would be done again:

- **Start from the complaint as it was worded** ("more like a preschool game") and turn it
  into qualities to aim for: more adventure, more to discover in a scene, more attitude in
  the characters, still friendly.
- **Three directions that differ in kind**, each given a plain name a child can say:
  Odd Adventure (flat and silly), Mystery Trail (painted and moody), Creature Quest
  (crisp and bright). Shows the audience likes informed the directions, but the prompts
  describe qualities and never name a show or game, both to keep the work original and
  because a named source pulls the image toward a copy.
- **The same scene in every direction**, so only the style differs, and it is a scene
  from the area being built (Twin Falls), so the samples also test the setting.
- **The favourite character alone**, once per direction. A child judges a look largely
  by what happens to the character they like.
- **Shown on one page** (a private Claude artifact; an adult must be signed in on the
  device): large pictures, one sentence each in a child's words, a star button to pick,
  and the game as it looks today at the bottom for comparison.
- **The adult is told what is not final** (wrong dot counts, stray details) and which
  parts really differ between samples, so flaws in a mock-up do not decide the outcome.
- **The orchestrator gives its own view separately and labelled as such.** It favoured
  B. The playtester chose otherwise, and that pick decides.

What the round taught us:

- **A child chooses by parts.** The pick was the backgrounds from C with the characters
  from B's scene. Expect a mix, and ask what they like about each sample, not only which
  one. Next time vary one thing per sample (backgrounds with fixed characters, then
  characters on a fixed background) so a mixed answer is easy to act on.
- **The reasons are the brief.** "Screen print shading, short legs, and side by side dots
  for Twoot" says exactly what to keep. Ask for the playtester's own words.
- **The answer came as a rule, not just a pick:** the characters stay the same in every
  area and the background changes for each new area. That is now the art rule for the
  game, and it is also the cheapest thing to produce.
- Record the decision where the next session will find it: `docs/plan.md`,
  `docs/design.md`, and the orchestrator's memory.

### Making art with Codex

Terra (`gpt-6.1-terra`, medium effort) generates images with Codex's built-in tool and can
look at what it made. It cannot see an image inside the game. The orchestrator looks at
every image itself and again in game screenshots.

What a brief for art needs:

- **Why**, in the words of whoever reported it, and the decision already made.
- **The write boundary.** Art runs may only touch `art/` and `public/assets/art/` (or
  `docs/art-tests/` for samples). Run art before code that depends on the manifest, not
  beside it.
- **References, chosen on purpose.** A reference image dominates the result. The style
  anchor (`art/reference/style-anchor.png`) plus two finished characters kept the first
  cast consistent. In the area 2 samples the existing Twoot was passed as a reference
  "for who Twoot is", and two of the three directions kept Twoot's old print texture even
  though the text asked for a new rendering. If a redraw is wanted, leave the old art out
  or say exactly what to drop. If consistency is wanted, pass it.
- **Exact counts, and an instruction to count.** Ten segments, five arms, six stones,
  three pips. The model miscounts; "count them and regenerate if wrong" catches most of
  it. Twoot's "two dots" came out one above the other in the solo pictures, so say the
  arrangement as well as the number.
- **What the game needs from the picture.** A background is a stage for the interface:
  the ground line at a stated height, a calm centre where the question card sits, calm
  corners for buttons, room under each stone for a label, stones pale enough for a dark
  marker, and no other objects that look like stops. Say all of it.
- **No text, nothing scary, everything original**, every time.
- **A loop:** generate, look, check each requirement, regenerate with a corrected prompt,
  a limit on attempts, keep the best and say what is still wrong.
- **Outputs:** the full-size original and the exact prompt beside it
  (`art/src/<name>.png`, `<name>.prompt.txt`), processing through `art/process.sh`, and
  measured positions written to `public/assets/art/manifest.json`.

Failures we hit and what fixed them:

- **Detail drift.** One character (Moss) came out far more detailed than the rest. A
  contact sheet of the whole cast at one scale showed it at a glance. The fix brief named
  two characters to match and listed what to remove.
- **Wrong animal.** The beetle read as a turtle. Describe the features that make the
  animal (a split down the back, six legs at the sides), not just its name.
- **Transparency.** Check that the file really has transparent pixels. The fallback is a
  flat magenta background removed afterwards, then a check for a magenta fringe.
- **Faint marks.** The ring mark was nearly invisible, was redone, passed a composite
  test on the real background, and still vanished at game size. A small mark that carries
  story meaning is now drawn by code.
- **The map decided the game.** The first map was asked for "room for ten stops" and came
  back with eleven stones, and the stop list was bent to fit. Decide the stops from the
  curriculum first (one per fact set, plus story stops), then demand that exact number
  of stones.
- **Positions are estimates until seen in the game.** Terra measures stone centres,
  panels and eyes with a script and draws a numbered overlay to check them
  (`art/map-stops.py`, `art/map-stops-check.png`). Layout code reads the manifest;
  nothing is placed by eye in a scene. The orchestrator still checks a screenshot.

Standing rules:

- Number patterns are never in the art. The art leaves a blank panel and code draws the
  dots, tiles and segments, so a creature can show any fact. Samples may show dots drawn
  in; production art may not.
- The same characters in every area; a new background look per area. Area 1 is the
  screenprint meadow. Area 2 is crisp line art with cel shading in bright daylight
  (reference: `docs/art-tests/area2/C-scene.png`).
- Samples live in `docs/art-tests/` and are never shipped. Production art goes through
  `art/src/` and `art/process.sh`.

## Playtests

A few minutes of a real child playing found more than all the automated checks: an audio
artefact, a cut-off line, a confusing central concept (the muddle), a button nobody saw, a
dead end, and a story scene that referred to something not shown.

- Ask the person who ran the playtest what they saw and heard, in their words. Short
  reports are enough.
- Reports about sound are reliable; confirm them with the tools above and fix the class of
  problem, not the one line.
- Record each playtest in `docs/plan.md` with what was reported, what was fixed, and what
  is carried forward.
- Things to ask after the next one: does the muddle read now, is "Show me" used, does the
  gate make sense, does the story hold interest.

A later report, "the parent section button doesn't do anything", was a button that needed
a three-second hold and showed almost nothing while held. Its automated test passed
because the test stepped the game clock by hand; in a real browser the game clock ran
slower than real time, so even a deliberate hold could fall short. Two lessons: test a
timed gesture in real time as well as on the stepped clock, and never ship a control that
does nothing visible when it is used the obvious way.

Rules that came out of the first playtest:

- What is drawn must match what has to be done. A stop on a map is one fact set, a map
  has as many skill stops as its area has sets, and each stop shows its own progress.
  Where the number of steps is not known, no steps are drawn. (The owner's instruction
  after the path ran out before the gate opened.)

- Every story beat shows the thing it talks about.
- Every locked thing shows how close it is to opening and what to do about it.
- Every character trait stated in text ("Twoot knows twos") needs a visible consequence
  in play, or it should not be stated.

## Deploying

- Changes go to the `next` branch and the test address at `/oddlings-next/` first. Build
  that bundle with `ODDLINGS_CHANNEL=next pnpm build` for the second Pages site. Test it
  there before moving changes to `main`. Only promote when the owner says so.
- Main builds use `pnpm build` with no channel override and run at `/oddlings/`. The
  test build has its own storage and can copy main progress without changing the source.
- The game is a static site on GitHub Pages: https://gentschev.github.io/oddlings/.
  A push to `main` runs lint, unit tests and the build, then deploys.
- The repository is public because Pages is not available for private repositories on
  the owner's plan. Commits use a GitHub no-reply address. Personal notes and addresses
  are kept out of the repository and its history; keep it that way.
- Push over SSH. The `gh` HTTPS token cannot push workflow files.
- The tablet picks up a new version on a later launch with a connection. The installed
  app must be opened from Chrome's install, since Samsung Internet keeps separate data.
- Before pushing: `pnpm lint`, `pnpm test`, `pnpm build`,
  `ODDLINGS_PREVIEW=1 pnpm test:e2e`, `pnpm speech:check`, and a look at fresh screenshots
  of anything that changed. After the deploy, load the live site and play one encounter.
- A player's progress is stored only on their device. A change to the save format needs a
  migration and a test with an old save.

## Log

- 2026-11-12. Project started. Stack and delivery chosen from research. First playable
  build deployed the same day. First playtest. M6 and M7 fixes from it. This document
  written.
