# -*- coding: utf-8 -*-
"""
NEXUS RELAY — Dataset build driver (Blueprint §5, Stages 1-6)
==============================================================
Grows the playable corpus in stages toward the blueprint target of
250,000 entities / 1.5M edges:

    python3 src/build_dataset.py --stage A|B|C|D [--fetch-only] [--pack-only]

Stage targets are CUMULATIVE corpus sizes (starter included):
A = 1,000 · B = 10,000 · C = 50,000 · D = 250,000.

Flow:
  Stage 1  stage1_extract.fetch_stage — SPARQL list pass (paced for
           the WDQS 1 req/min limit) + API enrichment pass, resumable
           via pipeline/corpus/ state files.
  Stage 2  stage2_calibrate.notability_score — composite score from
           sitelinks + raw claim degree.
  Stage 3  stage3_normalize — year anchors / coordinates (applied
           during Stage 1 enrichment; re-validated here).
  Stage 5  stage5_clue_synth.synthesize_clues — template clues over
           real facts, leakage-audited per channel with fallbacks.
  Stage 6  stage6_pack_binary.pack — telemetry.bin/.json, trie
           shards, 1,000-entity clue packs, manifest.
  Then     validate_dataset — full internal-consistency validation of
           the shipped set; the build fails if validation fails.

Transform notes (honest data policy):
  * Entities whose name duplicates a starter entity (case-insensitive)
    or another expansion entity are dropped — the starter wins.
  * Entities with no year anchor in Wikidata are KEPT with year = 0
    and an alpha clue that says no year is on file; their count is
    reported per domain (no year is ever invented).
  * Graph edges come from real item-valued Wikidata claims (P31/P279
    class links excluded), capped at the 8 highest-notability targets
    per entity; Stage 4 tops the graph up to the >= 4 guarantee.
"""
import argparse
import json
import os
import re
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stage1_extract  # noqa: E402
import stage2_calibrate  # noqa: E402
import stage3_normalize  # noqa: E402
import stage5_clue_synth  # noqa: E402
import stage6_pack_binary  # noqa: E402
from dataset_starter import E as STARTER  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CORPUS_DIR = os.path.join(ROOT, "pipeline", "corpus")
CORPUS_JSONL = os.path.join(CORPUS_DIR, "corpus.jsonl")
EDGE_PROP_DENYLIST = {"P31", "P279"}
MAX_CURATED_EDGES = 8
CLUSTER_BASE = 1000


def rel_name(prop, labels):
    label = labels.get(prop)
    if not label:
        return prop
    rel = re.sub(r"[^A-Za-z0-9]+", "_", label).strip("_").upper()
    return rel or prop


