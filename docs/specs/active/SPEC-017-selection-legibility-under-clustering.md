---
doc_type: spec
spec_id: SPEC-017
title: Search & selection legibility under clustering
status: Draft
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, exploration-view, map-rendering, taxon-search]
affected_interfaces: []
supersedes: []
superseded_by:
depends_on: [SPEC-009, SPEC-010, SPEC-013, SPEC-015]
conflicts_with: []
last_verified_at: 2026-08-03
---

# SPEC-017: Search & selection legibility under clustering

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
- **Evidence location:** _pending_.

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
- **Evidence location:** _pending_.

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
- **Evidence location:** _pending_.

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
- **Evidence location:** _pending_.

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
- **Evidence location:** _pending_.

### REQ-006: Locality-mode cluster rendering and state are correct

- **Statement:** In Locality mode, cluster discs must carry their **count badge**
  and must not carry a clade silhouette; and no cluster interaction may leave
  residual card state that suppresses hover.
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
- **Evidence location:** _pending_.

### REQ-007: Cluster semantics are disclosed in every mode

- **Statement:** The map pane's cluster-semantics note must be present in **Taxon**
  mode too, stating what a cluster counts there, and must state what the count
  means while a focus is active.
- **Rationale:** The note is suppressed in taxon mode
  (`ExplorationView.tsx:368`) although clusters still render, leaving an unlabelled
  aggregate; SPEC-010 AMEND-001 made this DOM note the accessible carrier of
  cluster meaning, so omitting it in one mode drops the disclosure entirely there.
- **Acceptance criteria:** The note is present and mode-appropriate in all three
  modes.
- **Verification method:** automated component test.
- **Evidence location:** _pending_.

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
- **Evidence location:** _pending_.

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
- **Evidence location:** _pending_.

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
- **Evidence location:** _pending_.

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
- **Evidence location:** _pending_.

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
| REQ-001 | Focus overlay populated; cluster layers dimmed; clustered feature count unchanged | automated + manual | component test on source data + paint | _pending_ | — |
| REQ-002 | Off-viewport taxon still focuses and panels; list stays viewport-linked | automated | component test with excluding viewport | _pending_ | — |
| REQ-003 | Exactly one camera fit on search landing; none on list select | automated + manual | component test with stubbed camera | _pending_ | — |
| REQ-004 | Non-major-group clade resolves to disclosed ancestor; no-group state designed | automated | unit + component test | _pending_ | — |
| REQ-005 | Taxon-mode cluster card selects; locality cluster zooms; no silent click | automated | component test per mode | _pending_ | — |
| REQ-006 | Locality clusters show counts, no clade icon, hover survives | automated + manual | component test | _pending_ | — |
| REQ-007 | Cluster note present in all three modes | automated | component test | _pending_ | — |
| REQ-008 | Focused candidates take labels ahead of unfocused | automated | unit test | _pending_ | — |
| NFR-001 | No base-source `setData` on focus change; perf scenarios green | automated | component test + existing scenarios | _pending_ | — |
| NFR-002 | States present without WebGL; no hue-only encoding | automated + inspection | jsdom component tests | _pending_ | — |
| SEC-001 | No new egress | automated | `test/data-005-no-runtime-egress.test.ts` | `test/data-005-no-runtime-egress.test.ts` | — |
| API-001 | New helpers pure and unit-tested | automated | unit test | _pending_ | — |

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

- [ ] **OQ-001 — exact focus counts on clusters.** Should a cluster disclose how
      many of its members are the focused taxon ("3 of 47")? This needs
      supercluster `clusterProperties` plus a per-feature `focus` flag, which means
      re-feeding and re-clustering the 5k–9k-point base source on every selection.
      Deferred out of this spec (Non-goals) pending a measurement against
      PERF-030; recommend deciding after REQ-001 ships.
- [ ] **OQ-002 — fit threshold.** What counts as "already substantially in view"
      in REQ-003 (fraction of the taxon's occurrences inside the current bounds,
      or bounds overlap)? Proposed default: fit unless ≥ 50% of the taxon's
      placeable occurrences are already within the viewport.
- [ ] **OQ-003 — dim depth.** The unclustered dim is currently 0.2
      (`pointOpacity`). Should clusters dim to the same value, or less deeply
      given a disc is a larger, heavier mark? Proposed default: same value, tuned
      in manual review.

## Human decisions required

- [ ] **HD-001 — REQ-004 substitution vs. refusal.** When a searched clade cannot
      key a group, should the app select the nearest eligible ancestor with a
      disclosure (proposed), or decline and tell the Explorer the clade is not a
      selectable grouping level? Answer:
- [ ] **HD-002 — scope.** REQ-001…REQ-004 are the defect; REQ-005…REQ-008 are
      adjacent cluster-interaction repairs found in the same investigation. Ship
      all eight together, or split REQ-005…REQ-008 into a follow-up spec? Answer:
- [ ] **HD-003 — approval** to move this spec to `Approved` and begin
      implementation. Answer:

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

No `conflicts_with` entry is needed. If the owner judges REQ-002 or REQ-005 to
change SPEC-010's or SPEC-013's meaning rather than complete it, those specs need
Spec Amendments entries instead — flagged here for the approval decision.

Affected components: `app-frontend`, `exploration-view`, `map-rendering`,
`taxon-search`.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Focus overlay source + cluster dim | `OccurrenceMap.tsx` | _pending_ | Not started |
| REQ-002 | Stage-resolved selected group | `ExplorationView.tsx` | _pending_ | Not started |
| REQ-003 | Search-landing camera fit | `ExplorationView.tsx`, `OccurrenceMap.tsx` | _pending_ | Not started |
| REQ-004 | Reachable tier/key resolution | `src/app/state/search.ts`, `grouping.ts`, `GroupedPanels.tsx` | _pending_ | Not started |
| REQ-005 | Mode-aware cluster interaction | `OccurrenceMap.tsx`, `MapSpeciesCard.tsx` | _pending_ | Not started |
| REQ-006 | Locality cluster rendering/state | `OccurrenceMap.tsx` | _pending_ | Not started |
| REQ-007 | Cluster semantics note | `ExplorationView.tsx` | _pending_ | Not started |
| REQ-008 | Focus-preferring labels | `src/app/components/mapLabels.ts` | _pending_ | Not started |
| NFR-001 | No re-clustering on selection | `OccurrenceMap.tsx` | _pending_ | Not started |
| NFR-002 | Non-colour-only emphasis | `OccurrenceMap.tsx`, `exploration.module.css` | _pending_ | Not started |
| SEC-001 | No new egress | — | `test/data-005-no-runtime-egress.test.ts` | Satisfied by construction |
| API-001 | Pure helpers | `src/app/state/` | _pending_ | Not started |

## Implementation notes

_Filled during implementation._

Recorded assumptions at drafting time:

- **A-1:** The Explorer's mental model is that a selection is a property of the
  data, not of the camera — so panning away from a selected taxon keeps it
  selected (REQ-002) and does not re-frame it (REQ-003).
- **A-2:** An unclustered overlay of one taxon's occurrences is small enough to
  render without its own clustering at any zoom; the largest single genus in the
  shipped stages should be measured during implementation to confirm.

## Spec amendments

_None — spec is Draft._

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [ ] Open questions are resolved or explicitly deferred.
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed.
- [ ] Human approval recorded before status set to Approved.
