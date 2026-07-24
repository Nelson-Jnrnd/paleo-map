---
doc_type: spec
spec_id: SPEC-012
title: Taxon-profile illustrations — Wikipedia/Commons lead image, clade-silhouette fallback & human size scale
status: Draft
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, taxon-profile, read-model, pipeline, ingestion, web-data-generator, styling, assets]
affected_interfaces: [ImageAsset, ReadImage, RawImageAsset, reference-artifact]
supersedes: []
superseded_by:
depends_on: [SPEC-001, SPEC-003, SPEC-007, SPEC-010]
conflicts_with: []
last_verified_at: 2026-07-24
---

# SPEC-012: Taxon-profile illustrations — Wikipedia/Commons lead image, clade-silhouette fallback & human size scale

## Summary

The atlas shows rich text but **no picture of any dinosaur**, which the owner
review flagged as the single biggest emotional gap. This spec gives every taxon
profile a **visual**: (1) the taxon's **Wikipedia/Commons lead image** — typed,
credited, licensed, source-linked — when one is showable (FONC-1190/1200);
(2) a **clade silhouette fallback** (the local `assets/clades/*` art, already
bundled) when no licensed image exists, honestly labelled as a *generic group
silhouette, not a photograph of this taxon* (FONC-1240); and (3) a **size scale**
comparing the taxon's body length to a human, using the profile's existing
`BodyLength` measurement. The data layer already captures a Commons image per
taxon with licence + credit, but stores only the Commons **description-page URL**
(not a renderable image URL), so delivering a picture requires a pipeline change.
**How the image is delivered offline is the one open owner decision** (bundle a
thumbnail vs. reference a remote thumbnail) — recorded below with a recommended
default (bundle).

## Context

Verified against the shipped code on 2026-07-24:

- `ImageAsset`/`ReadImage` (`src/domain/profile.ts`, `src/domain/snapshot.ts`)
  and the derived `ReadProfile.images` (`src/pipeline/derive.ts:202`) already
  exist; `isShowable` keeps only images with **both** licence and credit
  (DATA-007). The committed `public/data/reference.json` already carries these.
- The live pipeline fetches a Wikipedia `pageimage` and its Commons
  `extmetadata` (Artist → credit, LicenseShortName → licence)
  (`src/pipeline/http-client.ts:460–520`), but stores
  `sourceUrl = info.descriptionurl` — the Commons **web page**
  (`https://commons.wikimedia.org/wiki/File:…`), **not** the image file. The
  direct `info.url` is currently discarded. So today nothing renderable reaches
  the client.
- The taxon profile (`src/app/components/TaxonProfile.tsx`) renders name, rank,
  validity, time span, summary/biology and occurrences — **no image element**.
- Local clade silhouettes exist and are bundled but used only on the loading
  banner: `src/app/assets/clades/{theropod,sauropod,ornithopod,stegosaurus,
  triceratops,pachycephalosaurus,others}.png`.
- The major-group classification needed to pick a silhouette already exists
  (`src/app/state/grouping.ts`, `MAJOR_GROUP_NAMES`, SPEC-010 rank rollup).
- The mockup already reserves an **Illustration** slot and a planned
  **no-image** state (`docs/mockups/taxon-profile.md`, FONC-1190/1200/1240).
- The app is offline/static: artifacts are committed under `public/data/` and
  the read layer performs no runtime upstream egress (DATA-005). A committed
  bundle-size budget is enforced (`scripts/check_budget.ts`; app JS at ~85% of
  its 320 KB gzip budget today).

## Problem statement

A dinosaur atlas with no dinosaur to look at breaks the emotional payoff. The
data to fix it is 90% present — a licensed, credited Commons image per taxon —
but it is not renderable (wrong URL kind) and the UI never shows it, nor a
fallback, nor a sense of scale.

## Goals

- Every taxon profile shows something visual: a real licensed image, or an
  honest generic silhouette.
- Provenance is never hidden: image type, credit, licence and a source link are
  always visible with the picture (charter §4/§5; FONC-1200).
- The offline/static, no-runtime-egress, within-budget guarantees are preserved.
- A human-relative size scale makes "26 m long" tangible.

## Non-goals

- No image gallery/carousel — a single lead image per taxon.
- No new image *sourcing* pipeline beyond the existing Wikipedia/Commons join
  (owner confirmed Wikipedia as the source, 2026-07-24).
- No AI-generated or hand-drawn reconstructions.
- No change to which taxa exist, to occurrence data, or to the map.
- Silhouettes are illustrative group art only — never presented as evidence of
  a specific taxon's appearance.

## Users or actors

The Explorer viewing a taxon profile; the build-time web-data generator and the
live ingestion pipeline.

## Functional requirements

### REQ-001: Capture a renderable image URL

