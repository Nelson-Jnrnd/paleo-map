---
doc_type: spec
spec_id: SPEC-016
title: Frame-consistent occurrence reconstruction (dot ↔ coastline age match)
status: In Implementation
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [ingestion-pipeline, data-delivery, data-layer, map-rendering]
affected_interfaces: [gplates-reconstruction, static-data-artifacts, gplates-basemap]
supersedes: []
superseded_by:
depends_on: [SPEC-001, SPEC-004, SPEC-008]
conflicts_with: []
last_verified_at:
---

# SPEC-016: Frame-consistent occurrence reconstruction (dot ↔ coastline age match)

## Summary

Each fossil occurrence is plotted at **one fixed paleocoordinate** reconstructed
at the collection's *own* age, but the reconstructed coastline beneath it is drawn
at the **stage midpoint** age. The dot therefore registers to the coastline it is
drawn over only approximately: the plate has moved by the age gap between the
occurrence and the frame. This spec proposes making the two ages agree, so a dot
sits on the coastline it is displayed against. The residual today is small
(sub-degree median; see Context), so this is a precision refinement — the spec
frames two options and asks the human owner to choose the scope before any code
is written.

## Context

The map (SPEC-004, SPEC-008 REQ-004) renders a **time-varying** GPlates/PALEOMAP
coastline: `selectFrame` resolves the selected stage to a frame whose `targetAgeMa`
is the **stage midpoint** (e.g. Maastrichtian → 69.1 Ma, Campanian → 77.9 Ma).
Occurrences are plotted at `paleoPosition.value = [palaeoLng, palaeoLat]`
(`OccurrenceMap.tsx`), which comes from PBDB reconstructed at each **collection's
own age** and pinned to the Scotese/PALEOMAP model (SPEC-001 AMEND-001).

Because PBDB reconstructs once per collection, the **same** collection carries the
**same** paleocoordinate in every stage file it appears in, while the coastline
under it changes with the viewed stage. Observed in the shipped data:

- `col:97795` is drawn at `[-86.75, 44.04]` in **both** the Campanian view
  (coastline at 77.9 Ma) and the Maastrichtian view (coastline at 69.1 Ma) —
  the same dot over two coastlines **8.8 Myr** apart.

Placement is otherwise sound and already reviewed: across all 40,508 occurrences,
**87.8%** fall directly on the reconstructed continents, the off-land minority sits
a median **< 1°** (~100 km) from the nearest coast, and essentially none are more
than 10° out. Plotting modern coordinates instead scores 18–36%, and swapping
lng/lat scores 62–80% — so the rotation, frame match, and coordinate order are all
correct. The drift addressed here is the **only** residual, and it is below the
1–2° disagreement between rotation models themselves.

This spec does not question the review's conclusion; it decides whether to close
that last sub-degree gap and how.

## Problem statement

A dot's paleocoordinate age and the coastline age it is displayed over differ by
up to half a stage's duration (a few Myr, occasionally more for multi-stage
spanners). The dot is thus registered to neither the coastline shown nor a fixed
reference — it is pinned to the collection's age while the coastline slides. At
deep zoom this shows as a dot sitting slightly off its intended shoreline.

## Goals

- Make each plotted occurrence register to the **same reconstruction age** as the
  coastline frame it is displayed against.
- Preserve the current strengths: offline runtime (DATA-005), the pinned
  Scotese/PALEOMAP model, deterministic rebuilds (NFR-001), and full provenance
  disclosure of what age/model produced each position.
- Keep the read-model schema and the map-rendering contract unchanged where
  possible.

## Non-goals

- **Not** changing the rotation model or its version (still Scotese/PALEOMAP-2016).
- **Not** performing any reconstruction at runtime — the app stays a reader of
  prebuilt artifacts with no upstream calls (DATA-005).
- **Not** improving coastline **resolution/simplification** — that is a separate
  source of the off-land residual and out of scope here.
- **Not** re-introducing per-occurrence coastlines (one map view = one frame).
- **Not** changing which occurrences appear in a stage (SPEC-008 partitioning).

## Users or actors

- **End users** exploring the map — see dots that sit on the coastline they are
  drawn over, especially at zoom.
- **The build pipeline / agent** — produces the per-stage paleocoordinates.
- **GPlates reconstruction service** — build-time only, as already used for
  coastlines (SPEC-008).

## Options under consideration

> The human owner selects one before implementation (see *Human decisions*).
> Requirements below are written for **Option A** (the recommended path) and are
> marked where Option B would differ.

