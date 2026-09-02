---
doc_type: spec
spec_id: SPEC-030
title: Phone layout — a portrait-phone form for the atlas
status: Draft
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components:
  - index.html
  - src/app/styles/tokens.css
  - src/app/styles/global.css
  - src/app/components/exploration.module.css
  - src/app/components/dailyGenus.module.css
  - src/app/components/ExplorationView.tsx
  - src/app/components/ContextBar.tsx
  - src/app/components/AppBar.tsx
  - src/app/components/TimelineControl.tsx
  - src/app/components/GroupingControls.tsx
  - src/app/components/OccurrenceMap.tsx
  - src/app/components/TaxonomySurfaces.tsx
  - test/e2e/map-overlays.e2e.ts
affected_interfaces:
  - SheetStop
  - usePointerCoarse
supersedes: []
superseded_by:
depends_on:
  - SPEC-003
  - SPEC-009
  - SPEC-015
  - SPEC-022
  - SPEC-023
  - SPEC-026
  - SPEC-029
conflicts_with: []
last_verified_at:
---

# SPEC-030: Phone layout — a portrait-phone form for the atlas

## Summary

The atlas is a desktop layout with no narrow-viewport treatment: on a 390 px
phone the page scrolls sideways to 607 px, fixed chrome takes 52% of the screen,
and what is left is a 226 px map beside a 164 px list whose overlays paint on top
of each other. This spec gives the app a **portrait-phone form** below a single
`40rem` breakpoint: a full-bleed map with the occurrence list as a **draggable
bottom sheet**, a timeline that can actually be aimed with a thumb, 44 px touch
targets on coarse pointers, and no hover-only information. Above the breakpoint
nothing changes.

## Context

The measured current state is recorded in
[`docs/reports/phone-responsiveness-analysis.md`](../../reports/phone-responsiveness-analysis.md)
(2026-09-02), which drove the built preview in headless Chromium at 320×568,
360×640, 390×664, 430×730 and 844×390. Its findings are referenced below as
**P-01 … P-21**. That report introduces no requirements; this spec does.

Three prior specs constrain the design and are not being reopened:

- **SPEC-009** gives the timeline its to-scale stepped track and the two-way
  map↔list highlight (REQ-005/REQ-006).
- **SPEC-023** gives the map its corner-rail overlay scheme and an automated
  non-overlap gate. P-10 shows the phone violates that scheme's own invariant;
  P-11 shows the gate cannot see it because its viewport matrix stops at 820 px.
- **SPEC-026** made the sidebar one five-unit selector over one list, where a
  selection *replaces* the list in the same column (REQ-003).

The functional specification also binds this work directly:

- **FONC-040/050/060** and **CONS-450** — the selected age, the selected group,
  the occurrence count and the main time/map/filter controls are **permanently
  displayed** on the exploration view. The phone layout may re-arrange them; it
  may not put any of them behind a disclosure.
- **CONS-490** — uncertainty information must not hide behind a secondary
  interaction. On a touch device "hover" *is* a secondary interaction that does
  not exist, which is what makes P-08 a compliance defect rather than polish.
- **PERF-080** (labels ≥ 12 px) and **PERF-120** (each point or cluster
  selectable within ≥ 24 × 24 px) stay in force. This spec raises the floor on
  coarse pointers; it does not lower it anywhere.

Finally, `docs/mockups/design-guidelines.md` is binding on all UI work and
contains **zero** mentions of viewport, breakpoint, touch or phone (P-20). The
charter therefore has to gain a viewport section as part of this work, or there
is no convention for the implementation to be correct against.

## Problem statement

The atlas cannot be used on a phone in portrait. The map is too small to read,
the timeline's stage steps measure 0.0 px wide, the list column is too narrow for
its own rows, controls sit off the right edge of the screen, and the map's own
overlays cover each other.

## Goals

- A portrait phone (320–430 px wide) can do the whole exploration loop: pick an
  age, read the map, open a row, reach a taxon profile, and get back.
- Every control is reachable and hittable with a thumb.
- Nothing that FONC-040/050/060 and CONS-450 require to be permanent becomes
  conditional.
- No information that a mouse user gets from hovering is lost on touch.
- The desktop layout is untouched.

## Non-goals

- **Phone landscape is out of scope** (owner decision, 2026-09-02). At 844×390
  the map is 108 px tall and no amount of stacking fixes it — there is not enough
  height. The layout must not *break* in landscape (no overflow, no overlap), but
  it is not designed for it. Recorded as a follow-up.
- **No tablet-specific layout.** One breakpoint, two layouts.
- **No change to what data is shown**, to clustering, to the Wikipedia gate's
  behaviour, to the frame toggle, or to any selection semantics. This is layout
  and input, not content.
- **No change to the desktop layout.** Above `40rem` the rendered result must be
  unchanged (NFR-002).
