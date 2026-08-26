# Screen region: Dinordle — the taxonomic tree

> Mockup page. Status: **High-fidelity mockup**. Convention: see
> [README](README.md); visual system in [design-guidelines.md](design-guidelines.md).
> This page introduces no requirements — they live only in
> [SPEC-025](../specs/active/SPEC-025-cladogram-render.md) (Draft) and, for what
> the tree *contains*, in SPEC-019 REQ-005.

![The Dinordle taxonomic tree drawn as a horizontal rectangular cladogram, in five panels: fresh round, the marks key, mid-round at depth 18 with each ruled-out branch drawn as a red-ringed node and the guess that ruled it out as a red-ringed leaf one column further right, the same diagram inside a 360 px scroll container, and the solved round at depth 20](../assets/mockups/dinordle-cladogram.svg)

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
tree — each trunk node, then, for each branch ruled out at that node, the branch
itself and the guess that ruled it out; horizontal position comes from depth.
Both are integers, so the
connector geometry is `x = depth × 16 px`, `y = row × 21 px` and nothing about it
depends on how wide a name happens to be. The connectors are drawn once, in a
single `aria-hidden` SVG layer behind the list, from those same integers. A label
cannot wrap, because a label that cannot share a row with anything else never
needs to; when the diagram is wider than its pane the pane scrolls horizontally
with the trunk pinned at the left edge. This is the standard rectangular
cladogram: root at the left, depth increasing rightward, terminals aligned in
columns at the right.

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
| Mid-round, deepest reached at depth 18, six eliminations | 29 | 535 px |
| Solved, full descent to *Saltasaurus* | 31 | 520 px |

The tree column is `flex: 1 1 32rem` — 512 px at its stated basis, wider
whenever the board has room. So the deepest lineage in the snapshot is 2–5%
wider than the narrow case of that column and the pane scrolls; a typical
round (the median lineage is 10 nodes) is around 385 px and does not.
That is why the scroll container is a requirement and not a fallback, and why
the fourth panel draws it at 360 px rather than assuming it away.

Both figures moved with this revision, and in opposite directions from what a
reader would guess. Rows went **up** (25 → 29 mid-round, 26 → 31 solved) because
a guess now gets its own row instead of a suffix on the branch it ruled out.
Width went **down** (536 → 535, 558 → 520) for the same reason: the widest row
used to be a cut row carrying a struck name *and* `◂ Argentinosaurus`; now the
guess sits on its own row one indent right, which is shorter than the suffix it
replaced. The diagram is taller and slightly narrower than the version the owner
reviewed.

Ruled-out branches end at a **shared column** at `(deepest depth + 1) × 16 px`
and the guesses inside them at one indent further right, which is what makes the
eliminations read as two scannable columns rather than as more spine. The cost,
recorded honestly: both columns move right when a guess deepens the descent, so
those labels shift between guesses. That is a redraw between turns, not motion
during one.

## Reading the marks

Three marks, three words in the key under the diagram — colour is never the only
carrier (charter §4, SPEC-019 UX-001). Owner revision, 2026-08-14: the key was
cut from four entries to three and its wording shortened to single terms.

| Mark | Key word |
| --- | --- |
| Filled dot in the clade's tint, name in full | ancestor |
| Teal ring around that dot, name bold and ruled underneath, "deepest reached" | closest relative |
| Dashed lead, red ring on a hollow dot, name in full — on the ruled-out branch **and** on the guess inside it | guess |

The tint dot is `cladeMarkerForTaxon`, the same hue this clade carries on the map
(charter §4, SPEC-017 AMEND-001) — sauropod `#82b6a7` down the *Saltasaurus*
spine, saurischian `#cbb49b` at `Saurischia`, neutral `#b4bcc6` at `Dinosauria`.
Ruled-out rows deliberately carry **no** tint: an eliminated clade is not one the
player holds. Their dot is hollow — surface fill, red ring — so the red ring
never sits over a clade tint and never has to compete with one. The ring on the
deepest node reached is a *second, outer* teal ring around a filled tint dot; a
ruled-out ring *is* the dot. The two are different marks, not two colours of the same mark.

