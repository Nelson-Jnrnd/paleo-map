---
doc_type: spec
spec_id: SPEC-008
title: Full-Mesozoic time window (252–66 Ma)
status: In Implementation
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [data-layer, ingestion-pipeline, app-frontend, map-rendering, data-delivery, exploration-view, styling]
affected_interfaces: [pbdb-import, static-data-artifacts, gplates-basemap]
supersedes: []
superseded_by:
depends_on: [SPEC-001, SPEC-003, SPEC-004]
conflicts_with: []
last_verified_at:
---

# SPEC-008: Full-Mesozoic time window (252–66 Ma)

## Summary

The app currently ships a single **Late-Cretaceous / Maastrichtian** PBDB slice:
the stage timeline shows only Santonian–Maastrichtian and the reconstructed GPlates
basemap is one fixed 70 Ma frame. This spec widens the atlas to the **whole
Mesozoic (252–66 Ma)** — ingesting Dinosauria occurrences across the Triassic,
Jurassic, and Cretaceous, expanding the stage timeline to the full ICS Mesozoic
table, giving the map a **per-stage** reconstructed basemap that changes with the
selected age, and delivering the larger dataset **partitioned by stage** so the app
fetches only the active window. It realizes the MVP's stated time ambition
(mvp-scope §"Time exploration", FONC-090…170) without changing the read-model
schema or re-introducing the removed occurrence list.

## Context

The data layer (SPEC-001) ingests a source subset into a dated snapshot and serves
it as a prebuilt static artifact with no runtime egress; the pinned Scotese/PALEOMAP
rotation model (SPEC-001 AMEND-001) covers the full Mesozoic. The exploration view
(SPEC-003) steps the timeline by geological **stage** (OQ-030) and re-filters
occurrences in memory. The basemap (SPEC-004) ships a single 70 Ma coastline frame,
"representative for the Campanian–Maastrichtian window", with a frame-reconciliation
disclosure (`describeFrame`) when the coastline model differs from the occurrences'.
SPEC-002 REQ-006 anticipated partitioned static data as the scaling path. The
occurrence list was removed (SPEC-007); this spec does not restore it.

The current stage table (`src/domain/timescale.ts`) is hardcoded to three Late
Cretaceous stages, and the shipped ingestion window is `Dinosauria / Maastrichtian`
— the two constraints that keep the app in one ~6 Myr slice.

## Problem statement

The exploration loop only works in a single Late-Cretaceous window. A user cannot
explore Triassic or Jurassic dinosaurs; the "period" concept (Triassic / Jurassic /
Cretaceous) has no data behind it; and the basemap is temporally frozen, so "where
were dinosaurs at 150 Ma?" cannot be answered or shown. The blockers are the
one-interval ingestion, the 3-stage table, and the single basemap frame.

## Goals

- Ingest a **full-Mesozoic** Dinosauria dataset (252–66 Ma) through the existing
  SPEC-001 pipeline, still as a prebuilt static artifact with no runtime egress.
- Replace the 3-stage Late-Cretaceous table with the **full ICS Mesozoic stage
  table**; the timeline steps across all of it, grouped by period, with a
  period-level quick jump.
- Give the map a **per-stage reconstructed basemap** that changes with the selected
  age, sharing the occurrences' pinned rotation model.
- **Partition the delivered data by stage** so first load and each stage-step fetch
  only the active window, keeping performance and a per-stage size budget in hand.
- Keep the build deterministic and re-verify the `approximate` / "spans multiple
  stages" cue now that it is evaluated against a full stage table.

## Non-goals

- Continuous drift **animation** or a **3D globe** (explicit non-goals; OQ-010).
- Adding **non-dinosaur** taxa — the dataset stays dinosaurs-only (OQ-050);
  secondary groups are separate V1 scope.
- **Search**, the **filters panel**, or the **taxonomy browser** — separate slices.
- Re-introducing the **occurrence list** removed in SPEC-007 (selection stays
  map-driven).
- Changing the **rotation model** (Scotese/PALEOMAP stays pinned; SPEC-001 AMEND-001).

## Users or actors

