---
doc_type: spec
spec_id: SPEC-013
title: Taxon search — type a name, jump to its profile (with notability ranking)
status: Draft
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, exploration-view, context-bar, read-model, styling]
affected_interfaces: [ReadApi]
supersedes: []
superseded_by:
depends_on: [SPEC-001, SPEC-003, SPEC-010]
conflicts_with: []
last_verified_at: 2026-07-24
---

# SPEC-013: Taxon search — type a name, jump to its profile

## Summary

There is **no way to search** the atlas: to reach *Velociraptor* an Explorer must
guess its age and hunt the map. This spec adds a **search box** to the exploration
shell: typing a taxon name (scientific or common) shows a short ranked list of
matches, and choosing one **opens that taxon's profile directly** — no need to
know when it lived. Results are ranked by match quality (prefix over substring)
and then by **notability**, reusing the existing `contentLevel` so the familiar
"star" taxa (featured / detailed profiles) surface above obscure genera. Empty,
no-match and typing states are all designed.

## Context

Verified on 2026-07-24:

- `ReadApi.listTaxa()` returns every `ReadTaxon` (scientific name, rank,
  validity); common names live on `ReadProfile.commonName`
  (`ReadApi.getProfile`). `contentLevel` (`OccurrenceOnly` → `ShortProfile` →
  `DetailedProfile` → `FeaturedSpecies`) is already derived per profile.
- Navigating to a profile is a single dispatch:
  `{ type: "openProfile", taxonId }` (`src/app/state/exploration.ts`), which the
  taxon profile already renders and returns from via "Back to map".
- The exploration shell's persistent header is `ContextBar`
  (`src/app/components/ContextBar.tsx`); there is no search affordance anywhere
  today (confirmed — no input in `src/app`).
- The app is offline/static; search must run entirely in-memory over the loaded
  read model (DATA-005), no backend.

## Problem statement

The general-public visitor arrives wanting a specific, famous dinosaur and has no
front door. Alphabetical lists bury the stars and the map hides taxa by age. A
name search that jumps straight to the profile is the missing entry point.

## Goals

- Reach any taxon by name in one search, independent of the selected age.
- Surface well-known taxa first, not dictionary order.
- Keep it fully in-memory, fast, and accessible (keyboard + screen reader).

## Non-goals

- No full-text search of summaries/biology, formations, or references.
- No searching occurrences or localities (this is taxon search).
- No fuzzy/typo-tolerant matching in this iteration (prefix + substring only).
- No pinned "famous dinosaurs on the map" or guided tour — a later spec.

## Users or actors

The Explorer typing into the search box; the in-memory read model.

## Functional requirements

### REQ-001: Search input in the exploration shell

- **Statement:** The exploration shell shows a labelled search input (placeholder
  e.g. "Search a dinosaur…") in its persistent header, available at any age and
  in any grouping mode.
- **Rationale:** A always-present front door for name-first visitors.
- **Acceptance criteria:** A text input with an accessible name is present in the
  header on load; it is reachable by keyboard.
- **Verification method:** automated component test.
- **Evidence location:** filled at implementation.

### REQ-002: Case-insensitive name matching (scientific + common)

- **Statement:** As the Explorer types (≥ 2 characters), the app matches the
  query case-insensitively against each taxon's **scientific name** and its
  **common name** (when present), returning a bounded list (e.g. top 8).
- **Rationale:** People type "trex", "velociraptor", or a common name.
- **Acceptance criteria:** Query "tyr" matches *Tyrannosaurus*; a common-name
  query matches its taxon; queries < 2 chars show no results; the list is capped.
- **Verification method:** automated unit test on the pure match/rank function.
- **Evidence location:** filled at implementation.

### REQ-003: Ranking — match quality then notability

- **Statement:** Results are ordered by match quality (a **prefix** match ranks
  above a mid-string **substring** match), breaking ties by **notability**
  (`FeaturedSpecies` > `DetailedProfile` > `ShortProfile` > `OccurrenceOnly`) and
  then alphabetically, so well-known taxa surface first.
- **Rationale:** The reviewer's "I want the stars, not the dictionary".
- **Acceptance criteria:** Given a prefix and a substring match, the prefix match
  is first; given two equal-quality matches, the higher `contentLevel` is first;
  ordering is deterministic.
- **Verification method:** automated unit test.
- **Evidence location:** filled at implementation.

### REQ-004: Selecting a result opens the taxon profile

- **Statement:** Choosing a result (click or Enter) opens that taxon's profile
  (`openProfile`) and clears the query; the profile's existing "Back to map"
  returns to the prior view.
