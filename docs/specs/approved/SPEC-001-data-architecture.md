---
doc_type: spec
spec_id: SPEC-001
title: Data architecture & model
status: Approved
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [data-layer, ingestion-pipeline, provenance, taxon-profile]
affected_interfaces: [pbdb-import, wikidata-join, wikipedia-commons-import]
supersedes: []
superseded_by:
depends_on: []
conflicts_with: []
last_verified_at: 2026-07-09
---

# SPEC-001: Data architecture & model

## Summary

Defines how the atlas sources, structures, and serves its data so the provenance
and uncertainty rules of the functional specification are met **structurally**,
not by convention. The atlas is a curation/presentation layer over the Paleobiology
Database (PBDB, the scientific spine) plus Wikipedia/Wikimedia via Wikidata (the
encyclopedic, tertiary layer). Data is served from a dated snapshot in three tiers;
classifications like validity are sourced **assertions**, and flags like
"reconstructed/approximate/interpretative/missing" are **derived** from structure.
The elaborated models and diagrams live in
[`../../design/data-model.md`](../../design/data-model.md); this spec is the
governed record of the normative decisions and how they are verified.

## Context

The functional specification requires a source for every visible occurrence and
time range, distinct treatment of interpretative vs fossil data, and explicit
handling of missing/reconstructed/approximate values
([`../../product/functional-specification.md`](../../product/functional-specification.md)
§1.11, §2.2–2.6). A naïve model with intrinsic `validity`/`evidence`/`uncertainty`
enums cannot honour this — those values are either sourced claims or derivable from
structure. The design doc works this through; this spec governs it.

## Problem statement

Where do classifications such as taxonomic validity, confidence, and uncertainty
come from, and how do we guarantee every displayed value is attributable without
becoming a paleobiology authority ourselves?

## Goals

- Guarantee provenance for every displayed value as a structural invariant.
- Model judgments (validity, biology) as sourced assertions with a date.
- Derive display flags (reconstructed/approximate/interpretative/missing) from
  structure so they cannot drift from the data.
- Reuse authoritative datasets (PBDB, Wikipedia/Wikidata) rather than re-deriving
  taxonomy, dating, or plate reconstructions.

## Non-goals

- Being an authority on taxonomy, dating, or paleogeographic reconstruction.
- Live per-request calls to PBDB/Wikipedia (data is served from a snapshot).
- Multi-source reconciliation beyond PBDB + Wikipedia/Wikidata.
- Defining product/UI requirements (those remain in the functional specification).

## Users or actors

The ingestion pipeline (writes L1/L2), curators (author L3 editorial), and the
atlas application (reads L2+L3). End users see only sourced, dated content.

## Functional requirements

> Data requirements use `DATA-xxx`; a non-functional one uses `NFR-xxx`. Detailed
> class models are in the design doc; each requirement below is normative.

### DATA-001: Mandatory, structural provenance

- **Statement:** Every value the UI can display must resolve to a `Source`, or be
  explicitly marked as `Editorial`. Storing a displayable value without a
  provenance pointer is invalid.
- **Rationale:** Satisfies FONC-1090/1100 and CONS-390/400 by construction.
- **Acceptance criteria:** No occurrence, time range, or profile field can be
  serialized to the app store without a resolvable source reference.
- **Verification method:** automated schema/constraint check on the app store.
- **Evidence location:** _to be filled at implementation._

### DATA-002: Validity and biology are sourced assertions

- **Statement:** Taxonomic validity, diet, mass, length and similar judgments are
  reified as assertions (`predicate`, `value`, `assertedOn`, `Source`); the
  displayed/accepted value is derived from the assertion set (e.g. the winning
  taxonomic opinion) and shown with its citation.
- **Rationale:** These are claims by a source at a date, not intrinsic attributes
  (FONC-670, FONC-720, CONS-300/310/440).
- **Acceptance criteria:** A taxon's validity renders as `status + "per <source>"`;
  changing the winning opinion changes the displayed status.
- **Verification method:** unit test over opinion sets; UI inspection.
- **Evidence location:** _to be filled at implementation._

### DATA-003: Uncertainty flags are derived, not stored

- **Statement:** `reconstructed`, `approximate`, `interpretative`, and `missing`
  must be computed from structure (paleocoordinate field, time-range span, source
  kind, null value) — never stored as editable fields.
