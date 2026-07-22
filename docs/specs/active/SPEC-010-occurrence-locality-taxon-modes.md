---
doc_type: spec
spec_id: SPEC-010
title: Grouping modes — occurrences, localities & taxa (with taxon-rank rollup)
status: Draft
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, exploration-view, map-rendering, occurrence-list, context-bar, read-model, pipeline, styling]
affected_interfaces: [ReadOccurrence, ReadTaxon, ReadApi]
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
chosen rank (e.g. group by Genus instead of Species). Occurrence mode is the default and
its current behaviour is unchanged.

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

Two enabling facts from the data layer make the new modes honest and cheap:

- A **collection** already carries one real paleocoordinate (`Collection.paleo`), and
  every occurrence carries its `collectionId` at L1 (`src/pipeline/sources.ts`,
  `ingest.ts`). Collapsing co-located occurrences to one **locality** marker is therefore
  *not* inventing a position — it is the collection's own point. `derive.ts` currently
  drops `collectionId` from `ReadOccurrence` (keeping only `collectionName`), so it must
  be exposed (DATA-001).
- Every taxon already carries `parentId` at L1 (`sources.ts`, `ingest.ts`), but
  `ReadTaxon` does not expose it, so a rank roll-up has no ancestry to walk. Exposing the
  taxonomic parent linkage (DATA-002) enables the rank selector.

The owner directed this in chat (2026-07-22): separate an occurrence mode from a
**taxon** mode grouped by taxon, with a **rank selector inside** taxon mode; agreed the
map should keep the real occurrence points and make the taxon the unit of
list/selection/focus (interpretation "A", **not** a centroid glyph); and agreed to
**also build the Locality** grouping as the honest fix for the overplotting of
co-located records.

## Problem statement

There is only one way to read the map and list — as individual records. That is noisy
(one taxon repeats once per locality in the list), it makes co-located records overplot
and become individually un-clickable at high zoom, and it offers no way to ask the two
questions a paleontologist actually asks: *"what is at this place?"* (locality) and
*"where and when did this taxon live?"* (taxon). Meanwhile the spatial cluster count
(“42”) mixes records and taxa and silently reads as diversity when it only means density.

## Goals

- Add an always-visible **grouping-mode control** to the exploration view with three
  units — **Occurrences** (default), **Localities**, **Taxa** — that changes the list
  row unit, the map glyph semantics, and the selection/panel target coherently.
- Keep **Occurrence mode** behaviourally identical to today (SPEC-009), and make the
  spatial-cluster count legibly mean "records here" (density), not diversity.
- Add **Locality mode**: collapse occurrences that share a `collectionId` into one
  marker at the collection's real paleocoordinate; the list becomes one row per
  locality; selecting a locality inspects the taxa recorded there.
- Add **Taxon mode** (interpretation A): the map still plots **every** occurrence; the
  list becomes one row per taxon (name + occurrence count + aggregate Ma span);
  selecting a taxon **focuses all of its occurrences** (emphasised, the rest dimmed) and
  routes to the taxon profile (SPEC-003 loop).
- Add a **rank selector** inside Taxon mode that rolls occurrences up their taxonomic
  parent chain to a chosen rank (Species / Genus / Family / Clade), so grouping
  granularity is the user's choice.
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
  non-goals).
- **No change to the snapshot's taxonomic coverage or time window** (SPEC-008), the
  basemap frames (SPEC-004), continuous/sub-stage time (SPEC-008 REQ-002), or URL/deep-
  link state (SPEC-009 assumption A-2 stands).
- **No new spatial index** — a linear scan / hash-group over the loaded stage set is
  ample at MVP volume.

## Users or actors

The **Explorer**, including keyboard and screen-reader users. Downstream: the **pipeline
/ snapshot** (must expose two already-present L1 fields), and the **read API** consumed
by the exploration view.

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
  position. Each locality marker must convey how many records (and how many distinct
  taxa) it groups without colour-alone. The viewport-linked list must show **one row per
  locality** (collection or formation name + distinct-taxon count + the locality's Ma
  range), and selecting a locality must open a panel that lists the **taxa/occurrences
  recorded at that locality**, each row reaching the occurrence panel / taxon profile
  (SPEC-003 loop preserved). Occurrences sharing a collection but differing only in
  identification collapse into that one locality.
- **Rationale:** A collection is a real place with one real paleocoordinate, so
  collapsing to it is honest and directly fixes overplotting of co-located records; it
  answers "what is at this place?".
