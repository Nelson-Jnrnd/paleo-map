---
doc_type: spec
spec_id: SPEC-023
title: Map overlay layout — corner rails, reserved map-control corner, and an automated non-overlap gate
status: Implemented
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: [25]
affected_components: [app-frontend, exploration-view, occurrence-map, styling, e2e-tests]
affected_interfaces: [ExplorationView, OccurrenceMap, exploration.module.css]
supersedes: []
superseded_by:
depends_on: [SPEC-003, SPEC-010, SPEC-011, SPEC-014, SPEC-015]
conflicts_with: []
last_verified_at:
---

# SPEC-023: Map overlay layout — corner rails, reserved map-control corner, and an automated non-overlap gate

## Summary

Things that float over the map are colliding. The owner reported two: the
basemap **ⓘ** info button sits on top of the clade key (both claim the map's
bottom-left corner), and MapLibre's **zoom buttons** sit on top of the
"Show taxa without a Wikipedia article" toggle (both claim the top-right
corner). The cause is that six overlays each pick their own corner
independently, so every new overlay is a fresh chance to collide. This spec
replaces that with a small, stated layout scheme — **four corner rails, one
owner per corner, one corner reserved for the map library's own controls** — and
adds a Playwright test that measures the real bounding boxes at several window
sizes and fails if any two overlays intersect. The scheme fixes the two reported
collisions plus three more found while investigating, and the test stops the next
one from shipping.

## Context

The map pane (`.mapPane`, `src/app/components/exploration.module.css:378`) is a
`position: relative` box. Six things are absolutely positioned inside it by two
different components, plus one control block owned by MapLibre:

| Overlay | Rendered by | Current anchor | Introduced by |
| --- | --- | --- | --- |
| Reconstruction label "▲ Paleogeographic reconstruction" | `ExplorationView.tsx:458` (`.reconstructionBanner`, css:456) | `top: 12px; left: 12px` | SPEC-007 |
| Wikipedia-gate toggle | `ExplorationView.tsx:461` (`.wikiGateToggle`, css:473) | `top: 12px; right: 12px` | SPEC-014 AMEND-005 |
| Cluster-semantics note | `ExplorationView.tsx:478` (`.mapLegend`, css:1300) | `bottom: 12px; left: calc(12px + 30px + 8px)` | SPEC-010 REQ-002 |
| Clade key | `OccurrenceMap.tsx:1036` (`.mapLegend2`, css:702) | `bottom: 12px; left: 12px` | SPEC-015 REQ-001 |
| Basemap **ⓘ** + popover | `OccurrenceMap.tsx:1051` (`.basemapAttribution`, css:392) | `bottom: 12px; left: 12px` | SPEC-004 / SPEC-011 |
| Marker labels, cluster counts, hover card, species card | `OccurrenceMap.tsx:973` (`.mapOverlay`, css:495) | `inset: 0`, children in map pixel space | SPEC-015 |
| Zoom controls (`NavigationControl`) | MapLibre, `OccurrenceMap.tsx:511-513` | `"top-right"` (library default: 29×29 px buttons, 10 px margin) | SPEC-003 |

The codebase already knows this hazard exists. `.mapLegend` carries the comment
*"Clear the basemap info button that anchors the map's bottom-left corner"* and a
hand-written `left: calc(var(--space-3) + 30px + var(--space-2))` offset. That is
the whole problem in one line: the fix was a manual offset in one overlay's rule
rather than a rule about the corner, so `.mapLegend2` (added later by SPEC-015)
simply did not know about it and re-took the corner.

**Parallel draft SPEC-021.** A spec being drafted in parallel removes the
cluster-semantics note and the reconstruction label from the map entirely. As of
this draft there is no `SPEC-021-*.md` file in `docs/specs/`, so its content is
not verifiable here. This spec is therefore written to be **correct whether or
not those two overlays survive**: each is assigned to a rail, an empty rail is
not rendered, and no requirement here depends on either element existing. There
is no ordering dependency in either direction, and SPEC-021 is deliberately not
in `depends_on`. See *Conflict check*.

Binding design context: `docs/mockups/design-guidelines.md` §2 (uncertainty and
provenance always legible, never behind a hover or a secondary click), §5
(one obvious primary action; icons earn their place), §6 (long labels wrap or
truncate, never overlap or clip), and the restraint rule in §4.

## Problem statement

Overlays that are supposed to explain the map are covering each other and
covering the map's own controls. Concretely, in the default view on a normal
desktop window, with values read from the stylesheet and MapLibre's default
control metrics:

1. **ⓘ over the clade key** (owner-reported). Both anchor `bottom: 12px;
   left: 12px`. The key is ~165 px wide and ~190 px tall; the ⓘ is a 30×30 disc
   with a higher `z-index`, so it lands on the key's bottom-left corner and
   covers its last row.
2. **Zoom buttons over the Wikipedia-gate toggle** (owner-reported). The toggle
   anchors `top: 12px; right: 12px`; MapLibre's control group occupies roughly
   the 29 px column and 58 px band inset 10 px from the same corner. They
   overlap by roughly 27×25 px. This is not only visual: the toggle has
   `z-index: 2` and the map container is unpositioned in the stack, so the
   toggle paints **over** the zoom-in button and swallows clicks aimed at it.
3. **Clade key over the cluster-semantics note** (found here, not reported). In
   the default *Occurrences* mode both render. The note starts at `left: 50px`;
   the key spans `left: 12px` to ~177 px. They share the bottom ~30 px band.
4. **Corner overlays over the hover/species cards** (found here). `.mapOverlay`
   declares `z-index: 1`, which makes it a stacking context; its children's
   `z-index: 3` / `5` are therefore trapped **below** the clade key (`2`) and the
   ⓘ (`3`). A hover card or the multi-species card opened near the bottom-left
   corner paints behind the key.
5. **Attribution popover under/over the key** (found here). The popover opens
   upward from the ⓘ, 300 px wide, into exactly the space the clade key
   occupies. This one is a transient disclosure so overlapping while open is
   acceptable — but only if the popover is guaranteed to paint *above* the key,
   which the current rules do not guarantee by construction.

None of this is caught today: there is no visual or geometric assertion anywhere
in the suite. `test/e2e/*.e2e.ts` asserts visibility, roles and text; `axe`
covers accessibility; nothing measures a box. Every collision above shipped
through a green CI.

## Goals

- Fix both owner-reported collisions, and the three further collisions found.
- Replace per-overlay corner guessing with a **stated layout scheme** so the
  next overlay added cannot reintroduce the defect.
