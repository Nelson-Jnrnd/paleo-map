---
doc_type: spec
spec_id: SPEC-029
title: A present-day map frame, toggleable at any age
status: Approved
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components:
  - src/app/state/frame.ts
  - src/app/state/viewport.ts
  - src/app/state/exploration.ts
  - src/app/components/OccurrenceMap.tsx
  - src/app/components/ContextBar.tsx
  - src/app/data/basemap.ts
  - scripts/fetch_basemap.ts
affected_interfaces:
  - FrameMode
  - positionIn
  - occurrencesInView
  - BasemapFrameIndex.present
supersedes: []
superseded_by:
depends_on:
  - SPEC-004
  - SPEC-008
  - SPEC-016
conflicts_with: []
last_verified_at:
---

# SPEC-029: A present-day map frame, toggleable at any age

## Summary

The atlas draws every fossil on a reconstructed Mesozoic coastline. The owner
asked for the other view: "the map of 'now' to see where the fossils were found
relative to today… available at any age through a toggle."

This spec adds a **frame toggle** to the exploration view. In present-day mode
the map draws a 0 Ma coastline and plots each occurrence at its **recorded
collection coordinates**; in paleogeographic mode it keeps today's behaviour
exactly. The timeline keeps choosing *which* fossils are shown in both modes —
only the map stops moving.

## Context

Measured on the shipped snapshot (`retrievedOn 2026-07-26`) on 2026-09-01.

- Every occurrence already carries **both** positions: `modernPosition`
  (`lat`, `lng`, `region`) and `paleoPosition` (`palaeoLat`, `palaeoLng`,
  `rotationModel`, `reconstructionAgeMa`). `modernPosition` has usable
  coordinates for **41,116 of 41,116** occurrences — 100%. No pipeline work is
  needed to place a dot in present-day mode.
- The coastline is the only missing asset. `scripts/fetch_basemap.ts` already
  pulls each of the 30 stage frames from the GPlates Web Service using the
  PALEOMAP model; a present-day frame is the same call at `time=0`.
- Seven places read `paleoPosition` directly (`OccurrenceMap` ×3,
  `viewport.ts` ×2, `grouping.ts`, `OccurrencePanel`). That is why this needs a
  spec rather than a patch: if some of them follow the toggle and others do
  not, the map shows dots in one frame over a coastline in another, which is
  precisely the misregistration **SPEC-016** exists to prevent.

## Problem statement

The atlas can say *when* and *where in the Mesozoic* a fossil was found, but not
where it is **now** — which is the form of the question a reader most often
arrives with, and the only form that can be acted on.

## Goals

- Show occurrences on a present-day map, at any selected age.
- Keep the dots and the coastline in one frame at all times.
- Never present a recorded coordinate as a reconstruction, or the reverse.

## Non-goals

- **Not** changing which occurrences are selected by the timeline, the grouping
  modes, the Wikipedia gate, or clustering.
- **Not** re-reconstructing anything. Present-day mode plots the coordinates the
  source already recorded.
- **Not** adding a third frame, an animation between frames, or a per-occurrence
  frame. One toggle, two states.
- **Not** refetching the 30 committed stage frames.

## Users or actors

A reader exploring the map, on desktop or phone, with or without a pointer.

## Functional requirements

### REQ-001: A present-day coastline frame ships with the basemap

- **Statement:** `public/basemap/present.geojson` and its `present.meta.json`
  hold a 0 Ma coastline, produced by the same service, model and simplification
  as every stage frame (GPlates Web Service, PALEOMAP, Douglas–Peucker at the
  existing tolerance). The basemap index gains a **top-level `present`
  descriptor**, a sibling of `frames` and never a member of it. It is written by
  `pnpm run fetch:basemap -- --present-only`, which refreshes only this frame and
  leaves the 30 committed stage frames untouched; a full run writes it too, so
  the two paths cannot diverge.
