---
doc_type: report
title: Rethinking the taxon page — data pipeline, content, and design
status: For review (pre-spec)
owner: nelsonjeanrenaud@gmail.com
author: agent
date: 2026-07-25
---

# Rethinking the taxon page: pipeline, content, and design

> This is a **discussion report**, not a spec. It proposes a direction for owner
> review. Once we agree, it becomes one or more specifications. Nothing here is a
> requirement yet.

## TL;DR — the recommendation

The taxon page underwhelms because **the data behind it is thin and generic**, not
because the layout is wrong. Three fixes, in order of impact:

1. **Change where content comes from.** Stop leaning on PBDB ecospace tags and
   Wikipedia's "first image on the page". Instead build a **build-time
   enrichment step that reads the full Wikipedia article per genus and uses an
   LLM to extract a small, tagged, structured record** (size, diet, when/where,
   discovery, etymology, a plain-language blurb, a few notable facts). Cache it
   into the dated snapshot so runtime stays offline and deterministic. This is
   the single biggest lever and it is exactly the idea you floated.
2. **Fix images at the source.** Use **Wikidata `P18`** (the curated
   representative image) as the primary photo, and **PhyloPic** silhouettes
   (per-taxon, with automatic fallback to the nearest relative) as a
   near-universal, good-looking base visual. Drop Wikipedia REST `pageimage` as
   the primary source.
3. **Redesign the page around what people actually care about** — a big
   silhouette **size-vs-human** hero, a scannable fact row, a readable "what was
   it" paragraph — and **collapse the giant occurrences list by default**.

Because this is a personal project and you've waived the licensing constraint, we
can relax the strict provenance charter (it currently blocks any image without a
licence+credit and forbids "interpretative" content). I'd keep a *light* "source"
line for trust, but otherwise stop letting provenance purity starve the page.

---

## 1. Where we are (evidence from the shipped snapshot)

Measured over the **2123 genera** in the current `reference.json`:

| Field | Coverage | Verdict |
| --- | --- | --- |
| Bundled image | **798 / 2123 (38%)** | Low, and the 38% are often the *wrong* image (see below) |
| Body length / mass | **0 / 2123 (0%)** | The size scale never renders — size isn't pulled at all |
| Common name | **44 / 2123 (2%)** | Effectively absent |
| Wikipedia summary | 1692 (80%) | Present but raw — jargon-heavy lead paragraphs |
| Diet | 1988 (94%) | **Useful** (Herbivore/Carnivore/Omnivore/Piscivore) |
| Locomotion | 2123 (100%) | **Noise** — 99.9% "Actively mobile" |
| Habitat | 2123 (100%) | **Noise** — 97% "Terrestrial" |

Two root causes:

- **Images come from the wrong endpoint.** The pipeline uses the Wikipedia REST
  `pageimage`, which is "whatever file the page happens to surface first." For a
  well-known genus that's a nice mount; for an obscure one it's a bone fragment,
  a stratigraphic column, or a locality map — or nothing. That's why coverage is
  38% *and* quality is uneven.
- **Biology is PBDB ecospace, which is coarse by design.** Diet is genuinely
  useful; Locomotion and Habitat are near-constant across all dinosaurs and add
  nothing. Size — the single most requested fact — is not pulled at all
  (`http-client.ts` comments it out: "PBDB specimen measurements are sparse").

So the page is: a possibly-wrong image (or a generic silhouette), a raw Wikipedia
paragraph, two meaningless tags, one useful tag (diet), no size, and then a
**very long occurrences list** that dominates everything.

---

## 2. What the taxon page should be

### 2.1 Content model (what we want to *know* about a genus)

Target a compact, high-signal record. Everything nullable and sourced.

| Group | Field | Primary source (proposed) |
| --- | --- | --- |
| Identity | Scientific name, rank, validity | PBDB (have it) |
| Identity | Common name / "also known as" | LLM from article / Wikidata |
| Identity | Pronunciation + **meaning of the name** | LLM from article (etymology) |
| Signature | **Body length** (and mass when stated) | **LLM from article** |
| Signature | **Silhouette** (for size scale + hero) | **PhyloPic** (near-universal) |
| Signature | Representative **photo** (mount / reconstruction) | **Wikidata P18** → Commons |
| Ecology | Diet | PBDB ecospace (keep) |
| Ecology | 1-line "what it was" (e.g. "a giant titanosaur sauropod") | LLM |
| Time | Age range (Ma) + period(s) | PBDB occurrences (have it) |
| Place | Regions / formations, modern + paleo | PBDB occurrences (have it) |
| Story | Plain-language description (2–4 sentences) | **LLM-rewritten** from article |
| Story | Discovery: year, who, where | LLM from article |
| Story | 2–4 **notable facts** (tagged bullets) | LLM from article |
| Evidence | Occurrences (collapsed) | PBDB (have it) |

