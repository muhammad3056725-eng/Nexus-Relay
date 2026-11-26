# NEXUS RELAY — Dataset Expansion Pipeline

Grows the playable corpus from the 110-entity hand-authored starter
set toward the blueprint target of **250,000 entities / 1.5M edges**
(Blueprint §4/§5), in validated stages. Every stage's output passes
the same gates as the starter set: Stage 4 graph guarantee (≥ 4
outgoing edges per node, single connected component), Stage 5
clue-leakage audit, and the Stage 6 validator.

## Stages

| Stage | Cumulative corpus target | Status |
|-------|--------------------------|--------|
| A | 1,000 | implemented; see run reports in git history / manifest |
| B | 10,000 | implemented (same code path, larger quotas) |
| C | 50,000 | implemented; expect multiple runs (WDQS rate limits) |
| D | 250,000 (blueprint full target) | implemented; realistically many runs or a dump-based Stage 1 variant |

Per-domain quotas follow the blueprint §4 distribution table
(History 35k, Geography 35k, Science 30k, Cinema 30k, Biology 25k,
Music 22k, Literature 20k, Sports 18k, Art 15k, Mythology 10k,
Space 6k, Cultural Inventions 4k at full scale), scaled to the stage
target.

## How sourcing works (Stage 1)

Two passes against Wikidata, chosen after measuring WDQS behaviour
(Nov 2026):

1. **SPARQL list pass** — per domain, direct instance-of (P31) seed
   classes, `ORDER BY sitelinks DESC`, so the corpus grows
   most-notable-first. Subclass-closure queries (`P31/P279*`) and
   closure-VALUES queries **time out** on WDQS; direct-seed queries
   complete in seconds. WDQS aggressively rate-limits to ~1 heavy
   query/minute, so SPARQL calls are paced ≥ 61 s apart (persisted in
   the state file across runs) with backoff retries on 429/503/504.
   If a domain's combined query fails outright (one giant seed class
   poisons it), the pass retries **per seed class**.
2. **CirrusSearch top-up** — seed classes whose SPARQL scan times out
   even alone (taxon ~3M members, star, galaxy) are served by the
   MediaWiki search index instead: `haswbstatement:P31=<seed>`, in
   relevance order, sitelinks filled by enrichment.
3. **API enrichment pass** — `wbgetentities` in batches of 50 for
   labels, descriptions, sitelinks and full claims (year anchor,
   coordinates, graph edges, class labels). The API is a separate
   service with generous limits.

State lives in `pipeline/corpus/` (git-ignored): `raw_entities.jsonl`
(deduped by QID), `stage1_state.json` (per-domain SPARQL offsets +
pacing), `prop_labels.json`. Re-running a stage fetches only the
shortfall; enrichment resumes per row. In CI the same directory is
carried between runs with `actions/cache`.

Stages 2/3/5 then transform raw rows: Stage 2 composite notability
(sitelinks + claim degree; weights documented in
`src/stage2_calibrate.py`), Stage 3 year/coordinate normalization,
Stage 5 template clue synthesis over real facts with per-channel
leakage fallbacks. Stage 4 builds the graph (curated claim edges,
capped at the 8 highest-notability targets, then cluster/domain rings
and component bridges), and Stage 6 packs telemetry.bin/.json, trie
shards and 1,000-entity clue packs plus the manifest.

Honest data policy: no year is ever invented — entities with no
Wikidata year anchor are kept with `year = 0` and an alpha clue that
says no year is on file (counted per domain in the build output).
Duplicate names lose to the starter set.

## Running it

```bash
cd pipeline
python3 src/build_dataset.py --stage A          # fetch + transform + pack + validate
python3 src/build_dataset.py --stage B --fetch-only
python3 src/build_dataset.py --stage B --pack-only
python3 src/validate_dataset.py                 # validate the shipped set
python3 -m pytest tests -q                      # pipeline tests (needs pytest)
```

## Automation

`.github/workflows/dataset-expansion.yml` (staged copy:
`pipeline/dataset-expansion.workflow.yml` — the owner pastes it into
`.github/workflows/`, since the Muse GitHub App lacks the Workflows
permission) runs the pipeline on `workflow_dispatch` with a stage
input, plus a monthly schedule at stage A. It validates, commits
`public/data` back to `main`, and dispatches `pages.yml` so the
enlarged dataset is published. Needs only the repo's workflow
permissions set to read/write; no secrets.
