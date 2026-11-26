#!/usr/bin/env bash
# Blueprint §6: exports compiled sprite atlases into public/assets.
# Packs every PNG in art-source/generated (or a given directory) into a
# single grid atlas + JSON index using Pillow. Programmatic sprites
# (VEX-09, glyphs) are compiled from code and need no atlas.
set -euo pipefail
SRC_DIR="${1:-art-source/generated}"
OUT_DIR="${2:-public/assets}"
mkdir -p "$OUT_DIR"
python3 - "$SRC_DIR" "$OUT_DIR" <<'PY'
import json, math, sys
from pathlib import Path
from PIL import Image

src, out = Path(sys.argv[1]), Path(sys.argv[2])
files = sorted(src.glob("*.png"))
if not files:
    print("no PNG masters found in", src); raise SystemExit(0)
imgs = [(f.name, Image.open(f).convert("RGBA")) for f in files]
cols = math.ceil(math.sqrt(len(imgs)))
cell_w = max(im.width for _, im in imgs)
cell_h = max(im.height for _, im in imgs)
rows = math.ceil(len(imgs) / cols)
atlas = Image.new("RGBA", (cols * cell_w, rows * cell_h), (0, 0, 0, 0))
index = {}
for i, (name, im) in enumerate(imgs):
    x, y = (i % cols) * cell_w, (i // cols) * cell_h
    atlas.paste(im, (x, y))
    index[name] = {"x": x, "y": y, "w": im.width, "h": im.height}
atlas.save(out / "atlas.png")
(out / "atlas.json").write_text(json.dumps(index, indent=2))
print(f"atlas: {len(imgs)} sprites -> {out}/atlas.png ({atlas.width}x{atlas.height})")
PY
