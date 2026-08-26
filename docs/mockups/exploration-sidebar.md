# Screen: Exploration sidebar (redesign)

The right-hand column of the exploration view — the surface that answers "what
is a row, and what did I just pick?". This page documents the redesign proposed
by [SPEC-026](../specs/active/SPEC-026-sidebar-redesign.md) as approved by the
owner on 2026-08-14; it introduces no requirements of its own.

![Exploration sidebar redesign — the unit selector, one list whose rows carry at most two subtitles, the details that replace the list, and the loading, empty, error, capped and messy-data states, all drawn at the real 360 px width](../assets/mockups/exploration-sidebar.svg)

Binding on [`design-guidelines.md`](design-guidelines.md) (the charter) and read
alongside [`anti-slop-checklist.md`](anti-slop-checklist.md).

## Related requirements

- **SPEC-010** REQ-001 (grouping-mode control), REQ-003 (locality rows collapse a
  collection with a distinct-taxon count), REQ-004 (taxon rows carry an
  occurrence count and an aggregate Ma span; hover linkage), REQ-005 (rank
  roll-up and the *not classified at this level* bucket), UX-001 (domain
  language, all states designed). SPEC-026 changes the *carrier* of REQ-001/005,
  trims REQ-003/004's row contents to two subtitles, and — by owner decision,
  2026-08-14 — **retires the not-classified bucket** from the taxon units; the
  amendment block (SPEC-010 AMEND-003) is in SPEC-026.
- **SPEC-009** REQ-003/004 — the viewport-linked list, its render cap and
  overflow line, and the two-way map↔list highlight.
- **SPEC-003** REQ-006/007 — selection → panel → profile, and the single-action
  way back.
- **SPEC-013** REQ-004 — a chosen search result lands as a selected taxon in this
  column, at the tier that holds it.
- Charter **§2** (uncertainty first-class), **§3** (domain language), **§4**
  (one teal accent, clade tints are meaning-only), **§6** (long, messy, missing
  real data), **§7** (every real state), **§8** (interaction contract).
- Functional spec: FONC-040/050/060 (permanent context), FONC-1280 (empty),
  FONC-1310/1330 (error + retry), PERF-120 (target size), PERF-250 (never
  colour-only).

## The scenario in the mockup

Everything drawn is read from the shipped snapshot (`public/data`), stage
**Maastrichtian**, with the whole map in view. No number and no name is invented:

| Figure | Value | Where it comes from |
| ------ | ----- | ------------------- |
| Occurrences at this age | 5,064 | `stage-maastrichtian.json` |
| Localities (collections) | 2,439 | distinct `collectionId` |
| Genera | 378 classified; a further **2,898 records (57 %) reach no genus** and are now filtered out of the taxon units | `resolveTierTaxon` at the genus tier |
| Families | 74 classified; 1,951 records (39 %) reach no family | genus tier → family tier |
| Major groups | 16 classified; 532 records (11 %) reach no major group | curated `MAJOR_GROUP_NAMES` |
| Largest genus | *Triceratops*, 165 occurrences, 66–83.6 Ma | fold over the stage |
| Largest locality | Lull 2 Quarry (UCMP V-5620), 26 taxa / 30 records, Wyoming, US | fold over `collectionId` |
| Present-day region | on **100 %** of 41,116 occurrences in all stages, 667 distinct values | `modernPosition.value.region` |

Two things fell out of using real data rather than plausible data, and both
changed the design:

1. **At the genus tier, 2,898 of 5,064 records reach no genus at all** — more
   than half the stage. Drawn as a disclosed bucket they were the single biggest
   row in the atlas, sorted last, landing past the 300-row render cap. The owner
   decided on 2026-08-14 to **filter them out of the taxon units** instead: the
   Genus, Family and Major group units now show classified taxa only, and those
   records stay in full under Occurrence and Locality (panels B, I, J).
