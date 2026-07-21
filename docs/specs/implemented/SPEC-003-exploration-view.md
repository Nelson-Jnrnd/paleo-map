---
doc_type: spec
spec_id: SPEC-003
title: Exploration view — first UI vertical slice
status: Implemented
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: [6]
affected_components: [app-frontend, map-rendering, styling, exploration-view, occurrence-panel, taxon-profile]
affected_interfaces: [static-data-artifacts]
supersedes: []
superseded_by:
depends_on: [SPEC-001, SPEC-002]
conflicts_with: []
last_verified_at: 2026-07-11
---

# SPEC-003: Exploration view — first UI vertical slice

## Summary

Builds the **first running UI** of the atlas: an exploration view that renders a
paleogeographic map, a **timeline stepped by geological stage**, and the fossil
**occurrences read from the SPEC-001 dated snapshot**, wired together so a user
can complete the core loop — **time → map → occurrence → taxon → back to map**.
It is a thin but end-to-end vertical slice: just enough of each surface to pass
the MVP validation scenarios **PERF-340** (period → filter dinosaurs → select an
occurrence → open a taxon profile → return to the map), **PERF-360** (change the
age → occurrences update, no full reload) and **PERF-370** (filter with no
result → empty state → reset). It realizes the approved stack (SPEC-002: React +
Vite + MapLibre + CSS-Modules tokens, reading prebuilt static JSON) and the
exploration-view mockup, and introduces no new product requirements — those live
in the [functional specification](../../product/functional-specification.md).

## Context

The repository has an approved data architecture (SPEC-001) with a working
ingestion pipeline that emits a dated snapshot read model, an approved technology
stack (SPEC-002), a binding [design charter](../../mockups/design-guidelines.md),
and high-fidelity [mockups](../../mockups/exploration-view.md) — but **no
application code yet**. SPEC-002 selects the stack and states its acceptance is
verified "at implementation"; this spec is that first implementation. It consumes
the `ReadModel`/`ReadApi` already built under `src/domain` and `src/read`
(SPEC-001) and does not change them. The scope is deliberately the single most
valuable slice: the exploration hub plus the one-hop occurrence panel and taxon
profile needed to close the loop.

## Problem statement

There is no way to *see* the data. A user cannot yet pick an age, look at where
dinosaurs are known from, inspect an occurrence's provenance, or open a taxon.
We need a running, static, client-only exploration view that reads the snapshot
and completes the core exploration loop end-to-end, on top of the already-approved
stack and design system — without over-building screens (full filters panel,
search, classification browser) that later slices own.

## Goals

- Ship a running React + Vite static SPA (SPEC-002 REQ-003) that boots and reads
  the SPEC-001 snapshot as **prebuilt static JSON** (SPEC-002 REQ-006) with no
  runtime backend or upstream egress (SPEC-002 REQ-001).
- Render the exploration view of the [mockup](../../mockups/exploration-view.md):
  paleogeographic map, stage-stepped timeline, and persistent context (selected
  age, selected group, visible-occurrence count).
- Render occurrences from the snapshot as selectable map markers **and** as an
  equivalent keyboard-reachable list (the accessible path the charter requires),
  so uncertainty and source are legible per occurrence.
- Close the loop: select an occurrence → occurrence panel → open taxon profile →
  return to the map, preserving age and filters.
- Pass **PERF-340, PERF-360, PERF-370** as automated tests.
- Keep provenance/uncertainty first-class per the charter §2 (reconstructed,
  approximate, missing, source-per-occurrence all visible, never hover-only).

## Non-goals

- The full **filters panel** (multi-facet), free-text **search** (PERF-350), and
  the **classification/taxonomy browser** — later slices; this slice ships only
  the dinosaurs-only group toggle and the stage timeline needed for the loop.
- Real **paleocoastline geometry / plate rotation** for the basemap — SPEC-001
  leaves the coastline vector source open; this slice uses a neutral graticule
  world with occurrence paleocoordinates plotted on it, explicitly labeled a
  reconstruction. (Recorded assumption A-1.)
- **Occurrence clustering tuning** beyond MapLibre's built-in clustering — MVP
  data volume is tiny; PERF-090/100/120 are satisfied structurally, not tuned.
- **URL/deep-link state**, persistence, and the map **loading/error** network
  states beyond a basic implementation (the data-load loading/empty/error states
  *are* in scope; a MapLibre tile-failure state is minimal). (Assumption A-2.)