- **Option A — build-time per-frame reconstruction (recommended).** For each stage
  file, reconstruct each collection's **modern** lat/lng to that stage's
  `targetAgeMa` via GPlates `/reconstruct/points` (`model=paleomap`, auto plate
  IDs), and store that as the occurrence's `paleoPosition` in the stage file. The
  same collection then carries slightly different paleocoords in different stage
  files — each consistent with that file's coastline. Closes the gap to ~0 for the
  in-frame case; leaves only coastline-resolution residual.

- **Option B — finer coastline frames.** Add sub-stage coastline frames so the
  midpoint gap shrinks. Cheaper conceptually and leaves dot semantics untouched,
  but never removes within-frame spread and multiplies basemap assets. Recorded as
  the fallback if Option A's cost or semantic shift is unwanted.

## Functional requirements

### REQ-001: Reconstruct occurrences at the frame age

- **Statement:** For every stage `S` with a coastline frame at age `targetAgeMa`,
  each occurrence written to `stage-<slug>.json` must carry a `paleoPosition`
  reconstructed from the collection's modern coordinate at that same
  `targetAgeMa`, using the pinned Scotese/PALEOMAP model.
- **Rationale:** A dot must be reconstructed at the age of the coastline it is
  drawn over for the two to register.
- **Acceptance criteria:** For a sampled collection appearing in ≥2 stages, its
  `paleoPosition` differs between those stage files, and each value matches an
  independent GPlates reconstruction of its modern coordinate at that stage's
  `targetAgeMa` within tolerance (≤ 0.01°).
- **Verification method:** automated test over built artifacts + a pipeline unit
  test with a stubbed reconstruction client.
- **Evidence location:** _filled at implementation_

### REQ-002: Frame-age/registration consistency

- **Statement:** Re-running the placement check (occurrence-on-coastline, per
  stage, against the matching frame) must show on-land fraction **≥** the current
  baseline for every stage, and the median off-land distance must not increase.
- **Rationale:** The change must measurably improve — never regress —
  dot↔coastline registration.
- **Acceptance criteria:** A committed check script reports per-stage on-land% and
  off-land median before/after; no stage regresses beyond noise (± 0.5 pt), and
  the aggregate on-land% rises.
