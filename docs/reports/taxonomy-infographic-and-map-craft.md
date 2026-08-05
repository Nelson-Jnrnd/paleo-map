---
doc_type: report
title: Two directions — taxonomy as infographic, and making the map beautiful
status: For review (pre-spec)
owner: nelsonjeanrenaud@gmail.com
author: agent
date: 2026-08-04
---

# Two directions

> Discussion report, not a spec. Two explorations, each ranked internally with an
> effort read. Every number below was counted from the shipped snapshot or probed
> against the live GPlates service; where something needs verifying before it
> could be specced, I say so.

---

# Direction A — Taxonomy as infographic

## What the data actually is

I measured the tree before designing anything, and it's much better raw material
than the current breadcrumb suggests:

- **2,555 taxa in one connected tree**, with a single root: **`Life`**.
- **Maximum depth 54; mean depth 43.5.** The path from `Life` to *Tyrannosaurus*
  is **45 nodes** long.
- **434 internal nodes** — the tree is deep and narrow, not a hairball.
- 2,123 genera · 285 clades · 147 families.
- **Every one of the 2,555 has a silhouette.**
- Biggest branch points: Theropoda (73 children), Enantiornithes (58),
  Hadrosauroidea (41), Sauropoda (41), Nodosauridae (38), Aves (35),
  Titanosauria (35), Coelurosauria (34), Dinosauria (26).

Here is the full lineage that the app currently renders as
`Dinosauria › … › Tyrannosaurini › Tyrannosaurus`:

> Life → Eucarya → Opisthokonta → Animalia → Bilateria → Eubilateria →
> Deuterostomia → Chordata → Vertebrata → Gnathostomata → Osteichthyes →
> Sarcopterygii → Dipnotetrapodomorpha → Tetrapodomorpha → **Tetrapoda** →
> Reptiliomorpha → Anthracosauria → Amphibiosauria → Cotylosauria → **Amniota**
> → Sauropsida → Reptilia → Eureptilia → Romeriida → **Diapsida** →
> Archosauromorpha → Crocopoda → Archosauriformes → Eucrocopoda → **Archosauria**
> → Avemetatarsalia → Ornithodira → Dinosauromorpha → Dinosauriformes →
> **Dinosauria** → **Theropoda** → Neotheropoda → Averostra → Tetanurae →
> Coelurosauria → Tyrannosauroidea → Tyrannosauridae → Tyrannosaurinae →
> Tyrannosaurini → ***Tyrannosaurus***

That is a spectacular thing to own, and it is currently compressed into a `…`.

## A1. "How closely related are these two?" — the common-ancestor finder

**★★★★★ · Effort: Low–Medium**

The single best thing this tree can do that no dinosaur site does: **pick any two
taxa and show where they meet.**

Pick *Tyrannosaurus* and *Triceratops* and the answer is Dinosauria — they are
separated by roughly 20 branchings, which is to say they are *not* close, despite
sharing every diorama. Pick *Tyrannosaurus* and a modern bird and the answer is
much shallower — the punchline everyone half-knows and nobody can picture. Pick
two hadrosaurs and they converge almost immediately.

The infographic: two lineages rising from the bottom of the frame as parallel
ribbons, converging at their last common ancestor, with the shared trunk drawn
thick below the join and the two divergent paths above it — silhouettes at each
end, the ancestor named at the junction, and the number of branchings on each
arm. One picture that answers "are these cousins or strangers?"

**Why it's cheap:** it's a last-common-ancestor walk over `parentId` chains,
which are already in memory at runtime. No new data, no pipeline work. The whole
computation is a set intersection of two ancestor lists.

**The honest caveat, which this project will care about:** PBDB's parent chain is
a *taxonomic containment* hierarchy, not a dated phylogeny. Counting branchings
measures how finely that region of the tree has been subdivided by taxonomists,
not elapsed evolutionary time. So the picture may say "shares an ancestor at
Dinosauria" but must not say "diverged 30 million years ago". Phrase it in
branchings and named ancestors only.

## A2. The descent — 45 steps from Life

**★★★★★ · Effort: Medium**

