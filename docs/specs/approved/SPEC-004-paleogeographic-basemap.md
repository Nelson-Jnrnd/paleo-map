---
doc_type: spec
spec_id: SPEC-004
title: Paleogeographic basemap — reconstructed continents under the occurrences
status: Approved
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, map-rendering]
affected_interfaces: [static-data-artifacts]
supersedes: []
superseded_by:
depends_on: [SPEC-001, SPEC-002, SPEC-003]
conflicts_with: []
last_verified_at: 2026-07-12
---

# SPEC-004: Paleogeographic basemap — reconstructed continents under the occurrences

## Summary

The exploration map (SPEC-003) currently draws occurrence points on an empty
bathymetric gradient — there are no continents. For a *paleogeographic* atlas
that is the central missing piece: a user cannot see **where** a fossil sat
relative to the ancient coastlines. This spec adds a **reconstructed continental
basemap** (land/coastline geometry for the MVP time window) rendered beneath the
occurrence markers, bundled as static geometry with no runtime egress, attributed
to its source and rotation model, and — critically — expressed in the **same
reference frame (Scotese/PALEOMAP-2016)** as the occurrence paleocoordinates so
points and coasts actually align. It carries one real human decision: **which
coastline dataset** to use.

## Context

SPEC-001 pins the plate-rotation model to **Scotese/PALEOMAP** (`pgm=scotese`,
AMEND-001); every occurrence paleocoordinate in the snapshot is produced in that
frame. SPEC-002 left the "paleocoastline vector source for the basemap outlines"
as an open question tied to that rotation model. SPEC-003 shipped the exploration
view but scoped the basemap out (assumption A-1), rendering a graticule/ocean
placeholder and labeling the map a reconstruction. This spec closes A-1. It reuses
the existing MapLibre map (`src/app/components/OccurrenceMap.tsx`) and the static
data-delivery architecture; it changes no SPEC-001 data model.

## Problem statement

The map shows dots on blue with no landmasses, so it does not communicate
paleogeography and cannot be trusted as a reconstruction. We need reconstructed
continental geometry for the MVP window, drawn under the occurrences, sourced and
attributed, aligned to the occurrences' rotation model, bundled statically, and
degrading gracefully if absent — without adding a runtime backend or a
proprietary/token map service.

## Goals

- Render reconstructed continental land/coastlines under the occurrence markers
  for the MVP window, replacing the empty gradient.
- Keep the basemap in the **same reference frame** as the occurrence
  paleocoordinates (Scotese/PALEOMAP-2016) so markers sit correctly on the coasts.
- Bundle the geometry as **static vector data** (GeoJSON) with no runtime egress
  and no token-gated tiles (consistent with SPEC-002 REQ-001/006, SEC-001).
- Attribute the basemap: visible source citation + rotation model, keeping the
  existing "paleogeographic reconstruction" label (FONC-300).
- Degrade gracefully to the current ocean/graticule if geometry is missing or
  fails to parse, without breaking markers or the loop.

## Non-goals

- **Continuous drift animation** or a time-scrubbed morphing coastline (explicit
  MVP exclusion) — the MVP ships one representative reconstruction for the window.
- **Per-stage coastlines** (a distinct outline for Santonian vs Campanian vs
  Maastrichtian) — recorded as an open question; one Late-Cretaceous reconstruction
  is acceptable for the MVP (assumption to confirm).
- **In-browser plate rotation** (running a rotation engine at runtime) — geometry
  is pre-reconstructed at build time and shipped static.
- Bathymetry, topography, paleo-rivers, or biome shading — land vs sea only.
- Changing occurrence paleocoordinates, the rotation model, or any SPEC-001 data.

## Users or actors

The **Explorer** (SPEC-003), who needs to see a fossil's position relative to the
ancient coastline to make sense of "where"; and the **build** step that fetches or
embeds and simplifies the geometry.

## Functional requirements

### REQ-001: Reconstructed continental basemap under the occurrences

- **Statement:** The map must render reconstructed continental land (and its
  coastline) for the MVP time window as a filled layer beneath the occurrence
  markers, using the design charter's land/coast tokens.
- **Rationale:** Without landmasses the map is not paleogeographic (FONC-210/220);
  the charter makes the map + its data the primary object.
