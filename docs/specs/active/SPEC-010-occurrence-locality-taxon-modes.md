---
doc_type: spec
spec_id: SPEC-010
title: Grouping modes — occurrences, localities & taxa (with taxon-rank rollup)
status: Draft
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, exploration-view, map-rendering, occurrence-list, context-bar, read-model, pipeline, ingestion, styling]
affected_interfaces: [ReadOccurrence, ReadTaxon, ReadApi, PbdbOccRecord, PbdbTaxonRecord]
supersedes: []
superseded_by:
depends_on: [SPEC-001, SPEC-003, SPEC-008, SPEC-009]
conflicts_with: []
last_verified_at: 2026-07-22
---

# SPEC-010: Grouping modes — occurrences, localities & taxa (with taxon-rank rollup)

## Summary

Give the exploration view a **grouping unit** the Explorer can switch between: the
current per-record **Occurrence** view, plus a **Locality** view (co-located records
collapsed to one marker per collection) and a **Taxon** view (records organised by
taxonomic name). In Taxon mode the map still plots every real occurrence — a taxon is a
*distribution*, so it is **never** collapsed to a single fabricated point — but the
right-hand list becomes one row per taxon and selecting a taxon **focuses all of its
occurrences at once** (emphasised on the map, the rest dimmed) and routes to its
profile. Taxon mode carries a **rank selector** so the Explorer can roll records up to a
chosen rank (e.g. group by Family instead of Genus). Because the current snapshot pulls
**only genera**, delivering the rank selector requires a **pipeline change** — ingesting
the Dinosauria taxonomic hierarchy (taxa at several ranks with resolvable parent links)
from PBDB — which this spec includes (owner-directed to do the pipeline work in this same
change). Occurrence mode is the default and its current behaviour is unchanged.

## Context

Today the exploration view (SPEC-003; widened by SPEC-008; timeline + viewport list by
SPEC-009) has exactly one grouping unit: the **occurrence** (`ReadOccurrence`), the PBDB
atom = one taxon identified in one collection over a time range. The map
(`OccurrenceMap`) plots one GeoJSON point per occurrence with MapLibre's built-in
**spatial** clustering (`clusterRadius: 40`), and the sidebar (`OccurrenceList`,
SPEC-009 REQ-003) is a **flat** list of the occurrences in the viewport — one row per
record, so the same taxon repeats once per locality.

SPEC-005 once aggregated the list by taxon/formation; SPEC-007 deleted the list; SPEC-009
brought back a deliberately **flat** list and recorded aggregation as an explicit
non-goal ("no taxon/formation aggregation … this list is flat"). This spec is the
owner-directed return of grouping — but generalised into a first-class **mode** the user
picks, not a fixed layout.

Two enabling facts from the data layer, established by inspecting the built snapshot and
the pipeline (2026-07-22):

- **Localities are ready today.** A collection already carries one real paleocoordinate
  (`Collection.paleo`), and every occurrence carries its `collectionId` at L1
  (`src/pipeline/sources.ts`, `ingest.ts`). Collapsing co-located occurrences to one
  **locality** marker is therefore *not* inventing a position — it is the collection's
  own point. `derive.ts` currently drops `collectionId` from `ReadOccurrence` (keeping
  only `collectionName`), so it must be exposed (DATA-001).
- **The taxonomic hierarchy is absent by our own scoping, not by PBDB.** The built
  `reference.json` holds **2124 taxa, all rank `Genus`, zero `parentId`**, and only ~43 %
  of a stage's occurrences resolve to one of those genera (the rest are higher-clade
  "*… indet.*" identifications). This is because `HttpSourceClient.pbdbTaxa()` queries
  PBDB with **`&rank=genus`** — we pull genera only. PBDB is itself a taxonomy database
  and holds the full parent tree; in fact our occurrences query already uses
  `show=class`, so the higher classification (family/order/class) is **already returned
  and discarded** (`PbdbOccRecord` only reads `gnl`). A rank roll-up therefore has no
  ancestry to walk **until the pull is widened** — the owner directed doing that pipeline
  work here (decision 2026-07-22, "b").

The owner directed this in chat (2026-07-22): separate an occurrence mode from a
**taxon** mode grouped by taxon, with a **rank selector inside** taxon mode; agreed the
map should keep the real occurrence points and make the taxon the unit of
list/selection/focus (interpretation "A", **not** a centroid glyph); agreed to **also
build the Locality** grouping as the honest fix for the overplotting of co-located
records; and, on learning the missing hierarchy is our scoping choice, directed doing the
**pipeline hierarchy work in this branch** rather than deferring it.

## Problem statement

There is only one way to read the map and list — as individual records. That is noisy
(one taxon repeats once per locality in the list), it makes co-located records overplot
and become individually un-clickable at high zoom, and it offers no way to ask the two
questions a paleontologist actually asks: *"what is at this place?"* (locality) and
*"where and when did this taxon live?"* (taxon). Meanwhile the spatial cluster count
(“42”) mixes records and taxa and silently reads as diversity when it only means density;
and grouping by anything coarser than the identified taxon is impossible because the
snapshot only holds genera.

## Goals

