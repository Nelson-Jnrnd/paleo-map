---
doc_type: spec
spec_id: SPEC-025
title: Dinordle taxonomic tree — a real horizontal cladogram, drawn from row and depth integers
status: Draft
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, dinordle-screen, styling, unit-tests, e2e-tests]
affected_interfaces: [DailyGenusScreen, dailyGenus.module.css, cladogramLayout]
supersedes: []
superseded_by:
depends_on: [SPEC-019]
conflicts_with: []
last_verified_at:
---

# SPEC-025: Dinordle taxonomic tree — a real horizontal cladogram, drawn from row and depth integers

## Summary

The Dinordle puzzle's revealed classification is drawn today as an indented
ordered list whose branch connectors are CSS pseudo-element elbows of a fixed
height. The elbows are sized in `rem`; the rows they connect are sized by their
content. As soon as a long clade name wraps, the elbow no longer reaches the row
above it and the diagram visibly comes apart — the owner's "wonky text"
(2026-08-14). This spec replaces that with a **real horizontal rectangular
cladogram**: the root at the left, depth increasing rightward, one label per row,
ruled-out branches ending as struck-through terminals in a shared tip column, and
every connector drawn in one `aria-hidden` SVG layer whose geometry is computed
from two integers per label — its **row** and its **depth**. Because no label
shares a row, nothing has to wrap, so no connector can ever disagree with the
text it points at. The list in the DOM, its order, and its screen-reader
annotations are unchanged. A Playwright gate measures real bounding boxes at the
snapshot's deepest lineage (20 nodes) and fails if any two labels intersect,
reusing the mechanism SPEC-023 defines for the map.

## Context

The tree is the puzzle's whole subject: *"the tree is not a component on the
screen — it is the screen"* (`docs/mockups/daily-genus.md`). What it contains is
fixed by **SPEC-019 REQ-005** (the progressive revealed tree) and produced by
`revealedTree()` in `src/app/state/dailyGenus.ts:614`. That function returns a
`RevealedTree`:

- `trunk` — a **linear chain** of `TrunkNode`, root-first, from `Dinosauria` down
  to the deepest shared clade reached (or to the answer, on a win). It is linear
  by construction: it is `data.index.ancestors(deepest)`.
- each node carries `frontier` (the deepest node), `reachedBy` (the guess that
  first reached that depth), and `ruledOut` — the branches eliminated at that
  node, each labelled with the guess that killed it.
- `unresolved` — true while the descent below the frontier is unknown.

This is the fact that makes the redraw tractable and keeps it small: **there is no
general tree-layout problem here.** With a linear trunk, horizontal position is
depth and vertical position is a row counter; no balancing, no subtree
measurement, no layout library.

The current rendering is `DailyGenusScreen.tsx:515-596` plus
`dailyGenus.module.css:172-302`:

| Piece | Today |
| --- | --- |
| Structure | `<ol>` of `<li>`, each with `padding-left: calc(var(--depth) * 0.875rem)` |
| Trunk connector | `.node + .node .nodeRow::before` — a 0.875 × 0.85 rem box with a left and bottom border |
| Cut connector | `.cut::before` — a 12 × 0.75 rem box, same trick |
| Unresolved tail | `.unresolved::before` — a dashed 0.875 rem stub |
| Frontier | bold name, teal underline, thicker dot border |
| Clade identity | `.dot` filled with `cladeMarkerForTaxon(...).tint` |
| Screen readers | `visuallyHidden` spans: "— established ancestor, the deepest reached so far", "— ruled out by the guess X" |

Binding design context: `docs/mockups/design-guidelines.md` §4 (one teal accent,
meaning-only colour, clade tints reinforce but never carry identity alone), §6
(long labels wrap or truncate, **never overlap or clip**), §7 (all real states)
and `docs/mockups/anti-slop-checklist.md` "Do" 2 and 4 (draw the domain's own
object; a verdict is a mark on the object).

The mockup for this spec is
[`docs/mockups/dinordle-cladogram.md`](../../mockups/dinordle-cladogram.md).

Naming: the puzzle is **Dinordle** (SPEC-022 owns that rename) and the heading
above this region is **Taxonomic tree** (SPEC-021 owns that copy). This spec uses
both names and specifies neither.

![The Dinordle taxonomic tree drawn as a horizontal rectangular cladogram, in five panels: fresh round, the marks key, mid-round at depth 18, the same diagram inside a 360 px scroll container, and the solved round at depth 20](../../assets/mockups/dinordle-cladogram.svg)

## Problem statement

1. **The connectors break.** An elbow is a fixed-height box positioned relative to
   a row whose height is content-driven. A wrapped name, or a row carrying a rank
   plus a "reached by" label at a narrow width, makes the row taller than the
   elbow, and the elbow then stops short of the node above it — a floating
   L-shape next to a name. Nothing detects this: no test in the repository
   measures a box.
2. **The diagram does not read as a tree.** At `0.875rem` (14 px) per level with
   no drawn horizontal segment, the result reads as an indented list with
   decorative corners rather than as a cladogram, which is the domain's own form
   for exactly this data.
3. **Ruled-out branches are weakly distinguished.** They differ from the trunk by
   size and grey alone plus a small `✕`; they sit at arbitrary horizontal
   positions, so eliminations cannot be scanned as a set.
4. **Depth is unbudgeted.** Lineages in the shipped snapshot reach **20 nodes**
   below `Dinosauria` (*Saltasaurus*, *Neuquensaurus*; 239 of the 2,123 genera
   under `Dinosauria` sit at depth 15 or deeper). Nothing in the current CSS
   states what happens when the diagram is wider than its column, so it wraps —
   which is the very thing that breaks the connectors.

## Goals

- Draw the revealed tree as a real horizontal rectangular cladogram that cannot
  come apart, at any depth the snapshot can produce.
- Make eliminated branches unmistakable as terminals cut off the spine.
- Bound the diagram's width by construction and state what happens when it still
  exceeds its pane.
- Keep the screen-reader experience exactly as good as it is today.
- Make the geometry machine-checked, reusing SPEC-023's gate mechanism rather
  than inventing a second one.

## Non-goals

- **Changing what the tree contains.** SPEC-019 REQ-005 and REQ-004 are
  untouched: no siblings, no depth count, no distance to the answer, no new
  taxon information. This is a rendering spec.
- **Changing the heading, the product name, the Ma column, the guess input, the
  track control or the reveal.** Those belong to SPEC-021, SPEC-022 and SPEC-024.
