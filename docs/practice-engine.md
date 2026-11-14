# Practice engine

This is the specification for `src/core`: what gets asked, when, and how the game tracks
what the child knows. It is pure TypeScript with no rendering, no DOM and no wall-clock
access. Every function that needs the time or randomness takes them as arguments (`now` in
milliseconds, a seeded random number generator), so behaviour is reproducible in tests.

## Evidence this is built on

Strength of evidence is stated because some of it is thin for 6 year olds.

| Rule in this engine | Basis | Strength |
|---|---|---|
| Recall practice spread over days, not massed | Spacing meta-analyses; grade 3 arithmetic studies | Strong in general; no direct study at age 6 to 7 |
| Short bursts (about 1 minute encounters), several per session | Schutte 2015; effective practice in the US Institute of Education Sciences (IES) 2021 guide ran 1 to 5 minutes | Moderate |
| New fact set practised alone first, then always mixed with older sets and the inverse operation | IES 2021; interleaving studies in grades 3 to 4 | Moderate; nothing at K to 2 |
| Teach with pictures when recall checks show a need; measure speed as recall evidence | IES 2021; McNeil et al. 2025; Baroody's phases | Expert consensus; experiments are mixed |
| Response time recorded on every answer, never shown, no countdown | IES 2021 recommends timed work on mastered content against the child's own record. The claim that timing causes anxiety has no experimental support, and there is no grade 1 experiment either way | Moderate |
| Small teaching windows among known facts, with more recall checks when accuracy is high | Drill-ratio studies; Rosenshine | Weak to moderate; the numbers are conventions |
| On a miss: model and second try, then the worked answer if needed; fact returns after 2 to 3 others | IES 2021 for feedback and return; the extra try is our choice | Strong for feedback and return |
| Rewards are earned and report progress; none per answer | Deci, Koestner and Ryan 1999 | Strong for the general effect |
| Ten frames, dot patterns and number lines used for hints and corrections, then faded | IES 2021 on representations | No trial isolates these for fact fluency |

The spacing intervals, the "fast" threshold and the window sizes below are engineering
choices inside those rules. They are named constants in one file so they can be tuned from
real play data.

## Curriculum: two layers

**Layer 1, skills.** A subset of the Marble Skill Taxonomy (`withmarbleapp/os-taxonomy`,
data under the Open Database License (ODbL), text under CC BY-SA 4.0). We keep its topic
ids, names and prerequisite edges so the parent view can show progress against a published
curriculum graph with Common Core codes. The topics used in the first arc:

| Taxonomy id | Topic | Common Core |
|---|---|---|
| `mt_t9BICauBSI` | Subitising to 5 | |
| `mt_BK5xwkrD5C` | Seeing parts within 10 | |
| `mt_ghF3Vv6taM` | Fluent adding and subtracting within 5 | K.OA.5 |
| `mt_7XcCG43ZZW` | Numbers up to 10 into pairs | K.OA.3 |
| `mt_e8CZ7E5qW7` | Number bonds to 10 (the dataset names it "Number bonds to 9") | K.OA.4 |
| `mt_PpWSHA-0kv` | Counting on and back as strategies | 1.OA.5 |
| `mt_ezc2m_0dzN` | Finding a missing number in addition | 1.OA.4 |
| `mt__we2TDqnJx` | Fluent adding and subtracting within 10 | 1.OA.6 |
| `mt_xmmgAzxe5j` | The teen numbers | 1.NBT.2b |
| `mt_m1W6nTQJ2b` | Addition and subtraction within 20 (strategies) | 1.OA.6 |
| `mt__t4afSyZRm` | Fluent adding and subtracting within 20 | 2.OA.2 |

`tools/extract-taxonomy` copies these topics and the edges among them into
`src/core/curriculum/taxonomy.json` and records the source commit. Because that file is
derived from an ODbL database, it and the fact-set layer stay under ODbL with attribution
in `NOTICE.md`.

**Layer 2, fact sets.** The taxonomy stops at skills. Under each skill we define fact
sets: small groups of facts that share a strategy. This layer is ours.

A **fact** is one question with one answer and a stable id:
- `add:7+3` (shown `7 + 3 = ?`)
- `sub:10-3` (shown `10 − 3 = ?`)
- `miss:7+?=10` (shown `7 + ? = 10`)
- `dots:4:dice` (a dot card, "how many?"), `frame:7` (a ten frame, "how many?")