The **Explorer** (now across the whole Mesozoic, 252–66 Ma) and the **build/CI
system**, which ingests the wider dataset, fetches the per-stage basemap frames,
partitions the output, and enforces the size budget.

## Functional requirements

### REQ-001: Full-Mesozoic ingestion (per-period queries, merged)

- **Statement:** The pipeline must produce a snapshot covering Dinosauria
  occurrences from **252–66 Ma** across the Triassic, Jurassic, and Cretaceous. The
  `HttpSourceClient` window is parameterized; the live pull is issued as **one query
  per period** and the three results are merged **deterministically** (stable sort /
  de-duplication by id) into a single L1 snapshot.
- **Rationale:** mvp-scope §"Time exploration" (FONC-090/100), FONC-160; per-period
  queries are friendlier to PBDB rate limits and align with the per-stage output
  partitioning (REQ-005).
- **Acceptance criteria:** the built snapshot contains occurrences whose time ranges
  fall in each of the three Mesozoic periods; two rebuilds from the same source are
  byte-identical (NFR-002); no runtime egress is introduced (NFR-003).
- **Verification method:** pipeline run report + a fixture-based test asserting
  multi-period coverage and merge determinism.
- **Evidence location:** `src/pipeline/http-client.ts`, `scripts/gen_web_data.ts`
  (filled at implementation).

### REQ-002: Full ICS Mesozoic stage table

- **Statement:** `src/domain/timescale.ts` must define the complete ICS Mesozoic
  stage list (Induan → Maastrichtian, ~30 stages) with older/younger Ma bounds and
  the ICS **period** colour per stage. The timeline steps through every stage, and
  `stagesInRange` / `spansMultipleStages` operate over the full table.
- **Rationale:** OQ-030 (stage-level stepping), FONC-100/110/150/160/170; the
  `approximate` derivation (SPEC-001 DATA-003) depends on this table.
- **Acceptance criteria:** the timeline exposes all Mesozoic stages with correct Ma
  bounds; stepping to a stage shows exactly the occurrences whose time range overlaps
  it; the "spans multiple stages" cue is now variable (not ~100% true) against the
  full table.
- **Verification method:** unit tests on the table (bounds, ordering, coverage) +
  a timeline component test.
- **Evidence location:** `src/domain/timescale.ts`, timeline tests.

### REQ-003: Period grouping and quick-select

- **Statement:** The timeline must group stages by **period (Triassic / Jurassic /
  Cretaceous)** and offer a period-level quick jump, while precise selection stays
  **stage-level** (OQ-030). Selecting a period moves to a representative stage and
  updates the map and occurrences.
- **Rationale:** FONC-100 (three-period division), FONC-190 (quick period
  selection); the full stage list needs a coarse navigation aid.
- **Acceptance criteria:** the three periods are visible and selectable; selecting
  one updates the selected stage, the map frame, and the visible occurrences; the
  precise selected stage remains distinct from an occurrence's range (FONC-170).
- **Verification method:** component test (period jump updates stage + count).
- **Evidence location:** `src/app/components/TimelineControl.tsx`, timeline test.

### REQ-004: Per-stage time-varying paleogeographic basemap

- **Statement:** The reconstructed coastlines must correspond to the **selected
  stage**, drawn from a set of **per-stage** prebuilt GPlates/PALEOMAP frames
  (~30, one per ICS Mesozoic stage), selected client-side by the current stage and
  sharing the occurrences' pinned Scotese rotation model. Each frame carries its
  target-age + model metadata; the `describeFrame` disclosure (SPEC-004 REQ-002/003)
  still applies. If a stage's frame is unavailable, the app falls back to the
  **nearest available** frame (with the disclosure) or the graticule (SPEC-004
  REQ-004).
- **Rationale:** FONC-210/220/300 (map for the selected age), CONS-110…180;
  SPEC-004 currently ships a single frame — this amends it to time-varying frames.
- **Acceptance criteria:** stepping across stages (and periods) visibly changes the
  coastlines; each served frame declares its target age (Ma) and model; a missing
  frame degrades to the nearest frame or graticule without error.
- **Verification method:** per-frame metadata test + a browser check that a Triassic
  stage and a Cretaceous stage render different coastlines.