- **Not a PWA**, not offline install, not a native shell.
- **Not a redesign of the Dinordle screen or the taxon profile.** Both already
  hold up at 390 px (P-18, P-19); they receive only the global touch-target,
  input-size and hover fixes.

## Users or actors

The Explorer — the same single actor as SPEC-003 — arriving on a phone in
portrait, one-handed, on a device with a coarse pointer and no hover.

## Functional requirements

### REQ-001: One phone breakpoint

- **Statement:** The app defines exactly one width breakpoint, `40rem`
  (640 px at the default root size). At or below it the phone layout applies; above
  it the existing layout applies unchanged. The value is defined once and reused;
  the Dinordle board's existing `40rem` query (`dailyGenus.module.css:813`) is that
  same breakpoint, not a second one.
- **Rationale:** P-02 — the codebase has two unrelated ad-hoc queries and no
  system. One number keeps the two layouts describable and testable.
- **Acceptance criteria:** No width media query other than `40rem` exists in
  `src/app/**/*.css` after this change, except the taxon profile's existing
  `640px` `heroGrid` query, which is converted to `40rem` for consistency.
- **Verification method:** automated test (source inspection, Vitest)
- **Evidence location:** _filled at implementation_

### REQ-002: No horizontal overflow

- **Statement:** On every screen (map, taxonomy, Dinordle, taxon profile), at
  every viewport width from 320 px to 430 px, `document.documentElement.scrollWidth`
  equals `clientWidth`, and no element's border box extends past the viewport's
  left or right edge.
- **Rationale:** P-01, P-17 — the page currently scrolls to 607 px at every
  portrait width, putting "Reset view" and the "Present day" frame option off
  screen, which silently removes two controls FONC/CONS require to be available.
- **Acceptance criteria:** At 320, 360, 390 and 430 px wide, on each of the four
  screens: `scrollWidth === clientWidth`, and an enumeration of every rendered
  element finds none whose `getBoundingClientRect().right` exceeds `clientWidth`
  or whose `.left` is negative.
- **Verification method:** automated test (Playwright e2e)
- **Evidence location:** _filled at implementation_

### REQ-003: The phone map screen — full-bleed map, list as a bottom sheet

- **Statement:** At or below the breakpoint the exploration view lays out as a
  single column: a compact header (app bar + context line), the timeline, and then
  the map filling all remaining height. The occurrence list is not a side column
  but a **bottom sheet** drawn over the map, with three stops:
  - **peek** — the sheet's handle, the in-view count, and the unit selector;
  - **half** — approximately half the space below the timeline;
  - **full** — the maximum extent, which must still leave **at least 25%** of the
    space below the timeline showing the map.

  The sheet is moved between stops by dragging its handle or header, by tapping
  the handle (which advances to the next stop and wraps from full back to peek),
  and by keyboard when the handle has focus. The map behind the sheet stays
  interactive at every stop; the sheet is not a modal and does not trap focus.
- **Rationale:** P-05, P-09 — a two-column split at 390 px yields a 226 px map
  beside a 164 px list, and neither is usable. A sheet gives the map the whole
  screen and the list as much of it as the reader asks for, one gesture at a time.
  Owner decision, 2026-09-02 (bottom sheet over stacking or tabs).
- **Acceptance criteria:**
  1. At 390×664 the map's visible area is at least 55% of the space below the
     timeline when the sheet is at peek.
  2. At the full stop the map is still at least 25% of that space — it is never
     entirely covered.
  3. Dragging the handle from peek to full and back returns the sheet to the same
     geometry it started at.
  4. The handle is reachable by keyboard `Tab` and advances the stop on `Enter`
     and `Space`.
  5. The map responds to a pan gesture started outside the sheet at every stop.
- **Verification method:** automated test (Playwright e2e) + unit test for the
  stop-cycling logic (Vitest)
- **Evidence location:** _filled at implementation_

### REQ-004: The sheet preserves every selection behaviour

- **Statement:** The sheet is the phone form of the SPEC-026 sidebar and keeps
  its contract exactly: the five-unit selector is always present and operable;
  selecting a row **replaces** the list with that row's detail in the same
  container (SPEC-026 REQ-003); the back control returns to the list; selecting a
  feature on the map opens the same detail in the sheet; and the two-way
  map↔list highlight (SPEC-009 REQ-006) works in both directions. Selecting a
  map feature while the sheet is at peek raises it to half.
- **Rationale:** The phone layout is a re-arrangement, not a different product.
  Every one of these behaviours is an approved requirement of another spec, and a
  sheet that quietly dropped one would be a regression disguised as a layout
  change.