**What replaced the ✕ and the strike-through.** A ruled-out branch used to be a
dashed lead, a `✕` terminal, a struck name and a `◂ Guess` suffix. It is now a
dashed lead, a red-ringed hollow dot and the name in full — and the guess that
ruled it out is drawn the same way, one indent further right, hanging off that
branch. That is the truer cladogram: `evaluateGuess` sets the ruled-out branch to
`ancestors(guess)[sharedAt + 1]`, so the guessed genus is genuinely *inside* the
branch it eliminated. Drawing it as a leaf under that branch says "this whole
line, the one your guess lives on, is out" in the tree's own grammar instead of
in a label.

**Which of the two is my guess?** Position in the descent, and only that: the
guess is always the deeper of the pair, one indent right of the branch it ruled
out, and it is always the row immediately below it. Scanning down, the shallower
column is eliminated clades and the column one indent right is the guesses that
eliminated them. That still holds when a node has several eliminations — at
`Dinosauria` the rows run `Ornithischia`, *Triceratops*, `Theropoda`,
*Allosaurus*, each guess directly under its own branch and joined to it by its
own dashed lead, so no guess can be read against the wrong branch.

**The dashed lead means "descends from — how far is not drawn."** The guess is
usually many nodes below the branch it ruled out (*Triceratops* is nowhere near a
direct child of `Ornithischia`), and the diagram never says how many. One indent
is a schematic step, not a depth claim; stating the real distance would hand the
player information SPEC-019 REQ-004 withholds.

**When the branch and the guess are the same node**, they are drawn as one node.
Guess 6's ruled-out branch is *Alamosaurus* and the guess was *Alamosaurus*, so
one row, one ring, one name — the `cut.name === cut.by` case collapses without a
special rule, because there is only one taxon there to draw.

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

- **The deepest node's "reached by" label is suppressed** when one of that node's
  own eliminations already names the guess. `Saltasaurinae` was reached by
  *Alamosaurus*, and the branch *Alamosaurus* hangs from it — so the name is
  printed once, on the branch, not twice on two rows.
- **A ruled-out branch can be a genus.** Guess 6's shared clade is
  `Saltasaurinae` and the branch it eliminates is the guessed genus itself, so
  branch and guess are one node: one row, one ring, *Alamosaurus* once.
- **Not every guess gets a leaf.** `revealedTree`'s `seenBranch` dedupe keeps one
  elimination per branch, attributed to the *first* guess that hit it, so a second
  guess inside an already-eliminated branch adds no row. Unchanged behaviour,
  restated because the new encoding makes it look as though every guess should
  appear: it does not, and never did.

## Two things this revision costs, recorded not buried

**The unresolved continuation is gone.** The diagram used to end, mid-round, with
a dashed continuation, a `?` and the word "unresolved" — the statement that the
descent carries on below the deepest node reached and that the tree is not
claiming to know how far. The owner removed that key entry (2026-08-14), and with
its word gone the mark has nothing left to define it, so the mark goes too. The
consequence is plain and is the charter §2 cost of the change: the diagram now
ends at the deepest clade reached with nothing after it, which a player can read
as "the lineage stops here" — it does not, and the tree no longer says so. A
fresh round is now a single row, `Dinosauria`, with nothing below it (panel 1).
The offsetting fact, which is not a replacement: every dashed lead in the diagram
already means "descends from, distance not drawn", so dashes still read as
un-stated descent on eliminated branches — just no longer below the trunk. This
is an owner decision, drafted as a SPEC-019 amendment in
[SPEC-025](../specs/active/SPEC-025-cladogram-render.md); SPEC-019 REQ-005
requires the continuation today, so it cannot be dropped without one.

**The red is a new ruled-out status token (owner-authorised, 2026-08-14).**
The mockup draws `#c0392b` as its stand-in; if the token's final value differs
visibly, this sheet is regenerated to match. `--color-error` keeps its own
"load failure only" scope and is not broadened. What follows is the original
note that raised the question.

