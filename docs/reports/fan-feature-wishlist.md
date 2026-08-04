---
doc_type: report
title: Feature wishlist from a dinosaur fan — ranked by interest and effort
status: For review (pre-spec)
owner: nelsonjeanrenaud@gmail.com
author: agent
date: 2026-08-04
---

# What I'd love next, as a dinosaur fan using the atlas

> This is a **discussion report**, not a spec. It records wishes and impressions
> from using the running app. Nothing here is a requirement. Anything adopted
> becomes a specification first, per `CLAUDE.md`. Where an existing `FONC-*` /
> `PERF-*` id already covers a wish, it is cited so the wish can be traced back
> to the functional specification rather than inventing a parallel requirement.

## How I looked

I installed the app (`pnpm install`), ran `pnpm run dev`, and used it in a
browser at desktop (1440×900) and phone (390×844) sizes: stepped the timeline,
clicked occurrences, tried all three grouping modes, searched for taxa, and
opened taxon pages. I then checked the shipped data under `public/data/` to see
which wishes are already paid for by data on disk and which need new pipeline
work. Coverage numbers below are counted from `reference.json` and
`enrichment.json` as shipped.

**First impression: this is already good.** The paleogeographic map with clade
silhouettes, the stage timeline coloured by period, the honest "reconstruction"
labelling, and a source line on every single dot — that combination is genuinely
better than the dinosaur sites I use. The wishes below are about depth, not
repair.

## The ranking

Ordered by **how much I want it**. Effort is my read of the code and data, not a
commitment.

| # | What I want | Interest | Effort | Why the effort is what it is |
|---|-------------|----------|--------|------------------------------|
| 1 | Give me the atlas's own taxon page back (not a Wikipedia frame) | ★★★★★ | **Low** | The components and the data already exist and ship — they're just not rendered |
| 2 | Show one animal's whole life: every occurrence across its full time range | ★★★★★ | Medium | Needs a per-taxon cross-stage index at build time |
| 3 | A play button for the Mesozoic | ★★★★★ | Medium | Stage stepping + basemap frames exist; needs sequencing and prefetch |
| 4 | "Who lived alongside it?" — the cast list of a site | ★★★★☆ | Low–Med | `collectionId` already groups occurrences; locality grouping exists |
| 5 | Formations as real things (Hell Creek, Morrison, Djadochta) | ★★★★☆ | Low–Med | `formation` and `member` are on every occurrence and shown nowhere |
| 6 | Filters that match how fans think: clade, diet, size, region | ★★★★☆ | Low–Med | Diet on 92% of profiles; clade legend already exists but isn't clickable |
| 7 | A list that tells entries apart, and puts famous animals first | ★★★★☆ | **Low** | Pure presentation over data already in hand |
| 8 | Shareable links | ★★★★☆ | Low–Med | Currently no URL state at all; needs a new spec |
| 9 | "Fossils near me" — the modern-world lens | ★★★☆☆ | Medium | Region is on every occurrence; modern coastline layer is new |
| 10 | Common names and pronunciation ("say Deinonychus") | ★★★☆☆ | Low–Med | Present for the curated 77; broader data is thin and partly malformed |
| 11 | More than 77 curated dinosaurs | ★★★☆☆ | Med–High | Pipeline exists; cost and validation are the real work |
| 12 | Pterosaurs and marine reptiles | ★★★☆☆ | High | Deliberate scope decision, not an oversight — see the note |
| 13 | Compare two dinosaurs side by side | ★★★☆☆ | Medium | Size hero exists; needs a comparison surface |
| 14 | Use it on my phone | ★★★☆☆ | High | Unusable today; already deferred to V2 |
| 15 | Guided tours ("Great theropods", "Life in the Morrison") | ★★☆☆☆ | High | Needs curation, not just code |

**If you only do three:** #1, #7, and #4. They are the cheapest things on the
list and they change how the app feels more than anything else here.

---

## 1. Give me the atlas's own taxon page back

**Interest: ★★★★★ · Effort: Low**

