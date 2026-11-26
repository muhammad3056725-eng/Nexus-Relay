"""Blueprint Stage 5 audit: no clue leaks the entity's own name tokens."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from dataset_starter import E  # noqa: E402
from stage6_pack_binary import audit_leakage, build_graph  # noqa: E402


def test_no_clue_leakage():
    assert audit_leakage(E) == []


def test_overclock_guarantee():
    edges = build_graph(E)
    assert min(len(v) for v in edges.values()) >= 4
    # Every edge target must be a real node.
    for i, outs in edges.items():
        for j, _rel in outs:
            assert 0 <= j < len(E) and j != i