- **Animation or transitions** of any kind, including on redraw.
- **A general tree-layout engine.** The trunk is linear; anything that could lay
  out an arbitrary tree is out of scope.
- **Zoom, pan, collapse, or a mini-map.** The diagram is read, not navigated.
- **Introducing a charting or diagram library.** No new dependency.
- **A mobile layout for the Dinordle screen.** Only this region's width
  behaviour is specified.

## Users or actors

- **The player** mid-round, reading what is established and what is eliminated to
  decide the next guess.
- **A player using a screen reader or keyboard only**, for whom the list — not
  the drawing — is the interface.
- **CI**, which runs the unit tests in the `build` job and the geometry gate in
  the `e2e` job.

## Functional requirements

### REQ-001: A pure layout function assigns exactly one row to every label

- **Statement:** A DOM-free function — `layoutCladogram(tree: RevealedTree):
  CladogramLayout` in `src/app/state/cladogramLayout.ts` — converts a
  `RevealedTree` into an ordered list of **rows**. It walks the trunk root-first
  and emits, in order: the trunk node; then one row per branch ruled out at that
  node, in the order `revealedTree` produced them; and, after the last trunk node,
  one row for the unresolved tail when `tree.unresolved` is true. Each row carries
  `{ kind: "node" | "cut" | "unresolved", row, depth, … }` where `row` is its
  zero-based index in the emitted list and `depth` is the node's index in the
  trunk (a cut and the tail take their parent's depth + 1). The layout also
  carries `tipDepth = maxTrunkDepth + 1`, the column every cut row's terminal is
  drawn at. The function is total (an empty trunk yields an empty layout), pure,
  and allocates no DOM.
- **Rationale:** One label per row is the entire width and collision strategy.
  Two labels can only overlap if they share a row, so making that impossible by
  construction removes the failure mode rather than tuning around it, and it lets
  width grow with depth at the *indent* rate (16 px per level) instead of the
  *label* rate (~100 px per level). Keeping it a pure function means the geometry
  is unit-testable without a browser, in the style SPEC-019 already uses for the
  game's core.
- **Acceptance criteria:**
  1. For any `RevealedTree`, every emitted row has a unique `row` value and the
     values are consecutive from 0.
  2. The number of rows equals `trunk.length + Σ ruledOut.length + (unresolved ? 1 : 0)`.
  3. A trunk node's row precedes all of its own cut rows, and every cut row
     precedes the next trunk node's row.
  4. `depth` of the *i*-th trunk node is *i*; a cut's depth is its parent's + 1;
     the tail's depth is the last trunk node's + 1.
  5. `tipDepth` equals the last trunk node's depth + 1.
  6. Identical input yields an identical layout (referentially stable ordering).
  7. Calling it with `{ trunk: [], unresolved: true }` returns an empty row list
     and does not throw.
- **Verification method:** automated — Vitest, including a case built from the
  20-node *Saltasaurus* lineage in the shipped snapshot.
- **Evidence location:** `test/spec025-cladogram-layout.test.ts` (planned)

### REQ-002: Connectors are drawn in one aria-hidden SVG layer from those integers

- **Statement:** All branch geometry is drawn in a single inline `<svg>` element
  that is `aria-hidden="true"`, `focusable="false"`, contains **no text**, and is
  positioned behind the labels. Its coordinates are computed only from each row's
  `row` and `depth` and two module-scoped CSS custom properties — a row pitch and
  a depth indent — read as numbers by the component; no `getBoundingClientRect`,
  `ResizeObserver`, `MutationObserver`, canvas measurement or post-render
  correction is used. The drawing is: one **solid vertical bar** per trunk node
  from its own row down to its last child's row; a **solid horizontal lead** from
  that bar to the next trunk node; a **dashed horizontal lead** from that bar out
  to the tip column for each ruled-out branch; and a **dashed vertical
  continuation** below the last known row for the unresolved tail. The CSS
  pseudo-element connectors `.nodeRow::before`, `.cut::before` and
  `.unresolved::before` are removed.
- **Rationale:** This is the defect's actual fix. Two coordinate systems — a
  connector measured in `rem` and a row measured by its content — can disagree;
  one system derived from integers cannot. Forbidding measurement also keeps the
  render synchronous and free of layout thrash, and keeps the connector layer out
  of the accessibility tree, where a decorative line has nothing to say.
- **Acceptance criteria:**
  1. The connector `<svg>` carries `aria-hidden="true"` and contains no `<text>`,
     `<title>` or `<desc>` element.
  2. `dailyGenus.module.css` contains no `::before` or `::after` rule that draws
     a border on a tree row (asserted against the stylesheet source).
  3. For a layout of *n* rows, the connector layer's height equals
     `n × row-pitch` (± 1 px) and every drawn vertical bar's x equals
     `depth × indent` (± 0.5 px).
  4. The component's render path contains no call to `getBoundingClientRect`,
     `ResizeObserver` or `MutationObserver` (asserted against the component
     source).
  5. Removing every label from the DOM leaves the connector geometry unchanged
     (it does not depend on text).
- **Verification method:** automated — Vitest component + CSS-source tests (the
  source-assertion pattern SPEC-023 NFR-002 and `spec018-tokens.test.ts` already
  use), plus the geometry assertions in NFR-001.
- **Evidence location:** `test/ui/spec025-cladogram-render.test.tsx`,
  `test/ui/spec025-cladogram-css.test.ts` (planned)

### REQ-003: A ruled-out branch reads as a severed terminal, never as spine

- **Statement:** Every branch ruled out is drawn with **all** of: a dashed lead
  leaving the trunk (the trunk's leads are solid); a `✕` terminal where the lead
  ends; the clade's name struck through; the guess that eliminated it named on the
  same row (`◂ Guess`), except when the branch's name *is* the guess, in which
  case the name is printed once; **no clade tint dot**; and the existing
  `visuallyHidden` sentence "— ruled out by the guess X". All cut terminals in one
  diagram end at the same x — the tip column, `tipDepth × indent` — so the
  eliminations form a readable column. No ruled-out row may carry the marks
  reserved for the trunk (a filled tint dot, a solid lead, a frontier ring).
- **Rationale:** Four independent carriers — line style, terminal mark,
  typography and words — so the distinction survives greyscale, low vision and a
  screen reader, and colour is never the only cue (charter §4, SPEC-019 UX-001,
  PERF-250). Withholding the tint dot is the strongest of them: the tint means
  "a clade the player has established", and an eliminated branch is not one.
  Aligning terminals is the cladogram's own convention and is what turns a
  scatter of struck names into a set that can be scanned.
- **Acceptance criteria:**
  1. Rendered at the mockup's six-guess scenario, every cut row has: a struck
     name, a `✕`, no element carrying the clade-tint custom property, and the
     hidden "ruled out by the guess …" text.
  2. All cut terminals share one x within 0.5 px.
  3. A cut whose `name === by` renders the name exactly once.
  4. Converting the rendered screen to plain text still distinguishes every cut
     row from every trunk row (the words alone suffice).
- **Verification method:** automated — Vitest component test over a fixture
  round; the shared-x assertion in the e2e gate.
- **Evidence location:** `test/ui/spec025-cladogram-render.test.tsx`,
  `test/e2e/cladogram.e2e.ts` (planned)

### REQ-004: The frontier and the unresolved tail keep their marks, in shape and in words

- **Statement:** The deepest established node is marked with a ring on its dot,
  its name set bold with a rule under it, and the visible words "deepest reached"
  — in addition to the existing `visuallyHidden` "— established ancestor, the
  deepest reached so far". Its `reachedBy` guess is named on that row unless one
  of the node's own eliminations already names that guess (shipped behaviour,
  preserved). When `tree.unresolved` is true the diagram ends with a dashed
  continuation, a `?` and the visible word "unresolved"; the full statement — *the
  descent continues, how far is not stated* — is carried in the key under the
  diagram, which names all four marks in words. On a win there is no tail and the
  answer's genus is the last trunk row.
- **Rationale:** Charter §2: uncertainty is first-class and never behind a hover
  or a second click. The key is the one place a mark is defined in words, which is
  where the long sentence belongs; keeping the long sentence *on* the deepest row
  would make that row the widest thing in the diagram at every depth, forcing a
  scroll for a caption.
- **Acceptance criteria:**
  1. Exactly one row carries the frontier marks, and it is the last trunk row.
  2. With `unresolved: true`, one tail row renders with the dashed mark, the `?`
     and the word "unresolved"; with `unresolved: false` no tail row exists.
  3. The key renders all four marks with their words, always visible, not behind
     a disclosure.
  4. The `reachedBy` suppression case renders the guess name exactly once.
- **Verification method:** automated — Vitest component test across the fresh,
  mid-round, solved and lost states.
- **Evidence location:** `test/ui/spec025-cladogram-render.test.tsx` (planned)

### REQ-005: The rendered content is unchanged

- **Statement:** This change adds no information to the tree and removes none.
  The set of rendered nodes, the eliminations, their order, the rank shown per
  node, the names, and the absence of siblings, depth counts and distance
  measures are exactly what `revealedTree()` produces today. `revealedTree()`,
  `TrunkNode` and `RevealedTree` are not modified.
- **Rationale:** SPEC-019 REQ-004/REQ-005/REQ-014 are approved and this spec is
  about drawing. A redraw is the classic opportunity to leak "how deep is the
  answer", which is the puzzle itself (`CLAUDE.md`: do not invent requirements).
- **Acceptance criteria:**
  1. `test/spec019-revealed-tree.test.ts` passes **unmodified**.
  2. No rendered text or attribute states a depth, a step count, a remaining
     distance, or a node no guess has touched.
  3. `git diff` touches no file under `src/app/state/dailyGenus.ts`.
- **Verification method:** automated — the existing SPEC-019 suite plus a text
  assertion over the rendered screen; diff inspection at review.
- **Evidence location:** `test/spec019-revealed-tree.test.ts`,
  `test/ui/spec025-cladogram-render.test.tsx` (planned)

## Non-functional requirements

### NFR-001: Automated bounding-box non-overlap gate at the deepest real lineage

- **Statement:** A Playwright spec `test/e2e/cladogram.e2e.ts` runs in the
  existing `e2e` job and fails if any two labels in the diagram intersect. It
  enumerates boxes rather than naming them, so a label added later is covered
  automatically. It reuses SPEC-023 NFR-001's mechanism verbatim — the same
  `disjoint()` helper shape and the same 0.5 px tolerance — rather than
  introducing a second geometry harness:

  ```ts
  // Boxes under test, per viewport:
  //   labels: page.locator("[data-tree-row] [data-tree-label]")
  //   region: page.locator("[data-tree]")
  const overlap = (a: Box, b: Box) => ({
    w: Math.min(a.x + a.width,  b.x + b.width)  - Math.max(a.x, b.x),
    h: Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  });
  const disjoint = (a: Box, b: Box) => {
    const o = overlap(a, b);
    return o.w <= 0.5 || o.h <= 0.5;
  };
  ```

  **Determinism.** The daily answer is a pure function of the UTC date, so the
  test pins the clock (`page.clock.setFixedTime`) to **2026-12-11**, whose answer
  in the shipped snapshot is *Saltasaurus* — the deepest lineage available, 20
  nodes below `Dinosauria`. It then plays the six guesses of the mockup
  (*Triceratops*, *Allosaurus*, *Diplodocus*, *Brachiosaurus*, *Argentinosaurus*,
  *Alamosaurus*) through the guess input, producing a 25-row diagram with six
  eliminations, and finally plays *Saltasaurus* for the solved 26-row case.
  **Viewport matrix:** 1440×900, 1280×800, 1024×768, 900×700, 820×640.
  Assertions at each viewport, in this order so the failure names the most
  specific cause: (1) every label box is inside the tree region's box, or the
  region scrolls horizontally and the label is inside its scroll extent;
  (2) every ordered pair of label boxes is disjoint; (3) every label's box height
  is at most the row pitch (nothing wrapped); (4) all cut terminals share one x;
  (5) `elementFromPoint` at each label's centre resolves inside that label.
  Failures must name both labels and print both boxes.
- **Rationale:** This is the requirement that keeps the defect fixed. jsdom has no
  layout, so no unit test can see an overlap; "looks better" cannot be gated at
  all. Measuring boxes in a real browser at the worst case the data can produce is
  the cheapest assertion that proves the property. Screenshot comparison is
  rejected for the same reason SPEC-023 rejects it: it gates on paint, not
  geometry, and is unstable headless.
- **Acceptance criteria:**
  1. `pnpm run e2e` runs the spec and it passes on the implemented build.
  2. Reverting the layout change (restoring the CSS elbows) makes it fail with a
     message naming two overlapping labels. Demonstrated once during
     implementation and recorded in the PR.
  3. It adds no new CI job and no browser download.
  4. It stays inside the existing 30 s per-test timeout: one page per viewport,
     guesses replayed in place.
- **Verification method:** automated — the spec itself, in the `e2e` job.
- **Evidence location:** `test/e2e/cladogram.e2e.ts`, CI `e2e` job log (planned)

### NFR-002: The layout is regression-guarded without a browser

- **Statement:** Vitest covers the layout function (REQ-001) and the rendered
  structure (REQ-002/003/004) in jsdom: row uniqueness and ordering over a
  generated set of trees with trunk depths 1…20 and 0…8 eliminations per node,
  the `data-tree-row` / `data-tree-depth` / `data-tree-kind` attributes, the
  absence of pseudo-element connectors in the stylesheet, and the absence of
  measurement APIs in the component. These run in the fast `build` job.
- **Rationale:** The e2e gate is slow and needs a browser; the property that
  actually prevents the defect — one label per row — is arithmetic and can be
  checked in milliseconds. It also covers depths the e2e case cannot reach in one
  round.
- **Acceptance criteria:**
  1. A deliberate mutation that puts two labels on one row fails the unit test.
  2. `pnpm test` passes with no new dependency.
- **Verification method:** automated — Vitest.
- **Evidence location:** `test/spec025-cladogram-layout.test.ts`,
  `test/ui/spec025-cladogram-render.test.tsx`,
  `test/ui/spec025-cladogram-css.test.ts` (planned)

### NFR-003: Rendering stays synchronous and allocation-bounded

- **Statement:** The diagram renders in one pass with no measurement, no
  observers, no `requestAnimationFrame`, and no animation; a redraw after a guess
  produces at most `trunk.length + eliminations + 1` rows (≤ 29 for the deepest
  lineage with a full guess budget) and one `<svg>` with at most that many path
  commands. `prefers-reduced-motion` needs no special case because nothing moves.
- **Rationale:** The screen re-renders on every keystroke of the guess input; a
  measuring layout would run per keystroke. The bound is stated so a later
  "improvement" that measures is visibly a change to this spec.
- **Acceptance criteria:**
  1. The component source contains no measurement or observer API (shared with
     REQ-002 criterion 4) and no `transition` / `animation` declaration exists on
     a tree element in the stylesheet.
  2. The rendered diagram for the 20-node case contains exactly one `<svg>`.
- **Verification method:** automated — component and CSS-source assertions.
- **Evidence location:** `test/ui/spec025-cladogram-css.test.ts` (planned)

## Security and privacy considerations

None. This spec changes rendering, CSS and tests only: no new data, no network
call, no storage, no user input. The screen's no-egress property (SPEC-019
SEC-001, `test/ui/spec019-no-egress.test.tsx`) is untouched and that test must
pass unmodified. No SEC-XXX requirement.

