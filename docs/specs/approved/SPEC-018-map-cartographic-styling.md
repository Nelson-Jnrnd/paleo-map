---
doc_type: spec
spec_id: SPEC-018
title: Map cartographic styling — bathymetric ocean, land relief, graticule, marker retune
status: Approved
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, map-rendering, styling, design-tokens]
affected_interfaces: [maplibre-style, gplates-basemap, design-tokens]
supersedes: []
superseded_by:
depends_on: [SPEC-003, SPEC-004, SPEC-008, SPEC-015]
conflicts_with: []
last_verified_at: 2026-08-05
---

# SPEC-018: Map cartographic styling

## Summary

The paleogeographic map is styled with exactly three elements — a flat ocean
background, a flat land fill, and a one-pixel coastline — over coastline polygons
that carry no attributes at all. The design charter specifies the ocean as a
**pale bathymetric chart** with a two-stop gradient, and defines the token for
it, but the map never uses that token. This spec gives the map depth-graded
water, land with relief, a graticule, and a marker pass retuned for the new
background. Per the owner's decision of 2026-08-05 the charter's **restraint rule
no longer constrains the basemap**, so the map may be as visually rich as it needs
to be to read as a real cartographic object. It still adds **no new data source
and no new payload**: every change is a style-layer change over geometry that
already ships.

## Context

Verified from the shipped code and basemap frames on 2026-08-05:

- The MapLibre style (`src/app/components/OccurrenceMap.tsx`) is a `background`
  layer painted `#d7e4ec`, a land `fill` painted `#edf1f1`, and a coastline
  `line` painted `#a9b9c3` at width 1. That is the complete basemap.
- Frames are **coastline polygons only** — 315 `Polygon` features for the
  Maastrichtian, **every one with an empty `properties: {}`**. There are no
  depths, elevations, plate ids or names to style by.
- Frames are Douglas–Peucker simplified at **0.3°** and rounded to 2 decimals:
  ~105 KB per frame, **3.0 MB for all 30 frames** (`scripts/fetch_basemap.ts`,
  budget NFR-002 of SPEC-004/008).
- `tokens.css` defines `--color-ocean-inner: #eef4f7`,
  `--color-ocean-outer: #d7e4ec` and `--color-grid: #cdd9e0`. **The map uses only
  `--color-ocean-outer`.** The inner stop and the grid token are unused.
- **No graticule is rendered.** The code refers to degrading "to the graticule"
  as a no-frame fallback; the normal map has no grid.

The charter (§4) specifies: *"the map is a pale bathymetric chart so the map and
its data read as the primary object"*, with `Ocean | radial #d7e4ec→#eef4f7`.

**Owner decisions, 2026-08-05 — both recorded in the charter:**

1. **The radial ocean token means shallow-near-land → deep-offshore.**
   `--color-ocean-inner` (`#eef4f7`) is the near-shore value and
   `--color-ocean-outer` (`#d7e4ec`) the open-water value. This is the
   bathymetric reading, not a view-centred vignette. The earlier draft carried
   this as an assumption; it is now settled.
2. **The charter's restraint rule no longer constrains the basemap.** Multiple
   tonal bands, gradients, depth gradation, relief and texture are permitted, and
   the "single subtle radial" ceiling is lifted. The override is recorded in
   `docs/mockups/design-guidelines.md` §4 and is **scoped to the basemap** —
   panels, cards and controls remain under the original rule.

The override deliberately does **not** relax three things, because they are not
matters of taste, and this spec continues to enforce all three: charter §2
(uncertainty is first-class — see UX-002), WCAG 2 AA contrast and the axe gate
(NFR-003), and accent semantics (teal belongs to the data and interaction layer;
the basemap gets richer within the cool-neutral family and acquires no second
accent).

The direction was explored in
[`../../reports/taxonomy-infographic-and-map-craft.md`](../../reports/taxonomy-infographic-and-map-craft.md)
(Direction B) and approved for specification by the owner on 2026-08-05.

