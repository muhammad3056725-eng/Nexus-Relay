"""Stage 1 — Multi-Source Extraction (Blueprint §5).

Production behaviour: stream the Wikidata JSON dump (latest-all.json.bz2),
cross-reference Wikipedia 3-year pageviews, OpenAlex works/authors and the
GeoNames gazetteer, emitting candidate entity rows for Stage 2.

Phase 1 status: NOT YET RUN at production scale. The playable corpus is
the hand-authored starter set in dataset_starter.py (108 entities), packed
by stage6_pack_binary.py. This module is the scaffold for the Week 2
milestone in the blueprint roadmap.
"""
raise SystemExit("Stage 1 production ingestion not yet implemented "
                 "(Week 2 milestone). Starter corpus: dataset_starter.py")