- Account explicitly for MapLibre's own controls, without hard-coding the
  library's pixel metrics into app CSS.
- Keep overlays non-overlapping on **small map panes**, not just wide ones.
- Make non-overlap **machine-checked** in CI, at defined viewport sizes and in
  all three grouping modes.

## Non-goals

- Redesigning any overlay's content, wording, or visual style. Only where an
  overlay sits, how it is contained, and what paints above what.
- Changing which overlays exist. Removing the cluster note or the reconstruction
  label is SPEC-021's business, not this spec's.
- A responsive/mobile layout for the exploration view (the sidebar/map split is
  unchanged; only overlay containment is made width-safe).
- Visual-regression screenshot testing. This spec specifies geometric assertions,
  not pixel snapshots — snapshots are flaky under software WebGL and would gate
  on unrelated map paint.
- Any change to MapLibre's control set (no compass, no scale bar added).
- Introducing a design-system abstraction beyond the four rails described here.

## Users or actors

- **The Explorer** (charter §1) reading the map: needs the key, the provenance
  ⓘ, the reconstruction label and the zoom buttons all usable at once.
- **The next agent** adding an overlay: needs a rule that makes the correct
  placement obvious and a test that fails loudly if it is ignored.
- **CI** (`.github/workflows/ci.yml`, `e2e` job): runs the new gate.

## Functional requirements

### REQ-001: Corner rails are the only home for persistent map overlays

- **Statement:** The map pane provides up to four **overlay rails** — one per
  corner. Every overlay that is persistently visible over the map must be a
  child of exactly one rail and must not set its own `top` / `right` / `bottom` /
  `left` offsets; the rail owns the corner offset. Each corner has **at most one
  rail element in the DOM**, and each rail is rendered by exactly one component
  (see REQ-002 for ownership). A rail with no visible children must not render
  (no empty box, no stray border). For enumeration by tests, the map pane
  carries `data-map-pane`, each rail carries
  `data-map-rail="top-left|top-right|bottom-left|bottom-right"`, and each rail
  child carries a stable `data-map-overlay="<name>"`.
- **Rationale:** The defect is that six elements each chose a corner in isolation
  and one of them compensated with a hand-written `calc()` offset. A single
  container per corner makes stacking automatic and makes "where does my new
  overlay go" a one-line answer. The data attributes exist because CSS-module
  class names are hashed at build time and are not stable test selectors.
- **Acceptance criteria:**
  1. The map pane's direct element children are only: the rails, the MapLibre
     container, the transient overlay layer (REQ-005), and the loading/error
     state element — nothing else.
  2. No CSS rule for a rail *child* declares `position: absolute` with a corner
     offset.
  3. Every rail child carries a non-empty `data-map-overlay` value, unique
     within the pane.
  4. With every rail child hidden (e.g. locality mode, where the clade key is
     not rendered), no empty rail element remains in the DOM.
- **Verification method:** automated — Vitest structural test (DOM children of
  the pane, `data-*` attributes, empty-rail case) plus a CSS-source assertion
  over `exploration.module.css`; and the e2e enumeration in NFR-001.
- **Evidence location:** `test/ui/spec023-overlay-structure.test.tsx`,
  `test/ui/spec023-overlay-css.test.ts` (planned)

### REQ-002: Declared corner ownership, with the map library's corner reserved

- **Statement:** Corners are assigned as follows, and no app overlay may be
  placed in the corner reserved for the map library:

  | Corner | Owner | Contents |
  | --- | --- | --- |
  | top-left | `ExplorationView` | Standing statements about what the map shows: the reconstruction label, and the cluster-semantics note **if it still exists** |
  | top-right | **MapLibre** (reserved) | The library's own controls (`NavigationControl`). No app overlay, ever |
  | bottom-left | `OccurrenceMap` | Reading the map and its provenance: the clade key, then the basemap **ⓘ** |
  | bottom-right | `ExplorationView` | App controls acting on what is plotted: the Wikipedia-gate toggle |

  Consequently: the Wikipedia-gate toggle **moves** from top-right to the
  bottom-right rail, and the cluster-semantics note **moves** from its
  hand-offset bottom-left position into the top-left rail. Nothing else moves
  corner. If the map library's attribution control is ever enabled, it must be
  configured to the reserved top-right corner or this requirement must be
  amended.
- **Rationale:** Reserving one whole corner for the library removes the app's
  dependency on MapLibre's control geometry entirely — no gutter constant to
  keep in sync, and a library upgrade that changes button size cannot cause a
  collision. Assigning the remaining corners **by kind** (status · key and
  provenance · controls) gives the next author a rule they can apply without
  reading this document. Assigning each corner to a single component means no
  cross-component container, portal, or shared ref is needed: `OccurrenceMap`
  keeps rendering the two overlays it already owns, `ExplorationView` keeps
  rendering the three it already owns.
- **Acceptance criteria:**
  1. Each named overlay's bounding box lies in its declared corner quadrant of
     the map pane (its two declared edges are the nearer ones).
  2. No element carrying `data-map-overlay` intersects the top-right quadrant's
     library-control boxes; the top-right rail does not exist.
  3. The Wikipedia-gate toggle keeps its current label, accessible name, and
     behaviour; only its position changes.
  4. Both owner-reported collisions are absent at every viewport in the NFR-001
     matrix.
- **Verification method:** automated — e2e quadrant + intersection assertions
  (NFR-001); Vitest component assertion that the toggle renders inside the
  bottom-right rail with an unchanged accessible name.
- **Evidence location:** `test/e2e/map-overlays.e2e.ts`,
  `test/ui/spec023-overlay-structure.test.tsx` (planned)

### REQ-003: Declared stacking order inside a rail

- **Statement:** A rail lays its children out in a single column with a token
  gap. Bottom rails stack **upward from the corner** and top rails stack
  **downward from the corner**; in each rail the DOM order is the reading order
  from the corner outward. For the bottom-left rail the order from the corner is:
  **ⓘ (corner-most), then the clade key**. A disclosure anchored to a rail child
  (the attribution popover) is allowed to open across its rail siblings and must
  paint above them; placing the ⓘ last in DOM order satisfies this without a
  `z-index`.
- **Rationale:** The ⓘ is a fixed 30 px anchor whose popover opens upward, so it
  must be the item nearest the corner or the popover opens through its own rail.
  Fixing the order also makes the rail's appearance stable when a sibling
  appears or disappears (mode changes, SPEC-021 deletions).