## Problem statement

The map is the product's primary object and it reads as flat coloured shapes.
The flatness is not a styling oversight so much as a consequence of having one
undifferentiated polygon layer: there is nothing in the data to grade by. But a
bathymetric *impression* — shallow water hugging the coast, deepening offshore —
can be constructed from the coastline geometry itself, and the charter already
committed to that look without it ever being built.

## Goals

- Render the pale bathymetric ocean the charter specifies, using the token that
  already exists for it.
- Give landmasses a defined edge and real relief so they read as bodies rather
  than cut-outs.
- Provide a latitude/longitude reference so the reconstruction is readable as
  world geography and change between stages is perceptible.
- Keep occurrence markers legible over the new background.

## Non-goals

Each of these was considered and deliberately excluded; several are candidates
for their own spec.

- **No change to the basemap data.** Coastline resolution, simplification
  tolerance, and the committed frame payload stay exactly as they are. Higher-
  detail coastlines at high zoom are a separate spec with a budget impact.
- **No place labels.** Naming oceans, seaways and landmasses (Tethys, Panthalassa,
  Western Interior Seaway) requires per-stage curation and sourcing; it is a
  separate spec.
- **No projection change and no change to world copies.** MapLibre's non-Mercator
  capabilities in the pinned version are unverified, and a globe is an explicit
  non-goal (OQ-010). See Open questions.
- **No plate boundaries or tectonic features.** Available only in rotation models
  that disagree with the PALEOMAP frame this project is pinned to; adopting them
  would reintroduce exactly the frame mismatch SPEC-016 addresses.
- **No new accent colour and no change to the status system.** Teal remains the
  single accent; ICS period hues stay on the timeline; provenance and error cues
  are untouched.
- **No change to what the map means.** Occurrences remain discovery evidence;
  nothing added here may read as a distribution range, a depth measurement, or an
  observed shoreline.

## Users or actors

- **The Explorer** (charter §1) reading the map as the primary object.

## Functional requirements

### REQ-001: Depth-graded ocean

- **Statement:** The sea must be rendered with **at least three** visually
  distinct depth zones grading from a light near-shore value at the coastline to a
  deep open-water value away from it, derived from the coastline geometry already
  loaded, anchored on `--color-ocean-inner` (near-shore) and
  `--color-ocean-outer` (open water). The gradation must be continuous or banded
  without visible seams, and must follow the coastline of whichever frame is
  displayed, at every stage.
- **Rationale:** Realises the charter's specified bathymetric chart; the flat
  single-value sea is the largest contributor to the map's flatness. Three zones
  rather than two is now the floor because the restraint ceiling is lifted — a
  shelf/slope/deep reading is what makes it legible as bathymetry rather than as a
  halo.
- **Acceptance criteria:**
  - Both ocean tokens are referenced by the rendered style; neither is unused.
  - At least three distinct depth zones are present, ordered light-to-dark with
    distance from the coastline.
  - The near-shore zone is present around every landmass in the frame, not only
    around some.
  - Changing stage re-derives the gradation against the new frame's coastlines.
  - No banding artefact is visible at the default zoom (manual check).
  - No new source, layer data, or network request is introduced.
- **Verification method:** automated test (style-layer composition asserted from
  the constructed style object) + manual visual check
- **Evidence location:** `test/ui/spec018-ocean.test.ts`

### REQ-002: Land relief

- **Statement:** Landmasses must be rendered with a defined edge and interior
  treatment that distinguishes the interior from the coastline, such that
  continents read as solid bodies rather than flat holes in the sea. Texture,
  tonal variation and shading are permitted under the 2026-08-05 override. The
  treatment must stay within the charter's cool-neutral family and must not
  introduce a new accent or a new hue family.
- **Rationale:** A single flat fill with a 1px stroke makes continents read as
  paper cut-outs. With restraint lifted, land can carry real relief rather than
  only an edge — Pangaea is 40 million km² of one hex today.
