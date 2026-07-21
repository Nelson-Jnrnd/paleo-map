---
doc_type: spec
spec_id: SPEC-005
title: Aggregated, viewport-linked occurrence list
status: Implemented
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: [6]
affected_components: [app-frontend, exploration-view, map-rendering, occurrence-list]
affected_interfaces: []
supersedes: []
superseded_by:
depends_on: [SPEC-003, SPEC-004]
conflicts_with: []
last_verified_at: 2026-07-13
---

# SPEC-005: Aggregated, viewport-linked occurrence list

## Summary

Replaces the flat, 200-row-capped occurrence list (SPEC-003 AMEND-001) with a
list that (1) **aggregates occurrences by taxon** (default) or formation, showing
each group with its occurrence count and an expandable disclosure, and (2) is
**linked to the map viewport** — it reflects the occurrences currently in view and
updates as the user pans/zooms. This dissolves the "thousands of DOM rows at real
scale" problem instead of managing it, and matches the atlas's actual job
("*which* dinosaurs, and *where*") rather than dumping a flat list. The map remains
the complete, clustered view; the list is the domain-meaningful, keyboard-reachable
path into it.

## Context

At real scale a stage holds thousands of occurrences (SPEC-003 AMEND-001 shipped
478 taxa / 4,187 occurrences). The interim fix rendered the first 200 rows with a
"narrow to see the rest" hint. That is honest but crude: most occurrences aren't in
the list, and a flat list of 4,187 was never the right information architecture for
a map-first atlas. This spec refines SPEC-003 REQ-003's *presentation* (the data,
selection loop, and provenance rules are unchanged) and supersedes the AMEND-001
flat cap. It builds on the existing MapLibre map (SPEC-004) for the viewport signal.

## Problem statement

The occurrence list must stay fast and meaningful at real dataset size without
hiding data: a user should see *what taxa are here and where*, reach any occurrence
through a bounded, keyboard-operable path, and have the list track what they are
looking at on the map — all in-memory, with no runtime backend.

## Goals

- Aggregate the list by **taxon** (default) or **formation**, with per-group counts,
  sorted by count; expandable to the group's occurrences.
- **Link the list to the map viewport**: show occurrences in the current view and
  update on pan/zoom; state the in-view counts.
- Keep the DOM **bounded** regardless of dataset size (grouped headers + a per-group
  occurrence cap), so the flat-cap problem cannot recur.
- Preserve the exploration loop and provenance rules from SPEC-003 (selection →
  panel → profile; source/uncertainty per occurrence; ≤2 actions to a profile from
  a map marker).
- Never hide data: occurrences with no mappable paleoposition stay listed, and a
  panned-away empty view is a recoverable state, not a dead end.

## Non-goals

- Free-text search, multi-facet filters, the classification browser (other slices).
- List virtualization of a single flat list (this spec removes the need for it by
  aggregating + viewport-linking; virtualization remains a fallback if a single
  group is ever huge).
- Changing the map's clustering, the basemap, the snapshot, or SPEC-001 data.
- Per-stage coastlines, spatial indexing structures (a linear scan is ample at MVP
  volume — NFR-001).

## Users or actors

The **Explorer**: zooms to a region and asks "what dinosaurs are known here?"; the
list answers with taxa + counts in view and drills to occurrences and profiles.

## Functional requirements

### REQ-001: Aggregate the list by taxon (default) or formation

- **Statement:** The occurrence list must group the occurrences it shows by **taxon**
  by default, and offer a **formation** grouping alternative. Each group renders a
  header with the group label (taxon scientific name in italics, or formation name)
  and its occurrence count, sorted by count descending then label; each header is a
  keyboard-operable disclosure that expands to the group's occurrence rows.
- **Rationale:** Aggregation is the domain-meaningful view ("which taxa, where") and
  bounds the top-level DOM to the number of groups, not occurrences (FONC-680 explore
  by taxonomic group; charter §3/§6).
- **Acceptance criteria:** With N occurrences over K taxa, the collapsed list shows K
  group headers with correct counts, sorted by count; toggling a header reveals/hides
  that group's occurrence rows via the keyboard; a group-by control switches between
  taxon and formation.
