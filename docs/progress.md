# Progress log

Newest entry first.

## 2026-11-12: M1 loose ends and M4 installable build

Fixed blob/data URL accounting in the browser test and made the story helper wait for
the entering scene before advancing dialogue. Matched and blended the meadow's lower
edge, restored a full-width top-anchored map with recalculated touch targets, moved the
marker above its stop and hid that stop's glyph. Capped numbered reward speech at 20;
the exported catalogue now has 839 lines. The title's hold opens a changing multiplication
gate and links to the existing parent page. Added a recovery-date banner without
rewriting the parent area. No misplaced parent tests were present.

Built both HTML entries with relative paths, shared bundled font CSS, the fullscreen
landscape manifest and three locally composed Tenny icons. Added generated Workbox
precaching for the shell, art, fonts and parent page, with content revisions for un-hashed
assets. Speech is excluded from install: CacheFirst supports audio ranges, and a
three-request background warm-up fetches the index after launch, rejects HTML fallbacks
and refreshes changed recordings. Worker updates leave the current game open.

Added optional Play-time fullscreen, audio resume, wake lock and persistent storage;
visibility reacquisition, back-gesture protection, safe-area CSS and a portrait overlay.
Save storage retains three prior UTC-day snapshots, skips corrupt copies, heals from the
newest valid backup and preserves a parent-visible restoration date. Added fake-storage,
device and speech-cache tests. Added production preview, artifact validation, documented
commands and a Pages workflow. Nothing was committed, pushed or deployed.

Verified: `pnpm lint`, `pnpm test` (122 tests in 16 files, including all parent tests),
`pnpm build`, speech export, script syntax and Playwright discovery (7 tests). The build
checker confirms index.html, parent.html, manifest, worker, icon sizes, 32 relative
precache entries and no speech precaching. Builds succeeded both before and after speech
files appeared. Generated icons were inspected as images. One simulation run exceeded
its 30-second timeout during contention; limiting Vitest to two workers produced a clean
rerun with the same timeout and assertions. The Phaser chunk-size warning remains.

Not run, as instructed: browser tests, game screenshots, Lighthouse, offline installation,
Android feature checks or the deployment workflow. M4 device acceptance and the revised
visuals still need the reviewer. Speech recordings are being generated separately.

## 2026-11-12: M1 review fixes

Manual clock advances keep frame-sized logic steps and render only the final frame,
using the installed Phaser 4 headless step. Added 90-second test timeouts and two-minute
suite/capture budgets. Rebuilt encounter bands with a cream pad tray, 96 px buttons,
112 px equations, 56 px frame cells and 48 px counting dots. Grounded the cast, enlarged
the surrounding muddle, removed name labels, enlarged panel pips, flattened ground clues,
and moved reward bursts outside the number panel. The map fits the complete image, uses
speech-bubble story icons and a round bottom-corner mute button, and keeps the marker at
the saved stop. Play text is 56 px. Encounter hooks expose readable text without blanks.

Placement now uses two hardest probes, advances sets within an encounter, waives the
known-fact quota while probing, and limits provisional confirmations to two, including
replays. Added pace regressions for addition above five within 12 questions and all area 1
placement within 30. Updated the Placement specification. The 30-day simulation retains
its existing accuracy and mastery assertions: 2,825 questions, 93.86% acquisition accuracy,
all sets accurate by day 24.

Added lazy local speech, interruption, missing-file handling and repeat buttons. Exported
1,452 stable speech ids to `tools/speech/lines.json` with `pnpm speech:lines`, using Vite SSR
without opening ports. Recording generation remains the reviewer's separate step.

Verified: `pnpm lint`, `pnpm test` (112 tests in 13 files), `pnpm build`, speech export,
both script syntax checks and Playwright discovery (5 tests). Geometry tests cover plain
and modeled layouts for every starter/wild pairing, bounds and overlaps, the actual pad
rectangles, large models, ground anchors and map fit. Speech tests cover catalogue coverage,
interruption and absent recordings. The existing Phaser bundle-size warning remains.

Not run: browser tests or screenshots, as instructed. No browser launch was attempted.
Visual fit, actual speech playback and the under-two-minute browser/capture target still
need the reviewer's run. No audio recordings were generated in this sandbox.

## 2026-11-12: M1 playable loop with supplied art

Built preload, title, partner choice, the 11-stop Pebble Path and arch, welcome and
ring stories, camp, warm-up, encounters and rewards. Added Baloo 2 loading and notice,
reusable picture models and answer pad, code-drawn creature patterns, idle motion,
helping moves, puffs, effects, synthesised audio and map mute. Core drives questions,
hints, corrections, timing and progress. Replays practise existing facts without new
placement probes. Saves are queued after encounters and story stops, with a retry panel
if both storage copies fail. Hooks expose every scene, map stops and encounter input.

Verified: `pnpm lint`, `pnpm test` (88 tests in 9 files) and `pnpm build` pass.
The M0 simulation still passes unchanged. `pnpm exec playwright test --list` discovers
5 tests in 2 files; `node --check tools/screens.mjs` passes. Browser coverage includes
three encounters and a correction, reload, replays, hint timing, touch, camp, ring and
mastery gates. `pnpm dev` then `pnpm screens` captures every screen, all starter panels,
rewards and key encounter states, plus prepared examples of each picture model, into
`test-results/screens/`.

