---
doc_type: spec
spec_id: SPEC-031
title: Quiet atlas interface
status: In Implementation
owner: Nelson Jeanrenaud
related_issue: null
related_prs: [30]
affected_components: [app-frontend, design-guidance]
affected_interfaces: [exploration, taxonomy, taxon-page, dinordle]
supersedes: []
superseded_by:
depends_on: [SPEC-030]
conflicts_with: []
last_verified_at: 2026-10-09
---

# SPEC-031: Quiet atlas interface

## Summary

Implement the interface-review plan approved by the owner on 2026-10-09, reducing controls, simultaneous surfaces and routine source text.

## Context

Approval reference: user message, “Can you do those changes please I validate the plan”. The preceding report is Paleo_Map_Interface_Review.pdf (9 October 2026). The same message clarifies that the header and list counts have distinct scopes; this specification preserves that distinction and supersedes the report's suggestion that the difference needs reconciliation.

## Problem statement

The interface presents too many decisions and technical details before exploration begins.

## Goals

- Make map exploration the default and reduce public feature scope.
- Preserve evidence access, correct data and accessible navigation.

## Non-goals

- New datasets, content generation, a new font, removal of data provenance, article-preview pipelines or deployment to main.
- Rewriting grouping algorithms retained for internal search/data use.

## Functional requirements

### REQ-001: Quieter map browsing

- **Statement:** Default to genus browsing. Public grouping exposes Genus and Locality only. The desktop directory is closed until Browse dinosaurs or a selection opens it; the phone sheet retains its peek. Remove the persistent Wikipedia coverage checkbox while retaining the current data gate.
- **Rationale:** Reduce noise while keeping the useful exploration loop.
- **Acceptance criteria:** The described controls, defaults and disclosure behaviour are observable; retired surfaces are absent from their former primary location.
- **Verification method:** UI integration tests, source inspection and browser checks.
- **Evidence location:** test/ui/spec031-quiet-interface.test.tsx and affected existing tests; PR validation.

### REQ-002: One context and correct counts

- **Statement:** Keep selected age in the timeline/phone strip only, remove the static group display, and preserve both count scopes: header/strip shows all gated occurrences on the map; list shows viewport units. Label totals clearly; do not force equality.
- **Rationale:** Reduce noise while keeping the useful exploration loop.
- **Acceptance criteria:** The described controls, defaults and disclosure behaviour are observable; retired surfaces are absent from their former primary location.
- **Verification method:** UI integration tests, source inspection and browser checks.
- **Evidence location:** test/ui/spec031-quiet-interface.test.tsx and affected existing tests; PR validation.

### REQ-003: Selection and evidence

- **Statement:** Use one persistent selection surface with temporary name/group hover previews. Fossil records are reachable within selected genera/localities. Put source references, coordinates, formation and optional technical fields behind Details and sources; retain underlying metadata and meaningful qualifications.
- **Rationale:** Reduce noise while keeping the useful exploration loop.
- **Acceptance criteria:** The described controls, defaults and disclosure behaviour are observable; retired surfaces are absent from their former primary location.
- **Verification method:** UI integration tests, source inspection and browser checks.
- **Evidence location:** test/ui/spec031-quiet-interface.test.tsx and affected existing tests; PR validation.

### REQ-004: Secondary pages

- **Statement:** Remove top-level Taxonomy navigation; reach Related groups from selected taxa. Taxonomy defaults to immediate relationships; browse genera and the radial fan are explicit alternate views. Omit empty structural sections and common-ancestor comparison. Taxon pages retain the article, a short parent path, return context and an external Wikipedia link.
- **Rationale:** Reduce noise while keeping the useful exploration loop.
- **Acceptance criteria:** The described controls, defaults and disclosure behaviour are observable; retired surfaces are absent from their former primary location.
- **Verification method:** UI integration tests, source inspection and browser checks.
- **Evidence location:** test/ui/spec031-quiet-interface.test.tsx and affected existing tests; PR validation.

