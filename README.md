# Oddlings

A maths-facts practice game for first graders. Help small number creatures out of their
muddles by answering addition and subtraction questions within 20, follow a story, and
collect the creatures as pals. It runs in a browser, installs to a tablet's home screen,
and works without a connection once it has downloaded.

Play it: https://gentschev.github.io/oddlings/

- No accounts, adverts or tracking. Progress is stored only on the device.
- Practice adapts to what the child knows: quick checks skip known facts, new facts are
  taught with pictures, and learned facts come back on a widening schedule.
- A parent area (the "For grown-ups" button) shows progress and exports a backup.

## Build

```
pnpm install
pnpm dev          # dev server on port 5199
pnpm test         # unit tests
pnpm test:e2e     # browser tests
pnpm build        # production build in dist/
```

`AGENTS.md` and `docs/` describe the design, the practice engine, the story and how the
project is built and checked.

## Licences

- Code: MIT, see `LICENSE`.
- Art, audio and story text made for this project (`public/assets/art/`,
  `public/assets/speech/`, `art/`, `docs/story.md`): Creative Commons Attribution 4.0
  (CC BY 4.0). Credit "Oddlings by Greg Gentschev" with a link to this repository.
- Curriculum data (`src/core/curriculum/taxonomy.json` and the fact-set layer built on
  it): Open Database License 1.0 and CC BY-SA 4.0, from the Marble Skill Taxonomy. See
  `NOTICE.md`.
- Baloo 2 font: SIL Open Font License 1.1. See `NOTICE.md`.