- **Evidence location:** `scripts/fetch_basemap.ts`, `public/basemap/*`,
  `src/app/data/basemap.ts` (filled at implementation). **Amends SPEC-004.**

### REQ-005: Stage-partitioned data delivery

- **Statement:** The full-Mesozoic read model must be delivered **partitioned by
  stage** — one static JSON artifact per stage plus a small **index** (stages →
  data URL, basemap URL, occurrence count, Ma bounds). The app loads the index at
  boot and fetches **only the active stage's** artifact, fetching another stage's on
  a timeline step. Shared reference data (sources, taxa metadata) is factored to
  avoid duplicating it in every partition. Runtime stays static / no-egress.
- **Rationale:** SPEC-002 REQ-006 (partitioned static data scaling path); a single
  full-Mesozoic file would load the whole dataset up front and blow the budget.
- **Acceptance criteria:** the build emits per-stage artifacts + an index; the app
  fetches the index then one stage artifact; stepping stages fetches only the target
  stage; a stage with no data yields the existing empty state; the size-budget gate
  passes **per stage artifact** (and on the index).
- **Verification method:** build-output inspection + a loader test (index → single
  stage fetch; step → one additional fetch) + the size-budget gate.
- **Evidence location:** `scripts/gen_web_data.ts`, `src/app/data/snapshot.ts`,
  budget gate (filled at implementation).

## Non-functional requirements

### NFR-001: Performance at full-Mesozoic scale

- **Statement:** With partitioned delivery, first useful content must appear within
  the load budgets and a **stage change must update visible occurrences within 1 s**
  (PERF-030), fetching and filtering only the active stage's occurrences.
- **Rationale:** PERF-010/020/030; partitioning caps the in-memory set per step.
- **Acceptance criteria:** stage-change fetch + in-memory re-filter completes well
  within 1 s at real per-stage volume; a loading indicator (SPEC-006) covers any
  fetch over the 500 ms threshold.
- **Verification method:** loader/timing check + code inspection (per-stage fetch,
  no full-dataset load).
- **Evidence location:** `src/app/data/snapshot.ts`, `src/app/state/exploration.ts`.

### NFR-002: Deterministic, budgeted build

- **Statement:** The per-stage rebuild must be byte-stable (SPEC-001 NFR-001), and
  the size-budget gate is updated to ceiling **each per-stage artifact** and the
  index, with the chosen ceilings recorded.
- **Rationale:** NFR-001 reproducibility; keep the artifact size governed.
- **Acceptance criteria:** two builds from the same source produce byte-identical
  partitions; `scripts/check_budget.ts` enforces per-stage + index ceilings and
  passes.
- **Verification method:** deterministic-rebuild test + budget gate in CI.
- **Evidence location:** `scripts/check_budget.ts`, `test/nfr-001-*`.

### NFR-003: No runtime egress

- **Statement:** Unchanged — at runtime the app fetches only its own bundled
  artifacts (index, per-stage data, per-stage basemap) and contacts no upstream host.
- **Rationale:** SPEC-002 REQ-001/006, SPEC-001 DATA-005.
- **Acceptance criteria:** the runtime read path is `fetch` of local artifacts only;
  no PBDB/Wikipedia/GPlates call occurs in normal use.
- **Verification method:** code + network inspection (extends the existing
  no-egress test intent).
- **Evidence location:** `src/app/data/*`.

## Security and privacy considerations

### SEC-001: No secrets, telemetry, or token-gated tiles

- **Statement:** Unchanged from SPEC-003 SEC-001 — no API keys/secrets, no
  third-party telemetry, and no token-gated map tiles ship in the client, including
  the new per-stage basemap frames (all prebuilt, self-hosted).
- **Rationale:** SPEC-002 SEC-001; charter.
- **Acceptance criteria:** no secret or analytics call appears in the bundle or the
  new artifacts; basemap frames reference no token-gated host at runtime.
- **Verification method:** code + dependency + network inspection.
- **Evidence location:** `public/basemap/*`, build output.

## Data model impact