- **Statement:** The image-ingestion step must record a **directly renderable
  image URL** (the Commons file/thumbnail URL from `imageinfo.url` /
  `thumburl`), in addition to the existing Commons description-page URL kept for
  attribution. `ImageAsset`/`ReadImage` gain a renderable-URL field; the
  description URL remains the human-facing source link.
- **Rationale:** Without a file URL the client cannot display anything; the
  description page is a web page, not an image.
- **Acceptance criteria:** A showable `ReadImage` exposes both a renderable
  image URL and a Commons source-page URL; existing licence/credit/type fields
  are unchanged.
- **Verification method:** automated unit test on the ingestion/derive mapping.
- **Evidence location:** filled at implementation.

### REQ-002: Deliver the image offline (owner decision)

- **Statement:** The lead image must be delivered without runtime upstream
  egress, consistent with the static-artifact model. **Default (recommended):**
  the web-data generator downloads a **downscaled thumbnail** (e.g. ≤ 320 px, as
  a defined budgeted category) into `public/data/images/` at build time and the
  renderable URL becomes that local path. (Alternative, pending owner choice:
  reference a remote `upload.wikimedia.org` thumbnail at runtime — simpler, zero
  bundle cost, but reintroduces external egress + privacy leakage and breaks
  offline use.)
- **Rationale:** The product's offline/no-egress/privacy stance argues for
  bundling; the owner must confirm because it affects build and budget.
- **Acceptance criteria:** With the chosen mechanism, a profile image renders
  with the network blocked to third-party hosts (bundle path) OR the remote host
  is explicitly accepted by the owner; the image budget (if bundling) stays
  within a defined limit checked by `check:budget`.
- **Verification method:** manual offline check + `check:budget`.
- **Evidence location:** filled at implementation.

### REQ-003: Show the licensed lead image with provenance

- **Statement:** When a taxon has a showable image, the profile displays it with
  its **type** (e.g. "Artistic reconstruction"), **credit**, **licence**, and a
  **link to the Commons source page**, all visible alongside the image (not
  behind a hover), plus descriptive `alt` text.
- **Rationale:** FONC-1190/1200 and the charter require provenance to be legible
  and images to be credited/licensed.
- **Acceptance criteria:** The rendered profile contains an image element with
  non-empty `alt`, and visible credit + licence text and a source link; images
  without both licence and credit are never shown (DATA-007 preserved).
- **Verification method:** automated component test.
- **Evidence location:** filled at implementation.

### REQ-004: Clade-silhouette fallback, honestly labelled

- **Statement:** When a taxon has **no** showable image, the profile shows the
  local clade silhouette for the taxon's **major group** (theropod, sauropod,
  ornithopod, stegosaur, ceratopsian/triceratops, pachycephalosaur, else
  `others`), labelled explicitly as a **generic group silhouette, not a
  photograph of this taxon**.