Drop from the page: Locomotion and Habitat as standalone tags (fold anything real
into the description instead).

### 2.2 Design direction

The page should read top-to-bottom as **"what did it look like, how big, when/where,
what's the story"** — with evidence tucked underneath.

```
┌───────────────────────────────────────────────┐
│ ← Back to map                                   │
│ Tyrannosaurus            Genus · valid          │
│ “tyrant lizard”  ·  T. rex        (etymology)   │
├───────────────────────────────────────────────┤
│  HERO: size-vs-human silhouette                 │
│   ▟▓▓▓▓▓▓▓▓  ~12 m long        [photo thumb]     │
│   ┃ (1.7 m human to scale)                       │
├───────────────────────────────────────────────┤
│  FACT ROW (chips):                              │
│   12 m · ~8 t · Carnivore · 68–66 Ma · Laramidia│
├───────────────────────────────────────────────┤
│  WHAT IT WAS  (2–4 plain sentences, LLM)        │
├───────────────────────────────────────────────┤
│  ▸ Discovery & naming        (collapsed)        │
│  ▸ Notable facts             (collapsed)        │
│  ▸ Fossil occurrences (128)  (collapsed) ← key  │
├───────────────────────────────────────────────┤
│  Source: PBDB + Wikipedia (AI-assisted), 2026-… │
└───────────────────────────────────────────────┘
```

Design principles, consistent with the existing charter's restraint and light
cartographic palette:

- **Size is the hero.** Because size is the #1 curiosity and PhyloPic gives us a
  silhouette for almost every genus, the **silhouette-scaled-to-a-human** becomes
  the signature visual — it always works, even when no photo exists, and it's
  distinctive. The photo (when we have a good one) sits beside/below it.
- **Scannable first, deep on demand.** A chip row of hard facts up top; prose
  kept short; everything long (discovery, notable facts, **occurrences**) is
  collapsed by default (your explicit ask).
- **Never an empty page.** Silhouette + size + diet + age are near-universal, so
  every genus has a real, satisfying page even with no photo and no article.
- **Honest but light.** One quiet "source" line instead of per-field provenance
  badges.

---

## 3. Data pipeline rethink

Today: PBDB (taxa/occurrences/ecospace) + Wikidata QID join + Wikipedia REST
summary/pageimage + Commons licence lookup → L1 → derived L2/L3 → dated snapshot.
Keep the **snapshot architecture** (build-time, cached, no runtime egress — it's
a real strength). Change the **sources and the enrichment**.

### 3.1 Images — three tiers, best-first

1. **Wikidata `P18`** (SPARQL by QID) — the *curated* representative image. Much
   higher hit-rate-of-*correct*-images than REST pageimage.