- **Rationale:** Same source and same simplification means the two frames a
  reader toggles between are the same kind of object, drawn the same way, with
  only the age different — a difference in the map, not in the mapping.
  It sits **outside `frames`** because `selectFrame` resolves a stage to the
  nearest available frame *by age*; a 0 Ma frame inside that list could only ever
  be a wrong answer, and keeping it out makes that unreachable by construction
  rather than by a guard someone can delete. `--present-only` exists because
  refetching all 30 frames would rewrite committed data for no reason, and every
  refetch is a live service call whose output can drift.
- **Acceptance criteria:**
  - The index has a `present` descriptor with `targetAgeMa: 0`, and `frames`
    contains no entry with `targetAgeMa` below the Mesozoic.
  - `selectFrame` never returns the present-day frame for any stage.
  - The frame is ≤ 64 KB gzipped (measured: 414 polygons, 31 KB gz).
  - Its meta names the source, the model, the licence and the 0 Ma age.
- **Verification method:** automated test against the shipped artifact.
- **Evidence location:** `test/spec029-present-frame.test.ts`

### REQ-002: One toggle switches the frame, at any age

- **Statement:** The exploration view offers a two-state control —
  **Paleogeographic** (the default) and **Present day** — available in every
  state in which the map is available, at every selected age. It is a
  single-choice group, keyboard-operable, with its state exposed to assistive
  technology and carried by more than colour. Switching it changes **the
  coastline and the plotted positions together, in the same render**; neither can
  change without the other.
- **Rationale:** The owner's request, 2026-08-26. "Together" is the load-bearing
  word: SPEC-016 REQ-001 aligned occurrences to the frame age precisely so a dot
  and the land under it describe one moment, and a toggle that moved one and not
  the other would undo that. Defaulting to paleogeographic keeps the product's
  subject — deep time — as the thing you see first.
- **Acceptance criteria:**
  - The control is present at every stage, and switching at any stage works.
  - In present-day mode the drawn coastline is the 0 Ma frame **and** every
    plotted point is a `modernPosition`; in paleogeographic mode both are the
    stage's frame and `paleoPosition`. No state mixes them.
  - The choice survives a timeline step (stepping the age does not silently
    return to paleogeographic).
  - The active option is conveyed by text weight and a rule plus `aria-checked`,
    never by colour alone.
- **Verification method:** automated test (rendered view + pure selection).
- **Evidence location:** `test/ui/spec029-frame-toggle.test.tsx`

### REQ-003: Every position read goes through one accessor

- **Statement:** A single pure function resolves an occurrence's plotted
  position for a frame mode:
  `positionIn(occurrence, mode): { lng, lat } | null`. Every consumer that
  places an occurrence on the map or derives a viewport from one — the
  occurrence points, the locality markers, the viewport filter, the camera fit —
  takes its coordinates from it. No consumer reads `paleoPosition` or
  `modernPosition` directly for the purpose of placing a point.
- **Rationale:** Seven direct reads is seven chances for one of them to be
  missed, and the failure mode is silent: a dot in the wrong hemisphere looks
  like data, not like a bug. One accessor makes "the dots and the coastline share
  a frame" a property of the code rather than a thing to remember.
  `OccurrencePanel` is deliberately exempt: it *reports* both positions as facts
  about the occurrence rather than placing anything, and must keep doing so.
- **Acceptance criteria:**
  - `positionIn` is pure, total, and returns null only when the frame's position
    is absent.
  - No placement site reads `paleoPosition`/`modernPosition` directly, verified
    by an automated source check.
  - Both modes are covered for a locality group as well as a single occurrence.
- **Verification method:** automated test (pure function + source scan).
- **Evidence location:** `test/spec029-frame-positions.test.ts`

### REQ-004: The timeline still filters in present-day mode, and says so

- **Statement:** In present-day mode the selected age continues to determine
  **which** occurrences are shown; only the basemap stops changing with it. The
  view states this on screen while present-day mode is active, in one line, in
  domain language.
