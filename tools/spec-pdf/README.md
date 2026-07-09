# Specification PDF build

Renders the whole specification — the functional spec with its UML and UI mockups
in place, the data-architecture design, and the appendices — into a single PDF:
[`../../docs/Interactive-Mesozoic-Dinosaur-Atlas-Specification.pdf`](../../docs/Interactive-Mesozoic-Dinosaur-Atlas-Specification.pdf).

Everything is rendered **from the repository docs** — there is no separate diagram
source:

- Behavioural UML (use case / activity / state / sequence) comes from the
  ```` ```mermaid ```` blocks in `docs/uml/*.md`, keyed by their
  `<!-- pdf-fig: KEY | Caption -->` markers.
- Data-layer class models + the design narrative come from `docs/design/data-model.md`.
- UI mockups are the SVGs in `docs/assets/mockups/`.
- Prose comes from `docs/product/*` and `docs/requirements/*`.

## Prerequisites

- Python 3 with `markdown` (`pip install markdown`).
- Node with `mermaid` installed here (`npm install mermaid`).
- A Chromium that Playwright can drive (this repo's CI/dev image ships one at
  `PLAYWRIGHT_BROWSERS_PATH`); `playwright` must be resolvable by Node.

## Build

```bash
cd tools/spec-pdf
npm install mermaid            # provides node_modules/mermaid/dist/mermaid.min.js
python3 build.py               # writes spec-document.html (reads ../../docs)
NODE_PATH="$(npm root -g)" node render_pdf.js \
  ../../docs/Interactive-Mesozoic-Dinosaur-Atlas-Specification.pdf
```

`build.py` honours `PALEO_REPO` (defaults to the repo root) to locate `docs/`.
Generated `node_modules/`, `spec-document.html`, and intermediate images are
git-ignored; the committed PDF under `docs/` is the published artifact.

## What to edit

Change the **source docs**, not a diagram file: edit the Mermaid in `docs/uml/*.md`
or `docs/design/data-model.md`, the requirement text in
`docs/product/functional-specification.md`, or a mockup SVG — then rebuild.