- **Acceptance criteria:**
  - The land treatment is present on every land polygon in the frame.
  - Continental interiors are not a single uniform flat value at the default zoom.
  - Only cool-neutral values are used; no new accent or hue family appears.
  - Small polygons (islands) remain legible and are not swallowed by the edge
    treatment (Edge cases).
- **Verification method:** automated test + manual visual check
- **Evidence location:** `test/ui/spec018-land.test.ts`

### REQ-003: Graticule

- **Statement:** The map must render a latitude/longitude graticule at a declared
  interval using `--color-grid`, with the equator rendered distinctly from the
  other lines. The graticule must sit beneath the occurrence layer and must not
  obscure coastlines or markers.
- **Rationale:** There is currently no spatial reference at all; a graticule makes
  the projection legible and makes continental movement between stages
  perceptible. The equator is emphasised because on a paleomap it is the one line
  with physical meaning.
- **Acceptance criteria:**
  - Graticule lines are present at the declared interval across the full map
    extent.
  - The equator is visually distinguishable from other graticule lines.
  - The graticule renders below occurrence markers and above the ocean.
  - The graticule is generated in-app or from a committed static file — no
    network request.
  - Layer order is asserted, not assumed.
- **Verification method:** automated test
- **Evidence location:** `test/ui/spec018-graticule.test.ts`

### REQ-004: Marker legibility over the new basemap

- **Statement:** Occurrence, cluster and locality markers must remain legible
  against both the near-shore and open-water ocean zones and against land, at
  every zoom level the map supports. Where the existing marker treatment loses
  contrast against the new background, it must be adjusted — by casing, size, or
  opacity — without changing the marker's meaning, its clade encoding, or the
  teal accent.
- **Rationale:** SPEC-015's markers were tuned against a flat single-value
  background; changing the background without retuning them risks regressing map
  readability (PERF-080…PERF-120).
- **Acceptance criteria:**
  - Marker and cluster fills retain their SPEC-015 meaning; no clade tint or
    accent value is changed.
  - Markers are distinguishable over land, near-shore water and open water
    (manual check at the default zoom and at maximum zoom).
  - Cluster count labels meet the contrast bar enforced by the axe gate.
  - No regression in the existing SPEC-015 marker tests.
- **Verification method:** automated test (existing SPEC-015 suites must stay
  green) + manual visual check + axe gate
- **Evidence location:** `test/ui/spec018-markers.test.ts`, `test/e2e/`

## Non-functional requirements

### NFR-001: No new data and no payload growth

- **Statement:** This spec must not add a data source, alter any committed
  basemap frame, or increase the committed basemap payload. Any geometry it needs
  must be derived at runtime from the loaded frame or generated procedurally.
- **Rationale:** The per-frame budget (SPEC-004/008 NFR-002, `check:budget`) is a
  standing constraint, and keeping this a pure styling change is what makes it
  cheap and revertible.
- **Acceptance criteria:**
  - `public/basemap/**` is unchanged by this work (asserted by inspection of the
    diff).
  - `pnpm run check:budget` passes unchanged.
  - No new fetch target appears in the app.
- **Verification method:** script + inspection
- **Evidence location:** `pnpm run check:budget`, PR diff

### NFR-002: Map interaction performance

- **Statement:** The added layers must not measurably degrade pan, zoom, or
  stage-stepping responsiveness relative to the current map.
- **Rationale:** SPEC-015 NFR-002 already had to claw back map performance after
  the clade icon atlas; added layers are exactly the kind of change that can
  regress it again.
- **Acceptance criteria:**
  - The number of added style layers is bounded and declared.
  - No added layer performs per-frame geometry recomputation during pan or zoom;
    derivation happens on frame change only.
  - Stage stepping remains within the responsiveness expected by PERF-010…060
    (manual check, consistent with how SPEC-015 was assessed).
- **Verification method:** automated test for layer count and derivation timing
  hooks + manual check
- **Evidence location:** `test/ui/spec018-layers.test.ts`

