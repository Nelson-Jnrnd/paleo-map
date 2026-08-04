---
doc_type: report
title: New features I'd actually want — a fan's wishlist
status: For review (pre-spec)
owner: nelsonjeanrenaud@gmail.com
author: agent
date: 2026-08-04
---

# New features I'd actually want

> Discussion report, not a spec. **None of these trace to an existing `FONC-*`
> requirement** — that's deliberate. This is a wishlist of things the atlas
> doesn't do and nobody has written down yet, not a re-litigation of deferred
> scope. Each would need its own spec.

Ranked by how badly I want it. Effort is my read of the shipped data and code.
Where I claim data exists, I counted it.

| # | Feature | Interest | Effort | Data situation |
|---|---------|----------|--------|----------------|
| 1 | Footprints, eggs and nests as their own kind of fossil | ★★★★★ | Low–Med | 181 track taxa + 72 egg taxa already in the snapshot |
| 2 | Play the map by *discovery* year, not geological age | ★★★★★ | Medium | All 8,326 sources carry a year: 1758–2027 |
| 3 | Polar dinosaurs — draw the climate bands | ★★★★★ | Low–Med | 934 occurrences above 60° paleolatitude, up to 84°N |
| 4 | Diversity through time — the shape of the Mesozoic | ★★★★☆ | Medium | Derivable entirely from shipped occurrences |
| 5 | "What was here?" — pin your own town, scrub through time | ★★★★☆ | Med–High | Needs inverse plate rotation for the full version |
| 6 | A life list — dinosaurs I've actually stood in front of | ★★★★☆ | Low | No new data at all |
| 7 | The last day — a K–Pg view | ★★★☆☆ | Medium | Occurrences are there; the impact context is new |
| 8 | Where can I go see one? | ★★★☆☆ | High | Needs a new PBDB field (repository) in the pipeline |
| 9 | The family reunion — relatives as silhouettes | ★★★☆☆ | Low–Med | Taxonomy + 2,555 silhouettes already ship |
| 10 | Dinosaur of the day / surprise me | ★★☆☆☆ | **Low** | Nothing needed |

---

## 1. Footprints, eggs and nests are not bones

**★★★★★ · Low–Medium**

While poking at the data I found *Velociraptorichnus*, *Dromaeopodus*,
*Minisauripus*, *Eosauropus* — **181 track taxa**. And *Parafaveoloolithus*,
*Montanoolithus*, *Triprismatoolithus* — **72 egg taxa**. They're sitting in the
same list as the bones, in the same italic type, indistinguishable.

That's a shame, because **tracks are the only fossils that record an animal
doing something.** A skeleton tells you what it was; a trackway tells you it was
walking north at 7 km/h, in a group, along a lakeshore, one afternoon. And eggs
mean nesting grounds — colonies, clutches, parenting. These are different
categories of wonder from "here is a femur", and the atlas currently flattens
all three into one dot.

**What I want:** evidence type as a first-class lens — **bones / tracks / eggs**
— with its own marker shape, its own filter, and its own phrasing in the panel.
"A trackway was found here" is a different sentence from "a bone was found
here", and the app should say the right one. Then let me ask the two questions
this unlocks: *where are the nesting grounds?* and *where did they walk?*

**Effort:** low to medium. Classifying ichnotaxa and ootaxa is a naming-and-rank
problem at snapshot time (the `-ichnus`/`-pus`/`-oolithus` families are
recognisable, and PBDB flags them properly if we ask for the field). After that
it's marker shapes and a filter. No new source, no new fetch.

## 2. Play the map by discovery year

**★★★★★ · Medium**

This is my favourite idea on the list and I don't think I've seen anyone do it.

The atlas has a time axis for *when the animals lived*. It's sitting on a second
time axis nobody is using: **when we found them.** Every one of the 8,326
sources carries a publication year, and they span **1758 to 2027**.

