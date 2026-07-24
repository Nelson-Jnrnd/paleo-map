---
doc_type: spec
spec_id: SPEC-011
title: Exploration polish — panel text overflow, profile label cleanups, reset affordance & summary artifact
status: Draft
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, exploration-view, occurrence-panel, taxon-profile, context-bar, styling, pipeline, ingestion]
affected_interfaces: []
supersedes: []
superseded_by:
depends_on: [SPEC-003, SPEC-007, SPEC-008]
conflicts_with: []
last_verified_at: 2026-07-24
---

# SPEC-011: Exploration polish — panel text overflow, profile label cleanups, reset affordance & summary artifact

## Summary

A batch of small, low-risk correctness and legibility fixes to the shipped
exploration view, all raised in an owner usability review (2026-07-24). None
adds a feature: each removes a defect that makes the app read as unfinished or
confusing. In scope: (1) right-hand value text (Source, Paleogeographic
position) is **truncated at the panel edge** and must wrap; (2) a stray
**"Main content" label** appears in the taxon-profile header and must go;
(3) some ingested summaries carry a **dangling empty parenthetical**
(`Alamosaurus (; meaning "Ojo Alamo lizard")`) that must be cleaned;
(4) the **"Reset filters" button is mislabelled** — the app exposes no filters;
(5) the taxon profile shows a **wider header time span than its per-age
occurrence rows** with no explanation, reading as a data inconsistency. The
counterintuitive **period quick-select target** (clicking "Triassic" lands on
the Rhaetian) is recorded here as an **open human decision**, not a silent
change.

## Context

Verified against the shipped code on 2026-07-24:

- `src/app/components/OccurrencePanel.tsx` renders Source and Paleogeographic
  position inside `.fieldGrid` (`grid-template-columns: max-content 1fr`,
  `exploration.module.css:672`). The `1fr` value track has the CSS default
  `min-width: auto`, so a long source reference or coordinate string cannot
  shrink the track and overflows the panel's right edge. `.fieldValue`
  (`:687`) sets no `overflow-wrap`. The same grid is reused in the taxon
  profile.
- `src/app/components/TaxonProfile.tsx:118` renders a literal
  `<span className={styles.source}>Main content</span>` in the profile header,
  after the validity line, bound to no taxon data. "Main content" is a
  glossary term (`docs/product/glossary.md` — the non-avian-dinosaur editorial
  scope, FONC-340/CONS-030); as a bare header label it conveys nothing about
  the taxon and reads as leftover scaffolding.
- Summaries are ingested verbatim from the Wikipedia REST `extract`
  (`src/pipeline/ingest.ts:98`, `wikipediaByQid.get(binding.qid)?.extract`).
  When the lead sentence's pronunciation glyph is absent, the surrounding
  parenthesis survives as `(; meaning …`, an artefact carried into the profile.
- `src/app/components/ContextBar.tsx:65` and `src/app/components/states.tsx:80`
  label the reset control "Reset filters". The `reset` action
  (`src/app/state/exploration.ts:137`) restores the whole exploration state to
  defaults (age, group, selection, viewport) per FONC-080. The app surfaces no
  user-set filters, so "filters" is misleading — the review-reader expected
  hidden filter controls that do not exist.
- The taxon profile header time range uses the whole-snapshot aggregate
  `profile?.timeSpan` (SPEC-008 AMEND-001), e.g. Alamosaurus 83.6–66 Ma, while
  the occurrence rows below list the occurrences loaded at the selected age,
  e.g. 72.2–66 Ma (`TaxonProfile.tsx:56–58,173–179`). Both are correct at
  different scopes; unlabelled, the pair reads as contradictory.
- The period quick-select (`ExplorationView.tsx:251` → `representativeByPeriod`,
  `src/app/data/atlas.ts:167`) jumps to the stage flagged `representative` —
  the **most-populated** stage of the period (SPEC-008 REQ-003). For the
  Triassic that is the Rhaetian (208–201 Ma), the very end of the period, which
  the reviewer found counterintuitive.

## Problem statement

The exploration view is functionally solid but carries a handful of visible
defects — clipped provenance text, a meaningless label, a Wikipedia import
artefact, a misleading button, and an unexplained time-span mismatch — that
undermine the product's core promise that provenance and uncertainty are always
legible and trustworthy.

## Goals

- Provenance and coordinate values are always fully legible, never clipped.
- The taxon profile header shows only meaningful, taxon-specific labels.
- Ingested summaries are free of empty/dangling parenthetical artefacts.
- The reset control's label matches what it actually does.
- The profile's full-record span and per-age occurrence rows are
  distinguishable, so neither reads as a bug.

## Non-goals