- **Acceptance criteria:** The existing SPEC-026 and SPEC-009 behavioural tests
  pass unchanged, and equivalents pass against the phone layout: choose a unit →
  the list re-renders; tap a row → the detail replaces the list; tap back → the
  list returns; tap a map marker → the same detail appears and the sheet is at
  half or higher; highlight a row → the corresponding map feature highlights.
- **Verification method:** automated test (Vitest for behaviour, Playwright e2e
  for the sheet interaction)
- **Evidence location:** _filled at implementation_

### REQ-005: Age, group and count stay permanently visible

- **Statement:** On the phone map screen the selected age (with its Ma span), the
  selected group and the visible-occurrence count are visible at all times, at
  every sheet stop, without any disclosure, scroll or gesture. They may be
  re-laid-out — a single compact line rather than four stacked stat blocks — but
  not removed, collapsed or deferred.
- **Rationale:** FONC-040, FONC-050, FONC-060 and CONS-450 are MVP requirements
  and are not relaxed by a narrow viewport. This requirement exists because the
  obvious way to reclaim the 134 px context row (P-05) is to hide it, and that is
  not available.
- **Acceptance criteria:** At 320, 360, 390 and 430 px wide, with the sheet at
  each of its three stops, the age string, the group name and the count are all
  present in the accessibility tree and visible in the viewport. The count still
  updates live (`aria-live="polite"`).
- **Verification method:** automated test (Playwright e2e)
- **Evidence location:** _filled at implementation_

### REQ-006: A timeline that can be aimed with a thumb

- **Statement:** At or below the breakpoint the timeline re-lays out as: the
  stage readout (name + Ma span) full width above the track, rather than in a
  fixed 128 px side column; the three period bands as a full-width row of targets
  each at least 44 px tall; and **explicit previous-stage / next-stage controls,
  each at least 44 × 44 px**, flanking the track. The to-scale stage track is
  retained — it remains the readout that shows where in the Mesozoic the selected
  age sits, keeps the selection bar and the SPEC-009 REQ-005 range highlight, and
  still accepts a direct tap and a drag-scrub, snapping to the nearest stage.
- **Rationale:** P-12 — the track is 214 px wide at 390 px for ~30 to-scale
  stages, and the narrowest stage step measures **0.0 px**. Stepping the age is the
  central verb of the map loop and it currently cannot be aimed. Note the
  geometry: 30 stages × 44 px is 1,320 px, so per-stage 44 px targets are
  impossible at phone widths — the discrete controls carry precise selection while
  the to-scale track carries the reading.