Not run: `pnpm test:e2e` and `pnpm screens`, as explicitly requested because Chromium
cannot launch in this sandbox. No browser launch or network workaround was attempted.
No in-game screenshots were captured or visually verified. Inspected the supplied
contact sheet, character images and backgrounds only. The manifest records source-image
segment centres and the arch hotspot; panel and eye estimates still need in-game
screenshot review and correction. Layout, touch behavior, audio, persistence in a browser
and tablet frame rate remain unverified. Recorded speech is not included. The production
build retains Vite's nonfatal large-chunk warning for Phaser. M1 browser acceptance is
pending the reviewer's test run and screenshot review.

## 2026-11-12: M0 foundation

Built the pnpm/Vite/strict TypeScript scaffold with Phaser 4.2.1, Playwright 1.65.0,
Vitest and typescript-eslint. Added 329 shared facts, all 27 sets with explicit prerequisite
edges, models and worked examples; learner, planner, retry and encounter state; placement,
mastery, sessions, seeded randomness, validated versioned saves and a v0 migration scaffold.
Added IndexedDB storage with a localStorage copy, the title/map boot placeholders, URL flags
and deterministic clock/state hooks. The existing taxonomy was kept unchanged.

Verified: `pnpm lint`, `pnpm test` (81 tests in 7 files) and `pnpm build` pass. The
default eight-slot, 30-day simulation answers 2,835 questions in ten-minute sessions,
reaches every set's level 2 by day 24, and has 93.98% accuracy across acquisition days
after day 2. Every day's accuracy stays above 75%. Its report is saved to
`test-results/simulation.json`. Tests cover the curriculum graph and exact set contents,
scoring, review ladder, acquisition across encounters, retries, planner constraints,
placement, mastery, logs, import validation and migrations.

`pnpm test:e2e` attempted the one smoke test. Vite bound port 5199, but cached Chromium
could not launch: macOS denied `bootstrap_check_in` for its MachPortRendezvousServer
(Permission denied 1100, SIGTRAP). No browser was installed. The test captures title and
map-placeholder screenshots at 1280 x 800 when run outside the sandbox; screenshot
capture and visual inspection remain unverified here. The build has Vite's nonfatal
large-chunk warning for the Phaser bundle. The playable screens remain M1 work.

### Spec deviations

- A hard daily 95% accuracy ceiling conflicts with random fluctuations and known-only
  review after mastery. The simulation asserts the 75% daily floor and the 75% to 95%
  range across acquisition days after day 2. It reports all days, including review days
  above 95%, without forcing the child to make errors.
- Shared facts can make a later set accurate before its teaching turn. For example,
  within-5 facts can be mastered while larger plus-two facts are still being learned.
  Levels keep their stated fact-based definition. Teaching completion is recorded as
  the completed prefix in teaching order, with prerequisite checks still controlling
  new introductions. Incidental mastery is not erased to impose an artificial order.
- "Known facts are not asked more than review requires" conflicts with the planner's
  70% known quota, known first/last questions and always-play fallback. Known filler is
  permitted in least-recently-seen order and logged separately from scheduled due
  reviews. The simulation verifies that correct early practice never advances a
  ladder or postpones a due date. Its run includes 923 optional filler responses.
- When every available known fact is due, the 60% due cap and 70% known floor cannot
  both hold. The planner exceeds the due cap only when the other pools cannot fill
  a slot, taking unused due facts first so it can always finish a plan.
- Quick reviews could remove all puffs before reaching planned learning slots. The
  final puff now stays until the planned questions have had a turn. Misses can extend
  an encounter until the meter clears. A ready correction retry takes precedence over
  the preview's known-fact quota and boundary preferences; otherwise a missed review
  could wait too long to return. Regression tests exercise both cases.

2026-11-12: Generated the first art set with the approved style anchor, source prompts, processing script, estimated panel and eye coordinates, and contact sheet. Reviewed each image and the contact sheet; verified transparent PNGs with ImageMagick and Nought's transparent hole. Lint passed; unit tests failed because no test files were present when run. Art is not yet wired into scenes, so an in-game Playwright screenshot remains for integration. Bix's square panels sit on a single shell rather than distinct wing cases; Moss's book appears open, and the ring mark is very faint.

## 2026-11-12: third review, practice pacing and the collection

Placement now gives a missed set a delayed, different recheck; only a second probe miss
stops it. Missed facts keep their learning and correction retries, including across saves
and overlapping sets. Older single-miss saves get the same second chance. Selected
practice slots now spread unknown facts between known ones while preserving retry priority
and answer variety. Updated both specification sections and removed the clustering item.

Added the Oddbook from map and camp, six patterned cards, unknown silhouettes, honest
accurate/fluent bars from explicit core mappings, name/description playback, partner
switching and persistence. Camp has a grounded, varied team row with phased idles,
tappable hops and hearts, its two equal choices, and the book. Added scene hooks, geometry
checks, a partner-switch e2e test and screenshot cases. Parent skill-tree layers now use
longest paths and barycentre ordering, with fanned curve attachments and clear lanes past
unrelated nodes. Restored saves show a dated recovery banner.

Verified: pnpm lint, pnpm test (141 tests), pnpm build and production artifact checks pass.
Geometry tests cover every partner, the cards, camp controls and downward parent edges,
including sampled curves staying outside unrelated nodes. The 30-day simulation answers
2,835 questions, reaches all sets accurate by day 21 and has 93.38% acquisition accuracy.
pnpm speech:lines exports 847 lines. Playwright test discovery lists all 8 tests successfully.

Not run: browser e2e, screenshots, offline/install checks or tablet checks, as requested.
No browser or network workaround was attempted; no new screenshots were visually verified.
The reviewer must check layout, art panels, touch, speech and the new partner loop in the
browser. Eight new UI/description recordings are absent and need external generation from
the exported catalogue; missing recordings are silent. The existing nonfatal Phaser chunk
size warning remains. No requested implementation was skipped.