- **Acceptance criteria:** Given N occurrences across M collections in view, the map
  renders M locality markers at the collections' paleocoordinates and the list shows M
  rows; a marker/row for a collection with k records over j taxa reports j distinct taxa;
  a collection with no paleocoordinate is excluded from the map (as occurrences are today)
  but still reachable in the list fallback; selecting a locality lists its taxa and each
  reaches the panel/profile.
- **Verification method:** unit test (grouping fold) + component test.
- **Evidence location:** `test/ui/grouping.test.ts`, `test/ui/locality-mode.test.tsx`, `src/app/state/grouping.ts`.

### REQ-004: Taxon mode (map keeps real points; select focuses the whole taxon)

- **Statement:** In **Taxon** mode the map must continue to plot **every** occurrence at
  its real paleocoordinate (no collapsing, no centroid, no range polygon). The viewport-
  linked list must show **one row per taxon** in view (accepted scientific name + count
  of that taxon's occurrences + the taxon's aggregate Ma span across those occurrences).
  Selecting a taxon (from the list or by picking one of its points on the map) must
  **focus the whole taxon**: all of that taxon's occurrence points are emphasised and the
  rest are visibly **dimmed** (emphasis + reduced prominence, not colour-hue identity),
  and the panel/route target becomes the **taxon profile** (SPEC-003 REQ-007). The
  SPEC-009 transient hover-highlight coupling must keep working (hovering a taxon row
  emphasises that taxon's points and vice-versa), with highlight weaker than the taxon
  focus, which is weaker-or-equal to a single occurrence's selection detail.
- **Rationale:** A taxon is a distribution across many localities and stages; showing the
  real points while making the taxon the unit of list/selection/focus answers "where &
  when did this taxon live?" without fabricating geometry (owner-chosen interpretation A).
- **Acceptance criteria:** With mode = Taxa the list has one row per distinct taxon in
  view with its occurrence count and aggregate span; selecting a taxon emphasises all its
  points and dims non-members (assertable via the map paint expression / a focus id-set)
  and the panel shows the taxon profile; the map still contains one feature per
  occurrence (feature count unchanged from Occurrence mode); no per-taxon hue is assigned.
- **Verification method:** component test + unit test (per-taxon aggregation) + inspection of the map focus/dim paint.
- **Evidence location:** `test/ui/taxon-mode.test.tsx`, `test/ui/grouping.test.ts`, `src/app/components/OccurrenceMap.tsx`.

### REQ-005: Rank selector within Taxon mode

- **Statement:** While in Taxon mode the view must present a **rank selector** offering
  the taxonomic ranks available in the data (from `Species` up through `Genus`,
  `Family`, `Clade`). Choosing a rank must **roll each occurrence up its taxonomic parent
  chain to the nearest ancestor at that rank** and group the list/focus at that rolled-up
  taxon; occurrences whose identified taxon has no ancestor at the chosen rank must be
  handled by an explicit, disclosed rule (grouped under their finest available taxon, and
  counted in a stated "not classified at this rank" bucket — never silently dropped). The
  default rank must be the **finest** (the identified taxon, i.e. no roll-up), preserving
  REQ-004's behaviour. The selector must be hidden or disabled outside Taxon mode and be
  keyboard-operable with a legible current value.
- **Rationale:** Records sit at different ranks; letting the Explorer choose the grouping
  rank (e.g. collapse species into their genus) is the owner's stated requirement and the
  natural granularity control for Taxon mode.
- **Acceptance criteria:** In Taxon mode the selector lists the ranks present in the
  snapshot; default groups at the identified taxon; choosing `Genus` re-groups two
  species of one genus into a single row/focus whose count is the sum; an occurrence with
  no ancestor at the chosen rank appears in the disclosed "not classified at this rank"
  bucket rather than vanishing; outside Taxon mode the selector is not offered.
- **Verification method:** unit test (rank roll-up over a fixture ancestry) + component test.
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

## Security and privacy considerations

### SEC-001: No new egress or data source

- **Statement:** No new network calls, secrets, tokens, or data sources. The two exposed
  fields (DATA-001/002) come from the existing snapshot; all grouping is in-memory. The
  map stays self-contained (SPEC-004 SEC-001 unchanged).
- **Rationale:** Preserve the static, tokenless, no-egress guarantees.
- **Acceptance criteria:** `test/data-005-no-runtime-egress.test.ts` stays green; no new
  fetch/XHR is introduced.
- **Verification method:** automated test + inspection.
- **Evidence location:** `test/data-005-no-runtime-egress.test.ts`.

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
  share the id; the snapshot remains byte-stable across rebuilds (NFR-001 determinism).
- **Verification method:** type check + pipeline/derive unit test + snapshot rebuild.
- **Evidence location:** `src/domain/snapshot.ts`, `src/pipeline/derive.ts`, pipeline tests.

### DATA-002: Expose taxonomic parent linkage on `ReadTaxon`

- **Statement:** `ReadTaxon` must expose the taxonomic **parent linkage** needed to walk
  a taxon up to an ancestor of a chosen rank — at minimum `parentId` (present at L1;
  `derive.ts` currently omits it). The read model must let the app resolve, for any
  identified taxon, its nearest ancestor at a target rank using only in-snapshot taxa;
  where the chain is incomplete in the snapshot the roll-up rule of REQ-005 applies.
- **Rationale:** The rank selector (REQ-005) has no ancestry to roll up without it.
- **Acceptance criteria:** `ReadTaxon` includes the parent linkage; given a species whose
  genus is present in the snapshot, the app resolves the genus; the resolver is
  deterministic and does no I/O.
- **Verification method:** type check + unit test over a fixture ancestry.
- **Evidence location:** `src/domain/snapshot.ts`, `src/pipeline/derive.ts`, `test/ui/rank-rollup.test.ts`.

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
- **Acceptance criteria:** Helpers are pure and unit-tested; no new fetch/XHR; existing
  `ReadApi` egress guarantees unchanged.
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

Adds view-layer constants only (mode enum, rank ladder, default mode = Occurrences,
default rank = finest). No env vars, secrets, or feature flags.

## Error handling

- Occurrence/collection with no paleocoordinate → excluded from the map (as today);
  still reachable via the list's no-map fallback.
- Taxon whose identified rank has no ancestor at the chosen rank → the disclosed
  "not classified at this rank" bucket (REQ-005), never silently dropped.
- Incomplete ancestry in the snapshot (missing intermediate taxon) → roll-up stops at the
  finest resolvable ancestor and the record falls into the not-classified bucket for
  ranks above it.
- Mode switch with a now-meaningless selection (e.g. a single occurrence selected, then
  switching to Taxa) → selection re-mapped to its taxon where possible, else cleared with
  the list still populated.

## Edge cases

- A collection with exactly one occurrence → a locality of one (marker + one-row panel);
  must not look broken.
- A taxon with exactly one occurrence in view → one-row taxon with count 1 and a point
  Ma span.
- Two species of one genus co-located in one collection → in Locality mode one marker
  (2 taxa); in Taxon mode two rows at Species rank, one row at Genus rank.
- Very many groups in view → the SPEC-009 render cap + "showing X of Y" overflow applies
  to grouped rows too; the map stays the complete view.
- Antimeridian-wrapping viewport (west > east) → the SPEC-009 bounds handling is reused
  unchanged for both occurrence and locality glyphs.
- MVP snapshot may be effectively single-rank (dinosaur genera) → the rank selector may
  offer few ranks; see Open questions.

## Acceptance criteria

Satisfied when: an always-visible mode control switches between Occurrences (default,
behaviour unchanged), Localities, and Taxa, preserving stage + viewport (REQ-001);
Occurrence mode is a SPEC-009 no-op with the cluster count legibly meaning "records"
(REQ-002); Locality mode collapses shared-`collectionId` occurrences to one marker at the
collection's real paleocoordinate with a per-locality list and taxa panel (REQ-003);
Taxon mode keeps every real occurrence point, lists one row per taxon with count +
aggregate span, and focuses a selected taxon's whole point-set (emphasis + dim, no hue
identity, no fabricated glyph) routing to the taxon profile (REQ-004); a rank selector
rolls occurrences up to a chosen rank with a disclosed not-classified bucket (REQ-005);
`collectionId` and taxonomic parent linkage are exposed and the snapshot rebuilt
(DATA-001/002); all grouping is in-memory, keyboard-accessible, within PERF-030, with no
new egress (NFR-001/SEC-001); and the SPEC-009 viewport list, two-way highlighting, and
the SPEC-003 selection→panel→profile loop still pass.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Three-mode control, default Occurrences, preserves stage/viewport | automated | component test | `test/ui/grouping-mode.test.tsx` | — |
| REQ-002 | Occurrence mode == SPEC-009; cluster count = records | automated + inspection | SPEC-009 regression + component | `test/ui/occurrence-list.test.tsx`, `OccurrenceMap.tsx` | — |
| REQ-003 | Locality collapse by collectionId at real paleocoord | automated | unit + component | `test/ui/grouping.test.ts`, `test/ui/locality-mode.test.tsx` | — |
| REQ-004 | Taxon rows + whole-taxon focus/dim; points kept | automated + inspection | unit + component + paint | `test/ui/taxon-mode.test.tsx`, `test/ui/grouping.test.ts` | — |
| REQ-005 | Rank roll-up + not-classified bucket | automated | unit + component | `test/ui/rank-rollup.test.ts`, `test/ui/taxon-mode.test.tsx` | — |
| DATA-001 | `collectionId` on ReadOccurrence, snapshot rebuilt | automated | type + pipeline test + rebuild | `src/pipeline/derive.ts`, pipeline tests | — |
| DATA-002 | Parent linkage on ReadTaxon; ancestor resolver | automated | type + unit | `test/ui/rank-rollup.test.ts` | — |
| NFR-001 | In-memory O(n), keyboard, no egress | inspection + test | no-egress test + a11y lint | `test/data-005-no-runtime-egress.test.ts` | — |
| SEC-001 | No new egress/data | automated | no-egress test | `test/data-005-no-runtime-egress.test.ts` | — |
| API-001 | Pure grouping helpers, no I/O | automated | unit test | `src/app/state/grouping.ts` | — |
| UX-001 | Domain terms, legible, states designed, no hue identity | automated + inspection | component test | `test/ui/grouping-mode.test.tsx` | — |

