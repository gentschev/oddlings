# Plan

Milestones are ordered. Each has a "done when" list that can be checked by running
something. Claude Code orchestrates and reviews; Codex does the implementation.

## Who does what

| Work | Model | Reasoning effort |
|---|---|---|
| Core engine, scenes, architecture, hard bugs | `gpt-6.1-sol` | high |
| Art generation and visual checks, UI polish passes | `gpt-6.1-terra` | medium |
| Bulk and mechanical work: speech files, data tables, string extraction, asset processing | `gpt-6-luna` | medium |
| Design, specs, task briefs, review of diffs, independent playtest and screenshot judging | Claude Code | |

The coding agent does not judge its own screenshots as the final word. Claude Code plays
each milestone build in a browser and reviews it before the next milestone starts.

## M0: foundation

Scaffold (Vite, TypeScript strict, Phaser 4, Vitest, Playwright, eslint), the whole of
`src/core` from `docs/practice-engine.md`, and the test hooks.

Done when:
- `pnpm lint`, `pnpm test`, `pnpm build` pass.
- Unit tests cover: fact-set coverage and graph checks, scoring, stage transitions, review
  ladder, retry queue, learning-window sizing, blocked-then-interleaved sets, encounter
  planning constraints, placement, set levels, save round-trip and migration.
- A simulation test runs a synthetic child (knows some sets, learns others at a set rate)
  through 30 days of 10-minute sessions and asserts: first-try accuracy stays between 75%
  and 95% after day 2, facts the child knows are not asked more than review requires, and
  every set reaches level 2 in teaching order.

## M1: playable loop with placeholder art

Title, choose partner, map for area 1 (Pebble Path, 10 spots), muddle encounter with the
0-to-20 answer pad, modeled and plain presentations with ten frame, dots and number line
drawn in code, wrong-answer flow, reward, save and load, warm-up tap calibration. Creatures
are drawn in code as simple shapes with their patterns.

Done when:
- A Playwright test plays from a fresh save through choosing a partner and three
  encounters using `window.__oddlings.state()` to read answers, including one deliberate
  wrong answer, reloads the page, and finds progress kept.
- Screenshots of every screen at 1280 x 800 reviewed.

## M2: art, sound, voice

Screenprint art for the cast of area 1 (Tenny, Domi, Inch, Moss, Fivel, Twoot, Bix,
Nought's ring mark), the map background, the encounter background, UI frames. Transparent
PNGs, pattern areas blank. Code-driven animation: idle bob, blink, squash on tap, hop,
helping-move effects, muddle cloud. Synthesised sound effects. Recorded speech for every
string and for number reads, generated offline and bundled.

Done when:
- No placeholder shapes remain in area 1.
- Every text line plays audio; the speaker button repeats it.
- Screenshot review passes for consistency of style across characters.

## M3: story, Oddbook, camp, parent area

Chapter 1 story beats, Oddbook, camp, growth scene, the parent area (skill tree, fact
grid, sessions, export and import).

Done when:
- A Playwright test reaches the area 1 gate with a simulated child.
- The parent area shows correct numbers for a prepared save file.

## M4: on the tablet

Web app manifest, service worker (offline, auto-update), fullscreen, wake lock, back
gesture trap, audio unlock on first tap, storage persistence request. Deployed to a fixed
HTTPS address and installed from Chrome on the tablet.

Done when:
- The production build passes a Lighthouse installable check.
- It runs offline after first load.
- The child has played it and we have notes.

## After the first playtest

Areas 3 and 4 (maps, story, the reveal), growth forms, music, the quick dash, tuning
from the response log, and whatever the playtest shows.

## Playtest 1 (2026-11-12, tablet, a few minutes)

What was reported:
- The practice works and tapping the answers was enjoyed. Twoot was the favourite pal.
- The look reads as a preschool game. Keep area 1 as it is; move the art and tone older in
  areas 2 to 4.
- The muddle was confusing to look at and to understand.
- "Show me" was hard to see and went unused.
- "How many?" sounded like "how manies". A praise line was cut off after each answer.
- No reaction to the story yet.

Fixed the same day (M6): the two audio faults, the hint button, and the muddle (cloud
above the head, dot slots as the meter, a spoken introduction). See `docs/progress.md`.

Requested by the owner on 2026-11-13 for a later pass:
- Spiral review that is visible. The engine already brings each learned fact back on a
  widening schedule (1, 3, 7, 16, 35, 90 days) and gives due facts up to 60% of an
  encounter. What is missing: it is invisible to the child and the parent, and it works
  fact by fact with no notion of refreshing an older topic as a whole. Design question:
  show due review as returning muddles on old maps (already true for Pebble Path stops),
  and add a parent view of what is due and when.
- A parent view of the part of the curriculum that matters now: the skills around the
  child's current position, how much practice each has had (questions and minutes, from
  the response log), and mastery per skill. The parent area today has the full skill tree
  with a level per skill, fact grids, a session table and a questions-per-day chart; it
  has no practice-volume-per-skill view and does not focus on the current frontier.

Art direction chosen on 2026-11-13 (samples in `docs/art-tests/area2/`): backgrounds in
the style of sample C (crisp line art, cel shading, bright daylight), characters unchanged
(screenprint shading, short legs, Twoot's dots side by side). The child's rule: the same
characters in every area, a new background look for each area.

Carried into the next phase:
- Area 2 now uses the chosen crisp background style. Areas 3 and 4 get their own looks.
- Done in M11: Twoot guides Twin Falls and hosts near doubles.
- Ask on the next playtest whether the muddle reads now and whether "Show me" gets used.

## M11: Twin Falls and areas as data

Built: the area registry, gates between maps, area-aware scenery and camp, and Twin
Falls with three skill stones and the falls, den and mist beats. Twoot is the guide.
Domi hosts doubles and halves; Twoot hosts near doubles. Old gate-practice saves can
reach the new map. Unit journeys, layout checks, browser cases and screenshot coverage
include both areas. Browser review is still required outside the sandbox.

Next: area 3, The Tenwood, then area 4, Teen Hills. Each adds registry data, background
art, map geometry data and its story clues. The character art stays the same. Growth,
music and the remaining playtest requests stay on the later list.

## Owner's session on the test address (2026-11-13, Twin Falls)

What was reported:
- A wrong answer should not show the answer at once. Suggested: a hint on the second try,
  the answer on the third.
- The Twin Falls trail did not connect past the tent. The tent read as the next stop and
  the real next stop (the den story) was missed.
- After the den story the travelling pal hopped over about three stops with no reason
  given.
- "Shh" was spoken as letters. "Wait! Do not go!" had no pause after "Wait".
- Two pals appeared to have no pips during a question.

Done (M17): three tries (first scored, second with the picture model, third shows the
answer); the map redrawn with one unbroken trail that goes around the camp; a spoken line
when the pal passes stops the child already knows; "Hush" in place of "Shh"; a fixed pause
after an exclamation mark inside a line; bolder empty outlines on a muddled pal. The
missing pips could not be reproduced on the current build and may have been an older
installed build. See `docs/progress.md`.