- **Acceptance criteria:** On load, continental polygons render under the markers,
  styled with `--color-land` / `--color-coast`; occurrence markers remain on top
  and selectable; the ocean remains the pale bathymetric tint.
- **Verification method:** real-browser E2E asserting the land layer exists +
  manual check against the charter.
- **Evidence location:** _to be filled at implementation._

### REQ-002: Reference-frame consistency with the occurrences

- **Statement:** The basemap geometry must be reconstructed in the **same plate
  frame and target age** as the occurrence paleocoordinates (Scotese/PALEOMAP-2016;
  SPEC-001 AMEND-001). If, by human decision, a different model is used, the
  resulting frame mismatch must be **disclosed in the UI**, not hidden.
- **Rationale:** Occurrence paleocoords come from `pgm=scotese`; coastlines from a
  different model would place points off their true coasts — a silent scientific
  error (charter §2, CONS-490).
- **Acceptance criteria:** The bundled geometry records its rotation model +
  target age; it matches the snapshot's `rotationModel`/`rotationModelVersion`; if
  it does not, the map shows an explicit "coastlines and points use different
  reconstructions" note.
- **Verification method:** build-time metadata check + component test of the
  mismatch note.
- **Evidence location:** _to be filled at implementation._

### REQ-003: Source, attribution, and reconstruction labeling

- **Statement:** The basemap must carry a visible, identifiable **source citation**
  and the **rotation model/age**, and retain the "paleogeographic reconstruction"
  label. The geometry's dataset licence must be recorded in-repo.
- **Rationale:** Provenance is first-class (charter §2, FONC-300, PERF-140-style
  attribution); licence clarity mirrors SPEC-002 SEC-001.
- **Acceptance criteria:** The map (or an attribution control) shows the coastline
  source + model + age; a `LICENSE`/attribution note for the dataset exists in the
  repo; the reconstruction label remains present.
- **Verification method:** component test + repo inspection.
- **Evidence location:** _to be filled at implementation._

### REQ-004: Graceful degradation

- **Statement:** If the basemap geometry is absent or fails to load/parse, the map
  must fall back to the current ocean/graticule and keep rendering occurrences and
  the loop, surfacing at most a quiet note — never a blank or broken map.
- **Rationale:** Robustness for all real states (charter §7, FONC-1310 spirit).
- **Acceptance criteria:** With geometry removed, the map still boots, markers
  render, and the exploration loop completes; no error is thrown.
- **Verification method:** component/E2E test with geometry omitted.
- **Evidence location:** _to be filled at implementation._

## Non-functional requirements

### NFR-001: Geometry payload budget

- **Statement:** The bundled coastline geometry must be simplified so its
  transferred size stays within a documented budget (target ≤ ~250 KB gzipped for
  the MVP window) and does not regress the SPEC-002 first-content/bundle budgets.
- **Rationale:** The static-client PERF budgets (SPEC-002 NFR-001) must hold; raw
  paleocoastlines can be large.
- **Acceptance criteria:** The shipped geometry file is within budget; the number
  is recorded; the map still meets the first-content budget.
- **Verification method:** size inspection in CI/build.
- **Evidence location:** _to be filled at implementation._

## Security and privacy considerations

### SEC-001: Static, self-contained geometry

- **Statement:** The geometry must be bundled/served as a static local file with
  no runtime egress and no token-gated tile service; no secret or key is added.
- **Rationale:** Preserves SPEC-002 REQ-001/SEC-001 (no backend, no proprietary map
  SDK, no runtime calls).
- **Acceptance criteria:** No new network host is contacted at runtime; the basemap
  loads from the app's own artifacts only.
- **Verification method:** code + network inspection.
- **Evidence location:** _to be filled at implementation._

## Data model impact

None to SPEC-001. Adds a **build/app asset**: a static GeoJSON (or equivalent) of
reconstructed continental polygons for the MVP window, plus a small metadata
record (source, rotation model, target age, licence). This is a basemap asset, not
part of the snapshot read model; it does not touch `ReadModel`.

## API impact

No runtime API. Adds one static asset the app loads locally, alongside the existing
`data/snapshot.json`.

## UI or UX impact

Realizes the charter's "light bathymetric chart with reconstructed continental
masses" for the exploration map. Land uses `--color-land` (`#edf1f1`) with
`--color-coast` (`#a9b9c3`) edges; occurrences stay the teal data layer on top.
No new UX requirement IDs (product requirements remain in the functional spec).