- **Verification method:** automated component test + unit test of the grouping.
- **Evidence location:** `test/ui/aggregate.test.ts`, `test/ui/occurrence-list.test.tsx`.

### REQ-002: Viewport-linked to the map

- **Statement:** When the map is available, the list must reflect the occurrences
  within the **current map viewport** and update when the user pans/zooms; a header
  must state the in-view taxon and occurrence counts. Occurrences with **no mappable
  paleoposition** must remain listed regardless of the viewport (a spatial filter
  must not hide unplaceable data).
- **Rationale:** Ties the list to what the user is looking at, keeping it small and
  relevant when zoomed; never hides data (charter §2). PERF-030 (in-memory update).
- **Acceptance criteria:** The map reports its bounds on load and on `moveend`; the
  list narrows to occurrences whose paleoposition is inside those bounds, plus all
  occurrences lacking a paleoposition; the header shows "… in view"; panning changes
  the set without a reload.
- **Verification method:** unit test of the bounds filter + component test of the
  in-view header; manual/E2E for the live pan behavior.
- **Evidence location:** `test/ui/aggregate.test.ts`, `src/app/components/OccurrenceMap.tsx`.

### REQ-003: Preserve the exploration loop and provenance

- **Statement:** Selecting an occurrence within a group must open the occurrence
  panel (→ taxon profile) exactly as in SPEC-003; each occurrence row must keep its
  source and reconstructed/approximate/missing cues; a taxon group header must offer
  **direct access to the taxon profile**; the map-marker path to a profile (≤2
  actions, FONC-1070) is unchanged.
- **Rationale:** SPEC-003 REQ-003/006/007; FONC-270/1070/1100/1130/1140; charter §2.
- **Acceptance criteria:** Expanding a group and activating an occurrence opens its
  panel; the "Open taxon profile" flow works; a group header's profile action opens
  the taxon profile; occurrence rows still show source + uncertainty cues.
- **Verification method:** scenario test (PERF-340) + component test.
- **Evidence location:** `test/ui/scenario-perf-340.test.tsx`, `test/ui/occurrence-list.test.tsx`.

### REQ-004: Bounded rendering (supersedes the SPEC-003 AMEND-001 flat cap)

- **Statement:** The rendered DOM must stay bounded regardless of dataset size:
  groups are collapsed by default (so the baseline is one header per group), and an
  expanded group renders at most a capped number of occurrence rows with an explicit
  "showing X of Y — zoom in" affordance when exceeded. The map remains the complete
  view. This replaces the SPEC-003 AMEND-001 flat 200-row cap.
- **Rationale:** Prevent the flat-list DOM blow-up from recurring at any scale
  (PERF-020/030) while never claiming to show more than it does.
- **Acceptance criteria:** With a taxon of many occurrences, the collapsed header
  shows the true count; expanding renders at most the per-group cap plus the
  overflow affordance; total rendered occurrence rows never approach the dataset size.
- **Verification method:** component test with a large synthetic group.
- **Evidence location:** `test/ui/occurrence-list.test.tsx`.

### REQ-005: Graceful no-map / empty-view modes

- **Statement:** When the map/WebGL is unavailable, the list must show **all**
  filtered occurrences grouped (no viewport filter), still bounded and keyboard-
  reachable. When the map is available but the current view contains no occurrence
  (panned away), the list must show a recoverable "no occurrences in this view"
  message, distinct from the no-results-for-filters empty state.
- **Rationale:** All real states designed (charter §7); the accessible list path must
  survive without the canvas (SPEC-002 a11y edge case).
- **Acceptance criteria:** With no map viewport signal, the list groups the full
  filtered set; with an empty viewport but non-empty filter, an in-view empty message
  with a recovery hint is shown, not the filter empty state.
- **Verification method:** component test.
- **Evidence location:** `test/ui/occurrence-list.test.tsx`.

## Non-functional requirements

### NFR-001: In-memory, O(n), within PERF-030

- **Statement:** Viewport filtering and grouping must be pure in-memory operations
  (a linear scan + grouping) over the loaded occurrences, with no I/O, completing
  well within PERF-030 (≤1 s) on each pan/zoom at MVP volume.
