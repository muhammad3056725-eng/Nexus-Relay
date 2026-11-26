# Legacy (v1) — retired, not built or deployed

These are the pieces of NEXUS RELAY v1, the "signal triangulation" game built on a 1,021-entity Wikidata set. They were retired in the v2 redesign (Nov 2026) and are kept only for reference:

- `web-v1/`: the old web app source and tests.
- `packages/`: the old telemetry engine and shared types.
- `pipeline/`: the Python Wikidata pipeline (Stages 1–6). Its tests still run from `npm test` through `scripts/run-legacy-pytests.mjs`, which skips cleanly when Python or pytest is missing.
- `data/v1/`: the old dataset. Its `telemetry.bin` was never committed.
- `art-source/`: the old palette and atlas script.
- `dataset-expansion.yml` and `dataset-release.yml`: the old workflows. They are replaced by `.github/workflows/dataset-validate.yml`.

The 110 hand-written starter entities in `pipeline/src/dataset_starter.py` were reused when the v2 dataset was written.
