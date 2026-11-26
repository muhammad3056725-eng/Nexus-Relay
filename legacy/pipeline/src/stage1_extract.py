# -*- coding: utf-8 -*-
"""
NEXUS RELAY — Pipeline Stage 1: Multi-Source Extraction
=========================================================
Blueprint §5 Stage 1 + §4 domain distribution table. Pulls real
entities from Wikidata in two passes:

  Pass 1 (SPARQL, query.wikidata.org): per domain, a light list query
  over direct instance-of (P31) seed classes, ordered by sitelinks
  DESC — the corpus is built most-notable-first. Direct P31 + a
  sitelinks floor is deliberate: subclass-closure (P31/P279*) queries
  and closure-VALUES queries time out on WDQS (measured Nov 2026),
  while direct-seed queries complete in seconds.

  Pass 2 (Wikidata API, wbgetentities): batches of 50 QIDs for
  labels, descriptions, sitelinks and full claims — from which the
  year anchor (Stage 3), coordinates, graph edges and class labels
  are derived. The API is a separate service from WDQS with generous
  limits; WDQS itself rate-limits to ~1 heavy query/minute, so
  SPARQL calls are paced >= 61 s apart (persisted across runs in the
  state file) and retried with backoff on 429/503/504.

Resumability: fetched rows are appended to corpus/raw_entities.jsonl
(deduped by QID, first domain wins) and per-domain SPARQL offsets are
kept in corpus/stage1_state.json. Re-running with a larger stage
target fetches only the shortfall. Enrichment is a separate flag on
each row, so an interrupted run resumes where it stopped.

Outputs (under pipeline/corpus/, git-ignored working state):
  raw_entities.jsonl  one JSON object per fetched entity
  stage1_state.json   offsets, pacing timestamp, counters
  prop_labels.json    Wikidata property id -> English label cache
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stage3_normalize  # noqa: E402

SPARQL_URL = "https://query.wikidata.org/sparql"
API_URL = "https://www.wikidata.org/w/api.php"
USER_AGENT = "NexusRelay/0.2 (dataset pipeline; github.com/muhammad3056725-eng/Nexus-Relay)"
SPARQL_MIN_INTERVAL = 61.0   # WDQS aggressive rate limit: 1 req/min
SPARQL_TIMEOUT = 90
API_PAUSE = 0.25

# Blueprint §4 domain table: target counts at the full 250k corpus.
BLUEPRINT_DOMAIN_TARGETS = {
    1: 35000, 2: 35000, 3: 30000, 4: 30000, 5: 25000, 6: 22000,
    7: 20000, 8: 18000, 9: 15000, 10: 10000, 11: 6000, 12: 4000,
}
BLUEPRINT_TOTAL = sum(BLUEPRINT_DOMAIN_TARGETS.values())  # 250000

# Staged growth targets (cumulative corpus size, starter included).
STAGE_TARGETS = {"A": 1000, "B": 10000, "C": 50000, "D": 250000}

# dom -> (seed classes for direct P31, min sitelinks floor)
# Seeds are well-populated Wikidata classes; their English labels are
# verified live on first use and recorded in the fetch report.
DOMAIN_SEEDS = {
    1: (["Q198", "Q178561", "Q10931"], 15),          # war, battle, revolution
    2: (["Q515", "Q6256", "Q8502", "Q4022", "Q23413"], 20),  # city, country, mountain, river, castle
    3: (["Q11344", "Q68", "Q8366", "Q7397"], 15),    # chemical element, computer, algorithm, software
    4: (["Q11424", "Q5398426", "Q33999", "Q2526255"], 20),   # film, TV series, actor, film director
    5: (["Q16521"], 60),                             # taxon (huge class: high floor)
    6: (["Q482994", "Q7366", "Q36834", "Q215380"], 20),      # album, song, composer, band
    7: (["Q7725634", "Q8261", "Q47461344"], 15),     # literary work, novel, written work
    8: (["Q349", "Q7889", "Q131436"], 15),           # sport, video game, board game
    9: (["Q838948", "Q3305213", "Q33506", "Q860861"], 15),   # work of art, painting, museum, sculpture
    10: (["Q178885", "Q5891"], 10),                  # deity, philosophy
    11: (["Q634", "Q3863", "Q8928", "Q523", "Q318"], 10),    # planet, asteroid, constellation, star, galaxy (tractable classes first: star/galaxy scans time out and are served by the Cirrus layer)
    12: (["Q8192", "Q2095"], 8),                     # writing system, food
}


def domain_quota(dom, stage_target):
    share = BLUEPRINT_DOMAIN_TARGETS[dom] / BLUEPRINT_TOTAL
    return int(round(share * stage_target))


# --------------------------------------------------------------------- HTTP

def _request_json(url, timeout=60):
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


class SparqlClient:
    """SPARQL client honouring the WDQS 1 req/min aggressive limit."""

    def __init__(self, state):
        self.state = state

    def _pace(self):
        last = self.state.get("last_sparql_ts", 0)
        wait = SPARQL_MIN_INTERVAL - (time.time() - last)
        if wait > 0:
            time.sleep(wait)

    def query(self, sparql):
        url = SPARQL_URL + "?" + urllib.parse.urlencode(
            {"query": sparql, "format": "json"})
        last_err = None
        for attempt in range(3):
            self._pace()
            self.state["last_sparql_ts"] = time.time()
            try:
                data = _request_json(url, timeout=SPARQL_TIMEOUT)
                return data["results"]["bindings"]
            except Exception as err:  # 429/503/504/timeout: back off a minute
                last_err = err
                if attempt < 2:
                    time.sleep(65)
        raise RuntimeError(f"SPARQL failed after 3 attempts: {last_err}")


def api_get(params, retries=3):
    url = API_URL + "?" + urllib.parse.urlencode(params)
    last_err = None
    for attempt in range(retries):
        try:
            time.sleep(API_PAUSE)
            return _request_json(url, timeout=60)
        except Exception as err:
            last_err = err
            if attempt < retries - 1:
                time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"Wikidata API failed after {retries} attempts: {last_err}")


# ------------------------------------------------------------------- corpus

def corpus_paths(corpus_dir):
    return {
        "raw": os.path.join(corpus_dir, "raw_entities.jsonl"),
        "state": os.path.join(corpus_dir, "stage1_state.json"),
        "props": os.path.join(corpus_dir, "prop_labels.json"),
    }


def load_raw(corpus_dir):
    path = corpus_paths(corpus_dir)["raw"]
    rows = []
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    rows.append(json.loads(line))
    return rows


def save_raw(corpus_dir, rows):
    os.makedirs(corpus_dir, exist_ok=True)
    path = corpus_paths(corpus_dir)["raw"]
    with open(path, "w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def load_state(corpus_dir):
    path = corpus_paths(corpus_dir)["state"]
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    return {"last_sparql_ts": 0, "domains": {}}


def save_state(corpus_dir, state):
    os.makedirs(corpus_dir, exist_ok=True)
    with open(corpus_paths(corpus_dir)["state"], "w", encoding="utf-8") as fh:
        json.dump(state, fh, indent=1)


def load_prop_labels(corpus_dir):
    path = corpus_paths(corpus_dir)["props"]
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    return {}


def save_prop_labels(corpus_dir, labels):
    os.makedirs(corpus_dir, exist_ok=True)
    with open(corpus_paths(corpus_dir)["props"], "w", encoding="utf-8") as fh:
        json.dump(labels, fh, ensure_ascii=False, indent=0)


# -------------------------------------------------------------- pass 1: list

def sparql_list_query(seeds, floor, limit, offset):
    values = " ".join(f"wd:{s}" for s in seeds)
    return f"""