- **Rationale:** Without it the control reads as "show everything, on a modern
  map", and a reader would take a Maastrichtian-only scatter for the whole
  record. The timeline is still doing its job; the screen has to say that, because
  the usual cue — the coastline changing as you step — is exactly what has been
  turned off.
- **Acceptance criteria:**
  - Stepping the age in present-day mode changes the plotted set.
  - The statement is rendered whenever present-day mode is active, and absent
    otherwise.
  - It names the age filter, not the map.
- **Verification method:** automated test (rendered view).
- **Evidence location:** `test/ui/spec029-frame-toggle.test.tsx`

### REQ-005: Present-day dots are disclosed as recorded coordinates

- **Statement:** While present-day mode is active, the map's attribution
  discloses that the points are the **coordinates recorded with each collection**
  and not reconstructions, and names the frame as present-day coastlines with its
  source and licence. The paleogeographic mode's existing disclosure —
  reconstruction model, frame age, and the frame-mismatch note — is unchanged and
  must not appear in present-day mode, where it would be false.
- **Rationale:** Charter §2. The two modes make different kinds of claim: one is
  a reconstruction under a stated rotation model, the other is a recorded
  observation. Showing a reconstruction's provenance over recorded coordinates
  would misattribute them, and it is the more dangerous direction because it
  makes the weaker claim look stronger.
- **Acceptance criteria:**
  - In present-day mode the attribution names present-day coastlines and states
    that the points are recorded collection coordinates.
  - The rotation-model and frame-age disclosures do not appear in present-day
    mode.
  - Switching back restores the paleogeographic disclosure unchanged.
- **Verification method:** automated test (rendered view).
- **Evidence location:** `test/ui/spec029-frame-toggle.test.tsx`

## Non-functional requirements

### NFR-001: No new upstream dependency at runtime

- **Statement:** The present-day frame is a committed artifact fetched from our
  own origin, like every other frame. No new host is contacted at runtime.
- **Rationale:** SPEC-001 DATA-005.
- **Acceptance criteria:** the app fetches only `basemap/present.geojson` and
  `basemap/present.meta.json` in addition to what it already fetched.
- **Verification method:** automated test.
- **Evidence location:** `test/ui/spec029-frame-toggle.test.tsx`

### NFR-002: The accessor is pure and browser-free

- **Statement:** `positionIn` and the frame-aware viewport helpers take plain
  values and return plain values, testable without a DOM.
- **Rationale:** The precedent SPEC-025 NFR-002 set — placement is decided before
  anything is drawn.
- **Acceptance criteria:** every case covered by a test importing no React.
- **Verification method:** automated test.
- **Evidence location:** `test/spec029-frame-positions.test.ts`

### NFR-003: Switching frames does not refetch occurrences

- **Statement:** Toggling the frame re-projects the occurrences already loaded.
  It issues no per-stage data fetch and does not reset the timeline.
- **Rationale:** The stage's occurrences are the same set in either frame; only
  their coordinates differ. A refetch would be a visible stall for no new data.
- **Acceptance criteria:** no `stage-*.json` request is made on a frame switch.
- **Verification method:** automated test.
- **Evidence location:** `test/ui/spec029-frame-toggle.test.tsx`

## Security and privacy considerations

### SEC-001: No new data class

- **Statement:** The frame introduces no new data about people and no new
  egress. Collection coordinates are already in the shipped snapshot and are
  already displayed by `OccurrencePanel`.
- **Rationale:** completeness.
- **Acceptance criteria:** the diff adds no new network host and no new field to
  the occurrence model.
- **Verification method:** inspection + the existing no-egress tests.
- **Evidence location:** `test/ui/spec029-frame-toggle.test.tsx`

## Data model impact

### DATA-001: `BasemapFrameIndex.present`