`timescale.ts` gains the full ICS Mesozoic stage table (a fixed reference, not
sourced data). Delivery changes from one artifact to **per-stage artifacts + an
index**; the `ReadModel` shape *within* a stage window is unchanged, and shared
reference data (sources/taxa) is factored to a shared artifact to avoid
duplication. The `approximate` flag becomes **meaningful/variable** again (against a
full stage table it is no longer ~100% true) — no code change beyond the table, but
explicitly re-verified (REQ-002).

`ReadProfile` gains three **derived** fields — `occurrenceCount`, `timeSpan`,
`timeSpanApproximate` (SPEC-008 AMEND-001) — precomputed per taxon so a
stage-partitioned profile reports the taxon's whole-snapshot record rather than
collapsing to the loaded stage. These are pure aggregates over the occurrences
already in the model (no new source data), sorted/deterministic like every other
derived field.

## API impact

No runtime API. The static data-artifact contract gains an **index** document
(stages → per-stage data + basemap URLs + bounds/counts) and multiple per-stage data
files in place of the single `data/snapshot.json`. The app fetches the index then
per-stage files. No first-party runtime API is introduced.

## Configuration impact

- Ingestion window becomes a run parameter (period/stage/Ma range); the live pull
  issues one query per period.
- `scripts/fetch_basemap.ts` runs **per stage** (~30 target ages) at build time.
- The build emits per-stage data partitions + a shared reference artifact + an index.
- The size-budget config gains per-stage-artifact and index ceilings.
- No runtime environment variables or secrets.

## Error handling

- **Missing basemap frame** for a stage → nearest available frame (with the
  `describeFrame` disclosure) or the graticule (SPEC-004 REQ-004); never a hard fail.
- **Per-stage data fetch fails** → the SPEC-006 error state with Retry for that
  stage; the selected stage/filters are preserved (FONC-1310/1330/1340).
- **Stage with no occurrences** (sparse Triassic) → the existing empty state.
- **Index fetch fails** → boot error with Retry (SPEC-003 REQ-008 / SPEC-006).

## Edge cases

- **Antimeridian / high-latitude** paleocoordinates on older reconstructions —
  verify marker + coastline rendering across Triassic/Jurassic frames.
- **Rotation-model coverage** — Scotese/PALEOMAP covers the full Mesozoic; confirm no
  gap at ingest (flag any stage the model can't place).
- **Very sparse stages** — some ICS stages may hold few or no dinosaur occurrences;
  their partition may be tiny or empty (empty state).
- **Stage-boundary occurrences** — an occurrence whose range straddles a stage
  boundary appears in each overlapped stage's partition (duplicated by design, keyed
  by id) — must not double-count in the visible total.
- **Rapid stepping** — quickly stepping stages must cancel/supersede in-flight fetches
  (no stale render).

## Acceptance criteria

Satisfied when: the snapshot spans 252–66 Ma across all three periods (REQ-001); the
timeline steps the full ICS Mesozoic stage set with a period quick-select
(REQ-002/003); the basemap coastlines change per stage sharing the occurrences' model
with graceful fallback (REQ-004); the data is delivered per-stage behind an index and
only the active stage loads (REQ-005); performance holds (stage change < 1 s,
NFR-001), the build is deterministic and within a per-stage budget (NFR-002), and no
runtime egress occurs (NFR-003).

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Occurrences across all 3 periods; merge deterministic | automated | `test/data-009-per-period-merge.test.ts` | `http-client.ts`, `gen_web_data.ts` | — |
| REQ-002 | Full ICS Mesozoic stage table; overlap filtering | automated | `test/spec008-*` timescale unit + timeline test | `timescale.ts` | — |
| REQ-003 | Period grouping + quick jump updates stage/map/count | automated | `test/ui/timeline-periods.test.tsx` | `TimelineControl.tsx` | — |
| REQ-004 | Per-stage frames change coastlines; nearest-frame fallback | automated + manual | `test/ui/basemap-frames.test.ts` + browser check | `fetch_basemap.ts`, `basemap.ts` | — |
| REQ-005 | Per-stage partitions + index; only active stage fetched | automated | `test/ui/atlas-loader.test.ts` + build inspection + budget | `gen_web_data.ts`, `atlas.ts` | — |
| NFR-001 | Stage change < 1 s at scale | automated + inspection | atlas-loader timing check | `atlas.ts`, `exploration.ts` | — |
| NFR-002 | Deterministic partitions; per-stage budget | automated | `test/spec008-partition-determinism.test.ts` + budget gate | `check_budget.ts` | — |
| NFR-003 | No runtime egress | inspection | `test/data-005-no-runtime-egress.test.ts` | `data/*` | — |
| SEC-001 | No secret/telemetry/token tiles | inspection | code + dependency + network | `public/basemap/*` | — |