- Any change to SPEC-001 domain/pipeline/read code or the snapshot schema.
- The full Playwright + axe CI gate build-out (SPEC-002 REQ-008/010, NFR-002) as
  a required CI job — this slice delivers the scenario tests as automated
  integration tests and provides Playwright scaffolding; wiring the browser-based
  a11y/E2E jobs into required CI is its own follow-up. (Assumption A-3.)

## Users or actors

The **Explorer** (charter §1): a scientifically literate non-specialist who wants
to know *where and when* a dinosaur is known from fossil evidence and to trust
the provenance. Secondarily, the **build/CI system** that type-checks, tests, and
produces the static bundle + data artifact.

## Functional requirements

### REQ-001: Exploration view shell with persistent context

- **Statement:** The app must present a single exploration view combining the map,
  the timeline control, and the group filter, and must **permanently display** the
  selected geological age (in Ma), the selected taxonomic group, and the count of
  visible occurrences matching the active filters. These controls stay visible
  (not hidden behind menus).
- **Rationale:** FONC-010/040/050/060, CONS-450; the mockup's context bar. The
  loop needs a stable hub that always shows where the user is.
- **Acceptance criteria:** On load, the view shows a map region, a stage timeline,
  a group control defaulting to dinosaurs, and a context strip reading the current
  stage/age in Ma, the group ("Dinosaurs"), and a numeric occurrence count that
  matches the number of occurrences passing the active filters.
- **Verification method:** automated component test + manual check against mockup.
- **Evidence location:** `test/ui/exploration-context.test.tsx`.

### REQ-002: Paleogeographic map, labeled as a reconstruction

- **Statement:** The app must render a world map for the selected age with
  occurrences drawn at their **reconstructed paleocoordinates** as points/clusters,
  visually distinguishing an individual occurrence from a group, and must carry a
  visible label stating the map is a paleogeographic reconstruction. Zoom and pan
  must be available.
- **Rationale:** FONC-210/220/230/240/250/260/300, CONS-130/140; charter §2 (points
  are discovery evidence, positions are reconstructed).
- **Acceptance criteria:** The map renders a non-street custom basemap via MapLibre;
  occurrences with a paleocoordinate appear as teal markers; single vs grouped
  markers are distinguishable by shape/label, not colour alone; a persistent
  "Paleogeographic reconstruction" label is present; the map is zoomable/pannable.
  When WebGL/map init is unavailable the accessible occurrence list (REQ-003)
  remains the equivalent path.
- **Verification method:** manual/inspection against the mockup + component test of
  the reconstruction label and the accessible fallback.
- **Evidence location:** `src/app/components/OccurrenceMap.tsx`, `docs/assets/mockups/exploration-view.svg`.

### REQ-003: Occurrences as a keyboard-reachable, provenance-legible list

- **Statement:** Alongside the map, the app must list the visible occurrences in a
  keyboard-reachable panel, each row showing at minimum the taxon (scientific name,
  italic), the time range with units (Ma), and an **identifiable source**, and
  marking **reconstructed** position, **approximate** time range, and **missing**
  paleoposition explicitly (not colour-only). Selecting a row selects the
  occurrence.
- **Rationale:** FONC-230/270/1100/1130/1140/1150, PERF-140/150/230/250, CONS-490;
  charter §2 and SPEC-002's canvas-accessibility edge case (an accessible path to
  every occurrence independent of the map canvas).
- **Acceptance criteria:** Every visible occurrence appears as a focusable control;
  each shows taxon, time range in Ma, and a source reference; occurrences with a
  reconstructed paleoposition show a "reconstructed" cue, approximate ranges an
  "approximate" cue, and a null paleoposition an explicit "Not available"; all cues
  have a text label, not colour only; activating a row opens its occurrence panel.
- **Verification method:** automated component + a11y-oriented test.
- **Evidence location:** `test/ui/occurrence-list.test.tsx`.

### REQ-004: Stage-stepped timeline that updates occurrences

- **Statement:** The timeline control must step the selected age by **geological
  stage** across the snapshot's Mesozoic window, display the selected age in Ma,
  and — on change — update the visible occurrences and count so that an occurrence
  is shown only when the selected stage overlaps its known time range, **without a
  full application reload**.
- **Rationale:** FONC-090/100/110/120/130/140/150/160/170; PERF-030/360; the mockup
  resolves OQ-030 to stage stepping with the age shown in Ma.
- **Acceptance criteria:** The control exposes the window's stages; the selected
  stage and its Ma bounds are shown; stepping to another stage changes the visible
  occurrence set/count per stage overlap (using the SPEC-001 `stagesInRange`
  overlap), and the change happens in-place (no navigation/reload). A precise
  selected age is visually distinct from an occurrence's time range.
