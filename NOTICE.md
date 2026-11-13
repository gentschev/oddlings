# Notices

The project's own code is under the MIT licence (`LICENSE`); its own art, audio and story
text are under CC BY 4.0 (`README.md`). Third-party material is listed below.

## Curriculum data

`src/core/curriculum/taxonomy.json` is an extract of the Marble Skill Taxonomy
(https://github.com/withmarbleapp/os-taxonomy), (c) Marble. Data is licensed under the
Open Database License 1.0; descriptive text under CC BY-SA 4.0. The extract (a subset of
topics and prerequisite edges, with two display names corrected) and the fact-set layer
built on it in `src/core/curriculum/` are made available under the same licences.

## Art, audio and fonts

Baloo 2 variable font, `public/assets/fonts/Baloo2-variable.ttf`, copyright 2019
The Baloo 2 Project Authors (https://github.com/EkType/Baloo2). Distributed under the
SIL Open Font License 1.1. The complete licence is bundled alongside the font in
`public/assets/fonts/Baloo2-OFL.txt`. Used for all game text, with no remote font service.

The supplied Oddlings artwork in `public/assets/art/` is original project artwork.
Source images and generation prompts are kept in `art/src/`, with processing in
`art/process.sh` and the cast contact sheet in `art/contact-sheet.png`. No new art or
third-party stock assets were added for M1. Sound effects are original Web Audio
synthesis in `src/audio/AudioManager.ts`; no third-party audio is bundled.

The install icons in `public/icons/` are local compositions of the supplied Tenny art
on the project palette, made by `tools/make-icons.sh`. No new third-party art is used.
