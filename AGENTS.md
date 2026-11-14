# Oddlings: instructions for coding agents

Oddlings is a maths-facts practice game for a first grader: collect small number-themed
creatures, clear "muddles" by answering questions, follow a story. It runs in a browser on
an Android tablet (landscape, touch) as an installable web app.

Read before working:
- `docs/design.md`: screens, rules, feel, art direction.
- `docs/practice-engine.md`: the learning model. This is the specification for `src/core`.
- `docs/story.md`: world, cast, chapter outline, writing rules for in-game text.
- `docs/plan.md`: milestones and what "done" means for each.
- `docs/process.md`: how the work is done and checked, and lessons from playtests.
- `docs/progress.md`: running log. Append a dated entry when you finish a task: what
  changed, what you verified and how, what is left or broken. Keep entries short.

## Stack

TypeScript (strict), Vite, Phaser 4 (not 3: check the API against the installed package
and the skill files in `node_modules/phaser/skills` if present, do not write Phaser 3
calls from memory), Vitest for unit tests, Playwright for end-to-end tests. pnpm.

## Layout

```
src/core/        pure logic: curriculum, learner model, planner, encounter state, save, story data
src/game/        Phaser scenes
src/ui/          reusable Phaser widgets (answer pad, ten frame, dialogue box, buttons)
src/audio/       audio manager, synthesised sound effects
src/platform/    storage, wake lock, fullscreen, service worker registration
src/parent/      parent area (plain HTML and TypeScript, no Phaser)
public/assets/   art and audio files
tools/           scripts: taxonomy extraction, art processing, speech generation
tests/unit/      Vitest
tests/e2e/       Playwright
docs/
```

## Rules

1. `src/core` imports nothing from Phaser, the DOM, or `Date`/`Math.random`. Time and
   randomness are passed in. Every rule in `docs/practice-engine.md` has a unit test.
2. Tunable numbers live in `src/core/constants.ts` with a comment on each. No magic numbers
   in scenes either: layout and timing constants go in `src/game/constants.ts`.
3. Logical canvas is 1280 x 800, scaled to fit, landscape. Lay everything out in those
   units. The real canvas is larger on dense screens (`src/platform/renderScale.ts`) and
   each scene camera zooms to match, so never read sizes from the canvas or the camera.
   Create text through `text()` in `src/ui/Controls.ts` so it gets the same resolution.
   Touch targets at least 88 px.
   Use pointer events; the game must work with touch only and with mouse only.
4. Test hooks, always present (they are harmless in production):
   - `window.__oddlings.state()` returns a JSON snapshot: current scene, and for the
     encounter scene the question, the correct answer, the meter, and what is on screen.
   - `window.__oddlings.advanceTime(ms)` steps the game clock deterministically.
   - `?seed=123` in the URL seeds the random number generator; `?fresh=1` starts with an
     empty save; `?skipIntro=1` goes straight to the map.
5. After changing anything visible: run the game, drive it with Playwright, take
   screenshots at 1280 x 800, and look at them. A change is not done until the screenshot
   looks right. Save screenshots under `test-results/` (git-ignored).
6. In-game text follows the writing rules in `docs/story.md`. All strings live in
   `src/core/story/` or `src/game/strings.ts`, never inline in scenes, so speech audio can
   be generated from them.
7. No network calls at runtime. No analytics. No third-party scripts. Everything ships in
   the bundle.
8. Art: number patterns on creatures (tiles, pips, segments) are drawn by code on top of
   art that leaves that area blank. Generated images go through `tools/` scripts into
   `public/assets/`; keep the prompt for each image next to it in a `.prompt.txt` file.
9. Prose in docs, comments and commit messages: plain and direct. No em dashes.
10. Do not commit, push, or publish. Do not install global tools. Do not touch files
    outside this repository.

## Commands

```
pnpm install
pnpm dev            # dev server, port 5199
pnpm build          # type-check, production build, and static artifact checks in dist/
pnpm preview        # serve dist/ on port 5199 with host access
pnpm test           # unit tests
pnpm test:e2e       # Playwright (starts its own server)
pnpm lint           # tsc --noEmit plus eslint
```

Build and preview the installable production app with `pnpm build` followed by
`pnpm preview`. Open the preview address on port 5199. The dev server does not register a
service worker. Both the game and `parent.html` ship in `dist/`, with relative paths for
GitHub Pages sub-path hosting. Speech files are optional at build time; generate them
into `public/assets/speech/` before building a voiced release. `tools/check-build.mjs`
checks entry points, manifest, worker, icons, local references and speech exclusion.
Browser, offline, installability and Android checks must be run outside this sandbox.
Stop any dev server first. After a production build, `ODDLINGS_PREVIEW=1 pnpm test:e2e` starts preview and also runs
the worker/offline test. Use `pnpm test:e2e` for the ordinary dev-server scene tests.
Do not deploy or push from an agent task. The Pages workflow runs when a person pushes
to `main` and the repository has GitHub Pages enabled for Actions.

Run `pnpm lint && pnpm test` before finishing any task, and `pnpm test:e2e` when scenes
changed. Report failures honestly in `docs/progress.md`; do not weaken a test to make it
pass.

## Licences

`src/core/curriculum/taxonomy.json` is derived from the Marble Skill Taxonomy (ODbL data,
CC BY-SA 4.0 text). Keep `NOTICE.md` accurate when data sources or assets are added. Only
add assets whose licence allows free redistribution, and record the source.