- **Verification method:** automated scenario test (PERF-360).
- **Evidence location:** `test/ui/scenario-perf-360.test.tsx`.

### REQ-005: Group filter (dinosaurs default) and reset

- **Statement:** The app must default the group to **dinosaurs** on first load,
  display the active group permanently, treat every snapshot taxon as **main
  content**, and provide a **reset** that returns filters to their defaults. It
  must not present the app as a complete atlas of all Mesozoic life.
- **Rationale:** FONC-020/030/050/080/400/410; MVP is dinosaurs-only (OQ-050) so the
  main/secondary machinery is present but vacuously satisfied; CONS-450.
- **Acceptance criteria:** On load the group reads "Dinosaurs" and dinosaur
  occurrences are shown; a reset control restores the default stage and group and
  clears any selection; taxa are labeled main content; a disclaimer/label conveys
  the app is not a complete atlas of all Mesozoic life.
- **Verification method:** automated component test.
- **Evidence location:** `test/ui/exploration-context.test.tsx`.

### REQ-006: Occurrence panel

- **Statement:** Selecting an occurrence must open a panel showing, at minimum, its
  taxon, time range, modern location, reconstructed paleogeographic position, and
  source; missing values must be shown with an explicit "Not available" label, and
  reconstructed/approximate must be labeled. The panel's primary action is **Open
  taxon profile**.
- **Rationale:** FONC-270/289/290/890/900/910/920/930/1130/1140; PERF-180; charter §2/§5.
- **Acceptance criteria:** The panel shows taxon (italic scientific name), time
  range in Ma (with an "approximate" cue when applicable), modern region,
  paleoposition (or "Not available" when null) labeled "reconstructed", and a
  resolvable source reference; it presents a single primary "Open taxon profile"
  action.
- **Verification method:** automated component test + scenario test.
- **Evidence location:** `test/ui/occurrence-panel.test.tsx`.

### REQ-007: Taxon profile and single-action return

- **Statement:** From an occurrence panel the app must open a taxon profile in **≤2
  actions** from a visible occurrence, showing the scientific name, rank,
  classification/validity (flagging invalid/doubtful/synonymous/uncertain when
  known), time range, occurrences, modern discovery locations, paleogeographic
  positions, and sources — with interpretative data visually separated from
  fossil-derived data, minimal profiles flagged, and missing fields explicitly
  labeled — and must allow **return to the map in ≤1 action**, preserving the
  selected age and active filters.
- **Rationale:** FONC-410/430/440/450/480/490/510…590/670/720/990/1000/1010/1020/1070/1080/1300;
  PERF-180; CONS-440/460/470/490; charter §2.
- **Acceptance criteria:** From a visible occurrence, ≤2 activations reach the
  profile; the profile shows name (italic), rank, validity with citation (and a
  status flag when not "Valid"), time range(s), the taxon's occurrences with modern
  + reconstructed positions and sources, and interpretative attributes in a
  visually separated block; an OccurrenceOnly/minimal profile is labeled as such;
  missing fields read "Not available"; a single "Back to map" action returns to the
  exploration view with the prior age and filters intact.
- **Verification method:** automated scenario test (PERF-340).
- **Evidence location:** `test/ui/scenario-perf-340.test.tsx`.

### REQ-008: Required data-state surfaces (loading, empty, error, minimal)

- **Statement:** The app must present real states, not just the happy path: a
  **loading** state while the snapshot loads and while the map initializes; an
  **empty** state when the active filters return no occurrence, offering reset; an
  **error** state with **retry** if the snapshot fails to load, preserving filters;
  and a **minimal-data** label on sparse profiles.
- **Rationale:** FONC-1260/1280/1300/1310/1330/1340; PERF-050; charter §7.
- **Acceptance criteria:** Before data resolves a loading indicator is shown; a
  stage with no matching occurrences shows an empty state with a reset action that
  restores results; a forced snapshot-load failure shows an error with a retry
  control and keeps the selected filters; a profile with no attributes/measurements/
  summary is labeled minimal ("Occurrence only").
- **Verification method:** automated scenario test (PERF-370) + component tests.
- **Evidence location:** `test/ui/scenario-perf-370.test.tsx`, `test/ui/data-states.test.tsx`.

## Non-functional requirements

### NFR-001: Static build, no runtime egress

- **Statement:** A production build must be static assets plus a prebuilt data
  artifact, servable with no server process; at runtime the app must fetch only its
  own bundled data artifact and must make no calls to PBDB/Wikipedia or any
  first-party API.