So: a second play button that runs on human time. You watch the map light up in
southern England in the 1820s — Megalosaurus, Iguanodon, the invention of the
whole idea of dinosaurs. Then the American West goes off like a firework in the
1870s during the Bone Wars. Then a long quiet. Then from about 1990 onward China
and Argentina detonate and the centre of gravity of the entire science moves
east and south.

That's a story about *us* — about empire, money, luck, and who got to do
science — told entirely with data already in the snapshot. It's the single most
interesting thing you could show a visitor that no other dinosaur site shows.

**What I want:** a mode toggle on the timeline — "when they lived / when we
found them" — and a decade scrubber. Plus, on a taxon, "described in 1905 by
Osborn" as a plain fact, and a "recently discovered" filter, because *new*
dinosaurs are exciting and there's no way to find them today.

**Effort:** medium. Years need extracting and normalising at build time (they're
in free-text citation strings now, though a year is present in 100% of them),
and the map needs to render an accumulating set rather than a stage slice. The
rendering machinery for "dots change as an axis moves" already exists.

## 3. Polar dinosaurs — draw the climate bands

**★★★★★ · Low–Medium**

The paleocoordinates go from **−88° to +84°**, and **934 occurrences sit above
60° paleolatitude** — Alaska, Nunavut, Sakha in Siberia, New South Wales down
south. Hadrosaurs at 78.7°N. That means herds of large animals living through
**months of continuous winter darkness**, inside the polar circle, and the atlas
is currently drawing them as ordinary grey dots on a pale sea.

**What I want:** the paleomap to show its own latitude bands — equator, tropics,
temperate, polar circles — drawn on the reconstruction so the geography *means*
something. Then when I click a dot at 78°N I want the app to say so: "this
animal lived inside the Arctic Circle." Plus a filter: **show me the polar
ones.**

This is the cheapest big emotional payoff in the whole dataset. The number is
already in every occurrence record; it's just being used as a coordinate instead
of as a fact.

**Effort:** low to medium. Latitude lines are a static overlay on a map that
already renders GeoJSON layers. The "you were in the Arctic" callout is a
threshold and a sentence. The honest caveat — polar circles have moved and
climate ≠ latitude — is a labelling problem, and this project is good at those.

## 4. Diversity through time — the shape of the Mesozoic

**★★★★☆ · Medium**

The timeline is currently a ruler: 186 million years of equally-weighted grey
boxes. But the Mesozoic has a *shape*. Sauropods swell through the Jurassic.
Ceratopsians and hadrosaurs explode in the last 20 million years. Whole groups
appear, boom, and vanish.

**What I want:** a stream graph living under the timeline — a band per major
clade, thickness = how many taxa are known from that stage, coloured by clade.
Suddenly the slider isn't a control, it's a chart you can read at a glance, and
dragging it means something. Click a swell and go straight there.

**Effort:** medium. The counts are derivable from data that already ships (taxon
per occurrence, clade per taxon, stage per occurrence) and could be precomputed
into a tiny summary file at snapshot time. The subtlety is honesty: this chart
shows **how much we've found**, not how much lived — the Campanian looks huge
partly because North America has been dug over for 150 years. That caveat has to
be on the chart itself, not in a footnote.

## 5. "What was here?" — pin your own town

**★★★★☆ · Medium–High**

The thing that makes deep time land for people is *personal geography*. I want
to drop a pin where I live and be told: this patch of crust was at 30° south in
the Jurassic, it was underwater, it drifted 6,000 km to get here, and the
nearest thing anyone has dug up is 40 km away.

Right now the atlas can tell me where a *fossil* was. It can't tell me where
*I* was.

**What I want:** click anywhere on a modern map, get that spot's journey through
the Mesozoic — its paleo position at each stage, drawn as a track across the
reconstructions — plus the closest occurrences to it. A "your address in the
Cretaceous" view.

**Effort:** medium to high, and this is the honest one. Occurrences arrive
pre-rotated from PBDB, so there's no rotation engine in the app to reuse — doing
this properly means bringing plate rotations into the pipeline or calling
GPlates for arbitrary points. A cheap first version — "nearest fossils to this
modern point, and where those sites sat in each stage" — gets most of the
feeling for a fraction of the work.