## 2026-11-12: M6, first playtest fixes

Added synchronous speech-length lookups and index preload on audio unlock. Automatic
handoffs use the game clock, a 160 ms gap and a 6 second limit. Correct feedback now
shows its spoken effort line, or "A big hop!" for quick answers. The final answer speaks
only the clear line, and waits before reward. Speaker repeats extend pending handoffs.

Speech audit: encounter feedback and clear-to-reward used fixed delays and could cut
clips off; both now wait. Oddbook name-to-description used audio end events without the
game-clock gap; it now waits and cancels the old sequence on another tap. Warm-up left
its prompt playing during the delay after an answer; it now stops at the child's tap
and protects any repeat before the next prompt. Reward only speaks its join/friend line;
its timed celebration does not stop speech and leaving requires a tap. Camp names and
story advances require taps. Title has no automatic spoken sequence. Panels follow taps
or a failed save; button and map taps now stop speech immediately, before asynchronous
walking or saving, and encounter save panels follow the completed clear wait.

Changed count prompts to "How many dots?" without reducing the 64 px count font. Made
"Show me" sunflower with a navy lightbulb, outline and text. The 200 px button stays in
place and clear of the tray, including its pulse. Moved the small cloud above the head,
using manifest features. Cream slots now collect coral dots; they fly to the friend
before its pattern returns, cloud pops and it hops. Added the skippable two-line
introduction, hidden pad, replay skip, and intro/slot/restore hooks. Updated design,
speech docs, e2e helpers and screenshot cases. Other screen styling is unchanged.

Verified: pnpm lint, pnpm test (146 tests), pnpm speech:lines (853 lines), pnpm build and
production artifact checks pass. Unit tests cover durations, mute/voice/lock states,
waits and limits, slot fill/empty logic, delivery under 700 ms, cloud clearance from all
six faces/panels, and hint clearance. ImageMagick font metrics measured the count label
at 452 px wide, inside its 596 px area. Playwright discovery lists all 10 tests.

Not run: browser tests or screenshots, as requested. No in-game screenshot, listening,
touch or tablet verification was possible here. The reviewer must check introduction
input/timing, speech after clip regeneration, hint readability and dot-flight animations.
No audio was regenerated and no browser, network or package workaround was attempted.
The user's speech generator and separate speech-analysis scripts were left untouched.
The existing nonfatal Phaser bundle-size warning remains. Nothing requested was skipped.

## 2026-11-12: M7, gate progress and a path that stays useful

Separated passed sets from confirmed levels. Review facts, including provisional ones,
can pass a set for prerequisites and gates. Failed checks can unpass it, but a gate walked
through stays open. Parent set rows say "placed, being checked" while levels, growth and
Oddbook bars keep counting confirmed facts. Provisional checks now follow teaching order,
hardest first within each set. Added nine gate lamps, a two-line instruction panel, and
reward speech for lamps gained, after the friend and practice lines without interrupting
them. The lamp message uses the progress label in turn to keep two narrative lines visible.

After every stop is cleared, up to three returning muddles pulse with pal/cloud glyphs.
A pure selector ranks unfinished pal facts, breaks ties by stop order, and excludes the
last completed muddle. Rotation survives saves and uses position as an older-save fallback.
Returning replays retain collection progress and use ordinary practice so later sets still
open; other replays remain review-only. Added the "in a muddle again" intros and hooks.
The four-line ring beat now points to the ground, identifies the mark and missing bun,
and asks who made it. The 180 px mark sits between both facing characters, clear of the
panel, and pulses on line 2. Welcome lines were left unchanged.

Replaced zz-gate-sim.test.ts with a silent real-encounter regression using the scratch
simulation's seeds, latencies and six/eleven-per-day profiles. Before, as measured in the
review: always-right fast 35 encounters / 280 questions; 95% child 36 to 40 / 305 to 338;
85% child 42 to 46 / 398 to 436. After: always-right fast and slow 3 / 24; 95% child
5 / 45 in both schedules; 85% child 6 / 58 in both schedules. The first two assert the
nine-encounter target. Full results are in test-results/gate-simulation.json. The current
path actually has eight muddle stops, plus two stories and a camp; these results fit it.

Verified: pnpm lint, pnpm test (155 tests), pnpm build and production artifact checks pass.
Tests cover passed/confirmed separation, lapses, permanent gate access, parent labels,
confirmation order, rotation, save compatibility, lamp geometry and ring clearance for
all partners. The 30-day simulation still passes, reaching all confirmed sets by day 18
at 93.43% acquisition accuracy. pnpm speech:lines exports 864 lines. Playwright discovery
lists 12 tests, including returning muddles, lamp gains and all four ring lines. Updated
the screenshot driver for returning stops and lamp rewards; its syntax check passes.

Not run: browser e2e, screenshots, listening, touch or tablet checks, as requested. No
in-game screenshots were visually verified. Lamp readability, ring visibility/highlight,
reward speech sequencing and returning-muddle interactions need browser review. No audio
was regenerated, and no browser, network or package workaround was attempted. Kept the
M6 empty-slot fade, cloudMinScale 0.55, speech:check script and speech README additions.
The existing nonfatal Phaser bundle-size warning remains. Nothing requested was skipped.

## 2026-11-12: M8, skill stops match the learning journey