SELECT ?item ?sitelinks ?seed WHERE {{
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= {floor})
  VALUES ?seed {{ {values} }}
  ?item wdt:P31 ?seed .
}}
ORDER BY DESC(?sitelinks) ?item
LIMIT {limit} OFFSET {offset}
"""


def _sparql_pages(client, dom, seeds, floor, want_new, rows_by_qid,
                  report, start_offset):
    """Paging loop over one SPARQL list query. Returns
    (added, end_offset, error_or_None); never raises."""
    added = 0
    offset = start_offset
    while added < want_new:
        page = min(500, (want_new - added) + 50)  # slack for dupes
        sparql = sparql_list_query(seeds, floor, page, offset)
        try:
            bindings = client.query(sparql)
        except RuntimeError as err:
            return added, offset, str(err)
        report["sparql_calls"] += 1
        if not bindings:
            break
        offset += len(bindings)
        for b in bindings:
            qid = b["item"]["value"].rsplit("/", 1)[-1]
            if qid in rows_by_qid:
                continue
            rows_by_qid[qid] = {
                "qid": qid, "dom": dom,
                "seed": b["seed"]["value"].rsplit("/", 1)[-1],
                "sitelinks": int(b["sitelinks"]["value"]),
                "enriched": False,
            }
            added += 1
            if added >= want_new:
                break
        if len(bindings) < page:
            break  # exhausted at this floor
    return added, offset, None


def fetch_domain(client, state, dom, want_new, rows_by_qid, report):
    """Fetch up to want_new NEW entities for one domain.

    Layer 1: one SPARQL query over all seed classes (VALUES), paged
    from the persisted offset. Layer 2 (only if layer 1's first page
    fails outright): per-seed SPARQL queries — one giant class (star,
    galaxy, taxon) timing out must not poison the whole domain.
    Layer 3 lives in fetch_stage (Cirrus top-up)."""
    seeds, floor = DOMAIN_SEEDS[dom]
    dstate = state["domains"].setdefault(str(dom), {"sparql_offset": 0})
    added, end_offset, err = _sparql_pages(
        client, dom, seeds, floor, want_new, rows_by_qid, report,
        dstate["sparql_offset"])
    dstate["sparql_offset"] = end_offset
    if err is not None and added == 0 and len(seeds) > 1:
        report["errors"].append(
            f"domain {dom}: combined SPARQL failed ({err}); "
            "per-seed fallback")
        for seed in seeds:
            if added >= want_new:
                break
            a, _o, e2 = _sparql_pages(
                client, dom, [seed], floor, want_new - added,
                rows_by_qid, report, 0)
            added += a
            if e2 is not None and a == 0:
                report["errors"].append(
                    f"domain {dom} seed {seed}: {e2}")
    elif err is not None:
        report["errors"].append(f"domain {dom}: {err}")
    return added


def cirrus_topup(dom, want_new, rows_by_qid, report):
    """Layer 3 list pass via the MediaWiki CirrusSearch index
    (haswbstatement:P31=<seed>) for seed classes whose SPARQL scan
    times out on WDQS (taxon ~3M members, star, galaxy). Results come
    in Cirrus relevance order; sitelinks are filled by enrichment.
    Returns the number of NEW rows added."""
    seeds, _floor = DOMAIN_SEEDS[dom]
    added = 0
    for seed in seeds:
        if added >= want_new:
            break
        offset = 0
        while added < want_new:
            data = api_get({
                "action": "query", "list": "search",
                "srsearch": f"haswbstatement:P31={seed}",
                "srnamespace": 0, "srlimit": 50, "sroffset": offset,
                "format": "json",
            })
            report["api_calls"] += 1
            hits = data.get("query", {}).get("search", [])
            if not hits:
                break
            for h in hits:
                title = h.get("title", "")
                if not (title.startswith("Q") and title[1:].isdigit()):
                    continue
                if title in rows_by_qid:
                    continue
                rows_by_qid[title] = {
                    "qid": title, "dom": dom, "seed": seed,
                    "sitelinks": 0, "enriched": False,
                }
                added += 1
                if added >= want_new:
                    break
            cont = data.get("continue", {})
            if "sroffset" not in cont:
                break
            offset = cont["sroffset"]
    if added:
        report.setdefault("cirrus_topups", {})[dom] = added
    return added


# ---------------------------------------------------------- pass 2: enrich

def _claim_targets(claims):
    """{prop: [target_qid, ...]} for wikibase-item valued claims only."""
    out = {}
    for prop, claim_list in claims.items():
        targets = []
        for claim in claim_list:
            snak = claim.get("mainsnak", {})
            if snak.get("snaktype") != "value":
                continue
            dv = snak.get("datavalue", {})
            if dv.get("type") == "wikibase-entityid":
                targets.append(dv["value"]["id"])
        if targets:
            out[prop] = targets
    return out


def _coords(claims):
    for claim in claims.get("P625", []):
        dv = claim.get("mainsnak", {}).get("datavalue", {})
        if dv.get("type") == "globecoordinate":
            v = dv["value"]
            return v.get("latitude"), v.get("longitude")
    return None, None


def enrich_rows(corpus_dir, rows, report):
    """Fill name/desc/year/coords/claims for every unenriched row."""
    pending = [r for r in rows if not r.get("enriched")]
    if not pending:
        return
    class_qids = set()
    for i in range(0, len(pending), 50):
        batch = pending[i:i + 50]
        data = api_get({
            "action": "wbgetentities",
            "ids": "|".join(r["qid"] for r in batch),
            "props": "labels|descriptions|claims|sitelinks",
            "languages": "en",
            "format": "json",
        })
        report["api_calls"] += 1
        entities = data.get("entities", {})
        for row in batch:
            ent = entities.get(row["qid"])
            if ent is None or "missing" in ent:
                row.update({"name": None, "enriched": True})
                continue
            claims = ent.get("claims", {})
            row["name"] = (ent.get("labels", {}).get("en", {})
                           .get("value"))
            row["desc"] = (ent.get("descriptions", {}).get("en", {})
                           .get("value"))
            row["sitelinks"] = len(ent.get("sitelinks", {}))
            row["year"] = stage3_normalize.pick_year(claims)
            lat, lon = _coords(claims)
            row["lat"], row["lon"] = stage3_normalize.normalize_coords(lat, lon)
            row["claims"] = _claim_targets(claims)
            p31 = row["claims"].get("P31", [])
            row["class_qid"] = p31[0] if p31 else row.get("seed")
            if row["class_qid"]:
                class_qids.add(row["class_qid"])
            row["enriched"] = True
    # Class labels (for Stage 5 gamma clues), one batched call per 50.
    labels = load_prop_labels(corpus_dir)
    missing = [q for q in class_qids if f"label:{q}" not in labels]
    for i in range(0, len(missing), 50):
        batch = missing[i:i + 50]
        data = api_get({
            "action": "wbgetentities",
            "ids": "|".join(batch),
            "props": "labels",
            "languages": "en",
            "format": "json",
        })
        report["api_calls"] += 1
        for qid, ent in data.get("entities", {}).items():
            lab = ent.get("labels", {}).get("en", {}).get("value")
            if lab:
                labels[f"label:{qid}"] = lab
    for row in rows:
        cq = row.get("class_qid")
        if cq:
            row["class_label"] = labels.get(f"label:{cq}")
    save_prop_labels(corpus_dir, labels)


def ensure_property_labels(corpus_dir, prop_ids, report):
    """Fetch + cache English labels for claim property ids (rel names)."""
    labels = load_prop_labels(corpus_dir)
    missing = [p for p in prop_ids if p not in labels]
    for i in range(0, len(missing), 50):
        batch = missing[i:i + 50]
        data = api_get({
            "action": "wbgetentities",
            "ids": "|".join(batch),
            "props": "labels",
            "languages": "en",
            "format": "json",
        })
        report["api_calls"] += 1
        for pid, ent in data.get("entities", {}).items():
            lab = ent.get("labels", {}).get("en", {}).get("value")
            if lab:
                labels[pid] = lab
    save_prop_labels(corpus_dir, labels)
    return labels


def verify_seed_labels(report):
    """Record the live English label of every seed class (audit trail:
    a wrong seed QID shows up here immediately)."""
    seeds = sorted({s for seeds_, _ in DOMAIN_SEEDS.values() for s in seeds_})
    data = api_get({
        "action": "wbgetentities",
        "ids": "|".join(seeds),
        "props": "labels",
        "languages": "en",
        "format": "json",
    })
    report["api_calls"] += 1
    out = {}
    for qid, ent in data.get("entities", {}).items():
        out[qid] = ent.get("labels", {}).get("en", {}).get("value")
    report["seed_labels"] = out
    return out


# ------------------------------------------------------------------- driver

def fetch_stage(stage, corpus_dir, have_counts):
    """Grow the raw corpus toward STAGE_TARGETS[stage].

    have_counts: {dom: entities already in the final corpus from other
    sources (the starter set)}. Returns a report dict with honest
    per-domain counts and every error encountered.
    """
    target = STAGE_TARGETS[stage]
    rows = load_raw(corpus_dir)
    rows_by_qid = {r["qid"]: r for r in rows}
    state = load_state(corpus_dir)
    report = {"stage": stage, "target": target, "sparql_calls": 0,
              "api_calls": 0, "errors": [], "domains": {}}
    verify_seed_labels(report)
    client = SparqlClient(state)
    # Count ALL raw rows per domain, including not-yet-enriched ones:
    # they are already fetched and will be kept unless enrichment finds
    # no English label (rare). Counting only named rows would make a
    # resumed run re-fetch a whole extra page per domain.
    kept_by_dom = {}
    for r in rows:
        kept_by_dom[r["dom"]] = kept_by_dom.get(r["dom"], 0) + 1
    for dom in range(1, 13):
        quota = domain_quota(dom, target)
        have = have_counts.get(dom, 0) + kept_by_dom.get(dom, 0)
        want_new = max(0, quota - have)
        added = 0
        if want_new:
            added = fetch_domain(client, state, dom, want_new,
                                 rows_by_qid, report)
            if added < want_new:
                added += cirrus_topup(dom, want_new - added,
                                      rows_by_qid, report)
            save_raw(corpus_dir, list(rows_by_qid.values()))
            save_state(corpus_dir, state)
        report["domains"][dom] = {
            "quota": quota, "have_before": have,
            "fetched_new": added,
        }
    rows = list(rows_by_qid.values())
    enrich_rows(corpus_dir, rows, report)
    save_raw(corpus_dir, rows)
    save_state(corpus_dir, state)
    kept = {}
    for r in rows:
        if r.get("name"):
            kept[r["dom"]] = kept.get(r["dom"], 0) + 1
    for dom in range(1, 13):
        report["domains"][dom]["kept_total"] = (
            have_counts.get(dom, 0) + kept.get(dom, 0))
    report["raw_rows"] = len(rows)
    report["kept_rows"] = sum(kept.values())
    return report
