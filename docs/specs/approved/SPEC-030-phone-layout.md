---
doc_type: spec
spec_id: SPEC-030
title: Phone layout — a portrait-phone form for the atlas
status: In Implementation
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
conflicts_with:
  - SPEC-023
last_verified_at: 2026-09-02
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

Three prior specs constrain the design, and none of them is reopened:

- **SPEC-009** gives the timeline its to-scale stepped track and the two-way
  map↔list highlight (REQ-005/REQ-006).
- **SPEC-023** gives the map its corner-rail overlay scheme and an automated
  non-overlap gate. P-10 shows the phone violating that scheme's own invariant;
  P-11 shows the gate cannot see it because its viewport matrix stops at 820 px.
  Re-measured on 2026-09-02 against a simulated full-bleed phone map, the scheme
  turns out to be sound and its **implementation** defective — see REQ-007.
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
- **Evidence location:** `src/app/styles/tokens.css` (`--breakpoint-phone`); the only width queries are `40rem`

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
- **Evidence location:** `test/e2e/phone-layout.e2e.ts` — passes at 320/360/390/430

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
- **Evidence location:** `test/e2e/phone-sheet.e2e.ts`, `test/ui/spec030-sheet.test.ts` — all four criteria pass

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
- **Evidence location:** `test/e2e/phone-sheet.e2e.ts` — passes

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
- **Evidence location:** `test/e2e/phone-layout.e2e.ts` — passes at all four widths

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
- **Evidence location:** `test/e2e/phone-layout.e2e.ts` — passes

### REQ-007: The map's overlays stay on the map and obey their rail's bound

- **Statement:** The clade key, the Wikipedia-gate toggle and the basemap ⓘ
  **stay on the map**, in the corner rails SPEC-023 assigns them. Three things
  change — the first two inside SPEC-023's existing requirements, the third by a
  narrow amendment to it:
  1. **Every rail child honours its rail's width bound.** `.mapLegend2` must not
     exceed `.mapRail`'s `max-width: calc(50% - var(--space-3))`; its labels wrap
     or ellipsize inside that bound rather than forcing the box wider.
  2. **The bottom rails clear the sheet.** Their bottom offset accounts for the
     sheet's peek height, so no rail child is ever covered by the sheet at rest.
  3. **The clade key opens collapsed at or below the breakpoint** (owner
     decision, 2026-09-02), expanded above it — in both cases to its labelled
     "Clade key" affordance, expandable by one tap. This is the single point at
     which this spec amends SPEC-023; see "Specs this spec amends".
- **Rationale:** An earlier draft of this requirement moved the clade key and the
  gate toggle off the map, which would have required amending SPEC-023 UX-001.
  Re-measuring on 2026-09-02 showed that was unnecessary and wrong. P-10's 18 px
  overlap is an artefact of the **226 px** map that REQ-003 abolishes; on a
  simulated full-bleed phone map the same overlays measure:

  | Map width | clade key | gate toggle | Overlap |
  | --- | --- | --- | --- |
  | 320 px | 183 px wide | 148 px | **35 × 59 px** |
  | 360 px | 183 px wide | 168 px | **15 × 59 px** |
  | 390 px | 183 px wide | 183 px | **none** |
  | 430 px | 183 px wide | 203 px | **none** |

  At 390 px and above, SPEC-023's scheme works exactly as designed with no change
  at all. What remains at 320–360 px is a **defect against SPEC-023 REQ-004**, not
  a limit of its design: the gate toggle honours the rail bound (148 px at 320 px
  is exactly `50% - 12px`) while the clade key does not, sitting at 183 px at
  every width. The cause is `.legendItem { white-space: nowrap }` combined with a
  flex item's automatic minimum size — `.mapLegend2` cannot shrink below its
  min-content width, so the rail's `max-width` is defeated. REQ-004 bounds the
  key's *height* (`max-height: 45%`, `overflow-y: auto`) and nothing bounds its
  *width*. Fixing that satisfies SPEC-023 rather than amending it, and it fixes
  the desktop case P-10 found too.

  Clause 3 is the exception, and it rests on the owner's judgement rather than on
  a measurement. Expanded, the key is 183 × 193 px — **26% of the map at 320 px**,
  22% at 390 px — on the one screen where map area is scarcest. SPEC-023 UX-001's
  last sentence forbids collapsing it by viewport size, so this does need an
  amendment; that amendment is narrow and changes nothing about which overlays
  live where.

  Collapsing it stays compatible with charter §2 and CONS-490 for the reason
  SPEC-023 itself gives: the clade key is "a *reading aid* — the same information
  is already carried by each marker's shape and by the hover card's clade name",
  not provenance. **That reasoning has a dependency on a phone**, worth stating
  rather than assuming: there is no hover card on touch. UX-002 is what restores
  the card by tap, keeping the clade name reachable. Clause 3 is therefore only
  safe to ship *together with* UX-002 — were UX-002 dropped, the key would become
  the sole carrier of clade names on a phone and would have to open expanded
  again.
