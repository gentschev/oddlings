# Oddlings: game design

Read `docs/story.md` for the world and cast, and `docs/practice-engine.md` for how questions
are chosen and how learning is tracked. This file covers what the player sees and does.

## Who it is for

First graders, on a tablet in landscape, touch only (first built for a Samsung Android
tablet). They can read short simple sentences with help. An adult is nearby but not sitting
with them.

## Principles

1. **Practice is the game.** Most of the time on screen is answering maths questions. A
   target of 8 to 12 questions per minute of encounter time, and encounters make up at
   least 60% of a session.
2. **No dark patterns.** No purchases, ads, timers that punish, streak guilt, loot boxes,
   random rewards for money or time, notifications, or "come back tomorrow" pressure.
   Nothing is locked behind anything except learning.
3. **No losing.** A wrong answer is information. The game shows how the fact works and asks
   again soon. Nothing is taken away.
4. **Readable alone.** First grade text, always voiced, never needed to answer a question.
5. **Rewards show real progress.** Oddlings grow because the child got better at the facts
   they carry. The collection is an honest picture of what she knows.
6. **Short sessions.** A session has a natural end after about 10 minutes. The game says
   "Good stopping place" and makes stopping feel fine. It never blocks further play.

## Core loop

```
Map (pick next spot) -> Story beat (2-5 voiced lines, sometimes)
   -> Muddle encounter (6-10 questions, about 1 minute)
   -> Reward (friend joins / berries / Oddling grows) -> Map
```

The house on the map opens camp at any time. After about ten minutes, the first reward
that session offers camp on leaving. Stopping and keeping going are equal choices.

## Screens

### Title
Big "Play" button. Small "For grown-ups" button in a corner (opens the parent area behind
a multiplication question). Tapping Play also unlocks audio.

In the installed production app, a small status at the bottom left shows an arrow and
"Getting voices 412 / 900" as recordings are stored. It changes to a tick and "Ready to
play offline" only after a full pass has stored every indexed recording and a service
worker controls the page. A partial or failed pass stays visibly unready. The status
updates while the title is open, is never spoken, and is not a button. Development and
browsers without service workers show no status.

### Choose a partner (first run only)
Three Oddlings: Tenny, Domi, Inch. Tap one to hear its name and see its pattern move. Tap
"Pick" to choose. The other two can be befriended later; nothing is lost by the choice.

### Map
Every stop drawn on a map is one fact set, a map has exactly as many skill stops as its
area has sets, and where the number of steps is not known no stops are drawn. Story
stones are explicit narrative pauses between those skill stops, not practice counters.
Pebble Path uses its eleven art slots for nine skill sets and two story beats.

Areas are registry data: name, map and encounter backgrounds, ordered stones, speakers,
stories and gate markers. Pebble Path has nine skill stones and two story stones. Twin
Falls has three skill stones and three story stones. Later areas add data and art rather
than another map scene. An area is reached when its preceding gate has been walked
through; area one is reached from the start. Checks can pass future sets, but stops and
pals wait for the area to be reached. Entering a map syncs its already-passed skills,
animates their rings and stars, then shows one spoken joining panel if new pals joined.
The opening story stays current. Completed skills behind it show stars and colour, but
stay untappable until the story is seen. Encounters report changes only in their own area.

A skill stone stays current for as many encounters as its set needs. Review facts give
one point and learning facts give their streak, capped at three, divided by four. The
best rounded-up number of facts needed to pass are averaged. The ring is full exactly
when the set is passed. It becomes complete on encounter end or load, and keeps its
completion even if a later confirmation fails. A story completes when seen. The first
incomplete stop in each area is current; everything after it stays locked. Passed work
behind an unseen story is saved, but its stars appear only after that story is seen.

- Locked skills show dim navy pal silhouettes, without clouds.
- The current skill has a yellow pulsing stone, its pal and an overhead cloud, and a
  navy progress track with a coral arc clockwise from noon. The stroke is at least 6 px.
- Complete skills show coloured pals, stars and full rings. A small cloud and gentle
  pulse return only for learning facts or at least three confirmed facts due now.
- Story stones use speech bubbles and gain stars when seen.
- Tags under every skill show dots, a ten frame, or +0, +1, −1, +2, + to 5, − to 5, −2.

Tapping a current or completed skill starts that pal's encounter. The planner still
chooses the questions across available facts. A completed stop is a review replay.
If the pal is the partner, the newest joined other pal helps, with another starter as
fallback; this never changes the saved partner. Pals join when their first skill stop
completes. Domi has no area 1 stop and joins in area 2 unless chosen as the starter.