## Data model impact

None. `RevealedTree`, `TrunkNode` and `revealedTree()` are unchanged (REQ-005).
`CladogramLayout` is a derived view type, computed on render and never persisted,
never serialised, and never part of the stored round. No DATA-XXX requirement.

## API impact

No external interface. Internally: one new module
`src/app/state/cladogramLayout.ts` exporting `layoutCladogram` and its types, and
new stable test hooks in the markup — `data-tree` on the scroll region,
`data-tree-row="<index>"`, `data-tree-depth="<n>"`,
`data-tree-kind="node|cut|unresolved"` on each row, and `data-tree-label` on the
label element. No API-XXX requirement; the hooks exist because CSS-module class
names are hashed at build time and are not stable selectors (the precedent is
SPEC-023 REQ-001).

## UI or UX impact

### UX-001: No label wraps; the region scrolls instead, with the trunk pinned

- **Statement:** A label in the diagram is set on one line (`white-space: nowrap`)
  and is never truncated, abbreviated, rotated or ellipsised. The diagram sits in
  a horizontally scrollable region whose left edge is the trunk's origin, so the
  spine and the established names remain visible while the tip column scrolls into
  view. The region is keyboard-scrollable and reachable by keyboard, carries an
  accessible name, and shows a visible focus indicator. Vertical scrolling of the
  region is not introduced — the page scrolls, as it does today.