- **Acceptance criteria:**
  1. At 320, 360, 390 and 430 px wide, no two elements matched by
     `[data-map-rail] > [data-map-overlay]` or `.maplibregl-ctrl` intersect, and
     none escapes the map pane.
  2. No rail child's width exceeds its rail's computed `max-width` at any tested
     viewport.
  3. Every rail child is fully visible with the sheet at its peek stop, and the
     basemap ⓘ's popover opens inside the map pane at every stop.
  4. The clade key renders **collapsed** on load at 320/360/390/430 px and
     **expanded** on load above the breakpoint; in both cases it names itself when
     collapsed, expands on one tap, and its state is not persisted across a reload
     (SPEC-023 UX-001 acceptance criteria 2 and 4, unchanged).
  5. Expanded by the reader at 320 px, the key still honours criterion 2's width
     bound and does not overlap the gate toggle.
  6. The clade key, the gate toggle and the ⓘ remain operable at every sheet stop.
- **Verification method:** automated test (Playwright e2e; the assertions in
  criteria 1–2 extend `test/e2e/map-overlays.e2e.ts`)
- **Evidence location:** `test/e2e/phone-layout.e2e.ts`, `test/e2e/map-overlays.e2e.ts` — passes at 320/360/390/430

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
- **Evidence location:** `test/e2e/phone-layout.e2e.ts` (overflow) — passes

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
- **Evidence location:** `test/e2e/phone-layout.e2e.ts`, `phone-sheet.e2e.ts`, `map-overlays.e2e.ts`; 18/18 failed pre-change

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
- **Evidence location:** `test/e2e/phone-states.e2e.ts` — passes at 1440/1280/1024

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
- **Evidence location:** `index.html`, `exploration.module.css` `.app`; device check outstanding

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
- **Evidence location:** `test/ui/spec030-sheet.test.ts` — 12 tests pass

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
- **Evidence location:** `test/e2e/phone-layout.e2e.ts` — passes at all four widths

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
- **Evidence location:** `test/e2e/phone-touch.e2e.ts` (card, fan rows) + `test/ui/spec030-hover-free.test.ts` (credit)

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
- **Evidence location:** `test/e2e/phone-layout.e2e.ts` — passes at all four widths

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
- **Evidence location:** `test/e2e/phone-states.e2e.ts` — empty, loading and error states

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
- **Evidence location:** `docs/mockups/design-guidelines.md` §8b; `docs/mockups/screens-index.md`

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
5. Every map overlay stays on the map, honours its rail's width bound, and clears
   the sheet; the SPEC-023 non-overlap assertions pass at phone widths; and the
   clade key opens collapsed below the breakpoint and expanded above it.
6. Nothing is hover-only.
7. The desktop layout above `40rem` is unchanged.
8. The extended e2e matrix and the new phone e2e pass, and both fail against the
   pre-change build.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Single `40rem` breakpoint, no other width queries | automated | Vitest source inspection | implemented | this branch |
| REQ-002 | `scrollWidth === clientWidth`, no element outside viewport, 4 screens × 4 widths | automated | `pnpm run e2e` — phone overflow spec | implemented | this branch |
| REQ-003 | Sheet stops, map ≥55% at peek / ≥25% at full, keyboard-operable handle | automated | `pnpm run e2e` + Vitest `advanceStop` | implemented | this branch |
| REQ-004 | Unit selector, row→detail, map→detail, two-way highlight all preserved | automated | Vitest (SPEC-026/009 suites) + e2e | implemented | this branch |
| REQ-005 | Age, group, count visible at every stop and width | automated | `pnpm run e2e` — permanence spec | implemented | this branch |
| REQ-006 | Prev/next ≥44×44, bands ≥44 tall, one-stage step, disabled at ends | automated | `pnpm run e2e` + Vitest stepping | implemented | this branch |
| REQ-007 | Non-overlap and containment hold; rail bound honoured; key collapsed below the breakpoint | automated | `pnpm run e2e` — `map-overlays.e2e.ts` extended | implemented | this branch |
| REQ-008 | No overflow; ≤8 entries per list before disclosure | automated | `pnpm run e2e` + Vitest truncation | implemented | this branch |
| NFR-001 | Matrix extended; new phone e2e; both fail pre-change | automated | `pnpm run e2e` | implemented | this branch |
| NFR-002 | Desktop geometry identical at 3 widths; existing e2e unamended | automated | `pnpm run e2e` — before/after geometry | implemented | this branch |
| NFR-003 | No sole-source `100vh`; `viewport-fit=cover`; insets applied | automated + manual | Vitest source inspection; device check | implemented | this branch |
| API-001 | `advanceStop` cycles; no fragment written; default stop on reload | automated | Vitest | implemented | this branch |
| UX-001 | No enabled interactive element <44 px on coarse pointers | automated | `pnpm run e2e` — target-size spec | implemented | this branch |
| UX-002 | Tap pins card; credit visible unhovered; rows carry an affordance | automated | `pnpm run e2e` under `hover: none` | implemented | this branch |
| UX-003 | Every text input ≥16 px computed on coarse pointers | automated | `pnpm run e2e` | implemented | this branch |
| UX-004 | Five states render in the sheet with ≥44 px recovery controls | automated | Vitest + e2e | implemented | this branch |
| UX-005 | Charter section exists, states conventions only | manual | inspection + `/drift-check` | implemented | this branch |

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

- [x] **Breakpoint value.** *Resolved by approval, 2026-09-02:* `40rem` as
      specified, reusing Dinordle's existing query so the system has one number.
