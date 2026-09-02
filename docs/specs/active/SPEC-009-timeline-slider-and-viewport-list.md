---
doc_type: spec
spec_id: SPEC-009
title: Ergonomic timeline slider & viewport-linked occurrence list with map↔list highlighting
status: In Implementation
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, exploration-view, timeline, map-rendering, occurrence-list, styling]
affected_interfaces: []
supersedes: []
superseded_by:
depends_on: [SPEC-003, SPEC-004, SPEC-008]
conflicts_with: [SPEC-007]
last_verified_at: 2026-07-22
---

# SPEC-009: Ergonomic timeline slider & viewport-linked occurrence list with map↔list highlighting

## Summary

Two ergonomics changes to the exploration view, both owner-directed. First, replace
the wrapped list of stage chips with a **to-scale, stepped timeline slider**: stage
steps are positioned proportionally to their duration in Ma, with three large,
labelled period delimitations (Triassic / Jurassic / Cretaceous). Second, bring back
a **right-hand list of the occurrences currently visible on the map** (viewport-
linked) and couple it to the map both ways: **hovering a map point highlights its
list row, and selecting a list row highlights (and inspects) its map point**. The
returning list also restores the keyboard/screen-reader path to an occurrence that
SPEC-007 removed.

## Context

The exploration view (SPEC-003, widened to the full Mesozoic by SPEC-008) currently
steps the selected age through a wrapped, scrollable list of 30 equal-width stage
chips plus a Triassic/Jurassic/Cretaceous quick-select (`TimelineControl`). Equal-
width chips hide the huge differences in stage duration (Induan ~0.7 Myr vs Norian
~18.5 Myr) and the wrapped list is hard to scan.

SPEC-005 once shipped an aggregated, viewport-linked occurrence list; SPEC-007 then
deleted the occurrence list entirely (map-only selection), recording the loss of the
keyboard/screen-reader path to occurrences as an **accepted accessibility regression**
with "an accessible occurrence path … recorded as future work" (SPEC-007 AMEND-002,
Open questions). The owner now wants a viewport-linked list back — narrower in intent
than SPEC-005 (no taxon/formation aggregation): a flat list of what is on screen, two-
way highlight-linked to the map.

The map already reports its viewport bounds via an `onViewportChange` callback
(plumbed for SPEC-005, currently unused). This spec consumes that signal. It does not
change SPEC-001 data, the snapshot, clustering, or the basemap.

## Problem statement

The timeline does not read as deep time (equal chips misrepresent stage lengths and a
wrapped chip list is awkward), and there is no on-screen, keyboard-reachable way to
see *which* occurrences are currently in view or to move between a point on the map
and its record. The owner wants a proportional slider with clear period markers and a
viewport-linked list that highlights in lock-step with the map.

## Goals

- Present the timeline as a horizontal, **to-scale** stepped slider: each stage step
  is placed/sized proportionally to its Ma span, oldest → youngest, left → right.
- Show **large period delimitations** (Triassic / Jurassic / Cretaceous), labelled and
  proportional, doubling as a coarse jump control (SPEC-008 REQ-003 preserved).
- Keep the slider fully **keyboard-operable** as a single control (arrow-key stepping),
  and keep the selected stage + its Ma span **always legible** (not hover-only).
- Show a **viewport-linked list** of the occurrences currently visible on the map, and
  update it as the user pans/zooms.
- **Two-way highlight** between map and list: hover a map point → its list row is
  highlighted and scrolled into view; hover or focus a list row → its map point is
  emphasised; activating a list row selects the occurrence (opens the panel and
  strongly emphasises the point), and selecting a point on the map highlights its row.
- Restore a keyboard/screen-reader-reachable path to an individual occurrence (closing
  the SPEC-007 accessibility regression).

## Non-goals

- Re-introducing SPEC-005's **taxon/formation aggregation**, group headers, group-by
  toggle, or per-group profile action. This list is flat (per-occurrence rows).
- Free-text search, multi-facet filters, or the classification browser.
- Continuous (sub-stage) time selection or dragging to an arbitrary Ma value — the
  slider still **steps by ICS stage** (SPEC-008 REQ-002); "to scale" is about
  *placement*, not granularity.
- Changing the map's clustering, the basemap frames, the snapshot, or SPEC-001 data.
- Spatial indexing structures — a linear scan is ample at MVP volume (NFR-001).
- Re-adding the `reconstructed`/`interpretative` provenance cues SPEC-007 removed.

