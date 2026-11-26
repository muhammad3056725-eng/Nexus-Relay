"""Stage 3 — Spatial & Temporal Normalization (Blueprint §5).

Rules implemented by the starter corpus and enforced by the packer:
  * Years are signed astronomical years (44 BCE == -43).
  * Historical regions map to modern lat/lon centroids.
  * Abstract concepts carry NaN coordinates and surface in-game as
    CONCEPTUAL / NON-SPATIAL on the BETA axis.

Phase 1 status: normalization is embodied in dataset_starter.py values;
the automated GeoNames centroid resolver is a Week 2 milestone.
"""
raise SystemExit("Stage 3 automated normalization not yet implemented "
                 "(Week 2 milestone).")