- **Acceptance criteria:**
  1. In the bottom-left rail, the ⓘ's box bottom edge is at or below every
     sibling's bottom edge, and no sibling's box intersects it.
  2. Opening the attribution popover leaves the ⓘ and the popover fully visible;
     the popover is painted above the clade key (the key's text is not drawn
     over the popover).
  3. Rail children are separated by at least the token gap in the stacking
     direction.
- **Verification method:** automated — e2e box ordering and the popover-open case
  (the ⓘ is a real button and is clickable headlessly, as `exploration.e2e.ts`
  already does); DOM-order assertion in Vitest.
- **Evidence location:** `test/e2e/map-overlays.e2e.ts`,
  `test/ui/spec023-overlay-structure.test.tsx` (planned)

### REQ-004: Rails are bounded so they cannot reach each other or leave the pane

- **Statement:** Rails are size-bounded rather than breakpoint-switched. Each
  rail is at most `calc(50% - <gap>)` of the map pane's width, and the bottom
  rails are additionally capped in height so they cannot grow into the top rails'
  band. A rail child that would exceed its rail's box must **wrap** (text) or
  **scroll inside its own box** (the clade key); it must never overflow the rail,
  never be clipped without a scroll affordance, and never be truncated in a way
  that loses a word (charter §6). Every overlay box stays fully inside the map
  pane at every supported viewport.
- **Rationale:** The sidebar is `width: 360px; max-width: 42vw`, so the map pane
  can be under 400 px wide, where correctly-cornered overlays still meet in the
  middle. A 50 % cap makes non-overlap true **by construction at every width**,
  with no breakpoint to test at and no magic numbers. The height cap replaces the
  clade key's current `max-height: 45%`, which is measured against the wrong box
  (the pane, not the remaining rail space).
- **Acceptance criteria:**
  1. At every viewport in the NFR-001 matrix, every overlay box is fully
     contained in the map pane's box.
  2. No overlay box exceeds half the pane's width.
  3. The clade key shows all 9 clade rows when the rail's height allows, and
     scrolls within its own box when it does not; its scroll container is not
     larger than the rail.
  4. No overlay's text is clipped: the rendered scroll width of each text
     overlay is not greater than its client width.
- **Verification method:** automated — e2e geometry across the viewport matrix,
  including a deliberately short viewport that forces the clade key to scroll.
- **Evidence location:** `test/e2e/map-overlays.e2e.ts` (planned)

### REQ-005: Paint order — transient surfaces above rails, rails above the canvas

- **Statement:** The map pane has one declared paint order:
  **map canvas and library controls → map-space labels and cluster counts →
  corner rails → transient pointer-anchored surfaces** (hover card, species card,
  attribution popover). The transient overlay layer (`.mapOverlay`) must not
  create a stacking context that traps its cards below the rails: its cards must
  compete with the rails directly and win. No app overlay may cover a library
  control's hit area, and no rail may cover a card's hit area.
- **Rationale:** Today `.mapOverlay { z-index: 1 }` creates a stacking context,
  so a hover card at `z-index: 3` and the pinned/species cards at `z-index: 5`
  are all pinned below the clade key at `z-index: 2` — a card opened near the
  bottom-left corner is hidden behind the key. Dropping the layer's own
  `z-index` (rather than raising the whole layer) is the correct fix: labels stay
  under the rails, cards go above them. Hit-testing is called out separately
  because the zoom-button defect is a *click* failure, not just a visual one.
- **Acceptance criteria:**
  1. `document.elementFromPoint` at the centre of each library control button
     resolves to that button (or a descendant of it), not to an app overlay.
  2. The same holds for the centre of every `data-map-overlay` element — it hit-
     tests to itself.
  3. The transient overlay layer declares no `z-index`; the card rules declare a
     `z-index` strictly greater than the rails'; the marker-label rules declare
     none.
  4. With the attribution popover open, the popover hit-tests to itself over the
     clade key's area.
- **Verification method:** automated — e2e `elementFromPoint` assertions; CSS-
  source assertion over `exploration.module.css` for the declared order.
- **Evidence location:** `test/e2e/map-overlays.e2e.ts`,
  `test/ui/spec023-overlay-css.test.ts` (planned)

## Non-functional requirements

### NFR-001: Automated non-overlap gate in CI

- **Statement:** A Playwright spec `test/e2e/map-overlays.e2e.ts` runs in the
  existing `e2e` CI job and fails if any two persistent map overlays intersect.
  It enumerates boxes rather than naming them, so overlays added later are
  covered automatically:

  ```ts
  // Boxes under test, per viewport × mode:
  //   rails:    page.locator("[data-map-rail] > [data-map-overlay]")
  //   library:  page.locator(".maplibregl-ctrl")
  // Assertions, for the loaded map in its resting state:
  //   1. every box is contained in the [data-map-pane] box
  //   2. every ordered pair (a, b) has an empty intersection
  //   3. elementFromPoint(centre of box) resolves inside that box's element
  //   4. every rail child has a non-empty data-map-overlay name
  const overlap = (a: Box, b: Box) => ({
    w: Math.min(a.x + a.width,  b.x + b.width)  - Math.max(a.x, b.x),
    h: Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  });
  // Pass when the intersection is empty on either axis, with a sub-pixel
  // tolerance for layout rounding:
  const disjoint = (a: Box, b: Box) => {
    const o = overlap(a, b);
    return o.w <= 0.5 || o.h <= 0.5;
  };
  ```

  **Viewport matrix** (`page.setViewportSize`): 1440×900, 1280×800, 1024×768,
  900×700, 820×640. The last two exercise a narrow map pane (the sidebar is
  `min(360px, 42vw)`, so the pane is ~348–520 px wide) and a short pane that
  forces the clade key to scroll. **Mode matrix:** *Occurrences* (default),
  *Localities*, *Taxa* — selected through the sidebar's "Group occurrences by"
  buttons, which are reachable headlessly. The three modes render different
  overlay sets (the clade key is hidden in locality mode; the cluster note is
  hidden in taxon mode), so a single-mode test would miss collision 3. Failures
  must name both overlays and print both boxes.
- **Rationale:** This is the requirement that keeps the defect fixed. DOM tests
  cannot see overlap — jsdom has no layout — and "manual inspection" is exactly
  the check that already let five collisions through. Bounding-box intersection
  in a real browser is the cheapest assertion that actually proves the property,
  and `elementFromPoint` extends it to occlusion, which boxes alone cannot see.
  Screenshot comparison is rejected: under SwiftShader the map paint is not
  stable enough to gate on.