### REQ-005: Quieter puzzle

- **Statement:** Choose Well-known on ordinary navigation when available, preserving explicit full-track fragments. Remove pool/guessable-size counters and live countdown. Put rules/ranking in Help, retain rollover handling, and show a compact instruction before the first guess; expand the board after a guess.
- **Rationale:** Reduce noise while keeping the useful exploration loop.
- **Acceptance criteria:** The described controls, defaults and disclosure behaviour are observable; retired surfaces are absent from their former primary location.
- **Verification method:** UI integration tests, source inspection and browser checks.
- **Evidence location:** test/ui/spec031-quiet-interface.test.tsx and affected existing tests; PR validation.

### REQ-006: Presentation policy

- **Statement:** Replace universal inline provenance rules in agent guidance, charter and functional requirements with on-demand disclosure. Retain source associations and factual interpretation constraints; omit optional absent fields. Preserve asset-required attribution access.
- **Rationale:** Reduce noise while keeping the useful exploration loop.
- **Acceptance criteria:** The described controls, defaults and disclosure behaviour are observable; retired surfaces are absent from their former primary location.
- **Verification method:** UI integration tests, source inspection and browser checks.
- **Evidence location:** test/ui/spec031-quiet-interface.test.tsx and affected existing tests; PR validation.

## Non-functional requirements

### NFR-001: Navigation, accessibility and integrity

- **Statement:** Preserve map emphasis, viewport linkage, stage/frame state on return, keyboard focus, coarse-pointer targets, phone sheet and error/empty recovery. No data/source fields are deleted.
- **Rationale:** Interface deletion must not break exploration or data correctness.
- **Acceptance criteria:** Existing applicable checks pass; retired-behaviour tests are revised to verify replacement behaviour rather than skipped.
- **Verification method:** typecheck, lint, build, Vitest, relevant Playwright and governance checks.
- **Evidence location:** PR validation and test/e2e.

## Acceptance criteria

All requirements above pass their verification. Count scopes remain intentionally distinct.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| --- | --- | --- | --- | --- | --- |
| REQ-001 | Genus/Locality only, directory closed, gate removed | UI + browser | spec031-quiet-interface; grouping-mode; quiet-interface E2E | test/ui; test/e2e | #30 |
| REQ-002 | One age context, stable header total across viewport changes | UI + fake map | exploration-context; spec027-selection panning regression | test/ui | #30 |
| REQ-003 | Evidence disclosed, optional absent rows omitted, selected surface replaces hover | UI + browser | spec031-quiet-interface; occurrence-panel; quiet-interface + phone-touch E2E | test/ui; test/e2e | #30 |
| REQ-004 | Contextual taxonomy, one view, article return + external link | UI + browser | spec031-quiet-interface; spec017-screen; quiet-interface + a11y E2E | test/ui; test/e2e | #30 |
| REQ-005 | Well-known default, explicit full links, quiet entry and rollover | UI + browser | spec031-quiet-interface; spec019-rollover; spec020-track-option; spec019-daily E2E | test/ui; test/e2e | #30 |
| REQ-006 | On-demand presentation policy; data contract unchanged | Inspection + governance | AGENTS, CLAUDE, charter, functional specification and amendments | repository docs | #30 |
| NFR-001 | State, geometry, access and checks preserved | Automated + browser | typecheck, test, lint, format, build, budget, governance; phone, map, axe E2E | PR validation | #30 |

## Test plan

Run applicable existing UI/data tests, revise tests of explicitly retired behaviour, add regression coverage for on-demand evidence and count scopes, and verify desktop/phone layout and a puzzle round.

## Rollback plan

Revert the implementation commit. No migration or source-data changes are involved.

## Edge cases

- No WebGL: make Browse dinosaurs available and preserve the text alternative.
- No Wikipedia article: omit unusable reading actions; records remain inspectable where exposed.
- Empty stage or viewport: retain recovery instructions.
- Explicit #daily/#practice continue to select the full puzzle track.