On return from changed practice, rings grow, new stars appear in order, and the marker
hops to the new current stop. This uses the game clock, lasts under about three seconds,
and any tap skips it. A single encounter can complete several skills.

A gate opens when its area's skill and story stones are complete. While shut it says
"The gate is shut." and "Help the pals on the path." Walking through an earlier gate
opens the next map and records that access permanently. A later lapse does not close a
walked gate. Gate 1 now leads to Twin Falls, including for a child who already used it
for practice in an older build. The last built area's gate says "The path is clear!"
then that more is coming. Afterwards it runs ordinary practice, rotating joined pals
other than the partner. No stones are drawn for that unknown amount of later practice.

Twin Falls has an entry arch back to Pebble Path. The partner walks to either arch before
changing maps. A small cloud and gentle pulse on the entry arch mean an earlier area has
real review waiting. Its Oddbook button sits away from the entry opening. Each new stone's
ring uses its own image radii; wider tags name doubles, double + 1 and halves.

The house on Pebble Path and the tent in Twin Falls have large touch targets and small
pulsing signs. Camp uses that area's encounter background and returns to the same map.
The visible map area is saved across reloads.

### Story scenes
The beat names its speaker and background. The speaker stands left, with the partner on
the right. If the partner is speaking, the newest joined other pal listens instead.
Moss and the ground ring stay as before on Pebble Path. Twoot guides Twin Falls. In the
den, wall marks sparkle and the page gets an outlined pulse. The background shifts up
so the page and its rock stay above the dialogue; both pals stand clear of it. The mist
beat shows a larger, translucent Nought in front of the falls with a pale mist puff
behind it. They bob and drift away together before the last line. The
child advances every line, so the game never cuts speech off automatically.

### Muddle encounter
Layout (landscape):
- Left: partner Oddling. Right: muddled Oddling with a small wobbly scribble above its
  head. The scribble is about 45% of its width and clears the face and pattern panel.
- Top centre: one 44 px cream circle with a navy outline per point of initial work.
  Earned coral dots fill the circles from the left. The engine's meter counts work left.
- Centre: the question card. Large numerals. Example: `7 + 3 = ?`
- Bottom: the answer pad.

Answer pad: for answers 0 to 20, **one button per number**, 0 to 20, in three rows of
seven. One tap answers. This keeps it retrieval (21 choices, no guessing from a short list)
without typing. Buttons are at least 88 px on a 1280 x 800 canvas. For later content with
answers above 20, a digit keypad with a "Go" button replaces it.

Until the child clears a muddle with that pal, the card shows and reads two short lines: "Fivel is in a muddle!"
and "Fill the dots to help." The pad stays hidden until the clip and a short gap finish,
or the child taps anywhere. Silent play holds it briefly. Only pals whose muddles were
cleared in an earlier encounter use "in a muddle again", including gate practice.
Joining through placement does not count as being helped. Completed-stop replays that
do not need help skip the intro.
Response timing starts only after the first question is fully shown.

Turn flow:
1. Question appears, with a short voiced read ("seven plus three") the first time a
   question format is seen and whenever the speaker button is tapped.
2. Child taps an answer.
3. **Correct and quick**: partner does a big move, two earned dots pop into the slots.
   The card shows and reads "A big hop!"
4. **Correct**: partner does a move, one dot pops in. The card shows the effort line
   that the voice reads. The scribble above the friend shrinks as the meter falls.
5. **Wrong**: no buzzer, no red X. The partner tilts its head. The card shows the fact
   worked out on the partner's own pattern (ten frame fills, domino pips, number line
   hops), the right answer is shown and voiced, then the child taps the right answer to
   go on. The same fact comes back within the next 2 to 4 questions.
6. When no work remains, the earned dots fly to the friend in a short stagger, under
   700 ms. Then its pattern snaps into place, its cloud pops, and it hops. Only the clear
   line is spoken after the final answer. If the engine adds work, the last earned dot
   empties from its slot.

There is no visible clock. Speed only ever adds something (the bigger move). The child is
never told she was slow.

A sunflower "Show me" button with a navy outline, navy text and a small code-drawn
lightbulb shows the picture model before answering. It stays at least 88 px tall and
clear of the answer pad. Disabled controls fade. Using a hint is fine and is recorded
as "needed help" for that fact, not as wrong. Count pictures ask "How many dots?"