- Add an always-visible **grouping-mode control** to the exploration view with three
  units — **Occurrences** (default), **Localities**, **Taxa** — that changes the list
  row unit, the map glyph semantics, and the selection/panel target coherently.
- Keep **Occurrence mode** behaviourally identical to today (SPEC-009), and make the
  spatial-cluster count legibly mean "records here" (density), not diversity.
- Add **Locality mode**: collapse occurrences that share a `collectionId` into one
  marker at the collection's real paleocoordinate; the list becomes one row per
  locality; selecting a locality inspects the taxa recorded there. Locality markers are
  spatially clustered like occurrence points (Q2 decision, 2026-07-22).
- Add **Taxon mode** (interpretation A): the map still plots **every** occurrence; the
  list becomes one row per taxon **currently in the viewport** (SPEC-009-consistent, Q3
  decision), showing name + occurrence count + aggregate Ma span; selecting a taxon
  **focuses all of its occurrences** (emphasised, the rest dimmed) and routes to the
  taxon profile (SPEC-003 loop).
- Add a **rank selector** inside Taxon mode that rolls occurrences up their taxonomic
  parent chain to a chosen rank (Species / Genus / Family / Clade), so grouping
  granularity is the user's choice.
- **Widen the ingestion** so the snapshot carries the Dinosauria taxonomic hierarchy —
  taxa at the ranks needed for roll-up, each with its real rank and a parent link that
  resolves within the snapshot — replacing the genus-only pull, deterministically and
  within the size budget.
- Preserve the SPEC-009 viewport-linkage and two-way map↔list highlighting under every
  mode; preserve keyboard/screen-reader operability throughout.

## Non-goals

- **No fabricated taxon glyph.** A taxon is never collapsed to a centroid, a single
  representative point, or an implied continuous range/extent polygon — that would invent
  a location the data does not assert (charter §2). Taxon mode keeps the real points.
- **No colour-per-taxon / colour-per-locality palette.** The charter allows one teal
  accent plus meaning-only status colours; identity is carried by focus/emphasis + dim +
  label, never by handing out arbitrary hues.
- **No multi-select** of taxa/localities, no set operations, no cross-mode comparison
  view. One selection at a time (as today).
- **No free-text search, faceted filters, or a classification browser** (still SPEC-009
  non-goals). The rank selector is a single granularity control, not a tree navigator.
- **No change to the time window** (SPEC-008 REQ-001 Mesozoic bounds), the basemap frames
  (SPEC-004), continuous/sub-stage time (SPEC-008 REQ-002), or URL/deep-link state
  (SPEC-009 assumption A-2 stands). The *taxonomic* coverage does change (DATA-003).
- **No new base_name or non-Dinosauria clades.** The widened pull stays within
  `base_name=Dinosauria` (SPEC-008 scope); it adds *ranks/parents inside that clade*, not
  new taxa outside it.
- **No new runtime egress** — the hierarchy is fetched at ingestion (build) time only;
  the app still reads the static snapshot (DATA-005).
- **No new spatial index** — a linear scan / hash-group over the loaded stage set is
  ample at MVP volume.

## Users or actors

The **Explorer**, including keyboard and screen-reader users. Downstream: the **pipeline
/ ingestion** (widened PBDB pull + snapshot rebuild), and the **read API** consumed by
the exploration view.

## Functional requirements

### REQ-001: Grouping-mode control

- **Statement:** The exploration view must present an always-visible control to select
  the grouping unit — **Occurrences**, **Localities**, **Taxa** — defaulting to
  **Occurrences**. The control must be keyboard-operable and expose the active mode to
  assistive tech (e.g. `aria-pressed` / a labelled radio group), with the active mode
  legible as text (never colour-only). Changing the mode must switch the list row unit,
  the map glyph/selection semantics, and the panel target together, while **preserving**
  the selected stage, the map viewport, and (where still meaningful) the current
  selection. The control lives with the other always-present controls (context bar /
  sidebar header), consistent with CONS-450.
- **Rationale:** The owner asked to separate occurrence and taxon views; a first-class
  mode control generalises this and keeps the switch discoverable and reversible.
- **Acceptance criteria:** The control exposes three options with accessible names
  Occurrences/Localities/Taxa; `Occurrences` is active on load; activating another option
  sets it active (`aria-pressed`/checked) and re-renders the list under that unit while
  the stage and viewport are unchanged; the active mode is shown as text.
- **Verification method:** automated component test + inspection.
- **Evidence location:** `test/ui/grouping-mode.test.tsx`, `src/app/components/ContextBar.tsx` (or a new `GroupingModeControl`).

### REQ-002: Occurrence mode preserved; cluster count means "records"

- **Statement:** In **Occurrence** mode the view must behave as it does under SPEC-009:
  one map marker per occurrence, spatial clustering unchanged, a flat viewport-linked
  list (one row per record: taxon name + Ma range), and selecting a record opens the
  occurrence panel (SPEC-003 REQ-006 loop). The spatial **cluster** must legibly convey
  that its number is a **count of records** at that location (density), e.g. via its
  accessible label / an on-map affordance, so it is not mistaken for taxonomic diversity.