- No change to which data is shown, only how it is labelled and wrapped.
- No new filter controls (the "filters" wording is corrected, not backfilled).
- No redesign of the timeline or the occurrence/taxon/locality modes.
- Changing the period quick-select **target** is out of scope until the owner
  decides (see Human decisions required); this spec does not alter it.
- No image/silhouette work (tracked separately as future scope).

## Users or actors

The Explorer (end user) reading the occurrence panel and taxon profile; the
build-time ingestion pipeline that produces the static snapshot.

## Functional requirements

### REQ-001: Value text wraps instead of truncating

- **Statement:** In the occurrence panel and taxon profile, long field values —
  specifically Source and Paleogeographic position — must wrap and remain fully
  visible within the panel at the app's minimum supported width, with no
  horizontal clipping or overflow past the panel edge.
- **Rationale:** The design charter requires provenance to be always legible,
  never hidden; a clipped source citation or coordinate breaks that promise.
- **Acceptance criteria:** At a 320 px-wide viewport, the full Source reference
  and the full `paleoLat°, paleoLng°` string render inside the panel with no
  clipped characters and no horizontal scrollbar; the `.fieldGrid` value track
  is allowed to shrink (`min-width: 0`) and `.fieldValue` wraps
  (`overflow-wrap: anywhere` or equivalent).
- **Verification method:** manual check at 320 px + inspection of the CSS rule.
- **Evidence location:** filled at implementation.

### REQ-002: Remove the stray "Main content" header label

- **Statement:** The taxon-profile header must not render the literal
  "Main content" label; the header shows only taxon-specific metadata (name,
  rank, validity).
- **Rationale:** The label is bound to no taxon data and conveys nothing to the
  reader; it reads as unfinished scaffolding.
- **Acceptance criteria:** The rendered profile header contains no
  "Main content" text; existing name/rank/validity content is unchanged.
- **Verification method:** automated component test (Vitest) asserting the
  header does not contain "Main content".
- **Evidence location:** filled at implementation.

### REQ-003: Clean dangling parentheticals in ingested summaries

- **Statement:** The ingestion step must normalise summary text so an empty or
  pronunciation-only leading parenthetical does not survive as a dangling
  fragment — e.g. `Name (; meaning "X")` becomes `Name (meaning "X")`, and a
  parenthetical left entirely empty (`Name (; )` / `Name ()`) is removed.
- **Rationale:** The artefact makes a sourced, honest summary look sloppy and
  auto-scraped.
- **Acceptance criteria:** For a summary input `Foo (; meaning "bar").` the
  ingested value is `Foo (meaning "bar").`; for `Foo (;) baz` and `Foo () baz`
  the value is `Foo baz`; summaries with well-formed parentheticals are
  unchanged.
- **Verification method:** automated unit test (Vitest) over the cleaning
  function with the cases above.
- **Evidence location:** filled at implementation.

### REQ-004: Reset control is labelled for what it does

- **Statement:** The reset control must not be labelled "Reset filters". It is
  relabelled to reflect its actual effect (restoring the default view); the
  underlying reset behaviour (FONC-080) is unchanged.
- **Rationale:** There are no user-set filters; the label implies controls that
  do not exist and invites the reader to hunt for them.
- **Acceptance criteria:** Neither `ContextBar` nor the error state renders the
  string "Reset filters"; the new label describes resetting the view/state; the
  dispatched action and its result are unchanged.
- **Verification method:** automated component test asserting the new label and
  that the reset action still restores defaults.
- **Evidence location:** filled at implementation.

### REQ-005: Distinguish full-record span from per-age occurrences

- **Statement:** The taxon-profile header time range must be labelled as the
  taxon's full recorded span across all occurrences (not the selected age), so
  it is not mistaken for a contradiction with the per-age occurrence rows below.
- **Rationale:** An 83.6–66 Ma header over 72.2–66 Ma rows reads as a data bug
  when it is actually two honest scopes; a label resolves it without changing
  any number.
- **Acceptance criteria:** The header time-range label states it spans the
  taxon's full record (wording e.g. "Recorded span · all occurrences"); the
  displayed Ma values are unchanged; the existing "step the timeline to see this
  taxon at other ages" note remains.
- **Verification method:** automated component test asserting the clarifying
  label is present; manual read-through.
- **Evidence location:** filled at implementation.

## Non-functional requirements

### NFR-001: No regression in existing checks

- **Statement:** `pnpm run typecheck` and `pnpm test` pass, and the governance
  scripts report no new violations, after the change.
- **Rationale:** The batch is a polish pass; it must not destabilise the build.
- **Acceptance criteria:** CI green on the branch; no skipped or deleted tests.
- **Verification method:** CI + local run of the commands in CLAUDE.md.
- **Evidence location:** filled at implementation.

## Security and privacy considerations

None. No new data, network calls, inputs, or permissions are introduced.