Ordered pairs are separate facts (`add:3+7` and `add:7+3`). A fact can belong to more than
one set; its state is stored once.

Fact sets, in teaching order. `n` ranges over the values that keep the sum at most 20 and
both addends at most 10.

| Set id | Facts | Model shown in hints | Skill | Area |
|---|---|---|---|---|
| `see-dots` | dot cards for 1 to 5, dice and scattered layouts | dots | Subitising to 5 | 1 |
| `see-frame` | ten frames showing 0 to 10 | ten frame | Seeing parts within 10 | 1 |
| `add-plus0` | n+0, 0+n | ten frame | Counting on | 1 |
| `add-plus1` | n+1, 1+n | number line | Counting on | 1 |
| `sub-minus01` | n−0, n−1 | number line | Counting on | 1 |
| `add-plus2` | n+2, 2+n | number line | Counting on | 1 |
| `add-within5` | every a+b with sum at most 5 | ten frame | Fluent within 5 | 1 |
| `sub-within5` | every c−a with c at most 5 | ten frame | Fluent within 5 | 1 |
| `sub-minus2-all` | n−2, n−n, n−(n−1) for n up to 10 | number line | Counting on | 1 |
| `add-doubles-small` | 1+1 to 5+5 | domino | Numbers into pairs | 2 |
| `add-near-doubles-small` | 1+2, 2+3, 3+4, 4+5 and their turnarounds | domino | Numbers into pairs | 2 |
| `sub-halves-small` | 2−1, 4−2, 6−3, 8−4, 10−5 | domino | Missing number | 2 |
| `add-five-and` | 5+n, n+5 for n 1 to 5 | ten frame | Seeing parts within 10 | 3 |
| `add-make10` | all pairs that sum to 10 | ten frame | Number bonds to 10 | 3 |
| `miss-make10` | n + ? = 10 | ten frame | Number bonds to 10 | 3 |
| `sub-from10` | 10−n | ten frame | Number bonds to 10 | 3 |
| `add-within10` | every a+b with sum at most 10 (the mixed set) | ten frame | Fluent within 10 | 3 |
| `sub-within10` | every c−a with c at most 10 | ten frame | Fluent within 10 | 3 |
| `miss-within10` | a + ? = c with c at most 10 | ten frame | Missing number | 3 |
| `add-ten-plus` | 10+n, n+10 | double ten frame | Teen numbers | 4 |
| `sub-teen` | 1n−n and 1n−10 | double ten frame | Teen numbers | 4 |
| `add-doubles-big` | 6+6 to 10+10 | domino | Strategies within 20 | 4 |
| `add-near-doubles-big` | 5+6, 6+7, 7+8, 8+9 and turnarounds | domino | Strategies within 20 | 4 |
| `add-nine-plus` | 9+n, n+9 for n 2 to 9 | double ten frame | Strategies within 20 | 4 |
| `add-eight-plus` | 8+n, n+8 for n 3 to 8 | double ten frame | Strategies within 20 | 4 |
| `add-within20` | every a+b, addends 0 to 10 (the mixed set) | double ten frame | Fluent within 20 | 4 |
| `sub-within20` | every c−a with c at most 20, a at most 10, answer 0 to 10 | double ten frame | Fluent within 20 | 4 |

Areas: 1 Pebble Path, 2 Twin Falls, 3 The Tenwood, 4 Teen Hills. Each set also lists its
prerequisite sets (the sets above it that share its skill or feed its strategy; write
these out explicitly in the data file). Tests must prove: every addition fact with addends
0 to 10 is in at least one set; every matching subtraction fact is in at least one set;
the prerequisite graph has no cycles; every set maps to a taxonomy id that exists.

## What is stored per fact

```ts
interface FactState {
  id: string;
  stage: 'new' | 'learning' | 'review';
  seen: number;            // times presented
  firstTryCorrect: number;
  strength: number;        // 0..1, moving average of recent scores (1, 0.5, 0)
  streak: number;          // consecutive first-try correct while in 'learning'
  ladder: number;          // index into REVIEW_INTERVALS_DAYS while in 'review'
  dueAt: number | null;    // ms timestamp of next review
  lastSeenAt: number | null;
  latencies: number[];     // last 5 first-try-correct response times, ms
  fastDays: string[];      // distinct local dates with a fast first-try-correct answer (keep last 3)
  lapses: number;
  provisional: boolean;    // marked known by placement, not yet confirmed
}
```