- **Rationale:** Occurrence mode is the safe default and must not regress; the cluster's
  ambiguous meaning (records vs taxa) is a known defect this spec is chartered to clear.
- **Acceptance criteria:** With mode = Occurrences the SPEC-009 occurrence-list and
  map-selection tests still pass unchanged; a cluster's accessible name states a record
  count (e.g. "42 occurrence records"); no colour-only signal is introduced.
- **Verification method:** automated (SPEC-009 suite regression) + component test + inspection.
- **Evidence location:** `test/ui/occurrence-list.test.tsx`, `src/app/components/OccurrenceMap.tsx`.

### REQ-003: Locality mode

- **Statement:** In **Locality** mode the map must render **one marker per collection**
  (grouping every visible occurrence that shares a `collectionId`) placed at that
  collection's **own reconstructed paleocoordinate** — never a computed/averaged
  position — and those locality markers must be **spatially clustered** at low zoom the
  same way occurrence points are (Q2 decision, 2026-07-22). Each locality marker must
  convey how many records (and how many distinct taxa) it groups without colour-alone.
  The viewport-linked list must show **one row per locality** (collection or formation
  name + distinct-taxon count + the locality's Ma range), and selecting a locality must
  open a panel that lists the **taxa/occurrences recorded at that locality**, each row
  reaching the occurrence panel / taxon profile (SPEC-003 loop preserved). Occurrences
  sharing a collection but differing only in identification collapse into that one
  locality.
- **Rationale:** A collection is a real place with one real paleocoordinate, so
  collapsing to it is honest and directly fixes overplotting of co-located records; it
  answers "what is at this place?".
- **Acceptance criteria:** Given N occurrences across M collections in view, the map
  renders M locality markers at the collections' paleocoordinates (spatially clustered at
  low zoom) and the list shows M rows; a marker/row for a collection with k records over
  j taxa reports j distinct taxa; a collection with no paleocoordinate is excluded from
  the map (as occurrences are today) but still reachable in the list fallback; selecting
  a locality lists its taxa and each reaches the panel/profile.
- **Verification method:** unit test (grouping fold) + component test.
- **Evidence location:** `test/ui/grouping.test.ts`, `test/ui/locality-mode.test.tsx`, `src/app/state/grouping.ts`.

### REQ-004: Taxon mode (map keeps real points; select focuses the whole taxon)

