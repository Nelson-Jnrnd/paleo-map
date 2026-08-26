---
doc_type: spec
spec_id: SPEC-027
title: Search & selection legibility under clustering
status: In Implementation
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, exploration-view, map-rendering, taxon-search]
affected_interfaces: []
supersedes: []
superseded_by:
depends_on: [SPEC-009, SPEC-010, SPEC-013, SPEC-015, SPEC-021, SPEC-023, SPEC-026]
conflicts_with: []
approved_by: nelsonjeanrenaud@gmail.com
approved_at: 2026-08-04
last_verified_at: 2026-08-26
---

# SPEC-027: Search & selection legibility under clustering

## Summary

Choosing a taxon — by searching for it, clicking it in the list, or picking one of
its points — is supposed to emphasise that taxon's occurrences on the map and dim
the rest (SPEC-010 REQ-004). In practice almost nothing happens, because the
emphasis is painted only on **unclustered** map points and, at the zoom the app
lands at, nearly every point is inside a cluster disc. Three further defects
compound it: the focused taxon is resolved against the *viewport* rather than the
stage, so a search for a taxon that lives off-screen selects nothing; search never
moves the camera, so even a correct selection can be off-screen; and a search for
one of the 268 non-major-group clades in the snapshot lands on a group key the
grouping can never produce. This spec makes a selection visible wherever it is,
frames a search result, and guarantees that a search always lands somewhere real.

## Context

> **Re-verified 2026-08-26 against `main` at `4b9ba3f`.** This spec was drafted
> against `d73eca6`; nine specs landed in between (SPEC-018…SPEC-026), several on
> the exact surfaces it touches. What that re-check found is recorded in
> **Staleness re-verification** below: the five defects REQ-001…REQ-004 and
> REQ-008 describe are all still present in the shipped code, verbatim; REQ-007
> is retired because SPEC-021 deleted the surface it extended; REQ-006 is reduced
> to the part SPEC-021 did not already do; and the A-2 residual risk is dissolved
> by SPEC-026. The spec id also moved from SPEC-017 to **SPEC-027**: SPEC-017 was
> claimed by the taxonomy-infographics work (PR #21) while this branch was open.

Verified against the working tree on 2026-08-03 (branch
`claude/search-selection-clusters-09p7z9`, base `d73eca6`).

**How the pieces are wired today.** `TaxonSearch` → `onSearchSelect`
(`src/app/components/ExplorationView.tsx:194`) → `selectSearchTaxon`
(`src/app/state/exploration.ts:137`) sets `mode: "taxon"`, a rank tier, a stage,
and `selectedTaxonKey`. `ExplorationView` derives `focusIds`
(`ExplorationView.tsx:260`) from `selectedTaxonGroup` ← `taxonGroups` ← `inView`,
and passes it to `OccurrenceMap`, which turns it into a paint expression via
`pointOpacity` (`src/app/components/OccurrenceMap.tsx:271`).

**Clustering.** The `occurrences` source is created with `cluster: true`,
`clusterRadius: 28`, `clusterMaxZoom: 14` (`OccurrenceMap.tsx:533-545`). The map
opens at `center: [-75, 55], zoom: 2.2` (`OccurrenceMap.tsx:492-493`).

**Measured scale.** `public/data/stage-maastrichtian.json` holds 5,064
occurrences and `public/data/stage-campanian.json` 9,240. At zoom 2.2 with a 28 px
cluster radius the overwhelming majority of those are inside cluster discs.

**Where the emphasis is applied.** `pointOpacity(focusIds)` reaches `points-bg`
and `points-icon` only (`OccurrenceMap.tsx:621`, `:646`, and the sync effect at
`:846-866`). The `clusters` layer (`:549`) and `clusters-icon` (`:571`) carry a
fixed paint with no focus, selection or highlight input, and the DOM count badge
(`:938`) renders raw `point_count`. The same is true of the SPEC-009 selection
ring and hover highlight, which are carried by `pointStrokeWidth` /
`pointStrokeColor` (`:109-135`) on `points-bg` alone.

**Camera.** There is no `fitBounds` or `flyTo` anywhere under `src/`; the only
camera movement is the cluster zoom-in at `OccurrenceMap.tsx:702`.

**Tier reachability.** `tierForRank` (`src/app/state/search.ts:80`) maps any
`Clade` to the `majorGroup` tier, but `groupByTaxon` at that tier only ever keys on
the 17 names in `MAJOR_GROUP_NAMES` (`src/app/state/grouping.ts:48`). The shipped
`public/data/reference.json` contains 2,555 taxa — 2,123 Genus, 147 Family, 285
Clade — and **268 of the 285 clades are not in `MAJOR_GROUP_NAMES`** (e.g.
*Aeolosaurini*, *Lognkosauria*, *Elasmaria*). There are no Species-rank taxa in
the snapshot, so the species case does not arise today.

**Why the tests pass.** `test/ui/spec013-search-ui.test.tsx` and
`test/ui/taxon-mode.test.tsx` run in jsdom, where WebGL is unavailable, the map
never reports bounds, and `viewport` stays `null` — so `occurrencesInView` returns
the full set (`src/app/state/viewport.ts:45`) and the viewport-coupling defect is
invisible. Nothing asserts the cluster layer's paint.

**Prior art in the same file.** Localities already distinguish the map's data
from the list's: `mapLocalities` folds the whole stage while `listLocalities`
folds `inView` (`ExplorationView.tsx:223-230`). Taxa never received the same
split.

## Problem statement

The Explorer searches for *Saltasaurus*, or clicks *Tyrannosaurus* in the taxon
list, and the map looks the same as it did before. The selection exists in state —
the side panel may even open — but the map, which is the whole point of a
distribution view, does not answer "where did this taxon live?". For some
searches the selection matches no group at all and even the side panel stays
empty, with no message explaining why.

## Goals

- A selection is visible on the map at whatever zoom the Explorer is at, including
  when its points are inside clusters.
- A search result is brought into view rather than silently selected off-screen.
- A search always lands on a group that exists, or says why it cannot.
- Cluster interaction means the same thing in every grouping mode.

## Non-goals

- No change to the clustering algorithm's parameters (`clusterRadius`,
  `clusterMaxZoom`) or to when points decluster. SPEC-015 AMEND-002 tuned those
  deliberately.