## Test plan

- **Unit:** the full Mesozoic stage table (bounds/order/coverage); `stagesInRange` /
  `spansMultipleStages` over it; the per-period merge (determinism + de-dup).
- **Component:** timeline renders all stages + period quick-select updates
  stage/map/count; basemap frame selection picks the right frame per stage with
  nearest-frame fallback.
- **Delivery:** build emits per-stage partitions + shared reference + index; a loader
  test asserts index-then-single-stage fetch and one additional fetch per step; the
  size-budget gate ceilings each partition + index.
- **Determinism/egress:** per-stage rebuild is byte-stable; runtime fetches only
  local artifacts.
- **Fixtures:** a small multi-period fixture (≥1 Triassic, ≥1 Jurassic, ≥1
  Cretaceous taxon) so unit/component tests stay offline and deterministic.
- **Browser smoke:** a Triassic stage and a Cretaceous stage render visibly different
  coastlines.

## Rollback plan

Parameterized and additive: revert the ingestion window to `Maastrichtian`, restore
the 3-stage `LATE_CRETACEOUS_STAGES` table, the single basemap frame, and the
single-artifact loader; drop the partition/index build step. No read-model schema
change to undo; the exploration loop and SPEC-007 changes are untouched.

## Open questions

- [x] **Data volume (measured during implementation).** Full-Mesozoic Dinosauria
  pull sizes and per-stage artifact sizes are measured at build time and drive the
  budget ceilings (recorded in Implementation notes).
- [x] **Shared-reference factoring.** Sources + taxa + profiles are hoisted whole
  into a single shared `reference.json`; only occurrences are partitioned per stage.
- [x] **Representative stage per period** for the quick-select jump: the
  most-populated stage in each period, computed at build time into the index (ties
  broken toward the younger stage).

## Human decisions required

- [x] **Approve the full-Mesozoic scope** (dinosaurs-only, 252–66 Ma) — owner
  instructed implementation, 2026-07-21.
- [x] **Basemap cadence:** per-stage (~30 frames) — owner-chosen, 2026-07-21.
- [x] **Delivery:** partition by stage (per-stage artifacts + index) — owner-chosen,
  2026-07-21.
- [x] **Ingestion strategy:** per-period PBDB queries, merged — owner delegated
  ("your choice"), 2026-07-21.

## Conflict check

Depends on SPEC-001 (pipeline, timescale, no-egress), SPEC-003 (exploration view),
and SPEC-004 (basemap). It **amends SPEC-004** (single 70 Ma frame → per-stage
frames) and **realizes SPEC-002 REQ-006** (partitioned static delivery) — both to be
recorded as amendments/evidence on approval. It does **not** conflict with SPEC-007
(the occurrence list stays removed; selection stays map-driven) or SPEC-006 (its
loading/progress surface now also covers per-stage fetches). Recommended frontmatter:
`depends_on: [SPEC-001, SPEC-003, SPEC-004]`, `conflicts_with: []`.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Ingestion window | `pipeline/http-client.ts` (`mergeById`, per-period pull), `gen_web_data.ts` | `data-009-per-period-merge.test.ts` | Implemented |
| REQ-002 | Stage table | `domain/timescale.ts` (`MESOZOIC_STAGES`) | `spec008-mesozoic-timescale.test.ts` | Implemented |
| REQ-003 | Timeline period jump | `components/TimelineControl.tsx`, `state/exploration.ts` (`selectPeriod`) | `ui/timeline-periods.test.tsx` | Implemented |
| REQ-004 | Per-stage basemap | `scripts/fetch_basemap.ts`, `app/data/basemap.ts` (`selectFrame`) | `ui/basemap-frames.test.ts` | Implemented |
| REQ-005 | Partitioned delivery | `gen_web_data.ts`, `app/data/atlas.ts` | `ui/atlas-loader.test.ts` | Implemented |
| NFR-001 | Per-stage load/filter | `app/data/atlas.ts`, `state/exploration.ts` | `ui/atlas-loader.test.ts` | Implemented |
| NFR-002 | Determinism/budget | `check_budget.ts`, `pipeline/build.ts` | `spec008-partition-determinism.test.ts` | Implemented |
| NFR-003 | No egress | `app/data/*` | `data-005-no-runtime-egress.test.ts` | Implemented |
| SEC-001 | Self-hosted assets | `public/basemap/*` | inspection | Implemented |

