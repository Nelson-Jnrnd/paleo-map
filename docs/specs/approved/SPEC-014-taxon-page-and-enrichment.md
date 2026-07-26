---
doc_type: spec
spec_id: SPEC-014
title: Taxon page & data pipeline redesign — LLM enrichment, multi-image gallery, size hero, taxonomy tree
status: In Implementation
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, taxon-profile, read-model, domain, pipeline, ingestion, http-client, web-data-generator, enrichment, styling, assets, budget, governance-charter]
affected_interfaces: [ReadProfile, ReadImage, ReadTaxon, ImageAsset, EditorialSummary, reference-artifact, enrichment-cache]
supersedes: []
superseded_by:
depends_on: [SPEC-001, SPEC-003, SPEC-007, SPEC-010, SPEC-012]
conflicts_with: []
last_verified_at: 2026-07-25
---

# SPEC-014: Taxon page & data pipeline redesign

> Derived from and supersedes the direction in
> `docs/reports/taxon-page-and-data-rethink.md`, as amended by owner answers on
> 2026-07-25 (LLM enrichment approved; multiple images per page; all content
> allowed; one combined spec; required fields = taxonomy tree, diet, length,
> height, weight, era). This is the single spec for the full redesign.

## Summary

The taxon page underdelivers because its **data is thin and generic**, not
because the layout is wrong (evidence in §1). This spec rebuilds both the **data
pipeline** and the **page**:

1. **LLM enrichment layer.** A build-time step reads each genus's **full
   Wikipedia article** and uses the **Claude API (Messages + structured outputs,
   run via the Batches API)** to extract a compact, typed, tagged record — size
   (length/height/weight), diet, era, a plain-language blurb, discovery,
   etymology, notable facts — cached into the dated snapshot so runtime stays
   offline and deterministic.
2. **Better images, multiple per page.** Source images from **Wikidata `P18`**
   and the taxon's **Wikimedia Commons category** (a small gallery, not one
   image), with **PhyloPic** silhouettes as a near-universal base visual. Drop
   Wikipedia REST `pageimage` as the primary source.
3. **Redesigned page.** A **size-vs-human silhouette hero**, a scannable fact
   row (length · height · weight · diet · era), a readable blurb, a **taxonomy
   tree**, collapsible deep-dives, and the **occurrences list collapsed by
   default**.
4. **Provenance relaxed.** The owner has waived licensing/provenance constraints
   for this personal project; this spec **amends the charter** accordingly (a
   single light "sources" line replaces per-field provenance machinery).

## Context

Verified from the shipped snapshot + code on 2026-07-25 (see §1 for the numbers).
Reuse — do not replace — the **dated-snapshot, no-runtime-egress** architecture
(SPEC-001): the enrichment and images are produced at build and cached. The
map/timeline exploration loop, PBDB occurrences (modern + paleo coordinates), and
the taxonomy parent chain (`ReadTaxon.parentId`, SPEC-010) all stay and are
reused. SPEC-012 introduced clade silhouettes and a single bundled image; this
spec extends that to a gallery + PhyloPic and adds the enrichment layer.

## Problem statement

Measured over the 2123 genera in the shipped `reference.json`:

| Field | Coverage | Verdict |
| --- | --- | --- |
| Bundled image | 798 / 2123 (38%) | low, and often the wrong file (bone / map) |
| Body length / mass | 0 / 2123 (0%) | size — the #1 fact — is absent |
| Common name | 44 / 2123 (2%) | effectively absent |
| Wikipedia summary | 1692 (80%) | raw, jargon-heavy lead paragraphs |
| Diet | 1988 (94%) | useful (keep) |
| Locomotion | 2123 (100%) | noise (99.9% "Actively mobile") |
| Habitat | 2123 (100%) | noise (97% "Terrestrial") |

Root causes: images come from Wikipedia's "first file on the page" endpoint
(quality-blind), and biology is coarse PBDB ecospace with **no size at all**.