## Users or actors

The **Explorer**, including keyboard and screen-reader users (directly served by the
returning list and the single-control slider), interacting with the exploration view.

## Functional requirements

### REQ-001: To-scale stepped timeline slider

- **Statement:** The timeline must render as a horizontal track spanning the full
  Mesozoic window, oldest on the left, on which each geological stage is a **step
  positioned and sized in proportion to its duration in Ma**. Selecting a step sets
  the selected age (still stepping by ICS stage — SPEC-008 REQ-002); the selected step
  is visually distinct (teal), and the selected stage name **and its Ma span** are
  shown as always-present text. The control must be operable by keyboard as a single
  slider: Left/Right (or Down/Up) move to the adjacent older/younger stage and
  Home/End jump to the first/last stage, with the focused step exposing the selection
  to assistive tech (`aria-pressed`, plus a slider label/valuetext). The track must
  carry a **Ma graduation** (round-value tick marks with labels and a unit) so the
  time axis is readable, not only implied by the steps.
- **Rationale:** Equal-width chips misrepresent deep time; a proportional slider reads
  as a timescale and is more ergonomic (owner request). A Ma graduation makes the scale
  legible (owner request 2026-07-22). Legible selection, not hidden behind hover, is
  required by the charter (§4) and PERF-250 (never colour-alone).
- **Acceptance criteria:** The three period bands' widths are proportional to their
  combined stage spans (Cretaceous widest, Triassic/Jurassic narrower) within rounding;
  each stage exposes a control whose accessible name contains the stage name and whose
  `aria-pressed` is true only for the selected stage; pressing ArrowRight from
  Kimmeridgian moves selection to Tithonian (next younger), ArrowLeft moves older, and
  End selects Maastrichtian; the selected stage name + span render as text at all times;
  round Ma tick labels (e.g. 100, 150, 200, 250) and a "Ma" unit are shown along the axis.
- **Verification method:** automated component test + inspection.
- **Evidence location:** `test/ui/timeline-slider.test.tsx`,
  `src/app/components/TimelineControl.tsx`.

### REQ-002: Large period delimitations that double as a jump control

- **Statement:** The slider must display the three Mesozoic periods (Triassic,
  Jurassic, Cretaceous) as large, labelled delimitations aligned to the stage steps
  they contain, each carrying its name as text and its ICS period colour (meaning-only,
  never the sole signal). Activating a period must jump the selected age to that
  period's representative stage, preserving the SPEC-008 REQ-003 quick-select
  behaviour and its `role="group"` "Jump to period" affordance.
- **Rationale:** The owner asked for "grosses délimitations" for the three periods; the
  period quick-select (SPEC-008 REQ-003) must not regress.
- **Acceptance criteria:** A `role="group"` named "Jump to period" exposes three
  buttons (Triassic/Jurassic/Cretaceous); each shows its name as text; the button for
  the selected stage's period is `aria-pressed`; clicking one reports the period and
  the view jumps to its representative stage (existing `timeline-periods` test stays
  green).
- **Verification method:** automated component + integration test.
- **Evidence location:** `test/ui/timeline-periods.test.tsx`,
  `test/ui/timeline-slider.test.tsx`.

### REQ-003: Viewport-linked occurrence list

- **Statement:** The right-hand sidebar must list the occurrences whose reconstructed
  paleoposition is **within the map's current viewport**, updating when the user
  pans/zooms, and must state the in-view count. Each row shows at least the taxon name
  and the occurrence's Ma range, is keyboard-operable, and activating it selects that
  occurrence (opening the occurrence panel — SPEC-003 REQ-006 loop preserved). When no
  map viewport signal is available (no WebGL / map not yet loaded), the list must fall
  back to **all** occurrences at the selected age; when the viewport is non-empty of
  the age's set but currently contains none, it must show a recoverable "no occurrences
  in this view" message distinct from the no-occurrences-at-this-age empty state. The
  rendered row count must stay **bounded** by a cap with an explicit "showing X of Y"
  overflow affordance so the DOM cannot blow up at real dataset scale.
- **Rationale:** The owner wants to see the on-screen points as a list; ties the list
  to what the user is looking at, keeps it small when zoomed, and restores an
  accessible occurrence path (SPEC-007 regression). Bounded DOM prevents the flat-list
  blow-up SPEC-005 guarded against (PERF-020/030).