- No per-taxon colour hue. Emphasis stays shape/opacity/ring-based
  (SPEC-010 REQ-004, charter §3).
- No exact per-cluster "N of M are the focused taxon" counts in this iteration —
  see OQ-001 and Non-goal rationale in REQ-001.
- No change to the search ranking function (`searchTaxa`) or its index.
- No deep-linking or URL state for the selection.
- No change to the ingestion pipeline or any shipped data artifact.

## Users or actors

The Explorer searching, selecting from the list, and clicking the map; the
in-memory read model; MapLibre's clustered GeoJSON source.

## Functional requirements

### REQ-001: A selection is legible regardless of clustering

- **Statement:** When a taxon focus, an occurrence selection, or a hover highlight
  is active, the affected occurrences must be rendered as **individually visible,
  emphasised markers at any zoom**, including when the same occurrences are also
  members of a cluster; and the non-affected map content — clustered **and**
  unclustered — must be visibly de-emphasised. The intended mechanism is a
  second, **unclustered** GeoJSON source containing only the focused / selected /
  highlighted occurrences, drawn above the cluster layers, combined with a
  wholesale dim applied to `clusters`, `clusters-icon`, `points-bg` and
  `points-icon` while a focus is active.
- **Rationale:** SPEC-010 REQ-004 and SPEC-015 REQ-004 already require
  emphasis/dim; they are unmet in practice because the paint reaches only the
  unclustered layers while 5k–9k points per stage sit inside clusters at the
  landing zoom. An exempt overlay is cheap (one taxon's points, not the whole
  stage), needs no re-clustering, and answers the distribution question directly.