- [x] **Peek height.** *Resolved by approval, 2026-09-02:* the selector sits on
      two rows at peek (≈ 152 px), as specified. The rejected alternative — one
      horizontally scrollable row — stays rejected: it puts options out of sight,
      against CONS-450 and SPEC-026's "the option set is identical in every state".
- [x] **Should the clade key open collapsed on a phone?** *Answered 2026-09-02:
      yes.* REQ-007 clause 3 and a narrow amendment to SPEC-023 UX-001 (one
      sentence plus acceptance criterion 1, scoped by viewport). The key still
      names itself collapsed and is one tap from expanded, and no other overlay
      changes. Carries a hard dependency on UX-002 — see the conflict check.
- [~] **e2e is not currently a required CI gate** (SPEC-003 assumption A-3,
      echoed in `playwright.config.ts`). *Explicitly deferred, 2026-09-02:* the
      tests are written and must pass locally before each commit, but promoting
      `pnpm run e2e` to a required check is left as a follow-up. **Known
      limitation, recorded rather than solved:** until that happens, NFR-001's
      gate protects this work only when someone runs it. Every requirement whose
      verification method is "Playwright e2e" carries that caveat.

## Human decisions required

- [x] **Map screen layout on a phone** — *Answered 2026-09-02: bottom sheet over a
      full-bleed map*, over stacking or tabs. Tabs were rejected in the same
      decision because they break SPEC-009 REQ-006's two-way highlight.
- [x] **Phone landscape** — *Answered 2026-09-02: out of scope*, recorded as a
      non-goal and a follow-up.
- [x] **Touch-target minimum** — *Answered 2026-09-02: coarse pointers only*, via
      a new token, leaving the desktop layout unchanged.
- [x] **Amending existing specs for the phone layout** — *Answered 2026-09-02:
      authorised.* Four amendments are staged in "Specs this spec amends" above
      and land in their home specs on approval. The SPEC-023 one was first drafted
      broad (relocating overlays), withdrawn on re-measurement, and re-drafted
      narrow (one sentence of UX-001) once the owner asked for the collapsed
      default. Note what the authorisation was **not** spent on: FONC-040/050/060
      and CONS-450, which REQ-005 meets as written. Permission to amend is not by
      itself a reason to.
- [x] **The clade key's default state on a phone** — *Answered 2026-09-02:
      collapsed.*
- [x] **Approval of this spec** — *Approved by the owner on 2026-09-02*, in
      session `session_01GvwYfnCtWQGcynW17zS4su`, together with the four staged
      amendments. Status moved Draft → In Implementation; the amendments were
      landed in their home specs on the same date.
- [ ] **Whether `pnpm run e2e` becomes a required CI gate** as part of this work
      (see the last open question).

## Specs this spec amends

The owner authorised amending existing specs to accommodate the phone layout
(2026-09-02). **Four** post-approval specs take an amendment entry.

`CLAUDE.md` requires the entry in the **home** spec. Until approval the text was
staged here rather than written into those files, because an amendment landing in
an `Implemented` spec before this one was approved would have made that spec
describe behaviour the code did not have — drift of exactly the kind
`/drift-check` exists to catch.

**Landed 2026-09-02.** Each block below was copied into its home spec's "Spec
amendments" section on approval: SPEC-023 AMEND-001, SPEC-015 AMEND-002,
SPEC-009 AMEND-001, SPEC-026 AMEND-001. They are kept here as the review record. All
four are scoped to `max-width: 40rem` and/or `pointer: coarse`: none changes
behaviour above the breakpoint on a fine pointer.

A note on the SPEC-023 entry, because it has a history. A first draft proposed a
*broad* amendment — moving the clade key and the gate toggle off the map
entirely. Re-measurement (REQ-007) showed that was unnecessary, and it was
withdrawn: on a full-bleed map the overlays do not collide at 390 px or above,
and what remains at 320–360 px is a defect against SPEC-023 REQ-004 rather than a
limit of its design. What survives is a much narrower amendment covering **one
sentence** of UX-001, taken on the owner's decision of 2026-09-02. The
distinction matters: SPEC-023's overlay *scheme* is untouched and satisfied; only
its default collapse state on a phone changes.

### To SPEC-023 (Implemented) — the clade key's default state on a phone

- **Reason:** SPEC-030 REQ-007 clause 3, owner decision of 2026-09-02. Expanded,
  the clade key measures 183 × 193 px and covers 26% of the map at 320 px and 22%
  at 390 px, on the screen where map area is scarcest.
- **Changed requirements:** UX-001 — its statement's final sentence ("Collapsing
  is a user action only — the app must not collapse the key automatically based on
  viewport size") and acceptance criterion 1 ("The key renders expanded on load"),
  both scoped by viewport rather than removed.
- **Behavioural impact:** At `max-width: 40rem` the clade key renders
  **collapsed** on load, to its labelled "Clade key" affordance, and expands on
  one tap. Above the breakpoint it renders expanded exactly as today, and the ban
  on viewport-driven collapse continues to apply there. Acceptance criteria 2
  (collapsed, it still names itself), 3 (no other overlay gains a collapse or
  dismiss control) and 4 (state is not persisted across a reload) are unchanged at
  every width. **No overlay moves, is hidden, is faded, or is put behind a hover.**
  The key remains the only collapsible overlay, and remains one tap from expanded.