- **Acceptance criteria:** With a viewport signal, the list narrows to occurrences
  inside the bounds and the header states the in-view count; with no signal it lists
  all age occurrences; an empty-in-view (non-empty age) state shows the recoverable
  message; a group larger than the cap renders at most the cap plus an overflow note;
  activating a row opens the occurrence panel.
- **Verification method:** unit test (bounds filter) + component test.
- **Evidence location:** `test/ui/viewport.test.ts`,
  `test/ui/occurrence-list.test.tsx`.

### REQ-004: Two-way map↔list highlighting

- **Statement:** Hovering (or focusing) a list row must **emphasise the corresponding
  map point**; hovering a map point must **highlight the corresponding list row** and
  scroll it into view. There is a single shared "highlighted occurrence" that both
  surfaces reflect. Highlight (transient, from hover/focus) is visually distinct from,
  and weaker than, **selection** (the clicked occurrence that opens the panel and is
  most strongly emphasised on the map). Selecting a list row selects the occurrence
  (map point strongly emphasised); selecting a map point marks its list row as the
  current row (`aria-current`).
- **Rationale:** The owner asked for exactly this coupling; it makes moving between a
  point and its record direct and legible.
- **Acceptance criteria:** Pointer-entering a list row sets that occurrence as
  highlighted and the row carries a highlight state; the map point paint reflects the
  highlighted id; hovering a map point sets the same highlighted id and the matching
  row gains the highlight state and is scrolled into view; the selected row carries
  `aria-current="true"` and its map point uses the strongest emphasis.
- **Verification method:** component test (list side; map paint via inspection/unit of
  the shared state) + inspection of the map paint expressions.
- **Evidence location:** `test/ui/occurrence-list.test.tsx`,
  `src/app/components/OccurrenceMap.tsx`.

### REQ-005: Selecting an occurrence highlights its period on the frieze

- **Statement:** When an occurrence is selected, the timeline must additionally
  highlight that occurrence's **temporal extent** on the frieze: a to-scale band drawn
  over the stages its time range spans, and the period delimitation(s) the range
  overlaps visibly marked. The highlight must not intercept clicks on the stage steps
  beneath it, and it clears when no occurrence is selected.
- **Rationale:** Owner request (2026-07-22): moving the eye from a selected point to
  *when* it lived should be immediate; the frieze band also conveys a multi-stage span
  visually, replacing the removed text cue (REQ-006).
- **Acceptance criteria:** With a selected occurrence whose range lies in the Late
  Cretaceous, the Cretaceous period band is flagged in-range and the Triassic/Jurassic
  bands are not; with no selection no band is flagged; the band overlay is
  `pointer-events: none` so steps remain selectable.
- **Verification method:** component test + inspection.
- **Evidence location:** `test/ui/timeline-slider.test.tsx`,
  `src/app/components/TimelineControl.tsx`.

### REQ-006: Remove the "spans multiple stages" cue from the UI

- **Statement:** The "Spans multiple stages" cue (`MultiStageCue`) must no longer be
  rendered in the exploration UI — the occurrence list, the occurrence panel, or the
  taxon profile. The underlying `approximate` derivation in the data layer
  (SPEC-001 DATA-003, unchanged by SPEC-007) is **kept**; only the user-facing cue is
  removed. This retires the user-facing part of **SPEC-007 REQ-002** (recorded as
  SPEC-007 AMEND-004).
- **Rationale:** Owner decision (2026-07-22): the cue is noise (it shows on ~all
  occurrences); the frieze range highlight (REQ-005) now conveys a multi-stage span
  where it matters (the selected occurrence).
- **Acceptance criteria:** No component renders "Spans multiple stages"; the data
  derivation and its domain test (`spec008-mesozoic-timescale`) stay green; typecheck
  and lint pass with no unused-symbol errors.
- **Verification method:** inspection + build + full test suite.
- **Evidence location:** `src/app/components/OccurrenceList.tsx`,
  `OccurrencePanel.tsx`, `TaxonProfile.tsx`.

## Non-functional requirements

### NFR-001: In-memory, O(n), keyboard-accessible, within PERF-030

- **Statement:** Viewport filtering must be a pure in-memory linear scan over the
  loaded occurrences with no I/O, completing well within PERF-030 (≤1 s) on each
  pan/zoom at MVP volume. The timeline slider and the list must both be fully keyboard-
  operable and meet the charter/PERF a11y expectations (visible focus, non-colour-only
  state, ≥ target size for the interactive controls).