## Data model impact

No schema change. REQ-003 changes the *value* of `summary` produced at
ingestion (`src/pipeline/ingest.ts`), not its type (`Provenanced<string>`); the
CC BY-SA provenance and source id are preserved.

## API impact

None.

## UI or UX impact

### UX-001: Legible, honestly-labelled panels

- **Statement:** Covered by REQ-001/002/004/005 — wrapped values, no stray
  label, an accurate reset label, and a disambiguated time span. Changes are
  copy/CSS only; layout, colours, and the charter's teal-accent restraint are
  unchanged.
- **Rationale:** Directly serves the charter's "provenance always legible" and
  "domain language only" tenets.
- **Acceptance criteria:** As per the referenced requirements.
- **Verification method:** manual review against `docs/mockups/design-guidelines.md`.
- **Evidence location:** filled at implementation.

## Configuration impact

None.

## Error handling

REQ-004 touches the error-state reset control (`states.tsx`); its behaviour
(dispatching reset) is unchanged, only its label.

## Edge cases

- Summaries with legitimately nested or multiple parentheticals must not be
  mangled by REQ-003 — only empty/dangling leading fragments are targeted.
- A `null` summary is untouched (stays explicit "not available").
- Very long single-token source ids must still wrap (`overflow-wrap: anywhere`,
  not just `word-break: break-word`).

## Acceptance criteria

All of REQ-001…005 met, NFR-001 green, and the open human decision on the
period quick-select target recorded with the owner's answer before that item is
(separately) actioned.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Source & paleo text fully visible at 320 px | manual + inspection | resize to 320 px; read panel | TBD | TBD |
| REQ-002 | No "Main content" in header | automated | Vitest: TaxonProfile header | TBD | TBD |
| REQ-003 | Dangling parentheticals cleaned | automated | Vitest: summary-cleaning unit | TBD | TBD |
| REQ-004 | No "Reset filters"; reset still works | automated | Vitest: ContextBar/states | TBD | TBD |
| REQ-005 | Header labelled full-record span | automated + manual | Vitest: TaxonProfile label | TBD | TBD |
| NFR-001 | typecheck + tests green | CI | `pnpm run typecheck && pnpm test` | TBD | TBD |

## Test plan

Vitest component tests for the profile header (REQ-002, REQ-005), the reset
label (REQ-004), and a pure unit test for the summary-cleaning helper (REQ-003).
REQ-001 is CSS-only and verified by manual resize plus rule inspection. Full
`pnpm run typecheck` and `pnpm test` before completion (NFR-001).

## Rollback plan

Each fix is independent and self-contained (a CSS rule, a removed span, a copy
change, a pure string helper). Revert the commit; no data migration, no
persisted state, no interface change to undo.

## Open questions

- [ ] REQ-003: keep the cleaning strictly to the leading dangling parenthetical,
      or generalise to any empty `()`/`(;)` anywhere in the text? (Default:
      handle the leading case plus any empty parenthetical, per acceptance
      criteria.)

## Human decisions required

- [ ] **Period quick-select target.** Clicking "Triassic" currently jumps to the
      Rhaetian (most-populated Triassic stage, SPEC-008 REQ-003), i.e. the end of
      the period, which reads as counterintuitive. But jumping to the period
      *start* (Induan) lands on a near-empty map — the opposite complaint. Which
      behaviour do you want?
      **(a)** Keep most-populated (unchanged) and add a small "showing the
      richest stage of the period" hint. **(b)** Jump to period start.
      **(c)** Jump to period midpoint. — Answer: _____
      This item is **not implemented** under this spec until you decide.

## Conflict check

Touches components governed by SPEC-003 (exploration view), SPEC-007 (profile
simplification — this spec removes a header artefact SPEC-007 did not add and
relabels a range, not reordering content) and SPEC-008 (full-Mesozoic window —
REQ-005 clarifies the AMEND-001 aggregate span without changing it; the period
quick-select target from REQ-003 there is left untouched pending the human
decision). No requirement contradicts these specs; `conflicts_with` is empty.
Note (drift, not fixed here): `docs/SPEC_INDEX.md` is missing rows for SPEC-010
and SPEC-011.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | OccurrencePanel / exploration.module.css | TBD | TBD | Pending |
| REQ-002 | TaxonProfile header | TBD | TBD | Pending |
| REQ-003 | pipeline ingest summary | TBD | TBD | Pending |
| REQ-004 | ContextBar / states | TBD | TBD | Pending |
| REQ-005 | TaxonProfile time range | TBD | TBD | Pending |

## Implementation notes

To be filled during implementation.

## Spec amendments

_None yet._

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [ ] Open questions are resolved or explicitly deferred.
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed.
- [ ] Human approval recorded before status set to Approved.