- **Acceptance criteria:**
  1. `pnpm run e2e` runs the new spec; it passes on the fixed build.
  2. Reverting any one of the five collision fixes makes it fail, with a message
     naming the two overlapping overlays. (Demonstrated once during
     implementation and recorded in the PR.)
  3. The spec adds no new CI job and no browser download beyond the existing
     Chromium install.
  4. Runtime stays within the existing 30 s per-test timeout; the matrix is
     driven inside a small number of tests rather than one test per pair.
- **Verification method:** automated — the spec itself, run in the `e2e` job.
- **Evidence location:** `test/e2e/map-overlays.e2e.ts`, CI `e2e` job log
  (planned)

### NFR-002: The scheme is regression-guarded without a browser

- **Statement:** A Vitest test asserts the structural half of the scheme — the
  map pane's allowed direct children, rail membership, `data-map-overlay` naming,
  DOM order within a rail, empty-rail suppression — and a CSS-source test asserts
  the declared paint order and the absence of corner offsets on rail children.
  These run in the fast `build` job, so a violation is caught before the browser
  suite.
- **Rationale:** The e2e gate proves geometry but only for overlays that render
  in a headless browser: in jsdom the MapLibre map never loads, so the clade key
  and the ⓘ are absent from component tests. The structural test is what catches
  "someone added an overlay outside a rail" in seconds, and it catches it for
  code paths the browser test cannot reach.
- **Acceptance criteria:**
  1. Adding a `position: absolute` corner-anchored overlay as a direct child of
     the map pane fails the structural test.
  2. The tests pass in `pnpm test` with no new dependency.
- **Verification method:** automated — Vitest.
- **Evidence location:** `test/ui/spec023-overlay-structure.test.tsx`,
  `test/ui/spec023-overlay-css.test.ts` (planned)

### NFR-003: No accessibility or keyboard regression

- **Statement:** Moving the Wikipedia-gate toggle and the cluster note changes
  DOM order, so: the axe gate stays green with no new serious/critical
  violation; the toggle keeps its accessible name and remains reachable and
  operable by keyboard; the clade key keeps an accessible name; the ⓘ keeps its
  existing label and focus ring; and every overlay control keeps a hit target of
  at least 24×24 CSS px (charter §6, PERF-090/100/120).
- **Rationale:** The reported zoom-button defect is itself a hit-target failure;
  a fix that trades it for a keyboard-order failure is not a fix.
- **Acceptance criteria:**
  1. `test/e2e/a11y.e2e.ts` passes unchanged.
  2. Tab order through the map pane reaches the toggle, the ⓘ, and the zoom
     buttons, each with a visible focus indicator.
  3. Every interactive overlay box measures ≥24×24 CSS px.
- **Verification method:** automated — existing axe e2e plus keyboard/size
  assertions in the new e2e spec.
- **Evidence location:** `test/e2e/a11y.e2e.ts`, `test/e2e/map-overlays.e2e.ts`
  (planned)

## Security and privacy considerations

No security or privacy surface: this spec changes CSS, DOM structure and tests
only. No new data, no network call, no storage. The app's no-egress property
(SPEC-018 `spec018-offline.test.ts`) is untouched. No SEC-XXX requirement.

## Data model impact

None. No DATA-XXX requirement — no schema, snapshot, or read-model change.

## API impact

None externally. Internally, `OccurrenceMap` and `ExplorationView` keep their
current props; only the markup they emit changes. No API-XXX requirement.

## UI or UX impact

### UX-001: A reading aid may be collapsible; provenance and uncertainty may not

- **Statement:** The **clade key** becomes collapsible: a labelled affordance
  ("Clade key") that collapses the key to its label and expands it again, open by
  default, state kept for the session only. No other overlay may be collapsed,
  auto-hidden, faded, or moved behind a hover: the reconstruction label, the
  cluster-semantics note, the Wikipedia-gate toggle's hidden count and the
  basemap ⓘ stay as they are. Collapsing is a user action only — the app must not
  collapse the key automatically based on viewport size.
- **Rationale:** The brief asks whether anything should be dismissed rather than
  repositioned. The charter answers it: §2 forbids hiding **uncertainty and
  provenance** behind a secondary click, and the label, the note and the ⓘ are
  exactly that. The clade key is a *reading aid* — the same information is
  already carried by each marker's shape and by the hover card's clade name — so
  it is the one overlay that may be put away. It is also by far the largest
  (~165×190 px, 9 fixed rows), so it is the one worth putting away on a small
  pane. Auto-collapse is excluded deliberately: it needs measurement, adds a
  state machine, and REQ-004's scroll behaviour already keeps the key inside its
  rail.
- **Acceptance criteria:**
  1. The key renders expanded on load, with a labelled control that collapses
     and re-expands it; the control is keyboard-operable and its state is exposed
     to assistive technology.
  2. Collapsed, the key occupies one line and still names itself.
  3. No other overlay gains a collapse, dismiss, or hover-reveal control.
  4. Collapse state does not persist across a reload (no storage).
- **Verification method:** automated — Vitest component test for the collapse
  behaviour and for the absence of a collapse control on the other overlays; plus
  inspection against charter §2.
- **Evidence location:** `test/ui/spec023-clade-key-collapse.test.tsx` (planned)

### UX-002: The map's visual language is unchanged

- **Statement:** This change introduces no new colour, no new container style, no
  new border, chip, card, or icon. Overlays keep their current surface treatment
  (translucent white panel, hairline border, muted text) and their current
  wording. Any new spacing value must come from an existing token in
  `src/app/styles/tokens.css`; at most one considered token addition is permitted
  (the bottom-rail height reserve) and it must be recorded there with a comment.
- **Rationale:** The anti-slop checklist's most expensive failure is at the
  layout level, and a layout spec is precisely where a "map overlay design
  system" would get invented. The scheme is four containers and a gap — nothing
  else. Restraint (charter §4) and "don't invent tokens" (checklist 10) are
  binding here.
- **Acceptance criteria:**
  1. The diff introduces no new hex value and no new `border-radius`,
     `box-shadow`, or font-size value.
  2. Overlay text is byte-identical before and after, except where SPEC-021
     removes an overlay.
  3. At most one new token, defined in `tokens.css`.
- **Verification method:** inspection of the diff at review, plus the existing
  token test (`test/ui/spec018-tokens.test.ts`) which fails on stray hex values
  in the map layer.
- **Evidence location:** PR diff review; `test/ui/spec018-tokens.test.ts`

## Configuration impact

None. No new environment variable, feature flag, or build setting. MapLibre's
`NavigationControl` stays at `"top-right"` and `attributionControl` stays
`false`.

## Error handling