Replaced encounter stones with nine area 1 skill stops and two stories in the eleven
art slots. Added sticky path sync, exact per-set progress, learning/due help rules,
first-stop pal joins, temporary helpers when the partner is muddled, and matching
Oddbook ownership. Kept passed sets, teaching-order checks, parent wording and the ring
story. Removed lamps, lamp rewards and the arbitrary returning-muddle picker.

The map shows pal states, coral progress rings, skill tags and stars. Changed progress
animates with a bounded marker walk and tap-to-skip. The gate requires the whole path,
then offers ordinary later-set practice with rotating joined pals and no extra stones.
The house opens camp; rewards offer it once per session after ten minutes. Rewards name
actual path completions, including cascades. Added the home rectangle to the manifest.
Save version 2 validates and migrates version 1 without changing the original learner
fields or team, drops old stop ids and derives the new position. Old backup decoding
continues through the same migration. Normal load sync also records new completions.
Passed work behind an unseen story stays stored and visually locked until it is seen.

The real-encounter journey simulation reports these encounters at each current skill:

| Skill | Always right | 95% | 85% |
|---|---:|---:|---:|
| see-dots | 1 | 1 | 1 |
| see-frame | 0 | 2 | 2 |
| add-plus0 | 0 | 0 | 0 |
| add-plus1 | 1 | 0 | 0 |
| sub-minus01 | 0 | 0 | 1 |
| add-plus2 | 0 | 1 | 1 |
| add-within5 | 0 | 0 | 0 |
| sub-within5 | 1 | 1 | 0 |
| sub-minus2-all | 0 | 0 | 1 |

Totals: 3 encounters / 24 questions, 5 / 45, and 6 / 58. Zero means that skill passed
while another stop was current. The always-right path is below nine encounters; the
85% child's maximum is two encounters on one skill, below twelve. Full seeded results
are in test-results/path-simulation.json. The existing 30-day simulation still passes.

Verified: pnpm lint, pnpm test (157 tests), pnpm build and production artifact checks,
and pnpm speech:lines (871 lines). Tests cover stop order and pal ownership, cascades,
sticky completion, help thresholds, helpers, camp timing and three old-save cases,
including an already-seen gate. Geometry tests cover tags, neighbour targets, house,
markers, stroke width and the animation time budget. Playwright discovery lists 13 tests;
updated cases cover cascading completions and marker arrival, the gate panel and house.
The screenshot driver follows the new flow and passes its syntax check.

Not run: browser e2e, screenshots, real IndexedDB migration on the tablet, listening or
touch checks, as requested. No in-game screenshots were visually verified. Tag and ring
readability, animation/skip behavior, gate practice and camp flow need browser review.
Speech was exported without regenerating recordings. No browser or network workaround,
package installation, commit or deployment was attempted. The existing nonfatal Phaser
bundle-size warning remains. No requested implementation was skipped.

## 2026-11-13: M9 introduction history and joining rewards

Added `team.helped` to save version 2. It records only cleared muddles, not placement
joins or started encounters. Version 1 migration infers it from old team members other
than the partner. Later stops and gate practice use this history for "again"; ordinary
replays still skip the intro. Multi-stop rewards now show all new pals, up to four
portraits, with the joining count on a second line and facts below. Speech waits between
each line, including after a repeat tap. Added joining clips for counts two through five
to the catalogue. Kept the reviewed ring ellipse, pulse and yellow full progress rings.

Verified: `pnpm lint && pnpm test` passes all 160 tests. Tests cover fresh and migrated
help history, cascading joins without help history, later introductions, reward wording,
and portrait bounds including hops, text, buttons and the four-portrait limit. Updated
the stale ring test to check the actual ellipse instead of its empty bounding-box
corners; its pulse also stays clear of the dialogue. `pnpm build` and production artifact
checks pass. `pnpm speech:lines` exports 875 lines. Playwright discovery lists 13 tests;
the fresh-game test now checks both new pals, saved help history, and first introductions
for Inch and Fivel at their later stops. The screenshot driver captures grouped rewards
and passes its syntax check. MapScene and StoryScene hashes are unchanged.

Not run: browser e2e, screenshots, listening or tablet migration checks, as requested.
Reward spacing, actual font bounds and speech handoffs need browser review. No audio
was regenerated and no commit was made. The existing Phaser bundle-size warning remains.
No requested implementation was skipped.

## 2026-11-13: M10 checks and visible learning progress

Replaced the global placement latch with saved per-set checks and independent recall
streaks. Old stopped saves keep their evidence; later sets still get checks, including
sets with shared facts already seen elsewhere. Added plain-first decisions from session
accuracy, fast independent acquisition, the 0.4 known share, and part credit for learning
streaks. Missed facts keep their correction route. Plain checks can test knowledge outside
the teaching window; older lapses do not fill a new set's window. Learning and fresh
checks share the available slots, and live retries move displaced learning into filler.
Rewards name the current pal's progress and use the existing speech waits. Added six
`better-{id}` clips to the export. Kept the reviewed ring, map colours and reload warm-up
fix. Updated the engine and design documents, including the limits of the evidence.

Measured with real encounters, planning seed 7 and child seed 11. The fixture child slips
once per ten scored questions. The other profiles use seeded draws, with forced misses
on both plus-zero probes for the two able children. The learner knows early facts at 97%;
other facts start at 40% and gain 25 points per scored exposure, capped at 97%. Corrections
do not count as exposures. The stopped fixture's old ordinary planner was also measured
with the same regular slips. Baselines were stopped at 160 encounters without clearing
the path; those are lower bounds, not completion times.

