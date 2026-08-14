---
doc_type: spec
spec_id: SPEC-026
title: Exploration sidebar redesign — one unit selector, one list, one detail
status: Draft
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components:
  [
    src/app/components/ExplorationView.tsx,
    src/app/components/GroupingControls.tsx,
    src/app/components/GroupedList.tsx,
    src/app/components/GroupedPanels.tsx,
    src/app/components/OccurrenceList.tsx,
    src/app/components/OccurrencePanel.tsx,
    src/app/components/exploration.module.css,
    src/app/state/exploration.ts,
    src/app/state/grouping.ts,
  ]
affected_interfaces:
  [rendered-DOM, accessible-names, ExplorationState, ExplorationAction]
supersedes: []
superseded_by:
depends_on: [SPEC-003, SPEC-009, SPEC-010, SPEC-013, SPEC-015, SPEC-017]
conflicts_with: [SPEC-010, SPEC-021]
last_verified_at: 2026-08-14
---

# SPEC-026: Exploration sidebar redesign — one unit selector, one list, one detail

## Summary

The sidebar asks the user "what is a row?" with **two** controls (a three-way
Occurrences/Localities/Taxa segmented control, plus a rank dropdown that only
appears inside Taxa mode), then answers with **three** near-duplicate list/panel
pairs that have drifted apart, and when you pick something it **stacks** a detail
panel on top of the list inside a 360 px scroll column, pushing away the list you
were reading. This spec collapses that into one flat unit selector — **Occurrence
· Locality · Genus · Family · Major group** — one list whose chrome is identical
for every unit and whose row body is not, and a detail that **replaces** the list
with a one-action way back. It also fixes two defects the redesign exposed on real
data: at the default genus tier the *not classified* bucket holds 2,898 of 5,064
Maastrichtian records yet sorts to row 380, past the 300-row render cap — so the
charter's "never hidden" disclosure is currently hidden — and alphabetical
ordering plus that same cap hides *Triceratops* and *Tyrannosaurus* from the
genus list entirely. No data, pipeline, map or snapshot change.

## Context

The sidebar is `<aside class={styles.sidebar}>` in
`src/app/components/ExplorationView.tsx:515-610`, a 360 px column
(`exploration.module.css:742`, `width: 360px; max-width: 42vw; overflow-y: auto`)
built up in four layers:

- **SPEC-009** gave it a deliberately flat, viewport-linked occurrence list with
  a render cap (`LIST_RENDER_CAP = 300`, `OccurrenceList.tsx:23`), an overflow
  line, and a two-way map↔list highlight.
- **SPEC-010** added the grouping modes and the taxon-rank roll-up, delivering
  `GroupingControls.tsx` (segmented control + a `<select>` that renders only when
  `mode === "taxon"`), `GroupedList.tsx` (`LocalityList`, `TaxonList`) and
  `GroupedPanels.tsx` (`LocalityPanel`, `TaxonPanel`) beside the pre-existing
  `OccurrenceList` / `OccurrencePanel`. Its AMEND-001 moved the cluster-count
  disclosure to a DOM legend in the map pane — a map concern, untouched here.
- **SPEC-013** routes a chosen search result into this column as a selected taxon
  (`selectSearchTaxon`), not straight to the profile.
- **SPEC-015 / SPEC-017** established the clade tints as the product's clade code
  and, by SPEC-017 AMEND-001, took them off the map alone.

Owner feedback, 2026-08-14, verbatim: *"We need to rethink and redesign the
sidebar with occurence/genus/family it's a mess as it is."*

The three code-level observations behind this spec were verified in the source on
2026-08-14 and are recorded in *Diagnosis* below rather than asserted as
requirements.

## Problem statement

Five separate problems share one surface.

**1 — Two controls, one question.** `GroupingControls.tsx` renders a segmented
control (Occurrences / Localities / Taxa) and then, only when Taxa is active, a
second `<select>` labelled "Group by rank" offering Genus / Family / Major group
(`RANK_TIERS`, `grouping.ts:26`). Genus, Family and Major group are not a
different *kind* of choice from Occurrences and Localities — they are three more
answers to "what is one row?". The third segment secretly spawns a dropdown, the
control area reflows when it does, and the user has to learn that "Taxa" is a
container for a hidden second decision.

**2 — Selection stacks on top of the list.** In every mode the detail panel is
rendered as a *sibling above* the list inside the same scrolling column
(`ExplorationView.tsx:535-607`). Picking a row pushes the list down by the height
of a panel, so the user loses their place in the thing they were reading, in a
column only 360 px wide.

**3 — Three list/panel pairs that have drifted.** Comparing `GroupedListHeader`
(`GroupedList.tsx:30-56`) with the inline header in `OccurrenceList.tsx:86-104`,
the same header exists twice with different code. The consequences are real, not
cosmetic:

- `OccurrenceList` has hover linkage (`onHover`, `data-highlighted`, and
  `scrollIntoView` for the highlighted row). `LocalityList` and `TaxonList` have
  **none** — so SPEC-010 REQ-004's explicit requirement that "hovering a taxon
  row emphasises that taxon's points and vice-versa" is **not implemented**.
- `OccurrenceList` keeps the selected row rendered even past the cap
  (`OccurrenceList.tsx:75-82`). `LocalityList` / `TaxonList` do not.
- `LocalityList` has an empty-in-view state (`GroupedList.tsx:73-80`).
  `TaxonList` does not: with no taxa in the viewport it renders a header reading
  `0` above an empty `<ul>`.
- The count nouns are `occurrence(s)`, `locality(ies)`, `taxon(a)` — three
  different parenthetical plural spellings for the same sentence shape.

**4 — The mandated disclosure is hidden by the cap.** `groupByTaxon`
(`grouping.ts:228-231`) sorts the *not classified* bucket **last**. On the shipped
Maastrichtian snapshot at the default genus tier there are **379 groups** and the
bucket holds **2,898 of 5,064 records (57 %)** — so it sits at position 380, and
`LIST_RENDER_CAP = 300` slices it away. SPEC-010 REQ-005 and charter §2 require it
to be disclosed, never silently dropped; today, at the default tier and the
default viewport, it is not on screen at all.

**5 — Alphabetical order plus a cap truncates arbitrarily.** Classified groups
are sorted by name (`grouping.ts:230`), localities by `collectionId`
(`grouping.ts:185-191`, effectively arbitrary). With 379 genera and a 300-row cap,
*Triceratops* (165 occurrences, the largest group at this age) and
*Tyrannosaurus* (83) both fall past the cap and never render.

## Diagnosis — checked against the source, 2026-08-14

The orchestrator's hypothesis was three points; two are confirmed as stated, one
is confirmed and larger than described, and two further defects were found.

| Hypothesis | Verdict |
| ---------- | ------- |
| Mode and rank are two controls answering one question | **Confirmed** — `GroupingControls.tsx:52-68` |
| Selection stacks a panel above the list in a 360 px scroll column | **Confirmed** — `ExplorationView.tsx:535-607` |
| The three list/panel pairs have drifted | **Confirmed and worse** — the drift includes a missing SPEC-010 REQ-004 behaviour (hover linkage), a missing empty-in-view state, and a missing keep-selected-row-rendered rule |
| *(new)* The not-classified bucket is cut off by the render cap | Found here |
| *(new)* Name ordering plus the cap hides the two largest genus groups | Found here |

**On the proposed direction — adopted, with two corrections.** A single flat unit
set and one list component are right, and the two things the orchestrator asked
to be checked before adopting both check out:

- **Reducer state.** `ExplorationState` (`src/app/state/exploration.ts:48-70`)
  holds `mode` and `rank` as separate fields, and the pair `(mode, rank)` maps
  **one-to-one** onto the five flat units — `occurrence`, `locality`,
  `(taxon, genus)`, `(taxon, family)`, `(taxon, majorGroup)`. Nothing downstream
  needs a `mode` without a `rank` or vice versa: `groupByTaxon` always takes both,
  and `OccurrenceMap` takes only `mode`. So flattening loses no state the reducer
  needs, provided both fields are still set atomically (API-001 keeps both fields
  and adds one action rather than deleting them, so `OccurrenceMap`,
  `groupByLocality`, `groupByTaxon` and `selectSearchTaxon` keep their current
  contracts). The one behaviour that *is* lost is that the remembered rank
  survives a trip through Occurrences and back — recorded as an accepted
  trade-off in *Open questions* (OQ-1), because the tier is now one visible click
  either way.
- **Replace vs. stack, and the map/sidebar loop.** Replace does not hurt the core
  loop, for a reason specific to this app: the map is a *different pane*, so
  replacing the list changes nothing about what the map shows. SPEC-010's own
  implementation note justifies the panel-instead-of-navigate choice as keeping
  the taxon focus/dim observable — and replacing the list keeps the map exactly as
  visible as stacking did, while giving the detail room. When the selection
  arrives *from the map*, showing the detail is what the user asked for; when it
  arrives from a row, the way back must be one action **and** must restore the
  scroll position and mark the row, which is REQ-003's acceptance criterion.

Two corrections to the proposed direction:

1. **The unit selector must not disappear inside the detail.** Replace-not-stack
   only works if the user can still see what a row is and what list they will
   return to. REQ-003 therefore pins the selector plus a back link that *names*
   the list ("← 379 genera in view").
2. **Flattening alone does not fix the mess.** Two of the five problems above
   (the buried bucket, the arbitrary truncation) are ordering defects that a new
   control would leave in place. REQ-004 and REQ-005 fix them.

## Goals

- Replace mode + rank with **one selector over five units**, always in the same
  place, in every state.
- Render every unit through **one list component** whose header, count, cap
  behaviour, empty-in-view state and highlight linkage are shared code.
- Make a selection **replace** the list in the same column, with the selector and
  a naming back link retained, and a one-action return that restores position.
- **Pin the not-classified bucket** so it can never be truncated.
- **Order rows by count** so the render cap cuts the rare tail.
- Close the drift: hover linkage, empty-in-view and keep-selected-rendered
  behave the same for every unit.
- Keep every SPEC-010 and SPEC-009 behaviour that is not explicitly amended here.

## Non-goals

- **No change to the map.** No marker, cluster, paint, focus/dim, legend or
  accessible-name change. SPEC-021 owns the cluster disclosure; this spec must
  not touch it.
- **No change to the data layer** — no snapshot field, no pipeline step, no
  `ReadOccurrence` / `ReadTaxon` change, no rebuild.
- **No change to the roll-up itself.** `resolveTierTaxon`, `MAJOR_GROUP_NAMES`
  and the three-tier ladder are unchanged; only how the tier is *chosen* and how
  the resulting groups are *ordered and presented* changes.
- **No consolidation of the three selection ids** into a single
  `selection: {unit, key}` field. It is tempting and it would be behaviour-
  preserving, but it is not needed by anything here, and CLAUDE.md forbids
  opportunistic refactors. Recorded for a future spec.
- **No new unit.** No Formation unit, no Species tier (SPEC-010 REQ-005 settled
  the ladder), no multi-select, no set operations.
- **No search, filter or sort control in the sidebar.** Row ordering is fixed by
  REQ-005, not user-chosen.
- **No change to `LIST_RENDER_CAP`'s value or the overflow wording.**
- **No URL/deep-link state** (SPEC-009 assumption A-2 still stands).
- **No change to the taxon profile, the taxonomy screen or the occurrence
  panel's field set** — only where the occurrence panel is rendered changes.

## Users or actors

The **Explorer** (charter §1), including keyboard and screen-reader users, at the
"map → occurrence → taxon" step of the loop. Secondarily a **reviewer** checking
the shipped column against SPEC-009/010 requirements.

## Functional requirements

### REQ-001: One unit selector over five flat units