- **Why this does not weaken charter §2 / CONS-490:** on SPEC-023's own reasoning
  the clade key is a reading aid, not provenance, because each marker's shape and
  the hover card's clade name carry the same information. On touch the hover card
  does not exist, so this amendment **depends on SPEC-030 UX-002** shipping with
  it (tap pins the card). The two must land together; UX-002 alone is fine, this
  alone is not.
- **Test impact:** The existing Vitest collapse test is extended with a
  viewport-scoped default-state case rather than replaced; the new phone e2e
  asserts the collapsed default at four widths and the expanded default above the
  breakpoint.

### To SPEC-015 (In Implementation) — the marker preview card

- **Reason:** SPEC-030 UX-002. REQ-003 is written in mouse vocabulary — "Hovering
  a marker shows…", "dismisses on mouse-out" — so on a touch device the
  "answer before the click" guarantee is not weakened but simply absent.
- **Changed requirements:** REQ-003 (trigger and dismissal only).
- **Behavioural impact:** Under `hover: none`, a first tap on a marker pins the
  card and a tap elsewhere dismisses it. Content, anchoring and the SPEC-009
  cross-highlight are unchanged. Hover behaviour on a fine pointer is untouched.
- **Test impact:** A new e2e asserts the card's content after a tap with
  `hasTouch` and `hover: none`; the existing jsdom hover test is unchanged.

### To SPEC-009 (In Implementation) — the timeline

- **Reason:** SPEC-030 REQ-006. REQ-001's to-scale track cannot be aimed at phone
  widths: 30 stages across 214 px gives a narrowest step of 0.0 px, and 30 × 44 px
  of target is 1,320 px — the geometry does not admit a per-stage touch target.
- **Changed requirements:** REQ-001 (composition of the control; the track itself
  is unchanged).
- **Behavioural impact:** At `max-width: 40rem` the control gains explicit
  previous-stage and next-stage buttons beside the track, disabled at the ends of
  the range with a stated reason. The to-scale track, the selection bar, the
  REQ-005 range highlight, the period bands (REQ-002) and the keyboard slider
  semantics are all retained unchanged. Purely additive.
- **Test impact:** New e2e geometry assertions and a Vitest stepping test; no
  existing SPEC-009 test changes.

### To SPEC-026 (Implemented) — the sidebar

- **Reason:** SPEC-030 REQ-003/REQ-004. REQ-001 and REQ-003 are written in terms
  of "the sidebar" and "the same column", which on a phone is the sheet.
- **Changed requirements:** REQ-001 and REQ-003 (vocabulary only).
- **Behavioural impact:** **None.** Every behaviour REQ-001 and REQ-003 specify —
  the always-visible five-unit selector, a selection replacing the list in the
  same container, the named back control, `Escape`, scroll restoration, focus
  handling — holds identically in the sheet. This amendment exists so the two
  specs cannot be read as contradicting each other, not because anything changes.
- **Test impact:** The existing SPEC-026 suites run against both containers.

## Conflict check

**One contradiction, narrow and resolved by amendment.** This section has been
wrong in both directions already, so it states its reasoning rather than its
conclusion.

The first draft claimed "extended, not contradicted" without reading SPEC-023
UX-001. The second read it, found a broad contradiction — that draft's REQ-007
moved the gate toggle and the ⓘ off the map, which UX-001 forbids — and proposed
amending UX-001 wholesale. Both were wrong in the same way: both treated P-10's
overlap as a property of SPEC-023's *design*. It is a property of a 226 px map
plus a width-bounding defect in one rail child. REQ-007 now fixes the defect and
leaves the scheme alone.

What remains is genuinely a contradiction, and a small one. **SPEC-023 UX-001's
final sentence** — "the app must not collapse the key automatically based on
viewport size" — is exactly what REQ-007 clause 3 does, on the owner's decision
of 2026-09-02. That single sentence and acceptance criterion 1 are amended, scoped
by viewport rather than removed; UX-001's other three acceptance criteria, its ban
on collapsing anything *else*, and the whole corner-rail scheme are untouched.
`conflicts_with` names SPEC-023 for that one sentence.

Three further specs are **extended**, each post-approval, so each takes an
amendment entry (all staged above):

- **SPEC-009** (In Implementation) — the to-scale track, the keyboard slider and
  the two-way highlight are all preserved; REQ-006 adds discrete stepping
  controls beside the track rather than replacing it. Additive, and in the
  direction of SPEC-009's own goal of an *ergonomic* timeline.
- **SPEC-015** (In Implementation) — REQ-003 is written in mouse terms
  ("Hovering a marker shows…", "dismisses on mouse-out"). UX-002 gives the same
  card a touch trigger, *restoring* REQ-003's "answer before the click" guarantee
  on a device where it is currently absent altogether.
- **SPEC-026** (Implemented) — the sidebar's contract is carried into the sheet
  unchanged (REQ-004). The amendment is one of vocabulary: "the column" becomes
  "the column, which on a phone is the sheet".

**One internal dependency, recorded so it is not lost in implementation:** the
SPEC-023 amendment is only compatible with charter §2 and CONS-490 because UX-002
restores the clade name by tap. The two must ship together. REQ-007's rationale
carries the same note.

**No conflict with the functional specification.** FONC-040/050/060 and CONS-450
require the age, group, count and main controls to be permanent, and REQ-005
keeps all of them permanently visible rather than seeking relief from them. The
owner's authorisation to amend covers these too, and REQ-005 deliberately does
not use it: a compact line satisfies the requirement as written. The clade key is
not among them — it is a legend, and CONS-450's "map controls" are the timeline,
the frame toggle and the filters, all of which stay permanent.