- **Rationale:** Static-client budgets (SPEC-002 NFR-001; PERF-030) and accessibility
  (PERF-220…270; charter §7). Restoring the accessible path is a stated goal.
- **Acceptance criteria:** No network request on pan/zoom or hover; the bounds filter
  is O(n); the slider is reachable and steppable by keyboard; list rows are
  focusable/activatable by keyboard.
- **Verification method:** code inspection + the no-egress test remains green + a11y
  lint (jsx-a11y) clean.
- **Evidence location:** `src/app/state/viewport.ts`, `test/data-005-no-runtime-egress.test.ts`.

## Security and privacy considerations

### SEC-001: No new egress or data

- **Statement:** No new network calls, secrets, or data sources. The viewport signal
  and highlight state are in-memory only; the map remains self-contained (SEC-001 of
  SPEC-004 unchanged).
- **Rationale:** Preserve the static, tokenless, no-egress guarantees.
- **Acceptance criteria:** `test/data-005-no-runtime-egress.test.ts` stays green; no new
  fetch/XHR is introduced.
- **Verification method:** automated test + inspection.
- **Evidence location:** `test/data-005-no-runtime-egress.test.ts`.

## Data model impact

None. Consumes the existing `ReadOccurrence` / `ReadApi`; adds only view-layer helpers
(a bounds filter and highlight/viewport component state). No DATA IDs, no snapshot
change.

## API impact

No runtime API. Internal component contracts only: `TimelineControl` keeps its
`stages/periods/selected/onSelect/onSelectPeriod` props; `OccurrenceMap` gains a
`highlightedId` prop and an `onHover(id | null)` callback and consumes its existing
`onViewportChange`; a new `OccurrenceList` component takes the in-view occurrences,
the selected/highlighted ids, and `onSelect`/`onHover` callbacks.

## UI or UX impact

### UX-001: Restores an accessible occurrence path; charter-compliant states

- **Statement:** The returning list restores a keyboard/screen-reader path to an
  individual occurrence (open panel → taxon profile), closing the SPEC-007
  accessibility regression. All real states must be designed: loading/error (existing),
  no-occurrences-at-age (existing empty state), no-occurrences-in-view (new recoverable
  message), and the overflow affordance. Domain language only; one teal accent; period
  colours meaning-only and always paired with text.
- **Rationale:** Charter §2/§4/§7; SPEC-007 recorded the accessible path as future work.
- **Acceptance criteria:** With the map unavailable (jsdom/no WebGL) the list still
  renders the age's occurrences and reaches the panel via keyboard; the new empty-view
  message is distinct from the empty-age state; no `reconstructed`/`interpretative`
  wording reappears.
- **Verification method:** component test + inspection.
- **Evidence location:** `test/ui/occurrence-list.test.tsx`.

## Configuration impact

Adds view-layer constants only (per-list render cap). No env, secrets, or feature flags.

## Error handling

- No viewport signal (no map/WebGL) → list the full age set (REQ-003 fallback).
- Empty viewport with a non-empty age set → recoverable "no occurrences in this view".
- Age set itself empty → existing `EmptyState` ("No occurrences at this age").
- In-view set exceeds the cap → "showing X of Y" overflow note; the map stays complete.

## Edge cases

- Occurrence with no paleoposition → not placeable on the map, so it is **never** in
  the list — including the no-map fallback (owner decision 2026-07-22). Unlike SPEC-005,
  unplaceable occurrences are not force-listed, because this list's purpose is "the
  points currently on screen".
- Antimeridian-wrapping viewport bounds (west > east) → handled as a wrap in the bounds
  test.
- Very many occurrences in view at world zoom → per-list cap + overflow note (REQ-003);
  the selected row, if any, is always kept visible.
- Clustered map points → hover highlighting fires on unclustered points only; clusters
  keep their existing click-to-zoom behaviour (no per-point hover under a cluster).
- Rapid pan/zoom → the bounds filter recomputes in memory; the highlighted id is
  cleared when its occurrence leaves the set.

## Acceptance criteria