| Child | Before: encounters / questions, unfinished | After: encounters / questions |
|---|---|---|
| Migrated fixture, 90% | 160 / 1281 | 4 / 32 |
| 95%, forced plus-zero misses | 160 / 1287 | 9 / 72 |
| Same child, 6 s answers | 160 / 1351 | 10 / 89 |
| Learner | 160 / 1284 | 10 / 88 |

Encounters spent at each skill stop, after the change. Zero means already complete or
completed through work at another stop.

| Set | Fixture | Forced misses | Slow | Learner |
|---|---|---|---|---|
| see-dots | 0 | 1 | 1 | 1 |
| see-frame | 0 | 0 | 2 | 0 |
| add-plus0 | 1 | 6 | 4 | 1 |
| add-plus1 | 0 | 0 | 1 | 5 |
| sub-minus01 | 1 | 1 | 1 | 0 |
| add-plus2 | 1 | 0 | 0 | 0 |
| add-within5 | 0 | 0 | 0 | 0 |
| sub-within5 | 0 | 0 | 0 | 1 |
| sub-minus2-all | 1 | 1 | 1 | 2 |

The 200-encounter random-pad safety test passes without an entry or streak pass. The
plus-zero versus plus-two safety test passes. The existing all-correct/95%/85% journey
regression passes, including its old per-stop limits. The 30-day simulation still passes
its original accuracy and curriculum bounds: 2856 questions, 93.59% acquisition accuracy,
and confirmed curriculum completion on day 22, versus 2839, 93.43% and day 18 before.
Confirmed progress now includes the different mix of provisional checks; no simulation
threshold was relaxed. Results are under test-results/m10-*.json and simulation.json.

Verified: lint, build and production artifact checks pass. Speech export has 881 lines.
Playwright discovers 14 tests, including a new migrated-stop reward case. Unit tests
cover old version 1 and 2 recovery, per-set checks, streak evidence, plain first, direct
acquisition, quotas, save validation, progress and reward text.

Known failure: the requested strict learner progress assertion fails once. At encounter
10 on minus-two, progress is already 1 before four different learning facts are answered
correctly, and stays 1. The specified part-credit formula can saturate before the review
ratio passes. A capped value cannot rise again; completion must still use set mastery.
Kept the strict assertion and added a separate passing test for the specified cap and
completion rule. Asked whether the increase assertion should apply only below 1. The
last full run has 178 passing tests and this one failure; it has not been weakened.

Not run: browser tests, screenshots, listening, installed-app or tablet checks. These
need the reviewer. No audio was regenerated, no packages were added and no commit was
made. The existing nonfatal Phaser bundle-size warning remains.

## 2026-11-13: M11 Twin Falls and areas as data

Built the area registry and removed area-specific stop ids from scene and path logic.
Twin Falls has six stones, three skills, Twoot as guide, and the falls, den and mist
beats. Domi hosts doubles and halves; Twoot now owns near doubles in the Oddbook.
Path sync records eligible stops across both areas. Earlier gates lead to the next map;
the last gate keeps offering practice. The return arch walks back, shows a cloud when
older practice needs help, and stays clear of the relocated Oddbook button. Camp and
rewards use the current area's scenery. Boot's manifest loader includes the three new
backgrounds, which also ship in the offline precache.

Ground-line placement and bottom-colour blending now share one helper. Twin Falls rings
use each stone's radii with a uniform stroke. In the den the page, outline and rock stay
above the dialogue, clear of both pals. Walls sparkle, the page pulses, and Nought
appears over the waterfalls, then leaves before the last line. Hooks expose the area,
background, speaker, listener and clue states. The screenshot driver covers both areas,
arches, camp, all new story lines, last-gate practice and the older-review reminder.

Kept save version 2 because its shape already supports area navigation: `map.area`
selects the visible map and `story.completedBeats` records walked gates. The existing
`gate` beat means gate one. Old gate-practice evidence also restores that access when
the marker is absent. Tests preserve the real version 1 fixture's 65 responses and
learner evidence, and a version 2 save's gate-practice counter, team, facts and logs.
The supplied art and manifest were not edited. Character rendering changed only its
shared-data import. The reviewed `stopProgress` implementation, revisioned speech URLs,
speech cache and reload warm-up fix are preserved. Pebble Path reuses its live `ui-map`
heading clip; the new heading and stories have new ids.

Journeys use real encounters with the existing seeds and child models. Both maps finish:

| Child | Encounters | Questions |
|---|---|---|
| Migrated fixture | 5 | 41 |
| Able child with forced plus-zero probe misses | 10 | 80 |
| Learner | 15 | 129 |

Encounters at each skill stop. Zero means already passed or completed through another
stop. Story stones add no encounters.

| Area and set | Fixture | Able | Learner |
|---|---|---|---|
| Pebble Path: see-dots | 0 | 1 | 1 |
| Pebble Path: see-frame | 0 | 0 | 0 |
| Pebble Path: add-plus0 | 1 | 6 | 1 |
| Pebble Path: add-plus1 | 0 | 0 | 5 |
| Pebble Path: sub-minus01 | 1 | 1 | 0 |
| Pebble Path: add-plus2 | 1 | 0 | 0 |
| Pebble Path: add-within5 | 0 | 0 | 0 |
| Pebble Path: sub-within5 | 0 | 0 | 1 |
| Pebble Path: sub-minus2-all | 1 | 1 | 2 |
| Twin Falls: add-doubles-small | 0 | 0 | 3 |
| Twin Falls: add-near-doubles-small | 0 | 1 | 0 |
| Twin Falls: sub-halves-small | 1 | 0 | 2 |