## Goals

- Every genus page shows **size, diet, era, a readable description, a taxonomy
  position, and several images** — the facts people actually want.
- Enrichment is **build-time, cached, deterministic, offline at runtime**.
- Images are **relevant and plural**; every page has at least a good silhouette.
- The page reads top-to-bottom as "what it looked like → how big → when/where →
  the story", with evidence (occurrences) tucked away.

## Non-goals

- No runtime LLM calls and no runtime third-party image egress (all baked into
  the snapshot).
- No change to the map/timeline exploration loop or occurrence data itself.
- No per-species (below genus) pages in this spec.
- No AI-generated *imagery* (LLM is for text extraction only; images are sourced).
- Not a real-time or user-editable wiki.

## Users or actors

The Explorer viewing a taxon page; the build-time enrichment + image pipeline;
the Claude Batches API (build-time only).

## Functional requirements

### REQ-001: LLM enrichment record (content)

- **Statement:** A build-time enrichment step produces, per genus, a typed record
  with (all nullable, `null` when the article doesn't state it): common name;
  name pronunciation + **meaning**; **body length (m)**, **height (m)**, **mass
  (kg/tonnes)** each with an optional low–high range and a `stated|estimated`
  confidence; a **one-line "what it was"**; a **plain-language description**
  (2–4 sentences); **diet** (cross-checked against PBDB); **era/period** context;
  **discovery** (year, who, where); and **2–4 tagged notable facts**.
- **Rationale:** These are the requested fields and the ones no structured API
  exposes (owner list: taxonomy tree, diet, length, height, weight, era — all
  covered here or in REQ-006).
- **Acceptance criteria:** The record type exists in the domain, is populated for
  genera with a Wikipedia article, and every numeric field carries units + an
  optional range + a confidence tag; absent facts are `null`, never invented.
- **Verification method:** unit tests over the extraction schema + a fixture
  article; type checks.
- **Evidence location:** filled at implementation.

### REQ-002: Enrichment engine — pluggable, cached (the cache is the contract)

- **Statement:** Enrichment is defined by a **fixed extraction schema + rules +
  a revision-keyed cache** (`enrichment/<taxonId>.json` carrying the record and
  the source article `revid`). Populating that cache is **engine-agnostic** — the
  build reads the committed cache and never calls an LLM at runtime. Two
  interchangeable engines populate it:
  - **Engine A — agent-authored (default, subscription-covered):** the coding
    agent fetches each article and writes records conforming to the schema,
    in **committable chunks** (highest-value taxa first). No per-token cost.
  - **Engine B — batch script (optional accelerator):** a build-time script
    calls the **Claude Messages API with structured outputs** via the **Batches
    API** to fill the long tail fast, for a small per-token cost.
  Either engine writes the identical cache format; the snapshot build is
  deterministic given the committed cache (NFR-001/002).
- **Rationale:** Owner wants to minimise cost — the agent can populate the cache
  for free; the batch script is an escape hatch for doing all ~2100 at once. The
  cache-as-contract makes the choice reversible and incremental.
- **Acceptance criteria:** A cached record is reused without any LLM call when the
  article `revid` is unchanged; extraction is **extract-don't-invent** (fields
  grounded in the article or `null`); the schema/validator rejects malformed
  records regardless of which engine wrote them; a build from cache needs no
  network or API key.
- **Verification method:** unit tests on the cache key + schema validator + prompt
  rules; a sample of agent-authored and (if used) script-authored records
  validated identically; offline build from cache.
- **Evidence location:** filled at implementation.

### REQ-003: Multi-image gallery per taxon

- **Statement:** Each taxon page shows **multiple images** when available (a small
  gallery, e.g. up to 4–6), sourced from **Wikidata `P18`** (primary) and the
  taxon's **Wikimedia Commons category** (additional candidates), each with a
  type label and a source link. Images are bundled locally at build (SPEC-012
  REQ-002 mechanism, extended to N images) so they serve offline.