- **Map loading / error state.** The loading and error states replace the map
  inside the same pane while the `ExplorationView`-owned rails remain mounted.
  Rails must not paint over the state panel's text; because the state panel is
  centred and rails are corner-bounded (REQ-004), containment is sufficient and
  no extra rule is added. The e2e gate asserts the *loaded* state only — the
  error state is not reachable headlessly.
- **No WebGL.** `OccurrenceMap` renders a text fallback instead of the map, so
  the bottom-left rail has no children and must not render (REQ-001 criterion 4).
  The `ExplorationView` rails still render over the fallback panel.
- **Missing basemap frame.** When `basemap`/`frame` are absent the ⓘ is not
  rendered; the clade key then sits alone in the bottom-left rail and must move
  down to the corner without a gap artefact.

## Edge cases

- **Narrow map pane.** Sidebar `min(360px, 42vw)` leaves ~348 px of map at a
  820 px window. Covered structurally by REQ-004's 50 % cap; long overlay text
  wraps rather than overlapping.
- **Short map pane.** Header + timeline consume fixed height; at 640 px window
  height the pane is roughly 360 px tall and the clade key's natural ~190 px
  plus the ⓘ nearly fills the bottom rail. The rail height cap plus the key's
  internal scroll keep it inside; the key remains collapsible (UX-001).
- **Clade key with many rows.** The key is **not** data-driven: it renders the
  fixed 9-entry `CLADE_MARKERS` set from `mapCladeMarkers.ts`, so its height is
  constant at ~190 px. The existing `max-height: 45%` is therefore sufficient
  above a ~445 px pane and silently degrades to a scroll stub below it. Two
  problems remain and are fixed by REQ-004: the percentage is measured against
  the pane rather than the space the rail actually has, and a scroll container
  laid over the map captures wheel events that were aimed at zooming. The second
  is contained by the fact that `overflow-y: auto` only scrolls when the content
  actually overflows.
- **Mode changes.** Locality mode hides the clade key; taxon mode hides the
  cluster note. Rails must reflow without leaving a gap or an empty box.
- **SPEC-021 lands first.** Both top-left rail children disappear; the rail is
  then not rendered (REQ-001 criterion 4) and the remaining requirements are
  unaffected.
- **SPEC-021 never lands.** Both overlays keep their rail assignment; the
  cluster note moves corner, which is a visible change the owner should expect.
- **Long Wikipedia-gate label.** "Show taxa without a Wikipedia article ·
  N hidden" is ~270 px; capped at 50 % of a narrow pane it wraps to two or three
  lines. Wrapping is correct per charter §6; overlapping is not.
- **MapLibre upgrade changes control size.** No app CSS depends on it; the
  reserved corner absorbs the change and NFR-001 would catch a regression.

## Acceptance criteria

This spec is satisfied when all of the following hold:

1. Both owner-reported collisions are gone, and collisions 3–5 in the *Problem
   statement* are gone, at every viewport in the NFR-001 matrix and in all three
   grouping modes.
2. Every persistent overlay lives in a corner rail with a declared owner, and no
   app overlay occupies the reserved top-right corner (REQ-001, REQ-002).
3. `pnpm run e2e` includes the non-overlap gate and passes; the gate demonstrably
   fails when a fix is reverted (NFR-001).
4. `pnpm run typecheck`, `pnpm run lint`, `pnpm run format`, `pnpm test`,
   `pnpm run build` and the governance scripts all pass.
5. The clade key is collapsible; no provenance or uncertainty overlay is
   (UX-001).
6. The diff introduces no new visual vocabulary and at most one new token
   (UX-002).
7. The traceability table below is filled with real file and test paths.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Pane's direct children are only rails/map/overlay-layer/state; every rail child named; empty rail not rendered; no corner offsets on rail children | automated | `pnpm test` → structural + CSS-source tests; `pnpm run e2e` enumeration | `test/ui/spec023-overlay-structure.test.tsx`, `test/ui/spec023-overlay-css.test.ts` | TBD |
| REQ-002 | Each overlay sits in its declared corner quadrant; top-right holds only library controls; toggle unchanged but relocated | automated | `pnpm run e2e` → quadrant + intersection assertions; Vitest toggle placement | `test/e2e/map-overlays.e2e.ts`, `test/ui/spec023-overlay-structure.test.tsx` | TBD |
| REQ-003 | ⓘ is corner-most in bottom-left; popover paints above the key; token gap between rail children | automated | `pnpm run e2e` → box order + popover-open case; Vitest DOM order | `test/e2e/map-overlays.e2e.ts`, `test/ui/spec023-overlay-structure.test.tsx` | TBD |
| REQ-004 | All boxes contained in the pane; none wider than half the pane; key scrolls instead of overflowing; no clipped text | automated | `pnpm run e2e` across the 5-viewport matrix incl. the short viewport | `test/e2e/map-overlays.e2e.ts` | TBD |
| REQ-005 | `elementFromPoint` at each control/overlay centre resolves to itself; overlay layer declares no `z-index`; cards above rails | automated | `pnpm run e2e` → hit-test assertions; Vitest CSS-source order assertion | `test/e2e/map-overlays.e2e.ts`, `test/ui/spec023-overlay-css.test.ts` | TBD |
| NFR-001 | Gate runs in CI, passes on the fix, fails on a reverted fix, names both overlays | automated | `pnpm run e2e`; revert-one-fix demonstration recorded in the PR | `test/e2e/map-overlays.e2e.ts`, CI `e2e` job log | TBD |
| NFR-002 | Structural + CSS tests catch an out-of-rail overlay without a browser | automated | `pnpm test` | `test/ui/spec023-overlay-structure.test.tsx`, `test/ui/spec023-overlay-css.test.ts` | TBD |
| NFR-003 | axe stays green; toggle keyboard-reachable with its name; targets ≥24×24 px | automated | `pnpm run e2e` → `a11y.e2e.ts` + keyboard/size assertions | `test/e2e/a11y.e2e.ts`, `test/e2e/map-overlays.e2e.ts` | TBD |
| UX-001 | Clade key collapses/expands, open by default, keyboard-operable; no other overlay collapsible; no persistence | automated + inspection | `pnpm test` → collapse test; charter §2 read-through at review | `test/ui/spec023-clade-key-collapse.test.tsx` | TBD |
| UX-002 | No new hex/radius/shadow/font-size; text unchanged; ≤1 new token | inspection + automated | PR diff review; `pnpm test` → `spec018-tokens.test.ts` | PR diff, `test/ui/spec018-tokens.test.ts` | TBD |

## Test plan

**New — `test/e2e/map-overlays.e2e.ts` (the gate, NFR-001).** Drives the built
app in Chromium under the existing Playwright config. Structure:

1. A `test.describe` per viewport in the matrix (1440×900, 1280×800, 1024×768,
   900×700, 820×640), setting the viewport before `page.goto("/")`.
2. Wait for the timeline nav, then `canvas.maplibregl-canvas` (20 s headroom, as
   `exploration.e2e.ts` already allows), then for at least one
   `[data-map-overlay]` to be visible — the map must be *loaded*, because the
   clade key and ⓘ only render then.
3. For each grouping mode — default *Occurrences*, then *Localities* and *Taxa*
   via the sidebar's "Group occurrences by" buttons — collect
   `boundingBox()` for every visible `[data-map-rail] > [data-map-overlay]` and
   every `.maplibregl-ctrl`, together with the pane box from `[data-map-pane]`.
4. Assert, in this order so a failure reports the most specific cause: naming →
   containment → pairwise disjointness (`disjoint()` above, 0.5 px tolerance) →
   `elementFromPoint` hit-testing → interactive target ≥24×24 px.
5. One extra case at 1280×800: click the ⓘ, assert the popover is visible, hit-
   tests to itself, and that the ⓘ itself is still fully visible (REQ-003).
6. One extra case at 820×640: assert the clade key's `scrollHeight` may exceed
   its `clientHeight` (it scrolls) while its box stays inside the rail and the
   pane (REQ-004).

Failure messages must include both overlay names and both boxes; a bare
`expect(true)` failure would be useless for a layout bug.

**New — `test/ui/spec023-overlay-structure.test.tsx` (NFR-002, REQ-001/002/003).**
Renders `ExplorationView` through the existing `test/ui/app-harness.tsx` fixture
in jsdom and asserts DOM structure: the pane's allowed direct children, rail
membership and naming, DOM order within a rail, and the empty-rail case (locality
mode). Note the limitation that motivates the e2e gate: **in jsdom MapLibre never
loads**, so the clade key and the ⓘ do not render and only the
`ExplorationView`-owned rails are observable here.

**New — `test/ui/spec023-overlay-css.test.ts` (REQ-001/005).** Reads
`src/app/components/exploration.module.css` as text — the pattern already used by
`spec018-tokens.test.ts` and `spec017-*` — and asserts: no rail-child rule
declares a corner offset; the transient overlay layer declares no `z-index`; the
card rules declare a `z-index` greater than the rails'; the marker-label rules
declare none.

**New — `test/ui/spec023-clade-key-collapse.test.tsx` (UX-001).** Component-level
collapse/expand, default-open, accessible name, and the negative case (no
collapse control on the provenance overlays).

**Existing suites that must stay green:** `test/e2e/exploration.e2e.ts` (asserts
the reconstruction label and the ⓘ popover — both still present, and the label
may move rail but not disappear under this spec), `test/e2e/a11y.e2e.ts`,
`test/ui/locality-mode.test.tsx`, `test/ui/taxon-mode.test.tsx`,
`test/ui/wikipedia-gate.test.ts`.

**Fixtures:** none new. The gate runs against the shipped snapshot through the
existing preview server.

**Manual check (supplementary, not the gate):** open the app at 820×640 and at
1440×900, in all three modes, and confirm the map reads as intended — the
automated gate proves non-overlap, not good taste.

## Rollback plan

The change is CSS plus JSX structure in two components, with no data, storage, or
API surface. Rollback is `git revert` of the single PR; there is no migration and
no state to unwind. Partial rollback is also safe: reverting only the corner
assignment (REQ-002) while keeping the rails restores the old positions without
breaking the build, and reverting the whole spec leaves the new tests as the only
casualty. If the gate turns out to be flaky in CI (it should not be — it measures
DOM boxes, not paint), the correct response is to narrow the viewport matrix, not
to delete the assertions; deleting or skipping the gate is forbidden by
`CLAUDE.md`.

## Risks

- **The gate is only as good as its enumeration.** An overlay added outside a
  rail would not be measured. Mitigated by NFR-002's structural test, which fails
  on any direct pane child that is not a rail.
- **Headless map load flakiness.** The clade key and ⓘ only exist after the map
  loads under SwiftShader. Mitigated by reusing the existing 20 s wait pattern and
  by asserting on a visible `[data-map-overlay]` before measuring; if the map
  cannot load, the test must fail loudly rather than measure an empty set.
- **Moving the cluster note is a visible change the owner did not ask for.**
  Mitigated by it being the smaller of two options (the alternative is a
  cross-component portal) and by it being moot if SPEC-021 lands. Flagged as a
  human decision below.
- **Runtime cost.** 5 viewports × 3 modes reloads the app 15 times. Mitigated by
  reusing one page per viewport and switching modes in place; if it approaches
  the 30 s timeout, drop the 1024×768 row (the 900×700 and 820×640 rows carry the
  narrow-pane risk).

## Open questions

- [x] Does the clade key's `max-height: 45%` suffice with many clades?
      **Resolved:** the key is a fixed 9-row set, not data-driven, so its height
      is constant (~190 px). The cap is not about clade count; it is about short
      panes, and it is measured against the wrong box. Replaced by REQ-004.
- [x] Should any overlay be dismissed rather than repositioned?
      **Resolved:** yes, exactly one — the clade key (UX-001). Provenance and
      uncertainty overlays may not be, per charter §2.
- [x] Reserve a corner for MapLibre, or move MapLibre's controls?
      **Resolved:** reserve top-right for the library. Moving
      `NavigationControl` to bottom-right was considered and rejected: it leaves
      the app coupled to the library's control geometry in whichever corner the
      controls land, and top-right is the conventional home for map zoom.
- [x] Does this spec depend on SPEC-021's ordering?
      **Resolved:** no. Every affected overlay is assigned to a rail and an empty
      rail is not rendered, so the scheme is correct with or without them.
      Deferred consequence: if SPEC-021 lands first, the implementing PR simply
      finds fewer children to place and must not re-add them.
- [ ] Deferred to implementation: whether the bottom-rail height reserve is
      expressible with existing tokens or needs the one permitted addition
      (UX-002). Either outcome satisfies this spec.

## Human decisions required

- [x] **Confirm the corner assignment (REQ-002).** The Wikipedia-gate toggle
      moves from the top-right to the **bottom-right** corner of the map, and the
      cluster-semantics note moves from the bottom-left to the **top-left**,
      under the reconstruction label. Everything else stays where it is.
      Answer: **Approved.** Owner approval recorded in session, 2026-08-14 (nelsonjeanrenaud@gmail.com).