- **Statement:** The sidebar must present exactly **one** always-visible control
  for the list's row unit, offering five options in one flat set, in this order:
  **Occurrence**, **Locality**, **Genus**, **Family**, **Major group**. Choosing
  an option must set the grouping mode and, for the three taxonomic options, the
  rank tier **in a single action** (API-001). No second control may appear,
  disappear, or change size as a result of the choice; the option set is
  identical in every state of the column. The active option must be conveyed by
  **text weight and a rule, plus its accessible state** (`aria-checked` on a
  radio group, or `aria-pressed` on buttons) — never by colour alone (PERF-250).
  The control must be fully keyboard-operable with a visible focus ring, each
  option a target of at least 24 × 24 CSS px (PERF-120). The default on load is
  **Occurrence** (SPEC-010 REQ-001's default, unchanged). In the loading and
  error states the options are **disabled with the current choice still legible**
  (charter §7), not hidden.
- **Rationale:** Mode and rank were two controls answering one question, and the
  rank `<select>` existed only inside one segment, so the third option behaved
  differently from the other two. One flat set makes the question — "what is one
  row?" — answerable in one click, and removes a control that appears and
  disappears under the user's cursor.
- **Acceptance criteria:**
  - The column renders exactly one control for the row unit, with five accessible
    options named `Occurrence`, `Locality`, `Genus`, `Family`, `Major group`.
  - No element with an accessible name matching `/group by rank/i` exists in any
    state.
  - On load, `Occurrence` is the active option and the list is the occurrence
    list.
  - Activating `Family` sets mode = taxon and rank = family in one dispatch, and
    the list re-renders with family rows; the stage, the map viewport and the map
    feature set are unchanged.
  - The active option is identifiable from the accessibility tree without colour
    (`aria-checked`/`aria-pressed`) and from the text (weight + rule).
  - Every option is reachable and operable by keyboard, and each has a rendered
    box at least 24 px in each dimension.
  - In the loading and the error state the five options are present and
    `disabled`/`aria-disabled`, with the active one still identifiable.
- **Verification method:** automated component test + inspection.
- **Evidence location:** `test/ui/grouping-mode.test.tsx`,
  `src/app/components/GroupingControls.tsx`.

### REQ-002: One list component — invariant chrome, variant row body

- **Statement:** All five units must render through **one** list component. The
  following are shared code and must behave identically for every unit: the
  region and its accessible name, the count line, the viewport-vs-age wording,
  the render cap and its overflow line, the empty-in-view state, the
  keep-the-selected-row-rendered rule, and the two-way highlight linkage
  (REQ-006). Only the **row body** varies, and it varies in content, not in
  structure: every row is a name line plus a meta line, and is a single
  keyboard-operable control.
  - **Occurrence** row: taxon name (italic, CONS-350); meta = Ma range · formation
    · collection name.
  - **Locality** row: collection name; meta = distinct-taxon count · occurrence
    count · formation · Ma range (SPEC-010 REQ-003's distinct-taxon count is
    preserved).
  - **Genus / Family / Major group** row: taxon name (italic); meta = occurrence
    count · clade name · aggregate Ma range (SPEC-010 REQ-004's count + aggregate
    span are preserved).

  The count line states the unit's plural noun as a whole word — `379 genera in
  view`, `2,439 localities in view`, `5,064 occurrences in view` — replacing the
  `occurrence(s)` / `locality(ies)` / `taxon(a)` parenthetical forms. A value
  that is absent renders an explicit label (`Formation not recorded`), never a
  blank (charter §2, FONC-490).
- **Rationale:** Three near-duplicate implementations drifted into three
  different behaviours, one of which silently dropped a SPEC-010 requirement. One
  component makes divergence impossible and makes the row body the only place a
  unit is allowed to differ.
- **Acceptance criteria:**
  - `LocalityList`, `TaxonList` and `OccurrenceList` no longer exist as three
    separate list implementations; one component renders all five units.
  - For each of the five units: the list region has an accessible name, the count
    line states the count and the plural noun, and an over-cap set produces the
    overflow line.
  - For each of the five units: an age with records and an empty viewport
    produces the empty-in-view state with its recovery action (today `TaxonList`
    produces an empty `<ul>` instead).
  - A locality row states its distinct-taxon count; a taxon row states its
    occurrence count and aggregate Ma range.
  - An occurrence with no formation renders `Formation not recorded`.
  - No rendered text matches `/occurrence\(s\)|locality\(ies\)|taxon\(a\)/`.
- **Verification method:** automated component test.
- **Evidence location:** `test/ui/grouping-mode.test.tsx`,
  `test/ui/occurrence-list.test.tsx`, `test/ui/locality-mode.test.tsx`,
  `test/ui/taxon-mode.test.tsx`.

### REQ-003: A selection replaces the list; the way back is one action and restores position

- **Statement:** Activating a row, or selecting the corresponding object on the
  map, must **replace the list with the detail view in the same column** — the
  detail must not be stacked above, below, or beside the list. While a detail is
  open the column must still show (a) the REQ-001 unit selector, unchanged and
  still operable, and (b) a **back control whose accessible name states the list
  it returns to**, e.g. "Back to 379 genera in view". Activating back, or pressing
  `Escape` while focus is inside the column, must clear the selection, restore the
  list **scrolled to the previously selected row**, mark that row with
  `aria-current="true"`, and move keyboard focus to it. Opening a detail must move
  focus to the detail's heading and the detail must be a labelled region. Changing
  the unit while a detail is open returns to the list under the new unit (the
  existing "selections that no longer map are cleared" rule,
  `exploration.ts:131-134`). The detail's contents are the current
  `OccurrencePanel` / `LocalityPanel` / `TaxonPanel` contents, unchanged except
  for the close control becoming the named back control.
- **Rationale:** A detail stacked above the list pushes the list out of a 360 px
  scroll column, so the user loses the list they were reading. Replacing is safe
  here specifically because the map is a separate pane: the taxon focus/dim that
  SPEC-010 relies on staying observable is unaffected, and the loop
  map → occurrence → taxon is a sequence of steps, not a comparison of rows.
  Restoring scroll and focus is what keeps the "≤1 action back" contract
  (FONC-1080) honest.
- **Acceptance criteria:**
  - With a row selected, the list rows are **not** in the document, and the
    detail region is.
  - The unit selector is present and operable while the detail is open.
  - A control exists whose accessible name matches `/back to .* in view/i`.
  - Activating it (and, separately, pressing `Escape`) restores the list, and the
    previously selected row carries `aria-current="true"` and holds focus.
  - Selecting a point on the map opens the same detail in the same way, and the
    map's rendered feature set and focus/dim expression are unchanged by the
    swap.
  - Opening a detail moves focus to its heading; the detail is a region with an
    accessible name.
  - A SPEC-013 search result still lands as a selected taxon in this column —
    i.e. as the detail — not on the profile screen.
- **Verification method:** automated component test + inspection.
- **Evidence location:** `test/ui/occurrence-list.test.tsx`,
  `test/ui/taxon-mode.test.tsx`, `test/ui/locality-mode.test.tsx`,
  `test/ui/spec013-search-ui.test.tsx`.

### REQ-004: The not-classified bucket is pinned and can never be truncated

- **Statement:** When grouping at Genus, Family or Major group, the *not
  classified at this level* bucket (SPEC-010 REQ-005, `NOT_CLASSIFIED_KEY`) must
  be rendered **outside the render cap**, pinned directly below the count line
  and above the capped rows, whenever it is non-empty. It must state its
  occurrence count **and its share of the records in view** (e.g. "2,898
  occurrences · 57 % of the records in view"). Its status must be carried by a
  non-colour-only cue (a labelled marker plus its own wording, with the charter's
  muted-amber "incomplete / attention" hue as reinforcement only). When it is
  empty it must not render at all. Its detail view (REQ-003) must state why there
  is no single taxon profile **and offer a recovery**: a control that switches to
  the next coarser unit and names what that costs (e.g. "Group by family instead
  — 39 % unclassified").
- **Rationale:** On the shipped snapshot at the default tier the bucket is the
  largest group in the atlas (2,898 of 5,064 records) and sorts to position 380,
  behind a 300-row cap — so charter §2's "shown plainly, never hidden" and
  SPEC-010 REQ-005's "never silently dropped" are both violated today at the
  default settings. Pinning is the only fix that is independent of ordering, the
  cap value and the viewport.
- **Acceptance criteria:**
  - With more groups than the cap and a non-empty bucket, the bucket row is in
    the document and is not one of the capped rows.
  - The bucket row states its count and its percentage share of the in-view
    records.
  - With an empty bucket, no bucket row renders.
  - The bucket's state is legible in words and in shape, not by hue alone.
  - The bucket's detail offers a control that switches to the next coarser unit,
    and states that unit's unclassified share.
  - In Occurrence and Locality units no bucket row renders (there is no roll-up).
- **Verification method:** automated component test + unit test.
- **Evidence location:** `test/ui/taxon-mode.test.tsx`, `test/ui/grouping.test.ts`.

### REQ-005: Rows are ordered by count, descending, with a deterministic tie-break

- **Statement:** Locality rows and taxon rows (all three tiers) must be ordered by
  their **count descending** — occurrence count for taxa, distinct-taxon count for
  localities — with ties broken by name ascending and, if names collide, by the
  stable id (`collectionId` / taxon id) ascending, so the order is fully
  deterministic. Occurrence rows keep their current order (a flat record list has
  no count to sort by). The ordering must be produced by the pure functions in
  `src/app/state/grouping.ts`, not by the component.
- **Rationale:** With a 300-row render cap, the order decides what is *not* shown.
  Alphabetical ordering makes that arbitrary: on the shipped Maastrichtian
  snapshot the two largest genus groups — *Triceratops* (165) and *Tyrannosaurus*
  (83) — both fall past the cap and never render, and locality rows are ordered by
  `collectionId`, which carries no meaning at all. Count-descending makes the
  truncated tail the rare tail, which is also what the existing overflow line
  ("zoom in to narrow the view") implies.
- **Acceptance criteria:**
  - `groupByTaxon` returns classified groups in count-descending order, ties by
    name then id; the same fold twice returns the identical order.
  - `groupByLocality` returns localities in taxon-count-descending order, ties by
    name then `collectionId`.
  - In the genus list over the shipped stage fixture, the highest-count group is
    the first row.
  - The not-classified bucket's position is set by REQ-004, not by this ordering.
- **Verification method:** automated unit test.
- **Evidence location:** `test/ui/grouping.test.ts`.

### REQ-006: Two-way map↔list highlight works in every unit

- **Statement:** The SPEC-009 REQ-004 / SPEC-010 REQ-004 transient highlight must
  work for **all five units**, not only Occurrence: hovering or focusing a row
  must report the row's occurrence-id set upward so the map can emphasise those
  points, and a highlight arriving from the map must mark the corresponding row
  (`data-highlighted`) and scroll it into view. Highlight remains weaker than
  selection and must never be the only cue. A row whose group is entirely outside
  the current viewport is not rendered, so no highlight is possible for it.
- **Rationale:** SPEC-010 REQ-004 states the coupling as a requirement
  ("hovering a taxon row emphasises that taxon's points and vice-versa"), and it
  was not implemented — `LocalityList` and `TaxonList` take no `onHover` prop at
  all. Consolidating to one list component (REQ-002) is the moment this is fixed,
  and leaving it out would ship a component that knowingly drops a live
  requirement.
- **Acceptance criteria:**
  - Hovering and focusing a row in each of the five units invokes the hover
    callback with the row's id(s), and leaving/blurring clears it.
  - A row matching the incoming highlight id carries `data-highlighted="true"`
    in each of the five units.
  - Selection (`aria-current`) and highlight (`data-highlighted`) remain
    distinct attributes and distinct visual states.
- **Verification method:** automated component test.
- **Evidence location:** `test/ui/occurrence-list.test.tsx`,
  `test/ui/taxon-mode.test.tsx`, `test/ui/locality-mode.test.tsx`.

## Non-functional requirements

### NFR-001: Still pure, in-memory and inside PERF-030

- **Statement:** Every derivation the redesign adds — the unit→(mode, rank)
  mapping, the count-descending ordering, the bucket's share percentage — must be
  a pure in-memory computation over the already-loaded stage, with no I/O, and a
  unit switch, a selection, a back, or a pan/zoom must complete well within
  PERF-030 (≤ 1 s) at MVP volume (5,064 occurrences / 2,439 localities / 379
  genus groups in the largest shipped stage). Ordering is an O(n log n) sort over
  groups, not over occurrences.
- **Rationale:** SPEC-010 NFR-001 and SPEC-002 NFR-001 budgets, unchanged.
- **Acceptance criteria:** No network request is issued on a unit switch, row
  activation, back, hover or pan/zoom; the grouping functions remain pure and
  synchronous; the existing no-egress test stays green.
- **Verification method:** automated test + inspection.
- **Evidence location:** `test/data-005-no-runtime-egress.test.ts`,
  `src/app/state/grouping.ts`.

### NFR-002: Keyboard, focus and contrast

- **Statement:** The whole column must be operable by keyboard alone: the unit
  selector is a single tab stop with arrow-key movement between options (radio
  semantics) or five tab stops with `aria-pressed` (button semantics); rows are
  buttons; opening a detail moves focus to its heading and closing returns focus
  to the originating row. No focus may be lost to the document body during the
  list↔detail swap. All text and UI meet WCAG 2 AA contrast (4.5:1), and the axe
  gate must stay clean, including the new left rules and the disabled selector
  state.
- **Rationale:** Charter §7, PERF-220…270, and SPEC-003 AMEND-002's rule that
  accessibility wins over the aesthetic hex. A replace-not-stack interaction is
  exactly the kind that strands screen-reader focus if it is not specified.
- **Acceptance criteria:** `pnpm exec playwright test a11y` passes; the jsx-a11y
  lint rules pass; a component test asserts focus lands on the detail heading on
  open and on the originating row on back.
- **Verification method:** automated (axe e2e + component test) + lint.
- **Evidence location:** `test/e2e/a11y.e2e.ts`,
  `test/ui/occurrence-list.test.tsx`.

### NFR-003: Tests are updated to the new surface — never skipped, weakened or deleted

- **Statement:** Every test listed in the *Test plan* must be **updated** to
  assert the redesigned surface. No test may be deleted, `.skip`-ped, `.only`-d
  around, or reduced to a no-op, and no requirement may lose its evidence
  location. Where a test's subject moves (e.g. the rank `<select>`), the test must
  assert the replacement (the `Family` option), not simply drop the assertion.
- **Rationale:** CLAUDE.md core rule. These files are the evidence trail for
  SPEC-009 REQ-003/004 and SPEC-010 REQ-001…005; dropping assertions here would
  erase the traceability the SPEC-010 amendment depends on.
- **Acceptance criteria:** `git diff -- test` introduces no `.skip`, `.only` or
  `.todo` and deletes no test file; `pnpm test` passes with no newly skipped
  tests; every SPEC-009/010 requirement still has at least one live assertion.
- **Verification method:** automated (`pnpm test`) + diff inspection at review.
- **Evidence location:** the change's diff; the CI run on the PR.

## Security and privacy considerations

### SEC-001: No new network surface

- **Statement:** This change is confined to view components, view state and CSS.
  No fetch, XHR, WebSocket, storage access, secret or token is added, and the app
  continues to read only the static snapshot already loaded (SPEC-010 SEC-001,
  DATA-005).
- **Rationale:** Preserve the static, tokenless, no-runtime-egress guarantee.
- **Acceptance criteria:** `test/data-005-no-runtime-egress.test.ts` stays green;
  the diff adds no network call.
- **Verification method:** automated test + diff inspection.
- **Evidence location:** `test/data-005-no-runtime-egress.test.ts`.

## Data model impact

**None.** No domain type, snapshot field, read-model shape, pipeline step or
budget changes, and no snapshot rebuild is required. `ReadOccurrence`,
`ReadTaxon`, `LocalityGroup` and `TaxonGroup` keep their current fields; REQ-004's
percentage and REQ-005's ordering are computed from fields that already exist.

## API impact

### API-001: One `setUnit` action; `mode` and `rank` stay in state

- **Statement:** `ExplorationState` keeps its `mode: GroupingMode` and
  `rank: RankTier` fields unchanged, so every existing consumer
  (`OccurrenceMap`'s `mode` prop, `groupByTaxon(occurrences, rank, taxaById)`,
  `groupByLocality`) keeps its contract. The view layer gains a **`ListUnit`**
  type — `"occurrence" | "locality" | "genus" | "family" | "majorGroup"` — with
  two total, pure mappings: `unitOf(mode, rank) → ListUnit` and
  `modeAndRankOf(unit) → { mode, rank }`. The reducer gains a single action
  `{ type: "setUnit"; unit: ListUnit }` that sets `mode` and `rank` together and
  clears the per-mode selections exactly as `setMode` does today; `setMode` and
  `setRank` are removed, since nothing else dispatches them. `selectSearchTaxon`
  (SPEC-013) is unchanged — it already sets mode and rank together. The three
  selection fields (`selectedOccurrenceId`, `selectedLocalityId`,
  `selectedTaxonKey`) are **not** consolidated (see Non-goals).
- **Rationale:** The flat control needs one atomic dispatch; keeping `mode` and
  `rank` in state keeps the map, the grouping folds and the search entry point
  untouched, so the blast radius is the sidebar only.
- **Acceptance criteria:** `unitOf` and `modeAndRankOf` are mutual inverses over
  all five units (property-style unit test); dispatching `setUnit` with
  `"family"` yields `mode === "taxon"` and `rank === "family"` and clears all
  three selection ids; no `setMode`/`setRank` action remains; `OccurrenceMap`'s
  props are unchanged.
- **Verification method:** automated unit test + typecheck.
- **Evidence location:** `test/ui/grouping.test.ts`,
  `src/app/state/exploration.ts`, `src/app/state/grouping.ts`.

## UI or UX impact

### UX-001: Charter compliance and every real state designed

- **Statement:** The redesigned column must use domain language only (Occurrence,
  Locality, Genus, Family, Major group, taxa, occurrences, formation, Ma — never
  "items", "records" for occurrences, or product-speak); keep teal as the only
  accent, carrying interaction and selection; keep status colour meaning-only
  (muted amber for the not-classified bucket, red for a load failure with the
  recovery action staying teal); and design **all** of these states, each legible
  in words and in shape: loading (selector disabled, choice legible), empty at
  this age with `Reset view`, error with `Retry` and the age/unit/viewport
  preserved, empty in view with a recovery action, capped/overflow, a selected-row
  detail, the not-classified bucket both as a row and opened, and real long /
  messy / missing values. The column must contain **no bordered card per row or
  per panel, no pill chips, and no sentence explaining how to read the column**;
  structure comes from hairlines, spacing and type weight. The design is bound to
  [`docs/mockups/exploration-sidebar.md`](../../mockups/exploration-sidebar.md)
  and its SVG.
- **Rationale:** Charter §2/§3/§4/§6/§7 and the anti-slop checklist, which names
  a sidebar as the likeliest place in an app to drift into cards, chips and
  captions.
- **Acceptance criteria:**
  - Each of the eight states above renders with the content the mockup page
    documents, and each is reachable in a test or a named manual check.
  - The error state's heading uses the error hue and the recovery button uses the
    accent.
  - No rendered text in the column matches `/items|insights|overview|engagement/i`.
  - A long collection name (≥ 60 characters) truncates to the column with the
    full string available as the row's `title`, and does not overlap or clip.
  - A missing formation renders `Formation not recorded`.
- **Verification method:** automated component test + inspection against the
  mockup.
- **Evidence location:** `test/ui/grouping-mode.test.tsx`,
  `test/ui/data-states.test.tsx`, `docs/mockups/exploration-sidebar.md`.

### UX-002: The clade rule on taxon and occurrence rows — **gated on OQ-2**

- **Statement:** Occurrence rows and taxon rows (all three tiers) may carry a
  2–3 px vertical rule in the row's clade tint, resolved through the existing
  `mapCladeMarkers.ts` mapping, **and the clade must also be named in words on the
  row** ("Ceratopsian", "Theropod", "Dinosaur" for the neutral fallback), so the
  tint is never the only carrier (charter §4, PERF-250). A **locality row must not
  carry a clade rule**, because a locality is a place, not a clade. This
  requirement is **gated**: it must not be implemented until the owner records a
  decision under OQ-2 / *Human decisions required*. If the owner declines, the
  requirement is struck and rows carry no tint; nothing else in this spec changes.
- **Rationale:** It ties a sidebar row to the clade-tinted marker it corresponds
  to on the map (SPEC-015), which SPEC-017 AMEND-001 already established as
  learnable across screens rather than map-only. It is also the one **additive**
  element in an otherwise subtractive spec, which is why it is gated rather than
  assumed: the owner asked for a mess to be cleaned up, not for a new signal.
- **Acceptance criteria:**
  - The owner's decision is recorded in this spec before implementation begins.
  - If adopted: every row carrying a tint also names its clade in text; locality
    rows carry no tint; every tint value comes from `CLADE_MARKERS` (no new hue);
    the axe contrast gate stays clean.
  - If declined: no tint is rendered in the column and the clade word may still
    be shown on taxon rows.
- **Verification method:** automated component test + inspection of the recorded
  decision.
- **Evidence location:** `test/ui/taxon-mode.test.tsx`,
  `src/app/components/mapCladeMarkers.ts`.

## Configuration impact

No environment variable, feature flag, build setting or budget changes. Two
view-layer constant sets change: the mode/rank pair is joined by a `ListUnit`
enum and its labels (`src/app/state/grouping.ts`), and `RANK_TIER_LABEL` is
reused for three of the five unit labels. `LIST_RENDER_CAP` keeps its value
(300). No token is added to `src/app/styles/tokens.css`; UX-002, if adopted,
consumes the existing clade tints.

## Error handling

- **Stage load failure** → the column shows the error state with `Retry`; the
  selected unit, the stage and the map viewport are preserved (FONC-1340), and
  the unit selector is visible but disabled.
- **Stage still loading** → same shape, with the progress indicator; the unit
  selector is disabled with the current choice legible.
- **Selection that no longer maps after a unit change** → cleared, list shown
  under the new unit (existing reducer behaviour, `exploration.ts:131-134`).
- **Selection that no longer exists after a stage change** → cleared, list shown
  (existing behaviour, `exploration.ts:123-130`).
- **A taxon group with no profile** (the not-classified bucket) → REQ-004's
  detail with the coarser-unit recovery, never a dead end.
- **A taxon with no Wikipedia article** → the existing disabled profile
  affordance with its reason (SPEC-014 AMEND-005), unchanged.
- **A collection with no paleocoordinate** → excluded from the map as today, still
  listed in the column (SPEC-010 error handling, unchanged).

## Edge cases

- **Exactly one row** in a unit — the count line reads `1 genus in view` (singular
  noun), no overflow line, no bucket if empty.
- **Zero classified groups, non-empty bucket** — the pinned bucket is the only
  row; the count line must not read `0` while a row is visible, so the count
  counts the bucket as a group (state which, in the implementation note).
- **The bucket is the only group at Major group tier** — same shape; it must still
  offer no coarser unit, so the recovery control is absent, not broken.
- **More groups than the cap plus a selected row past the cap** — the selected row
  stays rendered (REQ-002); when the detail is open the question is moot, and on
  back the row must be scrolled to (REQ-003).
- **A 78-character collection name** (`SDNHM Loc. 3405 - Carlsbad area, off
  College Boulevard and Palomar Airport Road`, real, in the shipped snapshot) —
  truncates with a `title`.
- **PBDB name forms** — `? Neoceratosauria indet.`, `cf. Hadrosauropodus
  langstoni`, `Hadrosauropodus langstoni n. gen. n. sp.` all render as one line
  without clipping.
- **An ootaxon under a dinosaur clade** — *Megaloolithus* (162 occurrences) is an
  egg genus whose PBDB parent chain runs through Sauropoda, so it renders as a
  "Sauropod" genus row. This is the snapshot's classification and must not be
  special-cased or hidden.
- **Escape pressed with no detail open** — no-op; it must not clear the unit or
  reset the view.
- **A unit change while the detail is open** — returns to the list, not to a
  blank column.
- **Antimeridian-wrapping viewport** — the SPEC-009 bounds handling is reused
  unchanged.

## Acceptance criteria

This spec is satisfied when: one control offers the five flat units and no rank
`<select>` exists in any state (REQ-001); one list component renders all five
units with identical chrome and a unit-specific two-line row body (REQ-002);
activating a row or a map point replaces the list with a detail that keeps the
unit selector and a naming back control, and back/`Escape` restores the list
scrolled to the row with focus on it (REQ-003); the not-classified bucket is
pinned outside the render cap, states its share, and its detail offers a coarser
unit (REQ-004); taxon and locality rows are ordered count-descending with a
deterministic tie-break (REQ-005); hover linkage works in all five units
(REQ-006); the column is keyboard-operable with no lost focus and a clean axe run
(NFR-002); every listed test is updated and none skipped or deleted (NFR-003);
`setUnit` sets mode and rank atomically with `unitOf`/`modeAndRankOf` mutual
inverses (API-001); all eight real states render per the mockup with no card,
chip or interface caption (UX-001); and the SPEC-010 AMEND-003 block below has
been transplanted with the owner's approval reference.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Five flat units, one control, no rank combobox, default Occurrence, disabled-with-choice in loading/error, non-colour-only active state | automated + inspection | `pnpm test grouping-mode` | `test/ui/grouping-mode.test.tsx` | |
| REQ-002 | One list component; identical chrome, unit-specific row body; empty-in-view in every unit; no `(s)`/`(ies)`/`(a)` plurals | automated | `pnpm test grouping-mode occurrence-list locality-mode taxon-mode` | `test/ui/grouping-mode.test.tsx`, `test/ui/occurrence-list.test.tsx`, `test/ui/locality-mode.test.tsx`, `test/ui/taxon-mode.test.tsx` | |
| REQ-003 | Detail replaces rows; selector persists; back names the list; back/Esc restores scroll, `aria-current` and focus; map selection lands the same | automated + inspection | `pnpm test occurrence-list taxon-mode locality-mode spec013-search-ui` | `test/ui/occurrence-list.test.tsx`, `test/ui/taxon-mode.test.tsx`, `test/ui/spec013-search-ui.test.tsx` | |
| REQ-004 | Bucket rendered outside the cap, states count + share, absent when empty, detail offers the coarser unit | automated | `pnpm test taxon-mode grouping` | `test/ui/taxon-mode.test.tsx`, `test/ui/grouping.test.ts` | |
| REQ-005 | Count-descending order with name-then-id tie-break, deterministic across two folds | automated | `pnpm test grouping` | `test/ui/grouping.test.ts` | |
| REQ-006 | Hover/focus reports ids and `data-highlighted` marks the row, in all five units | automated | `pnpm test occurrence-list taxon-mode locality-mode` | `test/ui/occurrence-list.test.tsx`, `test/ui/taxon-mode.test.tsx`, `test/ui/locality-mode.test.tsx` | |
| NFR-001 | Pure, no I/O on unit switch / select / back / pan | automated + inspection | `pnpm test data-005-no-runtime-egress` | `test/data-005-no-runtime-egress.test.ts` | |
| NFR-002 | Keyboard operable, focus moves to detail heading and back to the row, axe clean | automated | `pnpm test occurrence-list`; `pnpm exec playwright test a11y`; lint | `test/ui/occurrence-list.test.tsx`, `test/e2e/a11y.e2e.ts` | |
| NFR-003 | No test deleted, skipped or weakened; suite green | automated + diff review | `pnpm test`; `git diff -- test` | CI run on the PR | |
| SEC-001 | No new fetch/XHR/storage | automated + inspection | `pnpm test data-005-no-runtime-egress` | `test/data-005-no-runtime-egress.test.ts` | |
| API-001 | `unitOf`/`modeAndRankOf` mutual inverses; `setUnit` sets both and clears selections; no `setMode`/`setRank` | automated | `pnpm test grouping`; `pnpm run typecheck` | `test/ui/grouping.test.ts`, `src/app/state/exploration.ts` | |
| UX-001 | Eight states render per the mockup; domain language; no card/chip/caption; long and missing values survive | automated + inspection | `pnpm test grouping-mode data-states`; review against the mockup | `test/ui/grouping-mode.test.tsx`, `test/ui/data-states.test.tsx`, `docs/mockups/exploration-sidebar.md` | |
| UX-002 | Owner decision recorded; if adopted, tint always paired with the clade word, no tint on localities, no new hue | automated + inspection | `pnpm test taxon-mode` | `test/ui/taxon-mode.test.tsx` | |

## Test plan

Every file below **exists today and is updated, not replaced**. Paths were
confirmed on 2026-08-14.

**Component / unit (Vitest, `pnpm test`).**

| File | What it asserts today | Required change |
| ---- | --------------------- | --------------- |
| `test/ui/grouping-mode.test.tsx` | `role="group"` named `/group occurrences by/i` with buttons `Occurrences` / `Localities` / `Taxa`; `combobox` named `/group by rank/i` appears only in Taxa mode; regions `/occurrences on the map/i`, `/localities on the map/i`, `/taxa on the map/i` | Rewrite to the five-unit control (REQ-001): five options, default `Occurrence`, no combobox in **any** state, the disabled-but-legible loading/error state, and the region name per unit. Add the REQ-002 chrome-parity assertions. **Coordinate with SPEC-021**, which also edits this file (its cluster-legend assertion) — see *Conflict check* |
| `test/ui/taxon-mode.test.tsx` | Clicks `Taxa`, then the rank combobox, to reach genus/family rows; asserts `Tyrannosaurus`, `Triceratops`, `Tyrannosauridae`; selecting a taxon opens region `/taxon:/i` with `Open taxon profile` | Reach the tiers by activating the `Genus` / `Family` options. Add: the pinned bucket (REQ-004), its share, its coarser-unit recovery, count-descending order (REQ-005), hover linkage (REQ-006), and that the rows are gone once the detail is open (REQ-003) |
| `test/ui/locality-mode.test.tsx` | Clicks `Localities`; asserts region `/localities on the map/i`, a locality panel `/locality:/i`, per-taxon `Open profile`, and the profile→back loop | Reach the unit via the `Locality` option; assert the detail replaces the rows, the back control's name, hover linkage, and count-descending order |
| `test/ui/occurrence-list.test.tsx` | In-view count wording `occurrence(s) in the current map view`; hover reports the id; `aria-current` + `data-highlighted`; the fallback header `occurrence(s) at this age`; the empty-in-view message; the cap + overflow line; row → panel → `Open taxon profile` | Update the count wording to whole-word plurals (REQ-002); keep every other assertion; add the REQ-003 assertions (rows absent while the detail is open, back restores scroll + `aria-current` + focus) and the NFR-002 focus assertions |
| `test/ui/grouping.test.ts` | The locality and taxon folds and their current ordering | Add REQ-005 ordering (count-descending, tie-break, determinism across two folds) and API-001's `unitOf`/`modeAndRankOf` inverse property |
| `test/ui/rank-rollup.test.ts` | `resolveTierTaxon` over the ingested ancestry, incl. the not-classified case | **No change expected** — the resolver is untouched. Re-run as a regression guard; if it needs editing, that is a signal the change has exceeded its scope |
| `test/ui/occurrence-panel.test.tsx` | Region `/Occurrence:/i`, its field set, `Open taxon profile` | Update only if the close control's accessible name changes to the REQ-003 back control; the field assertions stay |
| `test/ui/spec013-search-ui.test.tsx` | A search result lands "in the side panel, not the profile" | Update the landing assertion to the replaced-list detail; the requirement (land in context) is unchanged |
| `test/ui/scenario-perf-370.test.tsx` | Empty state → `Reset view` → region `/occurrences on the map/i` | Update the region name if it changes; the PERF-370 scenario itself is unchanged |
| `test/ui/data-states.test.tsx` | Loading `status` + `progressbar`, `Retry`, back-to-map | Add the REQ-001 assertion that the unit selector is present-but-disabled in the loading and error states |

**End-to-end (Playwright).**

| File | What it asserts today | Required change |
| ---- | --------------------- | --------------- |
| `test/e2e/exploration.e2e.ts:44-46` | `complementary` named `/occurrence details/i` is visible | Update the landmark's accessible name if it changes (it should name the column, not one unit) |
| `test/e2e/a11y.e2e.ts` | axe over the exploration view | No edit expected, but it is a **required gate** for NFR-002 — new left rules, a disabled control and a focus-moving swap are exactly what trips axe. Must be run and reported |

**Fixtures.** No new fixture. REQ-004's "more groups than the cap" case needs a
fixture (or a lowered cap injected as a prop in the test) that produces > 300
groups; the shipped Maastrichtian stage produces 379 at genus and is the honest
source. If the jsdom harness cannot hold the full stage, the assertion is made
against the pure fold plus a component test with an injected cap — it must **not**
be resolved by skipping (NFR-003).

**Commands to run and report** (CLAUDE.md — report every command and its real
result): `pnpm run typecheck`, `pnpm test`, `pnpm exec playwright test`, plus
`python3 scripts/validate_specs.py`, `python3 scripts/validate_governance.py`,
`python3 scripts/validate_drift.py`.

## Rollback plan

Confined to view components, view state and CSS — no data, migration, storage or
network surface — so `git revert` of the squashed commit restores the previous
sidebar exactly, with no cleanup step. Partial rollback is possible along two
seams:

- **REQ-005 (ordering) and REQ-004 (pinning) are independent of REQ-001…003.**
  Either can be reverted alone by restoring the sort in `grouping.ts` and the
  bucket's place in the row list; both are pure-function changes with their own
  unit tests.
- **REQ-003 (replace) can be reverted to stacking** by rendering the detail above
  the list again, without touching the unit selector — the selector and the list
  do not depend on the swap.

REQ-001/002 revert together: the flat control and the single list component are
one refactor. If the SPEC-010 AMEND-003 block has already been transplanted, a
revert must also strike it, or SPEC-010 will describe a UI that no longer exists.

## Open questions

- [ ] **OQ-1 — the remembered rank.** Today, leaving Taxa mode and returning
      restores the last rank tier. With five flat units there is no "Taxa" to
      return to, so the tier is re-picked explicitly. Recorded as an accepted
      trade-off: the tier is one visible click either way, and the alternative
      (invisible remembered state behind a visible control) is worse. **Confirm
      or reject** — rejecting would mean keeping a separate rank control, i.e.
      not adopting REQ-001.
- [ ] **OQ-2 — the clade rule (UX-002).** Adopt the clade tint + clade word on
      taxon and occurrence rows, or ship the redesign with no tint in the column?
      This is the only additive element in the spec, which is why it is gated.
- [x] **Does flattening lose reducer state?** **No** — `(mode, rank)` maps
      one-to-one onto the five units and nothing consumes one without the other
      (see *Diagnosis*). Resolved by inspection of
      `src/app/state/exploration.ts:48-163` and `src/app/state/grouping.ts`.
- [x] **Does replace-instead-of-stack hurt the map/sidebar loop?** **No**, given
      REQ-003's conditions (selector retained, back names the list, scroll and
      focus restored). The map is a separate pane, so the focus/dim evidence that
      SPEC-010's implementation note relies on is unaffected. Resolved by
      inspection.
- [x] **Should rows carry a per-row Ma span bar?** **No** — resolved against the
      shipped snapshot: nearly every Maastrichtian row spans 66–83.6 or
      66–72.2 Ma, so a column of bars would carry no reading. The span stays a
      figure with its unit.
- [ ] **Deferred to implementation:** whether the unit selector is a radio group
      (`aria-checked`, one tab stop, arrow keys) or five `aria-pressed` buttons.
      Either satisfies REQ-001; the radio group is the better keyboard model and
      is the recommendation.
- [ ] **Deferred to implementation:** the exact accessible name of the list
      region per unit (e.g. "Genera on the map") and of the sidebar landmark. Any
      name that states the unit satisfies REQ-002; the e2e landmark assertion
      must be updated to match.

## Human decisions required

- [ ] **Approve the direction: one flat unit selector, one list, detail replaces
      the list.** This is the substance of the redesign, and it changes SPEC-010
      REQ-001/005's delivery mechanism (AMEND-003 below).

      **Answer:** _______________

- [ ] **OQ-2 — the clade rule (UX-002).** Adopt (tint + clade word on taxon and
      occurrence rows, never on localities), or decline (no tint in the column)?

      **Answer:** _______________

- [ ] **Confirm the ordering change (REQ-005).** Rows become count-ordered rather
      than alphabetical. This is what stops the render cap from hiding
      *Triceratops* and *Tyrannosaurus*, but it does change what the list looks
      like on every stage.

      **Answer:** _______________

- [ ] **Approve this spec** (status → Approved, move to `docs/specs/approved/`).

      **Answer:** _______________

## Conflict check

| Document | What overlaps or conflicts | Resolution |
| -------- | -------------------------- | ---------- |
| `SPEC-010` REQ-001 (three-mode control) | This spec replaces the three-mode control + rank `<select>` with one five-unit control | **AMEND-003** below — the *mechanism* changes, the requirement (an always-visible, keyboard-operable, non-colour-only unit control that switches list, map semantics and panel target together) is preserved |
| `SPEC-010` REQ-005 (rank selector inside Taxon mode) | The rank selector ceases to exist as a separate control; the tiers become three of the five units | **AMEND-003** — the ladder (Genus / Family / Major group, no Species), the roll-up and the not-classified bucket are all unchanged; only the control is folded in, and the bucket's placement is strengthened |
| `SPEC-010` REQ-003/REQ-004 (row contents, focus/dim) | Preserved verbatim: locality rows keep the distinct-taxon count, taxon rows keep the occurrence count and aggregate span, the map keeps every point and the focus/dim | **No conflict** — REQ-002 restates them as the row body, and REQ-006 finally implements REQ-004's hover clause |
| `SPEC-010` AMEND-001 (cluster legend in the map pane) | Untouched — it lives in the map pane, not the sidebar | **No conflict** |
| `SPEC-021` | Also edits `test/ui/grouping-mode.test.tsx`, and **already claims SPEC-010 AMEND-002** for its cluster-accessible-name change | **Coordination, not conflict.** This spec takes **AMEND-003**, the next free number. Whichever change lands second rebases its edits to that shared test file; neither may drop the other's assertions (NFR-003) |
| `SPEC-009` REQ-003/004 (viewport list, cap, overflow, highlight) | Extended, not reversed: the cap, the overflow wording and the highlight survive; REQ-006 generalises the highlight to every unit and REQ-004 exempts one row from the cap | **No conflict** — record as a coordinated extension on approval |
| `SPEC-013` REQ-004 (search lands in the side panel) | The "side panel" is now the detail that replaces the list | **No conflict** — the requirement is "land in context, not on the profile", which is preserved; the test's landing assertion is updated |
| `SPEC-003` REQ-006/007 (selection → panel → profile, ≤1 action back) | The panel moves; the loop and the one-action back are preserved and strengthened by REQ-003's focus/scroll restoration | **No conflict** |
| `SPEC-015` / `SPEC-017` AMEND-001 (clade tints) | UX-002 reuses the tints in the sidebar | **No conflict** — SPEC-017 AMEND-001 already says the tints are not map-only; UX-002 adds no hue and is gated on the owner |
| `docs/mockups/design-guidelines.md` | Binding; this spec's UX-001 is written to it | **No conflict** |

No functional-specification requirement is touched: FONC-040/050/060 (permanent
context), FONC-1080 (one action back), FONC-1280/1310/1330/1340 (states),
PERF-120/250 all remain satisfied by REQ-001…003 and UX-001. This spec has no
authority over `docs/product/functional-specification.md` and needs none.

## Required amendments to existing specs

One ready-to-transplant block. **Do not edit the target spec from this spec** —
the orchestrator transplants it into SPEC-010's `## Spec amendments` section
under the number given.

**Number chosen: AMEND-003.** AMEND-001 exists in SPEC-010 today (the cluster
legend); **AMEND-002 is already claimed by SPEC-021** (`docs/specs/active/
SPEC-021-chrome-copy-removal.md`, the block headed "For
`docs/specs/approved/SPEC-010-occurrence-locality-taxon-modes.md` — next free
number is **AMEND-002**"). AMEND-003 is therefore the next free number. If
SPEC-021 is abandoned before it lands, this block should be renumbered to
AMEND-002 rather than leaving a gap.

---

### For `docs/specs/approved/SPEC-010-occurrence-locality-taxon-modes.md` — next free number is **AMEND-003** (AMEND-001 is used; AMEND-002 is claimed by SPEC-021)

```markdown
### AMEND-003: The mode control and the rank selector are folded into one five-unit selector, and the not-classified bucket is pinned (via SPEC-026)

- **Date:** 2026-08-14
- **Reason:** Owner feedback, 2026-08-14 — "We need to rethink and redesign the
  sidebar with occurence/genus/family it's a mess as it is." As built, REQ-001's
  three-mode segmented control and REQ-005's rank `<select>` are two controls
  answering one question ("what is one row?"), and the rank control exists only
  inside one of the three segments, so it appears and disappears under the user.
  Separately, two defects were found on the shipped snapshot while redesigning:
  REQ-005's disclosed "not classified at this level" bucket sorts last and, at
  the default genus tier on the Maastrichtian stage, lands at row 380 behind the
  300-row render cap — so the disclosure this spec requires is not actually on
  screen; and alphabetical ordering plus the same cap hides the two largest genus
  groups (*Triceratops*, 165 occurrences; *Tyrannosaurus*, 83).
- **Changed requirements:**
  - **REQ-001** — the *mechanism* changes. The always-visible grouping control is
    no longer three options named Occurrences / Localities / Taxa; it is one
    control over **five** flat options — **Occurrence, Locality, Genus, Family,
    Major group** — where the last three are the REQ-005 tiers promoted to
    first-class options. Everything else in REQ-001 stands unchanged: always
    visible, default **Occurrence**, keyboard-operable, active option exposed to
    assistive tech and legible as text (never colour-only), and a change switches
    the list row unit, the map glyph/selection semantics and the panel target
    together while preserving the stage, the viewport and (where still
    meaningful) the selection.
  - **REQ-005** — the *carrier* changes and one acceptance criterion is
    strengthened. There is no longer a separate rank selector "hidden or disabled
    outside Taxon mode"; the three tiers are three of the five units, so the
    acceptance criterion "outside Taxon mode the selector is not offered" is
    struck as no longer meaningful. **Unchanged:** the ladder is still exactly
    Genus / Family / Major group with no Species, Genus is still the default
    taxonomic tier, roll-up still walks the parent chain via `resolveTierTaxon`,
    and records above the chosen tier still land in a disclosed "not classified
    at this level" bucket and are never silently dropped. **Strengthened:** that
    bucket must now be rendered **outside the list render cap**, pinned above the
    capped rows, and must state its share of the records in view — because
    sorting it last put it behind the cap at the default tier.
  - **REQ-004** — no requirement text changes, but its unimplemented hover clause
    ("hovering a taxon row emphasises that taxon's points and vice-versa") is
    delivered by SPEC-026 REQ-006. `LocalityList`/`TaxonList` as built take no
    hover callback at all; the consolidated list component restores the coupling
    for every unit.
  - **REQ-002, REQ-003, AMEND-001** — unchanged. Occurrence mode's behaviour, the
    locality collapse and its distinct-taxon count, the taxon focus/dim, and the
    map-pane cluster legend are all untouched by this amendment.
- **Behavioral impact:** The Occurrences/Localities/Taxa segmented control and
  the "Group by rank" `<select>` are replaced by one five-option selector; the
  selector no longer changes size or spawns a second control. Locality and taxon
  rows become count-ordered instead of name/id-ordered. The not-classified bucket
  moves to a pinned position above the capped rows and states its share. A
  selection replaces the list in the sidebar instead of stacking a panel above
  it. No change to the map, to clustering, to the roll-up resolver, to the read
  model, to the snapshot, or to which records are grouped where.
- **Test impact:** `test/ui/grouping-mode.test.tsx` moves from three mode buttons
  plus a rank combobox to five unit options and asserts no combobox exists in any
  state; `test/ui/taxon-mode.test.tsx` and `test/ui/locality-mode.test.tsx` reach
  their units through the new options and gain assertions for the pinned bucket,
  the ordering, the hover linkage and the replaced list;
  `test/ui/occurrence-list.test.tsx` keeps every assertion and gains the
  detail-replaces-list and focus-restoration cases; `test/ui/grouping.test.ts`
  gains the ordering and unit-mapping tests. `test/ui/rank-rollup.test.ts` is
  unchanged. No test is deleted, skipped or weakened.
- **Human approval reference:** Owner approval in session, 2026-08-14.
```

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Unit selector | `GroupingControls.tsx`, `grouping.ts` (`LIST_UNITS`, `LIST_UNIT_LABEL`) | `test/ui/grouping-mode.test.tsx` | Not started |
| REQ-002 | The one list | consolidated list component (replacing `OccurrenceList` / `GroupedList`) | `test/ui/grouping-mode.test.tsx`, `test/ui/occurrence-list.test.tsx`, `test/ui/locality-mode.test.tsx`, `test/ui/taxon-mode.test.tsx` | Not started |
| REQ-003 | Detail replaces list | `ExplorationView.tsx` (sidebar branch), `OccurrencePanel.tsx`, `GroupedPanels.tsx` | `test/ui/occurrence-list.test.tsx`, `test/ui/taxon-mode.test.tsx`, `test/ui/spec013-search-ui.test.tsx` | Not started |
| REQ-004 | Pinned bucket + recovery | list component, `GroupedPanels.tsx` (`TaxonPanel`) | `test/ui/taxon-mode.test.tsx`, `test/ui/grouping.test.ts` | Not started |
| REQ-005 | Row ordering | `grouping.ts` (`groupByTaxon`, `groupByLocality`) | `test/ui/grouping.test.ts` | Not started |
| REQ-006 | Highlight linkage | list component, `ExplorationView.tsx` (`highlightedId`) | `test/ui/occurrence-list.test.tsx`, `test/ui/taxon-mode.test.tsx`, `test/ui/locality-mode.test.tsx` | Not started |
| NFR-001 | Pure folds | `grouping.ts` | `test/data-005-no-runtime-egress.test.ts` | Not started |
| NFR-002 | Keyboard + focus | list component, `exploration.module.css` | `test/e2e/a11y.e2e.ts`, `test/ui/occurrence-list.test.tsx` | Not started |
| NFR-003 | Test discipline | — | the PR diff | Not started |
| SEC-001 | No egress | — | `test/data-005-no-runtime-egress.test.ts` | Not started |
| API-001 | `setUnit` + unit mapping | `exploration.ts`, `grouping.ts` | `test/ui/grouping.test.ts` | Not started |
| UX-001 | States + charter | `exploration.module.css`, `states.tsx` | `test/ui/grouping-mode.test.tsx`, `test/ui/data-states.test.tsx` | Not started |
| UX-002 | Clade rule (gated) | list component, `mapCladeMarkers.ts` | `test/ui/taxon-mode.test.tsx` | Blocked on OQ-2 |

## Implementation notes

To be filled during implementation. Two things to record when it happens: whether
the unit selector shipped as a radio group or as `aria-pressed` buttons (OQ-2's
deferred sibling), and how the count line counts the not-classified bucket when
it is the only group (see *Edge cases*).

## Spec amendments

> Required for any behavioral change after the spec is Approved. None yet — this
> spec is Draft.

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [x] Open questions are resolved or explicitly deferred (three resolved by
      inspection; OQ-1 and OQ-2 are owner decisions carried into *Human decisions
      required*; two are explicitly deferred to implementation with no
      requirement consequence).
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed (SPEC-010 amended via AMEND-003; SPEC-021
      coordination on the shared test file and the amendment numbering; SPEC-009
      and SPEC-013 extended, not reversed).
- [x] Risks listed — rollback plan and edge cases are present.
- [ ] Human approval recorded before status set to Approved. **Outstanding — this
      is the only Definition of Ready item not met.**
