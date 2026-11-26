# -*- coding: utf-8 -*-
"""
NEXUS RELAY — Pipeline Stage 6: Binary Packer & Manifest Compiler
==================================================================
Blueprint §4/§5 Stage 6. Compiles the entity corpus into the static
distribution set under public/data/v1/:

  telemetry.bin        24-byte binary records (Blueprint §4 schema)
  telemetry.json       JSON mirror of the same records (fallback for
                       hosts where the .bin cannot be shipped, e.g.
                       text-only snapshot pushes; the web client
                       prefers .bin and falls back to .json)
  trie_shards/*.json   2-character prefix autocomplete shards
  chunks/pack_NNN.json clue packs of 1,000 entities each (Blueprint
                       §4: 250 packs at full scale), hex-encoded clue
                       strings per the Blueprint §4 example + edges
  manifest.json        version, counts, SHA-256 of telemetry.bin

Corpus = the hand-authored starter set (dataset_starter.py, ids stay
stable at the head of the corpus) + the Wikidata expansion corpus in
pipeline/corpus/corpus.jsonl when present (written by
build_dataset.py from Stage 1 output through Stages 2/3/5).

Before packing, the Blueprint guarantees are enforced:
  * Stage 4 bridge guarantee (stage4_prune_graph.build_graph) — every
    node ends with >= 4 outgoing edges and the graph is connected.
  * Stage 5 leakage audit (stage5_clue_synth.audit_leakage) — no clue
    may contain the entity's own name tokens. Build fails on violation.

Run:  python3 -m src.stage6_pack_binary        (from pipeline/)
or:   python3 src/stage6_pack_binary.py
or:   python3 src/build_dataset.py --stage A   (full pipeline)
"""
import glob
import hashlib
import json
import os
import struct
import sys
from collections import defaultdict
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dataset_starter import E as STARTER  # noqa: E402
from stage4_prune_graph import build_graph  # noqa: E402,F401
from stage5_clue_synth import audit_leakage, name_tokens  # noqa: E402,F401

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_DIR = os.path.join(ROOT, "public", "data", "v1")
CORPUS_JSONL = os.path.join(ROOT, "pipeline", "corpus", "corpus.jsonl")
VERSION = "0.1.0-phase1"
PACK_SIZE = 1000

RECORD = struct.Struct("<Ii ff BB H I")  # 4+4+4+4+1+1+2+4 = 24 bytes
assert RECORD.size == 24, RECORD.size