- **Rationale:** SPEC-002 REQ-001/006, SPEC-001 DATA-005.
- **Acceptance criteria:** `pnpm run build` emits a static bundle and a
  `data/` JSON artifact; the runtime read path uses only `fetch` of that local
  artifact; no upstream host is contacted in normal use.
- **Verification method:** build inspection + code inspection (single local fetch).
- **Evidence location:** `vite.config.ts`, `src/app/data/snapshot.ts`, build output.

### NFR-002: Design charter conformance via tokens

- **Statement:** All UI styling must go through the design charter's tokens
  expressed as CSS custom properties (single light theme, one teal accent,
  meaning-only status/ICS colours); no runtime CSS-in-JS engine may be added.
- **Rationale:** SPEC-002 REQ-005; charter §4.
- **Acceptance criteria:** A tokens stylesheet encodes the charter palette/type;
  components reference tokens, not hard-coded hexes for palette values; no
  CSS-in-JS runtime dependency is added.
- **Verification method:** code + dependency inspection.
- **Evidence location:** `src/app/styles/tokens.css`.

### NFR-003: Response-time budgets for the slice

- **Statement:** With the MVP snapshot loaded, an age (stage) change must update
  visible occurrences within **1 s** (PERF-030), and the first useful content must
  appear within the load budgets; a loading indicator must appear for updates that
  exceed 500 ms.
- **Rationale:** PERF-020/030/050/360; SPEC-002 NFR-001.
- **Acceptance criteria:** Stage change re-filters in-memory (O(n) over the loaded
  occurrences) with no network I/O, well within 1 s at MVP volume; a loading
  indicator exists for the initial data load.
- **Verification method:** code inspection (in-memory filter, no I/O on change) +
  scenario test asserting in-place update.
- **Evidence location:** `src/app/state/exploration.ts`, `test/ui/scenario-perf-360.test.tsx`.

## Security and privacy considerations

### SEC-001: No client secrets, telemetry, or map token

- **Statement:** The client must ship no secrets/API keys, no third-party
  telemetry/analytics, and no token-gated map SDK; the basemap must be a
  self-contained MapLibre style with no proprietary tiles.
- **Rationale:** SPEC-002 SEC-001; charter (no fake metrics).
- **Acceptance criteria:** No API key or secret appears in the bundle; no analytics
  network call occurs; the map style references no token-gated tile host.
- **Verification method:** code + dependency inspection.
- **Evidence location:** `src/app/components/OccurrenceMap.tsx`.

## Data model impact

None. This slice **consumes** the SPEC-001 `ReadModel` (`src/domain/snapshot.ts`)
via the existing `ReadApi` (`src/read/api.ts`) and adds no fields. The client data
artifact is the serialized L2+L3 read model (SPEC-002 REQ-006) written by the
existing snapshot build. No DATA requirement IDs are created.

## API impact

No runtime API. The only interface is the existing **static data-artifact
contract**: the app `fetch`es one prebuilt snapshot JSON (shape owned by SPEC-001).
No new interface IDs are created.

## UI or UX impact

This spec implements UI, but the **product** UX requirements remain the functional
specification's and the design charter's. The requirements above (REQ-001…008) are
implementation requirements for this slice traced to existing FONC/PERF/CONS IDs;
they create no new UX-XXX product requirements. The build must match the
[exploration-view mockup](../../mockups/exploration-view.md) and the
[charter](../../mockups/design-guidelines.md).

## Configuration impact

Adds (at implementation): React/Vite/MapLibre/testing dependencies and a committed
`pnpm-lock.yaml` update; `vite.config.ts`; an app `tsconfig` including DOM libs and
JSX; a Vitest config change to run `jsdom` component tests; a `prebuild`/`predev`
step that writes the snapshot artifact into the served `data/` directory; and CI
steps to type-check, test, and `vite build`. No runtime environment variables or
secrets.

## Error handling

- **Snapshot load failure** → error state with a **Retry** action; active filters
  preserved (FONC-1310/1330/1340).
- **Map/WebGL init failure** → the accessible occurrence list (REQ-003) remains the
  equivalent path; a minimal map-unavailable note is shown (charter §7).
- **Empty result after filtering** → empty state with reset (FONC-1280).
- **Missing field** (e.g. null paleoposition) → explicit "Not available" label,
  never a blank (FONC-490/1120, PERF-180).

## Edge cases

- **Occurrence with no paleocoordinate** (`occ:5` in the fixture) — listed, panel
  shows paleoposition "Not available"; omitted from map markers but still counted
  and selectable in the list.