### Reward
The reward reports what changed on the path. One completed stop shows its pal joining
or feeling better. Several show "You cleared {n} stops!" With no completion, a rise in
the current skill's progress shows "{Name} is getting better!" Otherwise keep the practice
line. The existing honest fact-progress line stays. All lines use speech waits so the
game cannot cut them off. New pals come from completed skill stops, not from finishing
any arbitrary encounter. When several pals join, show them side by side, at most four,
each at least 150 px wide. The second line says "{n} pals join your team!" With one new
pal it names that pal, without repeating the headline. A reward keeps at most two
narrative lines plus the fact line. Each line finishes before the next is spoken.

### Oddbook
The collection. Each Oddling has a page: picture, name (voiced), its pattern, its three
forms (locked forms shown as outlines), and a simple bar "what it knows" that is the
child's mastery of that Oddling's facts.

### Camp
The map house opens camp. The team stands together; tap a pal to hear its name, see a
hop and a heart. The Oddbook can change the partner. "Stop for now" and "Keep going"
have equal-sized buttons. After a reward at ten minutes, camp is offered once per session
instead of the map. It is never a numbered path stop.

### Parent area
Plain HTML page, not part of the game canvas. Shows: the skill tree with mastery per node,
an addition and subtraction fact grid coloured by fluency, recent sessions (minutes,
questions, accuracy), the facts currently being learned, export and import of the save
file, sound settings, and a reset. Gate: tap "For grown-ups", then answer a
multiplication question.

Settings shows the same offline status with the number of voices stored. The footer
shows the build date in UTC and short commit hash. "What this game stores" explains
that there are no accounts, adverts, tracking or name requests; progress and backups
stay in this browser on this device. Shared devices share one player's progress.
Clearing browser data or changing devices starts again, and Export makes a backup file.
Game files come from GitHub Pages, whose host sees the device's internet address during
downloads. Fully downloaded files work without a connection.

## Feel

- Every tap gives a response within 100 ms: a squash, a sound.
- Oddlings breathe, blink and bob at all times. They are never static.
- Correct answers get the most animation in the game. Wrong answers are calm.
- Sounds are soft and musical. Each answer button plays a note; a right answer resolves.
- Screen transitions are short (under 400 ms).

## Art direction

The same characters appear in every area, with a new background look for each area.
Character artwork and pattern drawing stay unchanged. Pebble Path keeps its screenprint
meadow. Twin Falls uses crisp line art, cel shading and bright daylight, chosen by the
child. Ground backgrounds share one placement helper: the source ground line meets the
characters' feet and the supplied bottom colour fills and blends below the image.

Screenprint look: four or five flat spot colours, halftone dot shading, a thick dark navy
outline, slight misregistration, paper grain. See `docs/art-tests/style-C.jpg`. Characters
are simple, bold silhouettes that read at 150 px. The number pattern area on each Oddling
is left **blank in the art** and drawn by code on top, so it can show any number.

Palette: deep navy `#1B2A4A`, coral `#F2543D`, sunflower `#F9C22E`, mint `#5FD3A6`,
cream `#FFF8EA`, plus one accent per area.

Animation is code-driven on static art: squash and stretch, bob, blink (eye overlay),
hop, shake, particles. No frame-by-frame sprite sheets in the first builds.

## Audio

- All dialogue and number reads are pre-generated speech files bundled with the game. No
  device text-to-speech.
- Sound effects are synthesised in code (Web Audio) or generated with tools whose licence
  allows free redistribution.
- Music: one calm loop per area, added after the first playable.
- Only the child's tap may interrupt a spoken line. Automatic speech and scene handoffs
  wait for the indexed clip length plus a short gap on the game clock, with a maximum
  wait for damaged metadata. Correct feedback keeps its minimum animation time too.

The service worker precaches the shell, art and dedicated voice-download worker. Once
the page and service worker are ready, the page sends its base address and ordered clip
ids to that worker. It downloads six low-priority clips at a time without pauses and
reports progress at most every 250 ms, plus a final update. Interface lines come first,
then the current area's stories, pal lines, unfluent fact reads and corrections, and
the rest. Each pass terminates its worker when done. Missing or failed workers fall
back to the page's existing 10 ms pauses, after termination so passes never overlap.
Returning from the background resumes an incomplete pass; the settings page uses the
same path. Worker references and downloads stay relative to the app's sub-path. Failed
replacements keep old clips, and playback can use the same file from cache, ignoring
only its revision query.

## Not in the first playable

Free-roam walking, items and gear, multiplayer, accounts, cloud saves, more than one
profile, music, chapters 2 to 4 content (the engine supports them; the map and story for
them come next).