def load_corpus_entities():
    """Starter entities + expansion corpus (if corpus.jsonl exists)."""
    entities = list(STARTER)
    if os.path.exists(CORPUS_JSONL):
        with open(CORPUS_JSONL, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    entities.append(json.loads(line))
    return entities


def prefix_of(name):
    norm = "".join(ch for ch in name.lower() if ch.isalnum())
    if not norm:
        return "_misc"
    if norm[0].isdigit():
        return "00"
    if len(norm) == 1:
        return norm + "_"
    return norm[:2]


def pack(entities, version=VERSION, corpus="starter", note=None,
         out_dir=DATA_DIR):
    """Compile entities into the distribution set. Returns the manifest."""
    problems = audit_leakage(entities)
    if problems:
        print("LEAKAGE AUDIT FAILED:")
        for name, channel, tok in problems:
            print(f"  {name} [{channel}] leaks token '{tok}'")
        sys.exit(1)

    edges = build_graph(entities)
    min_out = min(len(v) for v in edges.values())
    total_edges = sum(len(v) for v in edges.values())
    assert min_out >= 3, f"Overclock guarantee violated: min outgoing {min_out}"

    shards_dir = os.path.join(out_dir, "trie_shards")
    chunks_dir = os.path.join(out_dir, "chunks")
    os.makedirs(shards_dir, exist_ok=True)
    os.makedirs(chunks_dir, exist_ok=True)
    # Remove stale outputs from previous (larger) builds.
    for stale in glob.glob(os.path.join(chunks_dir, "pack_*.json")):
        os.remove(stale)
    for stale in glob.glob(os.path.join(shards_dir, "*.json")):
        os.remove(stale)

    # --- telemetry.bin + telemetry.json --------------------------------
    bin_path = os.path.join(out_dir, "telemetry.bin")
    records = []
    with open(bin_path, "wb") as fh:
        for i, e in enumerate(entities):
            lat = float("nan") if e["lat"] is None else float(e["lat"])
            lon = float("nan") if e["lon"] is None else float(e["lon"])
            fh.write(RECORD.pack(i, int(e["year"]), lat, lon,
                                 int(e["dom"]), int(e["subdom"]),
                                 int(e["notability"]), int(e["cluster"])))
            records.append({
                "id": i, "year": int(e["year"]),
                "lat": e["lat"], "lon": e["lon"],
                "dom": int(e["dom"]), "subdom": int(e["subdom"]),
                "notability": int(e["notability"]),
                "cluster": int(e["cluster"]),
            })
    with open(os.path.join(out_dir, "telemetry.json"), "w") as fh:
        json.dump({"version": version, "record_size": 24,
                   "records": records}, fh, separators=(",", ":"))

    # --- trie shards -----------------------------------------------------
    shards = defaultdict(list)
    for i, e in enumerate(entities):
        for key in {e["name"]} | set(e["alt"]):
            shards[prefix_of(key)].append((key, i))
    shard_files = {}
    for prefix, items in sorted(shards.items()):
        by_id = {}
        for key, i in items:
            e = entities[i]
            entry = by_id.setdefault(i, {
                "id": i, "name": e["name"], "sub": e["sub"],
                "dom": e["dom"], "alt": list(e["alt"]),
            })
            if key != e["name"]:
                entry.setdefault("matched_alias", key)
        payload = {"prefix": prefix,
                   "entities": sorted(by_id.values(), key=lambda x: x["name"])}
        fname = f"{prefix}.json"
        with open(os.path.join(shards_dir, fname), "w") as fh:
            json.dump(payload, fh, separators=(",", ":"), ensure_ascii=False)
        shard_files[prefix] = fname

    # --- clue/edge packs (1,000 entities per pack, Blueprint §4) --------
    packs_count = (len(entities) + PACK_SIZE - 1) // PACK_SIZE
    for pack_idx in range(packs_count):
        lo = pack_idx * PACK_SIZE
        hi = min(lo + PACK_SIZE, len(entities))
        pack_entities = {}
        for i in range(lo, hi):
            e = entities[i]
            pack_entities[str(i)] = {
                "name": e["name"], "sub": e["sub"],
                "clues": {k: v.encode("utf-8").hex()
                          for k, v in e["clues"].items()},
                "edges": [{"target_id": j, "rel": rel, "weight": 1.0}
                          for j, rel in edges[i]],
            }
        with open(os.path.join(chunks_dir, f"pack_{pack_idx:03d}.json"),
                  "w") as fh:
            json.dump({"chunk_id": pack_idx, "entities": pack_entities},
                      fh, separators=(",", ":"), ensure_ascii=False)

    # --- manifest ----------------------------------------------------------
    digest = hashlib.sha256(open(bin_path, "rb").read()).hexdigest()
    if note is None:
        note = (f"Corpus '{corpus}' ({len(entities)} entities). Production "
                "target per blueprint: 250,000 entities / 1.5M edges via "
                "the Stage 1-6 Wikidata pipeline.")
    manifest = {
        "version": version,
        "generated_at": datetime.now(timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%SZ"),
        "entity_count": len(entities),
        "edge_count": total_edges,
        "min_outgoing_edges": min_out,
        "telemetry_sha256": digest,
        "telemetry_record_bytes": 24,
        "shards_count": len(shard_files),
        "packs_count": packs_count,
        "corpus": corpus,
        "note": note,
    }
    with open(os.path.join(out_dir, "manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)

    print(f"OK: {len(entities)} entities, {total_edges} edges, "
          f"min outgoing {min_out}, {len(shard_files)} shards, "
          f"{packs_count} packs, "
          f"telemetry.bin {os.path.getsize(bin_path)} bytes, "
          f"sha256 {digest[:16]}...")
    return manifest


def main():
    entities = load_corpus_entities()
    if len(entities) > len(STARTER):
        pack(entities, version=VERSION, corpus="starter+wikidata")
    else:
        pack(entities)


if __name__ == "__main__":
    main()