- [x] **Confirm the clade key becomes collapsible (UX-001)**, open by default.
      Answer: **Approved.** Owner approval recorded in session, 2026-08-14 (nelsonjeanrenaud@gmail.com).
- [x] **Approval reference for Definition of Ready** (status → Approved).
      Answer: **Approved.** Owner approval recorded in session, 2026-08-14 (nelsonjeanrenaud@gmail.com).

**Approval record.** Owner approval recorded in session, 2026-08-14 (nelsonjeanrenaud@gmail.com). The owner confirmed every decision in this section and approved the spec for implementation.

## Conflict check

Affected components: `ExplorationView`, `OccurrenceMap`, `exploration.module.css`,
the Playwright suite.

- **SPEC-003 (exploration view)** — owns the map pane and the sidebar split. This
  spec adds containers inside the pane; no requirement of SPEC-003 changes.
- **SPEC-004 / SPEC-011 (basemap attribution)** — the ⓘ + popover disclosure is
  preserved exactly, including its corner; only its parent changes. SPEC-011's
  approved decision that the detail lives behind the toggle is untouched.
- **SPEC-010 REQ-002 (cluster-semantics note)** — the note must remain
  persistently visible; this spec moves which corner it occupies and does **not**
  hide, collapse, or condition it. If the owner considers the corner part of that
  requirement, this needs a SPEC-010 amendment rather than a change here; flagged
  as a human decision above.
- **SPEC-014 AMEND-005 (Wikipedia gate)** — the toggle's behaviour, label and
  hidden-count are unchanged; only its corner moves.
- **SPEC-015 REQ-001 (clade key)** — the key stays visible by default in point
  modes; UX-001 adds a user-operated collapse. If SPEC-015's requirement is read
  as "always expanded", UX-001 needs a SPEC-015 amendment; flagged as a human
  decision above.
- **SPEC-018 (map cartography)** — basemap paint only; no overlap.
- **SPEC-021 (parallel draft, not yet in the repository)** — proposes deleting the
  cluster-semantics note and the reconstruction label. Not a conflict: this spec
  assigns both to rails and requires empty rails not to render, so either landing
  order works and neither spec has to wait for the other. Recorded here rather
  than in `depends_on`, because a `depends_on` entry would assert an ordering that
  does not exist and would point at a file that does not exist.

No entry is required in `conflicts_with`.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Rail system | `.mapRail` + `data-map-rail` / `data-map-overlay`; `[data-map-pane]` on the map pane | `test/ui/spec023-overlay-structure.test.tsx`, `test/e2e/map-overlays.e2e.ts` | Implemented |
| REQ-002 | Corner ownership | Gate toggle moved top-right → `railBottomRight` (`ExplorationView`); ⓘ + clade key in `railBottomLeft` (`OccurrenceMap`); top-right left to MapLibre | `test/ui/spec023-overlay-structure.test.tsx` | Implemented |
| REQ-003 | Stacking order | Bottom rails are `column-reverse`, so DOM order reads from the corner outward: ⓘ first (corner-most), clade key above it | `test/e2e/map-overlays.e2e.ts` | Implemented |
| REQ-004 | Rail bounds | `max-width: calc(50% - gap)` on every rail; `max-height: 55%` on bottom rails; `.cladeKeyBody` scrolls in its own box | `test/e2e/map-overlays.e2e.ts` (five viewports, containment + non-overlap) | Implemented |
| REQ-005 | Paint order | `.mapRail { z-index: 2 }` under `.mapOverlay { z-index: 3 }`, so pointer-anchored cards are never trapped below a rail | `test/ui/spec023-overlay-structure.test.tsx`, `test/e2e/map-overlays.e2e.ts` (`elementFromPoint`) | Implemented |
| NFR-001 | Browser gate | `test/e2e/map-overlays.e2e.ts` — enumerates boxes, does not name them, so a later overlay is covered automatically | 7 Playwright tests | Implemented |
| NFR-002 | Browser-free guard | `test/ui/spec023-overlay-structure.test.tsx` — rail uniqueness, naming, no self-anchoring children, paint order from CSS source | 7 Vitest tests | Implemented |
| NFR-003 | No a11y regression | Clade key keeps `role="note"` + label; the toggle is a real button with `aria-expanded` | `test/e2e/a11y.e2e.ts` | Implemented |
| UX-001 | Collapsible key | `cladeKeyOpen` (session state, no storage); `.cladeKeyToggle` / `.cladeKeyBody` | `test/e2e/map-overlays.e2e.ts`, `test/ui/spec023-overlay-structure.test.tsx` | Implemented |
| UX-002 | Visual language | No new hue, no new container style; the key keeps its existing surface | diff review | Implemented |

### Verification evidence (2026-08-14)

| Command | Result |
| ------- | ------ |
| `pnpm run typecheck` | pass |
| `pnpm test` | 86 files, **488 tests**, all pass (before this change: 85 / 481) |
| `npx eslint src test --max-warnings=0` | clean |
| `npx playwright test` | **17 passed** (10 before + the 7 new overlay tests), a11y included |

### Implementation notes

- **The gate caught a real defect in this very change, before review did.** The
  first implementation set `data-map-rail` on both rails but never applied the
  corner *class*, so both rails fell back to the pane's top-left corner and
  stretched their children to the rail width. Every DOM assertion still passed —
  the elements existed, were visible and were correctly named — and the browser
  gate failed with `wikipedia-gate overlaps basemap-attribution` at all five
  viewports. This is exactly the class of defect NFR-001 was written for, and it
  is the reason the spec insisted on real geometry rather than a DOM test.
- **The top-left rail is never rendered.** SPEC-021 deleted both of its declared
  children (the reconstruction label and the cluster-semantics note), so REQ-001's
  "a rail with no visible children must not render" resolves it away entirely.
  The corner and its CSS class are kept, so restoring a standing statement later
  is a one-line change rather than a re-derivation. SPEC-023 anticipated both
  landing orders and needed no amendment for this.
- **`disjoint()` is exported from the e2e spec** for SPEC-025's cladogram gate to
  import, so the two suites cannot drift on what "not overlapping" means or on
  the 0.5px tolerance.


## Implementation notes

Recorded during drafting, to be extended at implementation.

- **Assumption A-1.** MapLibre's control metrics (29×29 px buttons, 10 px
  margin) are read from the library's defaults and are **not** to be hard-coded
  anywhere in app CSS. The reserved corner (REQ-002) is what makes that possible;
  the `calc(var(--space-3) + 30px + var(--space-2))` pattern in `.mapLegend` is
  the anti-pattern being removed.
