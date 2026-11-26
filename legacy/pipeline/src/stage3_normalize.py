# -*- coding: utf-8 -*-
"""
NEXUS RELAY — Pipeline Stage 3: Spatial & Temporal Normalization
=================================================================
Blueprint §5 Stage 3. Standardizes the raw Wikidata facts used by the
corpus:

  * Dates -> a single signed integer year anchor. Corpus convention
    (matching the shipped starter corpus in dataset_starter.py, e.g.
    Julius Caesar = -100, Founding of Rome = -753): the year is the
    signed historical year exactly as Wikidata stores it — BCE years
    are negative with the same magnitude (100 BCE -> -100). One
    convention is applied uniformly; telemetry only ever compares
    deltas, so internal consistency is what matters.
  * Coordinates -> validated (lat, lon) floats, or (None, None) which
    the telemetry packer stores as NaN = CONCEPTUAL / NON-SPATIAL
    (Blueprint Stage 3: abstract concepts carry no coordinates).
"""
import re

_TIME_RE = re.compile(r"^([+-]?\d+)-")


def parse_wikidata_year(time_value):
    """Extract the signed year int from a Wikidata time string.

    Wikidata times look like '+1969-07-20T00:00:00Z' or
    '-0100-07-13T00:00:00Z'. Returns None when unparseable.
    """
    if not time_value or not isinstance(time_value, str):
        return None
    m = _TIME_RE.match(time_value.strip())
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


# Date-bearing properties, in priority order, used to pick an entity's
# year anchor from its claims (Stage 1 fetches them all).
DATE_PROPERTIES = [
    "P585",   # point in time (events)
    "P571",   # inception (works, organizations, places)
    "P575",   # date of discovery / invention (elements, species, tech)
    "P569",   # date of birth (people)
    "P577",   # publication / release date
    "P580",   # start time
    "P570",   # date of death (fallback for people without a birth date)
]


# The Stage 6 telemetry record stores the year as a signed int32, so
# deep-time Wikidata anchors (a galaxy's formation at -13.8 billion
# years) physically cannot be represented. Years are clamped to
# +/-2 billion — far outside any human-scale ERA telemetry anyway.
YEAR_MIN, YEAR_MAX = -2_000_000_000, 2_000_000_000


def clamp_year(year):
    """Clamp a year into the telemetry record's int32-safe range."""
    if year is None:
        return None
    return max(YEAR_MIN, min(YEAR_MAX, int(year)))


def pick_year(claims):
    """claims: {property_id: [raw API claim, ...]}. Returns the first
    parseable year by DATE_PROPERTIES priority, or None."""
    for prop in DATE_PROPERTIES:
        for claim in claims.get(prop, []):
            try:
                tv = claim["mainsnak"]["datavalue"]["value"]["time"]
            except (KeyError, TypeError):
                continue
            year = parse_wikidata_year(tv)
            if year is not None:
                return clamp_year(year)
    return None


def normalize_coords(lat, lon):
    """Validate a coordinate pair; returns (lat, lon) or (None, None)."""
    if lat is None or lon is None:
        return None, None
    try:
        lat = float(lat)
        lon = float(lon)
    except (TypeError, ValueError):
        return None, None
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        return None, None
    return lat, lon
