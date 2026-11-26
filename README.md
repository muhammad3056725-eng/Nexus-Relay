# NEXUS RELAY

**Catch the clues. Name the mystery.** A friendly mystery-clue game that plays in any browser, on phone or PC.

Play it here: https://muhammad3056725-eng.github.io/Nexus-Relay/

A famous mystery subject is "transmitting": a person, place, film, animal, invention, dish, brand, artwork, planet and so on. Five clues arrive one at a time, from vague to obvious. Four answer cards are on screen from the first clue, and you can lock one in whenever you are ready. Your host is **VEX-09**, a friendly robot.

> Version 2 (Nov 2026) is a complete redesign. Version 1, a hard free-text "signal triangulation" game built on an obscure auto-generated Wikidata set, was retired because players found it far too difficult. Its code and data are kept for reference in `legacy/` and are not part of the build.

## How it plays

| | |
|---|---|
| **Clues** | 5 per mystery, vague → obvious. "Next clue" is always free. |
| **Answers** | 4 cards: the answer plus 3 look-alikes from the same category, chosen in code from the same subcategory and a similar era. Tap a card, or press **1–4**. |
| **Points** | Correct on clue 1 = 500, clue 2 = 400, clue 3 = 300, clue 4 = 200, clue 5 = 100. |
| **Wrong pick** | That card is greyed out and the next clue arrives. A round can only be missed by a wrong pick on clue 5. |
| **Combo** | Consecutive solved mysteries multiply points: ×1.5 from 2 in a row, ×2 from 4, ×3 from 6. A missed round resets the combo. |
| **Speed bonus** | Small: up to +50 when you answer within 4 s of a clue (fades to 0 by 14 s). There is no timer unless you switch on **Turbo**: 20 s per clue, double speed bonus. |
| **Jammer** | A 50/50 once per run: removes two wrong cards (**J**). |
| **Bonus link** | After a correct answer: "Which of these is connected to …?" Pick 1 of 3 for +100. It never costs points. The links are hand-written real relations (Eiffel Tower *stands in* Paris). |

**Modes**
- **Daily Broadcast**: 10 mysteries from 10 categories, the same for everyone on a given UTC date. One scored attempt per day, with an emoji share grid.
- **Quick Play**: 10 random mysteries.
- **Channels**: 10 mysteries from one of 13 categories.
- **Endless**: 3 lives. You lose one only when a round ends on clue 5 without the right card.

There is also a 30-second interactive tutorial that runs on first visit (skippable, and replayable from "How to play"). The **Signal Archive** keeps stats and a collection of every solved subject, with completion per category. Progress and settings are saved in the browser (localStorage, failing safely in private windows).

## The dataset (`public/data/v2/`)

**682 hand-curated, well-known subjects** in 13 categories:

| Category | Count | Category | Count |
|---|---|---|---|
| Film & TV Stars | 52 | Landmarks & Wonders | 52 |
| Music Legends | 52 | Movies, TV & Games | 52 |
| Sports | 52 | Animals & Nature | 60 |
| Great Minds | 52 | Food & Drink | 52 |
| History & Leaders | 52 | Tech & Brands | 52 |
| Countries & Cities | 52 | Art, Books & Myths | 52 |
| Space | 50 | | |

Each subject has these fields: `id`, `name`, `aliases`, `category`, `sub` (subcategory), `year` (era anchor), `region`, `difficulty` (1–3), 5 ordered `clues`, 1–3 real `links`, and an optional `fact`. The full rules are in [`scripts/data/AUTHORING.md`](scripts/data/AUTHORING.md).

- `subjects/<category>.json`: the source of truth, one file per category. The game loads each file lazily, only when a round needs that category.
- `index.json`: a generated lightweight index (ids, names, categories, years; no clues), about 73 KB. This is the only file needed on first load.
- `node scripts/data/build-v2.mjs` validates everything and regenerates the index. `--check` also fails if the index is stale.
- The validator rejects any clue that contains the answer's name, an alias, or an obvious root ("Italian" for Italy, "Beatle" for The Beatles). It also rejects duplicate ids or names, bad schema, and unbalanced categories. The tests in `apps/web/test/dataset.test.ts` run the same checks.

## Graphics, sound, accessibility

- **Signal space**: a full-screen WebGL2 background.
  - A shader pass draws the nebula, a holographic radar and a shock-wave pulse on every clue.
  - A glowing particle network uses additive soft sprites, which gives a bloom look without a post-processing pass.
  - There is a Canvas2D fallback when WebGL2 is unavailable.
  - Performance: devicePixelRatio is capped at 2. The idle frame rate is about 30 fps, and it runs at 60 fps only during pulses. The loop pauses while the tab is hidden, and quality drops automatically on slow devices.
- **UI**: glass cards and spring animations. Confetti bursts run on an overlay that only animates while particles exist. VEX-09 is inline SVG with mood reactions. Fonts are self-hosted through `@fontsource-variable` (no Google Fonts CDN).
- **Layout**: mobile-first, so on a phone the clue and the four big cards fit one screen. Landscape and desktop get two columns.
- **Accessibility**: keys 1–4 / N / J / Enter / Esc, an `aria-live` clue region, visible focus, colour plus icon plus text for every state, a high-contrast option, and reduced motion (follows the OS setting, with an override).
- **Sound**: short procedural Web Audio effects. Music is **off** by default.

## Develop

```bash
npm install
npm run dev          # Vite dev server (serves the repo's public/ at /public)
npm run typecheck
npm test             # dataset check + vitest (rules, dataset, jsdom app + tutorial) + legacy pytest (skips if no Python)
npm run build        # -> apps/web/dist
npm run serve        # serves dist + public like GitHub Pages: http://localhost:4173/Nexus-Relay/
npm run data:build   # after editing public/data/v2/subjects/*.json
```

## Deploy

`.github/workflows/pages.yml` runs on every push to `main`. It does `npm ci`, then typecheck, then test, then build, copies `public/` to `apps/web/dist/public/`, and deploys to GitHub Pages. Vite uses `base: "./"`, and the data loader resolves `public/data/v2` against the page URL. It only accepts a candidate that returns real JSON, so an HTML 404 can never be mistaken for data. As a result the same build works at a domain root or under `/Nexus-Relay/`.

`.github/workflows/dataset-validate.yml` validates the dataset on changes and once a month.

`hub/` is a link-only page that lets visitors choose between this game and Deepwell. It is not deployed by this repo.

## Layout

```
apps/web/            the game (Vite + TypeScript, no framework)
  src/game/          pure rules: logic.ts, session.ts, rng.ts, types.ts
  src/fx/            space.ts (WebGL2), confetti.ts, vex.ts
  src/app.ts         screens, input, rendering
  test/              vitest suites
public/data/v2/      the dataset (+ og-image.png)
scripts/data/        v2 schema, validator, index builder, authoring guide
legacy/              retired v1 game, pipeline and data (not built or deployed)
```