Turn that lineage list into the page's spine. A vertical descent from `Life` at
the top to the animal at the bottom, each step a node, and — this is the part
that makes it an infographic rather than a list — **the silhouette changes as you
descend.** Something amoeboid at Opisthokonta. A fish at Osteichthyes. The first
four-legged thing at Tetrapoda. An egg at Amniota. A reptile at Diapsida.
Something crocodile-ish at Archosauria. And then the dinosaur silhouettes take
over and refine, step by step, until the animal you clicked.

You'd be able to *see* a body plan being assembled over 45 branchings. That is
the single most educational image a dinosaur atlas could carry, and the tree
underneath it is real, not decorative.

**Effort:** medium. The chain and the dinosaur-side silhouettes ship already; the
deep ancestral nodes (Chordata, Amniota, Diapsida…) would need silhouettes
sourced — PhyloPic covers all of them and the project already has a PhyloPic
fetch script (`fetch:silhouettes`). The design work is choosing which of the 45
steps get emphasised, because all 45 shown equally is a wall of Latin. My
instinct: draw all 45 as small ticks, but *name and illustrate* the eight or so
that are real transitions.

## A3. The Dinosauria fan — one poster of the whole group

**★★★★☆ · Effort: Medium**

A radial tree rooted at Dinosauria, opening out through Theropoda / Sauropodomorpha
/ Ornithischia to the genera at the rim. Wedge width = how many genera the branch
holds, so Theropoda's 73-child fan-out is *visible* as bulk. Silhouettes around
the rim. The whole group in one frame, on one screen.

It works as three things at once: an orientation aid ("where does the thing I'm
looking at sit?"), a navigation surface (click a wedge → the map filters to that
clade), and honestly the best-looking thing the product could put on its landing
screen.

**Effort:** medium, and the risk is legibility, not data. 2,123 rim items is too
many to label; the fan probably has to render to family/clade level and reveal
genera on zoom or hover. Worth prototyping at two or three depths before
committing.

## A4. The shape of a clade

**★★★★☆ · Effort: Low**

Cheapest real infographic on this list. Pick any clade node — Ceratopsia,
Sauropoda, Tyrannosauroidea — and lay its members out as **silhouettes only**,
arranged by relationship, sized against each other.

All 2,555 silhouettes already ship, so this is a layout problem and nothing else.
And the payoff is immediate: seeing thirty ceratopsian silhouettes together shows
you the frill-and-horn variations at a glance in a way no text can. "Show me
every sauropod in one picture" is a thing I would actually use, repeatedly.

**Effort:** low. No new data, no pipeline, no fetch. Relative sizing is only
trustworthy for the enriched genera, so version one should present them at equal
size and add true scaling later rather than fake it.

## A5. Your neighbours on the tree

**★★★☆☆ · Effort: Low–Medium**

Less of a poster, more of an everyday tool: instead of a breadcrumb going *up*,
show the local neighbourhood — parent above, siblings either side, children
below, each with a silhouette and a genus count. Then you can walk the tree
sideways, which is currently impossible: today the only navigation is up the
ancestor chain.