- **Approximate time range** (spans >1 stage) — marked "approximate" in list and
  panel (FONC-1140).
- **Synonymous/invalid taxon** (`Nanotyrannus` is Synonymous) — profile flags the
  status with its citation (FONC-720).
- **OccurrenceOnly profile** (`Nanotyrannus`) — profile labeled minimal (FONC-1300).
- **Stage with no occurrences** (Santonian) — empty state (PERF-370).
- **Long taxon/formation names** — wrap/truncate with title, never clip (charter §6).

## Acceptance criteria

The spec is satisfied when: the app boots as a static SPA reading the snapshot with
no runtime egress (NFR-001, SEC-001); the exploration view shows the map, the
stage timeline, the dinosaurs-default group control, and the permanent
age/group/count context (REQ-001/002/005); occurrences render on the map and in an
equivalent keyboard-reachable, provenance-legible list (REQ-002/003); stepping the
timeline updates occurrences in place (REQ-004); an occurrence opens a panel and,
from it, a taxon profile, with a one-action return preserving age/filters
(REQ-006/007); the loading/empty/error/minimal states exist (REQ-008); styling is
token-driven per the charter (NFR-002); and **PERF-340, PERF-360, and PERF-370**
pass as automated tests.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Persistent age/group/count context | automated | `pnpm test` component test | `test/ui/exploration-context.test.tsx` | #6 |
| REQ-002 | Reconstruction-labeled MapLibre map, markers | manual + automated | mockup check + component test | `src/app/components/OccurrenceMap.tsx` | #6 |
| REQ-003 | Keyboard list, source + uncertainty per row | automated | `pnpm test` component test | `test/ui/occurrence-list.test.tsx` | #6 |
| REQ-004 | Stage step updates occurrences in place | automated | PERF-360 scenario test | `test/ui/scenario-perf-360.test.tsx` | #6 |
| REQ-005 | Dinosaurs default + reset + not-complete-atlas | automated | component test | `test/ui/exploration-context.test.tsx` | #6 |
| REQ-006 | Occurrence panel with provenance + primary action | automated | component test | `test/ui/occurrence-panel.test.tsx` | #6 |
| REQ-007 | Profile ≤2 actions; back ≤1; state preserved | automated | PERF-340 scenario test | `test/ui/scenario-perf-340.test.tsx` | #6 |
| REQ-008 | Loading/empty/error/minimal states | automated | PERF-370 + component tests | `test/ui/scenario-perf-370.test.tsx`, `test/ui/data-states.test.tsx` | #6 |
| NFR-001 | Static build, single local fetch | inspection | build + code inspection | `vite.config.ts`, `src/app/data/snapshot.ts` | #6 |
| NFR-002 | Token-driven styling, no CSS-in-JS | inspection | code + dependency check | `src/app/styles/tokens.css` | #6 |
| NFR-003 | ≤1 s in-memory re-filter; loading >500 ms | inspection + automated | code inspection + PERF-360 | `src/app/state/exploration.ts` | #6 |
| SEC-001 | No secret/telemetry/token map | inspection | code + dependency check | `src/app/components/OccurrenceMap.tsx` | #6 |

## Test plan

- **Component/integration tests (Vitest + Testing Library, jsdom):** the context
  bar (REQ-001/005), the occurrence list with provenance cues (REQ-003), the
  occurrence panel (REQ-006), and the data-state surfaces (REQ-008).
- **Scenario tests (the MVP validation scenarios), automated end-to-end over the
  rendered app through its accessible controls:** PERF-340
  (`scenario-perf-340.test.tsx`), PERF-360 (`scenario-perf-360.test.tsx`), PERF-370
  (`scenario-perf-370.test.tsx`). The map canvas is not required for these — the
  accessible occurrence path drives the loop (charter/SPEC-002 canvas-a11y edge
  case), so the scenarios run reliably without WebGL.
- **Build check:** `pnpm run build` produces a static bundle + the data artifact
  (NFR-001), run in CI.
- **Fixtures:** the committed SPEC-001 fixture snapshot (5 occurrences, 3 taxa),
  built by the existing pipeline into the served `data/` artifact.
- **Deferred:** a Playwright + axe browser suite as a required CI gate (SPEC-002
  REQ-008/010, NFR-002) — scaffolding is provided; wiring the browser jobs is a
  follow-up (assumption A-3).

## Rollback plan