2. **Alphabetical ordering plus a 300-row cap hides *Triceratops* and
   *Tyrannosaurus*** — among the 378 classified genera they sort 343rd and
   348th. Ordering by count fixes it and makes the overflow line honest ("the
   rest are rarer").

A third thing real data settled: **no per-row Ma bar.** A span bar per row is
tempting (the checklist likes turning a scalar into an axis), but in this
snapshot almost every Maastrichtian row spans 66–83.6 or 66–72.2 Ma, so a column
of bars would be a column of near-identical marks — decoration with no reading in
it. The span stays as a figure with its unit.

## Expected contents

### The unit selector — one control, one question (panel A, top)

An eyebrow **ONE ROW PER** and five singular units on one line:

```
Occurrence   Locality   Genus   Family   Major group
```

The active unit is **bold plus a 2 px teal rule under it** — word *and* mark, so
it is never colour-only (PERF-250). No box, no segmented-control border, no
dropdown appearing or disappearing. It is the same five options in the same
place in every state, including loading and error, where they are disabled with
the current choice still legible (charter §7's disabled-with-a-reason rule).

This replaces two controls: the Occurrences/Localities/Taxa segmented control and
the "Group by rank" `<select>` that only existed inside Taxa mode.

### The list — chrome invariant, body varies (panels A, B, C)

Everything above the rows is identical in all five units:

- a count line: a mono figure plus the unit's plural noun — `378 genera in view`
  (or `… at this age` with no map viewport signal);
- the overflow line when the cap bites — `Showing the first 300 of 378 — zoom in
  to narrow the view.` (unchanged wording, existing behaviour);
- a hairline, then the rows. No card, no panel border.

A row is always two lines and 44 px tall, and the second line carries **at most
two values** (owner review, 2026-08-14 — "too much noise in the list"):

| Unit | Line 1 | Line 2 — two subtitles, no more | Cut, and where it went |
| ---- | ------ | ------------------------------- | ---------------------- |
| Occurrence | taxon name (italic) | Ma range · collection name | **formation** → the occurrence detail (panel I) |
| Locality | collection name | *n* taxa · present-day region | **occurrence count, formation, Ma range** → the locality detail (panel K) |
| Genus / Family / Major group | taxon name (italic) | *n* occurrences · aggregate Ma range | **clade word** → the clade tint on the row, spelled out in the detail (panel D) |

The two that survive on a taxon row are the two the requirements lean on
(SPEC-010 REQ-004: the in-view occurrence count and the aggregate span). The Ma
range leads the occurrence row because the collection name is the part that
truncates; it never truncates the age away.

**The present-day region** is the locality row's second subtitle — a locality has
to say where it is *today*, not only where it was. It is `modernPosition.value.region`
printed exactly as the snapshot records it: `Wyoming, US`, `Alberta, CA`,
`Omnogov, MN`, `Ash Shamaliyah, SD` — a sub-national area plus an ISO-2 country
code, present on 100 % of occurrences. It is not expanded to a country name: that
would need a 95-entry code→name table in the app, one of whose codes (`O2`,
open ocean) names no country at all, and it would cost the row width that the
long collection names need.

**The clade rule.** Taxon and occurrence rows carry a 2.5 px vertical rule in the
row's clade tint (`mapCladeMarkers.ts`, charter §4 as extended by SPEC-017
AMEND-001) — adopted by the owner, 2026-08-14. The clade word itself is **off the
row**: it is redundant beside the tint and it is spelled out in the detail one
click away ("Ceratopsian · genus", panel D) and in the row's accessible name, so
the tint is a reinforcement and never the sole carrier (PERF-250). A **locality
carries no rule**: a place is not a clade, and the tint is never applied to
something that is not one.

**No not-classified bucket.** At Genus, Family and Major group the list shows
classified taxa only. Records that reach no taxon at the tier are filtered out of
the list, the count and the map together, so the three never disagree; they are
all still there under Occurrence and Locality.

### The detail — it replaces the list (panels D, I, K)

Selecting a row, or selecting a point on the map, replaces the rows with the
detail **in the same column**. The unit selector and a back link stay:

```
← 378 genera in view
─────────────────────
Triceratops
Ceratopsian · genus
Occurrences in view   165
Time range            66–83.6 Ma
                      ≈ spans multiple stages
Grouped at            Genus — its own rank
On the map            165 points emphasised, 2,001 dimmed
[ Open taxon profile → ]
```

The back link **names the list it returns to**, so the user always knows where
they are (charter §8). Returning restores the scroll position and marks the row
(`aria-current`), so a detail is a step in the loop and not a departure from it.

The map is untouched by the swap — the taxon focus/dim it paints (SPEC-010
REQ-004) stays fully visible, which is exactly why the detail does not need to
sit beside the list. (The dimmed figure is 2,001, not 4,899, because at a taxon
unit the visible set is the 2,166 records that classify at genus.)

The **occurrence detail** (panel I) is where the formation now lives, with the
explicit `Formation not recorded` label when the collection has none — 501 of
5,064 Maastrichtian records. The **locality detail** (panel K) is where the
occurrence count, the formation and the Ma span went when the locality row was
cut to two subtitles.

## States to document

| State | Trigger | What the user sees | Recovery |
| ----- | ------- | ------------------ | -------- |
| **Loading** (E) | Stage snapshot in flight | Selector disabled with the chosen unit still legible; `Loading Maastrichtian…` and a determinate progress bar with its percentage as text | none needed; the unit and age survive |
| **Empty at this age** (F) | No occurrence overlaps the stage (FONC-1280) | `No occurrences at this age` + the stage and its bounds; no zero counts, no empty rows | **Reset view** (teal, the one primary action) |
| **Error** (G) | Stage fetch failed (FONC-1310) | Red left rule + `Could not load this stage` + the real failure; the red marks the state, the recovery stays teal | **Retry**; age, unit and viewport preserved (FONC-1340) |
| **Empty in view** (H) | Age has records, viewport has none | Count stays on screen at `0`, and says the view is empty, not the age | **Zoom out to the whole map** (quiet text action) |
| **Capped / overflow** (A, B, C) | More groups than `LIST_RENDER_CAP` (300) | The existing overflow line, plus count-ordering so the cut tail is the rare tail | zoom in |
| **Row selected** (D, I, K) | Row activated, or a map point picked | Detail replaces the rows; selector and back link persist | back link, or `Esc` |
| **Missing value** (I) | The collection records no formation (501 of 5,064) | The occurrence detail's `Formation not recorded`, in the charter's muted amber, named in words | — |
| **No article** (I, K) | The taxon has no Wikipedia page | The profile control is present, disabled and labelled `no article` (SPEC-014 AMEND-005) | open a taxon that has one |
| **Long / messy / missing data** (J) | Real PBDB names | `? Neoceratosauria indet.`, `cf. Hadrosauropodus langstoni`, `Hadrosauropodus langstoni n. gen. n. sp.`, the 79-character `SDNHM Loc. 3405 - Carlsbad area, off College Boulevard and Palomar Airport Road` — truncated to the column with the full string in the row's `title`. These are exactly the records the taxon units filter out, and they are all here under Occurrence | — |
| **Hovered from the map** (B, row 3) | Map hover reports an id | Row carries a faint tint and is scrolled into view; weaker than selection | — |

## What this surface deliberately does not do

- **No second control appears** when a unit is chosen. That was the defect.
- **No per-taxon or per-locality hue palette.** The only colours are the clade
  tints (a defined code, named in words in the row's accessible name and in the
  detail), the teal accent, and the amber/red status cues.
- **No fabricated taxon geometry** — the sidebar never implies a taxon has one
  position; the detail says how many points are emphasised and how many dimmed.
- **No stat tiles, no chips, no cards.** A count is a figure with a noun.
- **No third subtitle.** Two values under a row name, never three. If a value
  matters but does not earn a subtitle, it belongs in the detail.
- **No sentence explaining how to read the column.** Seven such sentences were
  drawn into the panels of the first pass and have been deleted (owner review,
  2026-08-14). What remains describes a *state*, not the interface: the overflow
  line, the empty-at-this-age line with the stage bounds, the empty-in-view line,
  and the error's real failure text.

## Notes on the visual system

Type is the single shipped monospace (`tokens.css`, SPEC-014 AMEND-003); the
scientific names are italic (CONS-350). Every colour used here is a token:
`--color-accent-deep` for actions and the back link, `--color-accent` for the
active-unit rule and the hover tint, `--color-attention` for a missing value,
`--color-error` for the failure rule, `--color-divider` for the hairlines, and
the clade tints from `mapCladeMarkers.ts`. Nothing new is invented.

The panel captions, the annotation column and the notes under each panel are
**mockup annotations**, not screen copy (charter §1).

## Anti-slop self-check

Counted on the drawn screen, not on the sheet's annotations:

| Check | Count | Reason |
| ----- | ----- | ------ |
| Bordered containers | **0** | The sidebar's own `border-left` is the only rule; panels read as objects because the surface is white on the cool ground |
| Pill chips | **0** | Counts are figures with nouns; status is a left rule plus a word |
| Sentences explaining how to read the screen | **2** (was 9 — 7 deleted) | The overflow line and the empty-in-view line remain: both describe a state and both are existing, spec-backed behaviour. The first pass also narrated the screen inside the drawn panels — "The unit selector is disabled while the stage loads…", "Nothing is countable, so the counts and the rows are absent…", and five more; all seven are gone from the product |
| Would this layout suit a CRM / analytics tool / to-do app? | **No** | The units are occurrence, locality and three taxonomic ranks; a row body is a scientific name, an occurrence count and an Ma span; the taxon units exist over the 43 % of identifications that reach a genus at all |
| Is the subject the largest thing on it? | **Yes** | The rows are the screen; the selector is one line of text and the header two |
| Is every colour carrying a charter meaning? | **Yes** | teal = interaction/selection, clade tints = clade code (named in the detail and in the row's accessible name), amber = incomplete, red = load failure |
| Is every state legible in shape and in words? | **Yes** | active unit = bold + rule + word; missing formation = amber + the words "Formation not recorded"; no article = a disabled control + the word; error = red rule + red heading text; hover = tint + `data-highlighted` |
| Is the content real, from the snapshot? | **Yes** | every name, count and span; the messy-name panel is literal PBDB text |
| Does anything exist because a component library made it easy? | **No** | the segmented control and the `<select>` — the two things that did — are what this redesign removes |

## TODO

- Add this screen to [`screens-index.md`](screens-index.md) now that SPEC-026 is
  Approved (not edited here — that file is outside this change's scope).
