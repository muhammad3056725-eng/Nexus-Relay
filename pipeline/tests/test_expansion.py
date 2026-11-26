"""Dataset expansion pipeline: Stages 1-3 + 5 units and the Stage 6
multi-pack compiler + validator on a synthetic corpus (offline)."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
import stage1_extract as s1  # noqa: E402
import stage2_calibrate as s2  # noqa: E402
import stage3_normalize as s3  # noqa: E402
import stage5_clue_synth as s5  # noqa: E402
import stage6_pack_binary as s6  # noqa: E402
import validate_dataset  # noqa: E402


# --------------------------------------------------------------- Stage 1

def test_stage_targets_and_quotas():
    assert s1.STAGE_TARGETS == {"A": 1000, "B": 10000, "C": 50000,
                                "D": 250000}
    total = sum(s1.domain_quota(d, 250000) for d in range(1, 13))
    assert abs(total - 250000) <= 12  # rounding only
    assert s1.domain_quota(1, 1000) == 140   # History share 35k/250k
    assert s1.domain_quota(12, 1000) == 16   # Cultural share 4k/250k


def test_sparql_list_query_shape():
    q = s1.sparql_list_query(["Q11424"], 20, 100, 50)
    assert "wd:Q11424" in q and "LIMIT 100 OFFSET 50" in q
    assert "wikibase:sitelinks" in q


def test_cirrus_topup_parsing_and_dedupe(monkeypatch):
    pages = [
        {"query": {"search": [{"title": "Q101"}, {"title": "Q102"},
                              {"title": "Talk:Q999"}]},
         "continue": {"sroffset": 50}},
        {"query": {"search": [{"title": "Q102"}, {"title": "Q103"}]}},
    ]
    calls = {"n": 0}

    def fake_api_get(params):
        page = pages[min(calls["n"], len(pages) - 1)]
        calls["n"] += 1
        assert "haswbstatement:P31=Q16521" in params["srsearch"]
        return page

    monkeypatch.setattr(s1, "api_get", fake_api_get)
    rows = {"Q101": {"qid": "Q101"}}
    report = {"api_calls": 0, "errors": []}
    added = s1.cirrus_topup(5, 2, rows, report)
    assert added == 2  # Q102 (page 1), Q103 (page 2); Q101 pre-existing
    assert set(rows) == {"Q101", "Q102", "Q103"}
    assert rows["Q102"]["dom"] == 5 and rows["Q102"]["seed"] == "Q16521"


# --------------------------------------------------------------- Stage 2

def test_notability_bounds_and_monotonicity():
    assert s2.notability_score(0, 0) == 0
    assert 0 <= s2.notability_score(3, 2) <= 65535
    assert s2.notability_score(100, 40) > s2.notability_score(10, 5)
    assert s2.notability_score(10**6, 10**5) == 65535  # clamped
    assert s2.tier_of(60000) == "Household Icon"
    assert s2.tier_of(0) == "Extreme Obscurity"


# --------------------------------------------------------------- Stage 3

def test_parse_wikidata_year():
    assert s3.parse_wikidata_year("+1969-07-20T00:00:00Z") == 1969
    assert s3.parse_wikidata_year("-0100-07-13T00:00:00Z") == -100
    assert s3.parse_wikidata_year("nonsense") is None
    assert s3.parse_wikidata_year(None) is None


def test_pick_year_priority():
    claims = {
        "P569": [{"mainsnak": {"datavalue": {"value": {
            "time": "+1906-12-09T00:00:00Z"}}}}],
        "P571": [{"mainsnak": {"datavalue": {"value": {
            "time": "+1958-01-01T00:00:00Z"}}}}],
    }
    assert s3.pick_year(claims) == 1958  # P571 outranks P569
    assert s3.pick_year({}) is None


def test_year_clamped_to_int32_record_range():
    deep = {"P571": [{"mainsnak": {"datavalue": {"value": {
        "time": "-13800000000-01-01T00:00:00Z"}}}}]}
    assert s3.pick_year(deep) == s3.YEAR_MIN  # galaxy formation clamps
    assert s3.clamp_year(None) is None
    assert s3.clamp_year(1969) == 1969


def test_normalize_coords():
    assert s3.normalize_coords(48.85, 2.35) == (48.85, 2.35)
    assert s3.normalize_coords(None, 2.35) == (None, None)
    assert s3.normalize_coords(999, 0) == (None, None)


# --------------------------------------------------------------- Stage 5

def _row(**kw):
    base = {"name": "Apollo 11", "year": 1969, "lat": 28.5, "lon": -80.6,
            "dom": 3, "class_label": "spaceflight mission",
            "description": "crewed lunar landing mission",
            "tier": "Famous", "sitelinks": 120}
    base.update(kw)
    return base


def test_synthesized_clues_pass_audit():
    rows = [
        _row(),
        _row(name="Marie Curie", year=1867, lat=52.2, lon=21.0, dom=3,
             class_label="physicist", description="Polish physicist"),
        _row(name="Giant Panda", year=None, lat=None, lon=None, dom=5,
             class_label="species", description=None, tier="Notable",
             sitelinks=90),
    ]
    for r in rows:
        clues = s5.synthesize_clues(
            r, neighbours=[("Science & Technology", 1958)])
        ent = {"name": r["name"], "clues": clues}
        assert s5.audit_leakage([ent]) == [], (r["name"], clues)
        assert set(clues) == {"alpha", "beta", "gamma", "delta", "epsilon"}


def test_description_leak_falls_back():
    # Description containing the entity's own name token must be replaced.
    clues = s5.synthesize_clues(_row(description="the Apollo programme"))
    assert "apollo" not in clues["epsilon"].lower().split()


# ---------------------------------------------------- Stage 6 multi-pack

def _synthetic_entities(count):
    ents = []
    for i in range(count):
        dom = (i % 12) + 1
        ents.append({
            "name": f"Entity {i:05d}", "sub": "Synthetic",
            "year": 1900 + (i % 100), "lat": 10.0, "lon": 20.0,
            "dom": dom, "subdom": 1, "notability": 5000,
            "cluster": 42, "alt": [],
            "clues": {c: f"clue {c} for entry {i}" for c in
                      ("alpha", "beta", "gamma", "delta", "epsilon")},
            "edges": [],
        })
    return ents


def test_multi_pack_and_validation(tmp_path):
    ents = _synthetic_entities(2500)
    out = str(tmp_path / "v1")
    manifest = s6.pack(ents, version="test", corpus="synthetic",
                       out_dir=out)
    assert manifest["entity_count"] == 2500
    assert manifest["packs_count"] == 3
    assert manifest["min_outgoing_edges"] >= 4
    with open(os.path.join(out, "manifest.json")) as fh:
        on_disk = json.load(fh)
    assert on_disk["entity_count"] == 2500
    ok, summary = validate_dataset.validate(out)
    assert ok, summary