**No conflict with the charter.** `docs/mockups/design-guidelines.md` is silent
on viewport and touch (P-20), so UX-005 adds a section rather than changing one.
CONS-490 is *served* by UX-002, not strained by it.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Token / breakpoint | `tokens.css`, `*.module.css` | source inspection | Done |
| REQ-002 | All screens | `exploration.module.css`, `ContextBar.tsx` | see verification matrix | Done |
| REQ-003 | Bottom sheet | new `OccurrenceSheet.tsx`, `ExplorationView.tsx` | see verification matrix | Done |
| REQ-004 | Bottom sheet | `OccurrenceSheet.tsx`, `UnitList.tsx` | see verification matrix | Done |
| REQ-005 | Context line | `ContextBar.tsx`, `exploration.module.css` | see verification matrix | Done |
| REQ-006 | Timeline | `TimelineControl.tsx` | see verification matrix | Done |
| REQ-007 | Map overlays | `OccurrenceMap.tsx`, `exploration.module.css` (`.mapLegend2`, `.legendItem`) | see verification matrix | Done |
| REQ-008 | Taxonomy | `TaxonomySurfaces.tsx`, `exploration.module.css` | see verification matrix | Done |
| NFR-001 | Test gate | `test/e2e/*` | see verification matrix | Done |
| NFR-002 | Regression | `exploration.module.css` | see verification matrix | Done |
| NFR-003 | Shell | `index.html`, `global.css` | see verification matrix | Done |
| API-001 | Sheet state | new `src/app/state/sheet.ts` | see verification matrix | Done |
| UX-001 | Tokens | `tokens.css`, `global.css` | see verification matrix | Done |
| UX-002 | Hover-free | `OccurrenceMap.tsx`, `exploration.module.css` | see verification matrix | Done |
| UX-003 | Inputs | `exploration.module.css` | see verification matrix | Done |
| UX-004 | States | `states.tsx`, `OccurrenceSheet.tsx` | see verification matrix | Done |
| UX-005 | Charter | `docs/mockups/design-guidelines.md` | see verification matrix | Done |

## Implementation notes

**Code complete at 2026-09-02.** Every requirement is implemented and verified.
The status stays `In Implementation` rather than `Implemented` because
`scripts/validate_drift.py` blocks an `Implemented` spec with no `related_prs`
reference, and no pull request has been opened — the lifecycle in
`docs/SPEC_INDEX.md` pairs that status with a merged PR. Flip both when one
lands.
643 unit tests and 58 end-to-end tests pass; lint, format and typecheck are
clean. The gate self-check held: all 18 phone assertions failed against the
pre-change build.

**The tension the spec did not foresee, and how it resolved.** UX-001's 44px
floor and REQ-005's compact chrome pull against each other. Raising every
control to 44px made the header *worse* than before this spec started — 271px
against the original 232px — and even after trimming it to 205px the map was
52.4% of the body at the peek stop, against criterion 1's 55%.

Two earlier proposals were wrong and are recorded because the reasoning matters:
relaxing criterion 1 to match the measurement, and moving the map's overlays off
the map. What actually resolved it was **20 pixels**: SPEC-009 AMEND-002 hides
the Ma graduation axis below the breakpoint. It is a reading aid, already
`aria-hidden`, not named in REQ-001's statement, and it duplicates less precisely
what the readout states exactly — the only one of four candidates whose removal
costs no requirement. Criterion 1 was met as written, at 55%+.

The second amendment, SPEC-023 AMEND-002, splits the bottom rails 60/40 instead
of 50/50 below the breakpoint. REQ-004's actual invariant — that the rails cannot
reach each other — is preserved; only the implied symmetry changes.

**Final height budget at 390×664:** app bar 79, context 126, timeline ~120,
body 339, sheet at peek 152, map visible 187 (55.2%).

**What the screenshots caught that the gates did not (2026-09-03).** Reviewing
rendered screens at 320×568 found the narrowest width visibly broken while every
assertion passed. Three real defects, all now gated:

1. **REQ-003 criterion 1 was violated at 320 and unmeasured.** `stopHeight`
   clamped the peek against `FULL_MAX_FRACTION` (75%) rather than against the
   criterion's own 55%, so on a ~200px container the sheet took 152px and left
   the map **25%**. The clamp now enforces the criterion at every container
   height, and a unit test covers short containers.
2. **The map rails used the nominal peek, not the real one**, so on a short
   viewport they were offset by 152px while the sheet rendered at 132px, pushing
   all three overlays out of the pane and over the timeline. The sheet now
   publishes its live height and the rails track it, which also means they ride
   above the sheet at every stop rather than only at rest.
3. **The gate toggle does not fit on a 320px map at all** — SPEC-023 AMEND-003
   moves it into the sheet below the breakpoint.

The lesson is worth keeping: every one of these passed a suite that enumerates
elements and measures boxes. Containment of overlays *within the map pane* was
simply not asserted at the width where it broke, and no amount of enumeration
substitutes for looking at the screen.

**Known limitations, recorded rather than solved:**