### NFR-003: Accessibility preserved

- **Statement:** All map text and UI over the restyled background must continue to
  meet WCAG 2 AA contrast, and the axe gate must report no new violations.
- **Rationale:** Charter accessibility reconciliation (SPEC-003 AMEND-002) —
  where accessibility and aesthetics conflict, accessibility wins.
- **Acceptance criteria:** The axe run reports no new violations; cluster labels,
  the standing reconstruction label, and map controls all pass contrast over the
  new background.
- **Verification method:** automated test (`@axe-core/playwright`)
- **Evidence location:** `test/e2e/`

## Security and privacy considerations

### SEC-001: No new external hosts

- **Statement:** No style, glyph, sprite, or tile may be loaded from a
  third-party host. The map style remains self-contained.
- **Rationale:** The existing style is explicitly self-contained ("background
  only, no external tiles/glyphs — SEC-001" in `OccurrenceMap.tsx`); this spec
  must not weaken that.
- **Acceptance criteria:** No new external URL appears in the map style or in any
  request the map issues.
- **Verification method:** automated test + inspection
- **Evidence location:** `test/ui/spec018-offline.test.ts`

## Data model impact

None. No domain type, snapshot field, or committed artefact changes. The
graticule, if generated as GeoJSON, is produced in-app from constants and is not
part of the snapshot.

## UI or UX impact

### UX-001: Charter alignment under the 2026-08-05 override

- **Statement:** The restyled map must match the charter's stated visual system as
  amended: cool blue-grey neutrals, the specified ocean tokens, teal as the only
  accent, ICS hues confined to the timeline, and status cues unchanged — with the
  restraint ceiling lifted for the basemap only. Every visual value this spec
  introduces (band count and widths, graticule interval, land relief treatment)
  must be recorded in the charter as part of the same change.
- **Rationale:** The charter is binding on all UI work. This spec both implements
  a part of it that was written down and never built, and operates under an
  explicit owner override to its restraint rule — so the charter must end up
  describing what actually ships.
- **Acceptance criteria:**
  - The rendered style references `--color-ocean-inner`, `--color-ocean-outer`
    and `--color-grid`.
  - No new accent or status colour is introduced; teal remains confined to the
    data and interaction layer.
  - Panels, cards and controls are visually unchanged — the override is scoped to
    the basemap and must not leak into surrounding UI.
  - `docs/mockups/design-guidelines.md` records every new value introduced here.
- **Verification method:** automated test + manual check against the charter
- **Evidence location:** `test/ui/spec018-tokens.test.ts`,
  `docs/mockups/design-guidelines.md`

### UX-002: The map must not imply data it does not have

- **Statement:** The depth gradation is a cartographic device derived from
  distance to the coastline. It must not be labelled, captioned, or otherwise
  presented as measured bathymetry, sea depth, or reconstructed sea level, and it
  must not carry a legend implying depth values.
- **Rationale:** Charter §2 and CONS-120/130 — nothing on this map may read as
  observation when it is decoration. This is the single largest risk the spec
  carries.
- **Acceptance criteria:**
  - No depth scale, no metre or fathom value, and no legend entry for water depth
    appears anywhere in the UI.
  - The standing "Paleogeographic reconstruction" label remains present and
    unchanged.
- **Verification method:** automated test + manual check
- **Evidence location:** `test/ui/spec018-no-depth-claim.test.ts`

## Configuration impact

New declared constants, each in one place and referenced by tests: the ocean
**band count and widths**, the **graticule interval**, the **equator emphasis**,
and the land **edge width**. All belong with the existing map style constants
(`OCEAN_OUTER`, `LAND`, `COAST`) and their values must be mirrored into
`tokens.css` where they are colours. No environment variables or feature flags.

## Error handling

- When no frame is available for a stage, the existing no-frame fallback applies;
  the graticule (REQ-003) must render in that state, since it is frame-independent
  and is what the current code already calls the fallback.
- When a frame loads but contains zero polygons, the ocean must render its
  open-water value with no near-shore zone, rather than failing.
- No new error state is introduced; nothing here can fail in a way that blocks
  map interaction.

## Edge cases

- **Small islands** — the near-shore zone and the land edge must not visually
  consume polygons smaller than the treatment's own width.
- **Antimeridian-crossing polygons** — the near-shore derivation must not produce
  a seam or a smear across the ±180° line.
- **Poles** — under Web Mercator, high-latitude geometry is severely stretched;
  the treatments must remain visually acceptable there even though the projection
  is out of scope for this spec.
- **Dense marker fields** — at the default view a fossil-rich stage puts hundreds
  of markers over the new background; REQ-004 is assessed under that condition,
  not on an empty map.
- **World copies** — the map currently repeats east–west; the ocean and graticule
  treatments must not misalign or visibly restart at the repeat boundary.

## Acceptance criteria

This spec is satisfied when the map renders a two-zone bathymetric sea derived
from the displayed frame's coastlines, land with a defined edge, and a graticule
with an emphasised equator; markers remain legible over all of it; the committed
basemap data and payload are byte-unchanged; `check:budget` and the axe gate both
pass; no depth claim appears anywhere; and the charter records any newly-specified
value.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | >=3 depth zones derived from coastlines; both tokens used; re-derives per stage | automated + manual | `pnpm test`, visual check | `test/ui/spec018-ocean.test.ts` | |
| REQ-002 | Land edge + relief on every polygon; interiors not uniform; cool-neutral only; islands survive | automated + manual | `pnpm test`, visual check | `test/ui/spec018-land.test.ts` | |
| REQ-003 | Graticule at declared interval, equator distinct, correct layer order | automated test | `pnpm test` | `test/ui/spec018-graticule.test.ts` | |
| REQ-004 | Markers legible over land and both water zones; SPEC-015 suites green | automated + manual + axe | `pnpm test`, `pnpm run e2e` | `test/ui/spec018-markers.test.ts` | |
| NFR-001 | `public/basemap/**` unchanged; budget passes; no new fetch | script + inspection | `pnpm run check:budget`, diff | PR diff | |
| NFR-002 | Bounded layer count; no per-frame recompute on pan/zoom | automated + manual | `pnpm test` | `test/ui/spec018-layers.test.ts` | |
| NFR-003 | AA contrast preserved; axe clean | automated test | `pnpm run e2e` | `test/e2e/` | |
| SEC-001 | No third-party host in style or requests | automated + inspection | `pnpm test` | `test/ui/spec018-offline.test.ts` | |
| UX-001 | Charter tokens referenced; charter updated | automated + manual | `pnpm test`, review | `test/ui/spec018-tokens.test.ts` | |
| UX-002 | No depth scale, value, or legend anywhere | automated + manual | `pnpm test`, review | `test/ui/spec018-no-depth-claim.test.ts` | |

## Test plan

- **Style composition** — assert the constructed MapLibre style object contains
  the expected layers, in the expected order, referencing the expected tokens.
  This is how the existing basemap tests work and needs no WebGL.
- **Derivation** — unit-test the near-shore derivation against small synthetic
  polygon fixtures, including an island, an antimeridian-crossing polygon, and an
  empty frame.
- **Regression** — the existing SPEC-004/008/015 map suites must stay green
  unchanged; that is the primary guard against meaning drift.
- **Visual** — a manual pass at the default zoom and at maximum zoom, on a
  fossil-rich stage (Campanian) and a sparse one (Induan), checked against the
  charter. Screenshots attached to the PR as evidence.
- **Accessibility** — the existing axe e2e gate.
- **Budget** — `pnpm run check:budget` and a diff check that
  `public/basemap/**` is untouched.

## Rollback plan

Every change is confined to the map style construction and its constants. Reverting
the commit restores the previous style exactly; there is no data migration, no
regenerated artefact, and no persisted state to unwind. Because NFR-001 forbids
touching `public/basemap/**`, a rollback cannot leave the committed frames in an
inconsistent state.

## Open questions

- [x] **What does "radial" mean in the charter's ocean token?** *Resolved by
      owner, 2026-08-05:* shallow-near-land → deep-offshore.
      `--color-ocean-inner` is the near-shore value. Encoded in REQ-001.
- [x] **How many ocean zones?** *Resolved:* at least three (REQ-001), now that
      the restraint ceiling is lifted. The upper bound remains governed by
      NFR-002.
- [x] **Graticule interval** — *explicitly deferred to implementation*; 30° is
      the proposed starting value and whatever ships becomes a charter entry
      under UX-001.
- [x] **How far does land relief go?** *Explicitly deferred to implementation.*
      REQ-002 permits texture and tonal variation without prescribing a
      technique; procedural shading, a tiled texture and coastline-distance tonal
      falloff are all admissible, bounded by NFR-002 and the cool-neutral
      constraint.
- [x] **Projection and world copies** — *deferred out of scope* (already a
      non-goal). Needs a MapLibre capability check first; candidate follow-up
      spec, not an implied requirement here.

## Human decisions required

- [x] **Confirm the bathymetric reading of the ocean token.** *Answered by owner,
      2026-08-05:* confirmed, and the restraint rule was lifted for the basemap.
      Recorded in `docs/mockups/design-guidelines.md` §4 and encoded in REQ-001,
      REQ-002 and UX-001.
- [x] **Confirm the override's boundary.** *Confirmed as written, owner,
      2026-08-05:* the restraint relaxation is scoped to the **basemap**. Panels,
      cards and controls stay under the original rule; §2 honesty, AA contrast and
      accent semantics are unaffected. Recorded in
      `docs/mockups/design-guidelines.md` §4.
- [x] **Approve the spec.** *Approved by owner, 2026-08-05* ("I approve").
      Status set to `Approved`; moved to `docs/specs/approved/`.

## Conflict check

No conflicts identified.

- **SPEC-004 / SPEC-008** — own the basemap frames, their fetch, simplification
  and per-stage selection. NFR-001 explicitly forbids touching any of that; this
  spec only styles what they deliver.
- **SPEC-015** — owns clade silhouette markers and their performance budget.
  REQ-004 retunes marker *legibility* against the new background and is forbidden
  from changing clade encoding or accent values; SPEC-015's tests are the guard.
- **SPEC-016** — concerns frame consistency between dots and coastlines. This
  spec changes neither position, so it is unaffected. The plate-boundary overlay
  that would have conflicted with it is an explicit non-goal.
- **SPEC-003 AMEND-002** — the accessibility reconciliation of charter colours.
  NFR-003 preserves it.
- **`docs/mockups/design-guidelines.md`** — binding, and partly *implemented* by
  this spec rather than changed by it. UX-001 requires the charter to record any
  new value this work introduces.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Map style — ocean | | | Not started |
| REQ-002 | Map style — land relief | | | Not started |
| REQ-003 | Map style — graticule | | | Not started |
| REQ-004 | Map style — markers | | | Not started |
| NFR-001 | Basemap payload | | | Not started |
| NFR-002 | Map style layers | | | Not started |
| NFR-003 | Accessibility gate | | | Not started |
| SEC-001 | Map style | | | Not started |
| UX-001 | Tokens + charter | | | Not started |
| UX-002 | Map framing | | | Not started |

## Implementation notes

Suggested order: REQ-003 graticule (simplest, independent, immediately visible) →
REQ-001 ocean → REQ-002 land → REQ-004 marker retune (must come last, since it
responds to whatever the first three produce). The near-shore zone is expected to
be achievable with additional blurred coastline strokes rendered beneath the land
fill, which requires no geometry buffering; if that proves visually insufficient,
the fallback is a computed buffer, which must then be checked against NFR-002.

## Spec amendments

None yet.

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [x] Open questions are resolved or explicitly deferred.
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed.
- [x] Human approval recorded before status set to Approved (owner, 2026-08-05).