## Configuration impact

Adds the geometry asset and its metadata/attribution; possibly a build step to
fetch + simplify the source dataset (or a committed pre-simplified file if the data
must be sourced offline). A documented size budget (NFR-001).

## Error handling

- Geometry missing/invalid → fall back to ocean/graticule + quiet note (REQ-004).
- Frame mismatch (different model chosen) → explicit disclosure note (REQ-002).

## Edge cases

- **Antimeridian / projection wrap** of continental polygons at world zoom — must
  render without slivers or fill artifacts.
- **Geometry vs marker draw order** — land must never occlude or steal clicks from
  occurrence markers.
- **Offline build environment** — if the source dataset cannot be fetched at build
  time here, a pre-simplified geometry file is committed (recorded as an assumption
  at implementation).

## Acceptance criteria

Satisfied when the exploration map shows reconstructed continents under the
occurrences (REQ-001) in the occurrences' own rotation frame or with disclosed
mismatch (REQ-002), sourced/attributed and labeled a reconstruction (REQ-003),
degrading gracefully when absent (REQ-004), all as static self-contained geometry
within budget (NFR-001, SEC-001).

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Land renders under markers, charter-styled | manual + automated | E2E land-layer check + mockup | _TBD_ | _TBD_ |
| REQ-002 | Same frame as occurrences, or disclosed | automated | metadata check + mismatch test | _TBD_ | _TBD_ |
| REQ-003 | Source + model + licence shown/recorded | automated + inspection | component test + repo check | _TBD_ | _TBD_ |
| REQ-004 | Falls back cleanly when geometry absent | automated | component/E2E test | _TBD_ | _TBD_ |
| NFR-001 | Geometry within documented budget | inspection | size check | _TBD_ | _TBD_ |
| SEC-001 | Static, no runtime egress/token | inspection | code + network check | _TBD_ | _TBD_ |

## Test plan

- Component test: land layer present under markers; attribution shown; frame
  mismatch note appears when metadata differs; fallback when geometry omitted.
- Real-browser E2E: the built map renders the continental layer and markers stay
  selectable.
- Build/size check for NFR-001. Manual check against the charter's cartographic
  look.

## Rollback plan

Additive: a geometry asset + a basemap layer in `OccurrenceMap.tsx` and its
attribution. Rolling back removes the layer/asset and returns to the SPEC-003
graticule/ocean placeholder; occurrences and the loop are unaffected.

## Open questions

- [x] **Coastline dataset / source** — resolved to schematic (see Human decisions);
  real frame-matched data is the recorded upgrade path.
- [x] One reconstruction for the window vs per-stage — resolved: one for the MVP;
  per-stage deferred.
- [x] Fetch-and-simplify vs committed geometry — resolved: generated at
  `predev`/`prebuild` by `scripts/gen_basemap.ts` (env cannot fetch real data).

## Human decisions required

- [x] **Coastline data source — final: real GPlates PALEOMAP (Scotese) coastlines
  (see AMEND-001).** Three options were prepared (schematic; real Scotese/PALEOMAP;
  open GPlates model). It was *first* implemented as schematic on the mistaken
  belief the environment couldn't fetch data; when that was challenged and
  disproved, it was replaced with **real** reconstructed coastlines from the
  GPlates Web Service in the **same `scotese` frame as the occurrences**, so land
  and points align (REQ-002 matching branch). Geometry is fetched + simplified by
  `scripts/fetch_basemap.ts` and **committed** so build/CI stay offline. **Owner:
  ratification still invited.**
- [x] **One reconstruction for the MVP window** — confirmed; per-stage coastlines
  deferred.
- [x] Approved — proceeded to implementation under owner direction; status set to
  Approved. Owner ratification of the source choice above is still invited.

## Conflict check

