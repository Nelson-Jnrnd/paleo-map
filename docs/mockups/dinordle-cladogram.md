# Screen region: Dinordle — the taxonomic tree

> Mockup page. Status: **High-fidelity mockup**. Convention: see
> [README](README.md); visual system in [design-guidelines.md](design-guidelines.md).
> This page introduces no requirements — they live only in
> [SPEC-025](../specs/active/SPEC-025-cladogram-render.md) (Draft) and, for what
> the tree *contains*, in SPEC-019 REQ-005.

![The Dinordle taxonomic tree drawn as a horizontal rectangular cladogram, in five panels: fresh round, the marks key, mid-round at depth 18, the same diagram inside a 360 px scroll container, and the solved round at depth 20](../assets/mockups/dinordle-cladogram.svg)

This is the puzzle's revealed classification — the region under the
**Taxonomic tree** heading on the Dinordle screen. It is not a new screen and it
adds nothing to the board: same nodes, same eliminations, same words. What
changes is how the diagram is drawn.

## The problem this redraw exists to fix

The shipped render (`DailyGenusScreen.tsx:515-596`, `dailyGenus.module.css:172-302`)
is an indented `<ol>` whose connectors are CSS pseudo-element elbows —
`.nodeRow::before` and `.cut::before` — each a fixed 0.875 rem box hung off a row
that is free to grow. The elbow is drawn at a constant height; the row is not. As
soon as a name wraps, or a rank and a guess label push a row to two lines, the
elbow no longer reaches the row above it and the tree comes apart. Owner
feedback, 2026-08-14: *"the render of the tree … it's wonky text."*

## The layout, in one paragraph

**Every label owns exactly one row.** Row index comes from a walk of the revealed
tree (each trunk node, then the branches ruled out at that node, then the
unresolved tail); horizontal position comes from depth. Both are integers, so the
connector geometry is `x = depth × 16 px`, `y = row × 21 px` and nothing about it
depends on how wide a name happens to be. The connectors are drawn once, in a
single `aria-hidden` SVG layer behind the list, from those same integers. A label
cannot wrap, because a label that cannot share a row with anything else never
needs to; when the diagram is wider than its pane the pane scrolls horizontally
with the trunk pinned at the left edge. This is the standard rectangular
cladogram: root at the left, depth increasing rightward, terminals aligned in a
column at the right.

## How width is solved

The naive left-to-right spine — every node on one horizontal line — is impossible
here, and it was rejected on arithmetic rather than taste: the snapshot's deepest
lineage is **20 nodes** below `Dinosauria` (*Saltasaurus*, *Neuquensaurus*; of the 2,123
genera under `Dinosauria`, 239 sit at depth 15 or deeper), and 20 clade names
averaging 13 characters
in the app's monospace need roughly 2,000 px on one line. Alternating the labels
above and below the spine only halves that, while turning the reading order into
a zigzag and leaving nowhere for the eliminated branches to hang. Giving each
label its own row inverts the cost: width then grows with depth at the **indent**
rate — 16 px per level — instead of at the label rate.

Measured on that worst case, drawn in the third and fifth panels:

| | rows | widest row |
| --- | --- | --- |
| Mid-round, frontier at depth 18, six eliminations | 25 | 536 px |
| Solved, full descent to *Saltasaurus* | 26 | 558 px |

The tree column is `flex: 1 1 32rem` — 512 px at its stated basis, wider
whenever the board has room. So the deepest lineage in the snapshot is about
9% wider than the narrow case of that column and the pane scrolls; a typical
round (the median lineage is 10 nodes) is around 360 px and does not.
That is why the scroll container is a requirement and not a fallback, and why
the fourth panel draws it at 360 px rather than assuming it away.

Eliminated branches end at a **shared tip column** at
`(deepest depth + 1) × 16 px`, which is what makes them read as a column of
severed terminals rather than as more spine. The cost, recorded honestly: the tip
column moves right when a guess deepens the frontier, so the cut labels shift
between guesses. That is a redraw between turns, not motion during one.

## Reading the marks

Four marks, each also a word in the key under the diagram — colour is never the
only carrier (charter §4, SPEC-019 UX-001):

| Mark | Means |
| --- | --- |
| Filled dot in the clade's tint, name in full | established ancestor of the answer |
| Teal ring on the dot, name ruled underneath, "deepest reached" | the frontier |
| Dashed lead, ✕ terminal, struck-through name, `◂ Guess` | ruled out, by that guess |
| Dashed continuation, `?`, "unresolved" | the descent continues — how far is not stated |

The tint dot is `cladeMarkerForTaxon`, the same hue this clade carries on the map
(charter §4, SPEC-017 AMEND-001) — sauropod `#82b6a7` down the *Saltasaurus*
spine, saurischian `#cbb49b` at `Saurischia`, neutral `#b4bcc6` at `Dinosauria`.
Ruled-out branches deliberately carry **no** tint dot: an eliminated clade is not
one the player holds, and withholding the dot separates the two families of row
before any colour is read.