Verified: `pnpm lint && pnpm test`, `pnpm build`, and `pnpm speech:lines` pass. All 192
unit tests pass. New tests cover registry and curriculum order, stone counts, ownership,
cross-area completion and navigation, listeners, save compatibility, map geometry and
den/shape placement. The able child finishes below the 16-encounter limit, and the
learner's longest Twin Falls stop takes three encounters, below the limit of fifteen.
The 30-day simulation is unchanged: 2856 questions, 93.59% acquisition accuracy and
confirmed completion on day 22. Production checks verify 35 relative precache entries,
including the new backgrounds. Speech export has 900 lines, including counts for up to
twelve cleared skill stops. Playwright discovers 16 tests; browser tests were not run.
The screenshot script passes its syntax check. Lint now excludes the already git-ignored
.codex-runs scratch probes after an unused import there blocked the normal command.

Not verified: in-game screenshots, browser flow, audible handoffs, real IndexedDB on the
tablet, offline/install behavior and frame rate. Only the supplied source images were
visually inspected. The reviewer needs to check the den, mist, map alignment, touch
sizes and speech. No requested implementation was skipped. No audio was regenerated,
no packages were added and no commit was made. The existing Phaser bundle-size warning
remains nonfatal.

### 2026-11-13: M12, reached areas and the mist shape

Path sync now completes stops and joins pals only in reached areas. Encounter rewards
and load sync stay on their own map. Walking through an arch syncs the destination,
animates ready stops, then shows one spoken joining panel after the map heading finishes.
Completed skills can show their stars behind an unseen story, but the story remains
current and later stops remain locked. Returning or reloading does not repeat the panel.
Facts and set evidence are unchanged. Nought is now 210 px wide at 0.75 alpha, with a
larger cream mist puff at 0.55 alpha. Both bob and drift away together.

Verified: `pnpm lint && pnpm test`, `pnpm build`, and `pnpm speech:lines` pass. All 197
unit tests pass, including reached-area completion, ordered arrival and joining, local
reward changes, version 1 and 2 imports, and mist geometry. Journey results are unchanged:
fixture 5 encounters / 41 questions, able child 10 / 80, learner 15 / 129 across both
areas. Per-stop counts remain those in the M11 table. Production checks pass with 35
relative precache entries. Speech export has 900 lines. Playwright discovers 17 tests,
including known-doubles arrival, a joining panel and reload without a repeated panel.
The screenshot script passes its syntax check and includes the arrival panel and stars.
The reviewer scratch test is excluded from standard checks and was left untouched.
The title tap and the reviewer's gate-panel polling are preserved.

Not verified: browser tests, screenshots, audible handoffs, tablet storage, offline or
install behavior. The reviewer must check the arrival animation and panel, and the mist
shape against the waterfalls. No browser was started and no network was used. No audio
was regenerated and no commit was made. The existing bundle-size warning remains.

### 2026-11-13: M13, offline readiness and faster voice downloads

The title and parent settings now show stored voice counts and offline readiness from
one status module with a pure reducer. Ready requires every indexed clip, a finished
pass and a controlling worker. Unsupported browsers and development hide the status.
The hook exposes offline counts and the build version. Downloads use six low-priority
requests and 10 ms pauses. Interface clips come first, followed by the current area's
stories, pal lines, unfluent fact reads and corrections, then the rest. Returning from
the background retries incomplete passes without overlapping them.

Failed replacements keep their older recordings. Playback errors try the speech cache
for the same file and site path, ignoring only the revision query. Object URLs are
released on completion or interruption, and another tap cancels pending fallback.
Playback can also read the warm-up index if its ordinary request fails. The parent
footer shows the UTC build date and commit, and a new section explains local saves,
shared devices, exports, GitHub Pages requests and the full-download requirement.

Verified: `pnpm lint && pnpm test`, `pnpm build`, and `pnpm speech:lines` pass. All 220
unit tests pass. New checks cover partial counts, readiness, worker control, visibility,
priority order, concurrency, failed writes, cached playback, cancellation, version
fallbacks, the storage explanation and title geometry. Replacement tests now require
preserving old audio on failure rather than deleting it before download. Production
checks verify 35 relative precache entries and speech exclusion. The built JavaScript
contains version `2026-11-13 · 805d31e` with no unresolved version placeholder. Speech
export is unchanged at 900 lines. Playwright discovers 18 tests, including a held
download, live title status, offline parent counts and screenshots of both statuses.

Browser tests and screenshots were not run. Download speed, audible fallback, real
worker/cache behavior and tablet layout still need the reviewer's browser. No network
was used, no audio was regenerated and no commit was made. The existing bundle-size
warning remains nonfatal.

### 2026-11-13: M14, download voices in a dedicated worker

Voice warm-up now runs in a bundled module worker using the existing cache loop, six
low-priority requests and no download pauses. The page sends its base address and ordered
clip ids. Progress is limited to one message per 250 ms plus a final update. A pending
update still flushes if the next download stalls. Each pass terminates its worker; an
unavailable worker, startup failure or runtime error falls back to the page after
termination. Passes never overlap, and the existing hide/show resume rules remain.
The cache loop and its existing tests were not changed. The missing Vite build-version
define was restored to keep the M13 footer and hook working.

The reviewer's measurements for 900 clips in a fresh local production browser:

| Where downloads run | Time |
|---|---|
| Game page, six at a time with 10 ms pauses | 111 s |
| Same page with cache expiration removed | 116 s |
| Dedicated worker prototype, six at a time, fetch then cache.put | 18 s |