- **Acceptance criteria:** With a taxon focused, every one of its placeable
  occurrences in the current stage is present as a feature in the overlay source
  (assertable from the source's data), and the cluster layers' opacity paint is
  the de-emphasised value; with no focus, the overlay source is empty and the
  cluster layers are at full opacity. The count of features in the clustered
  source is unchanged by focusing (SPEC-010 REQ-004: points are never removed).
- **Verification method:** automated component test asserting the overlay source
  data and the cluster-layer paint properties, plus a manual visual check at zoom
  2.2 and zoom 6.
- **Evidence location:** `test/ui/spec027-map-emphasis.test.tsx`,
  `src/app/components/OccurrenceMap.tsx` (`emphasisFeatures`, `baseOpacity`,
  the `emphasis` source and `emphasis-bg`/`emphasis-icon` layers).

### REQ-002: Focus and the selected group are resolved against the stage, not the viewport

- **Statement:** The **selected** taxon group — the one that drives `focusIds`,
  the `TaxonPanel`, and the timeline's highlighted span — must be resolved from
  **all** occurrences at the selected stage, not from the viewport-filtered set.
  The taxon **list** must continue to show one row per taxon whose points are in
  the viewport (SPEC-010 REQ-004, unchanged).
- **Rationale:** A taxon selected by search or carried across a pan must not
  evaporate because the camera is elsewhere; the list is a "what's on screen"
  device, the selection is not. This mirrors the split the file already makes for
  localities (`mapLocalities` vs `listLocalities`).
- **Acceptance criteria:** With a viewport that excludes a taxon's occurrences
  entirely, selecting that taxon still yields a non-empty `focusIds`, a rendered
  `TaxonPanel`, and a highlighted timeline span; the taxon list still shows only
  in-viewport taxa and its heading count is unchanged.
- **Verification method:** automated component test driving a viewport that
  excludes the taxon.
- **Evidence location:** `test/ui/spec027-selection.test.tsx`,
  `src/app/components/ExplorationView.tsx` (`stageTaxonGroups`).

### REQ-003: A search result is brought into view

- **Statement:** Landing a search result (SPEC-013 REQ-004) must move the map
  camera to frame the selected taxon's occurrences at the resolved stage, with
  padding, when those occurrences are not already substantially in view. The move
  must be triggered **only** by a search landing — never by a list selection, a
  map click, or a subsequent re-render of the same selection — so it can never
  fight a manual pan.
- **Rationale:** SPEC-013 REQ-004 promises the taxon "lands in context with its
  distribution emphasised"; without a camera move that promise depends on where
  the Explorer happened to leave the map.
- **Acceptance criteria:** Selecting a search result for a taxon outside the
  current viewport issues exactly one camera fit covering that taxon's
  occurrences; selecting the same taxon again from the list issues none; panning
  away afterwards is not undone.
- **Verification method:** automated component test with a stubbed map camera
  (counting fit calls) + manual check.
- **Evidence location:** `test/ui/spec027-map-emphasis.test.tsx`,
  `test/ui/viewport.test.ts`, `src/app/state/viewport.ts`
  (`boundsOfPoints`, `fractionInView`).

### REQ-004: A search always lands on a reachable group

- **Statement:** The tier and group key produced when a search result is chosen
  must be one that the active grouping can actually produce. A taxon that cannot
  itself be a group key at any tier (notably a `Clade` outside
  `MAJOR_GROUP_NAMES`) must resolve **up its real ancestry** to the nearest
  tier-eligible ancestor, and that substitution must be **disclosed** in the side
  panel ("Showing *Titanosauria*, the nearest major group containing
  *Aeolosaurini*"). If no eligible ancestor exists, or the resolved group has no
  occurrences at the landed stage, the side panel must show a designed
  explanatory state rather than nothing.
- **Rationale:** `tierForRank` maps every clade to `majorGroup`, but 268 of the
  snapshot's 285 clades can never key a major-group bucket, so those searches
  currently change mode, rank and stage and then select nothing, silently.
- **Acceptance criteria:** Searching a non-major-group clade selects its nearest
  eligible ancestor with the substitution disclosed; searching a genus or family
  is unchanged; a search that can resolve to no group shows the explanatory state
  and never a blank panel.
- **Verification method:** automated unit test on the pure resolution function +
  component test for the disclosure and the empty state.
- **Evidence location:** `test/ui/spec027-search-landing.test.ts`,
  `test/ui/spec027-selection.test.tsx`, `src/app/state/search.ts`
  (`landingForTaxon`), `src/app/state/grouping.ts` (`tierOfTaxon`).

### REQ-005: Cluster interaction respects the grouping mode

- **Statement:** In **Taxon** mode, the primary action on a species row of the
  aggregate cluster card must be to **select that taxon** (resolved to the active
  tier), consistent with SPEC-013 REQ-004's decision that selection — not the
  profile — is the landing target; opening the profile remains available as a
  secondary action. In **Locality** mode the cluster card's species path must not
  run at all; a cluster click zooms. In every mode, a cluster click must produce
  an observable result (a zoom, a card, or a selection) — never silence.
- **Rationale:** The single click handler currently routes cluster clicks
  identically in all three modes, and its only taxon action jumps to the profile,
  bypassing the selection the mode is built around.
- **Acceptance criteria:** In taxon mode, activating a species row dispatches a
  taxon selection and the panel/focus follow; in locality mode, a cluster click
  zooms and sets no card state; no cluster click leaves the map unchanged.
- **Verification method:** automated component test per mode.
- **Evidence location:** `test/ui/spec027-map-emphasis.test.tsx`,
  `src/app/components/MapSpeciesCard.tsx`.

### REQ-006: Locality-mode cluster rendering and state are correct

- **Statement:** In Locality mode, cluster discs must not carry a clade
  silhouette, and no cluster interaction may leave residual card state that
  suppresses hover.
- **Narrowed 2026-08-26:** the original statement also required the **count
  badge** to render in Locality mode. SPEC-021 REQ-002 shipped exactly that while
  this branch was open, so that half is struck — it is done, and claiming it here
  would double-count someone else's work. The silhouette and the residual-card
  defect were not addressed upstream and remain in scope.
- **Rationale:** The map overlay — cluster counts included — is gated behind
  `showCladeUi` (`OccurrenceMap.tsx:933`), so locality clusters render a dinosaur
  icon with no count while `ExplorationView.tsx:371` tells the Explorer the
  cluster counts localities. Separately, a locality cluster click runs the
  `getClusterLeaves` species path; the leaves carry no `taxonId`, so the resulting
  aggregate is empty, `small` is vacuously true, and an invisible card is set that
  permanently suppresses hover (`:773`) because the clearing effect (`:888`) does
  not re-run.
- **Acceptance criteria:** Locality clusters show a numeric count and the generic
  (non-clade) cluster mark; after a locality cluster click, hover cross-highlight
  still works.
- **Verification method:** automated component test + manual visual check.
- **Evidence location:** `test/ui/spec027-map-emphasis.test.tsx`,
  `src/app/components/OccurrenceMap.tsx` (cluster badges outside the
  `showCladeUi` gate; the mode-change card reset).

### REQ-007: Cluster semantics are disclosed in every mode — **RETIRED**

- **Status:** Retired 2026-08-26, unimplemented, superseded by **SPEC-021
  REQ-001/REQ-002** (Implemented, PR #25).
- **Original statement:** the map pane's cluster-semantics note must be present
  in Taxon mode too, and must state what the count means while a focus is active.
- **Why it is retired:** SPEC-021 deleted that DOM note outright — it was one of
  the five interface lines the owner asked to retire — and moved the meaning onto
  the cluster itself as an accessible name (`clusterCountLabel`), which is what
  SPEC-010 REQ-002 originally asked for. Requiring the note to exist would now
  contradict shipped, owner-approved work. SPEC-021 also already ungated the
  count badges so they render in Locality mode, which was REQ-006's first half.
- **Residual gap, deliberately not closed here:** the accessible name still says
  "N occurrence records" while a focus is active, without noting that the count
  includes de-emphasised records. That is a change to SPEC-021's carrier, not to
  this spec's, so it belongs to whoever owns that string — recorded, not folded
  in (no-opportunistic-refactor rule).

### REQ-008: Labels prefer the focused taxon

- **Statement:** While a focus is active, the map's name labels
  (`computeMapLabels`, capped at `MAX_LABELS`) must prefer focused markers over
  de-emphasised ones when choosing which labels survive collision culling.
- **Rationale:** Labels are currently built from all rendered unclustered markers
  (`OccurrenceMap.tsx:391`) with no focus preference, so the ten surviving labels
  can all sit on dimmed taxa while the focused one goes unnamed.
- **Acceptance criteria:** With a focus active and more candidates than the cap,
  focused candidates occupy the labels ahead of unfocused ones.
- **Verification method:** automated unit test on the pure label-selection
  function.
- **Evidence location:** `test/ui/map-labels.test.ts`,
  `src/app/components/mapLabels.ts`.

## Non-functional requirements

### NFR-001: Within the interaction budget, in-memory, deterministic

- **Statement:** Selecting a taxon, landing a search result, and stepping the
  stage must all complete within PERF-030 (≤ 1 s to updated visible occurrences)
  on the largest shipped stage (Campanian, 9,240 occurrences), computed entirely
  in memory with no I/O and no re-clustering of the base source on selection.
- **Rationale:** Static-client budget (SPEC-002 NFR-001, PERF-030); the overlay
  approach in REQ-001 is chosen partly because it avoids re-running supercluster
  on every selection.
- **Acceptance criteria:** No `setData` on the clustered `occurrences` source is
  issued in response to a selection/focus change alone; the existing
  `scenario-perf-360` / `scenario-perf-370` scenarios stay green.
- **Verification method:** automated test asserting the source is not re-fed on
  focus change + existing perf scenarios.
- **Evidence location:** `test/ui/spec027-map-emphasis.test.tsx`
  ("NFR-001: changing the focus never re-feeds the clustered source").

### NFR-002: Accessible, not colour-only

- **Statement:** Emphasis and de-emphasis must be conveyed by more than hue —
  opacity, ring weight and the DOM disclosure together — and every new state must
  be reachable and announced without the canvas (the WebGL-absent path keeps the
  lists as the equivalent route).
- **Rationale:** Charter (PERF-250, no colour-alone encoding) and SPEC-002's
  canvas-a11y edge case.
- **Acceptance criteria:** The disclosure text and panel states are present in the
  jsdom (no-WebGL) tests; no new information is carried by hue alone.
- **Verification method:** component test + inspection against
  `docs/mockups/design-guidelines.md`.
- **Evidence location:** `test/ui/spec027-selection.test.tsx`,
  `src/app/components/exploration.module.css` (`.notice`, `.clusterCountDim`).

## Security and privacy considerations

### SEC-001: No new runtime egress

- **Statement:** Every change is client-side rendering and in-memory derivation;
  no new network request is introduced.
- **Rationale:** DATA-005 / SEC-001 across the project — the app is offline and
  self-contained.
- **Acceptance criteria:** `test/data-005-no-runtime-egress.test.ts` stays green.
- **Verification method:** automated test.
- **Evidence location:** `test/data-005-no-runtime-egress.test.ts`.

## Data model impact

None. No change to any serialized artifact, to `ReadOccurrence`/`ReadTaxon`, or to
the pipeline. The overlay source in REQ-001 is a runtime-derived GeoJSON view over
occurrences already loaded.

## API impact

### API-001: Pure, testable helpers

- **Statement:** The tier/key resolution of REQ-004 and the label preference of
  REQ-008 must be added as **pure functions** in the app state layer
  (`src/app/state/`), free of React and MapLibre, and unit-tested directly.
- **Rationale:** Matches how `searchTaxa`, `groupByTaxon`, `resolveTierTaxon` and
  `computeMapLabels` are already factored, and keeps the map-dependent parts thin.
- **Acceptance criteria:** The new helpers are importable and tested without
  rendering a component; no I/O.
- **Verification method:** unit test.
- **Evidence location:** `test/ui/spec027-search-landing.test.ts`,
  `test/ui/viewport.test.ts`, `test/ui/map-labels.test.ts`.

## UI or UX impact

### UX-001: Focus reads at a glance, and every state is designed

- **Statement:** A focused taxon's markers stand clear above a visibly receded
  base map of clusters and other points; the search landing animates to the taxon
  rather than teleporting; the substitution disclosure (REQ-004), the
  no-group-found state (REQ-004), and the cluster-semantics note (REQ-007) are
  written in domain language and honour the light cartographic system with the
  single teal accent (`docs/mockups/design-guidelines.md`).
- **Acceptance criteria:** As per REQ-001, REQ-003, REQ-004, REQ-007; manual
  review against the design guidelines.
- **Verification method:** manual review + component tests for the text states.
- **Evidence location:** _pending_.

## Configuration impact

New constants only, all in the app layer: the de-emphasis opacity for the cluster
layers, and the camera fit padding / duration for REQ-003. No environment
variables, no feature flags.

## Error handling

- A search landing whose resolved group has no occurrences at the landed stage
  shows the designed explanatory state (REQ-004), not a blank panel.
- A camera fit over occurrences with no placeable paleocoordinate is skipped
  rather than attempted with empty bounds.
- If the overlay source cannot be added (map not yet loaded), the selection still
  updates state and the panel still renders; the overlay is applied on load.

## Edge cases

- **Focus with a single occurrence:** the fit in REQ-003 must not zoom to maximum
  on a degenerate (zero-area) bounds — clamp to a sensible zoom.
- **Focus spanning the antimeridian:** the fit must use the shorter arc, matching
  the wrap handling already in `withinBounds` (`src/app/state/viewport.ts:25`).
- **Focused occurrences with no paleocoordinate:** excluded from both the overlay
  and the fit, consistent with SPEC-009's "not placeable → not listed" decision.
- **Stage change while focused:** the existing reducer clears the selection on
  `selectStage`; the overlay must empty with it and the cluster dim must lift.
- **No WebGL:** no overlay, no fit; the lists remain the equivalent route and the
  panel/disclosure states still render.
- **The not-classified bucket** is a valid focus target and must dim/emphasise
  like any other group.
- **Rank change while focused:** `setRank` already drops the taxon selection; the
  overlay must follow.

## Staleness re-verification (2026-08-26)

This spec sat open across nine merged specs. Every claim it makes was re-checked
against `main` at `4b9ba3f` before the work continued; this section records the
result, because a spec that is quietly wrong about the code is worse than no spec.

### Still present, verbatim — the defects are real

| Requirement | Evidence on `main` @ `4b9ba3f` |
| --- | --- |
| REQ-001 | `pointOpacity(focusIds)` reaches `points-bg` / `points-icon` only; the `clusters` layer carries no focus input and no `emphasis` source exists. SPEC-018 restyled the map without touching this. |
| REQ-002 | `focusIds` ← `selectedTaxonGroup` ← `taxonGroups` ← `inView`. Still viewport-coupled. |
| REQ-003 | Zero occurrences of `fitBounds` or `flyTo` under `src/`. |
| REQ-004 | `onSearchSelect` still calls `tierForRank`, which still maps every `Clade` to `majorGroup`. |
| REQ-008 | Zero occurrences of `focused` in `mapLabels.ts`. |
| NFR-003 | The `localities = []` / `taxaById = new Map()` defaults and the three unguarded overlay `setState` calls are all unchanged. |

### Changed by upstream work

- **REQ-007 retired.** SPEC-021 deleted the cluster-semantics note and moved the
  meaning to an accessible name on the badge. See the requirement for detail.
- **REQ-006 narrowed.** SPEC-021 REQ-002 already ungated the count badges in
  Locality mode. Only the clade silhouette and the residual-card defect remain.
- **REQ-002 re-based.** SPEC-026 introduced `unitOccurrences` — the set filtered
  by SPEC-026 REQ-004 — as the single source the list, the count and the map all
  derive from. The stage-resolved selection folds *that* set, not the raw stage
  set, so all four cannot disagree about which records exist.
- **REQ-004 re-based.** The disclosure and the two explanatory states now live in
  the SPEC-026 sidebar, where a detail *replaces* the list. Both notices sit
  above the detail-or-list block, since in each case there is no detail to
  carry them.
- **REQ-005 unaffected.** `MapSpeciesCard` and the cluster-click handler are
  unchanged upstream.

### Dissolved

- **The A-2 residual risk is gone.** It was the not-classified bucket reaching
  5,336 occurrences with the Wikipedia gate off. SPEC-026 REQ-004 filters records
  that reach no taxon at the chosen tier out of the taxon units altogether, and
  `NOT_CLASSIFIED_KEY` no longer exists in `grouping.ts`. The largest overlay is
  now the largest *named* group — 1,100 in the default view, 1,764 with the gate
  off — which is inside the original assumption. The manual check the measurement
  called for is struck from the test plan with it.

### Identity

`SPEC-017` was taken by the taxonomy-infographics spec (merged, PR #21) while
this branch was open. This spec is renumbered **SPEC-027**; its requirement ids,
`AMEND-001` and `NFR-003` are unchanged, and every code and test reference was
renamed with it. The two specs are unrelated and do not conflict.

## Acceptance criteria

This spec is satisfied when: a taxon selected by any route is visibly emphasised
on the map at the landing zoom with the rest of the map receded (REQ-001); the
selection is resolved from the stage while the list stays viewport-linked
(REQ-002); a search landing frames its taxon exactly once and never fights a
manual pan (REQ-003); every search lands on a real group or explains why it
cannot (REQ-004); cluster clicks mean the same thing in every mode and always do
something (REQ-005, REQ-006); cluster semantics are disclosed in all three modes
(REQ-007); labels favour the focus (REQ-008); all of it stays in-memory, within
PERF-030, with no new egress and no colour-only encoding (NFR-001, NFR-002,
SEC-001); and the existing SPEC-009 / SPEC-010 / SPEC-013 / SPEC-015 tests stay
green.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Focus overlay populated; cluster layers dimmed; clustered feature count unchanged | automated + manual | `pnpm test` — 4 cases in `spec027-map-emphasis` | `test/ui/spec027-map-emphasis.test.tsx` | — |
| REQ-002 | Off-viewport taxon still focuses and panels; list stays viewport-linked | automated | `pnpm test` — 2 cases in `spec027-selection` | `test/ui/spec027-selection.test.tsx` | — |
| REQ-003 | Exactly one camera fit on search landing; none on list select | automated | `pnpm test` — 3 fit cases + 6 bounds unit cases | `test/ui/spec027-map-emphasis.test.tsx`, `test/ui/viewport.test.ts` | — |
| REQ-004 | Non-major-group clade resolves to disclosed ancestor; no-group state designed | automated | `pnpm test` — 8 unit + 2 component cases | `test/ui/spec027-search-landing.test.ts`, `test/ui/spec027-selection.test.tsx` | — |
| REQ-005 | Taxon-mode cluster card selects; locality cluster zooms; no silent click | automated | `pnpm test` — 2 cases in `spec027-map-emphasis` | `test/ui/spec027-map-emphasis.test.tsx` | — |
| REQ-006 | Locality clusters carry no clade icon; hover survives a cluster click (counts done by SPEC-021) | automated + manual | `pnpm test` + visual check | `test/ui/spec027-map-emphasis.test.tsx` | — |
| REQ-007 | _Retired 2026-08-26 — superseded by SPEC-021 REQ-001/002_ | — | — | — | — |
| REQ-008 | Focused candidates take labels ahead of unfocused | automated | `pnpm test` — 3 cases in `map-labels` | `test/ui/map-labels.test.ts` | — |
| NFR-001 | No base-source `setData` on focus change; perf scenarios green | automated | `pnpm test` — NFR-001 case + `scenario-perf-360/370` | `test/ui/spec027-map-emphasis.test.tsx` | — |
| NFR-002 | States present without WebGL; no hue-only encoding | automated + inspection | `pnpm test` (jsdom) + guideline review | `test/ui/spec027-selection.test.tsx` | — |
| NFR-003 | Map settles with default/unstable props; no-op recompute does not re-render | automated | `pnpm test` — 2 integration + 2 unit cases | `test/ui/spec027-map-emphasis.test.tsx` | — |
| SEC-001 | No new egress | automated | `pnpm test` | `test/data-005-no-runtime-egress.test.ts` | — |
| API-001 | New helpers pure and unit-tested | automated | `pnpm test` — no React/MapLibre imports in the unit suites | `test/ui/spec027-search-landing.test.ts`, `test/ui/viewport.test.ts` | — |

## Test plan

- **Unit** — tier/key resolution (REQ-004): genus, family, major-group clade,
  non-major-group clade with an eligible ancestor, clade with none; label
  preference under focus (REQ-008); fit-bounds derivation including the
  single-point and antimeridian cases (edge cases).
- **Component (jsdom)** — off-viewport focus (REQ-002); search-landing fit count
  with a stubbed camera (REQ-003); substitution disclosure and no-group state
  (REQ-004); cluster-card behaviour per mode (REQ-005); locality cluster counts
  and hover survival (REQ-006); cluster note in all modes (REQ-007).
- **Map-layer assertions** — the overlay source's feature ids and the cluster
  layers' opacity paint (REQ-001), and the absence of a base-source re-feed on
  focus change (NFR-001), driven through the existing test map harness.
- **Regression** — the full existing suite, in particular
  `test/ui/taxon-mode.test.tsx`, `test/ui/locality-mode.test.tsx`,
  `test/ui/grouping-mode.test.tsx`, `test/ui/occurrence-list.test.tsx`,
  `test/ui/spec013-search-ui.test.tsx`, `test/ui/map-labels.test.ts`, and the
  `scenario-perf-360/370` scenarios.
- **Manual** — Campanian (9,240 occurrences) at zoom 2.2 and zoom 6: search a
  taxon on another continent, confirm the fit and the emphasis; verify locality
  cluster counts; verify hover after a locality cluster click.
- No new fixtures or data artifacts required.

## Rollback plan

Every change is confined to the app layer (`src/app/components/OccurrenceMap.tsx`,
`ExplorationView.tsx`, `src/app/state/`), with no data, pipeline or artifact
change, so a straight revert of the implementation commit restores current
behaviour with no migration. The overlay source and the camera fit are additive
and can each be disabled independently by removing their layer/effect if only one
proves problematic.

## Open questions

- [x] **OQ-001 — exact focus counts on clusters.** Should a cluster disclose how
      many of its members are the focused taxon ("3 of 47")? This needs
      supercluster `clusterProperties` plus a per-feature `focus` flag, which means
      re-feeding and re-clustering the 5k–9k-point base source on every selection.
      **Deferred** out of this spec (see Non-goals) pending a measurement against
      PERF-030; revisit after REQ-001 ships. Not a blocker: REQ-007 discloses in
      text that a cluster count still includes de-emphasised records.
- [x] **OQ-002 — fit threshold.** What counts as "already substantially in view"
      in REQ-003? **Resolved** (owner approval 2026-08-04, proposed default
      adopted): fit unless **≥ 50%** of the taxon's placeable occurrences at the
      landed stage are already within the current viewport.
- [x] **OQ-003 — dim depth.** How deeply should cluster discs dim? **Resolved**
      (owner approval 2026-08-04, proposed default adopted): the same 0.2 the
      unclustered points already use (`pointOpacity`), applied through one shared
      constant so it can be tuned in one place during manual review.

## Human decisions required

- [x] **HD-001 — REQ-004 substitution vs. refusal.** When a searched clade cannot
      key a group, should the app select the nearest eligible ancestor with a
      disclosure, or decline? **Answer (owner, 2026-08-04): substitute** — resolve
      to the nearest tier-eligible ancestor and disclose the substitution in the
      side panel. Refusal is reserved for the case where *no* eligible ancestor
      exists, which keeps the designed explanatory state of REQ-004.
- [x] **HD-002 — scope.** Ship REQ-001…REQ-008 together, or split the adjacent
      cluster repairs into a follow-up? **Answer (owner, 2026-08-04): all eight
      together**, as one change.
- [x] **HD-003 — approval** to move this spec to `Approved` and begin
      implementation. **Answer (owner, 2026-08-04): approved.**

## Conflict check

This spec **refines, and does not contradict,** four approved/in-implementation
specs; each is a delivery gap rather than a disagreement about intent:

- **SPEC-009 REQ-004** (selection/highlight coupling) — extends the emphasis to
  clustered occurrences. No requirement changed.
- **SPEC-010 REQ-004** (taxon focus/dim; list is viewport-linked) — REQ-002 makes
  explicit that the *list* is viewport-linked while the *selection* is not.
  SPEC-010's own wording already scopes "in the viewport" to the list rows, so
  this is a clarification, not an amendment. SPEC-010 AMEND-001's DOM cluster
  legend is extended, not replaced, by REQ-007.
- **SPEC-013 REQ-004** (search lands the taxon in context) — REQ-003/REQ-004
  supply the camera move and the reachable-group guarantee that requirement
  assumes. SPEC-013's "Age-independence" edge case gains a viewport analogue.
- **SPEC-015 REQ-004** (clustering and modes preserved) and AMEND-002 — clustering
  parameters and the aggregate species card are preserved; REQ-001 adds a layer
  above them, REQ-005/REQ-006 fix mode-specific behaviour of the card.

No `conflicts_with` entry is needed. This was flagged for the approval decision:
whether REQ-002 and REQ-005 *complete* SPEC-010/SPEC-013 or *change* them.
Resolved at approval (owner, 2026-08-04): they complete them, so no Spec
Amendments entries are opened against SPEC-010 or SPEC-013.

Affected components: `app-frontend`, `exploration-view`, `map-rendering`,
`taxon-search`.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Focus overlay source + cluster dim | `OccurrenceMap.tsx` — `emphasisFeatures`, `baseOpacity`, `emphasis` source, `emphasis-bg`/`emphasis-icon` layers | `test/ui/spec027-map-emphasis.test.tsx` | Implemented |
| REQ-002 | Stage-resolved selected group | `ExplorationView.tsx` — `stageTaxonGroups`, `selectedTaxonGroup`; `GroupedPanels.tsx` count label | `test/ui/spec027-selection.test.tsx` | Implemented |
| REQ-003 | Search-landing camera fit | `viewport.ts` — `boundsOfPoints`, `fractionInView`, `paleoPoints`; `OccurrenceMap.tsx` fit effect; `ExplorationView.tsx` `fitToken` | `test/ui/spec027-map-emphasis.test.tsx`, `test/ui/viewport.test.ts` | Implemented |
| REQ-004 | Reachable tier/key resolution | `grouping.ts` — `tierOfTaxon`; `search.ts` — `landingForTaxon`; `ExplorationView.tsx` — `searchOutcome`, `absentTaxonName`; `GroupedPanels.tsx` — `substitutedFrom` | `test/ui/spec027-search-landing.test.ts`, `test/ui/spec027-selection.test.tsx` | Implemented |
| REQ-005 | Mode-aware cluster interaction | `OccurrenceMap.tsx` — locality short-circuit in the click handler; `MapSpeciesCard.tsx` — `onSelectTaxon`; `ExplorationView.tsx` — `handleSelectTaxonId` | `test/ui/spec027-map-emphasis.test.tsx` | Implemented |
| REQ-006 | Locality cluster rendering/state | `OccurrenceMap.tsx` — `clusters-icon` visibility, mode-change card reset | `test/ui/spec027-map-emphasis.test.tsx` | Implemented (narrowed) |
| REQ-007 | _Retired_ — SPEC-021 deleted the note it extended | — | — | Retired (unimplemented) |
| REQ-008 | Focus-preferring labels | `mapLabels.ts` — `focused` candidate flag; `OccurrenceMap.tsx` — `focusIdsRef` in the label pass | `test/ui/map-labels.test.ts` | Implemented |
| NFR-001 | No re-clustering on selection | `OccurrenceMap.tsx` — emphasis effect touches only the `emphasis` source | `test/ui/spec027-map-emphasis.test.tsx` | Implemented |
| NFR-002 | Non-colour-only emphasis | `OccurrenceMap.tsx`, `exploration.module.css` — `.notice`, `.clusterCountDim` | `test/ui/spec027-selection.test.tsx` | Implemented |
| NFR-003 | Settling: value-equal overlay state + frozen prop defaults | `OccurrenceMap.tsx` — `sameCounts`, `sameLabels`, `NO_LOCALITIES`/`NO_OCCURRENCES`/`NO_TAXA` | `test/ui/spec027-map-emphasis.test.tsx` | Implemented (AMEND-001) |
| SEC-001 | No new egress | — (no new network calls) | `test/data-005-no-runtime-egress.test.ts` | Implemented |
| API-001 | Pure helpers | `src/app/state/search.ts`, `src/app/state/grouping.ts`, `src/app/state/viewport.ts` | `test/ui/spec027-search-landing.test.ts`, `test/ui/viewport.test.ts` | Implemented |

## Implementation notes

Recorded assumptions at drafting time:

- **A-1:** The Explorer's mental model is that a selection is a property of the
  data, not of the camera — so panning away from a selected taxon keeps it
  selected (REQ-002) and does not re-frame it (REQ-003).
- **A-2:** An unclustered overlay of one taxon's occurrences is small enough to
  render without its own clustering at any zoom; the largest single genus in the
  shipped stages should be measured during implementation to confirm.
  **Measured 2026-08-04 — partly falsified; see below.**

Decisions and observations from implementation (2026-08-04):

- **`tierForRank` was removed, not deprecated.** REQ-004 replaces it wholesale:
  it mapped rank → tier without consulting `MAJOR_GROUP_NAMES`, which is the bug.
  Its unit test was replaced by `test/ui/spec027-search-landing.test.ts`, which
  covers the same ground plus the substitution and no-ancestor paths.
- **`tierOfTaxon` lives in `grouping.ts`, not `search.ts`.** The question "can
  this taxon key a group?" must have exactly one answer, or the search landing
  and `groupByTaxon` could disagree again. It sits next to `matchesTier`, which
  it reuses.
- **The dim became a flat value, not a per-feature expression.** `pointOpacity`
  used a `["case", ["in", ["get","id"], …]]` expression; with the overlay
  carrying the emphasised features, the base layers no longer single any feature
  out, so `baseOpacity` returns a plain number. That is also what lets the
  cluster layers — which have no `id` — dim by the same rule.
- **A-2 measured (2026-08-04).** Largest selectable group across all 30 shipped
  stage files, via the real `groupByTaxon` at each tier (worst stage is always the
  Campanian, 9,240 occurrences):

  | | default view (Wikipedia gate on) | show-all (gate off) |
  | --- | --- | --- |
  | largest named genus | *Richardoestesia*, **184** | *Richardoestesia*, **184** |
  | largest named family | *Dromaeosauridae*, **443** | *Hadrosauridae*, **1,487** |
  | largest named major group | *Coelurosauria*, **1,100** | *Coelurosauria*, **1,764** |
  | largest not-classified bucket | **612** (family tier) | **5,336** (genus tier) |

  For **named** taxa the assumption holds comfortably: ≤ 1,100 in the default
  view, ≤ 1,764 with the gate off. Building the overlay `FeatureCollection` for
  the worst case measured **0.79 ms**, far inside PERF-030.

  The measurement did falsify it in one case at the time: the not-classified
  bucket with the Wikipedia gate off reached 5,336 occurrences, 58% of the stage.
  **That case no longer exists.** SPEC-026 REQ-004 (merged 2026-08-26) filters
  records that classify at no taxon at the chosen tier out of the taxon units
  entirely, and `NOT_CLASSIFIED_KEY` is gone from `grouping.ts`, so the bucket is
  not a focus target any more. The worst case is now the largest named group,
  which the table above shows is comfortably inside the assumption. A-2 therefore
  **holds**, and the manual check it called for is struck from the test plan.
- **Deferred, not fixed — a latent render loop in `OccurrenceMap`.** Its
  `localities = []` / `taxaById = new Map()` prop defaults are fresh objects each
  render, so the data-sync effect re-runs every pass and calls `updateOverlays`,
  whose `setClusterCounts`/`setLabels` always receive new array identities — an
  unbounded render loop. It is unreachable from the app today because
  `ExplorationView` memoises both props, and it is pre-existing rather than
  introduced here, so per the no-opportunistic-refactor rule it was left alone;
  `test/ui/spec027-map-emphasis.test.tsx` passes stable props and documents why.
  It surfaced only because this spec's tests are the first to run the map's
  `load` path in jsdom. Worth its own spec.

## Spec amendments

> Required for any behavioral change after the spec is Approved.

### AMEND-001: the map must settle — no self-feeding overlay re-render

- **Date:** 2026-08-04
- **Reason:** Implementing REQ-001 surfaced a latent defect that this spec's own
  tests are the first to reach. `OccurrenceMap`'s optional collection props
  default to fresh objects (`localities = []`, `taxaById = new Map()`) evaluated
  on **every** render, including its own state-driven ones; the data-sync effect
  depends on them, so it re-runs each pass and calls `updateOverlays`, whose
  `setClusterCounts` / `setLabels` always receive new array identities — an
  unbounded render loop. It was previously unreachable from the app (every caller
  memoises those props) and unreachable from tests (jsdom has no WebGL, so the
  map's `load` path never ran). The fake-MapLibre harness this spec adds runs
  that path, and the loop hung the suite. Reported to the owner as a deferral and
  the owner asked for it to be fixed, so it is folded in here rather than left.
- **Changed requirements:** Adds NFR-003 (below). No functional requirement's
  behaviour changes; REQ-001's mechanism is unaffected.
- **Behavioral impact:** The two DOM-overlay states keep their previous value
  when nothing changed, so a recompute that yields an identical result no longer
  re-renders. Visible output is unchanged; the map simply settles, and a settled
  pan frame costs one fewer render. The prop defaults become frozen
  module-level constants, so omitting them is now safe for any caller.
- **Test impact:** Two integration cases (`settles when a caller omits the
  collection props`, `a map event that changes nothing does not re-render`) and
  two unit cases over the extracted `sameCounts` / `sameLabels` predicates, all
  in `test/ui/spec027-map-emphasis.test.tsx`. Verified to be meaningful by
  reverting each half of the fix: with neither half the settling test hangs;
  with the equality guards alone it passes, confirming they carry the fix and
  the frozen defaults are complementary.
- **Human approval reference:** Owner request, 2026-08-04 ("can you fix those
  two flags?"), following the deferral flagged in the delivery summary.

### NFR-003: The map component settles

- **Statement:** `OccurrenceMap` must reach a stable render state after any
  input change or map event, for **any** caller — including one that omits the
  optional collection props or passes freshly-built ones. A recomputation of the
  DOM overlays that produces an identical result must not trigger a re-render.
- **Rationale:** The overlays are recomputed from effects as well as map events,
  so state churn there can feed the effects that caused it. A component whose
  correctness depends on its callers memoising props is a trap, and the loop
  freezes the browser tab rather than degrading.
- **Acceptance criteria:** Rendering with no `localities` / `taxaById` reaches a
  loaded map and then performs no further overlay work; repeated `moveend`
  events with an unchanged camera perform no further overlay work.
- **Verification method:** automated component test (bounded overlay-write count)
  + unit tests on the equality predicates.
- **Evidence location:** `test/ui/spec027-map-emphasis.test.tsx`,
  `src/app/components/OccurrenceMap.tsx` (`sameCounts`, `sameLabels`,
  `NO_LOCALITIES` / `NO_OCCURRENCES` / `NO_TAXA`).

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [x] Open questions are resolved or explicitly deferred (OQ-001 deferred;
      OQ-002/OQ-003 resolved to the drafted defaults).
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed.
- [x] Human approval recorded before status set to Approved (owner
      nelsonjeanrenaud@gmail.com, 2026-08-04, HD-001…HD-003 above).
