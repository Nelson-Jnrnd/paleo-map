---
doc_type: spec
spec_id: SPEC-015
title: Legible occurrence map — clade silhouette markers, zoom-scaled labels, hover preview
status: In Implementation
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, occurrence-map, exploration-view, clade-silhouettes, styling]
affected_interfaces: [OccurrenceMap, ReadOccurrence, cladeSilhouette]
supersedes: []
superseded_by:
depends_on: [SPEC-003, SPEC-004, SPEC-010, SPEC-012, SPEC-014]
conflicts_with: []
last_verified_at:
---

# SPEC-015: Legible occurrence map — clade silhouette markers, zoom-scaled labels, hover preview

## Summary

The occurrence map plots every fossil as an identical teal dot, so it reads only
as *position* — you must click a point to learn anything. This spec makes the map
**legible at a glance**: each occurrence renders as its **clade silhouette icon**
(the bundled PhyloPic-derived clade set) instead of a dot, carries a **taxon-name
label that scales correctly with zoom**, and shows a **hover preview card**
(name · age · formation) so the answer to "what am I looking at" arrives before
any click.

## Context

The map (`OccurrenceMap.tsx`, SPEC-003/004) is a MapLibre GL layer over a
self-contained bathymetric basemap. Occurrences are a clustered GeoJSON source;
unclustered points are plain teal circles (`ACCENT`), clusters are size-stepped
discs. SPEC-012 already bundles a small set of **generic clade silhouettes**
(`src/app/assets/clades/*.png`) mapped from a taxon's major group by
`silhouetteForTaxon` / `resolveTierTaxon` (theropod, sauropod, ornithopod,
armoured, ceratopsian, pachycephalosaur, and a generic fallback). SPEC-014
AMEND-005 hides indeterminate occurrences by default, so the visible set is
genus-level — every visible marker maps cleanly to one clade icon. Hover already
cross-highlights the occurrence list (SPEC-009); this spec extends hover to also
surface a preview.

The design charter (`docs/mockups/design-guidelines.md`) requires meaning-only
colour and "never colour alone" (PERF-250); encoding clade by **shape** (the
silhouette) satisfies this directly and is more legible than hue.

## Problem statement

A dot conveys only location. Users cannot tell a predator from a sauropod, or
read the map's composition, without probing each point one click at a time.

## Goals

- Make clade identity readable from the marker itself, without interaction.
- Surface a taxon's name and key facts on hover, before the click-through.
- Keep labels readable and correctly sized across zoom levels.
- Stay within the design charter (shape-encoded meaning, restraint) and the
  existing offline/no-egress architecture (assets are bundled).

## Non-goals

- Per-taxon exact silhouettes on the map (the 450 per-taxon SVGs). The map uses
  the **bounded clade set** only, for legibility and performance.
- Changing Locality mode's markers (a locality has many taxa, so no single clade
  icon fits). Locality markers stay discs (their richness encoding is out of
  scope here; see the SPEC-015 follow-up note).
- Any new network egress. All icons are bundled assets (DATA-005 unchanged).

## Users or actors

- **The Explorer** reading the paleomap to see which groups occur where and when.

## Functional requirements

### REQ-001: Clade silhouette markers, shape + subtle tint