## Test plan

- Unit (`test/ui/grouping.test.ts`): group-by-collection fold (locality aggregates:
  paleocoordinate, distinct-taxon count, record count, Ma range) and group-by-taxon fold
  (occurrence ids, count, aggregate span); stable/deterministic ordering.
- Unit (`test/ui/rank-rollup.test.ts`): ancestor-at-rank resolver over a fixture ancestry
  (species→genus→family→clade), including missing-ancestor → not-classified bucket.
- Component (`test/ui/grouping-mode.test.tsx`): the mode control (three options, default,
  `aria-pressed`, keyboard), stage/viewport preserved across a switch, legible labels.
- Component (`test/ui/locality-mode.test.tsx`): M markers/rows for M collections; taxa
  panel on select; single-member locality.
- Component (`test/ui/taxon-mode.test.tsx`): one row per taxon with count + span; select →
  focus id-set + profile route; rank selector re-groups species into genus; feature count
  unchanged vs occurrence mode.
- Regression: the full SPEC-009 suite (`occurrence-list`, `viewport`, `timeline-*`) and
  the SPEC-003 loop tests stay green with mode = Occurrences.
- Pipeline: derive test asserts `collectionId` + parent linkage on the read model; snapshot
  rebuild (`pnpm run snapshot`) stays byte-stable.