- **Rationale:** Wrapping is what broke the connectors, and truncation loses a
  word from a scientific name, which charter §6 forbids. Scrolling inside the
  element's own box is the pattern SPEC-023 REQ-004 already establishes for an
  oversized overlay. Pinning the left edge matters because the trunk carries the
  established classification — the part a player re-reads — while the tip column
  carries eliminations they have already seen. Measured on the shipped snapshot:
  the deepest lineage is 558 px wide against a 512 px column basis, so this path
  is exercised in real play, not hypothetically.
- **Acceptance criteria:**
  1. No label's rendered box is taller than the row pitch at any viewport in the
     NFR-001 matrix (this is the "nothing wrapped" assertion).
  2. No rendered label text differs from the model's string (no ellipsis, no
     abbreviation).
  3. At 360 px of available width with the 20-node lineage, the region scrolls
     horizontally, the page body does not, and the trunk's dots stay at the
     region's left edge at scroll offset 0.
  4. The region is focusable, is scrollable with the arrow keys, has an
     accessible name, and shows a focus indicator.
- **Verification method:** automated — e2e geometry and keyboard assertions;
  Vitest for the accessible name.
- **Evidence location:** `test/e2e/cladogram.e2e.ts`,
  `test/ui/spec025-cladogram-render.test.tsx` (planned)

### UX-002: The screen-reader and keyboard experience is not made worse