- **Statement:** In Occurrence and Taxon modes, each unclustered occurrence
  renders as its **clade silhouette icon** (from the bundled clade set, chosen by
  the occurrence's major group via `silhouetteForTaxon`), not a plain circle.
  Each clade icon also carries a **subtle, muted clade tint** as a second cue
  (owner decision 2026-07-29): a small categorical, meaning-only palette keyed to
  the major group, quiet enough to preserve restraint. The generic fallback icon
  + neutral tint is used when the group is unresolved. Because identity is carried
  by **shape first** (the silhouette), the tint is a reinforcement, never the sole
  channel (PERF-250).
- **Rationale:** Shape encodes clade identity at a glance; a muted tint makes the
  map faster to scan without relying on colour alone.
- **Acceptance criteria:** each visible point's `icon-image` corresponds to its
  taxon's resolved clade group and its tint matches the same group; a theropod
  occurrence shows the theropod silhouette in the theropod tint, a sauropod the
  sauropod silhouette/tint; unresolved → fallback icon + neutral tint. A legend
  names the clade icons/tints.
- **Verification method:** automated (unit test on the occurrence→clade
  icon+tint mapping) + manual visual check.
- **Evidence location:** _pending_.

### REQ-002: Zoom-scaled taxon labels

- **Statement:** Each marker carries a **taxon-name label** rendered in a symbol
  layer, whose text size **scales with zoom** (a zoom interpolation) and which
  **declutters via collision** so labels never overlap illegibly. Labels appear
  **only above a zoom threshold** (owner decision 2026-07-29): at low zoom the map
  shows icons alone (clean far view), and names fade in once the user zooms in
  past the threshold. Scientific names are italic per the charter (CONS-350)
  where the renderer allows.
- **Rationale:** Names are the primary reference and must resize correctly rather
  than stay pinned at one size; gating them by zoom keeps the far view uncluttered
  while still delivering names on approach.
- **Acceptance criteria:** below the threshold no labels render (icons only);
  above it, labels appear, grow/shrink smoothly within a bounded min/max, and
  overlapping labels are dropped by collision, not stacked.
- **Verification method:** manual visual check at multiple zooms + unit test on
  the label field/paint expression.
- **Evidence location:** _pending_.

### REQ-003: Hover preview card

- **Statement:** Hovering a marker shows a compact **preview card** anchored near
  the pointer with, at minimum, the **taxon name, age (Ma range), and formation**
  (formation shown as an explicit not-available label when absent, per the
  charter), plus the clade icon. The card dismisses on mouse-out and never blocks
  a click. The existing list cross-highlight (SPEC-009) is preserved.
- **Rationale:** Delivers the answer before the click; directly addresses the
  "just dots" complaint.
- **Acceptance criteria:** hovering a known occurrence shows its name, formatted
  Ma range, and formation (or "Not available"); moving off hides the card;
  clicking still opens the occurrence/selection.
- **Verification method:** automated UI test (jsdom, the canvas-independent path)
  asserting the card content on hover + manual check.
- **Evidence location:** _pending_.

### REQ-004: Clustering and modes preserved

- **Statement:** Low-zoom **clustering** is retained (count discs for density);
  markers become silhouette+label only when unclustered. **Taxon-mode focus**
  (emphasis/dim of a selected taxon's points, SPEC-010 REQ-004) still applies to
  the silhouette markers. **Locality mode** keeps its disc markers unchanged.
- **Rationale:** Density legibility at low zoom and the existing mode semantics
  must survive the visual change.
- **Acceptance criteria:** zooming out clusters points into count discs; a
  selected taxon's silhouettes stay opaque while others dim; locality mode is
  visually unchanged.
- **Verification method:** manual visual check + existing mode tests stay green.
- **Evidence location:** _pending_.

## Non-functional requirements

### NFR-001: Offline, bundled assets (DATA-005 preserved)

- **Statement:** Marker icons are the already-bundled clade assets; no runtime
  network fetch is introduced. Icons are registered once with the map
  (`addImage`) and reused.
- **Acceptance criteria:** no new `fetch`/egress on the map path; `data-005`
  stays green.
- **Verification method:** existing no-egress test + code inspection.
- **Evidence location:** _pending_.

### NFR-002: Performance at stage scale

- **Statement:** Rendering must stay smooth for a full stage's gated occurrence
  set (order 1–4k points). Only a bounded number of images are registered;
  labels rely on MapLibre collision so only non-overlapping labels are drawn.
- **Acceptance criteria:** no perceptible interaction stall panning/zooming a
  large stage on a typical machine; icon set is O(clades), not O(taxa).
- **Verification method:** manual profiling on the largest stage (Campanian).
- **Evidence location:** _pending_.

### NFR-003: Accessibility

- **Statement:** The map remains a visual enhancement; the canvas-independent
  occurrence path (list, keyboard) stays the equivalent route (SPEC-002
  canvas-a11y). Icons carry no meaning that is unavailable in the list/panel.
- **Acceptance criteria:** a11y e2e stays green; no information is icon-only.
- **Verification method:** existing a11y checks + inspection.
- **Evidence location:** _pending_.

## UI or UX impact

- Markers change from teal discs to clade silhouettes with labels; a hover card
  appears. The map legend (if/when added) should name the clade icons. Restraint:
  icons are small, quiet silhouettes; labels are secondary weight; the map and
  its data stay the primary object (charter §4).

## Data model impact

- No schema change is strictly required: the clade group is derived from the
  existing taxon `parentId` chain (`resolveTierTaxon`) and the taxon name +
  `timeRange` + `formation` already live on `ReadOccurrence`. The map (or the
  view) computes each feature's `group` and hover fields when building the
  GeoJSON. (An optional optimisation — precomputing the clade group per
  occurrence — may be added during implementation and, if so, recorded here.)

## Edge cases

- Occurrence with an unresolved major group → generic fallback icon; label still
  shows the taxon name.
- Occurrence with no `formation` → hover card shows an explicit "Not available".
- Occurrence with no paleocoordinate → not placeable (unchanged; already skipped).
- WebGL unavailable → the existing no-map note + list path is unchanged.
- Very dense areas → clustering at low zoom + label collision at high zoom keep
  it legible.

## Acceptance criteria

The map communicates clade and identity without a click: markers are clade
silhouettes, labels scale with zoom and declutter, and hovering shows name · age ·
formation. Clustering, taxon focus, locality mode, offline operation, and the
accessible list path all still work.

## Test plan

- Unit: occurrence→clade-icon mapping; label paint/text expression; hover-card
  content builder.
- UI (jsdom): hover surfaces the preview card content (canvas-independent path).
- Manual: visual check of icons/labels/clustering across zooms and modes on the
  largest stage; performance spot-check.

## Rollback plan

Revert to the disc `points` layer (the change is contained to `OccurrenceMap` and
a hover-card component); no data or schema migration is involved.

## Open questions

- [x] Clade **tint**: shape + subtle tint. *Owner 2026-07-29: shape + subtle
      clade tint (REQ-001).*
- [x] Label density policy. *Owner 2026-07-29: labels only above a zoom threshold
      (REQ-002).*
- [ ] Hover card fields beyond name · age · formation (e.g. source)? Keep minimal
      for restraint unless the owner asks otherwise.
- [ ] Exact zoom threshold for labels and the clade tint palette values — to be
      tuned during implementation (visual, not behavioural).

## Human decisions required

- [x] Clade-icon marker approach (vs. per-taxon silhouettes) — approved
      (owner 2026-07-29).
- [x] Marker colour: shape + subtle tint — approved (owner 2026-07-29).
- [x] Label density: only above a zoom threshold — approved (owner 2026-07-29).

## Conflict check

Extends the map rendering owned by SPEC-003/SPEC-004 and reuses SPEC-012 clade
silhouettes and SPEC-010 mode semantics; no contradiction identified. Locality
markers and the AMEND-005 Wikipedia gate are unaffected.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Marker icon matches taxon clade | automated + manual | clade-icon mapping unit test | _pending_ | |
| REQ-002 | Labels scale + declutter with zoom | manual + unit | label expression test | _pending_ | |
| REQ-003 | Hover shows name·age·formation | automated (jsdom) | hover-card test | _pending_ | |
| REQ-004 | Clustering/focus/locality preserved | manual + existing tests | mode tests | _pending_ | |
| NFR-001 | No new egress | automated | data-005 | _pending_ | |
| NFR-002 | No perceptible stall panning/zooming a large stage | manual profiling | instrumented `texImage2D`/`texSubImage2D` byte counts + MapLibre per-tile `imageAtlas` dimensions, Maastrichtian, headless Chromium 1400x900 | Icon atlas 108.2 MB → 1.11 MB; texture upload during a 40-step pan 47.3 MB → 0.83 MB (largest single upload 33.9 MB → none >1 MB); shipped clade PNGs 5.67 MB → 0.37 MB | |

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Clade coin + silhouette layers | `mapCladeMarkers.ts` (`cladeMarkerForTaxon`, `CLADE_MARKERS`), `OccurrenceMap.tsx` (`points-bg` tinted coin + `points-icon` silhouette), legend | `test/ui/map-clade-markers.test.ts` | Done |
| REQ-002 | Zoom-gated DOM labels | `mapLabels.ts` (`computeMapLabels`), `OccurrenceMap.tsx` (`recomputeLabels`, `LABEL_MIN_ZOOM`, `.mapLabel`) | `test/ui/map-labels.test.ts` | Done |
| REQ-003 | Hover preview card | `MapHoverCard.tsx` (`hoverCardContent`, `MapHoverCard`), `OccurrenceMap.tsx` (pointer handler) | `test/ui/map-clade-markers.test.ts` (content) | Done |
| REQ-004 | Clustering/focus/locality | `OccurrenceMap.tsx` (`clusters` layer retained, `points-icon`/`points-bg` focus opacity, locality discs) | existing mode tests | Done |
| NFR-002 | Bounded icon-atlas + asset footprint | `scripts/shrink_clade_icons.ts` (committed assets), `OccurrenceMap.tsx` (`ICON_ASSET_DOWNSCALE`/`ICON_ATLAS_DOWNSCALE`/`ICON_SIZE_SCALE`, `loadIconImage`, compensated `icon-size`) | manual profiling (see verification matrix) | Done |

## Implementation notes

- Labels are DOM overlays (`.mapLabel`), not MapLibre symbol text, because the
  self-contained style bundles no glyphs (SEC-001). Projection + zoom gating live
  in `OccurrenceMap`; collision culling is the pure `computeMapLabels`.
- Marker = a pale, clade-tinted circle "coin" (`points-bg`, `circle-color` from
  the feature `tint`) with the raster clade silhouette on top (`points-icon`).
  The tint is deliberately muted so the dark silhouette stays legible (shape
  first). Exact tint saturation, `LABEL_MIN_ZOOM`, and marker sizes are visual
  tunables.
- Verified offline in a real browser (self-contained map, no network): icons,
  tinted coins, collision labels, and the clade legend all render; no console
  errors.
- **Icon raster size (NFR-002).** The clade artwork arrived as ~1254 px
  opaque-white-backed PNGs, but the map draws it at 22–40 CSS px. MapLibre packs
  registered images into a **per-tile** `imageAtlas` at each image's *native*
  size, so the first cut registered them full-resolution and paid ~35 MB of atlas
  texture per tile — 108 MB across the initially loaded tiles, with a 33.9 MB
  `texImage2D` upload landing mid-pan as new tiles arrived. The shipped assets
  additionally cost 5.67 MB of download and were background-stripped in the
  browser on every load. The size is now split across two stages whose product,
  `ICON_SIZE_SCALE`, every `icon-size` is multiplied by, so markers render at the
  size this spec tuned:
  - `scripts/shrink_clade_icons.ts` (`pnpm run shrink:clade-icons`) bakes the
    alpha mask into the committed PNGs and divides each by
    `ICON_ASSET_DOWNSCALE`, giving 418 px (512×341 for the fallback) and
    5.67 MB → 0.37 MB. Build-time only; the app ships the committed output, so
    DATA-005 is untouched. Idempotent — an asset already at target is skipped.
  - `OccurrenceMap.loadIconImage` applies `ICON_ATLAS_DOWNSCALE` when
    registering, giving the ~125 px atlas rasters. That still supersamples a
    40 px marker at 2x DPR.

  Both stages divide every asset by the same factor, so the icons keep their
  relative proportions and the marker geometry is unchanged: a screenshot diff at
  a fixed view shows 0.45% of subpixels changed, confined to silhouette
  antialiasing edges. Because the PNGs are pre-masked, the runtime near-white
  threshold was removed — re-applying it would eat the antialiased edges.
- Observation, not addressed here: `Illustration.tsx` (the 220 px clade
  silhouette fallback, SPEC-012/SPEC-014 REQ-003) is no longer imported anywhere
  since AMEND-005 made the taxon page an inline Wikipedia article. The 418 px
  assets keep headroom for it if it returns; whether it should is a question for
  a future spec.

## Spec amendments

### AMEND-001: Aggregate identity, interactive pinned card, live labels, transparent icons, Thyreophora

- **Date / owner:** 2026-07-30, owner-directed after on-device testing.
- **Trigger:** Owner testing surfaced five issues in the first cut.
- **Changes:**
  1. **Aggregate identity (refines REQ-004).** Clusters now render the **generic
     dinosaur silhouette + a count** (owner choice), on a pale disc sized by
     count. Labels are built only from the **rendered, unclustered** markers
     (`queryRenderedFeatures` on `points-icon`), so a taxon name can never float
     next to a cluster that has no clade icon. Clustering also declusters sooner
     (`clusterRadius` 28, `clusterMaxZoom` 7).
  2. **Interactive pinned card (extends REQ-003).** Clicking a marker **pins** the
     card open; it becomes interactive with an **"Open taxon profile →"** button
     (new `onOpenProfile`) and a ✕ close, and follows its marker as the map moves.
     Hover remains the passive preview and is suppressed while a card is pinned.
  3. **Live overlays (refines REQ-002).** Labels, cluster counts, and the pinned
     card recompute on the continuous `move` event (rAF-throttled), not just
     `moveend`, so they track the map instead of lagging until it stops.
  4. **Transparent icons (refines REQ-001).** The bundled clade PNGs are opaque
     (white background); they are masked to transparency in the browser at load
     (canvas), so the silhouette sits cleanly on the round coin. Still offline.
  5. **Clade naming fix.** The Stegosauria + Ankylosauria group is labelled
     **Thyreophoran** (was the incorrect "Armoured").
- **Test impact:** existing SPEC-015 unit tests unchanged (clade mapping, hover
  content, label collision remain valid); map interaction verified in-browser.
- **Human approval reference:** owner conversation 2026-07-30 (issues 1–5, with
  "generic clade icon + count" chosen for aggregates).

### AMEND-003: Tints for the two great divisions (owner, 2026-08-06)

**What changed.** `Ornithischia` and `Saurischia` were recognised as major groups
by `resolveTierTaxon` but had no entry in the marker table, so every taxon that
resolved no deeper than a great division fell back to the neutral "Dinosaur"
tint. They now have tints of their own: Ornithischian `#9cc49b`, Saurischian
`#cbb49b`.

**Why.** SPEC-017's clade fan draws clades rather than occurrences, which exposed
the gap: **125 of its 319 wedges** were neutral, including Ornithischia (652
genera), Saurischia (502), Neornithischia (445) and Pyrodontia (417) — over a
third of the tree rendered as "unclassified" when it was nothing of the sort. The
owner approved the change knowing it also recolours map markers for occurrences
that resolve only to a division.

**The trade-off, stated plainly.** Both new entries reuse the generic dinosaur
silhouette, because no icon meaningfully depicts a whole division. The map legend
therefore shows three entries sharing one shape, separated by tint and label.
That is a real cost; it is accepted because the *label* carries the meaning, so
identity never rests on colour alone (PERF-250), and because the alternative —
leaving a third of the taxonomy grey — misinforms.

**Colour selection.** Both were chosen against the existing seven for perceptual
separation (ΔE ≥ 15 from the nearest neighbour, 25.6 between the two) and for
contrast against the fan's label colour (7.2:1 and 7.4:1, comfortably AA). The
charter records them, and `test/ui/spec017-fan-contrast.test.ts` recomputes the
contrast of every tint on every run, so a future retune cannot ship an
unreadable label.

### AMEND-002: Count badge placement, sparse labels, multi-species aggregate card

- **Date / owner:** 2026-07-30, owner-directed after further testing.
- **Changes:**
  1. **Count badge (refines AMEND-001 #1).** The cluster count is a small pill at
     the disc's **top-right**, not centred over the silhouette.
  2. **Sparse labels (refines REQ-002).** Labels feel Google-Maps-natural: the
     zoom threshold rose (`LABEL_MIN_ZOOM` 4→5) and the on-screen count is capped
     (`MAX_LABELS` = 10), so names read instead of swarming.
  3. **Multi-species aggregate (refines AMEND-001 #1 / #3).** Occurrences at the
     **same place stay one aggregate** (`clusterMaxZoom` raised to 14 so distinct
     points separate on zoom but co-located ones never do). Clicking a small or
     coincident aggregate opens a **species-list card** (`MapSpeciesCard`) naming
     every distinct taxon there (clade icon + name + clade), each row opening that
     taxon's page; big dense clusters still zoom in. Leaves are read via the
     GeoJSON source's `getClusterLeaves`.
  4. **Dev-only map hook.** `window.__paleoMap` is exposed under
     `import.meta.env.DEV` (stripped from production) for deterministic UI testing.
- **Test impact:** existing SPEC-015 unit tests unchanged; map interaction and the
  `getClusterLeaves` species path verified in-browser (a 7-point cluster → "4
  species here": Edmontosaurus, Tyrannosaurus, Leptoceratops, Saurexallopus).
- **Human approval reference:** owner conversation 2026-07-30 (count off-centre;
  fewer labels; keep the multidot aggregate and list its species on click).