These are the supplied measurements, not timings of this patch. Cache expiration stays
enabled. The production test now checks every indexed clip in the cache after ready,
then opens the parent page offline. The held-download case checks the same cache rule.

Verified: lint and the production build pass. All 36 focused cache, status, support and
worker tests pass, including 15 new worker tests. The full run passed its other 232
tests but timed out in the unchanged 30-day simulation (30-second limit) and random-answer
safety simulation (60-second limit). A one-worker retry had the same two timeouts. Both
runs also reported a Vitest onTaskUpdate timeout. No assertions or timeout limits were
changed. The final focused run includes the added stalled-download regression.
Static checks verify the relative worker reference, its inclusion among 36 precache
entries, speech exclusion and no page globals in the worker bundle. The build version
is injected. Playwright discovers 18 tests; browser tests were not run.

The reviewer still needs to measure the real download time and run the production
cache/offline tests. No browser or network was used, no audio was regenerated and no
commit was made. The existing bundle-size warning remains nonfatal.

### 2026-11-13: M15, isolated test channel and Home Screen prompt

Builds select main or next through `ODDLINGS_CHANNEL`. Main keeps its deployed names;
next suffixes save, backup, database, session and cache names with `-next`. This includes
Workbox's fixed expiry database and generated precache. Its modified runtime gets a new
content hash. An empty next store can read and migrate a copy of main progress without
writing, repairing, creating or upgrading main storage. Existing test saves and backups
block automatic copying. The next parent page offers a confirmed copy again and reports
when no valid source exists. The next title, parent header and manifest identify the
test version, and the hook exposes the channel.

iPhone, iPod and iPad browser tabs, including an iPadOS Mac identity, get an unspoken
Home Screen prompt under offline status. Installed launches and other platforms hide
it. The parent page explains the steps and Safari's retention rule. The owner promotes
changes through the next branch and test address before approving main. Public prose
uses roles, and README attribution uses the project name.

Verified: `pnpm lint && pnpm test` passes with 259 tests, including 24 new channel,
read-only source, build-isolation, detection and layout cases. Tests pin main names,
preserve source bytes during copying and migration, and keep resets and backup cleanup
inside their channel. Main, next and final main builds pass. Static checks verify both
manifest names, runtime caches, expiry databases, relative worker references and 36
precache entries. A fake worker probe checks the bundled worker's actual cache name.
`dist/` is the main build. The original browser tests are unchanged; discovery finds
20 tests including two new install-prompt cases with screenshot steps.

Not verified: browser tests or screenshots, real Safari flags and Home Screen launch,
and two deployed sibling sites copying progress on one origin. No browser or network
was used, no audio was regenerated and no commit was made. The existing bundle-size
warning remains nonfatal.

### 2026-11-13: M16, readable pips and missing-pattern outlines

Dice pictures now use a centred square with standard faces for one through six.
Scattered pictures keep their wide, irregular layout, with margins and separated dots.
Domi's halves use larger standard pips; count questions use navy on both halves and
addition keeps coral and navy. The other pals share the spacing checks. Plain questions
restore the travelling pal's own pattern, and facts that do not fit leave it visible.
Muddled pals show empty navy marks at the resting positions, with empty tiles for Tenny.
Delivery fills those marks. Map and reward transitions use the same drawing path.
Fast feedback is "That was quick!" The two within-five tags use the standard wording
and wider plates; other tags keep their widths.

Verified: `pnpm lint && pnpm test`, `pnpm build`, and `pnpm speech:lines` pass. All 286
unit tests pass, including 27 new geometry and renderer cases. They cover standard
faces, symmetry, card and panel margins, non-overlap, readable pips, count colours,
resting/model transitions, missing outlines and wider tags. Production checks pass.
Speech export has 900 lines, with only `ui-quick` changed and no ids added or removed.
Playwright discovers 22 tests; the two new pattern cases and the screenshot script
capture Domi, Twoot, small dice counts, modeled facts and restored pals. The script
also captures early questions after introductions and passes its syntax check.

Cloud audit: no cream rectangle overlapping the cloud was found. Introduction and
question labels have transparent backgrounds; the introduction label is destroyed
before the question. Cards, tray, slot circles and text bounds stay clear even during
cloud wobble. Eyelids remain on the pal, scenery strips are below, and bursts use no
cream. No draw-order cause was identified, so the brief clipping is not claimed fixed.

Browser tests and screenshots were not run. The reviewer still needs to check the
new pips, outlines, tags and early cloud frames. The `ui-quick` recording needs updating
outside this task. No audio was regenerated, no network was used and no commit was made.
The existing bundle-size warning remains nonfatal.

### 2026-11-13: M17, second tries and explained path skips

A wrong first answer now opens a modeled second try with "Look and try again." The
first wrong button and Show me are disabled. A right second try gets "You worked it
out!" and a hop; another wrong answer opens the worked-answer correction. Only the
first answer changes learning evidence, response counts, placement, retries or meter.
Automatic path skips pop the crossed stars and show a singular or plural spoken banner.
It lasts at least two seconds, waits for speech, and can be dismissed without blocking
the next stop. Joining panels follow it. Area arrivals and walks started by a tap do
not show the banner. Muddled outlines now stay at least 3 screen px on encounter and
reward pals, and 1 px on small map pals. Inset strokes keep the marks apart.