- Full CI locally: typecheck, vitest, eslint (incl. jsx-a11y), Prettier, governance scripts.

## Rollback plan

Additive. Data: the two exposed fields are backward-compatible additions to the read
model (older readers ignore them); no field is removed or repurposed, so the snapshot can
be rebuilt without breaking existing consumers. UI: remove the grouping-mode control and
rank selector and force mode = Occurrences to return to SPEC-009 behaviour; delete
`src/app/state/grouping.ts` and the new components/tests. No pipeline logic beyond the two
copies to undo, no basemap/time-window change.

## Open questions

- [ ] Does the current MVP snapshot actually contain **multiple taxonomic ranks with
  resolvable ancestry** (species with genus/family parents present), or is it effectively
  single-rank (dinosaur genera)? If single-rank, decide whether to ship the rank selector
  **disabled with an explanatory note** or **defer REQ-005** until the snapshot carries
  ancestry. (Needs a look at the built snapshot / owner decision.)
- [ ] Should **Locality mode still cluster localities spatially** at low zoom (localities
  can themselves overplot), or show every locality marker and rely on zoom? Proposed
  default: keep MapLibre spatial clustering of the locality markers, consistent with
  Occurrence mode.
- [ ] In Taxon mode, should the list reflect the **viewport** (taxa with a point in view,
  consistent with SPEC-009) or **all taxa at the age**? Proposed default: viewport-
  consistent with SPEC-009 (the count reads as "taxa on screen").
- [ ] Exact **focus vs highlight vs selection** visual hierarchy in Taxon mode (three
  emphasis levels now: taxon focus set, transient hover highlight, single-occurrence
  detail) — resolve during design against the charter's emphasis scale.

## Human decisions required