def transform(rows, prop_labels):
    """Raw Stage 1 rows -> corpus entity dicts (starter format)."""
    starter_names = {e["name"].lower() for e in STARTER}
    by_qid = {}
    for r in rows:
        if r.get("name"):
            by_qid[r["qid"]] = r
    # Raw claim degree (Stage 2 input): out-claims + inbound claims.
    degree = defaultdict(int)
    for r in by_qid.values():
        targets = set()
        for prop, qs in (r.get("claims") or {}).items():
            if prop in EDGE_PROP_DENYLIST:
                continue
            targets.update(qs)
        degree[r["qid"]] += len(targets)
        for q in targets:
            if q in by_qid:
                degree[q] += 1
    scores = {q: stage2_calibrate.notability_score(r["sitelinks"],
                                                   degree[q])
              for q, r in by_qid.items()}

    by_name = {r["name"]: r for r in by_qid.values()}
    entities = []
    used_names = set(starter_names)
    stats = {"dropped_dupe_name": 0, "year_zero": defaultdict(int)}
    for r in sorted(by_qid.values(),
                    key=lambda r: (r["dom"], -r["sitelinks"], r["name"])):
        key = r["name"].lower()
        if key in used_names:
            stats["dropped_dupe_name"] += 1
            continue
        used_names.add(key)
        score = scores[r["qid"]]
        # Curated edges: real claims, best-notability targets first.
        cand = []
        for prop, qs in (r.get("claims") or {}).items():
            if prop in EDGE_PROP_DENYLIST:
                continue
            for q in qs:
                if q in by_qid and q != r["qid"]:
                    cand.append((scores[q], by_qid[q]["name"],
                                 rel_name(prop, prop_labels)))
        cand.sort(key=lambda t: -t[0])
        edges, seen_t = [], set()
        for _s, tname, rel in cand:
            if tname in seen_t:
                continue
            seen_t.add(tname)
            edges.append((tname, rel))
            if len(edges) >= MAX_CURATED_EDGES:
                break
        # Neighbour summary for the delta clue (name-free by design).
        neighbours = []
        for _s, tname, _rel in cand[:1]:
            trow = by_name[tname]
            neighbours.append((stage5_clue_synth.DOMAIN_NAMES[trow["dom"]],
                               trow.get("year")))
        # Clamp again here: raw rows enriched before the Stage 3
        # clamp existed may still carry out-of-int32-range years.
        year = stage3_normalize.clamp_year(r.get("year"))
        if year is None:
            stats["year_zero"][r["dom"]] += 1
        clues = stage5_clue_synth.synthesize_clues({
            "name": r["name"], "year": year,
            "lat": r.get("lat"), "lon": r.get("lon"),
            "dom": r["dom"], "class_label": r.get("class_label"),
            "description": r.get("desc"),
            "tier": stage2_calibrate.tier_of(score),
            "sitelinks": r["sitelinks"],
        }, neighbours=neighbours)
        desc = (r.get("desc") or "").strip()
        sub = (desc[0].upper() + desc[1:]) if desc else (
            r.get("class_label") or stage5_clue_synth.DOMAIN_NAMES[r["dom"]])
        seeds = stage1_extract.DOMAIN_SEEDS[r["dom"]][0]
        seed_idx = seeds.index(r["seed"]) if r.get("seed") in seeds else 0
        entities.append({
            "name": r["name"],
            "sub": sub[:80],
            "year": int(year) if year is not None else 0,
            "lat": r.get("lat"), "lon": r.get("lon"),
            "dom": r["dom"], "subdom": seed_idx + 1,
            "notability": score,
            "cluster": CLUSTER_BASE + r["dom"] * 10 + seed_idx,
            "alt": [],
            "clues": clues,
            "edges": edges,
            "qid": r["qid"],
        })
    return entities, stats


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--stage", choices=sorted(stage1_extract.STAGE_TARGETS),
                    default="A")
    ap.add_argument("--fetch-only", action="store_true",
                    help="Stage 1 only (grow raw corpus, no pack)")
    ap.add_argument("--pack-only", action="store_true",
                    help="skip Stage 1; transform + pack what is fetched")
    args = ap.parse_args()

    starter_counts = defaultdict(int)
    for e in STARTER:
        starter_counts[e["dom"]] += 1

    report = None
    if not args.pack_only:
        report = stage1_extract.fetch_stage(
            args.stage, CORPUS_DIR, dict(starter_counts))
        print(json.dumps({"fetch_report": report}, indent=1,
                         ensure_ascii=False))
        if args.fetch_only:
            return

    rows = stage1_extract.load_raw(CORPUS_DIR)
    prop_ids = set()
    for r in rows:
        prop_ids.update((r.get("claims") or {}).keys())
    prop_report = {"api_calls": 0}
    prop_labels = stage1_extract.ensure_property_labels(
        CORPUS_DIR, sorted(prop_ids), prop_report)

    entities, stats = transform(rows, prop_labels)
    os.makedirs(CORPUS_DIR, exist_ok=True)
    with open(CORPUS_JSONL, "w", encoding="utf-8") as fh:
        for e in entities:
            fh.write(json.dumps(e, ensure_ascii=False) + "\n")
    print(f"transform: {len(entities)} expansion entities "
          f"(dropped {stats['dropped_dupe_name']} duplicate names; "
          f"year=0 by domain: {dict(stats['year_zero'])})")

    all_entities = list(STARTER) + entities
    version = f"0.2.0-stage{args.stage.lower()}"
    manifest = stage6_pack_binary.pack(
        all_entities, version=version, corpus=f"starter+wikidata-stage-{args.stage.lower()}",
        note=(f"Starter corpus (110 hand-authored) + Wikidata expansion "
              f"stage {args.stage} ({len(entities)} entities) via the "
              "Stage 1-6 pipeline. Blueprint target: 250,000 entities / "
              "1.5M edges."))

    import validate_dataset
    ok, summary = validate_dataset.validate(stage6_pack_binary.DATA_DIR)
    print("validation:", summary)
    if not ok:
        print("VALIDATION FAILED")
        sys.exit(1)
    print(f"DONE stage {args.stage}: {manifest['entity_count']} entities, "
          f"{manifest['edge_count']} edges, {manifest['packs_count']} packs, "
          f"{manifest['shards_count']} shards")


if __name__ == "__main__":
    main()