Scoring one response: first-try correct and fast = 1; first-try correct, not fast = 0.5
(still counts as correct everywhere accuracy is measured); wrong, or hint used before
answering = 0. `strength = strength + 0.3 * (score - strength)`.

**Fast** means response time at most `tapBaseline + 2000 ms`, clamped to between 2500 and
5000 ms. `tapBaseline` is the child's own median time to find and tap a number that is
simply shown ("Tap 7"), measured by a five-tap warm-up at the start of each session
(median of the last 15 warm-up taps; 1500 ms until measured). Response time runs from the
moment the question is fully on screen to the tap. Times over 20 s, and any answer where
the app was hidden, are not recorded as latencies.

**Fluent** (derived, not stored): the fact is in `review` and has fast first-try-correct
answers on 3 distinct days.

## Stages

- **new**: never shown. A first-try correct plain answer, without help and fast by the
  existing rule, enters confirmed review immediately at ladder 0, due in one day. Its
  fast day counts toward fluency. A correct but slower answer enters learning at streak
  one. Modeled or helped answers cannot use this fast route.
- **learning**: being acquired. A fact leaves `learning` after 3 first-try-correct answers
  in a row that span at least 2 encounters. It then enters `review` at ladder 0 (or at
  `max(0, previous ladder - 2)` if it had lapsed).
- **review**: `REVIEW_INTERVALS_DAYS = [1, 3, 7, 16, 35, 90]`. A first-try-correct answer
  on or after `dueAt` moves it up one step and sets the next `dueAt`. A first-try-correct
  answer before `dueAt` changes nothing except statistics. A wrong answer sends it back
  to `learning` with `streak = 0` and `lapses + 1`.

A wrong first answer is the only scored response. It changes the fact, entry checks,
set streaks and response log once, and schedules one retry. It also counts once toward
the encounter's answered count. The first try alone supplies hint use, hidden state
and latency.

The second try keeps the same question with its picture model visible. The card says
"Look and try again." and the first wrong button is dimmed and disabled. Input opens
after the normal question delay; a tap can interrupt the spoken line. This applies to
plain, modeled and counting questions. Show me is disabled because the model is up.
A right second answer gets "You worked it out!" and a hop, then the next question.
A different wrong second answer shows and reads the worked answer. The card then says
"Tap n to go on." and accepts only the correct button. That correction tap moves on.
Neither extra try changes a fact, response log, entry check, set streak, retry or meter.
Only first-try correct answers clear puffs. The missed fact returns as a scored retry,
where a first-try correct answer can clear a puff.

Within a session, a fact that was just missed or just introduced is put on a retry queue:
shown again after 2 to 3 other questions, then again after about 6 more, then once more in
a later encounter of the same session.

## Presentation modes

- **modeled**: the question is shown with its picture model already visible (the ten frame
  filled, the number line with the hop drawn). The child still has to answer. Used
  when the child needs teaching and on the next showing after a miss.
  A new fact starts plain when current-session first-try accuracy is at least 75%, or
  the session has fewer than twelve answers and the previous session met 75%. Entry
  probes always start plain. The first session starts modeled outside entry checks.
