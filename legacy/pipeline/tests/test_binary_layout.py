"""Validate the 24-byte telemetry record layout (Blueprint §4)."""
import os
import struct
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from dataset_starter import E  # noqa: E402

RECORD = struct.Struct("<Ii ff BB H I")


def test_record_is_24_bytes():
    assert RECORD.size == 24


def test_corpus_shape():
    assert len(E) == 110
    domains = {e["dom"] for e in E}
    assert domains == set(range(1, 13)), domains
    for e in E:
        assert 0 <= e["notability"] <= 65535
        assert set(e["clues"]) == {"alpha", "beta", "gamma", "delta", "epsilon"}
        if e["lat"] is not None:
            assert -90 <= e["lat"] <= 90 and -180 <= e["lon"] <= 180


def test_pack_unpack_roundtrip():
    e = E[0]
    blob = RECORD.pack(0, e["year"], e["lat"] or float("nan"),
                       e["lon"] or float("nan"), e["dom"], e["subdom"],
                       e["notability"], e["cluster"])
    assert len(blob) == 24
    uid, year, lat, lon, dom, subdom, nota, cluster = RECORD.unpack(blob)
    assert (uid, year, dom, subdom, nota, cluster) == (
        0, e["year"], e["dom"], e["subdom"], e["notability"], e["cluster"])