**Superseded note — the red was `--color-error`, and that token says "load failure only".** The
ruled-out ring uses `#c0392b` from `src/app/styles/tokens.css` — no new hex, no
second accent, no new hue (charter §4). But the token's comment and the charter's
status table both scope it to load failure, and a ruled-out branch is not an
error, it is a verdict. Two ways out: broaden the existing token's meaning, or add
a distinct ruled-out status hue. **This mockup draws the first and the choice is
the owner's** — recorded as a human decision in SPEC-025, not assumed. (`#c0392b`
is 5.4:1 on white and 4.4:1 on the ground, so either way it clears the 3:1 a
non-text mark needs.)

## States drawn

| Panel | State | Trigger |
| --- | --- | --- |
| 1 | Fresh round | round opened, no guesses — one row, `Dinosauria`, and nothing below it |
| 2 | Marks | the key, as it sits under the diagram on the screen — three marks, three words |
| 3 | Mid-round | six guesses, deepest reached 18 nodes down, six eliminations at five different nodes, five of them carrying their guess as a leaf |
| 4 | Narrow pane | pane below the diagram's width — scrolls, trunk pinned |
| 5 | Solved | the answer is established; the trunk runs 20 nodes to the genus |

Lost, practice and already-played rounds render one of these same shapes — the
tree does not change form with the round's outcome, only with its content.

## Accessibility

The DOM does not become a picture. The list the screen ships today — an `<ol>` of
nodes, a nested `<ul>` of the branches ruled out at each node, and the
`visuallyHidden` sentences *"— established ancestor, the deepest reached so far"*
and *"— ruled out by the guess X"* — stays as it is, in the same order, carrying
the same words (SPEC-019 UX-003), with one addition and one removal. The addition:
the guessed genus now appears as a nested item under the branch it ruled out,
with its own hidden sentence, so a screen-reader player hears the same two facts a
sighted one sees. The removal: the unresolved continuation and its hidden
statement go, for everyone at once — the disclosure is not quietly kept for
assistive technology and dropped from the drawing. The SVG layer is `aria-hidden` and
purely decorative: it draws lines, never text, so there is nothing in it for a
screen reader to miss. Positioning is what changes for sighted readers. The
scroll container is focusable and keyboard-scrollable, with a name, so a
keyboard-only player can reach the right-hand end of a wide diagram.

## Charter §9 — before designing this region

1. **Who, and where in the loop?** A player mid-round, reading what they have
   established and what they have eliminated, deciding what to guess next.
2. **What must they see first?** The deepest clade reached — the closest relative
   of the answer they have established — and how the descent got there.
3. **Most likely next action?** Typing the next guess.
4. **What can go wrong?** No guesses yet, now a single row; a 20-node lineage; up
   to eight eliminations on one node, each carrying its guess; a ruled-out branch
   that is the guessed genus; a pane narrower than the diagram; a solved round.
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

Re-counted on this sheet after the 2026-08-14 revision
([checklist](anti-slop-checklist.md)): **0** bordered containers, **0** pill
chips, **0** sentences explaining how to read the screen — the key is now three
marks and three single words (`ancestor`, `closest relative`, `guess`), one word
shorter per entry than before, and the "which one is my guess" rule is carried by
the key's picture (the pair drawn, joined, offset) rather than by a caption. The
prose explaining the pair lives on this page and in the sheet's annotation block,
which is mockup apparatus, not screen copy. The layout would not survive being
moved to a CRM — it is a cladogram. The subject is the largest thing on the
sheet. Every colour carries a charter meaning: teal for the deepest node reached
(interaction/accent layer), clade tints from `mapCladeMarkers.ts`, `--color-error`
red for ruled out — **flagged**, because that token is charter-scoped to load
failure and broadening it is an owner decision, recorded and not assumed. Every
state is legible in shape and in words: dashed vs. solid lead and hollow vs.
tinted dot carry ruled-out without colour, at the shortest lead the layout can
produce (one 16 px indent, three dash marks at 3-on/2-off). One state got
*less* legible and it is recorded above, not hidden: the unresolved continuation
was removed on owner instruction, so the tree no longer states that the descent
continues below the deepest node reached. All names, ranks and lineages are from
the shipped snapshot. Nothing here exists because a library made it easy — there
is no library; the connectors are 40 lines of path arithmetic.