The slice is additive: it adds an `src/app/` tree, UI configs/deps, and UI tests,
and touches no SPEC-001 code. Rolling back means reverting the PR (removing
`src/app`, the UI test files, and the dependency/config additions); the data layer,
pipeline, and snapshot contract are unaffected. If MapLibre proves unworkable, the
documented Leaflet fallback (SPEC-002 REQ-004 edge case) can replace only
`OccurrenceMap.tsx` via a SPEC-002 amendment, leaving the rest of the slice intact.

## Open questions

- [ ] Basemap paleocoastline geometry source (ties to SPEC-001's open
  plate-rotation-model question) — deferred; this slice uses a graticule world with
  plotted paleocoordinates (assumption A-1).
- [ ] State-management approach at scale (URL/deep-link state) — deferred; this
  slice uses React reducer + context (assumption A-2), resolving SPEC-002's
  state-management open question only for this slice's scope.
- [ ] Promotion of the Playwright + axe suite to a required CI gate (assumption A-3).

## Human decisions required

- [x] Authorize building the **first UI vertical slice (exploration view)** and its
  scope — requested by the owner (nelsonjeanrenaud@gmail.com) as the task that
  created this spec, and confirmed to the recommended scope above on **2026-07-11**.
- [x] Confirm the slice scope **excludes** the full filters panel, search, and the
  classification browser (later slices) — approved.
- [x] Accept the recorded assumptions **A-1** (graticule basemap, no paleocoastline
  geometry yet), **A-2** (reducer/context state, no URL state), and **A-3**
  (Playwright/axe CI gate deferred) — approved.

## Conflict check

Depends on and refines SPEC-001 (data) and SPEC-002 (stack). It consumes the
SPEC-001 read model unchanged and implements the SPEC-002 stack choices; it
introduces no product requirements (those stay in the functional specification) and
no design rules (those stay in the charter). It resolves, **for this slice only**,
two SPEC-002 open questions (state management → reducer/context; and it exercises
the partitioned-static-JSON delivery). No overlap or contradiction with an existing
spec; `depends_on: [SPEC-001, SPEC-002]` is recorded in frontmatter.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Exploration shell / context bar | `src/app/components/ContextBar.tsx`, `ExplorationView.tsx` | `test/ui/exploration-context.test.tsx` | Implemented |
| REQ-002 | Map (MapLibre) | `src/app/components/OccurrenceMap.tsx` | manual + `test/ui/occurrence-list.test.tsx` | Implemented |
| REQ-003 | Occurrence list | `src/app/components/OccurrenceList.tsx` | `test/ui/occurrence-list.test.tsx` | Implemented |
| REQ-004 | Timeline | `src/app/components/TimelineControl.tsx`, `src/app/state/exploration.ts` | `test/ui/scenario-perf-360.test.tsx` | Implemented |
| REQ-005 | Group control / context | `src/app/components/ContextBar.tsx` | `test/ui/exploration-context.test.tsx` | Implemented |
| REQ-006 | Occurrence panel | `src/app/components/OccurrencePanel.tsx` | `test/ui/occurrence-panel.test.tsx` | Implemented |
| REQ-007 | Taxon profile | `src/app/components/TaxonProfile.tsx` | `test/ui/scenario-perf-340.test.tsx` | Implemented |
| REQ-008 | Data states | `src/app/components/states/*`, `App.tsx` | `test/ui/scenario-perf-370.test.tsx`, `test/ui/data-states.test.tsx` | Implemented |
| NFR-001 | Data load | `src/app/data/snapshot.ts`, `vite.config.ts` | build inspection | Implemented |
| NFR-002 | Tokens | `src/app/styles/tokens.css` | inspection | Implemented |
| NFR-003 | State/filtering | `src/app/state/exploration.ts` | `test/ui/scenario-perf-360.test.tsx` | Implemented |
| SEC-001 | Map style | `src/app/components/OccurrenceMap.tsx` | inspection | Implemented |

## Implementation notes

Implemented on branch `claude/exploration-view-ui-slice-pf0cso`. The slice landed
as an additive `src/app/` tree (React + Vite + MapLibre, CSS-Modules tokens),
consuming the unchanged SPEC-001 `ReadApi`. Evidence:

- **Automated tests (16 files, 42 tests green):** the scenario tests
  `test/ui/scenario-perf-340.test.tsx`, `-360`, `-370` pass the MVP validation
  scenarios through the accessible occurrence path; component tests cover the
  context bar, list, panel and data states.
- **Real-browser E2E:** `test/e2e/exploration.e2e.ts` (Playwright) boots the built
  static app, asserts the MapLibre canvas renders (REQ-002), and runs the PERF-340
  loop; verified locally in the environment's Chromium (WebGL via SwiftShader).
