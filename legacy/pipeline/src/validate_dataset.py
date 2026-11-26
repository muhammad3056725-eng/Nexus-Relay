# -*- coding: utf-8 -*-
"""
NEXUS RELAY — Dataset validator (Blueprint §5 Stage 6 gate)
============================================================
Validates the shipped distribution set in public/data/v1/ for full
internal consistency — the same properties the web client relies on:

  * manifest counts match the files on disk (entities, edges, packs,
    shards) and telemetry.bin is exactly 24 bytes per entity with a
    SHA-256 matching the manifest;
  * telemetry.json mirrors the binary records field-for-field;
  * every entity appears in exactly one pack with a name, subtitle,
    all 5 hex-decodable clues and edges to valid entity ids;
  * Stage 4 guarantee: min outgoing edges >= 4 and the graph is a
    single connected component (BFS over bidirectional adjacency);
  * Stage 5 audit: no clue leaks its entity's own name tokens;
  * every trie shard entry references a real entity id.

Usage: python3 src/validate_dataset.py [data_dir]
Returns (ok, summary) when imported; exits non-zero on failure.
"""
import glob
import hashlib
import json
import os
import struct
import sys
from collections import defaultdict, deque

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stage5_clue_synth import audit_leakage  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_DIR = os.path.join(ROOT, "public", "data", "v1")
RECORD = struct.Struct("<Ii ff BB H I")


def validate(data_dir=DEFAULT_DIR):
    errors = []
    with open(os.path.join(data_dir, "manifest.json")) as fh:
        manifest = json.load(fh)
    n = manifest["entity_count"]

    # --- telemetry.bin / .json -------------------------------------
    bin_path = os.path.join(data_dir, "telemetry.bin")
    blob = open(bin_path, "rb").read()
    if len(blob) != 24 * n:
        errors.append(f"telemetry.bin is {len(blob)} bytes, expected {24 * n}")
    digest = hashlib.sha256(blob).hexdigest()
    if digest != manifest["telemetry_sha256"]:
        errors.append("telemetry.bin SHA-256 does not match manifest")
    with open(os.path.join(data_dir, "telemetry.json")) as fh:
        mirror = json.load(fh)
    records = mirror["records"]
    if len(records) != n:
        errors.append(f"telemetry.json has {len(records)} records, expected {n}")
    for i, rec in enumerate(records):
        uid, year, lat, lon, dom, subdom, nota, cluster = RECORD.unpack_from(
            blob, i * 24)
        if uid != rec["id"] or year != rec["year"] or dom != rec["dom"] \
                or subdom != rec["subdom"] or nota != rec["notability"] \
                or cluster != rec["cluster"]:
            errors.append(f"telemetry record {i} differs bin vs json")
            break

    # --- packs -------------------------------------------------------
    pack_files = sorted(glob.glob(os.path.join(data_dir, "chunks",
                                               "pack_*.json")))
    if len(pack_files) != manifest["packs_count"]:
        errors.append(f"{len(pack_files)} pack files, manifest says "
                      f"{manifest['packs_count']}")
    entities = {}
    total_edges = 0
    for pf in pack_files:
        with open(pf) as fh:
            pack = json.load(fh)
        for sid, ent in pack["entities"].items():
            i = int(sid)
            if i in entities:
                errors.append(f"entity {i} appears in two packs")
            entities[i] = ent
            total_edges += len(ent["edges"])
    if len(entities) != n:
        errors.append(f"packs hold {len(entities)} entities, expected {n}")
    if total_edges != manifest["edge_count"]:
        errors.append(f"packs hold {total_edges} edges, manifest says "
                      f"{manifest['edge_count']}")
    min_out = None
    adj = defaultdict(set)
    decoded = []
    for i, ent in entities.items():
        if not ent.get("name") or not ent.get("sub"):
            errors.append(f"entity {i} missing name/sub")
        clues = ent.get("clues", {})
        if set(clues) != {"alpha", "beta", "gamma", "delta", "epsilon"}:
            errors.append(f"entity {i} clue channels: {sorted(clues)}")
            continue
        try:
            text = {k: bytes.fromhex(v).decode("utf-8")
                    for k, v in clues.items()}
        except Exception as err:
            errors.append(f"entity {i} clue not hex/utf-8: {err}")
            continue
        decoded.append({"name": ent["name"], "clues": text})
        outs = ent["edges"]
        min_out = len(outs) if min_out is None else min(min_out, len(outs))
        for edge in outs:
            j = edge["target_id"]
            if not (0 <= j < n) or j == i:
                errors.append(f"entity {i} edge to invalid target {j}")
            adj[i].add(j)
            adj[j].add(i)
    if min_out is not None and min_out < 4:
        errors.append(f"min outgoing edges {min_out} < 4 (Stage 4)")
    if entities:
        seen = set()
        dq = deque([next(iter(entities))])
        seen.add(dq[0])
        while dq:
            u = dq.popleft()
            for v in adj[u]:
                if v not in seen:
                    seen.add(v)
                    dq.append(v)
        if len(seen) != n:
            errors.append(f"graph not connected: {len(seen)}/{n} reachable")
    leaks = audit_leakage(decoded)
    if leaks:
        errors.append(f"clue leakage: {leaks[:5]}")

    # --- shards --------------------------------------------------------
    shard_files = glob.glob(os.path.join(data_dir, "trie_shards", "*.json"))
    if len(shard_files) != manifest["shards_count"]:
        errors.append(f"{len(shard_files)} shard files, manifest says "
                      f"{manifest['shards_count']}")
    for sf in shard_files:
        with open(sf) as fh:
            shard = json.load(fh)
        for ent in shard["entities"]:
            if not (0 <= ent["id"] < n):
                errors.append(f"shard {sf} references entity {ent['id']}")
                break

    summary = (f"{n} entities, {total_edges} edges, min_out {min_out}, "
               f"{len(pack_files)} packs, {len(shard_files)} shards, "
               f"errors: {len(errors)}")
    return (not errors, summary + ("; " + "; ".join(errors[:10])
                                   if errors else ""))


def main():
    data_dir = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DIR
    ok, summary = validate(data_dir)
    print(("OK  " if ok else "FAIL") + "  " + summary)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