- **Rationale:** The static-client budgets (SPEC-002 NFR-001; PERF-030).
- **Acceptance criteria:** No network on pan/zoom; filter+group is O(n) over the
  in-memory set; interaction stays responsive at ~4k occurrences.
- **Verification method:** code inspection + the live E2E pan remaining responsive.
- **Evidence location:** `src/app/state/aggregate.ts`.

## Security and privacy considerations

None beyond SPEC-002/003: no new data, no egress, no secrets. The viewport signal is
in-memory only.

## Data model impact

None. Consumes the existing `ReadOccurrence`/`ReadApi`; adds only view-layer
grouping/bounds helpers. No DATA IDs.

## API impact

None (no runtime API). Internal component contract only: the map reports its bounds
to the exploration view via a callback.

## UI or UX impact

Refines SPEC-003 REQ-003's list *presentation* (grouped + viewport-linked). Creates
no new product UX IDs; requirements remain the functional specification's. Must stay
within the design charter (domain language, one accent, provenance legible).

## Configuration impact

Adds view-layer constants (per-group occurrence cap). No env/secrets.

## Error handling

- No viewport signal (no map) → group the full filtered set (REQ-005).
- Empty viewport with non-empty filter → recoverable in-view empty message (REQ-005).
- Group exceeds the cap → explicit "showing X of Y — zoom in" (REQ-004).

## Edge cases

- Occurrence without a paleoposition → always listed, flagged, never hidden by the
  spatial filter (REQ-002).
- Antimeridian-wrapping viewport bounds (west > east) → handled as a wrap in the
  bounds test (recorded assumption; MVP data does not straddle it heavily).
- A taxon with hundreds of in-view occurrences → per-group cap + zoom-in hint (REQ-004).
- Very many taxa in view at world zoom → collapsed headers only (bounded); a
  header-count cap is a recorded follow-up if the taxon count itself grows large.

## Acceptance criteria

Satisfied when the list groups occurrences by taxon (default) or formation with
counts and keyboard-operable disclosure (REQ-001); tracks the map viewport and states
in-view counts while never hiding unplaceable occurrences (REQ-002); preserves the
selection→panel→profile loop, per-occurrence provenance, and a direct taxon-profile
action (REQ-003); keeps the DOM bounded at any scale, replacing the flat cap
(REQ-004); degrades gracefully with no map and shows a recoverable empty-view state
(REQ-005); and does all filtering/grouping in-memory within PERF-030 (NFR-001).

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Grouped headers + counts + toggle + group-by | automated | unit + component | `test/ui/aggregate.test.ts`, `test/ui/occurrence-list.test.tsx` | #6 |
| REQ-002 | Viewport narrows list; missing-paleo kept | automated | unit bounds + component header | `test/ui/aggregate.test.ts` | #6 |
| REQ-003 | Loop + provenance + header profile action | automated | PERF-340 + component | `test/ui/scenario-perf-340.test.tsx` | #6 |
| REQ-004 | Bounded DOM; per-group cap + overflow hint | automated | component (large group) | `test/ui/occurrence-list.test.tsx` | #6 |
| REQ-005 | No-map grouping; empty-view message | automated | component | `test/ui/occurrence-list.test.tsx` | #6 |
| NFR-001 | In-memory O(n), no I/O on pan | inspection + E2E | code + live pan | `src/app/state/aggregate.ts` | #6 |

## Test plan

- Unit (`test/ui/aggregate.test.ts`): `groupOccurrences` (taxon/formation, counts,
  order), `withinBounds`/`inViewport` (inside/outside, wrap, missing-paleo kept).
- Component (`test/ui/occurrence-list.test.tsx`): grouped headers + counts, toggle,
  group-by switch, per-group cap + overflow, no-map grouping, empty-view message.
- Scenario (`test/ui/scenario-perf-340.test.tsx`): expand a group → select an
  occurrence → panel → profile → back.
- E2E: pan the map and see the in-view list update; data-agnostic loop.

## Rollback plan

Additive to the view layer: revert the list component + `aggregate.ts` + the map's
`onViewportChange` wiring to restore the SPEC-003 AMEND-001 flat capped list. No data,
pipeline, or map-rendering change to undo.

## Open questions

