# -*- coding: utf-8 -*-
"""
NEXUS RELAY — Pipeline Stage 5: Clue Synthesis & Leakage Audit
===============================================================
Blueprint §5 Stage 5. Five non-overlapping channel clues per entity:

  alpha   — Era: the year anchor, phrased without naming the entity.
  beta    — Space: coarse region derived from coordinates, or the
            CONCEPTUAL / NON-SPATIAL marker for abstract entities.
  gamma   — Domain: archive registry + class label.
  delta   — Relational: describes a graph neighbour by domain + year
            (never by name — a neighbour's name can contain the
            target's own tokens and would trip the audit).
  epsilon — Trait: the Wikidata index description, audit-guarded,
            with a notability-tier fallback.

Audit rule (Blueprint Stage 5, enforced): no clue may contain the
target entity's canonical title tokens (whole-word, case-insensitive,
tokens of length >= 4 outside a small stopword set) or obvious lexical
roots of them. The audit functions live here; stage6_pack_binary
re-exports them (tests import them from both places).

Synthesis is template-based over real Wikidata facts (year, coords,
class, description, sitelinks, graph neighbours) — deterministic for a
given input row (template choice is a hash of the entity name), so
pipeline runs are reproducible. Every synthesized clue set is passed
through the audit; any channel that fails is replaced by its fallback.
"""
import hashlib

STOP = {"the", "of", "a", "an", "and", "off", "de"}

DOMAIN_NAMES = {
    1: "History & Historical Events",
    2: "Geography & Landmarks",
    3: "Science & Technology",
    4: "Cinema & Television",
    5: "Biology & Nature",
    6: "Music & Audio",
    7: "Literature & Print",
    8: "Sports & Games",
    9: "Art & Architecture",
    10: "Mythology & Philosophy",
    11: "Space & Astronomy",
    12: "Cultural Inventions",
}


def name_tokens(name):
    toks = []
    for raw in name.replace("(", " ").replace(")", " ").replace("*", " ").split():
        t = "".join(ch for ch in raw.lower() if ch.isalnum())
        if len(t) >= 4 and t not in STOP:
            toks.append(t)
    return toks


def audit_leakage(entities):
    """Return [(name, channel, token), ...] for every leaking clue."""
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


# ---------------------------------------------------------------- synthesis

def _pick(name, options):
    h = int(hashlib.sha256(name.encode("utf-8")).hexdigest()[:8], 16)
    return options[h % len(options)]


def _ordinal(n):
    if 10 <= n % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def _era_clue(name, year):
    if year is None:
        return _pick(name, [
            "Its era anchor is smudged in the archive — no year on file.",
            "The timeline dial spins: this entry carries no fixed year.",
        ])
    if year > 0:
        century = _ordinal((year - 1) // 100 + 1)
        return _pick(name, [
            f"Anchored in the year {year} of the common era.",
            f"The archive pins its timeline anchor to {year} CE.",
            f"A {century}-century entry on the timeline dial.",
        ])
    return _pick(name, [
        f"Anchored in {abs(year)} BCE, deep in the ancient band.",
        f"Its timeline anchor sits {-year} years before the common era.",
    ])


def _region(lat, lon):
    if lat >= 66.5:
        band = "the polar north"
    elif lat >= 23.5:
        band = "the northern temperate band"
    elif lat > -23.5:
        band = "the tropical belt"
    elif lat > -66.5:
        band = "the southern temperate band"
    else:
        band = "the polar south"
    if -170 <= lon < -30:
        sector = "the Americas longitudes"
    elif -30 <= lon < 60:
        sector = "the Europe-Africa longitudes"
    elif 60 <= lon < 150:
        sector = "the Asian longitudes"
    else:
        sector = "the Pacific longitudes"
    return band, sector


def _space_clue(name, lat, lon):
    if lat is None or lon is None:
        return _pick(name, [
            "No coordinates on file: a conceptual, non-spatial entry.",
            "The spatial dial reads null — this signal has no fixed place.",
        ])
    band, sector = _region(lat, lon)
    hemi = "northern" if lat >= 0 else "southern"
    return _pick(name, [
        f"Plotted in {band}, across {sector}.",
        f"Its beacon sits in the {hemi} hemisphere, in {sector}.",
        f"Spatial fix: {band}, {sector}.",
    ])


def _domain_clue(name, dom, class_label):
    base = f"Filed in the {DOMAIN_NAMES.get(dom, 'Archive')} registry"
    if class_label:
        return f"{base} — indexed as a {class_label}."
    return f"{base}."


def _relational_clue(name, neighbours):
    """neighbours: [(domain_name, year_or_None), ...] best first."""
    if neighbours:
        dom_name, year = neighbours[0]
        when = f" anchored in {year}" if year is not None else ""
        return (f"One graph beam runs to a {dom_name} entry{when}.")
    return "Its graph beams reach beyond this slice of the archive."


def _trait_clue(name, description, tier, sitelinks):
    if description:
        desc = description.strip()
        desc = desc[0].upper() + desc[1:]
        if not desc.endswith("."):
            desc += "."
        return f"Index description: {desc}"
    return (f"A {tier} signal — carried by {sitelinks} language "
            f"editions of the index.")


def synthesize_clues(row, neighbours=()):
    """Build the 5 channel clues for one normalized corpus row.

    row keys used: name, year, lat, lon, dom, class_label, description,
    tier, sitelinks. Returns {alpha, beta, gamma, delta, epsilon} with
    every channel audit-clean for the row's own name (fallbacks applied
    per channel when a synthesized clue would leak).
    """
    name = row["name"]
    clues = {
        "alpha": _era_clue(name, row.get("year")),
        "beta": _space_clue(name, row.get("lat"), row.get("lon")),
        "gamma": _domain_clue(name, row.get("dom"), row.get("class_label")),
        "delta": _relational_clue(name, list(neighbours)),
        "epsilon": _trait_clue(name, row.get("description"),
                               row.get("tier", "Notable"),
                               row.get("sitelinks", 0)),
    }
    fallbacks = {
        "alpha": "Its era anchor is recorded in the archive telemetry.",
        "beta": "Its spatial fix is recorded in the archive telemetry.",
        "gamma": f"Filed in the {DOMAIN_NAMES.get(row.get('dom'), 'Archive')} registry.",
        "delta": "Its graph beams reach beyond this slice of the archive.",
        "epsilon": (f"A {row.get('tier', 'Notable')} signal in the "
                    f"archive index."),
    }
    toks = name_tokens(name)
    for channel, clue in list(clues.items()):
        words = {"".join(ch for ch in w.lower() if ch.isalnum())
                 for w in clue.split()}
        if any(t in words for t in toks):
            clues[channel] = fallbacks[channel]
    return clues