- **Assumption A-2.** The five collisions in the *Problem statement* were derived
  by reading `exploration.module.css`, the two components, and MapLibre's default
  control metrics — **not** measured in a browser (the repository has no
  installed `node_modules` in the drafting environment). The first run of
  `map-overlays.e2e.ts` against the current build is expected to reproduce them
  and must be recorded in the PR as the "before" evidence.
- **Assumption A-3.** No cross-component container is needed because no corner is
  shared by two components after REQ-002. If a future overlay must be rendered by
  a component that does not own its corner, the choice is a portal into the rail
  or a lift into the owning component — that decision belongs to that spec, not
  this one.
- **Assumption A-4.** The viewport matrix targets desktop widths only; the
  exploration view has no mobile layout today and this spec does not add one.
- **Noted for a future spec, not folded in here (`CLAUDE.md`: no opportunistic
  refactors):** the `ExplorationView`-owned overlays render even while the map
  pane shows its loading, error, or no-WebGL state, so the reconstruction label
  and the toggle float over a panel that has no map behind it. That is a
  behaviour question, not an overlap defect, and is out of scope.

### Defect against REQ-004, found and fixed 2026-09-01

REQ-004 requires an oversized rail child to "scroll inside its own box (the clade
key)". `.cladeKeyBody` was given `overflow-y: auto` and nothing else — so it
scrolls, but a keyboard user could not reach it. WCAG 2.1.1: a scrollable region
must be focusable or its content is unreachable without a pointer, and axe
reports it as `scrollable-region-focusable` at serious impact.

**Measured on the shipped default, before SPEC-029 existed:** the key overflows
at 1280×700 and below, and at 900×700 — and axe flags it in every one of those
cases. It escaped the standing a11y gate only because that gate runs at
Playwright's default 1280×720, which is a couple of pixels above the threshold.
SPEC-029's present-day note takes about 33 px of the map pane's height, which
pushed the default viewport over the line and made the latent defect reachable —
so it surfaced as a failure of SPEC-029's new axe case rather than as a new bug.

Fixed by giving the region `tabIndex={0}`, `role="group"`, an accessible name and
a visible focus ring — the same pattern SPEC-025 UX-001 already uses for the
cladogram's scroll region. Verified with axe across 1280×720, 1280×700,
1280×620, 1024×768 and 900×700 in both frame modes: **zero serious violations in
all ten**, with the region focusable and labelled in each.

## Spec amendments

> Required for any behavioral change after the spec is Approved.

### AMEND-002: An asymmetric rail split at phone widths

- **Date:** 2026-09-02
- **Reason:** SPEC-030 REQ-007. With the map full-bleed under the occurrence
  sheet, halving a 360px-wide map gave each bottom rail 168px. The
  Wikipedia-gate toggle's label is long and wrapped to four lines (97px tall),
  which — once the rails were raised to clear the sheet's peek — walked it into
  the top-right corner REQ-002 reserves for MapLibre's own controls.
- **Changed requirements:** REQ-004, its "a rail can never grow into the
  opposite rail's half" clause.
- **Behavioral impact:** at `max-width: 40rem` the bottom-right rail may take
  60% of the pane and the left rails 40%, instead of 50/50. At 60% the gate
  toggle wraps to two lines. **REQ-004's actual invariant is preserved**: 40 + 60
  still leaves the gutter, so the rails cannot reach each other, and the
  automated non-overlap gate covers exactly that. Above the breakpoint the split
  is unchanged.
- **Behavioral impact, second part:** the bottom rails are additionally offset
  by the sheet's peek height so no overlay is covered by the sheet at rest, and
  their max-height is capped by what remains after that offset — raising a rail
  moves its top up as well as its bottom, which is what produced the collision
  in the first place.
- **Test impact:** `test/e2e/map-overlays.e2e.ts` gained 390×664 and 360×640
  (SPEC-030 NFR-001); the collision above is what those two widths caught.
- **Human approval reference:** Owner approval: 2026-09-02, session `session_01GvwYfnCtWQGcynW17zS4su` — "ammend what needs to be ammended and finish the work".

### AMEND-001: The clade key's default state on a phone

- **Date:** 2026-09-02
- **Reason:** SPEC-030 REQ-007 clause 3, on the owner's decision. Expanded, the
  clade key measures 183 × 193 px and covers **26% of the map at 320 px** and 22%
  at 390 px — on the screen where map area is scarcest.
- **Changed requirements:** UX-001 — its statement's final sentence ("Collapsing
  is a user action only — the app must not collapse the key automatically based on
  viewport size") and acceptance criterion 1 ("The key renders expanded on load").
  Both are **scoped by viewport, not removed**.
- **Behavioral impact:** At `max-width: 40rem` the clade key renders **collapsed**
  on load, to its labelled "Clade key" affordance, and expands on one tap. Above
  the breakpoint it renders expanded exactly as before, and the ban on
  viewport-driven collapse continues to apply there. Acceptance criteria 2
  (collapsed, it still names itself), 3 (no other overlay gains a collapse or
  dismiss control) and 4 (state is not persisted across a reload) are unchanged at
  every width. **No overlay moves, is hidden, is faded, or is put behind a hover.**
  The key remains the only collapsible overlay, and remains one tap from expanded.

  A broader amendment was proposed and **withdrawn**: SPEC-030 first intended to
  move the clade key and the Wikipedia-gate toggle off the map entirely. Measuring
  a full-bleed phone map showed that unnecessary — the overlays do not collide at
  390 px or above, and the 320–360 px collision is a defect against **REQ-004**
  (`.mapLegend2` cannot shrink below its min-content width, so `.mapRail`'s
  `max-width` is defeated), fixed under this spec rather than around it. The
  corner-rail scheme is untouched.
- **Why this does not weaken charter §2 / CONS-490:** on this spec's own
  reasoning the clade key is a reading aid, not provenance, because each marker's
  shape and the hover card's clade name carry the same information. **On touch the
  hover card does not exist**, so this amendment depends on SPEC-030 UX-002 (tap
  pins the card) shipping with it. The two must land together.
- **Test impact:** the Vitest collapse test gains a viewport-scoped default-state
  case rather than being replaced; SPEC-030's phone e2e asserts the collapsed
  default at four widths and the expanded default above the breakpoint. NFR-001's
  matrix is extended to 390×664 and 360×640.
- **Human approval reference:** Owner approval: 2026-09-02, session `session_01GvwYfnCtWQGcynW17zS4su`, approving SPEC-030.

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [x] Open questions are resolved or explicitly deferred.
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed.
- [x] Human approval recorded before status set to Approved.