- **Static build:** `pnpm run build` emits `dist/` + the `data/snapshot.json`
  artifact; the runtime reads only that local file (NFR-001). CI runs type-check,
  tests, and the build.

Assumptions A-1 (graticule basemap, no paleocoastline geometry), A-2
(reducer/context state, no URL state) and A-3 (Playwright/axe CI gate deferred)
are the scoped deviations from a fuller UI; each traces to a later slice. Status
is `Implemented`: the slice merged in PR #6 (assumption A-1 is superseded by
SPEC-004's real basemap; A-3's CI gates landed via AMEND-002).

## Spec amendments

> Required for any behavioral change after approval.

### AMEND-001: Ship the real PBDB dataset; bound the occurrence-list render

- **Date:** 2026-07-13
- **Reason:** The slice was verified against the 5-occurrence fixture; the build
  environment can in fact reach PBDB (see SPEC-004 AMEND-001), so the app now
  ships a **real** dinosaur dataset — a live PBDB pull of Dinosauria/Maastrichtian
  (**478 taxa, 4,187 occurrences, 1,632 sources**), committed as the served
  artifact. At that scale two things broke and are fixed here.
- **Changed requirements:**
  - **REQ-003 (occurrence list):** the acceptance "every visible occurrence
    appears as a focusable control" is **amended** — at real scale a stage can
    hold thousands of occurrences, so the list renders a **bounded window**
    (`LIST_RENDER_CAP = 200`) with an explicit "Showing N of M — narrow by age, or
    select a point/cluster on the map to reach the rest" affordance, and always
    includes the currently-selected occurrence. The **map** remains the complete
    view (all occurrences, clustered); the list is the keyboard path into it,
    narrowed by age/selection. Full list virtualization (render-all-reachable
    while windowed) is a recorded follow-up.
  - **REQ-002 (map):** cluster markers are now **sized/deepened by point count**
    so magnitude reads visually (radius + colour step, not colour alone), now that
    real density (PERF-090/100/120) is actually exercised.
- **Behavioral impact:** the app opens on ~4,187 Maastrichtian occurrences
  clustered across the reconstructed globe; the list shows the first 200 with the
  refine hint; first content ~1.2 s and first map paint ~1.6 s in-browser (within
  PERF-020/010). Data delivery is a single ~7 MB (≈457 KB gzipped) artifact;
  partitioning by stage/period (SPEC-002 REQ-006 scaling path) remains a follow-up.
- **Test impact:** `test/ui/occurrence-list.test.tsx` gains cap + selected-beyond-
  cap tests; `test/e2e/exploration.e2e.ts` is made data-agnostic (first list row)
  and runs serially. Unit tests still build from the fixture client, so they stay
  deterministic regardless of the shipped artifact.