- **Rationale:** Prevents drift between the flags and the data (FONC-1120/1130/1140,
  CONS-110/210).
- **Acceptance criteria:** Toggling nothing, the flags follow the underlying data;
  there is no writable column for them.
- **Verification method:** unit tests on the derivation functions.
- **Evidence location:** _to be filled at implementation._

### DATA-004: Sources are PBDB + Wikipedia/Wikidata with a typed chain

- **Statement:** Occurrences, taxa, opinions, dating, and paleocoordinates come
  from PBDB; narrative summary, common names, and images come from
  Wikipedia/Wikimedia Commons, joined to taxa via **Wikidata QID**. Each `Source`
  has a `kind` (PrimaryLiterature / Database / Encyclopedic / Editorial) and may
  reference a `derivedFrom` source.
- **Rationale:** Reuse authoritative data; keep tertiary content distinct
  (CONS-100, CONS-420).
- **Acceptance criteria:** Encyclopedic (Wikipedia) values render marked tertiary;
  PBDB values resolve to their citing reference where present.
- **Verification method:** integration test of the join; UI inspection.
- **Evidence location:** _to be filled at implementation._

### DATA-005: Three tiers, served from a dated snapshot

- **Statement:** Data is organized as L1 imported snapshot (sourced, dated), L2
  derived (rebuilt each import), and L3 editorial (attributed). The application
  reads only L2+L3 from our own store and does not call PBDB/Wikipedia at request
  time.
- **Rationale:** Predictable performance, resilience, and an honest import date
  (PERF-010…060, PERF-280…310, FONC-1170, CONS-430).
- **Acceptance criteria:** No runtime egress to PBDB/Wikipedia; every snapshot
  carries a `retrievedOn` date surfaced in the UI where required.
- **Verification method:** network inspection in tests; snapshot metadata check.
- **Evidence location:** _to be filled at implementation._

### DATA-006: Taxon-profile biology is typed, nullable, sourced

- **Statement:** Biology is modelled as typed attributes/measurements (diet,
  locomotion, body length, body mass) with units and bounds, each nullable and
  each carrying a `Source`; `ContentLevel` is derived from how many are populated.
- **Rationale:** Structured + provenance-honest + sparse-by-design (FONC-430…470,
  FONC-600…640, CONS-080/410).
- **Acceptance criteria:** A numeric estimate never renders without a source or an
  uncertainty range; an unpopulated field renders as an explicit "not available".
- **Verification method:** unit tests; UI inspection against the taxon-profile
  mockup.
- **Evidence location:** `docs/assets/mockups/taxon-profile.svg` (design reference).

### DATA-007: Media licence compliance

- **Statement:** Each `ImageAsset` stores and displays its `type`, `credit`,
  `licence`, and `sourceUrl`; Wikipedia summary text is attributed under CC BY-SA.
  Any asset whose licence cannot be honoured is not shown (image-fallback state).
- **Rationale:** Legal compliance and honest attribution (FONC-1210/1220/1230/1240).
- **Acceptance criteria:** No image renders without a licence + credit; artistic
  images are labelled artistic.
- **Verification method:** automated check that every shown image has licence +
  credit; UI inspection.
- **Evidence location:** `docs/assets/mockups/taxon-profile.svg` (design reference).

### NFR-001: Import date and reproducibility

- **Statement:** Every published snapshot is immutable and carries a `retrievedOn`
  date; a rebuild from the same upstream snapshot is deterministic for L2.
- **Rationale:** Reproducibility and provenance (FONC-1170, CONS-430).
- **Acceptance criteria:** Two builds of L2 from one L1 snapshot are byte-stable for
  derived fields.
- **Verification method:** deterministic-rebuild test.
- **Evidence location:** _to be filled at implementation._

## Data model impact

New data structures per the design doc: `Source`/`Assertion`/`ProvenanceView`
(provenance), `Taxon`/`TaxonName`/`TaxonomicOpinion` (taxonomy), `FossilOccurrence`/
`Collection`/positions (occurrence), timescale classes, and `TaxonProfile` with
sourced `BiologyAttribute`/`Measurement`/`ImageAsset`. See
[`../../design/data-model.md`](../../design/data-model.md).

## Error handling

