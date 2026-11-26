# deepwell.games — game-selection hub (prepared, NOT deployed)

Owner-confirmed model (Nov 26, 2026): **two games, two repositories.**
Nothing is merged or copied into one site tree. Each repo serves its
own game from its own URL, and this hub is a clean, link-only
interface — two selectable cards, no images, no poster — that sends
the visitor to the chosen game's served URL.

| Game | Repository | Served URL (hub link target) |
|---|---|---|
| Deepwell — The Rare-Answer Trivia Descent | the existing Deepwell repo | https://deepwell.games/ (live now, untouched) |
| NEXUS RELAY | `muhammad3056725-eng/Nexus-Relay` (this repo) | https://muhammad3056725-eng.github.io/Nexus-Relay/ — or https://nexus.deepwell.games/ if the subdomain is set up |

## Link configuration

The link targets live in ONE place: the `GAME_URLS` block in the
`<script>` at the bottom of `index.html` (the card anchors carry the
same URLs as no-JavaScript fallbacks — keep the two in sync). To move
a game, change its line there and the matching anchor `href`. Nothing
else in the hub changes; the hub embeds and copies nothing from
either game.

## Deployment-time steps (need the owner / account access)

1. **Deepwell: nothing to do.** Its repo keeps serving
   deepwell.games exactly as today; the hub only links to it.
2. **NEXUS RELAY:** in the Nexus-Relay repo, enable GitHub Pages with
   the **GitHub Actions** source (Settings → Pages). The existing
   workflow (`.github/workflows/pages.yml`) then publishes the game at
   the github.io URL above on every push to the default branch.
3. **Optional subdomain:** to serve the game as
   `nexus.deepwell.games` instead, add a DNS CNAME record
   `nexus → muhammad3056725-eng.github.io` at the domain registrar and
   set the repo's Pages custom domain to `nexus.deepwell.games`; then
   update the hub's `nexusRelay` link (one line, see above).
4. **The hub itself** is a static page that only links out, so it can
   be hosted on any static host in minutes. Its natural home is the
   deepwell.games root — that root currently belongs to the Deepwell
   repo/game, so placing the hub there is an owner decision for
   deployment time (it would mean the Deepwell game taking a path of
   its own inside its repo, or the hub living at another URL). No file
   has been added to the Deepwell repo, and the live Deepwell site has
   not been modified in any way.

## See also

The canonical note on this two-games-one-web setup lives in the
DeepWell repo (the repo that serves the domain): `HUB.md` at the
root of `muhammad3056725-eng/DeepWell` —
https://github.com/muhammad3056725-eng/DeepWell/blob/main/HUB.md
It records what the hub is, how each game is reached, and what the
DeepWell repo must keep stable (the `deepwell/index.html` entry
point and the root asset folders) so the hub link never breaks. If
this local README and HUB.md ever disagree, HUB.md wins.