- **Human approval reference:** Made under owner direction ("do the next planned
  step") after the owner corrected the "environment is limited" assumption; owner
  ratified 2026-07-21 ("I approve them, it's all good").

### AMEND-002: CI gates, served-artifact size, and accessibility contrast

- **Date:** 2026-07-13
- **Reason:** Wrap-up pass — realize the SPEC-002 CI/tooling gates that were "to be
  filled at implementation", bound the served data size, and fix the WCAG contrast
  failures the new axe gate surfaced.
- **Changed requirements / behaviour:**
  - **CI gates (SPEC-002 REQ-008/009/010, NFR-001/002):** CI now runs ESLint +
    `eslint-plugin-jsx-a11y`, Prettier `--check`, the Playwright E2E suite, an
    **axe** accessibility gate (`test/e2e/a11y.e2e.ts`, fails on serious/critical
    WCAG 2 A/AA violations on the exploration view + taxon profile), and a
    **size-budget** gate (`scripts/check_budget.ts`). ESLint/Prettier scope is the
    UI code, tests, and scripts introduced here; extending Prettier to the
    pre-existing data-layer files is a deliberate follow-up (no unrelated churn).
  - **Served-artifact size (NFR-001):** the web snapshot is now written **minified**
    (`serializeSnapshotCompact`, keys still sorted → deterministic), cutting the
    committed file ~37% (6.97 MB → 4.52 MB; ~416 KB gzipped over the wire). The
    budget gate ceilings it (raw ≤ 5 MB, gzip ≤ 550 KB, JS ≤ 320 KB gzip). Deeper
    per-stage partitioning stays deferred: occurrences are ~71% of the payload and
    the map needs them, so partitioning a single-window pull buys little; it becomes
    the lever when the dataset spans multiple windows (V1).
  - **Accessibility contrast:** the axe gate found WCAG-AA contrast failures in the
    charter's muted greys, the accent-deep teal used as small text/button fills,
    and the amber/error status hues. Tokens were **darkened** to meet 4.5:1
    (`--color-text-muted/faint/id`, `--color-accent-deep`, `--color-attention`,
    `--color-error`), white-on-teal button fills routed to the deeper teal, the
    selected-stage span de-opacified, and the taxon profile placed on a white
    surface. Accessibility (PERF-220…270) overrides the charter's exact hexes; a
    charter note is warranted (flag for `/drift-check`).
- **Test impact:** adds `test/e2e/a11y.e2e.ts`; group-header cap test
  (`test/ui/occurrence-list.test.tsx`, SPEC-005 REQ-004); no behavioural test
  changes to the loop.
- **Human approval reference:** Owner-directed ("wrap up all loose ends, ci gates
  and 7mb snapshot in this PR then open it"); owner ratified 2026-07-21.

### AMEND-003: Provenance cue simplification & profile reorder (via SPEC-007)

- **Date:** 2026-07-21
- **Reason:** Owner-approved provenance simplification (SPEC-007).
- **Changed requirements / behaviour:**
  - **REQ-002/003 (cues):** the per-occurrence **"Reconstructed"** cue is removed
    from the list, panel, and profile; the standing map-level "Paleogeographic
    reconstruction" banner (REQ-002) remains as the single reconstruction
    disclosure. The **"Approximate"** time cue is reworded to the factual **"Spans
    multiple stages"** (same `spansMultipleStages` derivation). The
    **"Interpretative"** cue/block framing is removed.
  - **REQ-003 (list) is KEPT, not deleted.** Although the owner initially chose to
    delete REQ-003 wholesale, implementation established that the occurrence list is
    the only keyboard-accessible and only headless-testable path to an occurrence
    (the map canvas needs WebGL); deleting it would force deleting the core-loop
    scenario tests (PERF-340/360/370), which `CLAUDE.md` forbids. Per that blocking
    conflict the list is retained with its cues stripped — delivering the intended
    decluttering without losing the accessible path or core-loop verification. See
    SPEC-007 REQ-001 resolution.
  - **REQ-007 (profile):** the summary/biology block is moved **above** the
    occurrence list so it is visible without scrolling past every occurrence
    (previously ~19.6k px down for a 164-occurrence taxon).
- **Test impact:** `occurrence-list`, `occurrence-panel`, and `data-003` tests
  updated to the new cues/flags (no tests skipped or deleted); scenario tests
  unchanged and still green.
- **Human approval reference:** Owner "implement spec 007 i approve it" (2026-07-21);
  the REQ-003-retention resolution recorded in SPEC-007 after surfacing the
  test/accessibility blocker.
- **Superseded by AMEND-004** (REQ-003 subsequently deleted).

### AMEND-004: REQ-003 deleted — occurrence list removed (via SPEC-007 AMEND-002)

- **Date:** 2026-07-21
- **Reason:** AMEND-003 retained the list to avoid deleting the core-loop tests;
  the owner then authorized removing those tests ("I allow you to remove that test.
  it's cleaner"), so **REQ-003 is deleted in full** and the occurrence-list
  component removed.
- **Changed behaviour:** `OccurrenceList.tsx` and the SPEC-005 aggregation
  (`state/aggregate.ts`) are deleted; `ExplorationView` selects occurrences from the
  map only (panel on select, empty state when the filter is empty, otherwise a
  "Select a point on the map" prompt). SPEC-005 → Superseded.
- **Test impact:** `occurrence-list`, `aggregate`, and `scenario-perf-340` tests
  removed; e2e PERF-340/SPEC-005 and the a11y profile-nav test removed;
  `occurrence-panel` rewired to a direct render; `scenario-perf-370` made
  list-independent. `scenario-perf-360` unchanged. No test skipped.
- **Accessibility regression (recorded):** REQ-003 was the app's only keyboard/
  screen-reader path to occurrences; with it gone, selection is map-canvas-only —
  a known deviation from PERF-220…270 / charter §2, accepted by the owner. A future
  accessible occurrence selector is recorded as follow-up in SPEC-007 AMEND-002.
- **Human approval reference:** Owner "I allow you to remove that test. it's
  cleaner" (2026-07-21).

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [x] Open questions resolved or explicitly deferred (deferred; listed).
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed (`depends_on: SPEC-001, SPEC-002`).
- [x] Human approval recorded before status set to Approved (owner, 2026-07-11).