Unmatched Wikidata join → no encyclopedic content (explicit "not available").
Unlicensable image → image-fallback state. Missing PBDB reference → occurrence is
not shown (DATA-001). Upstream downtime never reaches the app (snapshot).

## Edge cases

Taxa with conflicting opinions (show the winning one + citation); measurements
without stated confidence (show bounds, no invented confidence); collections with
coarse coordinates (derive `approximate` / note resolution).

## Acceptance criteria

The spec is satisfied when: every displayed value is source-resolvable (DATA-001);
validity and biology render as sourced assertions (DATA-002, DATA-006); the four
uncertainty flags are computed, with no stored columns (DATA-003); the PBDB +
Wikidata + Wikipedia join works with typed source kinds (DATA-004); the app serves
L2+L3 from a dated snapshot with no runtime upstream calls (DATA-005); and images
carry licence + credit (DATA-007).

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| DATA-001 | No sourceless displayable value | automated | store constraint test | _TBD_ | _TBD_ |
| DATA-002 | Validity shows "per <source>" | unit + manual | opinion-set test | _TBD_ | _TBD_ |
| DATA-003 | Flags follow data, no stored column | unit | derivation tests | _TBD_ | _TBD_ |
| DATA-004 | Tertiary marked; PBDB→ref | integration | join test | _TBD_ | _TBD_ |
| DATA-005 | No runtime upstream egress | automated | network assertion | _TBD_ | _TBD_ |
| DATA-006 | No numeric without source/range | unit + manual | profile tests vs mockup | taxon-profile.svg | _TBD_ |
| DATA-007 | Every image has licence + credit | automated | image check | taxon-profile.svg | _TBD_ |
| NFR-001 | Deterministic L2 rebuild | automated | rebuild test | _TBD_ | _TBD_ |

## Test plan

Unit tests for the derivation functions (accepted taxonomy, flags, content level)
and for assertion resolution; an integration test for the PBDB→Wikidata→Wikipedia
join over a small fixture; a store-constraint test enforcing DATA-001; and a
network assertion proving DATA-005. UI checks validate rendering against the
[taxon-profile mockup](../../assets/mockups/taxon-profile.svg).

## Rollback plan

The data layer is a versioned snapshot; roll back by republishing the previous
snapshot. Schema changes are additive where possible; a bad import is reverted by
pointing the app at the prior published snapshot. No destructive migration is
required for the read model.

## Open questions

- [ ] Import cadence and diffing (full re-snapshot vs incremental).
- [ ] Which plate-rotation model to pin for paleocoordinates.
- [ ] Editorial featured-species authoring/review workflow.
- [ ] Search index scope (scientific-name MVP; common-name via encyclopedic later).

## Human decisions required

- [x] Data sources: **PBDB + Wikipedia/Wikidata** — approved.
- [x] Profile fields: **structured, sourced, explicit-missing** — approved.
- [ ] Snapshot vs live: recommended **snapshot**; confirm.

## Conflict check

Refines, and does not conflict with, the functional specification's provenance and
uncertainty requirements (§1.11, §2.2–2.6). It is the technical realization of
those product rules. No other spec exists to overlap with.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| DATA-001 | Provenance model (design §4) | _TBD_ | _TBD_ | Approved |
| DATA-002 | Taxonomy model (design §5) | _TBD_ | _TBD_ | Approved |
| DATA-003 | ProvenanceView (design §4) | _TBD_ | _TBD_ | Approved |
| DATA-004 | Sources (design §2) | _TBD_ | _TBD_ | Approved |
| DATA-005 | Tiers + pipeline (design §3, §9) | _TBD_ | _TBD_ | Approved |
| DATA-006 | Profile model (design §8) | _TBD_ | _TBD_ | Approved |
| DATA-007 | Media (design §2, §8) | _TBD_ | _TBD_ | Approved |
| NFR-001 | Snapshot (design §9) | _TBD_ | _TBD_ | Approved |

## Implementation notes

_None yet — no application code exists._

## Spec amendments

> Required for any behavioral change after approval.

_None._

## Review checklist

- [x] Requirements have IDs, statements, rationale, acceptance criteria.
- [x] Verification matrix and traceability table present.
- [x] Non-goals recorded; conflict check done.
- [x] Design detail referenced (not duplicated) in `docs/design/data-model.md`.