- **Rationale:** Jump straight to the taxon, independent of the current age.
- **Acceptance criteria:** Selecting a result renders the taxon profile for the
  chosen taxonId; the search list closes.
- **Verification method:** automated component test.
- **Evidence location:** filled at implementation.

### REQ-005: Designed empty / no-match states

- **Statement:** With a valid query and no matches, the app shows an explicit
  "No taxon matches '<query>'" message (not a blank void); an empty/too-short
  query shows no dropdown.
- **Rationale:** Charter — all real states are designed, never a dead blank.
- **Acceptance criteria:** A nonsense query shows the no-match message; clearing
  the box removes the dropdown.
- **Verification method:** automated component test.
- **Evidence location:** filled at implementation.

## Non-functional requirements

### NFR-001: Accessible, in-memory, deterministic

- **Statement:** The results list is keyboard-navigable with appropriate ARIA
  (combobox/listbox or equivalent); search runs entirely in-memory (no fetch);
  ranking is deterministic.
- **Acceptance criteria:** Keyboard can open, move through, and select a result;
  no network call occurs on search; `pnpm test`/`typecheck`/`lint`/`format` green.
- **Verification method:** component test + CI.
- **Evidence location:** filled at implementation.

## Security and privacy considerations

None — no new inputs leave the client, no new egress.

## Data model impact

None. Search reads `listTaxa()` + `getProfile().commonName`/`contentLevel`; an
in-memory index may be built at runtime but no artifact/schema changes.

## API impact

None to the serialized model. A small pure ranking function
(`searchTaxa(query, index)`) is added in the app layer and unit-tested.

## UI or UX impact

### UX-001: Header search with a results dropdown

- **Statement:** A search field in `ContextBar` with a dropdown of ranked
  results (scientific name, optional common name, a subtle notability/period
  cue), honouring the light cartographic aesthetic and teal-accent restraint
  (`docs/mockups/design-guidelines.md`), with all states designed.
- **Acceptance criteria:** As per REQ-001…005.
- **Verification method:** manual review against the design guidelines.
- **Evidence location:** filled at implementation.

## Configuration impact

Minimum query length (default 2) and result cap (default 8) as constants.

## Error handling

A taxon with no profile still appears (matched by scientific name); selecting it
opens the honest minimal/indeterminate profile the app already renders.

## Edge cases

- Duplicate scientific names collapse to distinct taxonIds; each is a row.
- Very common substrings (e.g. "saurus") are capped by the result limit, ordered
  by notability so the list stays useful.
- Whitespace-only query → treated as empty.

## Acceptance criteria

REQ-001…005 met, NFR-001 green, and an Explorer can reach a named taxon's profile
without knowing its age.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Search input present + reachable | automated | component test | TBD | TBD |
| REQ-002 | Case-insensitive sci+common match, capped | automated | ranking unit test | TBD | TBD |
| REQ-003 | Prefix>substring, then notability | automated | ranking unit test | TBD | TBD |
| REQ-004 | Select opens the profile | automated | component test | TBD | TBD |
| REQ-005 | No-match + empty states | automated | component test | TBD | TBD |
| NFR-001 | a11y + in-memory + green checks | CI + test | component test; `pnpm test` | TBD | TBD |

## Test plan

Pure unit tests for `searchTaxa` (matching, capping, ranking). Component tests
for the input, selecting a result → profile, and the no-match state. Full
`pnpm test` + typecheck + lint + format.

## Rollback plan

Additive: remove the search field from `ContextBar` and delete the search module;
no data or interface change to undo.

## Open questions

- [ ] Should the empty-focus state suggest a few featured taxa (a "stars" teaser)
      now, or defer to the later famous-dinos spec? (Default: defer; keep this
      spec to search.)

## Human decisions required

- [ ] None blocking — defaults above are sensible. Flag if the search should live
      somewhere other than the header.

## Conflict check

Touches SPEC-003 (exploration shell) and SPEC-010 (taxa/read model), both
additively; no requirement contradicts them. `conflicts_with` empty. Drift note
(not fixed here): `docs/SPEC_INDEX.md` still lacks rows for SPEC-010…013.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | ContextBar search input | TBD | TBD | Pending |
| REQ-002 | searchTaxa matching | TBD | TBD | Pending |
| REQ-003 | searchTaxa ranking | TBD | TBD | Pending |
| REQ-004 | openProfile wiring | TBD | TBD | Pending |
| REQ-005 | search states | TBD | TBD | Pending |

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