- **Statement:** The accessible structure is unchanged: an ordered list of trunk
  nodes in root-first order, each with a nested list of the branches ruled out at
  it, carrying the same `visuallyHidden` sentences the screen ships today ("—
  established ancestor", "— established ancestor, the deepest reached so far", "—
  ruled out by the guess X"), plus an explicit statement for the unresolved tail.
  Positioning is presentational only: rows may be positioned by CSS, but DOM order
  must equal reading order, and no content may move into the SVG layer. The axe
  gate stays green with no new serious or critical violation, and text keeps WCAG
  2 AA contrast.
- **Rationale:** SPEC-019 UX-003 requires tree nodes to carry accessible names
  describing their state, and this redraw must not trade that for a picture. The
  assumed approach — an SVG spine with positioned HTML labels over a semantic list
  — was evaluated and is adopted with one correction: the labels are not
  *positioned over* a separate list, they **are** the list; the SVG only draws
  lines. That removes any risk of the two going out of order.
- **Acceptance criteria:**
  1. The rendered accessible tree (roles, names, order) is equivalent before and
     after, asserted by a test that reads the list structure and the hidden
     annotations.
  2. `test/e2e/a11y.e2e.ts` passes with no new violation on the Dinordle screen.
  3. Every interactive element in the region has a target of at least 24 × 24 CSS
     px (only the scroll region qualifies today).
  4. No text lives inside the connector `<svg>`.
- **Verification method:** automated — Vitest structure assertions plus the
  existing axe e2e gate.
- **Evidence location:** `test/ui/spec025-cladogram-render.test.tsx`,
  `test/e2e/a11y.e2e.ts` (planned)

### UX-003: Charter compliance — the clade tint keeps its job, and colour keeps its meaning

- **Statement:** Trunk nodes keep the `cladeMarkerForTaxon` tint dot, the same hue
  the clade carries on the map and in the taxonomy fan (charter §4, SPEC-015,
  SPEC-017 AMEND-001); the name always carries identity first and the tint only
  reinforces. Teal remains the single accent and appears only on the frontier's
  ring and rule. No new hex value, no new border radius, no shadow, no gradient,
  no container, card, chip or icon set is introduced; every colour used comes from
  `src/app/styles/tokens.css`. At most **two module-scoped custom properties** may
  be added (the row pitch and the depth indent), declared in
  `dailyGenus.module.css` with a comment; they are local values, not new global
  tokens.
- **Rationale:** The anti-slop checklist's most expensive failure is at the layout
  level, and a redraw is exactly where a "diagram design system" gets invented.
  The clade tint is also the one cross-screen code this product has, so a redraw
  that dropped it would cost more than it gained.
- **Acceptance criteria:**
  1. The diff introduces no new hex literal, `border-radius`, `box-shadow` or
     font-family.
  2. Every trunk row renders a tint dot whose value equals
     `cladeMarkerForTaxon(node.id, …).tint`; no cut row renders one.
  3. Teal appears only on the frontier marks within this region.
  4. At most two new custom properties, both scoped to the module.
- **Verification method:** automated — Vitest tint assertion and a CSS-source
  scan; plus diff inspection against the charter at review.
- **Evidence location:** `test/ui/spec025-cladogram-render.test.tsx`,
  `test/ui/spec025-cladogram-css.test.ts` (planned)

## Configuration impact

None. No environment variable, feature flag, build setting or dependency. The row
pitch and depth indent are module-scoped CSS custom properties, not configuration.

## Error handling

- **Empty trunk** (`rootId` missing, so `revealedTree` returns `{ trunk: [],
  unresolved: true }`): the layout is empty and the region renders the unresolved
  statement alone. No empty `<svg>`, no stray border, no blank box (REQ-001
  criterion 7).
- **A node with no eliminations and no child** (the frontier, mid-round): its bar
  has no children to reach, so no bar is drawn from it — only the dashed tail.
- **Clade tint unavailable** (`cladeMarkerForTaxon` falls back): the neutral
  `#b4bcc6` is used, as today; identity still rests on the name.
- **SVG unsupported / stylesheet failed to load**: the list still renders in DOM
  order with its hidden annotations, so the region degrades to a readable indented
  list rather than to nothing. The connector layer is decorative by construction.

## Edge cases

- **Depth 1** — a fresh round: one trunk row plus the tail; no bar, no cut.
- **Depth 20** — *Saltasaurus* / *Neuquensaurus*, the snapshot's deepest: 26 rows
  when solved, 558 px wide, so the region scrolls at the 512 px column basis.
- **Eight eliminations on one node** — the whole guess budget spent inside
  `Dinosauria` (67 % of real guesses land there): eight consecutive cut rows under
  the root, all terminating at the same tip column two columns to its right.
- **A ruled-out branch that is the guessed genus** (`cut.name === cut.by`, e.g.
  *Alamosaurus* against *Saltasaurus*): the name prints once (REQ-003).
- **The frontier's `reachedBy` equals one of its own eliminations' `by`**: the
  "reached by" label is suppressed; shipped behaviour, preserved (REQ-004).
- **A win** — the trunk runs to the genus, `unresolved` is false, and the genus
  row is both the frontier and the answer.
- **The tip column moves** when a guess deepens the frontier, shifting cut labels
  right between turns. Accepted: it is a redraw between guesses, and the
  alternative — placing each cut label beside its own branch point — loses the
  scannable elimination column.
- **A very long clade name** (`Eoenantiornithiformes`, 21 characters) at depth
  20: the widest single row, and the case the scroll region exists for.

## Acceptance criteria

This spec is satisfied when all of the following hold:

1. The tree renders as a horizontal rectangular cladogram with one label per row,
   connectors drawn from `(row, depth)` integers in an `aria-hidden` SVG layer,
   and no CSS pseudo-element elbows remain (REQ-001, REQ-002).
2. Ruled-out branches are dashed, ✕-terminated, struck through, named with their
   guess, carry no tint dot, and share one tip column (REQ-003).
3. The frontier and the unresolved tail keep their marks and their words
   (REQ-004), and nothing about the tree's *content* changed (REQ-005).
4. `pnpm run e2e` includes the non-overlap gate at the 20-node lineage across the
   five-viewport matrix and passes; it demonstrably fails when the change is
   reverted (NFR-001).
5. Nothing wraps, nothing is truncated, and the region scrolls with the trunk
   pinned (UX-001).
6. The accessible list, its order and its hidden annotations are unchanged, and
   axe stays green (UX-002).
7. The clade tint, the single teal accent and the token palette are intact, with
   at most two module-scoped custom properties added (UX-003).
8. `pnpm run typecheck`, `pnpm run lint`, `pnpm run format`, `pnpm test`,
   `pnpm run build` and the governance scripts all pass.
9. `docs/mockups/screens-index.md` lists the new mockup page, and the SPEC-019
   amendment in *Required amendments* has been transplanted.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Rows unique and consecutive; counts and depths correct; pure and total | automated | `pnpm test spec025-cladogram-layout` | `test/spec025-cladogram-layout.test.ts` | TBD |
| REQ-002 | SVG layer aria-hidden, textless; no pseudo-element elbows; geometry from integers; no measurement APIs | automated | `pnpm test spec025-cladogram-render spec025-cladogram-css` | `test/ui/spec025-cladogram-render.test.tsx`, `test/ui/spec025-cladogram-css.test.ts` | TBD |
| REQ-003 | Cut rows dashed, ✕, struck, named, no tint dot, shared tip column | automated | `pnpm test spec025-cladogram-render`; `pnpm run e2e` | `test/ui/spec025-cladogram-render.test.tsx`, `test/e2e/cladogram.e2e.ts` | TBD |
| REQ-004 | One frontier row with ring, rule and words; tail present iff unresolved; key names four marks | automated | `pnpm test spec025-cladogram-render` | `test/ui/spec025-cladogram-render.test.tsx` | TBD |
| REQ-005 | SPEC-019 tree test unmodified; no depth or distance rendered; reducer untouched | automated + inspection | `pnpm test spec019-revealed-tree`; diff review | `test/spec019-revealed-tree.test.ts` | TBD |
| NFR-001 | No two label boxes intersect at 5 viewports on the 20-node lineage; fails on revert | automated | `pnpm run e2e` | `test/e2e/cladogram.e2e.ts`, CI `e2e` log | TBD |
| NFR-002 | Row-uniqueness holds for depths 1…20 with 0…8 cuts per node; mutation fails the test | automated | `pnpm test` | `test/spec025-cladogram-layout.test.ts` | TBD |
| NFR-003 | One `<svg>`, no observers, no animation | automated | `pnpm test spec025-cladogram-css` | `test/ui/spec025-cladogram-css.test.ts` | TBD |
| UX-001 | No label taller than the row pitch; no truncation; scrolls at 360 px with trunk pinned; keyboard-scrollable | automated | `pnpm run e2e` | `test/e2e/cladogram.e2e.ts` | TBD |
| UX-002 | List roles, order and hidden annotations unchanged; axe green; no text in the SVG | automated | `pnpm test spec025-cladogram-render`; `pnpm run e2e` | `test/ui/spec025-cladogram-render.test.tsx`, `test/e2e/a11y.e2e.ts` | TBD |
| UX-003 | Tint dot on trunk rows only and equal to `cladeMarkerForTaxon`; teal only on the frontier; no new hex; ≤2 module custom properties | automated + inspection | `pnpm test spec025-cladogram-render spec025-cladogram-css`; diff review | `test/ui/spec025-cladogram-render.test.tsx`, `test/ui/spec025-cladogram-css.test.ts` | TBD |

## Test plan

**New — `test/spec025-cladogram-layout.test.ts` (REQ-001, NFR-002).** Pure
Vitest, no DOM. Cases: empty trunk; depth 1 fresh round; the mockup's six-guess
*Saltasaurus* round built from `test/spec019-fixture.ts` and the shipped
`reference.json`; and a generated sweep over trunk depths 1…20 with 0…8
eliminations per node asserting row uniqueness, consecutiveness, ordering,
depths and `tipDepth`.

**New — `test/ui/spec025-cladogram-render.test.tsx` (REQ-002/003/004/005,
UX-002/003).** Renders the Dinordle screen through the existing
`test/ui/spec019-harness.tsx` fixture and asserts markup: the `data-tree-*`
hooks, one aria-hidden textless `<svg>`, the cut row's four carriers, the tint
dot on trunk rows and its absence on cut rows, the frontier marks, the tail, the
`cut.name === cut.by` case, the `reachedBy` suppression case, and the unchanged
list structure and hidden annotations.

**New — `test/ui/spec025-cladogram-css.test.ts` (REQ-002, NFR-003, UX-003).**
Reads `src/app/components/dailyGenus.module.css` and `DailyGenusScreen.tsx` as
text — the pattern `spec018-tokens.test.ts` and SPEC-023 NFR-002 already use —
and asserts: no `::before`/`::after` border rule on a tree row, no new hex
literal, no `transition`/`animation` on a tree element, at most two new custom
properties, and no measurement or observer API in the component.

**New — `test/e2e/cladogram.e2e.ts` (NFR-001, UX-001).** Chromium under the
existing Playwright config. Pins the clock to 2026-12-11 (answer *Saltasaurus*),
opens `#daily`, plays the six guesses, and measures at 1440×900, 1280×800,
1024×768, 900×700 and 820×640: containment, pairwise disjointness, label height
≤ row pitch, shared tip-column x, and `elementFromPoint`. Then plays
*Saltasaurus* and repeats on the 26-row solved diagram. One extra case at 820×640
asserts the region scrolls, the body does not, and the trunk is at the region's
left edge at scroll offset 0; one keyboard case asserts the region is focusable
and arrow-scrollable.

**Existing suites that must stay green, unmodified where stated:**
`test/spec019-revealed-tree.test.ts` (**unmodified** — the evidence that the
model did not change), `test/spec019-guess-evaluation.test.ts`,
`test/spec019-persistence.test.ts`, `test/ui/spec019-no-egress.test.tsx`,
`test/ui/spec019-practice.test.tsx`, `test/ui/spec019-rollover.test.tsx`,
`test/ui/spec020-*`, `test/e2e/spec019-daily.e2e.ts`, `test/e2e/a11y.e2e.ts`.

**Existing suites expected to need edits:**
`test/ui/spec019-daily-screen.test.tsx` — its REQ-004/REQ-005 tests select the
frontier by hashed class name (`container.querySelector('[class*="frontier"]')`,
line 99) and assert row text; they move to the `data-tree-*` hooks, keeping every
assertion about *content* byte-identical.
`test/ui/spec019-states.test.tsx` — renders the fresh, solved and lost trees;
selectors only.
Neither test's expectations about what the tree contains may be weakened, and no
test may be skipped or deleted (`CLAUDE.md`).

**Fixtures:** none new. The unit tests build rounds from `test/spec019-fixture.ts`
and the e2e gate runs against the shipped snapshot through the existing preview
server.

**Manual check (supplementary, not the gate):** open the Dinordle screen at
1440×900 and at 820×640 on a deep round and confirm the diagram reads as a tree —
the automated gate proves non-overlap, not that the drawing is good.

## Rollback plan

The change is one new pure module, the render body of one component, one CSS
module, and four test files. There is no data, storage, API or migration surface,
so rollback is `git revert` of the single PR and the previous render returns
exactly. Partial rollback is also safe: keeping `layoutCladogram` while reverting
the SVG layer leaves an unused pure function, not a broken screen. If the e2e gate
proves flaky (it should not — it measures DOM boxes, not paint), the correct
response is to narrow the viewport matrix, never to skip or delete the assertions
(`CLAUDE.md`).

## Risks

- **The tip column shifts between guesses.** Accepted and recorded (Edge cases);
  the alternative loses the elimination column. If the owner dislikes it, the
  fallback is per-branch placement, which changes REQ-003 criterion 2 only.
- **A very deep lineage still overflows a narrow pane.** True by arithmetic and
  handled by UX-001's scroll region rather than hidden; the gate asserts the
  scroll case rather than asserting it never happens.
- **The e2e clock pin depends on the snapshot.** If the snapshot is rebuilt, the
  pool changes and 2026-12-11 may no longer be *Saltasaurus*. Mitigated by the
  test asserting the answer's identity before measuring, so a snapshot change
  fails loudly with a clear message instead of silently measuring a shallow tree.
- **Selector churn in existing tests.** The `data-tree-*` hooks are introduced
  precisely so this is the last time; the edits are mechanical and no assertion
  about content changes.

## Open questions

- [x] Is a general tree layout needed? **Resolved:** no. `revealedTree()` returns
      a linear trunk (`ancestors(deepest)`), so x is depth and y is a row counter.
      Verified against `src/app/state/dailyGenus.ts:614-660`.
- [x] Should labels alternate above and below a single horizontal spine?
      **Resolved:** no. It halves a ~2,000 px requirement to ~1,000 px, still
      needs a scroll, makes the reading order a zigzag, and leaves no room for
      eliminated branches. One label per row bounds width by the indent rate
      instead. Recorded in the mockup page.
- [x] Rotated or abbreviated names to save width? **Resolved:** no — charter §6
      forbids losing a word, and rotation is unreadable at 12 px.
- [x] SVG plus positioned labels, or an all-SVG diagram? **Resolved:** SVG for
      lines only; the labels stay HTML and stay the list. An all-SVG diagram would
      move text out of the accessible list, which UX-002 forbids.
- [ ] Deferred to implementation: whether the row pitch and depth indent can be
      expressed with existing spacing tokens or need the two module-scoped custom
      properties UX-003 permits. Either outcome satisfies this spec.

## Human decisions required

- [ ] **Confirm the shape.** The tree becomes a horizontal cladogram: root at the
      left, one name per row, depth stepping right by a small indent, ruled-out
      branches ending in a struck-through terminal column at the right. See
      `docs/mockups/dinordle-cladogram.md`.
      Answer: ______________________
- [ ] **Confirm the tip column.** Eliminated branches all end at the same x, which
      moves right when a guess deepens the frontier.
      Answer: ______________________
- [ ] **Confirm the scroll.** At the snapshot's deepest lineage the diagram is
      ~558 px and a narrow pane scrolls horizontally rather than wrapping.
      Answer: ______________________
- [ ] **Confirm the SPEC-019 amendment below** (and its number, once the sibling
      specs land).
      Answer: ______________________
- [ ] **Approval reference for Definition of Ready** (status → Approved).
      Answer: ______________________

## Conflict check

Affected components: `DailyGenusScreen`, `dailyGenus.module.css`, a new
`cladogramLayout` module, the Vitest UI suite, the Playwright suite.

- **SPEC-019 REQ-005 (the progressive revealed tree)** — governs what the tree
  *contains*; this spec governs how it is drawn and changes nothing it requires
  (REQ-005 here). REQ-005 of SPEC-019 does, however, call the tree "the game's
  primary surface", and the rendering it was written against was the indented
  list, so a recorded amendment is provided below rather than left implicit.
- **SPEC-019 UX-001 (charter compliance)** — restated and tightened as UX-003.
  Not weakened.
- **SPEC-019 UX-003 (accessibility)** — restated as UX-002 and preserved exactly;
  no amendment needed.
- **SPEC-019 REQ-004 / REQ-014** — no depth, distance or out-of-subtree node is
  introduced (REQ-005 here). Untouched.
- **SPEC-021 (chrome and copy)** — owns the heading above this region
  ("Taxonomic tree") and its own SPEC-019 amendment. This spec neither changes nor
  depends on that copy; it only uses the name.
- **SPEC-022 (global app bar, the Dinordle rename)** — owns the product name and
  its own SPEC-019 amendment. No overlap in file scope beyond both eventually
  editing `DailyGenusScreen.tsx`; the regions differ (app bar and header vs. the
  tree body).
- **SPEC-024 (puzzle legibility)** — rewrites the Ma column and the track control
  on the same screen and explicitly records SPEC-025 as adjacent work whose
  subject (the tree's geometry) it does not touch. Symmetrically, this spec does
  not touch the Ma column, the header or the track control. Both may need to
  rebase on the other's diff; neither has a requirement dependency.
- **SPEC-023 (map overlay layout)** — different surface (the map), but this spec
  deliberately **reuses** its `disjoint()` non-overlap mechanism and 0.5 px
  tolerance rather than inventing a second geometry harness. If SPEC-023 lands
  first, the helper should be shared rather than copied; if it does not, this
  spec's copy stands alone. No requirement of SPEC-023 changes either way.
- **SPEC-015 / SPEC-017 AMEND-001 (clade tints)** — the tint's cross-screen role
  is preserved by UX-003, not altered.

No entry is required in `conflicts_with`.

## Required amendments to existing specs

> Ready to transplant. Do **not** apply this until this spec is approved and the
> owner has ticked the amendment box above; then paste the block into the target
> spec's `## Spec amendments` section, verbatim. **Do not edit SPEC-019 from this
> spec.**

### For SPEC-019 (`docs/specs/implemented/SPEC-019-daily-genus-puzzle.md`)

**Number chosen: `AMEND-004`, and why.** SPEC-019's amendments section holds only
the empty template stub numbered `AMEND-001`. Three sibling drafts already claim a
SPEC-019 amendment slot, each of them written as if it were the first:
**SPEC-021** (`AMEND-001` — the snapshot date narrowed to the reveal),
**SPEC-022** (`AMEND-001` — the Dinordle rename and the app-bar entry point) and
**SPEC-024** (`AMEND-001` — the time clue becomes a per-guess overlap verdict).
Whichever lands first fills the stub as `AMEND-001` and the next two become
`AMEND-002` and `AMEND-003`, so the next free number for this spec is
**`AMEND-004`**. The number is landing-order dependent, not a claim on a slot:
at transplant time, take the next free number in the file and renumber this block
if the siblings have not all landed.

```markdown
### AMEND-004 — the revealed tree is drawn as a horizontal cladogram; its contents are unchanged

- **Date:** 2026-08-14
- **Reason:** The owner reported the tree's rendering as defective — "would be
  better if the render of the tree was better it's wonky text here you think it's
  easy to make a real horizontal tree?" (2026-08-14). As built, the tree is an
  indented `<ol>` whose connectors are CSS pseudo-element elbows of a fixed `rem`
  height hung off rows whose height is content-driven, so a wrapped clade name
  leaves the elbow floating and the diagram visibly comes apart. SPEC-025
  replaces the rendering with a real horizontal rectangular cladogram whose
  connector geometry is computed from each label's row and depth.
- **Changed requirements:** **REQ-005** only, and only in how the surface is
  drawn. Its statement — the trunk from `Dinosauria` to the deepest shared clade,
  the ruled-out child branch per guess labelled with the guessed genus, the
  unresolved continuation, only nodes a guess has touched, no node marked
  confirmed unless it is an ancestor of the answer — is **unchanged**, and every
  one of its acceptance criteria stands unmodified. What is added, by SPEC-025
  REQ-001…REQ-004 and UX-001, is a constraint on the rendering: the tree is drawn
  root-left with depth increasing rightward, exactly one label per row, branch
  connectors drawn in an `aria-hidden` SVG layer from row and depth integers,
  ruled-out branches terminating in a shared tip column, and no label wrapping —
  a diagram wider than its pane scrolls horizontally with the trunk pinned.
  **UX-003 is unchanged and explicitly preserved**: the accessible structure stays
  an ordered list in root-first order with the same `visuallyHidden` state
  sentences, and nothing moves into the SVG. **UX-001 is unchanged**: the clade
  tint keeps its cross-screen role, teal stays the only accent, and every state
  stays legible in shape and in words. **REQ-004 and REQ-014 are unchanged**: no
  depth, distance or out-of-subtree node is rendered.
- **Behavioral impact:** Visual only, plus a scroll affordance. The set of nodes
  drawn, their order, their words, the frontier and elimination marks and the
  hidden annotations are all identical; `revealedTree()`, `TrunkNode` and
  `RevealedTree` are not modified. Nothing about selection, guess evaluation, the
  time clue, the hint, the budget, storage or the shared summary changes. The one
  new user-visible behaviour is that at a very deep lineage in a narrow pane the
  diagram scrolls sideways instead of wrapping.
- **Test impact:** `test/spec019-revealed-tree.test.ts` must pass
  **unmodified** — that is the evidence the model did not change. Selector-only
  edits in `test/ui/spec019-daily-screen.test.tsx` (its frontier lookup uses the
  hashed class name `[class*="frontier"]`, replaced by the `data-tree-*` hooks)
  and `test/ui/spec019-states.test.tsx`; no assertion about content is weakened.
  New: `test/spec025-cladogram-layout.test.ts`,
  `test/ui/spec025-cladogram-render.test.tsx`,
  `test/ui/spec025-cladogram-css.test.ts` and the geometry gate
  `test/e2e/cladogram.e2e.ts`. `test/e2e/a11y.e2e.ts` and
  `test/ui/spec019-no-egress.test.tsx` pass unmodified. No test is skipped or
  deleted.
- **Human approval reference:** Owner approval in session, 2026-08-14
```

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Row/depth layout model | `src/app/state/cladogramLayout.ts` (`layoutCladogram`) | `spec025-cladogram-layout.test.ts` | Not started |
| REQ-002 | Connector layer | `DailyGenusScreen.tsx` (tree region), `dailyGenus.module.css` | `spec025-cladogram-render.test.tsx`, `spec025-cladogram-css.test.ts` | Not started |
| REQ-003 | Cut terminals and tip column | `DailyGenusScreen.tsx`, `dailyGenus.module.css` | `spec025-cladogram-render.test.tsx`, `cladogram.e2e.ts` | Not started |
| REQ-004 | Frontier and tail marks, the key | `DailyGenusScreen.tsx` | `spec025-cladogram-render.test.tsx` | Not started |
| REQ-005 | Content unchanged | `src/app/state/dailyGenus.ts` (untouched) | `spec019-revealed-tree.test.ts` | Not started |
| NFR-001 | Non-overlap gate | `test/e2e/cladogram.e2e.ts`, CI `e2e` job | itself | Not started |
| NFR-002 | Browser-free guard | `test/spec025-cladogram-layout.test.ts` | itself | Not started |
| NFR-003 | Synchronous render | `DailyGenusScreen.tsx`, `dailyGenus.module.css` | `spec025-cladogram-css.test.ts` | Not started |
| UX-001 | No wrap, scroll region | `dailyGenus.module.css` | `cladogram.e2e.ts` | Not started |
| UX-002 | Accessibility parity | `DailyGenusScreen.tsx` | `spec025-cladogram-render.test.tsx`, `a11y.e2e.ts` | Not started |
| UX-003 | Charter compliance | `DailyGenusScreen.tsx`, `dailyGenus.module.css` | `spec025-cladogram-render.test.tsx`, `spec025-cladogram-css.test.ts` | Not started |

## Implementation notes

Recorded during drafting, to be extended at implementation.

- **Assumption A-1 — the trunk is linear.** Verified in
  `src/app/state/dailyGenus.ts:614-660`: `revealedTree` builds the trunk as
  `data.index.ancestors(deepest)`, a chain. If a future spec makes it branch,
  REQ-001's row walk needs a real traversal and this spec must be amended.
- **Assumption A-2 — measured, not eyeballed.** The depth and width figures come
  from the shipped `public/data/reference.json` (PBDB subset, retrieved
  2026-07-26): 2,123 genera under `Dinosauria`, median lineage 10 nodes, 239 at
  depth ≥ 15, maximum 20 (*Saltasaurus*, *Neuquensaurus*). The 1,492 guessable /
  985 answer-pool figures derived the same way match SPEC-019's recorded numbers,
  which is the cross-check that the derivation is right. Widths were computed at
  the app's monospace advance (0.6 em) at the mockup's sizes: the deepest
  mid-round diagram is 536 px and the deepest solved diagram 558 px.
- **Assumption A-3 — 2026-12-11 is *Saltasaurus*.** Computed by replaying
  `selectDailyGenus`'s FNV-1a permutation with the `daily-genus:` salt over the
  derived pool. The e2e gate asserts the answer before measuring, so a snapshot
  change fails loudly (Risks).
- **Assumption A-4 — the row pitch is the unit of non-overlap.** A label's box
  must be no taller than the row pitch, which is why `white-space: nowrap` is a
  requirement (UX-001) and not a style choice.
- **Noted for a future spec, not folded in here (`CLAUDE.md`: no opportunistic
  refactors):** the tree region and the Ma column are laid out by `.board`'s
  `flex-wrap`, so on a narrow window the Ma column drops below the tree with no
  stated behaviour. That is a layout question for the whole screen, adjacent to
  SPEC-024, and is out of scope.

## Spec amendments

> Required for any behavioral change after the spec is Approved.

_None. The spec has not been approved yet._

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [x] Open questions are resolved or explicitly deferred.
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed.
- [ ] Human approval recorded before status set to Approved.