## Open questions

None blocking. Article embeds remain dependent on the external site; the external link is always available.

## Human decisions required

Approved in the user message above; no additional approval required for this scope.

## Conflict check

This owner-approved change amends presentation obligations in SPEC-003/010/014/015/017/019/020/021/022/023/024/026/030 and the functional specification. Earlier data contracts and grouping algorithms remain valid; later SPEC-031 presentation rules take precedence for overlapping public surfaces.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| --- | --- | --- | --- | --- |
| REQ-001 | Quiet map entry | ExplorationView, GroupingControls, initialExplorationState | spec031-quiet-interface, grouping-mode, quiet-interface E2E | Verified |
| REQ-002 | Count scopes | ContextBar, AgeStrip, UnitList | exploration-context, spec027-selection | Verified |
| REQ-003 | Selected record evidence | RecordDetails, OccurrencePanel, GroupedPanels, OccurrenceMap | spec031-quiet-interface, occurrence-panel, phone-touch | Verified |
| REQ-004 | Secondary navigation | AppBar, TaxonomyScreen, TaxonomySurfaces, TaxonProfile | spec017-screen, spec022-app-bar, spec031-quiet-interface | Verified |
| REQ-005 | Quiet game entry | DailyGenusScreen, initialExplorationState | spec019-rollover, spec020-track-option, spec031-quiet-interface | Verified |
| REQ-006 | Presentation policy | Agent guidance, design charter, functional specification | source inspection, governance scripts | Verified |
| NFR-001 | Map and phone integrity | OccurrenceMap ResizeObserver; existing state/sheet contracts | unit/UI, map geometry, phone and axe checks | Verified |

## Implementation notes

- Keep the existing coverage gate; expose its explanation once in About/data.
- Retain Courier New, the light cartographic palette and source associations.
- Header totals and viewport-list counts are different by design, per owner clarification.

## Spec amendments

### AMEND-001: Implementation verification and PR linkage

- **Date:** 2026-10-09
- **Authority:** Owner approval recorded in Context; no change to approved product scope.
- **Change:** Link PR #30 and complete the verification/traceability records.
- **Evidence:** 649 unit/integration/UI tests and 72 browser tests passed. TypeScript, ESLint, Prettier, production build, size budgets and the three governance checks passed. Desktop/phone screenshots were inspected locally. Browser checks used temporary Chromium 153 with software WebGL because normal downloads arrived incomplete; no dependency was added to the repository.
- **Remaining step:** Human review and merge. Keep status In Implementation until merge per the repository workflow.


### AMEND-002: Independent review interaction corrections

- **Date:** 2026-10-09
- **Authority:** Owner's “Continue” after the independent review of PR #30; corrections remain within NFR-001 keyboard access and empty-stage recovery.
- **Change:** Closing the desktop directory restores focus to Browse dinosaurs. Empty/loading/error stages keep their mandatory recovery panel, omit its ineffective Close button, and expose Browse as expanded and disabled while the panel cannot be dismissed. Opening a genus or related group moves focus to the resulting taxonomy heading when the initiating control disappears.
- **Assumption:** Recovery stays available whenever the selected stage has no displayable records; Reset view and stage navigation remain the way out.
- **Verification:** Regression coverage in spec031-quiet-interface, spec017-screen and quiet-interface E2E checks keyboard focus, expanded state, empty-stage recovery and reset. 651 unit/integration/UI tests and all five focused desktop/phone browser tests passed. TypeScript, ESLint, Prettier, production build, size budgets and governance validators passed; only the existing SPEC-002/SPEC-012 drift warnings remain. The independent reviewer rechecked the fixes, ran both affected UI suites (16 passing tests), and reported no remaining blocking issues. Design self-check: no added text, containers, chips or colour conventions; the map stays primary and the ineffective Close control is removed from recovery.