1. **The taxon profile renders no illustration at all.** Measured on the built
   app at both 390×664 and 1280×900, navigating to *Tyrannosaurus*
   (`txn:38613`), whose profile in `reference.json` does carry `imageUrl`
   entries: no `<img>` is painted. So UX-002's image-credit rule is verified by
   source inspection (`test/ui/spec030-hover-free.test.ts`) rather than
   end-to-end, and P-08's "the credit is hidden behind a hover" is today doubly
   unreachable. **This is pre-existing and outside this spec** — it belongs to
   the illustration work (SPEC-012 / SPEC-014) — and is a follow-up.
2. **`pnpm run e2e` is still not a required CI gate** (SPEC-003 assumption A-3).
   Almost every requirement here verifies through Playwright, so until that
   changes NFR-001's gate protects this work only when someone runs it.
3. **NFR-003's device check is outstanding.** The `dvh` toolbar behaviour and
   the safe-area insets are inferred from known engine behaviour; they need
   confirming on a physical notched phone.
4. **At 320×568 the clade key is reachable only by scrolling its rail.** The
   usable rail band there is ~34px, enough for the 30px basemap ⓘ but not for
   the collapsed key beneath it. SPEC-023 REQ-004 sanctions a rail scrolling its
   children rather than spilling them, so this is within the scheme, but a
   reader at that width will not see the key without scrolling. Wider phones are
   unaffected.
5. **Phone landscape remains a non-goal.** The layout does not break there
   (no overflow, no overlap), but at 844×390 it is cramped by design.

Order followed:

Suggested order, so each step is independently shippable and the gate exists
before the risky work: NFR-001 (the failing gate) → REQ-002 + UX-003 + NFR-003
(the cheap wins, which alone make the app testable on a real phone) → UX-001 +
UX-002 → REQ-006 (timeline) → REQ-007 (rails) → REQ-003/004/005 (the sheet, the
largest piece) → REQ-008 (taxonomy) → UX-005 (charter) → traceability.

## Spec amendments

### AMEND-005: The map overlays shrink, and the drawer stops squeezing the map

- **Date:** 2026-09-04
- **Reason:** Owner review, 2026-09-04: "Fix both also the information button and
  clade key take too much of the map in the mobile version" — the two remaining
  defects from the previous round plus a third the owner named.
- **Changed requirements:** REQ-005 and REQ-007. SPEC-023 REQ-004's rail share is
  amended for the phone case; SPEC-023 UX-001 is **not** amended — the clade key
  keeps its words.
- **Behavioral impact,** four changes, each measured:
  1. **The bottom-left rail is one row while the key is collapsed.** It was 106 x
     114 px at every phone width — a vertical band down the left of the map
     holding a 44px ⓘ and a 62px card whose whole content is the words "Clade
     key". Laid out side by side it is 150 x 46 px: 5% of the pane at 320 and 3%
     at 390, down from 8% and 6%, and it no longer occupies a column. Expanded,
     the rail returns to the stack, because then the key needs its height.
  2. **The bottom-left rail is bounded by the pane, not by a 40% share.** The
     Wikipedia gate moved into the sheet (SPEC-023 AMEND-003), so on this screen
     there is no opposite rail for the share to keep the key away from. Held to
     40% the expanded key was capped at 144px with 118px rows, and
     "Thyreophoran", "Ceratopsian" and "Pachycephalosaur" were cut off mid-word.
     It now sizes to its 183px min-content width. REQ-004's actual invariant —
     two rails can never meet — is asserted directly instead, together with the
     absence of the opposite rail.
  3. **Reset view moves into the drawer head.** At 320 the context row held a
     215px frame choice and a 72px Reset with a 12px gap: 299px into 296px, so
     Reset wrapped onto a 44px row of its own and the drawer stood at 358px of a
     568px screen. In the head — which had the space — the row fits and the
     drawer is 306px. The control's words and behaviour are unchanged
     (SPEC-022 REQ-006).
  4. **The occurrence sheet stands down while the drawer is open.** With the
     drawer open at 320 the sheet was clamped into 41px: a truncated grab handle
     over a 91px sliver of map. The map takes the whole remainder instead —
     **91px to 143px**, +57% — so the age being stepped is the thing that can be
     seen changing. The sheet returns unchanged on Done, and the rails drop back
     to the corner rather than clearing a sheet that is not there.
- **What is not weakened:** the clade key keeps its label, not an icon
  (SPEC-023 UX-001); the ⓘ, the gate count and the reconstruction note are
  untouched (charter §2 — provenance and uncertainty stay legible); every
  control keeps the 44px coarse-pointer floor; Reset stays permanently visible
  whenever the drawer is open, as CONS-450 requires.
- **What this does not fix:** at 320 x 568 the drawer still takes 306px of a
  449px body, so the map is 143px while it is open. That is the honest floor for
  a search field, a frame choice, a period stepper, a to-scale track and an axis
  at a 44px touch target — the drawer is transient and Done returns the screen.