Satisfied when: the timeline is a to-scale stepped slider with proportional period
delimitations, keyboard-steppable, with the selected stage + span always legible
(REQ-001/002); the sidebar lists the occurrences currently in the map viewport, states
the in-view count, falls back to the full age set with no map signal, and shows a
recoverable empty-view state, all bounded by a cap (REQ-003); hovering/selecting links
the map and list both ways with highlight weaker than selection (REQ-004); everything
is in-memory, keyboard-accessible, and within PERF-030 with no new egress
(NFR-001/SEC-001); and the SPEC-008 period quick-select and SPEC-003 selection→panel→
profile loop still pass.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Proportional steps + keyboard step + legible selection | automated | component test | `test/ui/timeline-slider.test.tsx` | — |
| REQ-002 | Period bands proportional + jump preserved | automated | component + integration | `test/ui/timeline-slider.test.tsx`, `test/ui/timeline-periods.test.tsx` | — |
| REQ-003 | Viewport list + fallback + empty-view + cap | automated | unit + component | `test/ui/viewport.test.ts`, `test/ui/occurrence-list.test.tsx` | — |
| REQ-004 | Two-way highlight; highlight ≠ selection | automated + inspection | component + map paint inspection | `test/ui/occurrence-list.test.tsx`, `OccurrenceMap.tsx` | — |
| REQ-005 | Selected occurrence highlights its period on the frieze | automated | component test | `test/ui/timeline-slider.test.tsx` | — |
| REQ-006 | "Spans multiple stages" cue removed from UI | inspection + build | full test suite | list/panel/profile components | — |
| NFR-001 | In-memory O(n), keyboard, no egress | inspection + test | no-egress test + a11y lint | `test/data-005-no-runtime-egress.test.ts` | — |
| SEC-001 | No new egress/data | automated | no-egress test | `test/data-005-no-runtime-egress.test.ts` | — |
| UX-001 | Accessible path + designed states | automated | component test | `test/ui/occurrence-list.test.tsx` | — |

## Test plan

- Unit (`test/ui/viewport.test.ts`): `withinBounds` (inside/outside, lat/lng, wrap) and
  `occurrencesInView` (filters unplaceable, respects null bounds → all).
- Component (`test/ui/timeline-slider.test.tsx`): stage steps carry proportional widths
  and `aria-pressed`; ArrowLeft/Right/Home/End step the selection; selected name + span
  visible; period bands present and proportional.
- Component (`test/ui/occurrence-list.test.tsx`): lists in-view occurrences; header
  count; hover a row sets highlight (and calls `onHover`); activate a row selects
  (panel opens, `aria-current`); no-map fallback lists the age set; empty-view message;
  overflow cap.
- Regression: `timeline-periods`, `exploration-context`, `scenario-perf-360`, and
  `scenario-perf-370` stay green (the last updated for the new sidebar list instead of
  the "select a point" prompt).
- Full CI locally: typecheck, vitest, eslint (incl. jsx-a11y), Prettier, governance
  scripts.

## Rollback plan

Additive to the view layer. Revert the `TimelineControl` rewrite (restore the chip
list), delete `OccurrenceList.tsx` + `src/app/state/viewport.ts`, and remove the
`highlightedId`/`onHover` map wiring and the sidebar list in `ExplorationView` to
return to the SPEC-007 map-only sidebar. No data, pipeline, snapshot, or map-rendering
change to undo.

## Open questions

- [x] Aggregate the list (SPEC-005-style) or flat? **Flat** per the owner's phrasing
  ("une liste des points affichés"); aggregation is an explicit non-goal here.
- [x] Force-list unplaceable occurrences (SPEC-005) or mirror the map exactly?
  **Mirror the map** — the list is "points on screen"; unplaceable occurrences are
  never listed, including the no-map fallback (owner confirmed 2026-07-22).
- [ ] Whether to add a formal a11y E2E for the restored occurrence path (deferred; the
  jsdom component test already exercises the keyboard path).

## Human decisions required

