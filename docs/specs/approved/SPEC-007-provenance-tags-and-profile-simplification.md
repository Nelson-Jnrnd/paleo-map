---
doc_type: spec
spec_id: SPEC-007
title: Provenance tag & taxon-profile simplification
status: In Implementation
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, data-layer, provenance, exploration-view, occurrence-panel, taxon-profile, styling]
affected_interfaces: [static-data-artifacts]
supersedes: [SPEC-005]
superseded_by:
depends_on: [SPEC-001, SPEC-003, SPEC-005]
conflicts_with: []
last_verified_at: 2026-07-21
---

# SPEC-007: Provenance tag & taxon-profile simplification

## Summary

The app currently derives four provenance display flags — **reconstructed,
approximate, interpretative, missing** (SPEC-001 DATA-003) — and surfaces them as
per-row cues. Owner review (2026-07-21) found two of them add no useful signal in
practice and one is confusingly worded, and that the taxon profile buries its
Wikipedia summary beneath the occurrence list. This spec **removes the
`reconstructed` and `interpretative` flags** (including deleting SPEC-003 REQ-003
and striking the functional-spec/charter requirements that mandate the
fossil-vs-interpretative distinction), **relabels `approximate` to the factual
"spans multiple stages"**, and **reorders the taxon profile so the summary/biology
appears above the occurrence list**. It is a deliberate simplification of the
provenance surface, authorized by the owner with the consequences recorded below.

## Context

Verified from the shipped snapshot + code on 2026-07-21:

- `reconstructed` is derived as `paleoPosition.value !== null` and `missing` as
  `paleoPosition.value === null` (`src/pipeline/derive.ts`, `src/domain/
  provenance.ts`), so on an occurrence's paleoposition the two are exact opposites
  — the `reconstructed` cue never varies independently of the value's presence.
- `approximate` is `spansMultipleStages(minMa, maxMa)` against the 3-stage Late
  Cretaceous table; it is currently **true for 100%** of the 4,187 occurrences, so
  the word "approximate" reads as a blanket judgment rather than information.