- **Rationale:** Owner: "we need more than one image." P18 + Commons category
  give relevant, plural imagery where the old pageimage gave one often-wrong file.
- **Acceptance criteria:** A genus with several Commons images renders a gallery
  of bundled local images (deduped); ordering is deterministic; each image links
  to its Commons source.
- **Verification method:** unit test on the image-selection/dedup; component test
  on the gallery; `check:budget` for bundled images.
- **Evidence location:** filled at implementation.

### REQ-004: PhyloPic silhouette + size-vs-human hero

- **Statement:** Every taxon gets a **PhyloPic silhouette** (per-taxon, with the
  API's phylogenetic fallback to the nearest relative; bundled locally), used as
  the base visual and, scaled to the enriched **body length/height**, as a
  **size-vs-human hero**. When length is unknown the hero degrades to the plain
  silhouette (no invented scale).
- **Rationale:** Size is the #1 curiosity and silhouettes are near-universal, so
  the size comparison is a distinctive visual that always works — even with no
  photo and no article.
- **Acceptance criteria:** Every genus renders a silhouette; a genus with a body
  length renders the human-scaled comparison with the labelled measurement; the
  PhyloPic fallback resolves to the nearest available relative.
- **Verification method:** unit test on the PhyloPic resolve/fallback + scaling;
  component test on the hero (present/absent length).
- **Evidence location:** filled at implementation.

### REQ-005: Redesigned page layout

- **Statement:** The taxon page is laid out as: header (name · meaning · rank ·
  validity) → **size-vs-human hero + image gallery** → **fact row** (length ·
  height · weight · diet · era) → **plain-language blurb** → **taxonomy tree** →
  collapsible **Discovery & naming** and **Notable facts** → collapsible
  **Fossil occurrences (N)** → one light **sources** line. Consistent with the
  charter's restraint and light cartographic palette.
- **Rationale:** Reorders the page around what people care about and hides bulk.
- **Acceptance criteria:** All sections render in this order; the page never looks
  empty (silhouette + facts always present); real states (no image, no size, no
  article, indeterminate taxon) are all designed.
- **Verification method:** component tests per section + state; manual review
  against `docs/mockups/design-guidelines.md`; screenshot.
- **Evidence location:** filled at implementation.

### REQ-006: Taxonomy tree

- **Statement:** The page shows the taxon's **position in the tree** — its lineage
  up the parent chain (e.g. Dinosauria › Saurischia › Theropoda › … › Genus) and,
  where cheap, its immediate children/siblings — built from the existing
  `parentId` links (no new data source). Ancestor names link to those taxa.
- **Rationale:** Explicit owner request; the data already exists in the read model.
- **Acceptance criteria:** The lineage renders from the taxon to the root with
  navigable ancestor links; a taxon with no parent record degrades gracefully.
- **Verification method:** unit test on lineage derivation; component test.
- **Evidence location:** filled at implementation.

### REQ-007: Occurrences collapsed by default

- **Statement:** The occurrences list is **collapsed by default**, shown as a
  summary ("N occurrences across M formations, X–Y Ma — expand"), expanding on
  demand.
- **Rationale:** Explicit owner request ("occurrences is too big for what people
  care about"); also lighter to render.
- **Acceptance criteria:** The list is collapsed on first render; the summary
  shows counts + span; expanding reveals the full list.
- **Verification method:** component test (collapsed → expand).
- **Evidence location:** filled at implementation.

## Non-functional requirements

### NFR-001: Offline, deterministic, within budget

- **Statement:** No runtime egress (DATA-005 preserved); the snapshot build is
  deterministic given the enrichment cache + bundled images (NFR-001/002);
  bundled image weight stays within a defined `check:budget` category; the
  enrichment cache is committed so CI builds need no API key.
- **Acceptance criteria:** `pnpm test` + `build` + `check:budget` green with the
  network blocked to third parties at runtime; a build from cache needs no
  Claude/Wikimedia access.
- **Verification method:** CI + local offline build.
- **Evidence location:** filled at implementation.

### NFR-002: Honest AI content

- **Statement:** Enriched content is grounded in its source article (extract,
  don't invent), carries a `stated|estimated` confidence on numbers, and the page
  discloses "AI-assisted from Wikipedia" once. No fabricated citations.
- **Acceptance criteria:** The extraction prompt forbids invention; a visible
  one-line source/AI disclosure is present; spot-check sample passes.
- **Verification method:** prompt inspection + manual spot-check of a sample.
- **Evidence location:** filled at implementation.

## Security and privacy considerations

### SEC-001: Build-time secrets only

- **Statement:** Engine A (agent-authored) uses no API key at all. If Engine B is
  used, its Claude API key lives **only at build time** and is never shipped to
  the client or committed. Runtime has no keys and no third-party calls.
- **Acceptance criteria:** No API key in committed artifacts or client bundle;
  the enrichment cache contains only content, not credentials.
- **Verification method:** inspection + secret scan.
- **Evidence location:** filled at implementation.

## Data model impact

New/changed (DATA): a domain **enrichment record** on the profile (the REQ-001
fields); `ReadImage`/gallery becomes a list per taxon with the renderable
`imageUrl` (from SPEC-012) plus type/source; a bundled **PhyloPic silhouette**
reference per taxon; a committed **enrichment cache** artifact keyed by article
revision. The taxonomy tree is derived, not stored. PBDB Locomotion/Habitat are
dropped from the page (may stay in L1).

## API impact

`ReadProfile` gains the enrichment record, an image list, and a silhouette
reference. New build-time interfaces: the enrichment schema, the batch client
wrapper, and the enrichment cache format. No runtime API.

## UI or UX impact

### UX-001: The redesigned taxon page

- **Statement:** As REQ-004/005/006/007 — hero size comparison, gallery, fact
  chips, blurb, taxonomy tree, collapsibles, one sources line; light palette,
  teal accent, all states designed.
- **Verification method:** manual review vs design guidelines + screenshot.
- **Evidence location:** filled at implementation.

## Configuration impact

Enrichment model id + batch settings (build-time env/config); a bundled-image
budget category; PhyloPic/Commons request settings; a thumbnail max dimension.

## Error handling

- Missing article → enrichment fields `null`; page still renders (silhouette +
  PBDB facts + taxonomy tree).
- Image download failure → drop that image; silhouette guarantees a visual.
- PhyloPic miss → phylogenetic fallback; ultimate fallback = a generic clade
  silhouette (SPEC-012 assets).
- Batch/API failure at build → build proceeds from cache; missing entries are
  simply un-enriched, logged.

## Edge cases

- Indeterminate/no-genus taxa: no enrichment, no P18 — show silhouette + taxonomy
  position + occurrences.
- Numbers with wide ranges or unit ambiguity → keep the range + confidence, label
  clearly; never collapse to a false point value.
- Duplicate Commons images / P18 already in the category → dedup.
- Very deep lineages → the tree is scrollable/condensed, never overflowing.

## Acceptance criteria

REQ-001…007 met, NFR-001/002 green, the charter amendment recorded, and a genus
page shows size, gallery, blurb, taxonomy tree, and collapsed occurrences —
verified by a screenshot on completion.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Typed nullable enrichment record | automated | `src/domain/enrichment.ts` + `test/spec014-enrichment.test.ts` | `EnrichmentRecord` on `ReadProfile` | branch `claude/mesozoic-atlas-feedback-7orhwl` |
| REQ-002 | Engine-agnostic, schema-validated, revision-cached | automated | `test/spec014-enrichment.test.ts` (validator/freshness/apply) + `validate:enrichment` | `enrichment/*.json` cache + `src/pipeline/enrichment.ts` | branch `claude/mesozoic-atlas-feedback-7orhwl` |
| REQ-003 | Multi-image gallery, bundled, deduped | automated + budget | selection unit + gallery component + check:budget | TBD | TBD |
| REQ-004 | Silhouette + size-vs-human hero | automated | resolve/scale unit + hero component | TBD | TBD |
| REQ-005 | Full page layout + states | automated + manual | component tests + screenshot | TBD | TBD |
| REQ-006 | Taxonomy lineage renders + links | automated | lineage unit + component | TBD | TBD |
| REQ-007 | Occurrences collapsed by default | automated | component test | TBD | TBD |
| NFR-001 | offline + deterministic + budget | CI | test + build + check:budget | TBD | TBD |
| NFR-002 | grounded content + disclosure | manual | prompt review + spot-check | TBD | TBD |

## Test plan

Unit: enrichment schema/prompt/cache-key, image selection/dedup, PhyloPic
resolve+scale, taxonomy lineage. Component: hero (with/without size), gallery,
fact row, blurb, taxonomy tree, collapsed→expand occurrences, and every empty
state. Build: offline build from cache; `check:budget`. Manual: a batch dry-run
on a small sample + a full-page screenshot.

## Rollback plan

The page is additive over SPEC-012; revert the component to the prior profile.
The enrichment record and image list are optional fields; reverting the pipeline
step and regenerating the snapshot removes them. The enrichment cache and bundled
images are deleted with the generator revert.

## Open questions

- [ ] Enrichment **engine order**: default is **Engine A (agent-authored, free)**
      populating the cache highest-value-taxa-first, with **Engine B (batch
      script)** only if/when you want the full ~2100 finished fast. If Engine B is
      used, model = Haiku 4.5 for extraction (~\$8 one-time), Sonnet 5 for blurbs
      if needed. (Default: agent-first; no paid run unless you ask.)
- [ ] **Gallery size** cap (default 4–6 images/taxon) and total image budget
      ceiling (bundling more images grows the repo — see SPEC-012's 43 MB).
- [x] Hero: **silhouette size-vs-human leads**, photo secondary (owner confirmed
      2026-07-25).

## Human decisions required

- [x] **Engine order** (open question 1): agent-authored cache first (free), batch
      script only on request — confirmed 2026-07-25.
- [x] **Gallery/image budget** (open question 2): ~4–6 images/taxon — confirmed
      2026-07-25 (total image budget tuned at implementation).
- [x] **Charter amendment** (below): relaxed provenance accepted — confirmed
      2026-07-25.

## Conflict check

Touches SPEC-001 (data model — additive), SPEC-003/007/012 (taxon profile —
replaces the SPEC-012 single-image block with a gallery + enrichment; SPEC-007's
provenance simplification is further relaxed here), SPEC-010 (reuses taxonomy).
It **amends the design/governance charter** (provenance-first) — recorded as a
charter amendment in this spec, per `CLAUDE.md`. No unresolved contradiction;
`conflicts_with` empty. Drift note: `docs/SPEC_INDEX.md` lacks rows for
SPEC-010…014.

## Charter amendment (provenance relaxation)

The design charter and SPEC-001/007 make provenance first-class (images need
licence+credit or are hidden; "interpretative" content was removed). The owner
has **waived** these constraints for this personal project (2026-07-25):

- Images may be shown regardless of licence; a credit line is kept where present.
- **AI-assisted, interpretative content is allowed**, disclosed once as
  "AI-assisted from Wikipedia" with `stated|estimated` confidence on numbers.
- Per-field provenance badges are replaced by a single light sources line.

This is a deliberate softening; requirements still live only in specs.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | domain enrichment record | `src/domain/enrichment.ts`; attached via `applyEnrichment` | `test/spec014-enrichment.test.ts` | Done (data); UI display in REQ-005 |
| REQ-002 | cache-as-contract + engines | `src/pipeline/enrichment.ts` (validator/loader/apply); `scripts/enrich_fetch.ts` (Engine A helper); `scripts/validate_enrichment.ts` | `test/spec014-enrichment.test.ts` | Done (Engine A seeded 8 flagship records; Engine B optional) |
| REQ-003 | image sourcing + gallery | TBD | TBD | Pending |
| REQ-004 | PhyloPic + size hero | TBD | TBD | Pending |
| REQ-005 | TaxonProfile redesign | TBD | TBD | Pending |
| REQ-006 | taxonomy tree | TBD | TBD | Pending |
| REQ-007 | collapsed occurrences | TBD | TBD | Pending |

## Implementation notes

To be filled during implementation. Likely phasing within this spec: (A) images
done right (Wikidata P18 + Commons gallery + PhyloPic) — no LLM; (B) enrichment
layer (schema + batch + cache + fields); (C) page redesign (hero, tree,
collapsibles); (D) charter amendment recorded. A/C are independently demoable.

## Spec amendments

### AMEND-001: Semantic image slots (refines REQ-003)

- **Date / owner:** 2026-07-26, owner-approved (chose "synthesize the size hero"
  and "exactly 3 role slots" when asked).
- **Trigger:** The shipped gallery selected images by source priority then
  alphabetical filename with no relevance ranking, so taxa surfaced irrelevant
  files (signage, footprints, a cartoon golf club) and, via a space-vs-underscore
  dedupe gap, the **same** Commons file twice (e.g. Tyrannosaurus holotype mount).
- **Behavioural change to REQ-003:** the gallery is no longer "first N distinct
  filenames." Each taxon fills up to **three ordered, role-tagged slots**:
  1. **Life restoration** — an artist's reconstruction. Primary candidate is
     Wikidata `P18` (for extinct taxa the infobox lead is near-always paleoart);
     otherwise the best restoration-classified Commons file; else the clade /
     PhyloPic silhouette (REQ-004 fallback).
  2. **Fossil** — a skeletal mount, skull, holotype or specimen photo, taken from
     the best fossil-classified Commons file; **omitted** if none qualifies (never
     force an off-topic image into the slot).
  3. **Size comparison** — **always the synthesized size-vs-human hero** (REQ-004),
     rendered from the enriched body length. Commons "scale diagram" files are
     **not** scraped for this slot; the rendered hero is uniform and always
     available. When length is unknown the slot degrades to the plain silhouette
     per REQ-004.
- **Classification:** each Commons candidate is assigned a role from, in priority,
  its **Commons categories** → **filename** → **description**, matched against role
  keyword sets (restoration: `restoration|reconstruction|life|paleoart`; fossil:
  `skeleton|skull|holotype|fossil|mount|specimen|bones|teeth|cast`). An exclusion
  set (`sign|logo|map|stamp|coin|book|golf|footprint|track|locator`) drops
  off-topic files unless a slot would otherwise be empty.
- **Candidate gathering:** broaden beyond the alphabetical head of `Category:X` by
  reading the taxon category's **subcategories** and pulling files from those whose
  names match a role (e.g. "Skeletons of X", "Life restorations of X"). Per-file
  Commons `categories` and image `size` ride on the existing batched `imageinfo`
  call, so classification adds no per-file round trips.
- **Ranking within a slot:** `P18` wins the restoration slot; otherwise highest
  native resolution, deterministic tiebreak by title — no reliance on API order, so
  the deterministic-rebuild guarantee (NFR) holds.
- **Dedupe fix:** the per-taxon dedupe key is normalised (`_`↔space,
  first-letter case) and files are also deduped on the API-normalised title, so a
  file arriving under two spellings (P18 vs category listing) collapses to one.
- **Unchanged:** bundling mechanism, budget gate, offline delivery, per-image
  attribution + Commons source link.

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [ ] Open questions are resolved or explicitly deferred.
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed (incl. charter amendment).
- [x] Human approval recorded before status set to Approved. Owner approved
      SPEC-014 and all three confirmations (engine order, gallery budget, hero) on
      2026-07-25 ("i confirm everything here").