## 6. A life list

**★★★★☆ · Low**

Birdwatchers keep a life list. Every serious hobby has one. Dinosaur fans have
nothing, and we absolutely would use it.

**What I want:** tick off dinosaurs I've stood in front of in a museum, and dig
sites I've visited. A little counter — "you've seen 23 of 2,123 genera" — and my
ticks showing up on the map as a personal layer. Maybe a note field, because I
remember exactly where I was when I first saw the AMNH *Tyrannosaurus*.

Nothing in this space treats the user as someone with a history. It'd be the
reason to come back to the app rather than visit it once.

**Effort:** low. It's local storage and a checkbox, with an export so people
don't lose it. It needs no pipeline work and no new data. The only real design
question is whether it stays private-by-default (it should).

## 7. The last day

**★★★☆☆ · Medium**

Every fan's most-asked question is about the end. Right now the Maastrichtian is
just the rightmost stage — the app steps into it exactly like it steps into the
Bathonian, and then the data simply stops.

**What I want:** a proper end-of-the-Cretaceous view. Chicxulub marked on the
map at the right place. The last known occurrences highlighted. Some sense of
the world in those final hundred thousand years. And — this is the part that
suits this project specifically — an honest statement that the atlas **cannot**
tell you which animal was the last one, because the resolution isn't there and
the "three-metre gap" is a genuine argument among people who do this for a
living.

An app this careful about uncertainty is the right one to tell that story
properly, without the documentary voiceover.

**Effort:** medium. Mostly editorial and design work rather than pipeline work —
the occurrences are already there, the impact context is new content.

## 8. Where can I go see one?

**★★★☆☆ · High**

I look at a *Triceratops* dot in Wyoming and my actual next thought is: **where
is that skull now, and can I go stand next to it?** That's the question that
turns an afternoon on a website into a trip.

**What I want:** a museum layer — which institution holds the specimens from a
site, and for the famous animals, where the mounted skeletons are. "You can see
this one in London."

**Effort:** high, and I want to be honest about why: it's the only thing on this
list that needs data the snapshot doesn't have. PBDB does carry repository
information for many collections, so it's a pipeline addition rather than a new
source — but it's patchy, museum names are messy, and mounted casts versus real
specimens is a genuine can of worms. Worth doing eventually; not the place to
start.

## 9. The family reunion

**★★★☆☆ · Low–Medium**

The taxonomy in the app is a breadcrumb — a line of italic names with chevrons.
Correct, and completely unmoving. But **all 2,555 taxa have a silhouette**, and
silhouettes are the most legible thing in the whole product.

**What I want:** the family tree drawn *with the animals in it*. Pick
*Velociraptor*, see its cousins arranged around it as silhouettes, scaled to
their actual sizes, so the family resemblance and the size range hit you at
once. Click a cousin, go there. Zoom out to the whole clade and it becomes a
poster.

The relationships and the artwork both already ship. They've just never been put
in the same picture.

**Effort:** low to medium — a layout problem more than a data problem. Genuine
sizes only exist for the curated set, so relative scaling would start
approximate.

## 10. Dinosaur of the day

**★★☆☆☆ · Low**

There are 2,123 genera in here and I will realistically click about thirty of
them. A **surprise me** button, and a dinosaur of the day on the loading screen,
would send me somewhere I'd never have gone — into the weird obscure ones, which
are half the fun.

**Effort:** low, verging on trivial. It's the sort of thing that costs an
afternoon and gets remembered.

---

## If I had to pick three

**#1 (tracks and eggs)**, **#2 (discovery-year playback)**, **#3 (polar
dinosaurs)**.

All three share a property that makes them worth doing first: **the data is
already in the snapshot and is currently being thrown away.** No new sources, no
new fetching, no licensing questions. The atlas already knows which fossils are
footprints, what year each one was published, and which ones lived inside the
Arctic Circle — it just doesn't tell anyone. Each of those is a new way of
seeing the same 40,508 dots.

And #2 in particular is something no other dinosaur site does at all.