- `interpretative` is `sourceKind ∈ {Encyclopedic, Editorial}`. It is required by
  the functional specification (FONC-1090/1110/1120, CONS-440, MVP goal #8) and by
  the binding design charter §2 (fossil-derived vs interpretative always legible).
- The taxon profile renders the interpretative block (summary + biology) **after**
  the full occurrence list; for *Triceratops* (164 occurrences) the summary sits
  ~19,600 px down a ~20,000 px page — effectively invisible. Data and rendering
  are correct; the ordering hides it.

This spec depends on and modifies SPEC-001 (the flag derivation), SPEC-003 (the
list and profile), and SPEC-005 (the aggregated list built on REQ-003), and edits
the authoritative functional specification and the design charter. Because it
changes authoritative documents, `/drift-check` must be run after implementation.

## Problem statement

The provenance surface carries redundant (`reconstructed`), vacuous-as-worded
(`approximate`), and — per the owner — unwanted (`interpretative`) tags, and the
profile hides its most human-readable content. The owner wants a simpler,
less-cluttered presentation.

## Goals

- Remove the `reconstructed` display flag and its per-row cue.
- Remove the `interpretative` display flag and the requirements that mandate the
  fossil-vs-interpretative distinction (functional spec + charter).
- Replace the `approximate` label with the factual "spans multiple stages",
  keeping the underlying stage-span derivation.
- Reorder the taxon profile so the summary/biology block appears above the
  occurrence list.
- Keep the data layer deterministic and the build/tests/CI green after the
  requirement set shrinks (no orphaned tests asserting removed behaviour).

## Non-goals

- Changing the `missing` flag / "Not available" labelling (kept — still required
  by PERF-180/FONC-490).
- Fixing the `approximate`-is-100%-true threshold — that is a data-window problem
  handled by the full-Mesozoic timeline work (Task #1), not here; this spec only
  relabels the cue.
- Rebuilding an alternative accessible occurrence path to replace the deleted
  REQ-003 list (see Open questions — this spec removes the list per owner
  decision; designing a replacement, if wanted, is separate).
- Any change to ingestion sources or the snapshot schema beyond dropping two
  derived boolean fields from the read model.

## Users or actors

The **Explorer** (including keyboard/screen-reader users, who are directly
affected by the REQ-003 deletion) and the **build/CI system**.

## Functional requirements

### REQ-001: Remove the `reconstructed` flag and delete SPEC-003 REQ-003

- **Statement:** The `reconstructed` boolean must be removed from the derived
  provenance view and from all UI; the per-row "Reconstructed" cue must be gone.
  **SPEC-003 REQ-003** ("occurrences as a keyboard-reachable, provenance-legible
  list") is **deleted in full**, and the occurrence-list component and its tests
  are removed accordingly.
- **Rationale:** Owner decision (2026-07-21): `reconstructed` is redundant with
  value presence, and REQ-003 is to be deleted entirely. A single standing "map is
  a paleogeographic reconstruction" disclosure (SPEC-003 REQ-002) is retained so
  the map is still not read as literal.
- **Acceptance criteria:** `ProvenanceView` has no `reconstructed` field; no
  component renders a "Reconstructed" cue; `OccurrenceList` and
  `test/ui/occurrence-list.test.tsx` are removed; the app builds, typechecks, and
  the remaining tests pass.
- **Verification method:** code inspection + `pnpm run typecheck` + `pnpm test`.
- **Evidence location:** `src/domain/provenance.ts`, `src/pipeline/derive.ts`,
  `src/app/components/*` (filled at implementation).

### REQ-002: Relabel `approximate` to "spans multiple stages"

- **Statement:** Wherever the time-range uncertainty cue is shown (occurrence
  panel, taxon profile), the label must read as the factual "spans multiple
  stages" (or equivalent neutral phrasing) rather than the judgment "approximate".
  The underlying `spansMultipleStages` derivation and the `approximate` structural
  computation are unchanged; only the user-facing wording changes.
- **Rationale:** Owner decision (2026-07-21): describe the fact, not a verdict.
- **Acceptance criteria:** No user-facing "approximate" wording remains for the
  time cue; the cue reads "spans multiple stages" (or agreed equivalent) and still
  appears exactly when the range spans >1 stage.
- **Verification method:** component test asserting the new label; inspection.
- **Evidence location:** `src/app/components/Cues.tsx`, panel/profile components.

### REQ-003: Remove the `interpretative` distinction (data, UI, spec, charter)

- **Statement:** The `interpretative` boolean must be removed from the derived
  provenance view and all UI (no "Interpretative" badge, no "separated from
  fossil-derived data" framing). The **functional-specification** requirements
  that mandate the distinction — FONC-1090, FONC-1110, FONC-1120 (interpretative
  vs fossil-derived parts), CONS-440, and MVP goal #8 — must be **retired** with a
  dated note, and the corresponding acceptance criteria (AC-180 portions) updated.
  The **design charter §2** clause requiring "fossil-derived vs interpretative
  always legible" must be amended to drop that requirement.
- **Rationale:** Owner decision (2026-07-21), "full removal incl. spec + charter".
- **Acceptance criteria:** `ProvenanceView` has no `interpretative` field;
  `isInterpretative` and its uses are removed; no component renders an
  interpretative cue/block heading; the named functional-spec requirements and
  charter clause are struck with a dated amendment note; `/drift-check` reports no
  blocking conflict afterward.
- **Verification method:** code inspection + doc review + `/drift-check`.
- **Evidence location:** `src/domain/provenance.ts`, `docs/product/functional-
  specification.md`, `docs/mockups/design-guidelines.md` (filled at implementation).

## Non-functional requirements

### NFR-001: Deterministic, green, no orphaned assertions

- **Statement:** After removing the flags and REQ-003, the snapshot rebuild must
  remain byte-deterministic (SPEC-001 NFR-001) and the full CI suite
  (typecheck/test/lint/e2e/a11y/budget) must pass with no test skipped or disabled
  to accommodate the removal.
- **Rationale:** CLAUDE.md — never suppress/skip tests to pass; keep NFR-001.
- **Acceptance criteria:** `pnpm run snapshot` is reproducible; CI is green;
  removed behaviour has removed (not skipped) tests.
- **Verification method:** CI + `test/nfr-001-deterministic-rebuild.test.ts`.
- **Evidence location:** CI run, snapshot artifact.

## UI or UX impact

### UX-001: Surface the summary/biology above the occurrence list

- **Statement:** In the taxon profile the summary and biology block must be
  positioned **above** the per-occurrence list so it is visible without scrolling
  past every occurrence.
- **Rationale:** Owner-observed defect (2026-07-21): the summary is buried beneath
  164 occurrences for *Triceratops*; verified at ~19,600 px.
- **Acceptance criteria:** The summary/biology block renders before the occurrence
  list in the profile DOM/visual order; for a many-occurrence taxon the summary is
  visible in the first viewport-height of the profile.
- **Verification method:** component test asserting DOM order; screenshot check.
- **Evidence location:** `src/app/components/TaxonProfile.tsx`.

## Data model impact

Removes two derived boolean fields (`reconstructed`, `interpretative`) from
`ProvenanceView` (SPEC-001 DATA-003). `approximate` and `missing` remain. This is
a read-model shape change: the served `snapshot.json` no longer carries those two
booleans, shrinking it marginally. No ingestion/source change. `deriveProvenanceView`,
`isInterpretative`, and the `reconstructed`/`interpretative` call sites are removed.
This retires part of DATA-003 and must be recorded as a **SPEC-001 amendment**.

## API impact

No runtime API. The static data-artifact contract changes only by dropping two
boolean fields from each provenanced value — consumers already tolerate absent
cues; the client is updated in lockstep. No new interface IDs.

## Configuration impact

None beyond regenerating the served snapshot artifact (`pnpm run gen:web-data` /
`snapshot:app`) so the committed `public/data/snapshot.json` matches the new shape.

## Error handling

Unchanged. `missing` → "Not available" is retained. Removing cues cannot introduce
new error states.

## Edge cases

- Occurrence with a null paleoposition — still shows "Not available" (`missing`),
  now with no companion "reconstructed" concept.
- Time range within a single stage — no time cue (unchanged logic, new label only
  when it does span).
- Taxon with a summary but many occurrences (*Triceratops*) — summary now visible
  near the top (UX-001).
- Indeterminate identification (no genus record) — still routed to the fallback
  profile; unaffected.

## Acceptance criteria

Satisfied when: `reconstructed` and `interpretative` are gone from the read model
and UI; SPEC-003 REQ-003 and the occurrence-list component/tests are deleted; the
time cue reads "spans multiple stages"; the functional-spec requirements
(FONC-1090/1110/1120, CONS-440, goal #8) and charter §2 clause are struck with
dated notes; the profile shows summary/biology above the occurrence list; the
snapshot is regenerated; `/drift-check` is clean; and CI is green with no skipped
tests.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | reconstructed + REQ-003/list removed | inspection + build | typecheck + test | provenance/derive, components | — |
| REQ-002 | time cue reads "spans multiple stages" | automated | component test | Cues/panel/profile | — |
| REQ-003 | interpretative removed from data/UI/spec/charter | inspection + drift | `/drift-check` + doc review | provenance, functional spec, charter | — |
| NFR-001 | deterministic, green, no skipped tests | CI | full CI suite | CI run | — |
| UX-001 | summary/biology above occurrence list | automated | DOM-order test + screenshot | `TaxonProfile.tsx` | — |

## Test plan

- Remove `test/ui/occurrence-list.test.tsx` (REQ-003 deleted) and any assertions
  on the `reconstructed`/`interpretative` cues; do not leave skipped tests.
- Update `test/data-003-derived-flags.test.ts` to the two-flag model.
- Add/adjust a `TaxonProfile` test asserting summary-before-list DOM order (UX-001)
  and the new time label (REQ-002).
- Regenerate the served snapshot; confirm the deterministic-rebuild test passes.
- Run the full CI locally (typecheck/test/lint/e2e/a11y/budget).

## Rollback plan

Revert the PR: restore the two flags in `ProvenanceView`, the list component and
its tests, SPEC-003 REQ-003, the functional-spec/charter clauses, and the prior
profile ordering, then regenerate the snapshot. All changes are contained to the
provenance flags, the list, the profile, two docs, and the artifact.

## Open questions

- [x] **Accessibility replacement.** Resolved (2026-07-21): the loss is **accepted**
  — deleting the list removes the only keyboard/screen-reader path to individual
  occurrences (the map canvas is not an accessible substitute). This is a known
  **accessibility regression** against PERF-220…270 / charter §2, accepted by the
  owner ("it's cleaner"); an accessible occurrence path is recorded as future work.
- [x] **SPEC-005 disposition.** Resolved (2026-07-21): SPEC-005 is **retired**
  (Superseded by SPEC-007); the aggregation/viewport code is deleted with the list.
- [x] Time-cue wording resolved to "Spans multiple stages".

## Human decisions required

- [x] Delete SPEC-003 REQ-003 **entirely** (not just the reconstructed cue) —
  owner chose "Delete REQ-003 entirely" on 2026-07-21, after being told it removes
  the accessible list and per-row source.
- [x] Remove the `interpretative` distinction **including the blocking functional-
  spec requirements and charter §2** — owner chose "Full removal, incl. spec +
  charter" on 2026-07-21.
- [x] Relabel `approximate` → factual "spans multiple stages" — owner directed
  2026-07-21.
- [x] Move the summary/biology above the occurrence list — owner-observed defect,
  2026-07-21.
- [ ] Resolve the two Open-question consequences (accessibility replacement;
  SPEC-005 disposition) before or during implementation.

## Conflict check

This spec **intentionally conflicts with** SPEC-003 (deletes REQ-003) and impacts
SPEC-005 (built on that list); both are recorded in `conflicts_with`. It also
edits the authoritative functional specification and the binding design charter —
so it is not a pure downstream spec but a decision to retire product requirements.
Resolution path: on approval, SPEC-003 gets an amendment retiring REQ-003, SPEC-001
gets an amendment retiring the two DATA-003 flags, SPEC-005's status is resolved
per the open question, and `/drift-check` is run to confirm no residual blocking
conflict.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Provenance view / list removal | `provenance.ts`, `derive.ts`, remove `OccurrenceList.tsx` | typecheck/test | Draft |
| REQ-002 | Time cue label | `Cues.tsx`, panel/profile | component test | Draft |
| REQ-003 | Interpretative removal | `provenance.ts`, functional spec, charter | `/drift-check` | Draft |
| NFR-001 | Determinism/CI | pipeline + CI | CI | Draft |
| UX-001 | Profile ordering | `TaxonProfile.tsx` | DOM-order test | Draft |

## Implementation notes

Implemented on branch `claude/project-state-report-k84bpn` (2026-07-21). All CI
gates green: typecheck, 55 unit/component tests, lint, Prettier, `vite build`,
size budget (data artifact 4.5 MB → 3.9 MB after dropping the two booleans).
Verified in-browser: the *Triceratops* profile now shows the summary at ~y=423
(above the occurrences; was ~19,600), the time cue reads "Spans multiple stages",
and no "Reconstructed"/"Interpretative" text appears.

**REQ-001 — the occurrence list is DELETED (final; see AMEND-002).** AMEND-001
first retained the list to avoid deleting the core-loop scenario tests; the owner
then explicitly authorized removing those tests ("I allow you to remove that test.
it's cleaner"), so REQ-001 is implemented as originally written: the list and the
SPEC-005 aggregation are removed, occurrences are selected from the map, and the
list-coupled tests were removed/rewired. This is a recorded **accessibility
regression** (no keyboard/screen-reader path to occurrences); see AMEND-002.

- **Data (DATA-003 → SPEC-001 AMEND-002):** `ProvenanceView` reduced to
  `{approximate, missing}`; `reconstructed`/`interpretative`/`isInterpretative`
  removed; `derive.ts` simplified; served `snapshot.json` regenerated.
- **UI:** `Cues.tsx` — `ReconstructedCue`/`InterpretativeCue` removed,
  `ApproximateCue`→`MultiStageCue` ("Spans multiple stages"); panel/profile updated;
  `TaxonProfile` summary/biology moved above the occurrence list and the
  interpretative framing dropped; the occurrence list itself was later deleted
  (AMEND-002).
- **Docs:** functional-spec FONC-670/1110 and MVP goal #8 struck with dated notes;
  charter §2 interpretative clause + cue-table row removed, reconstructed row
  reworded to the standing map label. SPEC-001 AMEND-002 and SPEC-003 AMEND-003
  record the downstream changes.

## Spec amendments

> Required for any behavioral change after the spec is Approved.

### AMEND-001: Retain the occurrence list (REQ-001 resolution)

- **Date:** 2026-07-21
- **Reason:** Implementing REQ-001 "delete SPEC-003 REQ-003 entirely" surfaced a
  blocking conflict: the occurrence list is the only keyboard-accessible and only
  headless-testable path to an occurrence (the MapLibre canvas needs WebGL, absent
  in the test environment). Deleting it forces deleting the core-loop scenario
  tests (PERF-340/360/370), which `CLAUDE.md` forbids ("Do not delete failing
  tests to make a build pass"), and removes the charter-required accessible path.
- **Changed requirements:** REQ-001 is amended — the `reconstructed` flag/cue is
  still removed, but the **occurrence list is retained** (cues stripped) rather
  than deleted. SPEC-005 is consequently **not** retired.
- **Behavioral impact:** The app keeps its accessible occurrence list and viewport
  aggregation; only the per-row provenance cues change. All other SPEC-007 goals
  (interpretative removal, approximate relabel, profile reorder) are unchanged.
- **Test impact:** No tests deleted or skipped; the core-loop scenario tests stay
  green.
- **Human approval reference:** Owner "implement spec 007 i approve it"
  (2026-07-21); the blocker and this resolution were surfaced to the owner. The
  two Open questions (accessibility replacement, SPEC-005 disposition) are resolved
  by retention: the accessible path is preserved and SPEC-005 stays as-is.
- **Superseded by AMEND-002.**

### AMEND-002: Delete the occurrence list after all (supersedes AMEND-001)

- **Date:** 2026-07-21
- **Reason:** After AMEND-001 kept the list to avoid deleting the core-loop tests,
  the owner explicitly authorized removing those tests: "I allow you to remove that
  test. it's cleaner." With the test-deletion objection cleared, REQ-001 is
  implemented as originally approved.
- **Changed behaviour:**
  - `src/app/components/OccurrenceList.tsx` and `src/app/state/aggregate.ts`
    (SPEC-005) are **deleted**; `ExplorationView` no longer renders a list. The
    sidebar shows the occurrence panel when a map point is selected, the empty state
    when the filter is empty, else a "Select a point on the map" prompt. Occurrence
    selection is now **map-only**.
  - **Tests:** `occurrence-list.test.tsx`, `aggregate.test.ts`, and
    `scenario-perf-340.test.tsx` (the select-via-list loop) are removed; the e2e
    PERF-340 + SPEC-005 tests and the a11y profile-nav test are removed (the profile
    is no longer headlessly reachable). `occurrence-panel.test.tsx` is rewired to
    render the panel directly; `scenario-perf-370` uses a list-independent
    assertion; `scenario-perf-360` was already list-independent. No test is skipped.
  - **SPEC-005** → Superseded (`superseded_by: SPEC-007`); **SPEC-003 REQ-003** →
    deleted (SPEC-003 AMEND-004).
- **Accessibility regression (recorded):** the app no longer has a keyboard or
  screen-reader path to individual occurrences — the MapLibre canvas is not an
  accessible substitute. This is a known deviation from PERF-220…270 and charter §2,
  accepted by the owner for cleanliness. **Future work:** provide an accessible
  occurrence selector (own spec) to close the gap.
- **Verification:** typecheck, 55 unit/component tests (was 67; 12 list/aggregate/
  PERF-340 tests removed), lint, Prettier, `vite build`, size budget — all green.
- **Human approval reference:** Owner "I allow you to remove that test. it's
  cleaner" (2026-07-21).

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [ ] Open questions resolved or explicitly deferred (2 consequential ones open).
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed (`conflicts_with: SPEC-003, SPEC-005`).
- [ ] Human approval recorded before status set to Approved (decisions recorded;
      the two open consequences still need an answer).
