# Anti-slop checklist

**Status:** Working design conventions, subordinate to
[`design-guidelines.md`](design-guidelines.md). This page introduces **no
requirements** — requirements live only in specs
([`DOCUMENTATION_AUTHORITY.md`](../workflow/DOCUMENTATION_AUTHORITY.md) rule 1).
Where it appears to conflict with the design charter, **the charter wins**; where
the charter conflicts with a spec requirement, **the requirement wins**.

The charter says what this product should look like. This page says what it must
not drift into: the generic, interchangeable look that coding agents produce by
default when nothing tells them which direction to commit to. Read it with the
charter before designing or building any screen.

Written after a mockup for [SPEC-019](../specs/approved/SPEC-019-daily-genus-puzzle.md)
had to be thrown away and redrawn (owner feedback, 2026-08-11). The worked
examples below are from that redraw.

---

## Why this happens

Generative tools are trained on the aggregate of well-regarded interfaces. Asked
for "a clean, modern screen" with no further constraint, they return the
statistical centre of that training data. **The root cause is an absent
decision, not a bad taste.** The fix is therefore not "add personality" — it is
to decide what the screen's subject is, and let that decision drive the layout.

The most expensive mistake is at the **layout level, not the component level**. A
correctly-tokenised teal button inside a generic two-panel dashboard is still a
generic two-panel dashboard.

---

## Don't

1. **Don't make everything a card.** A page of white rounded rectangles on a grey
   ground is the single loudest tell. Containers are for things that genuinely
   detach from the page.
2. **Don't put a 1px grey border and an 8px radius on every box.** Uniform
   chrome repeated ten times reads as generated. Prefer a hairline rule, or
   nothing.
3. **Don't turn every value into a pill chip.** Rounded, bordered, centre-set
   micro-badges are decoration standing in for information design.
4. **Don't build symmetric equal-weight panels.** Two 50% columns of equal visual
   weight mean no decision was made about what matters.
5. **Don't caption your own interface.** Paragraphs explaining what a region is
   and how to read it usually mean the region does not explain itself. Fix the
   region.
6. **Don't reach for a stock layout skeleton** — hero plus three feature cards,
   sidebar plus main, a row of stat tiles. If the layout would fit five unrelated
   products, it is wrong for this one.
7. **Don't decorate with colour.** No gradients (purple→blue above all), no
   glassmorphism, no neon glow, no hover bounce. This product's colour is
   meaning-only: one teal accent, ICS period hues, clade tints, status cues.
8. **Don't add a dark theme.** The product is deliberately single-theme light
   (charter §4).
9. **Don't let a component library's defaults decide the design.** Reach for the
   domain's own form first, the component second.
10. **Don't invent tokens.** If a value is not in `src/app/styles/tokens.css`,
    either it is wrong or the token set needs a considered addition.
11. **Don't fake the data in a mockup.** Invented taxa and plausible-looking
    numbers hide the real problems — the name that is 19 characters long, the
    node with 26 children, the field that is empty in 40% of records.

## Do

1. **Name the screen's subject in one sentence, then give it the canvas.** If
   the subject is the classification tree, the tree *is* the screen — not a
   component inside it. Everything else goes to the margins.
2. **Draw the domain's own object.** Paleontology and cartography have real
   visual forms with centuries of convention behind them: the cladogram, the
   stratigraphic column, the Ma axis, the range chart, the map plate. Use them
   instead of a generic widget standing in for them.
3. **Prefer hairlines, spacing and alignment to containers.** Structure a page
   the way a printed scientific plate does.
4. **Make a verdict a mark on the object, not a badge beside it.** A ruled-out
   clade is a struck-through branch on the tree. A frontier is a ring on the
   node. A verdict that has nowhere to live on the object is a hint that the
   object is drawn wrong.
5. **Turn a scalar into an axis when the domain has one.** "Older / younger /
   overlaps" as a chip is a label; the same fact plotted against an Ma scale with
   ICS bands is a reading. Same information, and it teaches the axis.
6. **Let the data structure the layout.** Depth becomes indentation; siblings
   become branches; a range becomes a bar. Then a list stops being necessary,
   because the items are already positioned by meaning.
7. **Build mockups from the shipped snapshot.** Real names, real lineages, real
   spans. It costs one query and catches the layout failures early.
8. **Carry state with shape and word first, colour third** — filled, struck
   through, dashed, each also named (charter §2, PERF-250).
9. **Cut copy to what the object cannot say for itself.** Then cut it again.
10. **Look at the reference class, not at dashboards.** GPlates, Macrostrat,
    stratigraphic charts, field guides, museum plates, journal figures.

---

## Self-check before publishing a mockup or screen

Count them. Any answer above zero needs a reason.

- [ ] How many bordered containers are on this screen?
- [ ] How many pill-shaped chips?
- [ ] How many sentences explain how to read the screen?
- [ ] Would this layout work unchanged for a CRM, an analytics tool, and a
      to-do app?
- [ ] Is the subject of the screen the largest thing on it?
- [ ] Is every colour carrying a meaning defined in the charter?
- [ ] Is every state also legible in shape and in words?
- [ ] Is the content real, from the snapshot?
- [ ] Does anything here exist because a component library made it easy?

---

## Worked example — SPEC-019, redrawn 2026-08-11

| First pass (rejected) | Redraw |
| --- | --- |
| Two bordered panels, near-equal weight | One full-bleed cladogram; margins for everything else |
| Tree rendered as an indented bulleted list in the left panel | Real rectangular cladogram: trunk, risers, aligned terminals |
| Separate guess list in the right panel | No guess list — each guess **is** the branch it ruled out |
| Ruled-out clades as grey pill chips | Struck-through terminals on the tree, labelled with the guess |
| "Advanced the tree" as a tinted card with a left bar | A teal ring on the frontier node and a rule under its name |
| Time verdict as a chip per guess | Stratigraphic column: ICS bands on an Ma axis, guess ranges plotted |
| Boxed input field with a filled button | A caret, a rule, and `↵ guess` |
| A "Reading the tree" legend paragraph | Three marks, three words |
| Nine bordered cards on the state sheet | Nine cells divided by hairlines; notices marked by a coloured left rule |

## Sources

The tells above are the industry-documented ones, not invented:

- [AI Design Slop: Why AI-Generated UI Looks Generic — and the Fix, SmoothUI](https://smoothui.dev/blog/ai-design-slop)
- [AI Slop: Why Everything Designed With AI Looks the Same, Designpixil](https://designpixil.com/blog/ai-slop-design)
- [AI Slop Web Design: Spotting and Fixing Generic Websites, 925 Studios](https://www.925studios.co/blog/ai-slop-web-design-guide)
