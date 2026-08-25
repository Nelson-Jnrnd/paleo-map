---
doc_type: spec
spec_id: SPEC-026
title: Exploration sidebar redesign — one unit selector, one list, one detail
status: Implemented
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
with a one-action way back. Owner review of the mockup, 2026-08-14, added three
cuts: a row carries **at most two subtitles** (the clade word, the formation and
the locality's occurrence count and Ma span come off the rows and live in the
detail), a locality row must say **where it is today**, and the records that
reach no taxon at the chosen tier are **filtered out of the taxon units**
altogether rather than disclosed in a bucket — 2,898 of 5,064 Maastrichtian
records at genus. It also fixes the ordering defect the redesign exposed:
alphabetical ordering plus the 300-row render cap hides *Triceratops* and
*Tyrannosaurus* from the genus list entirely. No data, pipeline or snapshot
change; the map's rendering is unchanged, but at a taxon unit it plots the same
filtered set the list and the count are derived from (REQ-004).

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

**4 — The not-classified bucket dominates and discloses nothing usable.**
`groupByTaxon` (`grouping.ts:228-231`) sorts the *not classified* bucket **last**.
At the Maastrichtian default it holds **2,810 of 4,945 records (57 %)** and sits
at **row 358 of 358** — beyond `LIST_RENDER_CAP = 300`, so the disclosure
SPEC-010 REQ-005 and charter §2 ask for is not on screen in the shipped build
anyway. The owner's decision (2026-08-14) is not to pin it but to **remove it**:
the taxon units answer "which taxa are here?", and a row that stands for half the
stage and names no taxon is noise in that list. REQ-004 states the rule and its
scope.

**5 — Alphabetical order plus a cap truncates arbitrarily.** Classified groups
are sorted by name (`grouping.ts:230`), localities by `collectionId`
(`grouping.ts:185-191`, effectively arbitrary). Even with the bucket removed the
classified set is larger than the cap — **378 genera** on the shipped stage — so
name ordering still decides what is cut: *Triceratops* (165 occurrences, the
largest group at this age) sorts **343rd** and *Tyrannosaurus* (83) **348th**,
both past the 300-row cap, and neither renders.

**6 — Rows carry more subtitles than they can hold.** Owner review of the mockup,
2026-08-14: *"Too much noise in the list, reduce the number of subtitles. At most
two. And remove non-necessary ones like Family, it's redundant with the color code
and visible when you click on it anyway."* As drawn, a locality row carried four
values, an occurrence row three and a taxon row three. REQ-002 cuts every row to
two. Separately: *"Locality must say where it is in our current day and age
(country)"* — a locality row states a paleo-era formation and span but never says
where the place is today.

## Diagnosis — checked against the source, 2026-08-14

The orchestrator's hypothesis was three points; two are confirmed as stated, one
is confirmed and larger than described, and two further defects were found.

| Hypothesis | Verdict |
| ---------- | ------- |
| Mode and rank are two controls answering one question | **Confirmed** — `GroupingControls.tsx:52-68` |
| Selection stacks a panel above the list in a 360 px scroll column | **Confirmed** — `ExplorationView.tsx:535-607` |
| The three list/panel pairs have drifted | **Confirmed and worse** — the drift includes a missing SPEC-010 REQ-004 behaviour (hover linkage), a missing empty-in-view state, and a missing keep-selected-row-rendered rule |
| *(new)* The not-classified bucket is cut off by the render cap | Found here — and resolved by removing the bucket from the taxon units (REQ-004, owner decision 2026-08-14), not by pinning it |
| *(new)* Name ordering plus the cap hides the two largest genus groups | Found here |
| *(owner review)* Rows carry three or four subtitles; a locality never says where it is today | Confirmed against the mockup; REQ-002 |

**Measurement note — the not-classified share, 2026-08-14.** Two independent
folds over the shipped Maastrichtian snapshot agree on the magnitude and on the
conclusion:

- At the app's default settings: **2,810 of 4,945 records (57 %)** reach no genus;
  the bucket sorts last at **row 358 of 358**, past `LIST_RENDER_CAP = 300`.
- A re-fold in this session over `public/data/stage-maastrichtian.json` with the
  SPEC-014 AMEND-005 article gate lifted: **2,898 of 5,064 records (57 %)** reach
  no genus, leaving **378** classified genera; at Family **1,951 (39 %)** and at
  Major group **532 (11 %)** reach no taxon at the tier.
- One interaction worth recording, because it bounds where REQ-004 bites: with
  the article gate at its **default (on)**, the gate itself admits only
  occurrences whose taxon is a Wikipedia-documented **genus**, so the genus-tier
  bucket is empty and REQ-004 changes nothing there; the bucket is non-empty at
  the default gate at **Family (18 %)** and **Major group (3.5 %)**, and at every
  tier once "Show taxa without a Wikipedia article" is on. The figures above are
  the honest worst case, which is the one the rule is written for.

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
   the list ("← 378 genera in view").
2. **Flattening alone does not fix the mess.** The buried bucket, the arbitrary
   truncation and the crowded rows are not control problems; a new control would
   leave all three in place. REQ-002, REQ-004 and REQ-005 fix them.

## Goals

- Replace mode + rank with **one selector over five units**, always in the same
  place, in every state.
- Render every unit through **one list component** whose header, count, cap
  behaviour, empty-in-view state and highlight linkage are shared code.
- Make a selection **replace** the list in the same column, with the selector and
  a naming back link retained, and a one-action return that restores position.
- Cut every row to a name plus **at most two subtitles**, and give a locality
  row its **present-day region**.
- **Filter the not-classified records out of the taxon units**, consistently
  across the list, the count and the map, while keeping them under Occurrence and
  Locality.
- **Order rows by count** so the render cap cuts the rare tail.
- Close the drift: hover linkage, empty-in-view and keep-selected-rendered
  behave the same for every unit.
- Keep every SPEC-010 and SPEC-009 behaviour that is not explicitly amended here.

## Non-goals