- **Statement:** In **Taxon** mode the map must continue to plot **every** occurrence at
  its real paleocoordinate (no collapsing, no centroid, no range polygon). The viewport-
  linked list must show **one row per taxon whose points are currently in the viewport**
  (SPEC-009-consistent; the count reads as "taxa on screen" — Q3 decision, 2026-07-22),
  each row carrying the accepted scientific name + the count of that taxon's occurrences
  in view + the taxon's aggregate Ma span across those occurrences. Selecting a taxon
  (from the list or by picking one of its points on the map) must **focus the whole
  taxon**: all of that taxon's occurrence points are emphasised and the rest are visibly
  **dimmed** (emphasis + reduced prominence, not colour-hue identity), and the
  panel/route target becomes the **taxon profile** (SPEC-003 REQ-007). The SPEC-009
  transient hover-highlight coupling must keep working (hovering a taxon row emphasises
  that taxon's points and vice-versa), with highlight weaker than the taxon focus.
- **Rationale:** A taxon is a distribution across many localities and stages; showing the
  real points while making the taxon the unit of list/selection/focus answers "where &
  when did this taxon live?" without fabricating geometry (owner-chosen interpretation A).
- **Acceptance criteria:** With mode = Taxa the list has one row per distinct taxon in
  view with its in-view occurrence count and aggregate span; selecting a taxon emphasises
  all its points and dims non-members (assertable via the map paint expression / a focus
  id-set) and the panel shows the taxon profile; the map still contains one feature per
  occurrence (feature count unchanged from Occurrence mode); no per-taxon hue is assigned.
- **Verification method:** component test + unit test (per-taxon aggregation) + inspection of the map focus/dim paint.
- **Evidence location:** `test/ui/taxon-mode.test.tsx`, `test/ui/grouping.test.ts`, `src/app/components/OccurrenceMap.tsx`.

### REQ-005: Rank selector within Taxon mode

- **Statement:** While in Taxon mode the view must present a **rank selector** offering
  the taxonomic ranks available in the snapshot (from `Species` up through `Genus`,
  `Family`, and the major `Clade` levels). Choosing a rank must **roll each occurrence up
  its taxonomic parent chain (DATA-002/003) to the nearest ancestor at that rank** and
  group the list/focus at that rolled-up taxon; occurrences whose identified taxon has no
  ancestor at the chosen rank must be handled by an explicit, disclosed rule (grouped
  under their finest available taxon and counted in a stated "not classified at this
  rank" bucket — never silently dropped). The default rank must be the **finest** (the
  identified taxon, i.e. no roll-up), preserving REQ-004's behaviour. The selector must
  be hidden or disabled outside Taxon mode and be keyboard-operable with a legible
  current value.
- **Rationale:** Records sit at different ranks; letting the Explorer choose the grouping
  rank (e.g. collapse genera into their family) is the owner's stated requirement and the
  natural granularity control for Taxon mode.
- **Acceptance criteria:** In Taxon mode the selector lists the ranks present in the
  snapshot; default groups at the identified taxon; choosing `Family` re-groups two
  genera of one family into a single row/focus whose count is the sum; an occurrence with
  no ancestor at the chosen rank appears in the disclosed "not classified at this rank"
  bucket rather than vanishing; outside Taxon mode the selector is not offered.
- **Verification method:** unit test (rank roll-up over the ingested ancestry) + component test.
- **Evidence location:** `test/ui/rank-rollup.test.ts`, `test/ui/taxon-mode.test.tsx`, `src/app/state/grouping.ts`.

## Non-functional requirements

### NFR-001: In-memory O(n) grouping, within PERF-030, keyboard-accessible

- **Statement:** Every grouping (by collection, by taxon, by rolled-up rank) and every
  mode/rank switch must be a pure in-memory pass over the loaded stage's occurrences with
  no I/O, completing well within PERF-030 (≤1 s) at MVP volume; the rank roll-up walks a
  precomputed ancestor map (O(depth) per occurrence, depth bounded by the rank ladder).
  The mode control and rank selector must be fully keyboard-operable with visible focus
  and non-colour-only state.
- **Rationale:** Static-client budgets (SPEC-002 NFR-001; PERF-030) and accessibility
  (charter §7; PERF-220…270).
- **Acceptance criteria:** No network request on a mode/rank switch, hover, or pan/zoom;
  grouping is O(n) (plus O(n·depth) for roll-up); the controls are reachable and operable
  by keyboard.
- **Verification method:** code inspection + the existing no-egress test remains green + a11y lint (jsx-a11y) clean.
- **Evidence location:** `src/app/state/grouping.ts`, `test/data-005-no-runtime-egress.test.ts`.

### NFR-002: Snapshot stays deterministic and within the size budget

- **Statement:** The widened ingestion (DATA-003) must remain **byte-stable** across
  rebuilds (deterministic merge/sort, as SPEC-008 NFR-001/002) and every produced
  artifact must stay within its `scripts/check_budget.ts` ceiling. If the added
  hierarchy pushes `reference.json` past its current gzip/raw budget, the budget must be
  **re-measured and the ceiling adjusted with justification** (per SPEC-008's "budgets
  are measured, not decided up front"), not silently exceeded, and the change recorded as
  a coordinated SPEC-008 NFR-002 adjustment.
- **Rationale:** Adding families/orders/clades (and possibly species) enlarges the shared
  reference; the size gate exists precisely so this cannot balloon unnoticed.
- **Acceptance criteria:** `pnpm run check:budget` passes after the rebuild; any raised
  ceiling is documented with the measured size; the snapshot is identical on a second
  rebuild from the same pull.
- **Verification method:** `pnpm run gen:web-data && pnpm run build && pnpm run check:budget` + a determinism check (double rebuild diff).
- **Evidence location:** `scripts/check_budget.ts`, pipeline determinism test.

## Security and privacy considerations

### SEC-001: No new runtime egress; ingestion-time only

- **Statement:** The widened PBDB pull runs at **ingestion (build) time only**, like the
  existing one (`HttpSourceClient`); no new runtime network calls, secrets, or tokens are
  introduced, and the app still reads the static snapshot (DATA-005). The two exposed
  read-model fields and the grouping are in-memory. The map stays self-contained
  (SPEC-004 SEC-001 unchanged).
- **Rationale:** Preserve the static, tokenless, no-runtime-egress guarantees while the
  extra data is fetched only during the build.
- **Acceptance criteria:** `test/data-005-no-runtime-egress.test.ts` stays green; no new
  fetch/XHR is added to the app; new fetches live only in the pipeline adapter.
- **Verification method:** automated test + inspection.
- **Evidence location:** `test/data-005-no-runtime-egress.test.ts`, `src/pipeline/http-client.ts`.

## Data model impact

### DATA-001: Expose `collectionId` on `ReadOccurrence`

- **Statement:** `ReadOccurrence` must carry the stable `collectionId` of its collection
  so occurrences can be grouped into localities deterministically (not by the non-unique
  display `collectionName`). The value already exists at L1 (`src/pipeline/sources.ts`,
  `ingest.ts`); `derive.ts` must copy it onto the read occurrence. The snapshot artifact
  must be rebuilt (`pnpm run snapshot`).
- **Rationale:** Locality grouping (REQ-003) needs a stable, unique collection key; names
  are display strings and may collide.
- **Acceptance criteria:** The `ReadOccurrence` type includes `collectionId: string`; the
  rebuilt snapshot populates it for every occurrence; occurrences sharing a collection
  share the id; the snapshot remains byte-stable across rebuilds (NFR-002 determinism).
- **Verification method:** type check + pipeline/derive unit test + snapshot rebuild.
- **Evidence location:** `src/domain/snapshot.ts`, `src/pipeline/derive.ts`, pipeline tests.

### DATA-002: Expose a resolvable taxonomic parent chain on `ReadTaxon`

- **Statement:** `ReadTaxon` must expose the taxonomic **parent linkage** needed to walk
  a taxon up to an ancestor of a chosen rank — at minimum `parentId` — and every
  `ReadTaxon` must carry its **real rank** (not the hardcoded `Genus`). The read model
  must let the app resolve, for any identified taxon, its nearest ancestor at a target
  rank using **only in-snapshot taxa** (the chain must be closed under the ingested set —
  DATA-003 guarantees the referenced parents are present). Where a chain still ends below
  a requested rank, the roll-up rule of REQ-005 applies.
- **Rationale:** The rank selector (REQ-005) has no ancestry to roll up without a
  parent chain whose links resolve inside the snapshot.
- **Acceptance criteria:** `ReadTaxon` includes `parentId` and a correct `rank`; given a
  genus whose family is present in the snapshot, the app resolves the family; the
  resolver is deterministic and does no I/O; no `parentId` dangles outside the taxa set.
- **Verification method:** type check + unit test over the ingested ancestry.
- **Evidence location:** `src/domain/snapshot.ts`, `src/pipeline/derive.ts`, `test/ui/rank-rollup.test.ts`.

### DATA-003: Ingest the Dinosauria taxonomic hierarchy (widened PBDB pull)

- **Statement:** The ingestion (`HttpSourceClient`) must capture the **taxonomic
  hierarchy within `base_name=Dinosauria`** — taxa at the ranks required for roll-up
  (Species through the major clade levels, at least Species/Genus/Family/Clade) — each
  taxon carrying its PBDB rank and a `parentId` that **resolves to another ingested
  taxon**, forming a chain closed under the set (excepting the single agreed root). This
  replaces the genus-only pull (`&rank=genus`) with a hierarchy-aware pull (e.g. removing
  the rank filter / adding parent ingestion / consuming the `show=class` classification
  columns already returned on occurrences), keeping the per-interval merge deterministic
  (SPEC-008 REQ-001). Occurrence→taxon resolution must retain each occurrence's
  **identified** taxon (at whatever rank), joined into the enriched taxa set so roll-up
  can proceed; "*… indet.*" identifications resolve to their real higher taxon where PBDB
  provides it. The snapshot must be rebuilt.
- **Rationale:** The missing hierarchy is our scoping choice (`rank=genus`), not a PBDB
  limitation; the owner directed widening the pull here so the rank selector has real
  ancestry. PBDB already returns the higher classification we currently discard.
- **Acceptance criteria:** The rebuilt `reference.json` contains taxa at more than one
  rank with non-empty, resolvable `parentId` chains; a sampled genus resolves up to a
  family/clade present in the set; occurrences still join to a taxon; the merge is
  deterministic (byte-stable double rebuild); the pull stays within `base_name=Dinosauria`.
- **Verification method:** pipeline unit/integration test (hierarchy shape + resolvability) + rebuild + budget gate (NFR-002).
- **Evidence location:** `src/pipeline/http-client.ts`, `src/pipeline/ingest.ts`, `src/pipeline/derive.ts`, pipeline tests.

## API impact

### API-001: Read-model grouping helpers (internal, no runtime egress)

- **Statement:** Internal, in-memory helpers only: pure functions to group a set of
  `ReadOccurrence` by collection (→ locality aggregates: paleocoordinate, taxon set,
  record count, Ma range) and by taxon / rolled-up rank (→ taxon aggregates: occurrence
  ids, count, aggregate Ma span), plus an ancestor-at-rank resolver over the read model.
  `ReadApi` may gain convenience accessors but performs no I/O. Component contracts:
  `ExplorationView` owns the grouping mode + rank in its reducer state; `OccurrenceMap`
  gains a mode (glyph source: occurrences vs localities) and a **focus id-set** (for the
  dim-others taxon focus) alongside its existing `selectedId`/`highlightedId`;
  `OccurrenceList` renders rows polymorphic in the grouping unit.
- **Rationale:** Keep derivations pure and testable independently of React/canvas
  (SPEC-002 pattern), consistent with `src/app/state/exploration.ts` and `viewport.ts`.
- **Acceptance criteria:** Helpers are pure and unit-tested; no new fetch/XHR in the app;
  existing `ReadApi` egress guarantees unchanged.
- **Verification method:** unit tests + inspection.
- **Evidence location:** `src/app/state/grouping.ts`, `src/read/api.ts`.

## UI or UX impact

### UX-001: Coherent, legible modes; all real states designed; charter-compliant

- **Statement:** The mode control and rank selector must use **domain language**
  (Occurrences / Localities / Taxa; Species / Genus / Family / Clade — never
  "Insights"-style terms), be legible as text (not hover- or colour-only), and keep one
  teal accent with period/status colours meaning-only. Every real state must be designed
  per mode: loading/error (existing), empty-at-age (existing), empty-in-view (SPEC-009),
  the **"not classified at this rank"** bucket (REQ-005), a locality/taxon with a single
  member, and the taxon **focus/dim** state (which must remain distinguishable without
  relying on hue). Switching mode must not strand the user (selection preserved where it
  still maps; otherwise cleared with the list still populated).
- **Rationale:** Charter §2/§4/§7; consistency with SPEC-009's designed-states bar.
- **Acceptance criteria:** Control labels are domain terms and legible as text; the
  not-classified bucket renders when applicable; the focus/dim state is conveyed by
  emphasis + prominence (assertable in the paint expression), not hue alone; no
  "reconstructed/interpretative" wording reappears.
- **Verification method:** component test + inspection.
- **Evidence location:** `test/ui/grouping-mode.test.tsx`, `src/app/components/exploration.module.css`.

## Configuration impact

Adds view-layer constants (mode enum, rank ladder, default mode = Occurrences, default
rank = finest) and changes the ingestion query configuration (drops the genus-only rank
filter; captures ranks/parents). No env vars, secrets, or feature flags. The size budget
constants in `scripts/check_budget.ts` may be re-measured (NFR-002).

## Error handling

- Occurrence/collection with no paleocoordinate → excluded from the map (as today);
  still reachable via the list's no-map fallback.
- Taxon whose identified rank has no ancestor at the chosen rank → the disclosed
  "not classified at this rank" bucket (REQ-005), never silently dropped.
- Incomplete ancestry from PBDB (a parent PBDB omits) → the ingestion must still produce a
  closed chain (stop at the highest resolvable ancestor and mark the gap); roll-up above
  the gap falls into the not-classified bucket. No dangling `parentId` may reach the app.
- Widened pull exceeds a size budget → fail `check:budget` and re-measure the ceiling with
  justification (NFR-002), never silently exceed.
- Mode switch with a now-meaningless selection (e.g. a single occurrence selected, then
  switching to Taxa) → selection re-mapped to its taxon where possible, else cleared with
  the list still populated.

## Edge cases

- A collection with exactly one occurrence → a locality of one (marker + one-row panel);
  must not look broken.
- A taxon with exactly one occurrence in view → one-row taxon with count 1 and a point
  Ma span.
- Two genera of one family co-located in one collection → in Locality mode one marker
  (2 taxa); in Taxon mode two rows at Genus rank, one row at Family rank.
- "*… indet.*" occurrence identified above genus → resolves to its real higher taxon; at
  a finer requested rank (Genus/Species) it lands in the not-classified bucket.
- Very many groups in view → the SPEC-009 render cap + "showing X of Y" overflow applies
  to grouped rows too; the map stays the complete view.
- Antimeridian-wrapping viewport (west > east) → the SPEC-009 bounds handling is reused
  unchanged for both occurrence and locality glyphs.
- Enlarged `reference.json` → watched by NFR-002 / the budget gate.

## Acceptance criteria

Satisfied when: an always-visible mode control switches between Occurrences (default,
behaviour unchanged), Localities, and Taxa, preserving stage + viewport (REQ-001);
Occurrence mode is a SPEC-009 no-op with the cluster count legibly meaning "records"
(REQ-002); Locality mode collapses shared-`collectionId` occurrences to one spatially
clustered marker at the collection's real paleocoordinate with a per-locality list and
taxa panel (REQ-003); Taxon mode keeps every real occurrence point, lists one row per
in-view taxon with count + aggregate span, and focuses a selected taxon's whole point-set
(emphasis + dim, no hue identity, no fabricated glyph) routing to the taxon profile
(REQ-004); a rank selector rolls occurrences up a real ingested ancestry to a chosen rank
with a disclosed not-classified bucket (REQ-005); `collectionId`, a resolvable parent
chain, and the widened Dinosauria hierarchy are ingested and the snapshot rebuilt
deterministically within budget (DATA-001/002/003, NFR-002); all grouping is in-memory,
keyboard-accessible, within PERF-030, with no new runtime egress (NFR-001/SEC-001); and
the SPEC-009 viewport list, two-way highlighting, and the SPEC-003 selection→panel→
profile loop still pass.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Three-mode control, default Occurrences, preserves stage/viewport | automated | component test | `test/ui/grouping-mode.test.tsx` | — |
| REQ-002 | Occurrence mode == SPEC-009; cluster count = records | automated + inspection | SPEC-009 regression + component | `test/ui/occurrence-list.test.tsx`, `OccurrenceMap.tsx` | — |
| REQ-003 | Locality collapse by collectionId at real paleocoord, spatially clustered | automated | unit + component | `test/ui/grouping.test.ts`, `test/ui/locality-mode.test.tsx` | — |
| REQ-004 | In-view taxon rows + whole-taxon focus/dim; points kept | automated + inspection | unit + component + paint | `test/ui/taxon-mode.test.tsx`, `test/ui/grouping.test.ts` | — |
| REQ-005 | Rank roll-up over real ancestry + not-classified bucket | automated | unit + component | `test/ui/rank-rollup.test.ts`, `test/ui/taxon-mode.test.tsx` | — |
| DATA-001 | `collectionId` on ReadOccurrence, snapshot rebuilt | automated | type + pipeline test + rebuild | `src/pipeline/derive.ts`, pipeline tests | — |
| DATA-002 | Resolvable parent chain + real rank on ReadTaxon | automated | type + unit | `test/ui/rank-rollup.test.ts` | — |
| DATA-003 | Widened Dinosauria hierarchy ingested, deterministic | automated | pipeline test + rebuild + budget | `src/pipeline/http-client.ts`, pipeline tests | — |
| NFR-001 | In-memory O(n), keyboard, no egress | inspection + test | no-egress test + a11y lint | `test/data-005-no-runtime-egress.test.ts` | — |
| NFR-002 | Deterministic + within (re-measured) budget | automated | `check:budget` + double-rebuild diff | `scripts/check_budget.ts` | — |
| SEC-001 | No new runtime egress | automated | no-egress test | `test/data-005-no-runtime-egress.test.ts` | — |
| API-001 | Pure grouping helpers, no I/O | automated | unit test | `src/app/state/grouping.ts` | — |
| UX-001 | Domain terms, legible, states designed, no hue identity | automated + inspection | component test | `test/ui/grouping-mode.test.tsx` | — |

## Test plan

- Unit (`test/ui/grouping.test.ts`): group-by-collection fold (locality aggregates:
  paleocoordinate, distinct-taxon count, record count, Ma range) and group-by-taxon fold
  (occurrence ids, count, aggregate span); stable/deterministic ordering.
- Unit (`test/ui/rank-rollup.test.ts`): ancestor-at-rank resolver over the ingested
  ancestry (species→genus→family→clade), including missing-ancestor → not-classified
  bucket, and closed-chain (no dangling parentId).
- Component (`test/ui/grouping-mode.test.tsx`): the mode control (three options, default,
  `aria-pressed`, keyboard), stage/viewport preserved across a switch, legible labels.
- Component (`test/ui/locality-mode.test.tsx`): M markers/rows for M collections; taxa
  panel on select; single-member locality; markers use the shared clustered source.
- Component (`test/ui/taxon-mode.test.tsx`): one row per in-view taxon with count + span;
  select → focus id-set + profile route; rank selector re-groups genera into a family;
  feature count unchanged vs occurrence mode.
- Pipeline (`test/pipeline-*`): the widened pull yields multi-rank taxa with resolvable
  parents (fixture-backed); occurrence→taxon join holds; deterministic double-build diff;
  derive exposes `collectionId` + `parentId` + real `rank`.
- Budget: `pnpm run gen:web-data && pnpm run build && pnpm run check:budget` green (ceiling
  re-measured + documented if the reference grew).
- Regression: the full SPEC-009 suite (`occurrence-list`, `viewport`, `timeline-*`), the
  SPEC-003 loop tests, and the SPEC-008 timescale/atlas tests stay green with mode =
  Occurrences.
- Full CI locally: typecheck, vitest, eslint (incl. jsx-a11y), Prettier, governance scripts.

## Rollback plan

Two separable layers. **UI:** remove the grouping-mode control and rank selector and force
mode = Occurrences to return to SPEC-009 behaviour; delete `src/app/state/grouping.ts` and
the new components/tests. **Data/pipeline:** the read-model additions (`collectionId`,
`parentId`, real `rank`) are backward-compatible (older readers ignore them); to fully
revert, restore the `&rank=genus` pull in `HttpSourceClient`, revert the `derive`/`ingest`
changes, rebuild, and restore the prior `check_budget` ceilings. No time-window, basemap,
or SPEC-001 domain-shape change to undo.

## Open questions

- [x] Does the snapshot have resolvable multi-rank ancestry? **No, by our own scoping**
  (`rank=genus`); PBDB has it and already returns higher classification we discard. The
  owner directed **doing the pipeline hierarchy work in this branch** (DATA-003), not
  deferring it (decision "b", 2026-07-22).
- [x] Locality clustering at low zoom? **Spatially cluster the locality markers**, like
  occurrence points (Q2 = a, 2026-07-22).
- [x] Taxon list scope — viewport or whole age? **Viewport-linked**, SPEC-009-consistent
  (Q3 = a, 2026-07-22).
- [ ] Exact rank ladder to expose (which clade levels count as selectable "Clade" steps)
  — resolve during ingestion against what PBDB returns for Dinosauria (e.g. Family /
  Superfamily / Order / clade), so the selector is meaningful and not overlong.
- [ ] Whether to also ingest **Species**-rank taxa (for a Species step) or stop at the
  identified rank + Genus/Family/Clade — decide from the measured size cost (NFR-002).
- [ ] Exact **focus vs highlight vs selection** visual hierarchy in Taxon mode — resolve
  during design against the charter's emphasis scale.

## Human decisions required

- [x] Separate **occurrence** and **taxon** modes, taxon grouped by taxon, with a **rank
  selector inside** taxon mode — owner-directed (2026-07-22): "Il faudrait séparer un mode
  occurrence d'un mode species/taxon … groupé par species/taxon … taxon + selecteur de
  range a l'intérieur."
- [x] Taxon mode keeps the **real occurrence points** (interpretation A), rejecting a
  centroid/aggregated-glyph approach — owner confirmed "3. A".
- [x] **Also build the Locality** grouping — owner confirmed "4. Ok et on peut construire";
  locality markers are **spatially clustered** — owner confirmed "q2 a".
- [x] Taxon list is **viewport-linked** — owner confirmed "q3 a".
- [x] Do the **pipeline hierarchy work in this branch** (widen the pull) rather than
  deferring the rank selector — owner confirmed "on fait le chantier ici dans cette
  branche. (b)" (2026-07-22).
- [ ] Approve the coordinated **SPEC-008 NFR-002 budget adjustment** if `reference.json`
  outgrows its ceiling (see NFR-002), and the SPEC-008 scope amendment recording that the
  pull now spans the Dinosauria hierarchy, not genera only.
- [ ] Owner ratification of this spec's exact wording (status → Approved) before
  implementation begins (Definition of Ready).

## Conflict check

No hard conflict, but two **coordinated touches** to record on approval:

1. **SPEC-009 (extended, not reversed).** This spec re-introduces the taxon/formation
   **aggregation** SPEC-009 listed as a non-goal, but as an opt-in mode layered on top of
   SPEC-009's flat default (mode = Occurrences), not by removing the flat list — lineage
   SPEC-005 (aggregated) → SPEC-007 (removed) → SPEC-009 (flat) → SPEC-010 (aggregation as
   a mode). It reuses SPEC-009's viewport signal + two-way highlight under each mode.
2. **SPEC-008 (taxonomic scope + budget).** DATA-003 widens the SPEC-008 pull from
   "Dinosauria **genera**" to the Dinosauria **hierarchy**, and may raise the SPEC-008
   NFR-002 size ceilings. On approval this requires a **SPEC-008 Spec Amendments** entry
   (pull scope + budget), coordinated here — the time window and per-stage partitioning
   are unchanged.

It depends on SPEC-001 (read model / `collectionId` already modelled at L1; DATA-002/003
extend it additively — no SPEC-001 field is removed or repurposed), SPEC-003 (exploration
loop/panel/profile), SPEC-008 (per-stage delivery + the pull it amends), and SPEC-009
(viewport list + highlight). Run `/drift-check` after implementation.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Grouping-mode control | `ContextBar`/`GroupingModeControl`, `ExplorationView` reducer | `test/ui/grouping-mode.test.tsx` | Planned |
| REQ-002 | Occurrence mode + cluster label | `OccurrenceMap.tsx`, `OccurrenceList.tsx` | `test/ui/occurrence-list.test.tsx` | Planned |
| REQ-003 | Locality mode | `src/app/state/grouping.ts`, `OccurrenceMap.tsx`, `OccurrenceList.tsx` | `test/ui/locality-mode.test.tsx` | Planned |
| REQ-004 | Taxon mode focus/dim | `grouping.ts`, `OccurrenceMap.tsx`, `OccurrenceList.tsx`, `ExplorationView.tsx` | `test/ui/taxon-mode.test.tsx` | Planned |
| REQ-005 | Rank roll-up | `grouping.ts` (ancestor-at-rank), rank selector control | `test/ui/rank-rollup.test.ts` | Planned |
| DATA-001 | `collectionId` on read occ | `src/domain/snapshot.ts`, `src/pipeline/derive.ts` | pipeline tests | Planned |
| DATA-002 | Parent chain + rank on read taxon | `src/domain/snapshot.ts`, `src/pipeline/derive.ts` | `test/ui/rank-rollup.test.ts` | Planned |
| DATA-003 | Widened hierarchy pull | `src/pipeline/http-client.ts`, `ingest.ts` | pipeline tests | Planned |
| NFR-001 | In-memory/a11y | `grouping.ts`, components | inspection + no-egress | Planned |
| NFR-002 | Deterministic + budget | `scripts/check_budget.ts`, pipeline | budget gate + double build | Planned |
| SEC-001 | No runtime egress | `src/pipeline/http-client.ts` | `test/data-005-no-runtime-egress.test.ts` | Planned |
| API-001 | Grouping helpers | `src/app/state/grouping.ts`, `src/read/api.ts` | `test/ui/grouping.test.ts` | Planned |
| UX-001 | States/language | components, `exploration.module.css` | `test/ui/grouping-mode.test.tsx` | Planned |

## Implementation notes

Filled during implementation (see PR). Anticipated decisions: modes live in the
`ExplorationView` reducer (`mode: 'occurrence' | 'locality' | 'taxon'`, `rank`); grouping
is a pure module (`src/app/state/grouping.ts`) unit-tested without React; the map is fed
either the occurrence feature collection (occurrence/taxon modes) or a per-collection
locality feature collection (locality mode), both through the existing clustered source;
taxon focus is a **set** of occurrence ids driving a dim-others paint expression
(extending the SPEC-009 selected/highlighted paint), not a new colour scale. Pipeline:
prefer the fewest new PBDB calls — first consume the `show=class` classification already
returned on occurrences and add parent taxa only where needed to close the chain; keep
the per-interval deterministic merge; re-measure the reference budget and document any
raised ceiling.

## Spec amendments

> Required for any behavioral change after the spec is Approved.

### AMEND-001

- **Date:**
- **Reason:**
- **Changed requirements:**
- **Behavioral impact:**
- **Test impact:**
- **Human approval reference:**

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [x] Open questions are resolved or explicitly deferred (the three decision questions are
      resolved; the remaining items are implementation-time details, explicitly deferred).
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed (extends SPEC-009; coordinated SPEC-008 amendment for scope
      + budget; additive to SPEC-001 read model).
- [ ] Human approval recorded before status set to Approved (owner-directed the work;
      spec wording awaiting owner ratification).