- [x] Header-count cap if in-view taxa themselves grow large — **resolved**:
  `GROUP_HEADER_CAP = 200` (count-sorted, so most abundant first) with a "showing
  the top N of M — narrow/zoom" affordance; the selected group is always surfaced
  (`test/ui/occurrence-list.test.tsx`).
- [ ] Whether formation grouping should show stratigraphic order rather than count
  order (deferred; count order for both for now).

## Human decisions required

- [x] Build the **aggregate-by-taxon/formation + viewport-linked** list and ship it —
  directed by the owner ("Aggregate-by-taxon/formation + viewport-linked. spec it and
  do it"), 2026-07-13. Owner ratified 2026-07-21 ("I approve them, it's all good").

## Conflict check

Depends on and refines SPEC-003 (exploration view) and SPEC-004 (map viewport
source). It **supersedes SPEC-003 AMEND-001's flat 200-row cap** with aggregation +
viewport-linking + a per-group cap; it changes no product requirement (those remain
in the functional specification) and no SPEC-001/002 decision. No blocking conflict;
`depends_on: [SPEC-003, SPEC-004]` recorded.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Grouping | `src/app/state/aggregate.ts`, `src/app/components/OccurrenceList.tsx` | `test/ui/aggregate.test.ts` | Implemented |
| REQ-002 | Viewport link | `OccurrenceMap.tsx` (onViewportChange), `ExplorationView.tsx`, `aggregate.ts` | `test/ui/aggregate.test.ts` | Implemented |
| REQ-003 | Loop | `OccurrenceList.tsx`, `OccurrencePanel.tsx` | `test/ui/scenario-perf-340.test.tsx` | Implemented |
| REQ-004 | Bounded render | `OccurrenceList.tsx` | `test/ui/occurrence-list.test.tsx` | Implemented |
| REQ-005 | Fallback/empty | `OccurrenceList.tsx`, `ExplorationView.tsx` | `test/ui/occurrence-list.test.tsx` | Implemented |
| NFR-001 | Filter/group | `src/app/state/aggregate.ts` | inspection | Implemented |

## Implementation notes

Implemented on branch `claude/exploration-view-ui-slice-pf0cso`.

- **Grouping (REQ-001):** `src/app/state/aggregate.ts#groupOccurrences` (taxon/
  formation, count-desc order); `OccurrenceList.tsx` renders collapsed disclosure
  headers with counts, a By-taxon/By-formation toggle, and a per-group `Profile →`
  action for taxa.
- **Viewport link (REQ-002):** `OccurrenceMap.tsx` reports bounds on load + each
  `moveend`; `ExplorationView` narrows via `inViewport`; occurrences with no
  paleoposition are always kept. Verified live in-browser: zooming into North
  America drops the in-view count (E2E `SPEC-005: the list is viewport-linked`).
- **Bounded DOM (REQ-004):** collapsed headers + `GROUP_OCC_CAP = 50` per expanded
  group with a "showing X of Y — zoom in" hint; replaces the SPEC-003 AMEND-001
  flat 200-row cap. At real scale the shipped app shows e.g. "192 taxa · 2,138
  occurrences in view" with only group headers in the DOM until expanded.
- **Fallback/empty (REQ-005):** no-map ⇒ group the full filtered set; empty
  viewport ⇒ recoverable "no occurrences in this view" message.

**Real-data edge found + fixed:** some occurrences are identified only to an
indeterminate/higher rank (e.g. "Theropoda indet.") whose id is not in the genus
taxa list, so the taxon profile hit an unlabeled "Unknown taxon" dead end. The
profile fallback now renders an honest, navigable region ("Indeterminate
identification — no genus-level taxon record") — a SPEC-003 REQ-007 robustness fix
surfaced by this work (test in `test/ui/data-states.test.tsx`).

Verification: 57 unit/component tests (incl. `test/ui/aggregate.test.ts` and the
grouped-list suite) + 3 Playwright E2E green; `pnpm run build` within budget.

## Spec amendments

_None._

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [x] Open questions resolved or explicitly deferred.
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed (supersedes SPEC-003 AMEND-001 list cap).
- [x] Human approval recorded (owner-directed; owner ratified 2026-07-21).