- **No change to how the map renders.** No marker, cluster, paint, focus/dim,
  legend or accessible-name change. SPEC-021 owns the cluster disclosure; this
  spec must not touch it. The one map-facing change is *which occurrences are in
  the visible set at a taxon unit* (REQ-004), applied through the same seam the
  shipped article gate already uses (`gateOccurrences`), not through the map's
  own code.
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
- **No change to the taxon profile or the taxonomy screen.** The occurrence
  panel changes in exactly two ways: where it is rendered (REQ-003), and one
  added field — **Formation**, displaced from the occurrence row by REQ-002 — so
  the cut loses nothing from the product. No other field is added, removed or
  reworded.

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
  keyboard-operable control. **A row's meta line carries at most two values**
  (owner review, 2026-08-14), and exactly these:
  - **Occurrence** row: taxon name (italic, CONS-350); meta = Ma range ·
    collection name. **Formation is cut from the row** and becomes a field of the
    occurrence detail, where the explicit missing label `Formation not recorded`
    is rendered (501 of 5,064 Maastrichtian records have none).
  - **Locality** row: collection name; meta = distinct-taxon count · **present-day
    region**. SPEC-010 REQ-003's distinct-taxon count is preserved; the occurrence
    count, the formation and the Ma range are **cut from the row** and are shown
    in the locality detail, which already carries them.
  - **Genus / Family / Major group** row: taxon name (italic); meta = occurrence
    count · aggregate Ma range (SPEC-010 REQ-004's two figures, both preserved).
    **The clade word is cut from the row** — see UX-002 for the rule that keeps
    the clade legible without it.

  The **present-day region** is `ReadOccurrence.modernPosition.value.region`
  rendered **verbatim as the snapshot records it** — `Wyoming, US`, `Alberta, CA`,
  `Omnogov, MN`, `Ash Shamaliyah, SD`: a sub-national area plus an ISO-2 country
  code. It is not expanded to a country name (see *Assumptions and decisions*).
  All occurrences of a collection carry the same region, so the locality's region
  is that value; a collection with no region renders `Region not recorded`,
  though the shipped snapshot has none (100 % coverage, 41,116 occurrences).

  The count line states the unit's plural noun as a whole word — `378 genera in
  view`, `2,439 localities in view`, `5,064 occurrences in view` — replacing the
  `occurrence(s)` / `locality(ies)` / `taxon(a)` parenthetical forms. A value
  that is absent renders an explicit label, never a blank (charter §2, FONC-490).
- **Rationale:** Three near-duplicate implementations drifted into three
  different behaviours, one of which silently dropped a SPEC-010 requirement. One
  component makes divergence impossible and makes the row body the only place a
  unit is allowed to differ. The two-subtitle ceiling is the owner's: three and
  four values under a 13 px name in a 360 px column read as noise, and each value
  cut is one that the detail already states one click away. The two kept on a
  taxon row are the two SPEC-010 REQ-004 leans on (count, aggregate span); the two
  kept on a locality row are SPEC-010 REQ-003's distinct-taxon count and the
  owner's new requirement that a place say where it is today.
- **Acceptance criteria:**
  - `LocalityList`, `TaxonList` and `OccurrenceList` no longer exist as three
    separate list implementations; one component renders all five units.
  - For each of the five units: the list region has an accessible name, the count
    line states the count and the plural noun, and an over-cap set produces the
    overflow line.
  - For each of the five units: an age with records and an empty viewport
    produces the empty-in-view state with its recovery action (today `TaxonList`
    produces an empty `<ul>` instead).
  - Every row in every unit renders a name line and **exactly two** meta values;
    no row renders a third.
  - A locality row states its distinct-taxon count and its present-day region,
    and states no formation, occurrence count or Ma range.
  - A taxon row states its occurrence count and aggregate Ma range, and states no
    clade word.
  - An occurrence row states its Ma range and collection name, and states no
    formation.
  - Opening an occurrence renders a `Formation` field; for an occurrence whose
    collection records none it renders `Formation not recorded`.
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
  it returns to**, e.g. "Back to 378 genera in view". Activating back, or pressing
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

### REQ-004: The taxon units show classified taxa only — list, count and map filtered together

- **Statement:** At the **Genus**, **Family** and **Major group** units, an
  occurrence that resolves to **no** taxon at the chosen tier (`resolveTierTaxon`
  returns null — SPEC-010 REQ-005's *not classified at this level* case) must be
  **excluded from the unit's visible set**. The exclusion is applied **once**, to
  the occurrence set the unit derives everything from, so that all three surfaces
  agree:
  - the **list** contains no *not classified* row, at any position, capped or not;
  - the **count line** counts only classified groups (`378 genera in view`), and
    any in-view occurrence total the column reports at that unit counts only the
    classifying records (2,166 of 5,064 at the drawn genus scenario);
  - the **map** plots only those same records while a taxon unit is active, so a
    point on the map always has a row behind it and the two-way highlight
    (REQ-006) and map-selection (REQ-003) can never land on a record with no row.

  Switching to the **Occurrence** or **Locality** unit restores the full set:
  those records are real fossil occurrences and are listed, counted, mapped and
  openable there exactly as today. `NOT_CLASSIFIED_KEY`, `notClassifiedLabel` and
  the bucket branch of `groupByTaxon` are removed from the rendered surface; a
  taxon group is always a real taxon with a real key. The filter is a pure
  predicate over the already-loaded stage (NFR-001) and composes with the
  SPEC-014 AMEND-005 article gate rather than replacing it.
- **Rationale:** Owner instruction, 2026-08-14: the bucket must be filtered out.
  At the Maastrichtian default it holds **2,810 of 4,945 records (57 %)** and
  sorts to **row 358 of 358**, past `LIST_RENDER_CAP = 300` — so it is not on
  screen in the shipped build in any case. A taxon unit answers "which taxa are
  in view?", and a row that names no taxon is not an answer to that question.
  **This is a deliberate owner decision to stop disclosing that share of records
  in the taxon views** (it changes SPEC-010 REQ-005 and touches charter §2 —
  recorded once, in AMEND-003 below, and not re-argued here). It is bounded: the
  records are not deleted, hidden from the atlas, or dropped from any count that
  is not a taxon count — they remain in full under Occurrence and Locality, which
  is where an identification that reaches no genus is a meaningful row.
  Filtering *all three* surfaces together rather than the list alone is what
  keeps the column honest: a filtered list over an unfiltered map would show a
  count that disagrees with the points and a hover that resolves to nothing.
- **Acceptance criteria:**
  - At each of Genus, Family and Major group, no row, key or accessible name
    matches `/not classified/i`, with or without the render cap in play.
  - The taxon-unit count line equals the number of **classified** groups, and the
    occurrence total reported at that unit equals the number of records that
    resolve at the tier.
  - The map's feature set at a taxon unit equals that same record set; switching
    to Occurrence or Locality restores every record.
  - A record that resolves at no tier is present in the Occurrence list and in
    its locality's detail, and its occurrence detail opens normally.
  - `groupByTaxon` returns only groups with a non-null `taxonId`; no group has
    `notClassified: true`.
  - The filter is pure and issues no request (NFR-001, SEC-001).
- **Verification method:** automated component test + unit test.
- **Evidence location:** `test/ui/taxon-mode.test.tsx`, `test/ui/grouping.test.ts`,
  `test/ui/rank-rollup.test.ts`.

### REQ-005: Rows are ordered by count, descending, with a deterministic tie-break

- **Statement:** Locality rows and taxon rows (all three tiers) must be ordered by
  their **count descending** — occurrence count for taxa, distinct-taxon count for
  localities — with ties broken by name ascending and, if names collide, by the
  stable id (`collectionId` / taxon id) ascending, so the order is fully
  deterministic. Occurrence rows keep their current order (a flat record list has
  no count to sort by). The ordering must be produced by the pure functions in
  `src/app/state/grouping.ts`, not by the component.
- **Rationale:** With a 300-row render cap, the order decides what is *not* shown.
  The claim was re-checked against the **smaller, bucket-free set** REQ-004
  leaves behind and still holds: 378 classified genera on the shipped
  Maastrichtian stage (357 with the article gate at its default), so the cap
  still bites, and under name ordering the two largest groups — *Triceratops*
  (165 occurrences) at position **343** and *Tyrannosaurus* (83) at **348** —
  both fall past it and never render. Locality rows are ordered by
  `collectionId`, which carries no meaning at all. Count-descending makes the
  truncated tail the rare tail, which is also what the existing overflow line
  ("zoom in to narrow the view") implies.
- **Acceptance criteria:**
  - `groupByTaxon` returns classified groups in count-descending order, ties by
    name then id; the same fold twice returns the identical order.
  - `groupByLocality` returns localities in taxon-count-descending order, ties by
    name then `collectionId`.
  - In the genus list over the shipped stage fixture, the highest-count group is
    the first row, and *Triceratops* and *Tyrannosaurus* both render.
  - Every group in the ordering is a classified group (REQ-004); the sort has no
    not-classified branch left to special-case.
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
  mapping, the count-descending ordering, and REQ-004's classified-only filter —
  must be a pure in-memory computation over the already-loaded stage, with no
  I/O, and a unit switch, a selection, a back, or a pan/zoom must complete well
  within PERF-030 (≤ 1 s) at MVP volume (5,064 occurrences / 2,439 localities /
  378 classified genus groups in the largest shipped stage). Ordering is an
  O(n log n) sort over groups; the filter is one O(n) pass over occurrences that
  reuses the resolver the fold already runs.
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
`ReadTaxon` and `LocalityGroup` keep their current fields, and REQ-002's
present-day region reads `ReadOccurrence.modernPosition.value.region`, which
already exists and is populated on 100 % of the snapshot. `TaxonGroup` loses no
field either, but REQ-004 makes two of them dead weight in practice
(`notClassified` is always `false`, `taxonId` is never null); removing them is a
type-level tidy the implementation may do, not a data-model change.

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
  (muted amber for a missing value such as `Formation not recorded`, red for a
  load failure with the recovery action staying teal); and design **all** of these
  states, each legible in words and in shape: loading (selector disabled, choice
  legible), empty at this age with `Reset view`, error with `Retry` and the
  age/unit/viewport preserved, empty in view with a recovery action,
  capped/overflow, a selected-row detail (taxon, locality and occurrence), a
  disabled "no article" profile control, and real long / messy / missing values.
  The column must contain **no bordered card per row or per panel, no pill chips,
  and no sentence explaining how to read the column** — the shipped column states
  facts and states, never instructions for reading itself;
  structure comes from hairlines, spacing and type weight. The design is bound to
  [`docs/mockups/exploration-sidebar.md`](../../mockups/exploration-sidebar.md)
  and its SVG.
- **Rationale:** Charter §2/§3/§4/§6/§7 and the anti-slop checklist, which names
  a sidebar as the likeliest place in an app to drift into cards, chips and
  captions.
- **Acceptance criteria:**
  - Each of the states above renders with the content the mockup page documents,
    and each is reachable in a test or a named manual check.
  - The error state's heading uses the error hue and the recovery button uses the
    accent.
  - No rendered text in the column matches `/items|insights|overview|engagement/i`.
  - A long collection name (≥ 60 characters) truncates to the column with the
    full string available as the row's `title`, and does not overlap or clip.
  - A missing formation renders `Formation not recorded` in the occurrence
    detail.
  - A locality row renders its present-day region as the snapshot records it.
  - No rendered string in the column instructs the reader how to use the column
    (the mockup's seven such sentences were removed at owner review, 2026-08-14).
- **Verification method:** automated component test + inspection against the
  mockup.
- **Evidence location:** `test/ui/grouping-mode.test.tsx`,
  `test/ui/data-states.test.tsx`, `docs/mockups/exploration-sidebar.md`.

### UX-002: The clade rule on taxon and occurrence rows — adopted

- **Statement:** Occurrence rows and taxon rows (all three tiers) carry a 2–3 px
  vertical rule in the row's clade tint, resolved through the existing
  `mapCladeMarkers.ts` mapping. A **locality row must not carry a clade rule**,
  because a locality is a place, not a clade. The clade is **not named on the
  row**: REQ-002 caps a row at two subtitles and the owner cut the clade word as
  redundant with the tint. Two rules keep that from making colour the sole
  carrier (charter §4, PERF-250):
  1. **The row's identity is its name, not its tint.** The scientific name
     identifies the row; the tint reinforces which clade it belongs to and is
     never the only difference between two rows.
  2. **The clade is named in words within one action and without sight.** The
     row's accessible name states it ("Triceratops, Ceratopsian, 165 occurrences,
     66–83.6 Ma"), and the detail the row opens states it in visible text
     ("Ceratopsian · genus"). A tint therefore never carries a meaning that has
     no worded form.
- **Rationale:** Owner decision, 2026-08-14 (OQ-2 — "Tint"): adopt the tint, drop
  the word. It ties a sidebar row to the clade-tinted marker it corresponds to on
  the map (SPEC-015), which SPEC-017 AMEND-001 already established as learnable
  across screens rather than map-only, and it buys back the row's second subtitle
  for the two figures SPEC-010 REQ-004 requires. The charter's rule that "shape
  and name carry identity first, the tint reinforces" is satisfied by the name;
  the compensating rules above satisfy "a clade tint may never be the only way a
  clade is identified".
- **Acceptance criteria:**
  - Taxon and occurrence rows render a clade rule; every tint value comes from
    `CLADE_MARKERS` (no new hue); locality rows render none.
  - No row renders a clade word as a visible subtitle.
  - Every row carrying a tint states its clade in its accessible name, and the
    detail it opens states the clade in visible text.
  - The axe contrast gate stays clean.
- **Verification method:** automated component test + inspection.
- **Evidence location:** `test/ui/taxon-mode.test.tsx`,
  `test/ui/occurrence-list.test.tsx`, `src/app/components/mapCladeMarkers.ts`.

## Assumptions and decisions recorded

- **A-1 — the present-day region is shown as the snapshot records it.**
  `modernPosition.value.region` is present on **100 % of the 41,116 occurrences
  across all stages**, with **667 distinct values** and no collection carrying a
  conflicting region, so no pipeline work and no fallback path is needed. The
  format is a sub-national area plus an ISO-2 country code (`New Mexico, US`,
  `Alberta, CA`, `Omnogov, MN`). **Rejected alternative:** mapping the code to a
  country name would need a **95-entry** ISO-2→name table living in the view
  layer (`src/app/state/`), one of whose codes — `O2`, PBDB's open-ocean code —
  names no country at all; it would also cost row width that the long collection
  names need. Shipping the string verbatim shows the country *and* the state or
  province, invents nothing, and adds no table to maintain.
- **A-2 — what the region displaces on a locality row.** The occurrence count,
  the formation and the Ma range. All three are already in the locality detail
  (REQ-003), so nothing leaves the product; SPEC-010 REQ-003's distinct-taxon
  count stays on the row. Recorded in AMEND-003.
- **A-3 — the taxon units' filter narrows the map too.** Chosen over filtering
  the list alone, which would leave the count and the map disagreeing with the
  rows. It changes SPEC-010 REQ-004's "the map still contains one feature per
  occurrence" clause; recorded in AMEND-003.

## Configuration impact

No environment variable, feature flag, build setting or budget changes. Two
view-layer constant sets change: the mode/rank pair is joined by a `ListUnit`
enum and its labels (`src/app/state/grouping.ts`), and `RANK_TIER_LABEL` is
reused for three of the five unit labels. `LIST_RENDER_CAP` keeps its value
(300). `NOT_CLASSIFIED_KEY` and `notClassifiedLabel` (`grouping.ts`) lose their
only consumers under REQ-004. No token is added to `src/app/styles/tokens.css`;
UX-002 consumes the existing clade tints.

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
- **A record that classifies at no tier** → not an error and not a dead end: it
  is absent from the taxon units by REQ-004 and fully present under Occurrence
  and Locality.
- **A taxon with no Wikipedia article** → the existing disabled profile
  affordance with its reason (SPEC-014 AMEND-005), unchanged.
- **A collection with no paleocoordinate** → excluded from the map as today, still
  listed in the column (SPEC-010 error handling, unchanged).

## Edge cases

- **Exactly one row** in a unit — the count line reads `1 genus in view` (singular
  noun) and no overflow line renders.
- **No record classifies at the tier** (e.g. a viewport holding only
  "*Theropoda indet.*" records at the Genus unit) — the taxon unit is **empty in
  view**, not zero-with-rows: the empty-in-view state renders with its recovery
  action, and the map is empty at that unit for the same reason the list is. The
  Occurrence unit still shows every one of those records, which is the recovery
  the state points at.
- **A viewport where the only difference between units is the filter** — the
  Occurrence count and the taxon-unit occurrence total legitimately differ
  (5,064 vs 2,166 on the drawn stage); they are counts of different sets, and
  each unit reports its own.
- **More groups than the cap plus a selected row past the cap** — the selected row
  stays rendered (REQ-002); when the detail is open the question is moot, and on
  back the row must be scrolled to (REQ-003).
- **A 79-character collection name** (`SDNHM Loc. 3405 - Carlsbad area, off
  College Boulevard and Palomar Airport Road`, real, in the shipped snapshot) —
  truncates with a `title`.
- **A long region string** (`Languedoc-Roussillon, FR`) next to a long
  distinct-taxon count — the locality row's two subtitles truncate the region,
  never the count.
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
units with identical chrome and a two-line row body whose meta line carries at
most two values — Ma range · collection, taxa · present-day region, count ·
aggregate span (REQ-002); activating a row or a map point replaces the list with
a detail that keeps the unit selector and a naming back control, and
back/`Escape` restores the list scrolled to the row with focus on it (REQ-003);
the Genus, Family and Major group units contain no *not classified* row and
filter list, count and map from one set (REQ-004); taxon and locality rows are
ordered count-descending with a deterministic tie-break (REQ-005); hover linkage
works in all five units (REQ-006); the column is keyboard-operable with no lost
focus and a clean axe run (NFR-002); every listed test is updated and none
skipped or deleted (NFR-003); `setUnit` sets mode and rank atomically with
`unitOf`/`modeAndRankOf` mutual inverses (API-001); every real state renders per
the mockup with no card, chip or interface caption (UX-001); the clade tint is
carried with the compensating worded rules (UX-002); and the SPEC-010 AMEND-003
block below has been transplanted with the owner's approval reference.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Five flat units, one control, no rank combobox, default Occurrence, disabled-with-choice in loading/error, non-colour-only active state | automated + inspection | `pnpm test grouping-mode` | `test/ui/grouping-mode.test.tsx` | |
| REQ-002 | One list component; identical chrome; **exactly two** meta values per row (Ma · collection, taxa · region, count · span); no clade word or formation on a row; formation in the occurrence detail; empty-in-view in every unit; no `(s)`/`(ies)`/`(a)` plurals | automated | `pnpm test grouping-mode occurrence-list locality-mode taxon-mode occurrence-panel` | `test/ui/grouping-mode.test.tsx`, `test/ui/occurrence-list.test.tsx`, `test/ui/locality-mode.test.tsx`, `test/ui/taxon-mode.test.tsx`, `test/ui/occurrence-panel.test.tsx` | |
| REQ-003 | Detail replaces rows; selector persists; back names the list; back/Esc restores scroll, `aria-current` and focus; map selection lands the same | automated + inspection | `pnpm test occurrence-list taxon-mode locality-mode spec013-search-ui` | `test/ui/occurrence-list.test.tsx`, `test/ui/taxon-mode.test.tsx`, `test/ui/spec013-search-ui.test.tsx` | |
| REQ-004 | No `/not classified/i` row at any taxon unit; count, list and map feature set derived from the same filtered records; Occurrence/Locality keep every record | automated | `pnpm test taxon-mode grouping rank-rollup` | `test/ui/taxon-mode.test.tsx`, `test/ui/grouping.test.ts`, `test/ui/rank-rollup.test.ts` | |
| REQ-005 | Count-descending order with name-then-id tie-break, deterministic across two folds; *Triceratops* and *Tyrannosaurus* render | automated | `pnpm test grouping taxon-mode` | `test/ui/grouping.test.ts`, `test/ui/taxon-mode.test.tsx` | |
| REQ-006 | Hover/focus reports ids and `data-highlighted` marks the row, in all five units | automated | `pnpm test occurrence-list taxon-mode locality-mode` | `test/ui/occurrence-list.test.tsx`, `test/ui/taxon-mode.test.tsx`, `test/ui/locality-mode.test.tsx` | |
| NFR-001 | Pure, no I/O on unit switch / select / back / pan | automated + inspection | `pnpm test data-005-no-runtime-egress` | `test/data-005-no-runtime-egress.test.ts` | |
| NFR-002 | Keyboard operable, focus moves to detail heading and back to the row, axe clean | automated | `pnpm test occurrence-list`; `pnpm exec playwright test a11y`; lint | `test/ui/occurrence-list.test.tsx`, `test/e2e/a11y.e2e.ts` | |
| NFR-003 | No test deleted, skipped or weakened; suite green | automated + diff review | `pnpm test`; `git diff -- test` | CI run on the PR | |
| SEC-001 | No new fetch/XHR/storage | automated + inspection | `pnpm test data-005-no-runtime-egress` | `test/data-005-no-runtime-egress.test.ts` | |
| API-001 | `unitOf`/`modeAndRankOf` mutual inverses; `setUnit` sets both and clears selections; no `setMode`/`setRank` | automated | `pnpm test grouping`; `pnpm run typecheck` | `test/ui/grouping.test.ts`, `src/app/state/exploration.ts` | |
| UX-001 | Every state renders per the mockup; domain language; no card/chip/caption; long, missing and region values survive | automated + inspection | `pnpm test grouping-mode data-states`; review against the mockup | `test/ui/grouping-mode.test.tsx`, `test/ui/data-states.test.tsx`, `docs/mockups/exploration-sidebar.md` | |
| UX-002 | Tint on taxon and occurrence rows only, no new hue, no clade word on a row, clade in the accessible name and in the detail | automated + inspection | `pnpm test taxon-mode occurrence-list` | `test/ui/taxon-mode.test.tsx`, `test/ui/occurrence-list.test.tsx` | |

## Test plan

Every file below **exists today and is updated, not replaced**. Paths were
confirmed on 2026-08-14.

**Component / unit (Vitest, `pnpm test`).**

| File | What it asserts today | Required change |
| ---- | --------------------- | --------------- |
| `test/ui/grouping-mode.test.tsx` | `role="group"` named `/group occurrences by/i` with buttons `Occurrences` / `Localities` / `Taxa`; `combobox` named `/group by rank/i` appears only in Taxa mode; regions `/occurrences on the map/i`, `/localities on the map/i`, `/taxa on the map/i` | Rewrite to the five-unit control (REQ-001): five options, default `Occurrence`, no combobox in **any** state, the disabled-but-legible loading/error state, and the region name per unit. Add the REQ-002 chrome-parity assertions. **Coordinate with SPEC-021**, which also edits this file (its cluster-legend assertion) — see *Conflict check* |
| `test/ui/taxon-mode.test.tsx` | Clicks `Taxa`, then the rank combobox, to reach genus/family rows; asserts `Tyrannosaurus`, `Triceratops`, `Tyrannosauridae`; selecting a taxon opens region `/taxon:/i` with `Open taxon profile` | Reach the tiers by activating the `Genus` / `Family` options. Add: **no `/not classified/i` row and no unclassified record in the unit's count or map set** (REQ-004), the two-value row body with no clade word (REQ-002), count-descending order (REQ-005), hover linkage (REQ-006), and that the rows are gone once the detail is open (REQ-003). Any existing assertion that the bucket is present must be **inverted, not deleted** (NFR-003) |
| `test/ui/locality-mode.test.tsx` | Clicks `Localities`; asserts region `/localities on the map/i`, a locality panel `/locality:/i`, per-taxon `Open profile`, and the profile→back loop | Reach the unit via the `Locality` option; assert the detail replaces the rows, the back control's name, hover linkage, count-descending order, and the row's two subtitles — distinct-taxon count + **present-day region**, with no formation, occurrence count or Ma range on the row |
| `test/ui/occurrence-list.test.tsx` | In-view count wording `occurrence(s) in the current map view`; hover reports the id; `aria-current` + `data-highlighted`; the fallback header `occurrence(s) at this age`; the empty-in-view message; the cap + overflow line; row → panel → `Open taxon profile` | Update the count wording to whole-word plurals (REQ-002); assert the row's two subtitles are Ma range + collection name with **no formation on the row**; keep every other assertion; add the REQ-003 assertions (rows absent while the detail is open, back restores scroll + `aria-current` + focus) and the NFR-002 focus assertions |
| `test/ui/grouping.test.ts` | The locality and taxon folds and their current ordering | Add REQ-005 ordering (count-descending, tie-break, determinism across two folds) and API-001's `unitOf`/`modeAndRankOf` inverse property |
| `test/ui/rank-rollup.test.ts` | `resolveTierTaxon` over the ingested ancestry, incl. the not-classified case | **The resolver is untouched** and its null case must keep its assertion — it is now what REQ-004 filters on rather than what fills a bucket. Add one assertion that the filter drops exactly the records for which the resolver returns null |
| `test/ui/occurrence-panel.test.tsx` | Region `/Occurrence:/i`, its field set, `Open taxon profile` | Keep every field assertion, update the close control's accessible name to the REQ-003 back control, and add the one new field: `Formation`, with `Formation not recorded` when the collection records none (REQ-002) |
| `test/ui/spec013-search-ui.test.tsx` | A search result lands "in the side panel, not the profile" | Update the landing assertion to the replaced-list detail; the requirement (land in context) is unchanged |
| `test/ui/scenario-perf-370.test.tsx` | Empty state → `Reset view` → region `/occurrences on the map/i` | Update the region name if it changes; the PERF-370 scenario itself is unchanged |
| `test/ui/data-states.test.tsx` | Loading `status` + `progressbar`, `Retry`, back-to-map | Add the REQ-001 assertion that the unit selector is present-but-disabled in the loading and error states |

**End-to-end (Playwright).**

| File | What it asserts today | Required change |
| ---- | --------------------- | --------------- |
| `test/e2e/exploration.e2e.ts:44-46` | `complementary` named `/occurrence details/i` is visible | Update the landmark's accessible name if it changes (it should name the column, not one unit) |
| `test/e2e/a11y.e2e.ts` | axe over the exploration view | No edit expected, but it is a **required gate** for NFR-002 — new left rules, a disabled control and a focus-moving swap are exactly what trips axe. Must be run and reported |

**Fixtures.** No new fixture. REQ-005's "more groups than the cap" case needs a
fixture (or a lowered cap injected as a prop in the test) that produces > 300
groups; the shipped Maastrichtian stage produces 378 classified genera and is the
honest source. If the jsdom harness cannot hold the full stage, the assertion is made
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

- **REQ-005 (ordering) and REQ-004 (the classified-only filter) are independent
  of REQ-001…003.** Either can be reverted alone — restore the name sort in
  `grouping.ts`, or restore the bucket branch of `groupByTaxon` and stop
  narrowing the visible set — and both are pure-function changes with their own
  unit tests. Reverting REQ-004 also reinstates SPEC-010 REQ-005's disclosure, so
  AMEND-003's REQ-004/005 clauses must be struck with it.
- **REQ-002's row trims are revertible field by field** (formation back onto the
  occurrence row, region off the locality row), since each is one line of the row
  body; the two-value ceiling is the owner's constraint, so a partial revert must
  say which value it puts back and which it removes.
- **REQ-003 (replace) can be reverted to stacking** by rendering the detail above
  the list again, without touching the unit selector — the selector and the list
  do not depend on the swap.

REQ-001/002 revert together: the flat control and the single list component are
one refactor. If the SPEC-010 AMEND-003 block has already been transplanted, a
revert must also strike it, or SPEC-010 will describe a UI that no longer exists.

## Open questions

- [x] **OQ-1 — the remembered rank.** **Confirmed by the owner, 2026-08-14.** The
      remembered tier is dropped; the tier is one visible click either way, and
      REQ-001 stands as written.
- [x] **OQ-2 — the clade rule (UX-002).** **Adopted by the owner, 2026-08-14
      ("Tint").** The tint ships, ungated. The clade *word* does not appear on a
      row (owner review: redundant with the tint and present in the detail); the
      compensating rules are in UX-002.
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
- [x] **Should the taxon units filter the map as well as the list?** **Yes** —
      resolved in REQ-004 and recorded as A-3: a filtered list over an unfiltered
      map would leave the count disagreeing with the points and would let a hover
      or a map selection resolve to no row.
- [x] **Should the present-day region be expanded to a country name?** **No** —
      resolved as A-1: the shipped string already carries the country as an ISO-2
      code plus the state or province, a lookup would be 95 entries with one code
      (`O2`) that names no country, and the row has no width to spare.
- [ ] **Deferred to implementation:** whether the unit selector is a radio group
      (`aria-checked`, one tab stop, arrow keys) or five `aria-pressed` buttons.
      Either satisfies REQ-001; the radio group is the better keyboard model and
      is the recommendation.
- [ ] **Deferred to implementation:** the exact accessible name of the list
      region per unit (e.g. "Genera on the map") and of the sidebar landmark. Any
      name that states the unit satisfies REQ-002; the e2e landmark assertion
      must be updated to match.

## Human decisions required

All four are answered. **Owner approval recorded in session, 2026-08-14
(nelsonjeanrenaud@gmail.com)** — "I confirm and approve everything mentionned
here", given on the revised mockup and this spec together.

- [x] **Approve the direction: one flat unit selector, one list, detail replaces
      the list.** This is the substance of the redesign, and it changes SPEC-010
      REQ-001/005's delivery mechanism (AMEND-003 below).

      **Answer:** Approved. Owner approval recorded in session, 2026-08-14
      (nelsonjeanrenaud@gmail.com). OQ-1 confirmed with it.

- [x] **OQ-2 — the clade rule (UX-002).** Adopt, or decline?

      **Answer:** **Adopt the tint** ("Tint"), ungated — UX-002 is a live
      requirement, not a gated one. The clade *word* is cut from the row as
      redundant with the tint and with the detail. Owner approval recorded in
      session, 2026-08-14 (nelsonjeanrenaud@gmail.com).

- [x] **Confirm the ordering change (REQ-005).** Rows become count-ordered rather
      than alphabetical.

      **Answer:** Approved. Owner approval recorded in session, 2026-08-14
      (nelsonjeanrenaud@gmail.com).

- [x] **Approve the mockup review changes** — at most two subtitles per row, no
      interface-explaining copy in the product, the not-classified records
      filtered out of the taxon units, and the present-day region on a locality
      row.

      **Answer:** Approved. Owner approval recorded in session, 2026-08-14
      (nelsonjeanrenaud@gmail.com).

- [x] **Approve this spec** (status → Approved; the move to
      `docs/specs/approved/` is the orchestrator's step, not this change's).

      **Answer:** Approved. Owner approval recorded in session, 2026-08-14
      (nelsonjeanrenaud@gmail.com).

## Conflict check

| Document | What overlaps or conflicts | Resolution |
| -------- | -------------------------- | ---------- |
| `SPEC-010` REQ-001 (three-mode control) | This spec replaces the three-mode control + rank `<select>` with one five-unit control | **AMEND-003** below — the *mechanism* changes, the requirement (an always-visible, keyboard-operable, non-colour-only unit control that switches list, map semantics and panel target together) is preserved |
| `SPEC-010` REQ-005 (rank selector inside Taxon mode; the disclosed bucket) | The rank selector ceases to exist as a separate control; the tiers become three of the five units; **the disclosed "not classified at this level" bucket is removed from the taxon units** | **AMEND-003** — the ladder (Genus / Family / Major group, no Species) and the roll-up are unchanged, but the disclosure clause is **reversed by owner decision** and the records are shown under Occurrence and Locality instead. This is the one place this spec removes something SPEC-010 required |
| `SPEC-010` REQ-003 (locality row contents) | The row keeps its distinct-taxon count but loses its formation/Ma range to the detail, and gains the present-day region | **AMEND-003** — REQ-003's "distinct-taxon count" survives; "collection or formation name … + the locality's Ma range" moves to the locality detail |
| `SPEC-010` REQ-004 (taxon rows, map keeps every point, focus/dim) | Row contents preserved (count + aggregate span). **The "map still contains one feature per occurrence" clause is amended**: at a taxon unit the map plots the classified records only | **AMEND-003** — the focus/dim behaviour, the no-collapsing rule and the no-per-taxon-hue rule are unchanged; only the membership of the visible set changes, through the same seam as the shipped article gate. REQ-006 finally implements REQ-004's hover clause |
| `docs/mockups/design-guidelines.md` §2 (uncertainty never hidden) | Removing the bucket removes a disclosure from the taxon views | **Owner decision, recorded once in AMEND-003.** Bounded: the records are neither deleted nor hidden from the atlas — they are listed, counted, mapped and openable under Occurrence and Locality — and no *shown* value becomes less certain. Charter §2 is a design convention; the requirement it served (SPEC-010 REQ-005) is amended, not silently ignored |
| `SPEC-010` AMEND-001 (cluster legend in the map pane) | Untouched — it lives in the map pane, not the sidebar | **No conflict** |
| `SPEC-021` | Also edits `test/ui/grouping-mode.test.tsx`; **SPEC-021 is Approved and its AMEND-002 has landed in SPEC-010** | **Coordination, not conflict.** This spec takes **AMEND-003**, the next free number (AMEND-001 and AMEND-002 both exist in SPEC-010 today). Whichever change lands second rebases its edits to that shared test file; neither may drop the other's assertions (NFR-003) |
| `SPEC-009` REQ-003 (row shows "at least the taxon name and the Ma range") | The occurrence row keeps both and loses only the formation | **No conflict** — SPEC-009's floor is met; the cap and overflow wording survive, and REQ-006 generalises the highlight to every unit |
| `SPEC-013` REQ-004 (search lands in the side panel) | The "side panel" is now the detail that replaces the list | **No conflict** — the requirement is "land in context, not on the profile", which is preserved; the test's landing assertion is updated |
| `SPEC-003` REQ-006/007 (selection → panel → profile, ≤1 action back) | The panel moves; the loop and the one-action back are preserved and strengthened by REQ-003's focus/scroll restoration | **No conflict** |
| `SPEC-015` / `SPEC-017` AMEND-001 (clade tints) | UX-002 reuses the tints in the sidebar, without the clade word on the row | **No conflict** — SPEC-017 AMEND-001 already says the tints are not map-only, and its "never the only way a clade is identified" rule is met by the row's accessible name and the detail (UX-002). UX-002 adds no hue |
| `SPEC-014` AMEND-005 (the Wikipedia article gate) | REQ-004 adds a second filter over the same occurrence set | **No conflict** — the two compose; the gate's default already empties the genus-tier bucket, so REQ-004 bites at Family, Major group, and at every tier with "show all" on |
| `docs/mockups/design-guidelines.md` | Binding; this spec's UX-001 is written to it | **No conflict** |

No functional-specification requirement is touched: FONC-040/050/060 (permanent
context), FONC-1080 (one action back), FONC-1280/1310/1330/1340 (states),
PERF-120/250 all remain satisfied by REQ-001…003 and UX-001. This spec has no
authority over `docs/product/functional-specification.md` and needs none.

## Required amendments to existing specs

One ready-to-transplant block. **Do not edit the target spec from this spec** —
the orchestrator transplants it into SPEC-010's `## Spec amendments` section
under the number given.

**Number chosen: AMEND-003.** SPEC-010 carries **AMEND-001** (the cluster legend)
and **AMEND-002** (SPEC-021's per-cluster accessible name, landed with SPEC-021's
approval on 2026-08-14). **AMEND-003** is therefore the next free number, and it
is unambiguous — SPEC-021 is Approved, so no renumbering case remains.

---

### For `docs/specs/approved/SPEC-010-occurrence-locality-taxon-modes.md` — next free number is **AMEND-003** (AMEND-001 and AMEND-002 are both used)

```markdown
### AMEND-003: One five-unit selector replaces the mode + rank controls; rows carry two subtitles; the not-classified bucket is removed from the taxon units (via SPEC-026)

- **Date:** 2026-08-14
- **Reason:** Owner feedback, 2026-08-14 — "We need to rethink and redesign the
  sidebar with occurence/genus/family it's a mess as it is." — followed by owner
  review of the redesign mockup the same day. As built, REQ-001's three-mode
  segmented control and REQ-005's rank `<select>` are two controls answering one
  question ("what is one row?"), and the rank control exists only inside one of
  the three segments, so it appears and disappears under the user. The mockup
  review added three cuts: a row may carry at most two subtitles; a locality row
  must say where it is in the present day; and the *not classified at this level*
  bucket must be filtered out rather than disclosed. Two defects were also found
  on the shipped snapshot: the bucket sorts last and, at the Maastrichtian
  default, holds **2,810 of 4,945 records (57 %)** at **row 358 of 358**, behind
  the 300-row render cap — so REQ-005's disclosure is not actually on screen; and
  alphabetical ordering plus the same cap hides the two largest genus groups
  (*Triceratops*, 165 occurrences, sorted 343rd of 378; *Tyrannosaurus*, 83,
  sorted 348th).
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
  - **REQ-005** — the *carrier* changes and **one clause is reversed**. There is
    no longer a separate rank selector "hidden or disabled outside Taxon mode";
    the three tiers are three of the five units, so the acceptance criterion
    "outside Taxon mode the selector is not offered" is struck as no longer
    meaningful. **Unchanged:** the ladder is still exactly Genus / Family / Major
    group with no Species, Genus is still the default taxonomic tier, and roll-up
    still walks the parent chain via `resolveTierTaxon`. **Reversed:** records
    that resolve to no taxon at the chosen tier are **no longer shown in a
    disclosed "not classified at this level" bucket**. They are filtered out of
    the Genus, Family and Major group units entirely — out of the list, the
    count and the map together, from one filtered set, so the three cannot
    disagree. This is a **deliberate owner decision, taken on 2026-08-14, to stop
    disclosing that share of records in the taxon views**; at the Maastrichtian
    default that share is **57 %** (2,810 of 4,945 records; 2,898 of 5,064 with
    the article gate lifted). It is bounded, and the bound is part of the
    amendment: those records are **not** deleted, hidden from the atlas, or
    dropped from any non-taxon count — they remain listed, counted, mapped and
    openable under the **Occurrence** and **Locality** units, which is where an
    identification that reaches no genus is a meaningful row.
  - **REQ-003** — the locality **row** contents change; the locality *mode* does
    not. The row keeps its **distinct-taxon count** and gains the collection's
    **present-day region** (`modernPosition.value.region`, present on 100 % of
    the snapshot, e.g. "Alberta, CA"); the formation, the occurrence count and
    the locality's Ma range move off the row into the locality detail, which
    already shows them. One marker per collection at the collection's own
    paleocoordinate, the clustering, and the detail's taxa list are unchanged.
  - **REQ-004** — row contents preserved, **one clause amended**, and one
    unimplemented clause finally delivered. Taxon rows keep the accepted
    scientific name, the in-view occurrence count and the aggregate Ma span (the
    clade word that the SPEC-026 mockup had added is not shown on the row; the
    clade is carried by the SPEC-015 tint, the row's accessible name and the
    detail). **Amended:** the clause "the map still contains one feature per
    occurrence (feature count unchanged from Occurrence mode)" no longer holds at
    a taxon unit — the map plots the records that classify at the chosen tier,
    the same set the list and the count are derived from. The no-collapsing rule,
    the real-paleocoordinate rule, the focus/dim behaviour and the
    no-per-taxon-hue rule are all unchanged. **Delivered:** REQ-004's hover clause
    ("hovering a taxon row emphasises that taxon's points and vice-versa"), which
    `LocalityList`/`TaxonList` never implemented, is delivered by SPEC-026
    REQ-006 for every unit.
  - **REQ-002, AMEND-001, AMEND-002** — unchanged. Occurrence mode's behaviour,
    clustering, the cluster count's accessible name and the clade key are all
    untouched by this amendment.
- **Behavioral impact:** The Occurrences/Localities/Taxa segmented control and
  the "Group by rank" `<select>` are replaced by one five-option selector that
  never changes size or spawns a second control. Every row is a name plus at most
  two values; the formation leaves the occurrence row for the occurrence detail
  (which gains a `Formation` field), and the locality row shows its present-day
  region. Locality and taxon rows become count-ordered instead of name/id-ordered.
  At Genus, Family and Major group the list, the count and the map exclude records
  that classify at no taxon at that tier; Occurrence and Locality are unaffected
  and still show every record. A selection replaces the list in the sidebar
  instead of stacking a panel above it. No change to clustering, to the roll-up
  resolver, to the read model, to the snapshot, or to which records exist.
- **Test impact:** `test/ui/grouping-mode.test.tsx` moves from three mode buttons
  plus a rank combobox to five unit options and asserts no combobox exists in any
  state; `test/ui/taxon-mode.test.tsx` inverts its bucket assertion (the bucket
  must be absent, and the unit's count and map set must exclude the same records)
  and gains the ordering, hover-linkage and replaced-list cases;
  `test/ui/locality-mode.test.tsx` asserts the two-subtitle row with the
  present-day region; `test/ui/occurrence-list.test.tsx` keeps every assertion,
  drops the formation from the row and gains the detail-replaces-list and
  focus-restoration cases; `test/ui/occurrence-panel.test.tsx` gains the
  `Formation` field and its missing label; `test/ui/grouping.test.ts` gains the
  ordering and unit-mapping tests; `test/ui/rank-rollup.test.ts` keeps its
  null-resolution assertion, which is now the filter's predicate. No test is
  deleted, skipped or weakened.
- **Human approval reference:** Owner approval recorded in session, 2026-08-14
  (nelsonjeanrenaud@gmail.com) — "I confirm and approve everything mentionned
  here".
```

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Unit selector | `GroupingControls.tsx` rewritten — one `radiogroup` "One row per" over five options; the rank `<select>` is gone | `test/ui/grouping-mode.test.tsx`, `test/ui/taxon-mode.test.tsx` | Implemented |
| REQ-002 | One list | `UnitList.tsx` (new) — shared chrome, variant row body, max two meta values | `test/ui/unit-list.test.tsx`, `test/ui/spec026-sidebar.test.tsx` | Implemented |
| REQ-003 | Replace, not stack | `ExplorationView.tsx` renders `detail ?? <UnitList/>`; each panel's ✕ becomes `.panelBack` naming the list it returns to | `test/ui/taxon-mode.test.tsx` ("replaces the list with its detail") | Implemented |
| REQ-004 | Classified only | `classifiesAt()` in `grouping.ts`; `unitOccurrences` in `ExplorationView` filters **once**, feeding list, count and map alike; the bucket branch of `groupByTaxon`, `NOT_CLASSIFIED_KEY` and `notClassifiedLabel` are removed | `test/ui/spec026-sidebar.test.tsx`, `test/ui/grouping.test.ts` | Implemented |
| REQ-005 | Count-descending order | `groupByTaxon` and `groupByLocality` sort by count desc, then name, then id | `test/ui/spec026-sidebar.test.tsx`, `test/ui/grouping.test.ts` | Implemented |
| REQ-006 | Two-way highlight | `UnitList` reports hover/focus for every unit; `highlightRow`/`highlightedKey` map between a row and its occurrence-id set | `test/ui/unit-list.test.tsx`, `test/ui/spec026-sidebar.test.tsx` | Implemented |
| API-001 | `setUnit` | `ListUnit`, `unitOf`, `modeAndRankOf`, `isTaxonUnit` in `grouping.ts`; reducer's `setUnit` replaces `setMode`/`setRank`; `mode` and `rank` stay in state | `pnpm run typecheck`, `test/ui/grouping-mode.test.tsx` | Implemented |
| NFR-001 | Pure, no I/O | The filter is a predicate over the already-loaded stage | `test/ui/grouping.test.ts` | Implemented |
| UX-001 | Charter compliance | No card, no chip; rows are a name line, a meta line and a tint rule | diff review | Implemented |
| UX-002 | Clade rule adopted | `.unitRow[data-clade]` left border in the clade tint; locality rows carry none; the clade is in the row's accessible name and in the detail's visible `.panelClade` | `test/ui/spec026-sidebar.test.tsx` | Implemented |

### Verification evidence (2026-08-14)

| Command | Result |
| ------- | ------ |
| `pnpm run typecheck` | pass |
| `pnpm test` | 89 files, **515 tests**, all pass (before this change: 88 / 504) |
| `npx eslint src test --max-warnings=0` | clean |
| `npx playwright test` | **22 passed**, a11y included |

### Implementation notes

- **Two components were deleted, and their coverage moved rather than lapsing.**
  `OccurrenceList.tsx` and `GroupedList.tsx` are gone; `UnitList.tsx` provides
  the chrome all five units share. `test/ui/occurrence-list.test.tsx` was
  **renamed** to `test/ui/unit-list.test.tsx` and rewritten against the new
  component, so the SPEC-009 behaviours it guarded — in-view count, hover
  linkage, render cap, overflow line, empty-in-view — are still asserted.
- **The empty-in-view title is now unit-neutral** ("Nothing in this view"). It
  read "No occurrences in this view", which is wrong under the Genus unit now
  that one component serves all five.
- **The map filter is what makes REQ-004 coherent.** Filtering only the list
  would leave the map plotting points with no row behind them, which would break
  the two-way highlight and map selection. `unitOccurrences` is therefore the
  single filtered set the list, the count *and* the map all derive from.
- **Ordering caught a latent hazard.** `groupByLocality` previously sorted by
  `collectionId`, i.e. arbitrarily, and `groupByTaxon` alphabetically. With a
  300-row cap the order decides what is never seen, which is how *Triceratops*
  (165 records) and *Tyrannosaurus* (83) were absent from the shipped genus list.
  Both now sort by count descending with a total tie-break, so the cap keeps the
  same rows on every render.


## Implementation notes

To be filled during implementation. Three things to record when it happens:
whether the unit selector shipped as a radio group or as `aria-pressed` buttons;
where REQ-004's tier filter is applied (the recommendation is one derived set in
`ExplorationView`, beside `gateOccurrences`, so the list, the count and the map
provably read the same array); and the accessible-name format that carries the
clade word on a row under UX-002.

## Spec amendments

> Required for any behavioral change after the spec is Approved. None yet — the
> spec reached Approved with the owner's review changes already folded in
> (2026-08-14), so there is no post-approval behavioral change to record.

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [x] Open questions are resolved or explicitly deferred (OQ-1 confirmed and
      OQ-2 adopted by the owner, 2026-08-14; five resolved by inspection or by
      measurement; two explicitly deferred to implementation with no requirement
      consequence).
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed (SPEC-010 REQ-001/003/004/005 amended via
      AMEND-003, including the one reversal — the not-classified disclosure;
      SPEC-021 coordination on the shared test file; SPEC-009, SPEC-013 and
      SPEC-014 extended, not reversed; charter §2 impact recorded once).
- [x] Risks listed — rollback plan and edge cases are present.
- [x] Human approval recorded before status set to Approved. **Owner approval
      recorded in session, 2026-08-14 (nelsonjeanrenaud@gmail.com)** — "I confirm
      and approve everything mentionned here", covering the direction, OQ-1, OQ-2
      ("Tint"), the ordering change and the four mockup-review changes.
