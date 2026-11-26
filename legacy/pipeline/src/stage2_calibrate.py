# -*- coding: utf-8 -*-
"""
NEXUS RELAY — Pipeline Stage 2: Notability & Obscurity Calibration
===================================================================
Blueprint §5 Stage 2. Composite Notability Score on the uint16 scale:

    S_n = clamp( ( w1*log10(V_wiki) + w2*log10(D_graph) + w3*L_sitelinks )
                 * 1000, 0, 65535 )

The blueprint fixes the formula's shape and scale but leaves the
weights w1..w3 open. Calibration used here (documented, deterministic):

    w1 = 1.0, w2 = 0.8, w3 = 0.55
    V_wiki (pageview-scale reach) is proxied by sitelinks * 10000 —
    per-article pageview pulls for tens of thousands of entities are
    not feasible in this pipeline; sitelinks is the reach signal
    Wikidata itself exposes per entity and correlates strongly with
    pageviews. D_graph is the entity's raw claim degree (outgoing
    item-valued claims + inbound claims from inside the fetched
    corpus), the pre-pruning stand-in for graph degree.

Tier thresholds match the web client exactly
(packages/shared-types NOTABILITY_TIERS).
"""
import math

W1, W2, W3 = 1.0, 0.8, 0.55
PAGEVIEW_PROXY_PER_SITELINK = 10000

TIERS = [
    (50000, "Household Icon"),
    (35000, "Famous"),
    (20000, "Notable"),
    (10000, "Specialized"),
    (4000, "Deep Cult"),
    (0, "Extreme Obscurity"),
]


def notability_score(sitelinks, degree):
    """Blueprint Stage 2 composite score, uint16 range [0, 65535]."""
    sitelinks = max(0, int(sitelinks or 0))
    degree = max(0, int(degree or 0))
    v_wiki = max(1, sitelinks * PAGEVIEW_PROXY_PER_SITELINK)
    raw = (W1 * math.log10(v_wiki)
           + W2 * math.log10(degree + 1)
           + W3 * sitelinks) * 1000
    return max(0, min(65535, int(round(raw))))


def tier_of(score):
    for floor, name in TIERS:
        if score >= floor:
            return name
    return "Extreme Obscurity"