Verified: `pnpm lint && pnpm test` passes all 324 unit tests, including first-try-only
evidence, both extra-try routes, skip counts, fake-clock speech ordering, cancellation
and scaled renderer strokes. The thirty-day simulation is unchanged: 2,856 scored
questions, all sets accurate by day 22. The moved Twin Falls coordinates pass the layout
tests without edits. `pnpm build` and production artifact checks pass. `pnpm speech:lines`
exports 903 lines: only `ui-tryAgain`, `ui-knowThese` and `ui-knowThis` were added; all
existing exported lines match the starting tree. Checksums confirm the 949 protected
art, recording and related files are unchanged. The existing bundle-size warning remains.

Playwright discovers 26 tests, including both wrong-answer routes and singular/plural
skip banners. The screenshot script now captures the second try and skip banners and
passes its syntax check. Browser tests, screenshots and tablet/audio checks were not
run because no browser is available or allowed. The three new clips need recording
outside this task. No audio was regenerated and no commit was made. Encounter probes
can use `phase`, `disabledAnswers`, `inputAccepted`, `modelVisible`, `feedback`, `meter`
and `responses`, with controls `answer-0` to `answer-20` and `hint`. Map probes get
`banner`, `passedOver`, `onScreen`, `markerIndex` and `animating`; the banner has no
control or modal target.

### 2026-11-14: Sharp small pals (orchestrator)

The owner reported that the small pals on the path look pixelated, most of all while they
animate. Reproduced in a close-up screenshot at a device scale factor of 2. Two causes:

- Pal art is 640 px wide and is drawn 58 to 72 px wide on the maps. The renderer sampled
  it without mipmaps, so outlines broke up and changed from frame to frame as a pal
  breathed. Phaser builds mipmaps only for power-of-two textures. `BootScene` now copies
  each pal and prop image into a padded power-of-two canvas texture
  (`src/ui/mipTexture.ts`) whose default frame is the art, and the game config sets
  `mipmapFilter: 'LINEAR_MIPMAP_LINEAR'`. Display sizes and manifest coordinates are
  unchanged.
- The canvas was always 1280 x 800 and the browser stretched it to the screen. It is now
  created at the screen's own pixel count, up to twice the logical size
  (`src/platform/renderScale.ts`, `RENDER` in `src/game/constants.ts`). Every scene
  camera zooms by that factor in `BaseScene.begin`, and text is rendered at the same
  resolution. Layout, control positions and `state()` stay in logical pixels;
  `state().renderScale` reports the factor.

Verified: lint, 331 unit tests, production build, 27 browser tests on Chromium and 26 on
WebKit (one Chromium-only), including a new test at device scale factor 2
(`tests/e2e/sharp.spec.ts`) that checks the canvas size and that taps land. Screenshots
at 1.5 and 2 of both kinds of screen looked right. The Playwright suite limit went from
120 s to 300 s because 27 tests no longer fit.

Not verified: frame rate on the tablet with the larger canvas, and memory there (the
padded textures use about 33 MB of graphics memory, up from about 11 MB).


### 2026-11-14: M18, ways back

The map has a cream arrow to the start page, with the heading moved right. During a
skip banner the arrow saves and leaves once; it cannot also dismiss the banner or open
a join panel. During movement its disabled hit target sits above the animation skip
target. Play keeps the area, marker and session; the existing warm-up runs only when
still needed. The encounter arrow is hidden during introductions and enabled when
question input opens. Its leave check has equal cream choices. Keep going restores the
same phase and model, freezes hint time during the check and excludes speed evidence.
Leaving waits for saves, keeps earlier answers and drops the round without a reward.
Shown introductions are remembered until that pal's round is cleared.

Chosen completion rule: passed sets from a dropped round keep their earned ring progress,
but optional saved deferred-stop ids hold completions and joins until the next finished
round in that area. Load and story syncs respect this. The later reward announces joins
and the ordinary map animation explains movement. Old saves need no new required fields.

Verified: `pnpm lint && pnpm test` passes all 346 unit tests. New core and geometry cases
cover paused hints, timing exclusion, second tries, corrections, retained answers, a
last needed answer in a dropped round, deferred joins across reload, fresh round meters,
intro history and both maps' header bounds. A tight prompt-width check led to a 40 px
prompt. `pnpm build` and production artifact checks pass. `pnpm speech:lines` exports
905 lines, adding only `ui-leaveAsk` and `ui-leaveYes`; all prior lines are unchanged.
Checksums confirm the protected art, audio, render scale, mipmap boot path and process
document are unchanged. The existing bundle-size warning remains nonfatal.

Playwright discovers 34 tests, including seven new navigation cases and a dense-screen
animation/banner case. `tools/screens.mjs` now captures map and encounter arrows, the
leave check and its resumed question, and passes its syntax check. Browser tests,
screenshots and tablet checks were not run because a browser is not available or allowed.
The two new clips need recording outside this task. No audio was regenerated, no network
was used and no commit was made. Encounter probes expose `leaving` and controls `back`,
`leave-yes`, `leave-no`; while the check is open only the two choices are enabled.

Orchestrator's browser pass on M18: 34 browser tests pass on Chromium and 33 on WebKit
(one Chromium-only), hiss check 0 stray, the two new clips transcribe correctly. Three
faults found in screenshots and fixed. The map heading and the skip banner had been given
fixed-size cream plates much larger than their text, with the text at the top; both
plates hug the text again and the reserved rectangles are kept for the layout tests
only. The leave panel was shorter than the question card, which showed above and below
it; the panel now covers the card exactly. In real time the two back routes take about
one second, the same as the existing camp "Stop" exit: the time is the save, not the new
code. `tools/screens.mjs` stops at its grown-ups step ("No active play in title") before
it reaches the new screens; the screenshots for this pass came from
`.codex-runs/probe16.mjs` and from `tests/e2e/path-banner.spec.ts`.

