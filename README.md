# PDFDesk by Musme

<img src="public/brand/musme-logo.jpg" alt="Musme" width="64" />

A product of [Musme](https://musme.co). A no-login web app to **edit PDFs like a Word document** and convert **PDF ⇄ Word**.

## Features

| Area | What it does |
| --- | --- |
| Edit existing text | *Home → Edit text*, then click any line. The font family, size, bold/italic and colour are detected, and the background colour is sampled so the edit blends in. On export, the original text is truly removed (not just covered). |
| Word-style ribbon | File · Home · Insert · Draw · Pages tabs: font, size, B/I/U, colour, alignment, undo/redo, zoom |
| Insert | Text boxes, pictures (PNG/JPEG/WebP/GIF), rectangles, ellipses, lines, highlight, whiteout |
| Draw | Freehand pen (also works for signatures) |
| Pages | Thumbnails, rotate, reorder, insert a blank page, delete |
| Convert | PDF → Word (pdf2docx), Word/DOC/RTF/ODT → PDF (LibreOffice), and edited PDF → Word |
| Shortcuts | Ctrl+Z / Ctrl+Y undo/redo, Ctrl+S download, Delete, Esc |

## Architecture

```
Browser (all editing)                      Server (Next.js route handlers)
 pdf.js  → renders pages, finds text runs   POST /api/convert/pdf-to-word → scripts/pdf_to_docx.py (pdf2docx)
 zustand → document model + undo history    POST /api/convert/word-to-pdf → LibreOffice headless
 pdf-lib → writes the edited PDF            POST /api/redact             → scripts/redact.py (PyMuPDF)
```

- The editor model (`src/lib/pdf/types.ts`) keeps the original PDF untouched and stores edits as objects in page units (1 unit = 1 PDF point). `src/lib/pdf/export.ts` copies the original pages and draws the objects on top.
- Text boxes use Arial, Times New Roman and Courier New on screen. These are metric-compatible with the standard PDF fonts used for export, so line wrapping matches (`src/lib/pdf/layout.ts`).
- Uploads go to a private temp directory that is always deleted after the request. They are size-checked (50 MB), identified by magic bytes rather than file extension, and rate-limited per IP.

## Run locally

Requirements: Node 20+, Python 3.10+, and [LibreOffice](https://www.libreoffice.org/download/) (needed only for Word → PDF).

```bash
npm install
npm run setup:python   # creates .venv with pdf2docx + PyMuPDF
npm run dev
```

The server looks for tools in these places. Override them with env vars if needed:

| Variable | Default |
| --- | --- |
| `PYTHON_PATH` | `.venv` Python, then `python3`/`python` |
| `SOFFICE_PATH` | standard LibreOffice install paths |

## Deploy

Conversions need LibreOffice and Python, which serverless platforms such as Vercel don't provide. Deploy the included `Dockerfile` to any container host (Railway, Render, Fly.io, Cloud Run, a VPS):

```bash
docker build -t pdfdesk .
docker run -p 3000:3000 pdfdesk
```

## Known limits

- Exported text uses the 14 standard PDF fonts, so characters outside Latin-1 (e.g. Urdu, Arabic, CJK) are replaced with `?`. Lifting this means embedding a Unicode TTF through `@pdf-lib/fontkit`.
- Edited lines get a close standard font (sans/serif/mono), not the PDF's exact embedded font.
- Text in scanned PDFs (images) can't be edited because there is no text layer to work with. That needs OCR.
- The rate limiter is in memory, per process. Use Redis if you run several instances.
- PyMuPDF and pdf2docx are AGPL-licensed. Check that the licence fits your use, or buy Artifex's commercial licence.