- **Statement:** `BasemapFrameIndex` gains an optional `present` field:

  ```json
  { "targetAgeMa": 0,
    "geojsonUrl": "basemap/present.geojson",
    "metaUrl": "basemap/present.meta.json" }
  ```

  Optional, so an index without one is valid and simply offers no toggle
  (UX-002). `ReadOccurrence` is **not** changed — both positions are already on
  it.
- **Rationale:** As REQ-001. Optional rather than required because the app must
  still boot against an older committed index.
- **Acceptance criteria:** an index with no `present` parses, and the view
  withholds the toggle rather than failing.
- **Verification method:** automated test.
- **Evidence location:** `test/spec029-present-frame.test.ts`

## UI or UX impact

### UX-001: The toggle sits with the other view controls

- **Statement:** The control lives in the exploration context row, beside the
  selected age, the group and the occurrence count — not as a new map overlay.
- **Rationale:** It answers the same class of question as its neighbours ("what
  am I looking at"), and the context row is where the reader already looks for
  that. It also keeps SPEC-023's overlay layout — and the non-overlap gate that
  polices it — untouched, which a new floating control would not.
- **Acceptance criteria:** no new absolutely-positioned map overlay is added, and
  SPEC-023's overlay gate passes unchanged.
- **Verification method:** automated test + the existing e2e overlay gate.
- **Evidence location:** `test/e2e/map-overlays.e2e.ts`

### UX-002: Every state is designed

- **Statement:** Designed and implemented: paleogeographic mode (unchanged);
  present-day mode with occurrences; present-day mode with none at the selected
  age; and **the present-day frame absent from the index**, in which case the
  toggle is withheld and the map behaves exactly as it does today. None is a
  blank surface, and none is a broken control.
- **Rationale:** Charter §7 — real states are designed, and a missing artifact is
  disclosed rather than left as a dead control.
- **Acceptance criteria:** each state renders a distinct, labelled surface; with
  no `present` in the index no toggle is rendered at all.
- **Verification method:** automated test.
- **Evidence location:** `test/ui/spec029-frame-toggle.test.tsx`

### UX-003: Accessibility

- **Statement:** The toggle is keyboard operable with a visible focus indicator,
  labelled, and its state is exposed via `aria-checked`; the frame change is
  announced once. The axe gate passes in both modes.
- **Rationale:** the repository's standing axe gate and PERF-250.
- **Acceptance criteria:** axe reports no new violations in either mode; the
  control is reachable and operable by keyboard.
- **Verification method:** automated test (Playwright + axe).
- **Evidence location:** `test/e2e/a11y.e2e.ts`

## Configuration impact

- The frame's URLs are index-driven, not constants. The simplification tolerance
  is the existing `SIMPLIFY_TOLERANCE`, shared with every stage frame.

## Error handling

- No `present` in the index → no toggle (UX-002); everything else unchanged.
- The present-day GeoJSON fails to load → the map degrades to the graticule,
  exactly as a missing stage frame already does, and discloses it.
- An occurrence with no position in the active frame is not plotted and not
  listed, which is the rule the paleo frame already follows.

## Edge cases

- **Antimeridian.** The viewport's shorter-arc logic is frame-agnostic — it
  operates on longitudes, whichever frame produced them — so a Pacific-rim set
  frames correctly in both modes.
- **A stage with no coastline frame** keeps its existing nearest-frame fallback
  in paleogeographic mode; present-day mode is unaffected, since its frame does
  not depend on the stage.
- **Switching mid-selection.** A selected occurrence stays selected across a
  frame switch; only where it is drawn changes.

## Acceptance criteria

Complete when every requirement passes its stated verification, the governance
scripts pass, and both modes render correctly in a real browser with no console
error.

## Verification matrix

| Requirement | Method | Evidence |
| --- | --- | --- |
| REQ-001 | automated | `test/spec029-present-frame.test.ts` |
| REQ-002 | automated | `test/ui/spec029-frame-toggle.test.tsx` |
| REQ-003 | automated | `test/spec029-frame-positions.test.ts` |
| REQ-004 | automated | `test/ui/spec029-frame-toggle.test.tsx` |
| REQ-005 | automated | `test/ui/spec029-frame-toggle.test.tsx` |
| NFR-001 | automated | `test/ui/spec029-frame-toggle.test.tsx` |
| NFR-002 | automated | `test/spec029-frame-positions.test.ts` |
| NFR-003 | automated | `test/ui/spec029-frame-toggle.test.tsx` |
| SEC-001 | inspection + automated | `test/ui/spec029-frame-toggle.test.tsx` |
| DATA-001 | automated | `test/spec029-present-frame.test.ts` |
| UX-001 | automated + e2e | `test/e2e/map-overlays.e2e.ts` |
| UX-002 | automated | `test/ui/spec029-frame-toggle.test.tsx` |
| UX-003 | automated + axe | `test/e2e/a11y.e2e.ts` |

## Test plan

1. `test/spec029-present-frame.test.ts` — the shipped artifact's shape, size,
   meta, and that `selectFrame` cannot return it for any stage.
2. `test/spec029-frame-positions.test.ts` — `positionIn` in both modes, the
   null cases, frame-aware `occurrencesInView`, and a source scan asserting no
   placement site reads a position field directly.
3. `test/ui/spec029-frame-toggle.test.tsx` — the rendered toggle, both modes,
   the age filter still applying, the disclosures, every designed state, and the
   absent-frame degradation.
4. Existing suites that must stay green **unmodified**: `viewport.test.ts`
   (the mode defaults to paleo), `grouping.test.ts`, `locality-mode`,
   `taxon-mode`, `spec027-*`.

## Rollback plan

Revert the PR. `present.geojson`/`present.meta.json` become unreferenced; the
`present` key in the index is ignored by the previous code, which reads only
`frames`. No committed stage frame and no snapshot artifact is touched.

## Open questions

- **OQ-001:** Whether present-day mode should also offer a modern *basemap tile*
  layer (labels, borders) rather than the PALEOMAP 0 Ma coastline. Deferred: the
  coastline keeps the product's cartography and adds no tile dependency, and the
  charter's light bathymetric world is the look either way.

## Human decisions required

- **Decided by the owner, 2026-08-26:** a present-day map, available at any age,
  behind a toggle.
- **Decided by this spec, flagged for review:** the toggle lives in the context
  row rather than as a map overlay (UX-001); paleogeographic stays the default
  (REQ-002); the present frame sits outside `frames` (REQ-001); and
  `OccurrencePanel` keeps reading both positions directly because it reports
  rather than places (REQ-003).

## Conflict check

- **SPEC-016** (frame-consistent reconstruction) is upheld, not weakened:
  REQ-002 requires the coastline and the points to change together, which is that
  spec's premise applied to a second frame.
- **SPEC-008 REQ-004** (`selectFrame`, nearest-frame fallback) is untouched — the
  present frame is deliberately outside the list it searches.
- **SPEC-023** (map overlay layout) is untouched: UX-001 puts the control in the
  context row, so no new overlay enters the non-overlap gate.
- **SPEC-004 REQ-002** pins the basemap to the occurrences' rotation model. In
  present-day mode there is no reconstruction to match, and REQ-005 requires the
  disclosure to say so rather than assert a model.
- No conflict with SPEC-009 (timeline), which keeps its role by REQ-004.

## Traceability table

| Requirement | Implementation | Test | Status |
| --- | --- | --- | --- |
| REQ-001 | `scripts/fetch_basemap.ts` (`--present-only`), `public/basemap/present.*` | `test/spec029-present-frame.test.ts` | Implemented |
| REQ-002 | `ContextBar.tsx`, `state/exploration.ts` (`setFrameMode`), `OccurrenceMap.tsx` | `test/ui/spec029-frame-toggle.test.tsx` | Implemented |
| REQ-003 | `state/frame.ts` (`pointIn`/`positionIn`), `state/viewport.ts`, `state/grouping.ts` | `test/spec029-frame-positions.test.ts` | Implemented |
| REQ-004 | `ExplorationView.tsx` — the note under the timeline | `test/ui/spec029-frame-toggle.test.tsx` | Implemented |
| REQ-005 | `OccurrenceMap.tsx` — the split attribution | `test/ui/spec029-frame-toggle.test.tsx` | Implemented |
| NFR-001 | `data/basemap.ts`, committed frame | `test/ui/spec029-frame-toggle.test.tsx` | Implemented |
| NFR-002 | `state/frame.ts` | `test/spec029-frame-positions.test.ts` | Implemented |
| NFR-003 | frame-mode effect deps in `OccurrenceMap.tsx` | `test/ui/spec029-frame-toggle.test.tsx` | Implemented |
| SEC-001 | no new field, no new host | `test/ui/spec029-frame-toggle.test.tsx` | Implemented |
| DATA-001 | `data/basemap.ts` — `BasemapFrameIndex.present` | `test/spec029-present-frame.test.ts` | Implemented |
| UX-001 | the control in the context row | `test/e2e/map-overlays.e2e.ts` | Implemented |
| UX-002 | `presentFrameAvailable` in `ExplorationView.tsx` | `test/ui/spec029-frame-toggle.test.tsx` | Implemented |
| UX-003 | `.frameOption*` + `aria-checked` | `test/e2e/a11y.e2e.ts` | Implemented |

## Implementation notes

- The present-day frame was fetched on 2026-09-01 from
  `https://gws.gplates.org/reconstruct/coastlines/?time=0&model=paleomap`:
  2,393 raw polygons, 414 after the existing simplification, 31 KB gzipped.
  Spot-checked against known geography — Utah, the Sahara and Mongolia fall on
  land, the mid-Atlantic does not.
- **Verified in Chromium** at 1440×900 on the shipped snapshot: the toggle
  switches the coastline and the plotted points together, the occurrence count
  moves with the frame (1,266 in view paleogeographic → 1,280 present-day, the
  same stage — the reconstruction and the modern coordinates fall inside the
  camera's box differently), zero console errors in either mode.
- **REQ-004's note was initially placed inside the map pane and was invisible**:
  `.mapPane` is a positioning context and the map canvas is drawn over it, so a
  normal-flow child sits underneath. It measured as present, visible and in the
  viewport while being painted over — a reminder that "the element is there" is
  not the same claim as "a reader can see it". It now sits under the timeline,
  which is also the control it is talking about.
- **A pre-existing defect surfaced, and is fixed here.** SPEC-029's new axe case
  failed on `scrollable-region-focusable` in present-day mode. The cause was not
  this feature: `.cladeKeyBody` has been scrollable-but-unfocusable since
  SPEC-023, and axe flags it at 1280×700 and below in the *shipped
  paleogeographic default*. It escaped the standing gate only because that gate
  runs at 1280×720, a couple of pixels above the threshold; REQ-004's note takes
  about 33 px of the map pane, which pushed the default viewport over the line.
  Recorded and fixed under SPEC-023 REQ-004, with a regression case at a viewport
  where the key actually overflows. Re-verified with axe across five viewports in
  both frame modes: zero serious violations in all ten.
- **UX-001 checked rather than assumed**: the map's overlay set after this change
  is `wikipedia-gate`, `basemap-attribution`, `clade-key` — unchanged — and the
  toggle is outside `[data-map-pane]` entirely.

## Spec amendments

None yet.

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are stated.
- [x] Conflicts with existing specs are checked and recorded.
- [x] Every claim of fact is measured, with the measurement recorded.
- [x] Every real state is designed, not just the happy path.
