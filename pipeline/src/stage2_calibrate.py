"""Stage 2 — Notability & Obscurity Calibration (Blueprint §5).

Composite index:  S_n = clamp((w1*log10(V_wiki) + w2*log10(D_graph)
                              + w3*L_sitelinks) * 1000, 0, 65535)
Tiers: Household Icon / Famous / Notable / Specialized / Deep Cult /
Extreme Obscurity. Tier thresholds used by the web client live in
packages/shared-types/src/binary-schema.js (NOTABILITY_TIERS).

Phase 1 status: starter corpus carries hand-calibrated scores on this
exact 0-65535 scale; automated calibration arrives with Stage 1.
"""
raise SystemExit("Stage 2 automated calibration not yet implemented "
                 "(Week 2 milestone).")