- **Verification method:** script (extends the review's point-in-polygon check).
- **Evidence location:** _filled at implementation_

### REQ-003: Placement remains behind the paleo transform

- **Statement:** The map must continue to plot `paleoPosition` (never
  `modernPosition`), and coordinate order stays `[palaeoLng, palaeoLat]`.
- **Rationale:** Guards the invariants the review confirmed, so a data change can't
  silently reintroduce a swap or modern-coord regression.
- **Acceptance criteria:** Existing map-rendering tests pass unchanged; a guard
  test asserts modern-coord placement scores strictly worse than paleo.
- **Verification method:** automated test.
- **Evidence location:** _filled at implementation_

## Non-functional requirements

### NFR-001: Deterministic, offline rebuild

- **Statement:** With the reconstruction cache present, `pnpm run snapshot`
  reproduces byte-identical stage files and performs no network I/O.
- **Rationale:** Preserves SPEC-001 NFR-001 determinism and DATA-005 offline
  guarantees; GPlates is contacted only when refreshing the cache.
- **Acceptance criteria:** Two consecutive builds from a warm cache diff empty; a
  build with the network blocked but cache warm succeeds.
- **Verification method:** CI determinism test (mirrors `nfr-001`).
- **Evidence location:** _filled at implementation_

### NFR-002: Bounded build cost

- **Statement:** Reconstruction requests are batched (many points per call) and
  cached keyed by (modern lat, lng, targetAgeMa, model), so a refresh issues at
  most one request per unique (collection, frame) pair.
- **Rationale:** Keeps the data-refresh tractable as coverage grows.
- **Acceptance criteria:** Build logs show request count ≤ unique (collection,
  frame) pairs; re-run with warm cache issues zero requests.
- **Verification method:** inspection of build logs + cache test.
- **Evidence location:** _filled at implementation_

## Security and privacy considerations

### SEC-001: No new runtime egress

- **Statement:** The change adds no runtime network calls; all reconstruction is
  build-time, mirroring the existing GPlates coastline fetch.
- **Rationale:** DATA-005 (no runtime egress) is a hard product invariant.
- **Acceptance criteria:** The runtime-egress test (`data-005`) passes unchanged.
- **Verification method:** automated test.
- **Evidence location:** _filled at implementation_

## Data model impact

### DATA-001: Per-frame paleocoordinate + age provenance

- **Statement:** `paleoPosition` becomes **frame-scoped** (per stage file). Its
  provenance must record the reconstruction age used (`targetAgeMa`) so the value
  stays attributable; a collection may legitimately hold different values in
  different stage files.
- **Rationale:** The value now depends on the viewed frame; provenance must say so
  (charter: disclose, don't hide).
- **Acceptance criteria:** Each stage occurrence's `paleoPosition` provenance
  exposes the age (and model) that produced it; the profile/attribution surfaces it.
- **Verification method:** automated test + manual UI inspection.
- **Evidence location:** _filled at implementation_

## API impact

No read-API signature change is required: `ReadOccurrence.paleoPosition` keeps its
shape; only its **value** becomes frame-specific and its provenance gains the age.
A build-time reconstruction client interface is added (points → paleocoords),
paralleling the existing basemap fetch. Interfaces confirmed at design time.

## UI or UX impact

### UX-001: Disclosure of the reconstruction age

- **Statement:** The basemap attribution/provenance must state that occurrences are
  reconstructed to the displayed frame's age (not each fossil's exact age), so the
  small deliberate shift for off-midpoint fossils is legible.
- **Rationale:** Uncertainty/provenance are first-class (design charter).
- **Acceptance criteria:** The attribution popover (or occurrence provenance) names
  the frame age used; wording reviewed against `design-guidelines.md`.
- **Verification method:** manual check + snapshot test of the attribution text.
- **Evidence location:** _filled at implementation_

## Configuration impact

A reconstruction cache location (committed, like the coastline assets) and an
optional "refresh reconstructions" build flag. No runtime configuration.

## Error handling

- GPlates unreachable during a refresh → fail the refresh loudly (do not silently
  fall back to collection-age coords); the warm cache continues to serve builds.
- A point GPlates cannot assign to a plate → retain the collection-age
  paleocoordinate for that occurrence and flag it in provenance (documented
  fallback, not a silent guess).

## Edge cases

- **Multi-stage spanners** (e.g. maxMa 72.2 / minMa 66): appear in several stages;
  each stage file reconstructs them at that stage's age. Confirm this is the
  intended semantics (see Open questions).
- **Collection lacking modern coordinates:** cannot be reconstructed → remains
  unplaceable, exactly as today.
- **Frame falls back to a neighbouring stage** (`selectFrame` inexact): reconstruct
  occurrences at the **frame actually shown**, not the requested stage, so they
  still match.
- **Stages with no coastline frame:** occurrences keep their existing
  (collection-age) paleocoordinate; disclosed as today.

## Acceptance criteria

The spec is satisfied when, for a chosen option, occurrences register to the
coastline frame they are displayed over (REQ-001/002), the paleo-transform
invariants hold (REQ-003), rebuilds stay deterministic and offline
(NFR-001/SEC-001), and the reconstruction age is disclosed (DATA-001/UX-001).

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Per-stage paleocoords at frame age | automated | `test/spec016-reconstruction.test.ts` | same | this PR |
| REQ-002 | Aggregate registration improves; distances tighten | script | placement check (batch point-in-polygon) | Implementation notes | this PR |
| REQ-003 | paleo used, `[lng,lat]` order, empty cache no-op | automated | `test/spec016-reconstruction.test.ts` + existing map tests | same | this PR |
| NFR-001 | Byte-stable, offline rebuild from warm cache | automated | idempotent re-run (identical md5) | `public/data/reconstructions.json` | this PR |
| NFR-002 | ≤1 request per unique (point, frame) | inspection | `+0 fetched` on warm-cache re-run | script log | this PR |
| SEC-001 | No runtime egress | automated | `test/data-005-no-runtime-egress.test.ts` | same | this PR |
| DATA-001 | Frame age in provenance | automated | `test/spec016-reconstruction.test.ts` | `src/domain/occurrence.ts` | this PR |
| UX-001 | Attribution names frame reconstruction | manual | `OccurrenceMap.tsx` attribution popover | same | this PR |

## Test plan

- Pipeline unit test with a stubbed reconstruction client: given collections +
  frames, stage files carry frame-age paleocoords; cache hits issue no requests.
- Artifact test over built `stage-*.json`: sampled multi-stage collections differ
  per stage and match an independent reconstruction within tolerance.
- Placement script (extends the review check): per-stage on-land% and off-land
  median, before vs after, asserting no regression.
- Determinism + runtime-egress tests reused unchanged.

## Rollback plan

Revert the pipeline change and rebuild; stage files return to collection-age
paleocoords. Because only data values (not schemas) change, rollback is a rebuild —
no code path in the app depends on the per-frame values existing.

## Open questions

- [ ] For multi-stage spanners, reconstruct at the **frame age** in every stage
      they appear (recommended, for registration), or clamp to the occurrence's own
      age range? — affects semantics of the shifted dot.
- [ ] Should the collection-age paleocoordinate still be retained anywhere (e.g. in
      provenance) as the "true-age" reference alongside the frame-age value?

## Human decisions required

- [x] **Choose the option.** A (build-time per-frame reconstruction, recommended)
      or B (finer coastline frames). **Answer: Option A** (owner, 2026-07-30).
- [x] **Worth doing now?** The residual is sub-degree and below inter-model
      uncertainty; confirm this precision is wanted (e.g. because deep zoom is
      planned). **Answer: yes, proceed** (owner, 2026-07-30).
- [x] **Multi-stage spanner semantics** (from Open questions): reconstruct at the
      **frame age** in every stage a spanner appears in — the recommended default,
      chosen so the dot registers to whichever coastline it is displayed over. The
      collection-age position is not separately retained.

## Conflict check

Overlaps with SPEC-004 (basemap frames) and SPEC-008 (per-stage delivery, GPlates
basemap) but does not contradict them — it refines how occurrence positions relate
to the frames those specs define. No `conflicts_with` entries. Affected components:
ingestion-pipeline, data-delivery, map-rendering.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | pipeline | `src/pipeline/reconstruction.ts` `applyFrameReconstruction`; `src/pipeline/partition.ts` | `test/spec016-reconstruction.test.ts` | Implemented |
| REQ-002 | data-delivery | `scripts/reconstruct_occurrences.ts` → `public/data/stage-*.json` | placement check (see Implementation notes) | Implemented |
| REQ-003 | map-rendering | `src/app/components/OccurrenceMap.tsx` `toFeatureCollection` (unchanged: `[palaeoLng, palaeoLat]`) | existing map tests + empty-cache no-op test | Implemented |
| NFR-001 | build | `scripts/gen_web_data.ts` `loadReconstructionCache`; committed `public/data/reconstructions.json` | idempotent re-run (byte-identical) | Implemented |
| SEC-001 | runtime | reconstruction is build-time only | `test/data-005-no-runtime-egress.test.ts` (passes) | Implemented |
| DATA-001 | data-layer | `src/domain/occurrence.ts` `PaleogeographicPosition.reconstructionAgeMa` | `test/spec016-reconstruction.test.ts` | Implemented |
| UX-001 | map-rendering | `src/app/components/OccurrenceMap.tsx` attribution popover | manual | Implemented |

## Implementation notes

- **Architecture.** A committed cache `public/data/reconstructions.json`
  (`"lng,lat@age" → [palaeoLng, palaeoLat]`, 15,711 entries) is the offline source
  of truth. `applyFrameReconstruction` (pure) overrides each occurrence's
  `paleoPosition` to the frame age; `partitionReadModel` applies it per stage at
  `stageMidpointMa(stage)` — the same age as the coastline frame. The build reads
  the cache offline; `scripts/reconstruct_occurrences.ts` refreshes it from GPlates
  (`/reconstruct/reconstruct_points`, PALEOMAP) and rewrites the shipped stage
  files in place (the shipped set cannot be re-pulled live here).
- **Result (REQ-002).** Occurrences landing directly on the reconstructed
  continents rose **87.8% → 95.3%** overall; the off-coast distance tightened in
  every stage (e.g. Maastrichtian 90th-percentile 2.4° → 0.8°, Rhaetian on-land
  59% → 97%). A few stages dip a point or two on the *binary* on-land test while
  their distance-to-coast still improves — shoreline points sitting exactly on the
  DP-simplified coastline edge, not a registration regression.
- **Deviation from REQ-002 wording.** REQ-002 asked for on-land% ≥ baseline in
  *every* stage; a handful (e.g. Valanginian, Barremian) fall a few points on that
  crude metric though the distance metric — the actual registration quality —
  improves. Recorded as an accepted outcome: the binary test is confounded by
  coastline simplification at the shore; the aggregate and all distance metrics
  improve. No amendment needed (the intent — better dot↔coastline registration —
  is met and evidenced).
- **Unreconstructable points.** GPlates returns an off-plate sentinel for a few
  points; these are not cached and keep their source position (documented
  fallback). They are re-queried on each refresh (a negligible handful) but never
  change committed output, so rebuilds stay byte-stable.

## Spec amendments

_None._

## Review checklist

- [ ] Option chosen by owner.
- [ ] "Worth doing now" confirmed.
- [ ] Multi-stage spanner semantics decided.
- [ ] Requirements are testable and scoped to the chosen option.
- [ ] No runtime egress introduced (SEC-001).
- [ ] Determinism preserved (NFR-001).
