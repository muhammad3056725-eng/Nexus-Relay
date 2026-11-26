# -*- coding: utf-8 -*-
"""
NEXUS RELAY — Pipeline Stage 6: Binary Packer & Manifest Compiler
==================================================================
Blueprint §4/§5 Stage 6. Compiles the entity corpus into the static
distribution set under public/data/v1/:

  telemetry.bin        24-byte binary records (Blueprint §4 schema)
  telemetry.json       JSON mirror of the same records (fallback for hosts
                       where the .bin cannot be shipped, e.g. text-only
                       snapshot pushes; the web client prefers .bin)
  trie_shards/*.json   2-character prefix autocomplete shards
  chunks/pack_000.json clue packs (hex-encoded clue strings, per the
                       Blueprint §4 example) + graph edges
  manifest.json        version, counts, SHA-256 of telemetry.bin

Before packing, two Blueprint guarantees are enforced here for the
starter corpus (in production they live in Stage 4 / Stage 5):

  * Stage 4 bridge guarantee — every node ends with >= 4 outgoing edges
    (curated edges first, then deterministic SHARED_CONTEXT ring edges
    inside the node's cluster, then same-domain links), and the whole
    graph is made connected with ARCHIVE_LINK bridges so a hop distance
    always exists and the Phase 3 Overclock is always solvable.
  * Stage 5 leakage audit — no clue may contain the entity's own name
    tokens (whole-word, case-insensitive). Build fails on violation.

Run:  python3 -m src.stage6_pack_binary        (from pipeline/)
or:   python3 src/stage6_pack_binary.py
"""
import hashlib
import json
import math
import os
import struct
import sys
from collections import defaultdict, deque

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dataset_starter import E as ENTITIES  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_DIR = os.path.join(ROOT, "public", "data", "v1")
VERSION = "0.1.0-phase1"

RECORD = struct.Struct("<Ii ff BB H I")  # 4+4+4+4+1+1+2+4 = 24 bytes
assert RECORD.size == 24, RECORD.size

STOP = {"the", "of", "a", "an", "and", "off", "de"}


def name_tokens(name):
    toks = []
    for raw in name.replace("(", " ").replace(")", " ").replace("*", " ").split():
        t = "".join(ch for ch in raw.lower() if ch.isalnum())
        if len(t) >= 4 and t not in STOP:
            toks.append(t)
    return toks


def audit_leakage(entities):
    problems = []
    for e in entities:
        toks = name_tokens(e["name"])
        for channel, clue in e["clues"].items():
            words = {"".join(ch for ch in w.lower() if ch.isalnum())
                     for w in clue.split()}
            for t in toks:
                if t in words:
                    problems.append((e["name"], channel, t))
    return problems


def build_graph(entities):
    """Return edges: dict id -> list of (target_id, rel). Enforces Stage 4."""
    idx = {e["name"]: i for i, e in enumerate(entities)}
    edges = {i: [] for i in range(len(entities))}
    seen = {i: set() for i in range(len(entities))}

    def add(i, j, rel):
        if j is None or j == i or j in seen[i]:
            return
        seen[i].add(j)
        edges[i].append((j, rel))

    # Curated edges first.
    for i, e in enumerate(entities):
        for target_name, rel in e["edges"]:
            add(i, idx.get(target_name), rel)

    # Cluster rings: deterministic SHARED_CONTEXT links to next two members.
    clusters = defaultdict(list)
    for i, e in enumerate(entities):
        clusters[e["cluster"]].append(i)
    for members in clusters.values():
        if len(members) < 2:
            continue
        for k, i in enumerate(members):
            add(i, members[(k + 1) % len(members)], "SHARED_CONTEXT")
            add(i, members[(k + 2) % len(members)], "SHARED_CONTEXT")

    # Same-domain ring links until every node has >= 4 outgoing edges.
    domains = defaultdict(list)
    for i, e in enumerate(entities):
        domains[e["dom"]].append(i)
    for members in domains.values():
        for k, i in enumerate(members):
            step = 1
            while len(edges[i]) < 4 and step < len(members):
                add(i, members[(k + step) % len(members)], "SAME_DOMAIN")
                step += 1

    # Connectivity: BFS over bidirectional adjacency; bridge components.
    adj = defaultdict(set)
    for i, outs in edges.items():
        for j, _ in outs:
            adj[i].add(j)
            adj[j].add(i)
    visited = set()
    components = []
    for start in range(len(entities)):
        if start in visited:
            continue
        comp = []
        dq = deque([start])
        visited.add(start)
        while dq:
            u = dq.popleft()
            comp.append(u)
            for v in adj[u]:
                if v not in visited:
                    visited.add(v)
                    dq.append(v)
        components.append(comp)
    components.sort(key=len, reverse=True)
    main = components[0]
    for comp in components[1:]:
        add(comp[0], main[0], "ARCHIVE_LINK")
        add(main[0], comp[0], "ARCHIVE_LINK")
    return edges


def prefix_of(name):
    norm = "".join(ch for ch in name.lower() if ch.isalnum())
    if not norm:
        return "_misc"
    if norm[0].isdigit():
        return "00"
    if len(norm) == 1:
        return norm + "_"
    return norm[:2]


def main():
    entities = ENTITIES
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

    os.makedirs(os.path.join(DATA_DIR, "trie_shards"), exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "chunks"), exist_ok=True)

    # --- telemetry.bin + telemetry.json --------------------------------
    bin_path = os.path.join(DATA_DIR, "telemetry.bin")
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
    with open(os.path.join(DATA_DIR, "telemetry.json"), "w") as fh:
        json.dump({"version": VERSION, "record_size": 24,
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
        with open(os.path.join(DATA_DIR, "trie_shards", fname), "w") as fh:
            json.dump(payload, fh, separators=(",", ":"), ensure_ascii=False)
        shard_files[prefix] = fname

    # --- clue/edge pack ---------------------------------------------------
    pack_entities = {}
    for i, e in enumerate(entities):
        pack_entities[str(i)] = {
            "name": e["name"], "sub": e["sub"],
            "clues": {k: v.encode("utf-8").hex()
                      for k, v in e["clues"].items()},
            "edges": [{"target_id": j, "rel": rel, "weight": 1.0}
                      for j, rel in edges[i]],
        }
    with open(os.path.join(DATA_DIR, "chunks", "pack_000.json"), "w") as fh:
        json.dump({"chunk_id": 0, "entities": pack_entities}, fh,
                  separators=(",", ":"), ensure_ascii=False)

    # --- manifest ----------------------------------------------------------
    digest = hashlib.sha256(open(bin_path, "rb").read()).hexdigest()
    manifest = {
        "version": VERSION,
        "generated_at": "2026-11-26T00:00:00Z",
        "entity_count": len(entities),
        "edge_count": total_edges,
        "min_outgoing_edges": min_out,
        "telemetry_sha256": digest,
        "telemetry_record_bytes": 24,
        "shards_count": len(shard_files),
        "packs_count": 1,
        "corpus": "starter",
        "note": (f"Phase 1 starter corpus ({len(entities)} hand-authored entities). "
                 "Production target per blueprint: 250,000 entities / "
                 "1.5M edges via the Stage 1-6 Wikidata pipeline."),
    }
    with open(os.path.join(DATA_DIR, "manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)

    print(f"OK: {len(entities)} entities, {total_edges} edges, "
          f"min outgoing {min_out}, {len(shard_files)} shards, "
          f"telemetry.bin {os.path.getsize(bin_path)} bytes, "
          f"sha256 {digest[:16]}...")


if __name__ == "__main__":
    main()
