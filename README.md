# NEXUS RELAY

**A sleek, modern signal-triangulation trivia deduction game with a deep-space glass presentation.**

You are a **Signal Archivist** aboard a deep-space telemetry relay. A
mystery entity is sealed inside the Signal Containment Core. You never answer a quiz question — you **triangulate**:
every hypothesis you ping returns real multi-axis vector telemetry
(era, space, domain, graph distance, notability) against the hidden
target, until the signal locks. Then the **Overclock Surge** gives you
15 seconds to chain-bridge the solved node's graph neighbours and
multiply your score.

> Full design authority: `NEXUS_RELAY___Complete_Game_Design__Pixel_Art__Big_Dataset___GitHub_Architecture_Blueprint.docx`
> (game design, dataset architecture, repo architecture). Presentation was
> fully modernised on Nov 26, 2026 — gameplay, scoring and datasets unchanged.
> This repository implements that blueprint; section references below
> (§1–§8) point at it.

## The Game Loop (§2)

| Phase | What happens |
|---|---|
| **1 · Signal Interception** | Target entity sealed in the Signal Core. Five orthogonal Frequency Relays locked: **ALPHA** Era · **BETA** Space · **GAMMA** Domain · **DELTA** Relational · **EPSILON** Trait. |
| **2 · Triangulation** | **6 Signal Probes.** Each turn: **Tune a Relay** (spend 1 probe, decrypt one clue, score multiplier −9%) *or* **Ping a Hypothesis** (spend 1 probe, get 5-axis telemetry: Era Delta, Haversine Spatial Vector + 8-wind bearing, Domain Resonance, Graph Hop Distance, Notability Match). |
| **3 · Overclock Surge** | On lock, the solved node ignites 3 outgoing relationship beams. Name valid connected entities within **15 seconds** to multiply the final score (×1.0 – ×2.5). |

**Scoring (deterministic, §2):**
`Total = round((1000 × (P_remaining/6) × (1 − 0.09·clues) + Proximity Bonus) × (1 + 0.5·bridges))`
Ranks run **Static Listener → Frequency Scout → Relay Technician →
Signal Cryptographer → Deep-Band Oracle → Quantum Archivist**, and every
run produces a spoiler-free **Unicode Signal Trace** share card.

**Modes (§2):** Daily Global Broadcast (seeded 00:00 UTC, same target
worldwide) · Endless Sector Expeditions (themed frequency bands,
3-strike capacitor survival) · Zero-Clue Blind Triangulation (hardcore:
all relays sealed, domain static only).

## Play It

```bash
npm install
npm run build            # builds apps/web -> apps/web/dist
# serve the dist folder together with the dataset:
cp -r public apps/web/dist/public
npx serve apps/web/dist  # or any static server
```

Development: `npm run dev --workspace=@nexus-relay/web` (Vite dev server
mounts the dataset in place). Tests: `npm test` (Vitest engine suite +
web end-to-end smoke test + Python pipeline tests).

## Architecture (§6)

```
nexus-relay/
├── .github/workflows/     ci · daily-seed-publisher · dataset-release · pages
├── apps/web/              Vite + WebGL2 frontend (480×270 logical, clean glow post pass)
│   └── src/               graphics/ (Renderer, Shaders, PaletteManager, MascotVex09)
│                          audio/ (Web Audio chiptune synth) · components/ · storage/
├── packages/
│   ├── telemetry-engine/  Core game logic — zero UI dependencies
│   └── shared-types/      24-byte schema, domains, tiers, channels, ranks
├── art-source/            Master palette (.gpl), generated key art, atlas script
├── pipeline/              Python ETL: stages 1–6 (Wikidata → telemetry.bin)
└── public/data/v1/        Static dataset distribution (bin + shards + packs)
```

**Zero-backend static edge architecture (§4/§7):** the entire knowledge
graph ships as static files — a packed 24-byte-per-entity binary store
(`telemetry.bin`, 6.0 MB at production scale), 2-character prefix
autocomplete shards (`trie_shards/*.json`), and hex-encoded clue/edge
packs (`chunks/pack_*.json`) — so autocomplete and telemetry compute
client-side with no server.

## Dataset Status — Read This Honestly

The blueprint's production corpus is **250,000 entities / 1.5M+ edges**
(§4), produced by the Stage 1–6 Wikidata pipeline (§5, Week 2 of the
roadmap). **Phase 1 ships a hand-authored starter corpus of 110 real
entities (441 graph edges, ≥4 outgoing per node, fully connected)**
across all 12 domains, with the complete field set: year anchors,
lat/lon or CONCEPTUAL flags, domain/sub-domain, notability scores,
clusters, five leakage-audited clues each, and curated + guaranteed
graph edges. The packing format, schemas and guarantees are the
production ones — only the corpus size is at starter scale.

## Graphics & Audio (§3)

- Native **480×270** logical resolution, fluid smooth upscaling, WebGL2
  post-processing with a clean glow/bloom pass (no distortion) driven
  by the display-glow setting (off/subtle/full).
- Modern vector art direction (Nov 26, 2026): deep-space navy/indigo,
  cyan/teal signal glow, glass panels, Space Grotesk + Inter type, and
  hand-built SVG assets (emblem, VEX-09 key art, signal-field hero).
- Six sector LUTs with smooth alpha cross-fades; 4-layer parallax
  diorama (starfield 0.05 px/frame, architecture 0.15 px/frame) plus a
  pointer-parallax hero background.
- **VEX-09**, a smooth vector robot operator with all 14 reactive states.
- Collectible **64×64 holographic Relic Cards** (domain glyph +
  rarity frame + WebGL foil shader, θ = atan2(y, x) pointer response).
- Animation layer: staggered menu entrances, pulsing mystery banner,
  animated warmer/colder chips, score count-up with a light-burst
  celebration on solve, and an energised Overclock surge glow — all
  transform/opacity, all honouring reduced motion.
- Zero-file procedural audio: 12 ms switch clicks (HP 3.5 kHz), tape
  whirs, proximity sonar pings (`f = 220 + 880·(1 − min(1, d/10000))`),
  and dynamic synth stems that layer up as you close in.
- Accessibility suite: display glow (off/subtle/full), reduced
  motion, high-contrast palette, colorblind symbolic telemetry
  (((O)) / ▲ / ■), hi-legibility font toggle.

## Deployment (§7)

GitHub Pages via `.github/workflows/pages.yml` (build + dataset copy +
deploy). Production target per blueprint: Cloudflare Pages + R2 under
`/data/*`, custom domain `nexusrelay.io` (not yet registered — the
share-card trace URLs use it as the canonical base per §2/§7 format).

**Two-repo layout (owner-confirmed Nov 26, 2026):** the games are
NOT merged into one site tree. Deepwell keeps its own repository and
its live URL (https://deepwell.games/); this repo serves NEXUS RELAY
from its own GitHub Pages URL
(https://muhammad3056725-eng.github.io/Nexus-Relay/, or the
`nexus.deepwell.games` subdomain if the owner sets it up). A clean,
link-only hub page (source: `hub/` in this repo) presents both games
as selectable cards and links to each game's own served URL — the
link targets are configurable in one `GAME_URLS` block in
`hub/index.html`.

The build is mount-agnostic, which is what makes both a root URL and
a project-pages subpath work from the same artifact: Vite emits
relative asset URLs (`base: "./"`, overridable with `VITE_BASE`) and
the dataset base is resolved against `document.baseURI` at runtime,
so the identical `dist/` runs at a domain root, under the
`/Nexus-Relay/` project-pages path, or under any other subpath with
no rebuild.