- [x] Build the ergonomic to-scale slider with period delimitations and the viewport-
  linked, highlight-coupled list — **owner-directed** (2026-07-22): "Il faut revoir la
  timeline … une forme de slider avec des steps (mais à l'échelle) et des grosses
  délimitations pour Triasic, Jurassic et Cretacé. … dans la liste à droite … une liste
  des points affichés actuellement à l'écran … quand on hover par dessus un point ça
  highlight les éléments de la liste et quand on sélection un élément de la liste ça met
  en évidence le point correspondant." Owner ratification of this spec's wording is
  pending review of the PR.

## Conflict check

This spec **partially reverses SPEC-007's map-only decision** by re-introducing an
occurrence list, so `conflicts_with: [SPEC-007]` is recorded. It does so intentionally
and beneficially: it **closes the accessibility regression** SPEC-007 accepted and
logged as future work, without restoring the removed `reconstructed`/`interpretative`
cues or SPEC-005's aggregation. It depends on SPEC-003 (exploration loop/panel),
SPEC-004 (map viewport signal), and SPEC-008 (full-Mesozoic stage table + period
quick-select). No SPEC-001/002 decision changes. On approval, a SPEC-007 amendment
note records that the accessible occurrence path is restored here (AMEND-003) and the
"spans multiple stages" cue is retired from the UI (AMEND-004), keeping the underlying
`approximate` data derivation. `/drift-check` must be run after implementation.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Timeline slider | `src/app/components/TimelineControl.tsx` | `test/ui/timeline-slider.test.tsx` | Implemented |
| REQ-002 | Period bands / jump | `TimelineControl.tsx`, `ExplorationView.tsx` | `test/ui/timeline-periods.test.tsx` | Implemented |
| REQ-003 | Viewport list | `src/app/state/viewport.ts`, `src/app/components/OccurrenceList.tsx`, `ExplorationView.tsx` | `test/ui/viewport.test.ts`, `test/ui/occurrence-list.test.tsx` | Implemented |
| REQ-004 | Map↔list highlight | `OccurrenceMap.tsx`, `OccurrenceList.tsx`, `ExplorationView.tsx` | `test/ui/occurrence-list.test.tsx` | Implemented |
| REQ-005 | Frieze period highlight | `TimelineControl.tsx`, `ExplorationView.tsx` | `test/ui/timeline-slider.test.tsx` | Implemented |
| REQ-006 | Remove multi-stage cue | `OccurrenceList/OccurrencePanel/TaxonProfile.tsx` | full suite | Implemented |
| NFR-001 | In-memory/a11y | `viewport.ts`, components | inspection + no-egress | Implemented |
| SEC-001 | No egress | — | `test/data-005-no-runtime-egress.test.ts` | Implemented |
| UX-001 | Accessible path/states | `OccurrenceList.tsx`, `ExplorationView.tsx` | `test/ui/occurrence-list.test.tsx` | Implemented |

## Implementation notes

Filled during implementation (see PR). Key decisions/assumptions: the slider still
steps by ICS stage (to-scale is placement only); each stage remains a real `<button>`
with `aria-pressed` under a roving-tabindex single-tab-stop wrapper so it reads as one
slider control while preserving the stage-name/`aria-pressed` contract the existing
scenario tests rely on; the list is flat and mirrors the map's placeable points (no
aggregation, no force-listing of unplaceable occurrences); highlight is a single shared
transient id set by hover/focus on either surface, visually weaker than selection.

## Spec amendments

> Required for any behavioral change after the spec is Approved.

### AMEND-001: Discrete stage stepping at phone widths

- **Date:** 2026-09-02
- **Reason:** SPEC-030 REQ-006. REQ-001's to-scale track cannot be aimed on a
  phone: ~30 stages across a 214 px track gives a narrowest step of **0.0 px**,
  and 30 × 44 px of touch target is 1,320 px — the geometry simply does not admit
  a per-stage touch target at phone widths.
- **Changed requirements:** REQ-001, the composition of the control only. The
  track itself is unchanged.
- **Behavioral impact:** at `max-width: 40rem` the control gains explicit
  previous-stage and next-stage buttons beside the track, each ≥ 44 × 44 px,
  disabled at the ends of the range with a stated reason. The stage readout moves
  full-width above the track instead of into a fixed 128 px side column. The
  to-scale track, the selection bar, the REQ-005 range highlight, the REQ-002
  period bands and the keyboard slider semantics are all retained unchanged, and
  the track still accepts a direct tap and a drag-scrub. **Purely additive**; above
  the breakpoint nothing changes.
- **Test impact:** new e2e geometry assertions and a Vitest stepping test. No
  existing SPEC-009 test changes.
- **Human approval reference:** Owner approval: 2026-09-02, session `session_01GvwYfnCtWQGcynW17zS4su`, approving SPEC-030.

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [x] Open questions are resolved or explicitly deferred.
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed (`conflicts_with: SPEC-007`).
- [ ] Human approval recorded before status set to Approved (owner-directed the work;
      spec wording awaiting owner ratification on the PR).
</content>
</invoke>