I click "Open taxon profile →" on *Triceratops* and I leave the atlas: the page
is an embedded Wikipedia article in an `<iframe>` (`TaxonProfile.tsx`), under a
breadcrumb. In my session the frame rendered **completely blank** — a white box
under the breadcrumb, no content at all. Even when it does load, I've stopped
using a dinosaur atlas and started reading Wikipedia in a small box; nothing on
that page knows I'd just been looking at the Maastrichtian.

What makes this the top of my list is what I found in the shipped data:

- **77 genera carry a full curated record** in `enrichment.json` — body length,
  mass, diet, era, discovery (who/where), name meaning, a plain-language
  one-liner, and tagged "notable facts". Those 77 are exactly the ones people
  come for: *Tyrannosaurus, Triceratops, Velociraptor, Stegosaurus,
  Brachiosaurus, Spinosaurus, Diplodocus, Allosaurus, Ankylosaurus,
  Parasaurolophus*, Archaeopteryx, Deinonychus, Carnotaurus, Baryonyx…
- **1,358 profiles carry image galleries** (78 MB of images ship in
  `public/data/images/`), and **all 2,555 carry a PhyloPic silhouette**.
- The runtime **already merges enrichment onto profiles** at boot
  (`atlas.ts` → `mergeEnrichment`).
- The components that render all of this — `SizeHero` (the size-vs-human
  silhouette), `TaxonSpecTable`, `TaxonEnrichment`, `Illustration` — **still
  exist in the codebase but are referenced by nothing**. SPEC-014 AMEND-005
  replaced the page with the iframe and left them behind.

So the atlas has a size-vs-human hero, a fact row, a photo gallery and a facts
list for the exact animals I care about, and shows me none of it.

**What I want:** the atlas's own page first — size hero, the length/height/
weight/diet/era row, the blurb, the notable facts, the gallery, the taxonomy
tree — and *then*, below it, a "Read the full article on Wikipedia" link (or the
embed, if you like it). Wikipedia as the deep end, not the front door.

**Effort:** low. This is mostly re-wiring existing components to data already in
memory, plus deciding the layout order. The interesting question is what the
2,478 genera *without* an enrichment record get — presumably silhouette +
taxonomy + occurrences + the Wikipedia link, which is still better than a blank
frame.

Traces to FONC-510…FONC-590 (profile contents), FONC-600…FONC-640
(diet/locomotion/size), FONC-1190…FONC-1230 (images, typed and credited).
Would need a SPEC-014 amendment, since AMEND-005 deliberately removed it.

## 2. Show me one animal's whole life

**Interest: ★★★★★ · Effort: Medium**

I searched *Triceratops*. The app did something lovely — it jumped the timeline
into its range, highlighted 83.6–66 Ma on the timeline, and lit up its dots.
Then I noticed the panel said "occurrences in view: 165" while the range said
83.6–66 Ma, and realised **I'm only ever seeing one stage of its life.** The
other stages of its existence are behind a slider I have to remember to move.