Depends on SPEC-001 (rotation model), SPEC-002 (static delivery), and SPEC-003
(the map it extends). Resolves SPEC-002's open "paleocoastline vector source"
question and SPEC-003's assumption A-1. Introduces no product requirements and no
new data model. No contradiction with existing specs.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Map basemap layer | `src/app/components/OccurrenceMap.tsx` | _TBD_ | In Review |
| REQ-002 | Frame metadata | basemap asset + map | _TBD_ | In Review |
| REQ-003 | Attribution | map attribution control | _TBD_ | In Review |
| REQ-004 | Fallback | `OccurrenceMap.tsx` | _TBD_ | In Review |
| NFR-001 | Geometry asset | build/asset | _TBD_ | In Review |
| SEC-001 | Static delivery | basemap asset | _TBD_ | In Review |

## Implementation notes

Implemented on branch `claude/exploration-view-ui-slice-pf0cso`. Final state per
AMEND-001 (real data):

- **Geometry:** `scripts/fetch_basemap.ts` fetches reconstructed coastlines from
  the GPlates Web Service (PALEOMAP/Scotese model, 70 Ma), Douglas–Peucker-
  simplifies (tol 0.3°) + rounds to 2 dp, and writes **committed**
  `public/basemap/late-cretaceous.geojson` (315 polygons, ~29 KB gzipped) +
  `.meta.json`. Committed so build/CI are offline and reproducible.
- **Rendering (REQ-001):** `src/app/components/OccurrenceMap.tsx` loads the
  geometry (`src/app/data/basemap.ts`) and draws `land-fill` + `land-line` layers
  beneath the occurrence markers; markers stay on top and selectable.
- **Frame match (REQ-002):** the geometry's model is `scotese`, matching the
  snapshot; `describeFrame` confirms the shared reconstruction in the attribution
  overlay, which also states the single-70 Ma representative age for the window.
- **Attribution/licence (REQ-003):** overlay cites the GPlates source + model +
  CC BY 4.0; provenance recorded in `late-cretaceous.meta.json`.
- **Fallback (REQ-004):** `loadBasemap` resolves to null on any failure; the map
  keeps ocean/graticule, markers, and the loop.
- **Verification:** `test/ui/basemap.test.ts` (5, frame + load paths); E2E
  asserts the GPlates attribution + "same reconstruction" note; a browser
  screenshot shows real continents (Western Interior Seaway) with the occurrence
  cluster in its Laramidian position. 47 unit/component tests + 2 E2E green;
  `pnpm run build` within budget.

The map is a **single 70 Ma reconstruction** for the whole window (per non-goals);
per-stage coastlines remain deferred. Geometry holes (inland seas) are dropped by
the simplifier — acceptable for a basemap.

## Spec amendments

### AMEND-001: Real GPlates PALEOMAP coastlines instead of the schematic outline

- **Date:** 2026-07-12
- **Reason:** The original source decision picked the schematic outline on the
  belief that the build environment could not reach external data. That was
  **wrong** — outbound HTTPS works (verified against `gws.gplates.org`,
  `paleobiodb.org`). Real, frame-matched data (the originally-preferred Option 2)
  is obtainable, so it replaces the schematic placeholder.
- **Changed requirements:** REQ-001, REQ-002, REQ-003, NFR-001 — now satisfied by
  **real** geometry: reconstructed Late-Cretaceous coastlines from the **GPlates
  Web Service** using the **PALEOMAP (Scotese) model**, i.e. the same plate frame
  PBDB uses for `pgm=scotese` (SPEC-001). REQ-002 is now met by the **matching-
  frame** branch (land and points share the `scotese` reconstruction), not the
  disclosure branch.
- **Behavioral impact:** The map draws real continents (North America split by the
  Western Interior Seaway, etc.); the occurrence cluster sits in its true Laramidian
  position; the attribution states the shared reconstruction and notes the single
  70 Ma representative age for the window. The schematic generator
  (`scripts/gen_basemap.ts`) is removed; a fetch+simplify tool
  (`scripts/fetch_basemap.ts`) produces committed, offline-reproducible geometry
  simplified to ~29 KB gzipped (Douglas–Peucker, tol 0.3° — well under the NFR-001
  budget).
- **Test impact:** `test/e2e/exploration.e2e.ts` now asserts the GPlates source +
  "same reconstruction" note; `test/ui/basemap.test.ts` unchanged (frame logic
  covers both branches).
- **Human approval reference:** Made under owner direction after the owner
  challenged the "environment is limited" claim; owner ratification still invited.

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [x] Open questions resolved or explicitly deferred.
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed.
- [x] Human approval recorded (proceeded under owner direction; source
      ratification invited).