- **Test impact:** `test/e2e/phone-layout.e2e.ts` REQ-007 restated against the
  amended bound (the pane, plus the opposite rail's absence) and extended with a
  clipped-label check on the expanded key. No test was relaxed or removed.
- **Human approval reference:** Owner request, 2026-09-04, session `session_01GvwYfnCtWQGcynW17zS4su`.

### AMEND-004: The drawer's age selector shows one period at a time

- **Date:** 2026-09-04
- **Reason:** Owner request, 2026-09-04: "If we show only the timestep band of
  the age currently selected it would give us more breathing room. We could also
  change the 3 age buttons to a single label with left and right arrows to change
  age."
- **Changed requirements:** REQ-005/REQ-006, in the composition of the drawer's
  timeline only. The behaviour change itself belongs to SPEC-009 and is recorded
  there as **SPEC-009 AMEND-003** — the track in the drawer is scoped to the
  selected period, and the three period bands become a single stepper. This entry
  exists so the phone layout's own spec points at it rather than looking silent.
- **Behavioral impact:** inside the controls drawer the track carries the selected
  period's stages only (12 instead of ~30 at the Cretaceous), the narrowest step
  goes from 1-2 px to 13 px at 390 and 10 px at 320, and the period row drops from
  three bands to `<older | Period | younger>`. The strip layout outside the drawer
  is unchanged, and REQ-005's permanent age/group/count line is untouched.
- **Test impact:** covered by SPEC-009 AMEND-003's assertions; the existing
  REQ-005 drawer gate in `test/e2e/phone-sheet.e2e.ts` continues to locate the
  "Jump to period" group, which the stepper keeps.
- **Human approval reference:** Owner request, 2026-09-04, session `session_01GvwYfnCtWQGcynW17zS4su`.

### AMEND-003: The states behind the first screen, reviewed

- **Date:** 2026-09-04
- **Reason:** AMEND-002 fixed the screen you land on. Reviewing the states
  *behind* it — a detail, an empty age, the drawer — found seven more, two of
  them worse than anything in that list.
- **Changed requirements:** REQ-003 (the sheet raises itself when the body
  carries something to act on) and UX-004 (the empty state's recovery path must
  be on screen at rest, not merely rendered).
- **Behavioral impact:**
  1. **A detail opens at its own top.** The body kept the list's scroll offset,
     so a tap on a row landed the reader halfway down the detail with the taxon
     and the back control above the fold. Both directions reset now, and the
     list's own controls stand down (SPEC-026 AMEND-002).
  2. **An empty age raises the sheet.** At the 76px resting height "No
     occurrences at this age" and its Reset control sat below the fold: the
     screen was a blank map and a count of zero, with no way out. The sheet
     raises itself when the list is empty — but only once the stage has
     *resolved*, since `occurrences` is empty during the first fetch too and
     raising on that opened every load at half.
  3. **The count is stated once.** The handle carries it at every stop, so the
     list header repeated it three lines below.
  4. **The five unit options fit one row** — for real this time. AMEND-002 set
     an 8px gap that never applied: these phone rules sit *earlier* in the
     stylesheet than the declarations they override, so at equal specificity the
     base rules won. Measured 12px gaps in a 358px group holding 317px of
     options.
  5. **The handle names the detail** while one is open, instead of claiming a
     count of rows it is not showing.
  6. **The drawer's stray "·"** — hiding the stats before the frame toggle left
     the separator rule firing on the first visible item. Same specificity trap
     as item 4.
  7. **The drawer's frame toggle and Reset share a line**, and the Ma axis drops
     its trailing unit, which collided with the last tick label ("75Ma").
- **On the gates, again.** Every one of these passed the suite. `toBeVisible()`
  is true for an element scrolled out of a scroll container, and `getByRole`
  finds a control below the fold — so the three new assertions use
  `toBeInViewport()` on the back control and on the empty state's recovery
  control, and count how many times the sheet states its own count. The pattern
  across AMEND-002 and AMEND-003 is the same: asserting that a thing *exists*
  and *fits* is not asserting that the reader can see it when they need it.
- **Human approval reference:** Owner approval: 2026-09-04, session `session_01GvwYfnCtWQGcynW17zS4su` — review of the drawer and the unreviewed states.

### AMEND-002: The screen reviewed, and eleven layout defects fixed

- **Date:** 2026-09-04
- **Reason:** AMEND-001 was measured, gated and shipped, and then *looked at*.
  Eleven real layout defects survived every automated check, because each gate
  asserted a dimension and none asserted what the screen said.
- **Changed requirements:** REQ-003 (the peek stop's contents are now rendered
  in the handle, not the body), REQ-006 (the drawer's timeline keeps its Ma
  axis) and REQ-008 (the map's opening camera).
- **Behavioral impact**, all at `max-width: 40rem`:
  1. **The sheet at rest names itself.** The peek stop rendered a grab handle
     and nothing else — the in-view count was in the scrollable body, below the
     fold, so the sheet said nothing about what it held. The count moves into
     the handle, where it cannot fall below a fold again. Its noun is pluralised
     properly rather than "occurrence(s)", since this string is now read
     constantly.
  2. **The age stepper is one control.** A `flex: 1` readout pushed ◀ and ▶ to
     the screen edges, leaving a 44px box marooned in each corner; they now sit
     against the readout, centred.
  3. **The disabled end of the range is a ghost, not an empty box.** The app
     boots at the youngest stage, so the first thing on screen was a bordered
     button that did nothing. Charter §7 still holds — it is disabled with a
     stated reason, not hidden.
  4. **The stage name no longer truncates.** At 320px the readout ellipsised to
     "Maastrichti…", losing the one value the strip exists for; the Ma span
     gives way first.
  5. **The app bar is one row**, 71px → 49px. The wordmark shrinks and
     ellipsises rather than wrapping to a line of its own; the nav holds its
     width, since as a shrinkable flex item its min-content is one button and it
     collapsed into three rows when first tried.
  6. **The age is printed once, not three times.** The drawer repeated it in the
     context row's "Selected age" stat and again in the timeline's own label,
     with the group and count twice — the clutter the redesign was meant to
     remove, relocated.
  7. **The Ma axis returns** inside the drawer. It was hidden to win 20px for a
     height problem the drawer removed, and a to-scale track with no scale is
     half a control.
  8. **The drawer has one inset**, so the search field, the frame options,
     "Reset view", the period bands and the axis line up; "Reset view" and the
     axis's end labels were being clipped at the screen edge.
  9. **The drawer has a title and its close at the top**, so it reads as one
     panel rather than a pile of controls with a "Done" floating under them.
  10. **The five unit options fit one row** — a 16px gap made them 383px in a
      366px column, wrapping 4 + 1 and orphaning "Major group".
  11. **The map opens framed on the data.** See REQ-008 below.
- **REQ-008 (new behaviour):** on a phone the map fits its camera to the stage's
  occurrences once, on first paint, instead of opening at the fixed
  `center: [-75, 55], zoom: 2.2` chosen for a wide desktop pane. On a 390×470
  portrait pane that camera crops elsewhere: the markers crowded the left edge
  and the right half was empty ocean. Measured after: 1,981 of 2,135
  occurrences in view at load, against roughly a third before. Once per mount,
  not per stage — re-framing on every age step would yank the camera away from a
  reader who had panned somewhere deliberately, and stepping the age is the
  loop's most common action. It reuses SPEC-027's search-landing fit rather than
  adding a second camera path, and is off above the breakpoint, so the desktop's
  opening view is unchanged (NFR-002).
- **What this says about the gates.** Every one of these passed a suite that
  measures boxes. The two new assertions are of a different kind — the sheet's
  resting label must *contain a count*, and the app's own reported
  in-view-to-total ratio must be at least half — because "76px tall" and "says
  what it holds" are not the same claim, and only the second one is the
  requirement.
- **Human approval reference:** Owner approval: 2026-09-03/04, session `session_01GvwYfnCtWQGcynW17zS4su` — "look honestly at the screen… tell me all the issues" / "fix all that. Ammend spec if you need to".

### AMEND-001: The map is the screen; the rest goes behind a drawer

- **Date:** 2026-09-03
- **Reason:** the layout this spec described was built, measured against every
  criterion, and reviewed — and the verdict on the rendered screen was that it
  is "way too cluttered" and "not possible as is". The numbers agreed once
  measured against the right denominator: at 390×664 the map was **187px of a
  664px viewport — 28%** — under 205px of permanent header and above a 152px
  sheet. Every acceptance criterion passed, because REQ-003 criterion 1 measures
  the map against the *body* rather than against the screen, and the body is
  what the chrome had already eaten.
- **Changed requirements:** REQ-003 (peek contents), REQ-005 (what the header
  carries) and REQ-006 (where the to-scale timeline lives).
- **Behavioral impact**, all at `max-width: 40rem` and none above it:
  1. The exploration header becomes an **age strip**: one row of ◀ / age
     readout / ▶, plus a line carrying the group and the count. 71px, against
     205.
  2. The taxon search, the full to-scale timeline (track, period bands, axis),
     the frame toggle and Reset view move into a **controls drawer**, opened
     from the readout and closed on load. It is a disclosure in normal flow, not
     a modal: no scrim, no focus trap, and the map simply gets its space back.
  3. The sheet's peek stop drops the five-unit selector, 152px → 76px. The
     selector is one drag away at the half stop.
- **What is *not* relaxed:** FONC-040/050/060 still hold literally — the age,
  the group and the count are on screen at all times, in the strip. Stepping the
  age, the loop's central verb, stays a single tap and does not go behind the
  drawer.
- **CONS-450 is amended, and this is the substantive cost.** "The system must
  keep the main time, map and filter controls visible on the exploration view"
  no longer holds on a phone for the *to-scale timeline*, the *frame toggle* and
  *Reset view*: each is one tap away rather than visible. The age itself, the
  map, and the list's own filters remain. The constraint was written for a
  desktop viewport where visible and usable were the same thing; on a 664px
  screen, keeping all of it visible is what made the map unusable, which is not
  what CONS-450 exists to protect.
- **Measured result:** map 187px → **450px at 390×664 (68% of the screen)**, and
  110px → 354px at 320×568 (62%).
- **Test impact:** a new gate measures the map's share against the *viewport*
  rather than the body, and asserts the drawer is unrendered on load and whole
  when opened. `phone-layout`'s UX-003 and `phone-touch` now open the drawer
  before looking for the search field — an input that is not rendered cannot be
  measured, and a gate that silently found zero of them would assert nothing.
- **Human approval reference:** Owner approval: 2026-09-03, session `session_01GvwYfnCtWQGcynW17zS4su` — "the main view is not satisfactory… the map needs to be the star of the show. Other things need to become hidden behind drawers."

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [x] Open questions are resolved or explicitly deferred. — two resolved by the
      approval, one (the e2e CI gate) explicitly deferred with its limitation
      recorded.
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed.
- [x] Human approval recorded before status set to Approved. — owner, 2026-09-02.