**What I want:** on a taxon, one action for "show me everywhere this animal has
ever been found", with its dots across the whole range on the map at once, and
its first and last appearance called out ("known from 83.6 to 66 Ma — it was
there at the very end"). That last-appearance framing is, for a fan, the single
most emotionally loaded fact in the dataset.

**Effort:** medium — and this is the one place where the architecture pushes
back. Occurrences are **partitioned per stage** (SPEC-008) and fetched one stage
at a time; there is no per-taxon index across stages, so "all Triceratops
everywhere" currently means fetching many stage files. The clean fix is a small
per-taxon occurrence index built at snapshot time. Worth it — this is the
question I most want to ask the atlas.

Traces to FONC-1370/FONC-1380 (per-taxon timeline, first/last appearance) [V1]
and FONC-560/FONC-570.

## 3. A play button for the Mesozoic

**Interest: ★★★★★ · Effort: Medium**

Right now I step stages one at a time and each step is a small separate act.
What I want is to press **play** and watch 186 million years go by: Pangaea
splitting, the Atlantic opening, dots blooming and vanishing across the
continents, the period colour sliding from purple through blue to green.

That is the thing I would show someone to explain why this app exists. Every
ingredient is already here — per-stage basemap frames, per-stage occurrence
files, a timeline that already steps.

**Effort:** medium, and honest about why: the stage files are large (Campanian
is 6.3 MB, Maastrichtian 3.5 MB), so a naive play button would stutter badly. It
needs prefetching of upcoming stages and a decision about whether the coastline
crossfades or cuts. A "cut, don't tween" first version would be much cheaper and
still thrilling.

Traces to FONC-330 (animated age-to-age transition) [V2].

## 4. Who lived alongside it?

**Interest: ★★★★☆ · Effort: Low–Medium**

When I click a *Tyrannosaurus* dot I learn its coordinates, its range, and its
citation. What I actually want to know next is: **what else was found right
there?** Who was it hunting, who was it competing with, what was underfoot. The
"cast list" of a site is one of the great pleasures of palaeontology and it's
sitting in the data — every occurrence carries a `collectionId`, and the app
already groups by locality in Localities mode.

**What I want:** on an occurrence and on a locality, a "found alongside" list —
the other taxa from the same collection, with their silhouettes — each one
clickable. And on a taxon, "most often found with…" across its collections.

**Effort:** low to medium. The grouping primitives exist (`groupByLocality`); this
is a new panel section plus a derivation, and it needs care about honesty —
"found in the same collection" is not "hunted", and the charter's caution rules
(no unsourced predator-prey claims) apply.

Traces to FONC-650/FONC-660 (related and co-occurring taxa) [V1], with CONS-270
constraining how it may be worded.

## 5. Formations as real things

**Interest: ★★★★☆ · Effort: Low–Medium**

Fans don't think "collection 126538". We think **Hell Creek**, **Morrison**,
**Djadochta**, **Ischigualasto**. These are the settings the stories happen in.

Every occurrence in the shipped data already carries `formation` (and `member`)
— the first record I inspected is from the Yongping Formation — and **the
formation name appears nowhere in the interface.** That's a lot of narrative
sitting one line of markup away.

**What I want, cheapest first:** the formation name in the occurrence panel and
in the list; then filter by formation; then a formation view — its taxa, its
age, where it is now versus where it was.

**Effort:** low for display and filtering, medium for a formation view of its
own. Traces to FONC-940…FONC-980 [V1].

## 6. Filters that match how fans think

**Interest: ★★★★☆ · Effort: Low–Medium**

The map legend lists seven clades — Theropod, Sauropod, Ornithopod,
Thyreophoran, Ceratopsian, Pachycephalosaur, Dinosaur — with lovely silhouettes,
and **none of them are clickable**. My instinct within about five seconds was to
click "Theropod" to see only the predators. Nothing happened.

The wishes, in order of how often I wanted them:

- **Clade** — "just the theropods". The legend is already the perfect control
  surface for it.
- **Diet** — carnivore / herbivore / omnivore. Already on **2,358 of 2,555
  profiles (92%)**: 1,278 herbivores, 1,009 carnivores, 57 omnivores, 12
  piscivores.
- **Size** — "only the giants". Available for the curated 77 today.
- **Region** — "show me Africa".

**Effort:** low to medium. Diet and clade need no new data at all, just filter
state and UI; size is limited by enrichment coverage (see #11). Traces to
FONC-810…FONC-840 [V1] and FONC-320 [V1].

## 7. A list that tells entries apart, and puts famous animals first

**Interest: ★★★★☆ · Effort: Low**

Two small things that made the side panel much less useful than it should be:

**Everything looks identical.** In the Maastrichtian the list reads
"Alamosaurus 72.2–66 Ma / Alamosaurus 72.2–66 Ma / Alamosaurus 72.2–66 Ma /
… Triceratops 72.2–66 Ma / Triceratops 72.2–66 Ma". Three identical rows that
are actually three different places. The differentiator I want is exactly the
one being withheld — **where**: the region or the formation, both already on
every occurrence.

**Alphabetical order buries the stars.** In Taxa mode the list opens
*Abditosaurus, Acheroraptor, Adynomosaurus, Ageroolithus, Ajnabia,
Alamosaurus…*. *Tyrannosaurus* is far below the fold in a stage it defines. The
search box already ranks by a notability score (`contentLevel`) — the same
signal would sort the list, or offer "sort by: name / most fossils / best
known".

While I'm here, three cosmetic things I noticed: the source citation in the
occurrence panel wraps to roughly one word per line in that narrow column; the
clade legend overlaps the "clusters count fossil records" note in the bottom-left
corner; and the list caps at "showing the first 300 of 1263" without offering a
way to page through the rest.

**Effort:** low. All presentation over data already in hand. Relevant to
PERF-080…PERF-120 (readability and map density).

## 8. Shareable links

**Interest: ★★★★☆ · Effort: Low–Medium**

I wanted to send someone "look at the Maastrichtian with Triceratops selected"
and found I couldn't: **the app keeps no state in the URL at all** (no history,
no query params — I checked). Reloading drops me back to the default view, the
browser back button doesn't undo my last step, and there's no way to bookmark a
moment.

For a fan this is the sharing feature. Half of enjoying dinosaurs is showing
someone else.

**What I want:** age, mode, selection, and map position in the URL, so a link
reopens exactly what I was looking at. A social preview image would be a nice
follow-on — an `og-image.png` already exists.

**Effort:** low to medium, and it touches the exploration reducer broadly, so it
wants a spec of its own. No existing `FONC-*` covers it, which is itself worth
flagging: this is a genuine gap in the functional specification, not just in the
build.

## 9. "Fossils near me" — the modern-world lens

**Interest: ★★★☆☆ · Effort: Medium**

Every occurrence carries a modern location with a human-readable region ("New
Mexico, US"). Two wishes follow from that: let me **filter by modern place** —
country, state, "what was found in France?" — and give me a **toggle to see
modern coastlines** under or beside the reconstruction, so I can orient myself.
The paleomap is beautiful but I genuinely lose track of which continent I'm
looking at around the Triassic.

**Effort:** medium. The region filter is cheap (data is there); the modern
comparison layer is a new basemap layer. Traces to FONC-310 (present-day
comparison layer) [V1] and FONC-820 [V1].

## 10. Common names and pronunciation

**Interest: ★★★☆☆ · Effort: Low–Medium**

I typed "T. rex" into the search box out of habit. It finds nothing — search
matches scientific and common names, and **only 62 of 2,555 profiles have a
common name at all**. Worse, the ones that exist are inconsistent and some are
malformed — I found entries like `Austrosaurus {"southern lizard")` with a
broken bracket, and a mix of etymologies, group names and actual common names in
the same field.

The curated 77 records carry a `pronunciation` field (and a `nameMeaning`), so
"how do I say Deinonychus" is answerable for exactly the animals people ask
about — it's just not surfaced.

**What I want:** "T. rex" finds *Tyrannosaurus*; names show their meaning and
pronunciation on the taxon page; the malformed common-name strings get cleaned
up or dropped.

**Effort:** low for the 77 (data exists, needs display); medium for search
aliases and a data clean-up pass. Traces to FONC-770 (common-name search) [V1].

## 11. More than 77 curated dinosaurs

**Interest: ★★★☆☆ · Effort: Medium–High**

The curated set covers the famous ones well, but it's **77 records against 2,123
genera**. The moment I go one step off the beaten path — the Maastrichtian list
alone has 141 taxa in view — I'm back to a name and a date. There's a real cliff
between "Tyrannosaurus" and "Adynomosaurus".

**What I want:** the next few hundred genera enriched, prioritised by how often
they actually appear in the data (occurrence count) rather than alphabetically.

**Effort:** medium to high, but the machinery is built — `enrich:fetch`,
`enrich:batch`, `validate:enrichment` and a budget check all exist. The work is
API cost, batch runtime, and validating what comes back. Relates to PERF-200/210
(≥50 detailed profiles, ≥10 featured species) [V1] — already met, so this is
about raising the bar.

## 12. Pterosaurs and marine reptiles

**Interest: ★★★☆☆ · Effort: High**

As a fan I have to ask, because everyone asks: **where are the pterosaurs, the
mosasaurs, the plesiosaurs?** A Maastrichtian sea with no mosasaur in it feels
empty.

I want to be fair to the project here: this is **a deliberate decision, not an
oversight**. The docs are explicit — the MVP ships non-avian dinosaurs only
(OQ-050), secondary reptile groups are V1, and the header on screen already says
"not a complete atlas of Mesozoic life". The scoping is honest and it's part of
what makes the app trustworthy.

So take this as a fan's vote rather than a gap report: when V1 comes, this is
the content I'd want. **Effort: high** — a new PBDB subset, a substantially
larger dataset, and the main/secondary labelling that currently passes
vacuously would have to start doing real work. Traces to FONC-380/FONC-390 [V1].

## 13. Compare two dinosaurs side by side

**Interest: ★★★☆☆ · Effort: Medium**

"Was Spinosaurus really bigger than T. rex?" is the question I get asked most by
other people, and I'd love to answer it in the app: pick two, see them
silhouetted against each other and a human, with lengths and masses side by
side.

The `SizeHero` component already draws a taxon against a human figure, and the
enrichment records carry length, height and mass with explicit
`confidence: "estimated"` flags — which is exactly the honesty this comparison
needs, because these numbers are contested.

**Effort:** medium — a new comparison surface plus a taxon picker; limited to
the 77 enriched genera until #11 lands. Traces to FONC-1250 (human size
reference) [V2] and FONC-1360 (group comparison) [V2].

## 14. Use it on my phone

**Interest: ★★★☆☆ · Effort: High**

I opened the app at phone size and it isn't usable: the header and controls run
off the right edge, the period buttons are clipped mid-word ("Triass", "Jurassi"),
the map is squeezed into a narrow strip with the clade legend covering most of
it, and the side panel sits alongside the map instead of below it.

Again, this is **already a known deferral** — desktop and tablet are the stated
targets (CONS-500), phones are V2 (CONS-510) — so it's not a defect. But it's
where I'd actually use this: on the sofa, on a train, showing someone a dinosaur.

**Effort:** high. A phone layout means rethinking the map/panel relationship,
not just adding media queries.

## 15. Guided tours

**Interest: ★★☆☆☆ · Effort: High**

Lowest on my list, though I'd enjoy it: curated paths — "The great theropods",
"Life in the Morrison Formation", "The last million years of the Cretaceous" —
that walk the map and timeline for me. It's the thing I'd hand to someone who
doesn't know where to start.

I put it last deliberately: it needs **writing**, not just building, and it only
pays off once the taxon pages (#1) and the assemblage view (#4) give it
somewhere to walk to. Traces to FONC-1400…FONC-1430 [V2].

---

## Things I checked that are already right

Worth recording so they don't get "fixed":

- **Every occurrence has a real citation.** I clicked several at random and each
  gave a full bibliographic source. That's rarer than it should be.
- **The reconstruction is labelled as a reconstruction**, and modern versus
  paleo coordinates are shown as separate, distinctly labelled fields.
- **Clusters say what they count.** The note "clusters count fossil records at a
  location (density), not distinct taxa" pre-empts exactly the misreading I was
  about to make.
- **The Wikipedia gate is a good default.** Hiding the 2,929 article-less
  occurrences behind a labelled toggle keeps the map readable without hiding
  that they exist.
- **Search behaviour is thoughtful** — landing on a taxon moves the age into its
  range and highlights its span on the timeline rather than dumping me on a
  profile page.
- **Period stepping is smart:** "periods jump to their most fossil-rich stage"
  means clicking "Jurassic" lands somewhere interesting instead of somewhere
  empty.

## Suggested order of work

Grouped by value-per-unit-effort rather than raw interest:

1. **Now, cheap, high impact:** #1 (taxon page — unhide what already ships),
   #7 (list legibility and ordering), #5 first half (show formation names).
2. **Next, the depth features:** #4 (found alongside), #6 (clade and diet
   filters), #8 (shareable links), #2 (whole-life view).
3. **Then, the showpieces:** #3 (play the Mesozoic), #9 (modern lens),
   #13 (size comparison).
4. **Bigger commitments, need product decisions:** #11 (more enrichment),
   #12 (secondary groups), #14 (phone), #15 (tours).

## Note for the maintainer

Two pieces of documentation drift turned up while I was orienting, unrelated to
the wishlist but worth a `/drift-check`:

- `README.md` still says "No application code exists yet — the first commit set
  up the workflow, not a product", and that the project stack is "not yet
  defined". There are 16 specs and a working app.
- `docs/SPEC_INDEX.md` stops at SPEC-009 and lists SPEC-006/007/008 as "In
  Implementation". SPEC-010 through SPEC-016 are missing from the table
  entirely.