## Implementation notes

- **Stage table.** 30 ICS Mesozoic stages (Triassic 7, Jurassic 11, Cretaceous 12),
  ICS 2023 boundary ages, one period colour per stage (Triassic `#812b92`, Jurassic
  `#34b2c9`, Cretaceous `#7fc64e`). `stagesInRange`/`spansMultipleStages`/`ReadApi`
  default to this table, so the `approximate` cue is now variable.
- **Ingestion.** `HttpSourceClient` accepts `intervals: string[]` (default
  `["Triassic","Jurassic","Cretaceous"]`) and a full-Mesozoic `timeWindow`; PBDB
  taxa + occurrence pulls run one query per interval and merge through `mergeById`
  (stable sort by id, first-wins de-dup) before the shared derive/wiki steps.
- **Delivery.** `gen_web_data.ts` writes `public/data/reference.json`
  (`metadata + sources + taxa + profiles`), one `public/data/stage-<slug>.json`
  (`{ occurrences }`) per stage that has occurrences, and `public/data/index.json`
  (stages → slug/period/bounds/count/dataUrl/basemapUrl + representative-stage flag).
  The app boots the index + reference, then fetches only the active stage's file;
  stepping fetches one more (aborting any in-flight fetch — rapid-step edge case).
- **Basemap.** `fetch_basemap.ts` fetches one GPlates PALEOMAP frame per stage at the
  stage midpoint age into `public/basemap/<slug>.geojson`/`.meta.json` and writes
  `public/basemap/index.json`. `selectFrame` resolves a stage to its frame or the
  nearest available frame (disclosed); a failed fetch still degrades to the graticule.
- **Budget.** `check_budget.ts` ceilings the reference artifact, the index, and every
  per-stage data + basemap file; measured sizes are printed on every run.

## Spec amendments

> Required for any behavioral change after the spec is Approved.

### AMEND-001: Whole-snapshot per-taxon aggregates on the profile

- **Date:** 2026-07-22
- **Reason:** Stage-partitioned delivery (REQ-005) meant a taxon profile, built
  from the shared reference plus only the active stage's occurrences, reported the
  taxon's time range and occurrence count for that single stage — understating a
  wide-ranging taxon (e.g. a taxon's span collapsed to the loaded window). The
  profile must report the taxon's full record.
- **Changed requirements:** REQ-005 (delivery) — the shared `reference.json` now
  carries derived per-taxon aggregates so the profile is correct without loading
  every stage. Adds `occurrenceCount`, `timeSpan`, `timeSpanApproximate` to
  `ReadProfile` (derived fields; not new source data).
- **Behavioral impact:** The profile's "Time range" and "Occurrences (N)" reflect
  the taxon across the whole Mesozoic; the occurrence **list** still shows the
  occurrences at the selected age, now explicitly disclosed ("Showing N at the
  selected age…"). `derive.ts` computes the aggregates; the committed
  `reference.json` was regenerated to include them.
- **Test impact:** `test/spec008-taxon-aggregates.test.ts` (aggregate correctness)
  and `test/ui/taxon-profile-aggregate.test.tsx` (the profile shows the full total +
  the subset disclosure with only one stage loaded).
- **Human approval reference:** Owner requested the fix, 2026-07-22.

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [x] Open questions are resolved or explicitly deferred (3 resolved at implementation).
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed (amends SPEC-004; realizes SPEC-002 REQ-006).
- [x] Human approval recorded before status set to Approved (owner instructed
      implementation, 2026-07-21).