- **Rationale:** Every profile gets a visual anchor (the reviewer's core ask)
  without ever implying a silhouette is evidence of that taxon (FONC-1240;
  charter honesty).
- **Acceptance criteria:** A taxon with no showable image renders a silhouette
  chosen from its major group with an unambiguous "generic silhouette" label and
  `alt` text; the major-group mapping reuses the SPEC-010 classification; unknown
  groups fall back to `others`.
- **Verification method:** automated component test (a fixture taxon whose only
  image lacks a licence falls back).
- **Evidence location:** filled at implementation.

### REQ-005: Human-relative size scale

- **Statement:** When the profile has a non-null `BodyLength`, show a simple
  size-comparison visual scaling the taxon's length against a human silhouette
  (with the length value labelled). When `BodyLength` is null, the scale is
  omitted (no invented number).
- **Rationale:** "26 m" is abstract; a human comparison makes size legible (the
  reviewer's explicit ask).
- **Acceptance criteria:** A taxon with a body length renders the scale with the
  labelled measurement and its source; a taxon without one shows no scale and no
  placeholder number.
- **Verification method:** automated component test.
- **Evidence location:** filled at implementation.

## Non-functional requirements

### NFR-001: Offline, deterministic, within budget

- **Statement:** No new runtime upstream egress for data (DATA-005 preserved);
  the snapshot build stays deterministic (NFR-001/002); if images are bundled,
  total image weight stays within a defined `check:budget` category.
- **Rationale:** Preserve the product's core guarantees.
- **Acceptance criteria:** `pnpm test`, `pnpm run build`, `pnpm run check:budget`
  green; no third-party fetch in the read-path tests.
- **Verification method:** CI + local run.
- **Evidence location:** filled at implementation.

### NFR-002: Accessibility

- **Statement:** Every image/silhouette has meaningful `alt`; the size scale is
  understandable without colour alone.
- **Rationale:** Charter accessibility.
- **Acceptance criteria:** Non-empty `alt` on every rendered image; scale conveys
  magnitude via labelled geometry, not colour only.
- **Verification method:** component test + manual review.
- **Evidence location:** filled at implementation.

## Security and privacy considerations

### SEC-001: No third-party hotlinking without owner acceptance

- **Statement:** If the owner picks the remote-thumbnail alternative in REQ-002,
  it must be an explicit, recorded decision, because it discloses viewer IPs to
  Wikimedia. The default (bundling) avoids this.
- **Acceptance criteria:** The chosen mechanism is recorded in this spec; the
  default introduces no third-party requests.
- **Verification method:** inspection.
- **Evidence location:** filled at implementation.

## Data model impact

`ImageAsset` and `ReadImage` gain a renderable image-URL field (DATA-006/007
extended, not replaced). If bundling, the web-data generator writes downscaled
thumbnails under `public/data/images/` and rewrites the renderable URL to the
local path; the Commons description URL and licence/credit are retained.

## API impact

`ReadProfile.images[]` items expose the new renderable URL. No new query
methods.

## UI or UX impact

### UX-001: Illustration, fallback, and scale in the profile

- **Statement:** The profile gains an illustration block (image or silhouette)
  with visible provenance, and an optional size scale, placed per the mockup's
  reserved Illustration slot, honouring the light cartographic aesthetic and
  teal-accent restraint (`docs/mockups/design-guidelines.md`).
- **Acceptance criteria:** As per REQ-003/004/005.
- **Verification method:** manual review against the design guidelines.
- **Evidence location:** filled at implementation.

## Configuration impact

A new budgeted image category in `scripts/check_budget.ts` if bundling; a
thumbnail max-dimension constant in the generator.

## Error handling

- A renderable URL that fails to load falls back to the clade silhouette
  (REQ-004) rather than a broken-image icon.
- Missing licence or credit → image not shown (existing DATA-007).

## Edge cases

- Taxon with no genus record (indeterminate) → silhouette from the highest
  resolvable major group, else `others`.
- Multiple showable images → pick the deterministic first (existing sort), one
  lead image only.
- Body length present but zero/negative → treat as absent (no scale).

## Acceptance criteria

REQ-001…005 met, NFR-001/002 green, the REQ-002 delivery mechanism chosen and
recorded, and every profile renders either a licensed image or an honest
silhouette.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Renderable + source URLs both present | automated | ingest/derive unit test | TBD | TBD |
| REQ-002 | Offline render / budget respected | manual + budget | offline check; `check:budget` | TBD | TBD |
| REQ-003 | Image shown with credit+licence+link+alt | automated | TaxonProfile component test | TBD | TBD |
| REQ-004 | Fallback silhouette, labelled generic | automated | TaxonProfile component test | TBD | TBD |
| REQ-005 | Size scale from BodyLength, or omitted | automated | TaxonProfile component test | TBD | TBD |
| NFR-001 | offline + build + budget green | CI | `pnpm test && pnpm run build && pnpm run check:budget` | TBD | TBD |
| NFR-002 | non-empty alt everywhere | automated | component test | TBD | TBD |

## Test plan

Unit tests for the URL capture (REQ-001) and, if bundling, the thumbnail
path-rewrite. Component tests for the image state, the fallback state (using the
existing fixture image that lacks a licence), and the size scale (present/absent
body length). Full `pnpm test` + `build` + `check:budget`.

## Rollback plan

The UI illustration block is additive; revert the component change to hide it.
The data-model field is optional; revert the pipeline change and regenerate the
artifact. Bundled thumbnails are deleted with the generator revert.

## Open questions

- [ ] Thumbnail max dimension and per-image/category budget (default: ≤ 320 px
      longest edge; category budget set so total stays comfortably under limit).

## Human decisions required

- [ ] **REQ-002 image delivery.** (a) **Bundle** downscaled thumbnails into
      `public/data/images/` at build (offline-safe, privacy-safe, small bundle
      cost) — *recommended*; or (b) reference remote `upload.wikimedia.org`
      thumbnails at runtime (zero bundle cost, but external egress + viewer-IP
      disclosure + breaks offline). — Answer: _____

## Conflict check

Touches SPEC-001 (data model — additive field), SPEC-003/007 (taxon profile —
additive illustration block, no reordering of existing content), and SPEC-010
(reuses the major-group classification). No contradiction; `conflicts_with`
empty. Drift note (not fixed here): `docs/SPEC_INDEX.md` still lacks rows for
SPEC-010/011/012.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | pipeline image capture | TBD | TBD | Pending |
| REQ-002 | web-data generator / budget | TBD | TBD | Pending |
| REQ-003 | TaxonProfile illustration | TBD | TBD | Pending |
| REQ-004 | TaxonProfile fallback + clade map | TBD | TBD | Pending |
| REQ-005 | TaxonProfile size scale | TBD | TBD | Pending |

## Implementation notes

To be filled during implementation.

## Spec amendments

_None yet._

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [ ] Open questions are resolved or explicitly deferred.
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed.
- [ ] Human approval recorded before status set to Approved.