## The scenario in the mockup

Real, from `public/data/reference.json` (PBDB subset, retrieved 2026-07-26).
Nothing is invented. Hidden genus *Saltasaurus* — the deepest lineage in the
snapshot, and in the answer pool (it has a silhouette, a time span, a summary and
two images), chosen because it is the worst case for this layout and not the
prettiest:

| # | Guess | Deepest shared clade | Ruled out |
| --- | --- | --- | --- |
| 1 | *Triceratops* | `Dinosauria` | `Ornithischia` |
| 2 | *Allosaurus* | `Dinosauria` | `Theropoda` |
| 3 | *Diplodocus* | `Neosauropoda` | `Diplodocoidea` |
| 4 | *Brachiosaurus* | `Titanosauriformes` | `Brachiosauridae` |
| 5 | *Argentinosaurus* | `Titanosauria` | `Eutitanosauria` |
| 6 | *Alamosaurus* | `Saltasaurinae` | `Alamosaurus` |

Two shipped behaviours survive the redraw and are drawn, because they are exactly
where a redraw would quietly break something:

- **The frontier's "reached by" label is suppressed** when one of that node's own
  eliminations already names the guess. `Saltasaurinae` was reached by
  *Alamosaurus*, and the branch *Alamosaurus* hangs from it — so the name is
  printed once, on the branch, not twice on two rows.
- **A ruled-out branch can be a genus.** Guess 6's shared clade is
  `Saltasaurinae` and the branch it eliminates is the guessed genus itself, so
  the row reads `✕ Alamosaurus` with no `◂` repeat.

## States drawn

| Panel | State | Trigger |
| --- | --- | --- |
| 1 | Fresh round | round opened, no guesses — trunk is `Dinosauria` alone plus the unresolved tail |
| 2 | Marks | the key, as it sits under the diagram on the screen |
| 3 | Mid-round | six guesses, frontier 18 nodes down, six eliminations at five different nodes |
| 4 | Narrow pane | pane below the diagram's width — scrolls, trunk pinned |
| 5 | Solved | the answer is established; the trunk runs 20 nodes to the genus and there is no tail |

Lost, practice and already-played rounds render one of these same shapes — the
tree does not change form with the round's outcome, only with its content.

## Accessibility

The DOM does not become a picture. The list the screen ships today — an `<ol>` of
nodes, a nested `<ul>` of the branches ruled out at each node, and the
`visuallyHidden` sentences *"— established ancestor, the deepest reached so far"*
and *"— ruled out by the guess X"* — stays exactly as it is, in the same order,
carrying the same words (SPEC-019 UX-003). The SVG layer is `aria-hidden` and
purely decorative: it draws lines, never text, so there is nothing in it for a
screen reader to miss. Positioning is what changes for sighted readers. The
scroll container is focusable and keyboard-scrollable, with a name, so a
keyboard-only player can reach the right-hand end of a wide diagram.

## Charter §9 — before designing this region

1. **Who, and where in the loop?** A player mid-round, reading what they have
   established and what they have eliminated, deciding what to guess next.
2. **What must they see first?** The frontier — the deepest clade reached — and
   how the descent got there.
3. **Most likely next action?** Typing the next guess.
4. **What can go wrong?** No guesses yet; a 20-node lineage; up to eight
   eliminations on one node; a ruled-out branch that is the guessed genus; a pane
   narrower than the diagram; a solved round with no tail.
5. **Which data is long or messy?** Clade names to 20 characters
   (`Eupachycephalosauria`, `Titanosauriformes`), lineages to 20 nodes, ranks
   that are mostly the single word "clade".
6. **What is deprioritised?** Rank — small, faint, after the name. Nothing is
   collapsed or hidden: this region is the subject of the screen.

## What this deliberately does not do

- **No new information.** No depth count, no distance to the answer, no sibling
  clades — SPEC-019 REQ-005 and REQ-004 still hold, and this redraw is not a
  route around them.
- **No rotated text, no abbreviation, no truncation.** A rotated or shortened
  clade name would trade legibility for width; the row does that better.
- **No animation.** The diagram redraws between guesses; it does not move during
  one.
- **No container.** No card, no border, no chip. The tree is lines, dots and
  type, and it is the largest thing in its region.

## Anti-slop self-check

Counted on this sheet
([checklist](anti-slop-checklist.md)): **0** bordered containers, **0** pill
chips, **0** sentences explaining how to read the screen (the key names four
marks in four short phrases; the annotation block on the sheet is mockup
apparatus, not screen copy). The layout would not survive being moved to a CRM —
it is a cladogram. The subject is the largest thing on the sheet. Every colour
carries a charter meaning: teal for the frontier (interaction/accent layer),
clade tints from `mapCladeMarkers.ts`, everything else cool neutral. Every state
is legible in shape and in words. All names, ranks and lineages are from the
shipped snapshot. Nothing here exists because a library made it easy — there is
no library; the connectors are 40 lines of path arithmetic.