- [x] Separate **occurrence** and **taxon** modes, taxon grouped by taxon, with a **rank
  selector inside** taxon mode — owner-directed (2026-07-22): "Il faudrait séparer un mode
  occurrence d'un mode species/taxon … groupé par species/taxon … taxon + selecteur de
  range a l'intérieur."
- [x] Taxon mode keeps the **real occurrence points** and makes the taxon the unit of
  list/selection/focus (**interpretation A**), rejecting a centroid/aggregated-glyph
  approach — owner confirmed "3. A".
- [x] **Also build the Locality** grouping as the honest fix for overplotting of
  co-located records — owner confirmed "4. Ok et on peut construire".
- [ ] Resolve the rank-selector data question above (single-rank MVP → disable vs defer).
- [ ] Owner ratification of this spec's exact wording (status → Approved) before
  implementation begins (Definition of Ready).

## Conflict check

No hard conflict. This spec **extends** SPEC-009: it re-introduces the taxon/formation
**aggregation** SPEC-009 listed as a non-goal, but does so as an opt-in mode layered on
top of SPEC-009's flat default (mode = Occurrences), not by removing the flat list — the
lineage is SPEC-005 (aggregated list) → SPEC-007 (removed) → SPEC-009 (flat, aggregation
deferred) → SPEC-010 (aggregation as a user-selected mode). It depends on SPEC-001 (the
`collectionId`/`parentId` already modelled at L1), SPEC-003 (exploration loop/panel/
profile), SPEC-008 (stage-partitioned occurrence delivery — grouping operates per loaded
stage), and SPEC-009 (viewport list + two-way highlight, reused under each mode). It
touches SPEC-001's read model **additively** (DATA-001/002 expose existing L1 fields; no
requirement changes), so no SPEC-001 amendment is required — but `affected_interfaces`
records `ReadOccurrence`/`ReadTaxon`. Run `/drift-check` after implementation.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Grouping-mode control | `ContextBar`/`GroupingModeControl`, `ExplorationView` reducer | `test/ui/grouping-mode.test.tsx` | Planned |
| REQ-002 | Occurrence mode + cluster label | `OccurrenceMap.tsx`, `OccurrenceList.tsx` | `test/ui/occurrence-list.test.tsx` | Planned |
| REQ-003 | Locality mode | `src/app/state/grouping.ts`, `OccurrenceMap.tsx`, `OccurrenceList.tsx` | `test/ui/locality-mode.test.tsx` | Planned |
| REQ-004 | Taxon mode focus/dim | `grouping.ts`, `OccurrenceMap.tsx`, `OccurrenceList.tsx`, `ExplorationView.tsx` | `test/ui/taxon-mode.test.tsx` | Planned |
| REQ-005 | Rank roll-up | `grouping.ts` (ancestor-at-rank), rank selector control | `test/ui/rank-rollup.test.ts` | Planned |
| DATA-001 | `collectionId` on read occ | `src/domain/snapshot.ts`, `src/pipeline/derive.ts` | pipeline tests | Planned |
| DATA-002 | Parent linkage on read taxon | `src/domain/snapshot.ts`, `src/pipeline/derive.ts` | `test/ui/rank-rollup.test.ts` | Planned |
| NFR-001 | In-memory/a11y | `grouping.ts`, components | inspection + no-egress | Planned |
| SEC-001 | No egress | — | `test/data-005-no-runtime-egress.test.ts` | Planned |
| API-001 | Grouping helpers | `src/app/state/grouping.ts`, `src/read/api.ts` | `test/ui/grouping.test.ts` | Planned |
| UX-001 | States/language | components, `exploration.module.css` | `test/ui/grouping-mode.test.tsx` | Planned |

## Implementation notes

Filled during implementation (see PR). Anticipated decisions: modes live in the
`ExplorationView` reducer (`mode: 'occurrence' | 'locality' | 'taxon'`, `rank`); grouping
is a pure module (`src/app/state/grouping.ts`) unit-tested without React; the map is fed
either the occurrence feature collection (occurrence/taxon modes) or a per-collection
locality feature collection (locality mode); taxon focus is a **set** of occurrence ids
driving a dim-others paint expression (extending the SPEC-009 selected/highlighted paint),
not a new colour scale.

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
- [ ] Open questions are resolved or explicitly deferred (rank-selector data question
      still open — see Human decisions required).
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed (extends SPEC-009; additive to SPEC-001 read model).
- [ ] Human approval recorded before status set to Approved (owner-directed the work;
      spec wording awaiting owner ratification).