2. **Wikimedia Commons category** (e.g. `Category:Tyrannosaurus`) — pick the best
   candidate when P18 is missing (optionally LLM-ranked: "which of these depicts
   the living animal / a mount, not a map or a bone?").
3. **PhyloPic** silhouette — near-universal base visual, with the API's
   **phylogenetic fallback** (no exact genus → nearest relative silhouette).
   CC0/CC-BY; licensing is no longer a blocker.

Net effect: **every** genus gets a clean silhouette (tier 3), and a *good* photo
whenever tiers 1–2 have one — instead of 38% often-wrong photos.

### 3.2 Rich content — the LLM enrichment layer (the big idea)

A new **build-time step**: for each genus, fetch the **full Wikipedia article**
(wikitext or the plain-text extract, not just the lead), and run an LLM with a
strict **extraction** prompt that returns a typed JSON record:

```jsonc
{
  "commonName": "T. rex",
  "namePronunciation": "tie-RAN-oh-SAWR-us",
  "nameMeaning": "tyrant lizard",
  "lengthMeters": { "value": 12.3, "low": 11, "high": 13 },
  "massTonnes": { "value": 8.4, "low": 6, "high": 9 },
  "oneLiner": "a giant carnivorous theropod of Late Cretaceous North America",
  "description": "2–4 plain-language sentences…",
  "discovery": { "year": 1905, "namedBy": "Osborn", "place": "…" },
  "notableFacts": ["…", "…"],
  "confidence": { "length": "stated", "mass": "estimated" }
}
```

Why this fits the project:

- **Architecture-compatible.** It's an **L3 editorial layer**, produced at build
  and **cached per taxon keyed by the article revision id**, so the snapshot
  stays deterministic (NFR-001/002) and runtime stays offline (DATA-005). Re-runs
  only re-hit the LLM for changed articles.
- **Gets what APIs can't** — size, etymology, discovery, a *readable* blurb, and
  tagged facts, all from prose no structured source exposes.
- **Controllable hallucination.** The prompt is **extract-don't-invent**: every
  field must be grounded in the article or returned `null`, with a `confidence`
  tag (`stated` vs `estimated`), and the record cites the source revision. We
  spot-check a sample. This is honest enough for a personal project and far
  better than today's blanks.

Cost/scale: ~2100 genera × one modest call each = a **one-time enrichment** on the
order of a few dollars to low-tens of dollars depending on model, then incremental.
Fully cached in the repo snapshot; no per-user cost, no runtime calls.

Open sub-question: **wikitext vs. HTML vs. plain-text extract** as LLM input, and
whether to also pull the **infobox** (often has clean length/mass/temporal fields)
as a structured pre-pass before the LLM.

### 3.3 Keep / drop from PBDB

- **Keep:** taxonomy, validity/opinions, occurrences (time + modern/paleo
  coordinates), **Diet** ecospace.
- **Drop from the page:** Locomotion, Habitat (noise). Still ingest if cheap, but
  don't surface them as tags.
- **Occurrences:** keep all, but the page shows a **collapsed summary** ("128
  occurrences across 22 formations, 74–66 Ma — expand") and only expands on
  demand. This is also lighter to render.

### 3.4 Alternative/■supplementary size sources (considered, not preferred)

Community datasets exist (e.g. a "DinoAPI", assorted GitHub dinosaur datasets,
and academic femur-length/mass tables), but they are **partial, inconsistently
sourced, and licensed unclearly**. The LLM-from-Wikipedia path gives broader,
more uniform coverage with a traceable per-article source, so I'd treat external
datasets only as an optional cross-check, not the primary path.

---

## 4. Provenance & charter implications

The current charter (and SPEC-001/003/007) make provenance *first-class*: images
need licence+credit or are hidden (DATA-007), and "interpretative" content was
even removed (SPEC-007). This rethink deliberately **softens** that:

- Show images regardless of licence (personal project); keep a small credit line
  where we have one.
- Introduce **AI-assisted** content, labelled once as such ("Compiled from PBDB +
  Wikipedia, AI-assisted") rather than per-field badges.

This is a real change of product philosophy and should be recorded as a **charter
amendment** when we spec it — not slipped in silently. I recommend keeping the
*one-line* source disclosure (cheap trust) while dropping the heavy per-field
provenance machinery.

---

## 5. Proposed phasing (for the eventual spec(s))

- **Phase A — Images done right.** Wikidata P18 + PhyloPic silhouettes; re-bundle.
  Immediately lifts every page (universal good silhouette + better photos). Low
  risk, no LLM.
- **Phase B — LLM enrichment.** The extraction step + cache + new L3 fields
  (size, etymology, discovery, blurb, notable facts). The big content win.
- **Phase C — Page redesign.** Size-vs-human hero, fact chips, collapsed
  occurrences, collapsed deep-dives, single source line.
- **Phase D — Charter amendment** recorded alongside.

Phase A and C are independently shippable; B is the centerpiece and can land
between them.

---

## 6. Open questions for you

1. **LLM enrichment: yes in principle?** It's the core of this proposal. Any
   constraints (model, budget ceiling, must-be-reproducible-offline — already
   handled by caching)?
2. **Images:** OK to drop Wikipedia pageimage for **Wikidata P18 + PhyloPic**?
   Do you want the **silhouette size-comparison as the hero** (my recommendation),
   with the photo secondary?
3. **Provenance:** confirm we soften to a single "source" line and allow
   unlicensed images + AI content (recorded as a charter amendment)?
4. **Scope of the first spec:** one big spec, or split A/B/C so images ship first?
5. **Any fields you want that I didn't list** (e.g. taxonomy tree, related
   genera, "if it were alive today" flavor, pronunciation audio)?

---

## Appendix — what stays good (don't throw away)

- The **dated-snapshot, no-runtime-egress** architecture — reuse it for the LLM
  cache and bundled images.
- **PBDB occurrences** with modern + paleo coordinates and the **map/timeline**
  loop — still the heart of the app.
- **Diet** ecospace and **taxonomy/validity** — solid, keep.
- The **silhouette-fallback** idea from SPEC-012 — extend it from 7 generic
  clades to per-taxon PhyloPic.