- **plain**: numerals only. A hint button reveals the model. Using the hint scores 0 for
  that showing (it is recorded as "needed help", shown that way to the parent, and is not
  treated as an error in the child's view).

If there is no tap for 8 s the hint button pulses. After 20 s the model is shown
automatically. There is no timeout that marks an answer wrong: counting it out is the
expected route before recall and takes longer than a few seconds.

## Mastery and opening

Per set, derived from its facts:
- **0 not started**: no fact seen.
- **1 learning**: some facts seen.
- **2 accurate**: at least 90% of facts in `review` and not provisional.
- **3 fluent**: at least 90% of facts fluent and not provisional.

A set is **passed** when it is level 2 or 3, or at least `SET_MASTERY_RATIO` (90%) of its
facts are in `review`, including provisional facts. Passing placement counts for the path
immediately. A failed confirmation moves its fact to learning and can take the set below
the passed ratio again. Levels, parent accuracy and Oddbook bars still count confirmed
facts only. The parent labels a passed set below level 2 as "placed, being checked".

A set opens when all its prerequisite sets are passed. At most `MAX_SETS_IN_INTRO = 2`
unpassed sets may open for new facts at once, earliest in teaching order first. Passed
sets and sets with no unseen material or pending entry check do not occupy those
introduction slots; their due confirmations and learning facts
remain in practice.

A newly opened set is **blocked**: its questions are not mixed with other unfinished
sets' new facts until first-try accuracy on its last 10 showings reaches 80%. After that
it is always interleaved with older sets and, once open, the matching inverse operation.

Skill mastery (taxonomy layer) is the lowest level among the skill's sets that are in
scope. Each area's skill stops follow its fact sets in teaching order. An area is
reached when it is area one or its preceding gate has been walked through. `syncPath`
records passed skills and seen story beats only in reached areas, in path order. An
optional area scope keeps encounter rewards and map loading local. Entering a map runs
that area's sync before its arrival animation and joining announcement. Completion is sticky. A story can visually lock later passed work until it
is seen. Each built area opens its gate when all its own stops, including stories, are complete. Walking a gate
records permanent access to the next built area. The learner model can pass sets in
unreached areas; their stops do not complete and their pals do not join until the area
is reached. Unseen stories remain current even when later skills complete on arrival.
Later failed checks can lower a set below passed while its completed stone stays clear.
`setLevel`, parent accuracy and growth still use confirmed knowledge.

A skill's ring uses the best `ceil(SET_MASTERY_RATIO * set size)` facts. Review facts
give one point; learning facts give `min(streak, ACQUISITION_STREAK) /
(ACQUISITION_STREAK + 1)`; new facts give zero. Average those credits. It is full exactly
when the review ratio passes, so part credit alone never clears a stop. A complete stop
needs help only for learning facts or `STOP_HELP_DUE = 3` confirmed reviews due now. Completed-stop encounters
use review practice; current stops use the ordinary planner without restricting questions
to that stone's set. The last built area's gate runs ordinary practice for later sets;
earlier gates lead to the next map. All maps and their stories come from the area registry.
The save keeps its version 2 shape: `map.area` selects the map and gate beats in
`story.completedBeats` record walked gates. The original `gate` beat means gate one.

Oddlings grow to form 2 when their sets reach confirmed level 2 and form 3 at level 3.

## Planning an encounter

`planEncounter(save, now, rng, length)` returns an ordered list of question slots; slots
after the first can be replaced as the encounter runs (a miss inserts a retry). Default
length 8, range 6 to 10.

Select facts in this order:
1. Retries whose gap has been reached.
2. Reviews that are due, oldest first, up to 60% of the encounter.
3. Learning-window facts. The **learning window** is the set of facts currently in
   `learning`; its target size is 3. It shrinks to 2 when session first-try accuracy is
   under 75% (over at least 12 answers) and grows to 4 when it is over 90%. A modeled `new` fact
   is introduced only when the window has room. The window counts learning facts in the
   current introduction sets; older lapses keep their retries without occupying it.
   Plain first checks can test a new fact outside the teaching window, as entry probes
   do. The known share still limits these checks. Rotate learning and fresh checks so
   unfinished older facts cannot suppress every new independent recall.
4. Known facts (in `review`, not due), least recently seen first, to fill the rest.

Constraints: known facts make up at least 70% by default once there are enough of them.
After twelve session answers at 90% or above, `MIN_KNOWN_RATIO_HIGH = 0.4` applies instead.
Below the low threshold keep 70%; the first and last question are known facts; no fact twice in a row; avoid the same
answer on consecutive questions; mix addition and subtraction once both have open sets.

After selecting the slots, arrange new, learning and placement facts between known facts,
with at least one known question between unknown questions whenever the counts allow.
Keep the known opener and closer, preserve the oldest due opener, and avoid consecutive
copies of a fact or answer. Scheduled retry positions stay in place; a retry that becomes
ready during play still takes priority over this arrangement. If the available facts make
all constraints impossible, answer variety takes priority over spacing, and play continues.
Entry checks have the separate probe-heavy rules below; live probes stay in teaching
order. A live retry moves displaced learning into later filler instead of deleting it.
Known filler first uses facts not yet demonstrated in the current set's streak, then
older sets, then repeats of facts in that streak; each group uses least recently seen.

If nothing is due and the window is empty (everything open is mastered), fill with the
oldest-seen review facts. The child can always play.

## Placement

The first session must not make a child grind facts she knows. The same rule applies in
every later session, including saves whose old placement stopped after a slip.

Each set gets its own entry check when the planner first turns to its unseen material.
Ask its two hardest facts plain, by largest quantities, then largest parts, with stable
ids breaking ties. Shared facts seen in earlier sets do not disable this check of the
new set. Two first-try correct answers without help pass the check. One missed or helped
probe gives a different, hardest remaining probe after two intervening scored questions.
As before, a correct recheck passes; a second miss sends only this set to ordinary
learning. Correction acknowledgement taps do not count towards the gap. Pending checks
survive encounters and sessions. Later unseen sets still get their checks when available.

On a pass, successful probes are confirmed. Other unseen facts become `review`,
`provisional: true`, due now. Facts already learning because of a miss stay learning and
keep their correction retries. Confirmed shared facts keep their ladders. Live checks
move to the next available set within the same encounter, with no known-fact quota.
Ready retries retain priority. Provisional confirmations are spread between checks, at
most two per encounter, earliest teaching set first and hardest first within it. The same
order applies during ordinary practice. A failed confirmation returns to learning.

A learned set has a second route past known material: `SET_STREAK_PASS = 5` different
facts answered first try, plain, without help, in a row. Repeating a fact adds no evidence.
A miss, help or modeled showing in that set resets this sequence. Practice in other sets
does not reset it. Reaching five promotes only facts still `new` to provisional review.
Learning facts retain their own acquisition and retry route. This evidence persists
between sessions. Old version 1 and 2 saves retain pending checks where possible; stopped
sets can use the streak route and later unseen sets still get entry checks.

Testing before teaching and skipping known material are standard practice in adaptive
tutors. Our two probes, five different recalls and high-accuracy known share of 0.4 are
engineering choices, not validated thresholds for six year olds. Tune them from the
response log. No new external evidence was gathered for these choices.

## Sessions and logs

A session starts at app start or resume after 5 minutes away. The save keeps a log of
sessions (start, end, questions answered, first-try accuracy, facts that entered `review`,
facts that became fluent) and a capped log of the last 2000 responses (fact id, time,
correct, latency, mode) for the parent view and for tuning. After about 10 minutes of
play, leaving the next reward offers camp once that session. The house also opens camp
at any time; camp is not a skill stop.

## Save data

One versioned JSON document (`version`, `profile`, `facts`, `team`, `map`, `story`,
`sessions`, `responses`, `settings`). Stored in IndexedDB with a copy in localStorage,
written after every encounter and every story beat. Version 2 replaces encounter-stop
ids with sticky skill stops. The version 1 migration validates the original data first,
drops old map ids, runs path sync, and positions the marker at the current stop. It keeps
the original team, partner, learner evidence, logs and settings. New pals are awarded by
normal path completions after migration; existing pals are never removed. The version 2
team records cleared muddles in `helped`. For version 1 saves, every old team member
except the partner counts as helped, because that was how pals joined. Placement joins
do not add to this history. Migrations are pure functions
`vN -> vN+1` with tests. Export and import as a file from the parent area.

## Clarifications from the first implementation

The 30-day simulation exposed places where rules above collide. These resolutions are part
of the specification.

- **Three tries.** A miss now gives a modeled second try before the worked-answer
  correction. Only the first answer is scored; extra tries never clear puffs.
- **Accuracy target.** The 80 to 90% target applies to days on which new facts are being
  learned. Once everything open is mastered, sessions are all review and accuracy will sit
  above 95%; the engine never manufactures errors.
- **Overlapping sets.** Because facts are shared, a later set can reach level 2 before its
  turn (within-5 facts get mastered while plus-two facts above 5 are still being learned).
  Levels stay fact-based. Teaching order only controls which set new facts are drawn from.
- **Known facts as filler.** The 70% known quota and the known first and last question
  mean known facts are sometimes asked before they are due. That is allowed, least
  recently seen first. An early correct answer never moves a fact up the ladder or
  postpones its due date.
- **Due cap.** When every known fact is due, the 60% cap on due reviews gives way so a
  plan can always be completed.
- **Encounter end.** Quick answers pop two puffs, which could end an encounter before its
  planned learning questions were asked. The last puff stays until the planned questions
  have had a turn. A retry that is ready takes priority over the known-fact quota.

## Later, not in the first build

- An optional 60-second "quick dash" on sets at level 2 or higher, scored only against the
  child's own best (the IES-recommended form of timed practice).
- Word problems and two-step items, which bring reading level into the learner model.
- Tuning the constants from the response log.