- **Acceptance criteria:**
  1. At 320, 360, 390 and 430 px wide, the previous-stage and next-stage controls
     each measure at least 44 × 44 px and each period band is at least 44 px tall.
  2. Tapping next-stage advances the selection by exactly one ICS stage and
     updates the readout, the selection bar and the map.
  3. At the first (oldest) and last (youngest) stage the corresponding control is
     `disabled` with an accessible reason, not hidden (charter §7).
  4. The track still renders to scale and the selection bar still lands at the
     selected stage's extent.
  5. Keyboard stepping (SPEC-009's roving tabindex) is unchanged.
- **Verification method:** automated test (Playwright e2e for geometry, Vitest
  for stepping behaviour)
- **Evidence location:** _filled at implementation_

### REQ-007: One map overlay on a phone-width map

- **Statement:** At or below the breakpoint the map carries exactly one rail
  child — the basemap-attribution ⓘ, in the bottom-left, positioned above the
  sheet's peek height so the sheet never covers it. The clade key and the
  "show taxa without a Wikipedia article" toggle move **into the sheet**, where
  the clade key is a collapsible section and the toggle sits with the unit
  selector as the filter control it is. MapLibre's own zoom controls stay in the
  top-right. The SPEC-023 non-overlap invariant holds at phone widths.
- **Rationale:** P-10 — `.mapRail`'s `max-width: calc(50% - var(--space-3))` is
  101 px on a 226 px map, so the gate toggle's label wraps to six lines and grows
  sideways into the bottom-left rail: an 18 px measured overlap, with the toggle
  painted across the clade key. P-14 — four persistent overlays on a 226 px canvas
  cover most of the visible ocean. With one rail child, collision is structurally
  impossible rather than merely avoided.
- **Acceptance criteria:**
  1. At 320, 360, 390 and 430 px wide, `[data-map-rail] > [data-map-overlay]`
     yields exactly one visible element.
  2. The existing non-overlap and containment assertions pass at those widths
     (see NFR-001).
  3. The attribution ⓘ's popover opens fully inside the map pane and is not
     covered by the sheet at any stop.
  4. The clade key and the gate toggle are both still reachable and operable, in
     the sheet, at every stop at or above peek.
- **Verification method:** automated test (Playwright e2e)
- **Evidence location:** _filled at implementation_

### REQ-008: The taxonomy screen at phone width

- **Statement:** At or below the breakpoint the taxonomy screen produces no
  horizontal overflow, and its long neighbour and clade-fan lists show at most
  **8 entries** by default, with the remainder behind the existing `neighbourMore`
  disclosure that SPEC-027 already established for exactly this purpose.
- **Rationale:** P-16 — the screen is 8,064 px tall at 390 px, roughly twelve
  screenfuls. P-17 — `.fanListItem` is a non-wrapping flex row without
  `min-width: 0`, indented by tree depth, so long names push to x = 415 in a 390 px
  window. This reuses a pattern the screen already has rather than inventing one.
- **Acceptance criteria:** At 390×664 the taxonomy screen has no element outside
  the viewport horizontally, and no neighbour or fan list renders more than 8
  entries without the disclosure being opened. Opening the disclosure still
  reveals the full list.
- **Verification method:** automated test (Playwright e2e + Vitest for the
  truncation count)
- **Evidence location:** _filled at implementation_

## Non-functional requirements

### NFR-001: The phone regression gate

- **Statement:** `test/e2e/map-overlays.e2e.ts`'s viewport matrix gains 390×664
  and 360×640, and a new phone e2e asserts, for each of the four screens and each
  of 320/360/390/430 px: no horizontal document overflow, no element outside the
  viewport, and no interactive element under 44 px in either dimension when the
  context reports a coarse pointer.
- **Rationale:** P-11 and P-21 — nothing in the project is tested below 820 px,
  which is exactly why P-10 shipped inside a spec that has an automated
  non-overlap gate. Without this, the phone layout regresses silently the first
  time someone edits a shared stylesheet.
- **Acceptance criteria:** The extended matrix and the new phone e2e pass; and,
  as a self-check, both fail when run against the pre-change build.
- **Verification method:** automated test (Playwright e2e)
- **Evidence location:** _filled at implementation_

### NFR-002: The desktop layout is unchanged

- **Statement:** Above the breakpoint the rendered layout is unchanged by this
  spec. No token whose value the desktop layout depends on is altered; the coarse
  -pointer target minimum is added as a **new** token applied only under
  `@media (pointer: coarse)`.
- **Rationale:** Owner decision, 2026-09-02. The charter's restraint principle
  produced the current desktop density deliberately; a global 44 px floor would
  loosen it as a side effect of a phone fix.
- **Acceptance criteria:** At 1440×900, 1280×800 and 1024×768, the bounding boxes
  of the app bar, context row, timeline, map pane and sidebar are identical before
  and after the change, and the existing e2e suite passes without amendment.
- **Verification method:** automated test (Playwright e2e, before/after geometry
  comparison)
- **Evidence location:** _filled at implementation_

### NFR-003: Real viewport units and safe areas

- **Statement:** The app shell sizes to the **dynamic** viewport (`100dvh`, with
  `100vh` retained as a fallback for engines without `dvh`) rather than `100vh`.
  `index.html`'s viewport meta gains `viewport-fit=cover`, and the map's rail, the
  sheet and the app bar pad themselves by the corresponding `env(safe-area-inset-*)`
  values.
- **Rationale:** P-03 — `100vh` is sized to the largest viewport on mobile
  browsers, so the bottom of the map sits under the browser toolbar and the layout
  jumps as the toolbar collapses. P-04 — once the map is full-bleed, the notch and
  the home indicator start intersecting real controls.
- **Acceptance criteria:** No `100vh` remains as a sole height source in
  `src/app/**/*.css`; the meta tag contains `viewport-fit=cover`; the sheet's
  resting bottom edge and the rail's offsets include a non-zero inset when one is
  simulated.
- **Verification method:** automated test (source inspection, Vitest) + manual
  check on a physical notched device
- **Evidence location:** _filled at implementation_

## Security and privacy considerations

**None.** This spec adds no network call, no new stored data, no new external
resource and no new user input that leaves the device. The offline guarantee
(SEC-001 of SPEC-018 and the no-runtime-egress test) is untouched: the sheet, the
breakpoint and the touch tokens are layout and input only. The existing
`test/data-005-no-runtime-egress.test.ts` continues to serve as the guard.

## Data model impact

**None.** No domain type, snapshot field or pipeline output changes.

## API impact

### API-001: Internal-only additions

- **Statement:** Two internal additions, neither part of the read API nor of any
  persisted contract: a `SheetStop` union (`"peek" | "half" | "full"`) with a pure
  stop-advancing function, and a `usePointerCoarse()` hook wrapping
  `matchMedia("(pointer: coarse)")`. The fragment vocabulary stays frozen
  (SPEC-022 API-001) — the sheet's stop is **not** addressable and is not
  persisted.
- **Rationale:** The stop-cycling logic is the one piece of this spec that is
  genuinely testable in jsdom, so it is worth isolating as a pure function; naming
  it here keeps it from growing into a URL-visible surface.
- **Acceptance criteria:** `advanceStop("peek") === "half"`,
  `advanceStop("half") === "full"`, `advanceStop("full") === "peek"`; no new
  fragment is written by the sheet; reloading the page restores the default stop.
- **Verification method:** automated test (Vitest)
- **Evidence location:** _filled at implementation_

## UI or UX impact

### UX-001: A 44 px touch-target floor on coarse pointers

- **Statement:** A new token — `--target-min-coarse: 44px` — is applied to every
  interactive element under `@media (pointer: coarse)`. `--target-min: 24px` keeps
  its current value and its current meaning for fine pointers. PERF-120's 24 × 24
  minimum for map points and clusters continues to be met everywhere and is
  exceeded on coarse pointers.
- **Rationale:** P-06, P-19 — the app honours its own 24 px floor throughout, but
  that is roughly half the platform minimum: nav links measure 25×34, "Reset view"
  36 px wide, the Dinordle ⓘ 24×24. Owner decision, 2026-09-02: coarse pointers
  only, so the desktop layout is untouched (NFR-002).
- **Acceptance criteria:** In a coarse-pointer context at 320/360/390/430 px, no
  `button`, `a`, `input`, `select` or `label` that is visible and enabled measures
  under 44 px in either dimension — with the single, enumerated exception of the
  to-scale stage steps, whose precise selection is served by REQ-006's discrete
  controls and which remain ≥ 24 px tall for PERF-120.
- **Verification method:** automated test (Playwright e2e)
- **Evidence location:** _filled at implementation_

### UX-002: Nothing is hover-only

- **Statement:** Under `@media (hover: none)` no information and no affordance
  depends on hover:
  1. A tap on a map marker pins the species card, delivering SPEC-015 REQ-003's
     "identity before any click" on a device with no hover.
  2. The taxon profile's image credit (`.credReveal`) is **always visible**, not
     revealed on hover.
  3. Tappable rows — the clade fan's included — carry a non-hover affordance.
- **Rationale:** P-08, and CONS-490 directly: on touch, hover is not a secondary
  interaction, it is *no* interaction. An image credit reachable only by hovering
  is, on a phone, unreachable — and the charter's §2 north star makes provenance
  non-negotiable.
- **Acceptance criteria:** With `hasTouch` and `hover: none` simulated: tapping a
  marker shows the card with the taxon's name; the image credit's text is in the
  accessibility tree and has non-zero opacity without any pointer interaction; the
  fan rows render their affordance with no pointer over them.
- **Verification method:** automated test (Playwright e2e)
- **Evidence location:** _filled at implementation_

### UX-003: Text inputs do not trigger iOS auto-zoom

- **Statement:** Every text input renders at a computed `font-size` of at least
  16 px on coarse pointers. This covers `.searchInput` (currently 14 px) and any
  future input; Dinordle's `.entryInput` is already `1rem` and is the model.
- **Rationale:** P-07 — Safari zooms the page when a focused input is under 16 px
  and does not zoom back out, leaving the reader in a magnified, sideways-scrolling
  page. It converts one tap on search into a broken viewport.
- **Acceptance criteria:** In a coarse-pointer context, every `input[type=text]`
  and `input[type=search]` has a computed `font-size` ≥ 16 px.
- **Verification method:** automated test (Playwright e2e)
- **Evidence location:** _filled at implementation_

### UX-004: The phone's real states are designed

- **Statement:** The sheet designs all of the states the charter §7 requires, not
  only the happy path: **loading** a stage, **error** loading a stage with its
  retry, **empty** (no occurrences at this age) with its reset path, the SPEC-027
  "unreachable search" and "taxon absent at this age" notices, and the **disabled**
  timeline controls at the ends of the range (REQ-006). Each is legible at the
  peek stop or raises the sheet to half.
- **Rationale:** Charter §7, and FONC-1280/1310/1330/1340. These states currently
  render into a 164 px column and have never been looked at on a phone; a sheet
  that only works when there is a list to show is half a design.
- **Acceptance criteria:** Each of the five states renders in the sheet at 390 px
  with no overflow, no clipped text, and its recovery control at ≥ 44 px.
- **Verification method:** automated test (Vitest for the state rendering,
  Playwright e2e for the geometry) + inspection against the charter §7 list
- **Evidence location:** _filled at implementation_

### UX-005: The charter gains a viewport and touch section

- **Statement:** `docs/mockups/design-guidelines.md` gains a section fixing, as
  design conventions: the single `40rem` breakpoint, the coarse-pointer target
  minimum, the rule that nothing is hover-only, and which surfaces may become a
  sheet on a phone. `docs/mockups/screens-index.md` gains a row for the phone map
  screen. Neither introduces requirements — requirements stay in this spec.
- **Rationale:** P-20 — the charter is binding on all UI work and is silent on
  every one of these, so without it there is no convention for the implementation
  to be correct against and the next UI change has nothing to follow.
- **Acceptance criteria:** The section exists, states those four conventions, and
  states no requirement; `/drift-check` reports no conflict between it and this
  spec.
- **Verification method:** manual check + `/drift-check`
- **Evidence location:** _filled at implementation_

## Configuration impact

None. No environment variable, feature flag or build setting changes. The
breakpoint is a CSS value, not configuration; there is no runtime device
detection and no user-facing "mobile mode" switch — the layout follows the
viewport and the pointer type only.

## Error handling

- **Stage load failure on a phone.** The error and its Retry render inside the
  sheet, and the sheet raises itself to at least half so the retry control is
  visible without a gesture (UX-004). The map keeps its last painted frame.
- **`matchMedia` unavailable.** `usePointerCoarse()` returns `false` and the app
  renders the fine-pointer layout. The CSS media queries are independent of the
  hook, so the layout is still correct — only the JS-side refinements degrade.
- **`dvh` unsupported.** `100vh` remains as the declared fallback, giving today's
  behaviour rather than a broken height (NFR-003).
- **Drag interrupted** (a call, an app switch, a lost pointer). The sheet settles
  to the nearest stop on `pointercancel` as well as on `pointerup`; it never rests
  between stops.

## Edge cases

- **320 px wide** — the narrowest supported viewport. Everything above holds
  there; it is in every acceptance criterion for that reason.
- **Landscape** (844×390) — out of scope by design (non-goal), but must not
  *break*: REQ-002 and REQ-007's assertions are expected to hold, and the layout
  may simply be cramped.
- **Large text / user zoom.** The breakpoint is in `rem`, so a reader with a
  larger root font crosses into the phone layout on a wider screen. That is the
  intended behaviour, not a defect.
- **Very long taxon names** in a peek-height sheet — rows wrap or ellipsize;
  they never widen the sheet (REQ-002).
- **A single occurrence, and 2,135 occurrences** — the sheet's stops are
  proportional, so neither changes the geometry.
- **The sheet at full with the map's attribution popover open** — REQ-007
  criterion 3 covers it: the ⓘ sits above peek and its popover opens into the map.
- **Rotation while the sheet is dragged** — the stop is recomputed from the new
  viewport; the sheet does not keep a stale pixel offset.
- **Desktop browser narrowed below 640 px** with a fine pointer — the phone
  *layout* applies (width-driven), the 44 px floor does not (pointer-driven).
  These are deliberately independent conditions.

## Acceptance criteria

This spec is satisfied when, at 320/360/390/430 px wide in portrait:

1. No screen scrolls horizontally and no element sits outside the viewport.
2. The exploration loop completes end to end on a phone: pick an age, read the
   map, open a row, reach a taxon profile, return to the map.
3. Age, group and count are visible at all times on the map screen.
4. Every interactive element on a coarse pointer is at least 44 px, except the
   enumerated to-scale stage steps.
5. Exactly one map overlay rail child is visible, and the SPEC-023 non-overlap
   assertions pass at phone widths.
6. Nothing is hover-only.
7. The desktop layout above `40rem` is unchanged.
8. The extended e2e matrix and the new phone e2e pass, and both fail against the
   pre-change build.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Single `40rem` breakpoint, no other width queries | automated | Vitest source inspection | _TBD_ | _TBD_ |
| REQ-002 | `scrollWidth === clientWidth`, no element outside viewport, 4 screens × 4 widths | automated | `pnpm run e2e` — phone overflow spec | _TBD_ | _TBD_ |
| REQ-003 | Sheet stops, map ≥55% at peek / ≥25% at full, keyboard-operable handle | automated | `pnpm run e2e` + Vitest `advanceStop` | _TBD_ | _TBD_ |
| REQ-004 | Unit selector, row→detail, map→detail, two-way highlight all preserved | automated | Vitest (SPEC-026/009 suites) + e2e | _TBD_ | _TBD_ |
| REQ-005 | Age, group, count visible at every stop and width | automated | `pnpm run e2e` — permanence spec | _TBD_ | _TBD_ |
| REQ-006 | Prev/next ≥44×44, bands ≥44 tall, one-stage step, disabled at ends | automated | `pnpm run e2e` + Vitest stepping | _TBD_ | _TBD_ |
| REQ-007 | Exactly one rail child; non-overlap and containment hold | automated | `pnpm run e2e` — `map-overlays.e2e.ts` extended | _TBD_ | _TBD_ |
| REQ-008 | No overflow; ≤8 entries per list before disclosure | automated | `pnpm run e2e` + Vitest truncation | _TBD_ | _TBD_ |
| NFR-001 | Matrix extended; new phone e2e; both fail pre-change | automated | `pnpm run e2e` | _TBD_ | _TBD_ |
| NFR-002 | Desktop geometry identical at 3 widths; existing e2e unamended | automated | `pnpm run e2e` — before/after geometry | _TBD_ | _TBD_ |
| NFR-003 | No sole-source `100vh`; `viewport-fit=cover`; insets applied | automated + manual | Vitest source inspection; device check | _TBD_ | _TBD_ |
| API-001 | `advanceStop` cycles; no fragment written; default stop on reload | automated | Vitest | _TBD_ | _TBD_ |
| UX-001 | No enabled interactive element <44 px on coarse pointers | automated | `pnpm run e2e` — target-size spec | _TBD_ | _TBD_ |
| UX-002 | Tap pins card; credit visible unhovered; rows carry an affordance | automated | `pnpm run e2e` under `hover: none` | _TBD_ | _TBD_ |
| UX-003 | Every text input ≥16 px computed on coarse pointers | automated | `pnpm run e2e` | _TBD_ | _TBD_ |
| UX-004 | Five states render in the sheet with ≥44 px recovery controls | automated | Vitest + e2e | _TBD_ | _TBD_ |
| UX-005 | Charter section exists, states conventions only | manual | inspection + `/drift-check` | _TBD_ | _TBD_ |

## Test plan

**Unit (Vitest, jsdom).** jsdom does not do CSS layout, so it verifies behaviour
and source facts only: `advanceStop` cycling (API-001), the timeline's one-stage
stepping and end-of-range disabling (REQ-006), the sheet's selection behaviours
(REQ-004), the taxonomy truncation count (REQ-008), the five sheet states
(UX-004), and source-inspection assertions for the breakpoint (REQ-001) and
`dvh`/`viewport-fit` (NFR-003).

**End-to-end (Playwright, real Chromium).** Everything geometric. Two new spec
files plus an extension of the existing one:

- `test/e2e/phone-layout.e2e.ts` — a matrix over {320, 360, 390, 430} ×
  {map, taxonomy, Dinordle, profile} asserting REQ-002, UX-001, UX-003, and
  REQ-005 on the map screen.
- `test/e2e/phone-sheet.e2e.ts` — the sheet's stops and gestures (REQ-003),
  the selection round-trip (REQ-004), the timeline's discrete controls (REQ-006),
  and the hover-free behaviours (UX-002).
- `test/e2e/map-overlays.e2e.ts` — matrix extended with 390×664 and 360×640, plus
  the single-rail-child assertion (REQ-007, NFR-001).

**Gate self-check.** Each new e2e is run once against the pre-change build to
confirm it fails there. A gate that passes before the fix is not a gate
(NFR-001).

**Manual.** One pass on a physical notched iPhone and one Android device for the
things a headless engine cannot tell the truth about: the `dvh` toolbar
behaviour, safe-area insets, and iOS input auto-zoom (NFR-003, UX-003).

**Fixtures.** None new. The existing shipped snapshot and the existing e2e
preview server are sufficient.

## Rollback plan

Low-risk to revert. The change is additive in three separable layers:

1. **CSS-only layers** (the breakpoint's rules, the coarse-pointer token, `dvh`,
   the input size) revert by removing the media blocks — the desktop layout is
   untouched by construction (NFR-002), so reverting cannot disturb it.
2. **The sheet** is a new component plus a branch in `ExplorationView`'s render.
   Reverting the branch restores the two-column body; the sheet component becomes
   dead code and is deleted with it.
3. **The tests** revert independently and should be reverted **last**, so the
   revert itself is verified by the gate it is removing.

There is no data migration, no persisted state and no fragment change, so a
revert cannot strand a user in an unreachable state. A partial rollback of layer 2
alone is safe and leaves layers 1 and 3 as genuine improvements.

## Open questions

- [ ] **Breakpoint value.** Assumed `40rem`, reusing Dinordle's existing query so
      the system has one number rather than two (REQ-001). Confirm, or name a
      different value, before implementation starts.
- [ ] **Peek height.** The unit selector's five options will not fit one 44 px row
      at 320 px, so peek is assumed to carry the selector on **two** rows
      (≈ 152 px). The alternative — one horizontally scrollable row — was rejected
      because it puts options out of sight, which sits badly with CONS-450 and with
      SPEC-026's "the option set is identical in every state". Confirm the trade.
- [ ] **Does CONS-490 permit the clade key to be collapsible in the sheet?**
      REQ-007 assumes yes: the clade key is a legend, not uncertainty information,
      and SPEC-023 UX-001 already lets it collapse on the desktop. Flagged because
      it is the one place this spec moves something out of permanent view.
- [ ] **e2e is not currently a required CI gate** (SPEC-003 assumption A-3, echoed
      in `playwright.config.ts`). Almost every requirement here verifies through
      e2e, so this spec's gate is only as real as that decision. Promoting
      `pnpm run e2e` to a required check is arguably a precondition rather than a
      follow-up.

## Human decisions required

- [x] **Map screen layout on a phone** — *Answered 2026-09-02: bottom sheet over a
      full-bleed map*, over stacking or tabs. Tabs were rejected in the same
      decision because they break SPEC-009 REQ-006's two-way highlight.
- [x] **Phone landscape** — *Answered 2026-09-02: out of scope*, recorded as a
      non-goal and a follow-up.
- [x] **Touch-target minimum** — *Answered 2026-09-02: coarse pointers only*, via
      a new token, leaving the desktop layout unchanged.
- [ ] **Approval of this spec** (status → `Approved`, moved to
      `docs/specs/approved/`) before any implementation begins.
- [ ] **Whether `pnpm run e2e` becomes a required CI gate** as part of this work
      (see the last open question).

## Conflict check

No contradiction found with any existing spec. Four specs are **extended** at
phone widths, each keeping its desktop behaviour intact:

- **SPEC-009** — the to-scale track and the two-way highlight are preserved;
  REQ-006 adds discrete stepping controls beside the track rather than replacing
  it. Direction of travel matches SPEC-009's own goal of an *ergonomic* timeline.
- **SPEC-023** — the corner-rail scheme is unchanged; REQ-007 reduces the phone
  map to a single rail child, which satisfies the scheme's invariant rather than
  bending it, and NFR-001 extends the gate SPEC-023 created.
- **SPEC-026** — the sidebar's contract is carried into the sheet unchanged
  (REQ-004). The sheet is a different container for the same column.
- **SPEC-015** — REQ-003's "identity before any click" is *restored* on touch by
  UX-002; today it is silently absent there.

`docs/mockups/design-guidelines.md` is extended, not contradicted, by UX-005: it
is currently silent on viewport and touch (P-20), so there is nothing to conflict
with. `conflicts_with` is therefore empty.

One tension is recorded rather than resolved silently: FONC-040/050/060 and
CONS-450 require permanence, and the cheapest way to reclaim phone height is to
break that. REQ-005 exists specifically to forbid it.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Token / breakpoint | `tokens.css`, `*.module.css` | _TBD_ | Not started |
| REQ-002 | All screens | `exploration.module.css`, `ContextBar.tsx` | _TBD_ | Not started |
| REQ-003 | Bottom sheet | new `OccurrenceSheet.tsx`, `ExplorationView.tsx` | _TBD_ | Not started |
| REQ-004 | Bottom sheet | `OccurrenceSheet.tsx`, `UnitList.tsx` | _TBD_ | Not started |
| REQ-005 | Context line | `ContextBar.tsx`, `exploration.module.css` | _TBD_ | Not started |
| REQ-006 | Timeline | `TimelineControl.tsx` | _TBD_ | Not started |
| REQ-007 | Map overlays | `OccurrenceMap.tsx`, `ExplorationView.tsx` | _TBD_ | Not started |
| REQ-008 | Taxonomy | `TaxonomySurfaces.tsx`, `exploration.module.css` | _TBD_ | Not started |
| NFR-001 | Test gate | `test/e2e/*` | _TBD_ | Not started |
| NFR-002 | Regression | `exploration.module.css` | _TBD_ | Not started |
| NFR-003 | Shell | `index.html`, `global.css` | _TBD_ | Not started |
| API-001 | Sheet state | new `src/app/state/sheet.ts` | _TBD_ | Not started |
| UX-001 | Tokens | `tokens.css`, `global.css` | _TBD_ | Not started |
| UX-002 | Hover-free | `OccurrenceMap.tsx`, `exploration.module.css` | _TBD_ | Not started |
| UX-003 | Inputs | `exploration.module.css` | _TBD_ | Not started |
| UX-004 | States | `states.tsx`, `OccurrenceSheet.tsx` | _TBD_ | Not started |
| UX-005 | Charter | `docs/mockups/design-guidelines.md` | _TBD_ | Not started |

## Implementation notes

_Filled during implementation._

Suggested order, so each step is independently shippable and the gate exists
before the risky work: NFR-001 (the failing gate) → REQ-002 + UX-003 + NFR-003
(the cheap wins, which alone make the app testable on a real phone) → UX-001 +
UX-002 → REQ-006 (timeline) → REQ-007 (rails) → REQ-003/004/005 (the sheet, the
largest piece) → REQ-008 (taxonomy) → UX-005 (charter) → traceability.

## Spec amendments

_None. This spec is Draft; amendments are required only after approval._

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [ ] Open questions are resolved or explicitly deferred. — **four open**, see
      above; all four need the owner.
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed.
- [ ] Human approval recorded before status set to Approved. — **not yet.**