**Effort:** low to medium. The child index has to be derived (the data stores
`parentId` only, so it's a one-pass inversion at load), then it's a small
navigable panel.

## Ranking, Direction A

| Idea | Interest | Effort | Needs new data? |
|---|---|---|---|
| A1 Common-ancestor finder | ★★★★★ | Low–Med | No |
| A2 The 45-step descent | ★★★★★ | Medium | Silhouettes for deep ancestors (PhyloPic) |
| A3 Dinosauria fan | ★★★★☆ | Medium | No |
| A4 Shape of a clade | ★★★★☆ | **Low** | No |
| A5 Neighbours on the tree | ★★★☆☆ | Low–Med | No |

**Start with A4, then A1.** Both are pure layout and arithmetic over data already
in the browser, and between them they'd change the taxonomy from a string of
italic names into the reason to open the app.

---

# Direction B — Make the map beautiful

## What the map is right now

Measured from the code and the shipped frames:

- The MapLibre style is **three things**: a flat background colour
  (`#d7e4ec`), one land fill (`#edf1f1`), and one 1px coastline stroke
  (`#a9b9c3`). That's the entire basemap.
- The frames are **coastline polygons only** — 315 polygons for the
  Maastrichtian, and **every one has an empty `properties: {}`**. No plate names,
  no depths, no elevations, no ocean names. Nothing to style *by*.
- They're simplified with Douglas–Peucker at **0.3° tolerance** (~33 km) and
  rounded to 2 decimals, giving ~105 KB per frame (3.0 MB for all 30). The
  service returns **1.1 MB** unsimplified for the same frame.
- **No graticule is drawn.** There's a `--color-grid` token and the code mentions
  degrading "to the graticule" as a no-data fallback, but the normal map has no
  grid at all.
- Projection is **MapLibre's default Web Mercator**, with world copies left on.

So the flatness isn't a styling accident — there is genuinely only one polygon
layer to work with. The interesting news is how much can be done without adding a
single new source.

## B1. Build the bathymetric chart the charter already asked for

**★★★★★ · Effort: Low**

The design charter specifies the ocean as a **radial `#d7e4ec` → `#eef4f7`**
gradient — "a pale bathymetric chart". The token exists
(`--color-ocean-inner`), and **the map never uses it**: the MapLibre style sets
`background-color` to the flat outer value and stops. The charter's own
bathymetric intent was written down and never rendered.

What a real bathymetric chart does is band the water by depth, so that shallow
shelf hugs the coast and deepens outward. You can fake that convincingly with no
depth data at all: draw the coastline **two or three more times underneath
itself** as progressively wider, more transparent blurred strokes on the sea
side. Landmasses get a pale shelf halo that fades into open ocean, and the sea
stops being a single field of blue.

This is the highest-value change on either list relative to its cost: it is a
handful of extra layers in the existing style, no new data, no pipeline, no
budget impact, and it delivers the look the charter already committed to.

## B2. Give the land some volume

**★★★★☆ · Effort: Low**

Land is one flat fill, so continents read as paper cut-outs. The same trick
inward — a soft darker edge just *inside* the coastline — makes landmasses feel
like solid bodies rather than holes in the ocean. Optionally a very faint tonal
variation across large interiors so Pangaea isn't 40 million km² of one hex.

Same cost as B1, same mechanism, and the two together are most of the perceived
difference between "a shape file rendered" and "a chart someone designed".

## B3. Better coastlines where you can see them

**★★★★☆ · Effort: Medium**

0.3° of simplification is about 33 km. At the opening zoom that's invisible and
correct. Zoomed into a dig site it's very visible — coastlines go polygonal and
the illusion of a real place breaks.

The full-resolution frame is 1.1 MB against the committed 105 KB, so shipping
detail everywhere costs an order of magnitude. The fix is two levels rather than
one: keep the coarse frame for the world view, load a finer frame for the stage
you're zoomed into. It's the standard cartographic answer and it fits the
existing per-stage loading pattern.

**Effort:** medium, mostly because it touches the payload budget
(`check:budget` exists and NFR-002 is real). Worth checking whether tolerance
0.15° buys most of the visual gain at half the extra weight, before building
anything two-tiered.

## B4. A graticule, and an equator that means something

**★★★★☆ · Effort: Low**

There's no grid. A faint 30° graticule would do three things at once: make the
projection legible, give the eye a reference for how much the continents have
moved between stages, and stop the map from feeling like abstract shapes floating
in blue. The equator specifically deserves a slightly stronger line, because on a
paleomap it's the one line with physical meaning — it tells you where the heat
was.

The token (`--color-grid`) is already defined and unused.

**Effort:** low — a generated GeoJSON grid, or MapLibre's line layers over a
static graticule file. No source needed.

## B5. Name the world

**★★★★☆ · Effort: Medium (curation, not code)**

The map has no labels at all. Not one. You're looking at 69-million-year-old
geography with no way to know that the sea splitting North America is the
**Western Interior Seaway**, that the ocean closing to the east is the **Tethys**,
or that the thing you're looking at in the Triassic is **Pangaea**.

Names are what turn a shape into a place. A small set of hand-placed labels per
stage — a handful of oceans, seaways and landmasses, in the map's own type,
faint, at low zoom only — would do more for orientation than any interaction.

It also sits squarely inside the charter's domain-language rule: Tethys,
Laurasia, Gondwana, Panthalassa are exactly the vocabulary it asks for.

**Effort:** medium, and it's *writing* work rather than code — someone has to
place and check them per stage, and the placements have to be sourced like
everything else here. Start with the four or five stages people actually visit.

## B6. Two projection decisions worth making on purpose

**★★★☆☆ · Effort: Medium (one is unknown)**

- **World copies are on** (MapLibre's default), so panning east or west repeats
  the reconstruction endlessly. For a tiled street map that's right; for a single
  reconstructed globe it's odd — you can scroll to a second Pangaea. Turning it
  off is one flag and makes the map read as *the world*, singular.
- **Web Mercator inflates the poles absurdly** — and this map has occurrences up
  past 84° paleolatitude, which Mercator will stretch into nonsense. An
  equal-area projection would be both more honest and better-looking for a
  whole-globe object. **This one needs verifying before it's specced:** I have not
  confirmed which non-Mercator projections MapLibre 4.7 exposes, and the obvious
  alternative — globe mode — is an explicit non-goal (OQ-010), so a flat
  equal-area projection is the only direction worth investigating.

## B7. Let the markers sit *on* the new map

**★★★☆☆ · Effort: Low–Medium**

Once B1 and B2 land, the current markers will need retuning: at the opening zoom
the map is a field of pale grey discs that compete with the coastlines rather than
sitting on them. Smaller marks at low zoom, a proper casing so a marker reads
over both pale land and pale sea, and letting the silhouette earn its place only
when it's big enough to be legible.

I'd treat this as the finishing pass on B1–B4 rather than its own project.

## B8. Plate boundaries — possible, but there's a catch

**★★★☆☆ · Effort: High**

The thing that would make this look like a real geological chart is tectonics:
subduction zones with their teeth, mid-ocean ridges, rifts. I probed the GPlates
service to see whether it's available:

- The **PALEOMAP** model — the one this project uses, pinned to match PBDB's
  paleocoordinates — returns **zero** topological features, and its
  `static_polygons` endpoint 500s. There is nothing to draw.
- **MULLER2019** returns **431 boundary features** for 69.1 Ma (147 KB), fully
  typed and named: `SubductionZone` with polarity, `ContinentalRift`, and so on.
  MERDITH2021 and SETON2012 also work.

So it's available — **but only in a different rotation model**. Overlaying
MULLER2019 tectonics on PALEOMAP coastlines means drawing two reconstructions of
the same moment that don't quite agree, which is precisely the class of problem
SPEC-016 exists to eliminate. Either it gets labelled honestly as a
different-model overlay, or it waits. I'd not start here — but it's worth knowing
the data is one HTTP call away if the appetite is there.

## Ranking, Direction B

| Idea | Interest | Effort | Needs new data? |
|---|---|---|---|
| B1 Real bathymetric ocean | ★★★★★ | **Low** | No — the token already exists, unused |
| B2 Land with volume | ★★★★☆ | **Low** | No |
| B3 Finer coastlines when zoomed | ★★★★☆ | Medium | Re-fetch at lower tolerance |
| B4 Graticule + equator | ★★★★☆ | **Low** | No |
| B5 Name the world | ★★★★☆ | Medium | Hand-authored labels |
| B6 Projection decisions | ★★★☆☆ | Medium | No (needs a capability check) |
| B7 Retune markers | ★★★☆☆ | Low–Med | No |
| B8 Plate boundaries | ★★★☆☆ | High | Yes, and in a conflicting model |

---

# If I had to pick

**B1 + B2 + B4 together, as one pass.** Bathymetric ocean, land with an edge, and
a graticule. All three are style-layer changes with no new data, no pipeline work
and no budget risk, and together they'd change the map from three flat colours
into something that looks deliberately drawn. It's the best ratio of visible
change to effort anywhere in this report — and B1 is arguably owed, since the
charter specified that gradient and the map never used it.

**Then A4 and A1** from the taxonomy side — the clade silhouette sheet and the
common-ancestor finder. Both are pure presentation over data that's already in
the browser, and they'd make the taxonomy the second reason to open the app
rather than a line of grey italic text above a Wikipedia frame.
