"""Remove text under rectangles, keeping images and vector graphics.

Usage: redact.py <in.pdf> <out.pdf> <rects.json>
rects.json: [{"page": 0, "rect": [x0, y0, x1, y1]}, ...] in PDF user space (y up).
"""
import json
import sys

import pymupdf

src, dst, rects_path = sys.argv[1:4]
with open(rects_path, encoding="utf-8") as f:
    rects = json.load(f)

doc = pymupdf.open(src)
touched = set()
for item in rects:
    page = doc[int(item["page"])]
    x0, y0, x1, y1 = (float(v) for v in item["rect"])
    # PDF space -> MuPDF's unrotated, top-left page space
    r = (pymupdf.Rect(x0, y0, x1, y1) * page.transformation_matrix).normalize()
    page.add_redact_annot(r, fill=False, cross_out=False)
    touched.add(page.number)

for n in touched:
    doc[n].apply_redactions(
        images=pymupdf.PDF_REDACT_IMAGE_NONE,
        graphics=pymupdf.PDF_REDACT_LINE_ART_NONE,
        text=pymupdf.PDF_REDACT_TEXT_REMOVE,
    )

doc.save(dst, garbage=3, deflate=True)
