# -*- coding: utf-8 -*-
"""
NEXUS RELAY — Pipeline Stage 4: Graph Pruning & Overclock Guarantee
====================================================================
Blueprint §5 Stage 4. Guarantee: every node keeps >= 4 valid outgoing
edges and the graph is fully connected, so Phase 3 Overclock
Chain-Bridging is always solvable and a hop distance always exists.

Implementation (extracted from stage6_pack_binary.py, which imports
and re-exports it):

  1. Curated edges first (entity["edges"] = [(target_name, REL), ...]).
  2. Cluster rings: deterministic SHARED_CONTEXT links to the next two
     members of the node's cluster.
  3. Same-domain ring links until every node has >= 4 outgoing edges.
  4. Connectivity: BFS over bidirectional adjacency; separate components
     are bridged into the largest component with ARCHIVE_LINK edges.

Operates on entity dicts in the corpus format shared with
dataset_starter.py (edges referenced by target NAME; the caller maps
any external ids to names first).
"""
from collections import defaultdict, deque


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
