# Sprite Sources (Blueprint §3 / §6)

The blueprint specifies Aseprite master files (`*.aseprite`) exported
to sprite atlases. This environment has no Aseprite, so the masters
are held in two equivalent source forms (flagged as a deviation in the
Phase 1 report):

1. **Programmatic pixel data** — sprites defined directly in code from
   the blueprint's dimensions and palette:
   - VEX-09 mascot, 48×48, all 14 states → `apps/web/src/graphics/MascotVex09.ts`
   - 12 domain glyphs (relic silhouettes) → `apps/web/src/graphics/Glyphs.ts`
   - Relic card frames by rarity tier → `apps/web/src/components/RelicCard.ts`
2. **Generated key art masters** — `art-source/generated/`:
   - `vex09-keyart.png` — VEX-09 at the switchboard (mascot key art)
   - `switchboard-diorama.png` — Containment Core diorama (hero art)
   - `nexus-emblem.png` — hexagonal relay badge (share/OG art)

Web-optimized copies live in `apps/web/assets/`. Rebuild atlases with
`art-source/scripts/build-atlases.sh` (Pillow-based grid packer).
