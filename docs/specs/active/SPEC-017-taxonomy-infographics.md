---
doc_type: spec
spec_id: SPEC-017
title: Taxonomy infographics — clade sheet, common ancestor, descent, fan, neighbours
status: Draft
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, taxon-page, exploration-view, read-model, domain, pipeline, assets, styling]
affected_interfaces: [ReadTaxon, ReadProfile, taxonomy-index, silhouette-assets]
supersedes: []
superseded_by:
depends_on: [SPEC-001, SPEC-003, SPEC-010, SPEC-012, SPEC-013, SPEC-014]
conflicts_with: []
last_verified_at: 2026-08-05
---

# SPEC-017: Taxonomy infographics

## Summary

The atlas holds a single connected classification tree of **2,555 taxa rooted at
`Life`**, with a **silhouette on every node**, and currently renders it as one
line of italic names with the middle collapsed into an ellipsis. This spec turns
that tree into five visual surfaces: a **clade silhouette sheet**, a **common
ancestor comparison** between any two taxa, a **full lineage descent** from the
root, a **radial clade fan**, and **sideways navigation** to a taxon's parent,
siblings and children. All five read the tree already loaded in the browser; only
the descent needs new build-time assets.

## Context

Verified from the shipped snapshot (`public/data/reference.json`) on 2026-08-05:

- 2,555 taxa form **one tree with a single root, `Life`** (every other node
  resolves to it via `parentId`).
- **Max depth 54, mean depth 43.5.** `Life` → *Tyrannosaurus* is **45 nodes**.
- **434 internal nodes** carry children; the rest are leaves.
- Rank distribution: **2,123 Genus · 285 Clade · 147 Family**. There is no
  Species, Order or Class rank in the data.
- Largest branch points: Theropoda (73 children), Enantiornithes (58),
  Hadrosauroidea (41), Sauropoda (41), Nodosauridae (38), Aves (35),
  Titanosauria (35), Coelurosauria (34), Dinosauria (26).
- **All 2,555 profiles carry a `silhouette` path**; 1,358 also carry images.

Prior art in-repo: SPEC-010 introduced `ReadTaxon.parentId` and rank roll-up;
SPEC-012 introduced clade silhouettes; SPEC-014 introduced the `TaxonomyTree`
breadcrumb, which AMEND-005 kept when the taxon page became a Wikipedia embed.
The direction was explored in
[`../../reports/taxonomy-infographic-and-map-craft.md`](../../reports/taxonomy-infographic-and-map-craft.md)
(Direction A) and approved for specification by the owner on 2026-08-05.

`src/read/api.ts` currently resolves taxa with `Array.prototype.find` over the
full taxon list (`getTaxon`, `getProfile`). That is O(n) per lookup and these
surfaces perform many lookups per render, which is why NFR-002 below requires an
index.

## Problem statement

The classification is the second-richest thing in the product after the map, and
it is invisible. A user can see that *Tyrannosaurus* sits under `Tyrannosaurini`
and can click upward through ancestors one at a time. They cannot see what a
clade contains, how two animals are related to each other, what the full descent
from `Life` looks like, or what a taxon's siblings are. The data supports all
four; the interface exposes none of them.

## Goals

- Make the shape of a clade visible at a glance, using the silhouettes that
  already ship.
- Let a user compare two taxa and see where their lineages converge.
- Show the full descent from the root without an ellipsis, with the transitions
  that matter made legible.
- Give the classification a single overview surface for Dinosauria.
- Allow sideways movement through the tree, not only upward.

## Non-goals

- **No phylogenetic inference.** These surfaces visualise the shipped
  classification hierarchy. They do not compute, display, or imply divergence
  dates, branch lengths in time, or cladistic support values.
- **No new taxonomy source.** The tree is PBDB's as already ingested; this spec
  does not re-ingest, re-parent, or correct it.
- **No change to the map, timeline, or occurrence loop.** Filtering the map from
  a taxonomy surface is explicitly deferred (see Open questions).
- **No change to the taxon page's Wikipedia embed** (SPEC-014 AMEND-005). These
  surfaces sit alongside it; replacing it is out of scope.
- **No runtime network access.** DATA-005 (SPEC-001) continues to hold.
- No 3D or animated tree rendering.

## Users or actors

- **The Explorer** (charter §1) — the primary user of all five surfaces.
- **The build pipeline** — supplies silhouette assets for ancestor nodes
  (DATA-002).

## Functional requirements

### REQ-001: Clade silhouette sheet

- **Statement:** For any taxon that has at least one descendant genus, the system
  must render a sheet of its descendant genera as silhouettes only, each labelled
  with its scientific name, and each activating navigation to that taxon when
  selected. The sheet must state the total number of descendant genera, and when
  it renders fewer than that total it must say so explicitly.
- **Rationale:** Seeing thirty ceratopsian silhouettes together communicates the
  morphological range of a clade in a way no list of names can.
- **Acceptance criteria:**
  - Given a clade node with N descendant genera, the sheet renders one entry per
    included genus, each with a silhouette and its scientific name in italics.
  - The count of descendant genera is displayed and equals N.
  - When the render cap (NFR-002) is reached, an explicit "showing X of N"
    statement is present.
  - Activating an entry navigates to that taxon.
  - A taxon with no descendant genera renders the defined empty state (UX-002),
    not an empty container.
- **Verification method:** automated test (Vitest + Testing Library)
- **Evidence location:** `test/ui/spec017-clade-sheet.test.tsx`

### REQ-002: Common ancestor comparison

- **Statement:** Given two selected taxa, the system must compute their last
  common ancestor from the `parentId` chains and display: both taxa, the named
  last common ancestor, and the number of branchings separating each taxon from
  that ancestor. The display must express separation **only** in branchings and
  named ancestors, and must never state or imply an elapsed time, a date, or a
  rate of divergence.
- **Rationale:** "How closely related are these two?" is the question the tree
  can answer best, and the one users most often get wrong. The wording constraint
  exists because a taxonomic containment hierarchy does not carry temporal
  information (see Edge cases and CONS-290).
- **Acceptance criteria:**
  - For two taxa with a shared ancestor, the displayed ancestor equals the
    deepest node present in both ancestor chains.
  - The branching counts equal the number of steps from each taxon up to that
    ancestor.
  - When one taxon is an ancestor of the other, that relationship is stated as
    such rather than as a convergence (Edge cases).
  - When two taxa have no common ancestor in the loaded tree, the defined state
    is shown (UX-002).
  - No string in the rendered output expresses a duration, a year, or a Ma value.
- **Verification method:** automated test (unit test for the ancestor algorithm;
  UI test for the rendered output and the wording constraint)
- **Evidence location:** `test/ui/spec017-common-ancestor.test.ts`,
  `test/ui/spec017-common-ancestor-ui.test.tsx`

### REQ-003: Full lineage descent

- **Statement:** For any taxon, the system must render the complete ancestor
  chain from the root to that taxon with **no node elided**, and must visually
  emphasise a declared subset of milestone nodes. Each milestone must show a
  silhouette; non-milestone nodes must remain present and navigable.
- **Rationale:** The 45-step descent from `Life` to *Tyrannosaurus* is itself the
  story; the current breadcrumb hides 40 of those steps behind an ellipsis.
- **Acceptance criteria:**
  - For *Tyrannosaurus*, the rendered chain contains 45 nodes in root-to-taxon
    order, beginning `Life` and ending `Tyrannosaurus`.
  - Every node in the chain is individually identifiable and navigable.
  - Every node in the declared milestone list that is present in the chain is
    rendered with its silhouette and with the emphasised treatment.
  - The milestone list is a single declared, reviewable constant — not a
    condition scattered across components.
- **Verification method:** automated test
- **Evidence location:** `test/ui/spec017-descent.test.tsx`

### REQ-004: Clade fan

- **Statement:** The system must render a radial view of a chosen root clade
  (default: Dinosauria), where each wedge represents a child clade, wedge angle
  is proportional to the number of descendant genera the branch contains, and
  wedges are rendered to a bounded depth. Selecting a wedge must navigate to that
  taxon. A wedge must be labelled only when its rendered angle exceeds the
  declared legibility threshold; unlabelled wedges must remain identifiable on
  demand.
- **Rationale:** One frame that shows the whole shape of Dinosauria, in which
  Theropoda's 73-child fan-out is visible as bulk rather than as a number.
- **Acceptance criteria:**
  - The sum of the child wedge angles at any level equals the parent's angle
    (within floating-point tolerance).
  - Wedge angle ordering matches descendant-genus-count ordering.
  - Rendering depth does not exceed the declared bound.
  - No label is rendered on a wedge below the legibility threshold.
  - Selecting a wedge navigates to that taxon.
  - An equivalent non-visual representation exists (NFR-003).
- **Verification method:** automated test (geometry computed by a pure function,
  tested directly; UI test for navigation and labelling)
- **Evidence location:** `test/ui/spec017-fan.test.ts`,
  `test/ui/spec017-fan-ui.test.tsx`

### REQ-005: Neighbour navigation

- **Statement:** For any taxon, the system must present its parent, its siblings
  and its children, each with a silhouette, its scientific name, and its
  descendant genus count, and each navigable in one action.
- **Rationale:** The tree is currently navigable only upward; siblings and
  children are unreachable, which makes the classification a dead end.
- **Acceptance criteria:**
  - Siblings are exactly the other children of the taxon's parent.
  - Children are exactly the taxa whose `parentId` is this taxon.
  - Counts shown equal the descendant genus count for that node.
  - A root taxon (no parent) and a leaf taxon (no children) each render their
    defined state rather than an empty region.
  - Each entry navigates in one action (OQ-040 definition of an action).
- **Verification method:** automated test
- **Evidence location:** `test/ui/spec017-neighbours.test.tsx`

## Non-functional requirements

### NFR-001: No runtime network access

- **Statement:** All five surfaces must derive entirely from the snapshot already
  loaded in the browser. No surface may issue a network request at runtime.
- **Rationale:** DATA-005 (SPEC-001) — the snapshot is the only data source; the
  Wikipedia embed remains the single, already-documented exception.
- **Acceptance criteria:** With the network stubbed to fail, every surface in
  REQ-001…REQ-005 renders correctly.
- **Verification method:** automated test
- **Evidence location:** `test/ui/spec017-offline.test.tsx`

### NFR-002: Bounded derivation cost

- **Statement:** Taxon lookup, child lookup and descendant-genus counting must be
  served from indexes built once per loaded model, not by repeated linear scans.
  Building every index for the full 2,555-taxon tree must be a single pass, and
  no surface may exceed the declared render cap for silhouette entries.
- **Rationale:** `ReadApi.getTaxon`/`getProfile` are O(n) `find` calls today;
  these surfaces perform many lookups per render, and the clade sheet for a large
  clade could otherwise attempt thousands of images.
- **Acceptance criteria:**
  - Ancestor-chain, child-list and descendant-count helpers are pure functions
    over prebuilt indexes and are unit-tested as such.
  - Index construction visits each taxon a bounded number of times (asserted by
    an instrumented counter in test, not by wall-clock timing).
  - The render cap is a single declared constant, applied by REQ-001 and REQ-004,
    and its effect is disclosed in the UI.
- **Verification method:** automated test
- **Evidence location:** `test/ui/spec017-indexes.test.ts`

### NFR-003: Accessibility

- **Statement:** Every taxonomy surface must be operable by keyboard, must convey
  every relationship through text as well as geometry, and must pass the
  project's axe gate with no new violations.
- **Rationale:** PERF-250 and charter §4 — meaning is never carried by colour or
  shape alone. The fan in particular is a geometric encoding that needs a textual
  equivalent.
- **Acceptance criteria:**
  - Every silhouette carries an accessible name that includes its taxon's
    scientific name.
  - Every navigable entry is reachable and activatable by keyboard.
  - The fan (REQ-004) has an equivalent nested-list representation exposed to
    assistive technology.
  - The axe run reports no new violations.
- **Verification method:** automated test (Testing Library for semantics,
  `@axe-core/playwright` for the gate)
- **Evidence location:** `test/ui/spec017-a11y.test.tsx`, `test/e2e/`

## Security and privacy considerations

### SEC-001: Build-time-only asset acquisition

- **Statement:** Silhouette assets required by DATA-002 must be fetched at build
  time by a committed script and committed to the repository. No taxonomy surface
  may fetch an asset from a third-party host at runtime.
- **Rationale:** Preserves the offline, deterministic runtime (SPEC-001
  DATA-005) and avoids leaking user browsing to third parties.
- **Acceptance criteria:** No third-party host appears in any network request
  originating from the surfaces in REQ-001…REQ-005; every silhouette referenced
  resolves to a committed local path.
- **Verification method:** automated test + inspection
- **Evidence location:** `test/ui/spec017-offline.test.tsx`

## Data model impact

### DATA-001: Taxonomy indexes

- **Statement:** The read layer must expose, for a loaded model: a taxon-by-id
  index, a children-by-parent-id index, an ancestor chain for any taxon, and a
  descendant-genus count for any taxon. Cycles and dangling `parentId` references
  must terminate traversal safely rather than loop.
- **Rationale:** Required by REQ-001…REQ-005 and NFR-002. The data ships with
  `parentId` only, so the child direction must be derived.
- **Acceptance criteria:**
  - For a fixture tree, each index returns the expected members.
  - Descendant genus counts sum consistently: a node's count equals the sum of
    its children's counts plus its own genus-rank contribution.
  - A fixture containing a cycle and a fixture containing a dangling `parentId`
    both terminate and are reported as defined states (Edge cases).
- **Verification method:** automated test
- **Evidence location:** `test/ui/spec017-indexes.test.ts`

### DATA-002: Ancestor silhouettes

- **Statement:** Each node in the declared milestone list (REQ-003) must have a
  silhouette asset available from the committed snapshot. Where no silhouette can
  be sourced for a milestone, that node must be recorded as having none, and
  REQ-003 must render it with the explicit missing-image state rather than a
  substitute.
- **Rationale:** All 2,555 shipped taxa already carry a silhouette, but the
  milestone list may include high-level nodes whose assets need sourcing.
  Substituting a nearby relative's silhouette without saying so would present an
  unmarked assumption (FONC-1120, CONS-440).
- **Acceptance criteria:**
  - Every milestone node resolves either to a committed silhouette path or to an
    explicit "no silhouette" marker.
  - No milestone renders another taxon's silhouette as if it were its own.
- **Verification method:** automated test + script
- **Evidence location:** `test/spec017-milestone-assets.test.ts`

## UI or UX impact

### UX-001: Charter compliance

- **Statement:** All five surfaces must follow the design charter: scientific
  names in italics, domain language only, cool-neutral palette with teal as the
  single accent, ICS period hues reserved for the timeline, and silhouettes used
  as information rather than decoration.
- **Rationale:** `docs/mockups/design-guidelines.md` is binding on all UI work.
- **Acceptance criteria:** No new accent colour is introduced; no ICS period hue
  appears on a taxonomy surface; no generic product-speak label ("Overview",
  "Insights") appears; scientific names render in italics.
- **Verification method:** manual check against the charter + automated test for
  the italics and label rules
- **Evidence location:** `test/ui/spec017-charter.test.tsx`

### UX-002: Defined states

- **Statement:** Each surface must define and render an explicit state for: a
  taxon with no descendants, a taxon with no parent, two taxa with no common
  ancestor, a taxon whose silhouette is missing, and a comparison where the same
  taxon is chosen twice.
- **Rationale:** Charter §2 and FONC-1260…FONC-1340 — real states are designed,
  not left blank.
- **Acceptance criteria:** Each listed condition renders a labelled state with
  domain wording; none renders an empty region, a spinner that never resolves, or
  a raw error.
- **Verification method:** automated test
- **Evidence location:** `test/ui/spec017-states.test.tsx`

## Configuration impact

Three new declared constants, each in one place and referenced by tests: the
**milestone node list** (REQ-003), the **silhouette render cap** (NFR-002), and
the **fan depth bound and label-legibility threshold** (REQ-004). No environment
variables, no feature flags, no build configuration changes.

## Error handling

- A missing silhouette renders the explicit missing-image state (DATA-002,
  UX-002); it never renders a broken image or a substitute.
- A dangling `parentId` terminates the ancestor walk at the last resolvable node
  and the chain is presented as far as it resolves, marked as incomplete.
- A cycle in the tree terminates traversal on revisit and is surfaced as a
  defined state rather than hanging the render.
- Requesting a surface for an unknown taxon id renders the existing
  taxon-unavailable state rather than throwing.

## Edge cases

- **`Life` itself** — has no parent; REQ-005 must render the no-parent state and
  REQ-003 must render a single-node chain.
- **Ancestor–descendant comparison** (REQ-002) — comparing *Tyrannosaurus* with
  Theropoda has no convergence point in the usual sense; the ancestor is one of
  the two inputs, and the relationship must be stated as containment.
- **Identical inputs** (REQ-002) — comparing a taxon with itself yields zero
  branchings on both arms and must be stated as such, not as an error.
- **Very large clades** — Theropoda (73 children) and Dinosauria's full subtree
  exceed comfortable rendering; the cap and the disclosure in REQ-001 apply.
- **Rank gaps** — the data has only Genus, Family and Clade, so a "sibling" may be
  a clade next to a genus. Sibling sets must not assume rank homogeneity.
- **Non-dinosaur branches** — the tree contains Aves (35 children) and
  Enantiornithes (58), which sit outside the product's stated dinosaur scope;
  these surfaces must not present them as though the atlas covers them (CONS-100,
  FONC-400).

## Acceptance criteria

This spec is satisfied when: all five surfaces render from the loaded snapshot
with no runtime network access; the *Tyrannosaurus* descent renders all 45 nodes
with milestones illustrated; a common-ancestor comparison returns the correct
node with branching counts and contains no temporal claim; the clade sheet,
fan and neighbour surfaces navigate correctly and disclose any capping; every
defined state in UX-002 renders; and the axe gate reports no new violations.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Clade sheet renders descendant genera with silhouettes, count, and cap disclosure | automated test | `pnpm test` | `test/ui/spec017-clade-sheet.test.tsx` | |
| REQ-002 | Correct last common ancestor, branching counts, no temporal claim | automated test | `pnpm test` | `test/ui/spec017-common-ancestor*.test.*` | |
| REQ-003 | 45-node *Tyrannosaurus* chain, no elision, milestones illustrated | automated test | `pnpm test` | `test/ui/spec017-descent.test.tsx` | |
| REQ-004 | Wedge angles proportional and summing; depth bound; label threshold | automated test | `pnpm test` | `test/ui/spec017-fan*.test.*` | |
| REQ-005 | Parent/siblings/children correct, counted, navigable in one action | automated test | `pnpm test` | `test/ui/spec017-neighbours.test.tsx` | |
| NFR-001 | All surfaces render with network stubbed to fail | automated test | `pnpm test` | `test/ui/spec017-offline.test.tsx` | |
| NFR-002 | Index-backed lookups; bounded construction; declared render cap | automated test | `pnpm test` | `test/ui/spec017-indexes.test.ts` | |
| NFR-003 | Keyboard operable, textual equivalents, axe clean | automated test | `pnpm test`, `pnpm run e2e` | `test/ui/spec017-a11y.test.tsx`, `test/e2e/` | |
| SEC-001 | No third-party runtime requests; local asset paths only | automated test + inspection | `pnpm test` | `test/ui/spec017-offline.test.tsx` | |
| DATA-001 | Indexes correct; cycles and dangling parents terminate | automated test | `pnpm test` | `test/ui/spec017-indexes.test.ts` | |
| DATA-002 | Every milestone has a committed silhouette or an explicit none | automated test + script | `pnpm test` | `test/spec017-milestone-assets.test.ts` | |
| UX-001 | Charter palette, italics, domain language | manual + automated | inspection, `pnpm test` | `test/ui/spec017-charter.test.tsx` | |
| UX-002 | Every listed state renders with domain wording | automated test | `pnpm test` | `test/ui/spec017-states.test.tsx` | |

## Test plan

- **Unit** — ancestor chains, last-common-ancestor resolution, child indexing,
  descendant counting, fan geometry. Pure functions over small hand-built
  fixtures, plus the cycle and dangling-parent fixtures required by DATA-001.
- **Component** — each surface rendered with Testing Library against a fixture
  model: correct membership, correct counts, cap disclosure, navigation, and every
  state in UX-002.
- **Regression against real data** — one test asserting the *Tyrannosaurus*
  chain is 45 nodes rooted at `Life`, so a snapshot regeneration that changes the
  tree's shape fails loudly rather than silently.
- **Accessibility** — semantics in component tests; the axe gate in the existing
  Playwright e2e run.
- **Fixtures** — extend the existing UI fixtures with a small tree exercising
  multi-rank siblings, a leaf, the root, a cycle, and a dangling `parentId`.

## Rollback plan

Each surface is additive and independently mountable. Rollback is removing the
surface's entry point; the underlying indexes (DATA-001) are pure additions to
the read layer with no change to existing behaviour, so they may stay. Nothing in
this spec alters the snapshot format, the pipeline output, or the exploration
loop, so no data regeneration is involved in a revert. If DATA-002 assets are
reverted, REQ-003 degrades to the explicit no-silhouette state by construction.

## Open questions

- [ ] **Where does each surface live?** The clade sheet, fan and neighbours could
      sit on the taxon page (alongside the Wikipedia embed), in the exploration
      side panel, or on a dedicated taxonomy screen. Deferred to the
      implementation plan; it does not change any requirement above.
- [ ] **How is a comparison (REQ-002) initiated?** Likely a second taxon picker
      reusing SPEC-013 search, but the entry point is unspecified here.
- [ ] **Should a taxonomy surface filter the map?** Deliberately deferred — it
      would couple this spec to the exploration reducer. Recorded as a candidate
      follow-up spec, not an implied requirement.
- [ ] **Fan default root** — Dinosauria is assumed. If the owner prefers the fan
      to open at the currently selected taxon's nearest major clade, that is a
      one-line change to REQ-004's default.

## Human decisions required

- [ ] **Approve the milestone list for REQ-003.** Proposed: Tetrapoda, Amniota,
      Diapsida, Archosauria, Dinosauria, Theropoda (or the relevant order-level
      clade for non-theropod lineages), plus the terminal genus. Answer:
- [ ] **Confirm the non-dinosaur branches are shown but marked.** Aves and
      Enantiornithes are in the tree; the alternative is hiding them. Answer:
- [ ] **Approve the spec** (status → Approved, move to `docs/specs/approved/`).
      Answer:

## Conflict check

No conflicts identified.

- **SPEC-014 / AMEND-005** — owns the taxon page and its Wikipedia embed, and
  retained the `TaxonomyTree` breadcrumb. REQ-003 supersedes the *breadcrumb's
  elision behaviour* only where the descent surface is used; it does not remove
  the breadcrumb or touch the embed. If the owner wants the breadcrumb replaced
  outright, that is a SPEC-014 amendment, not a change here.
- **SPEC-010** — owns `parentId` and rank roll-up for grouping. This spec
  consumes both and changes neither.
- **SPEC-012** — owns clade silhouettes. DATA-002 extends silhouette coverage to
  ancestor nodes and does not alter existing assets.
- **SPEC-013** — owns taxon search; REQ-002's picker would reuse it unchanged.
- **SPEC-001 DATA-005** — NFR-001 and SEC-001 restate and preserve it.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Clade sheet | | | Not started |
| REQ-002 | Common ancestor | | | Not started |
| REQ-003 | Lineage descent | | | Not started |
| REQ-004 | Clade fan | | | Not started |
| REQ-005 | Neighbour navigation | | | Not started |
| NFR-001 | All surfaces | | | Not started |
| NFR-002 | Taxonomy indexes | | | Not started |
| NFR-003 | All surfaces | | | Not started |
| SEC-001 | Asset pipeline | | | Not started |
| DATA-001 | Read layer | | | Not started |
| DATA-002 | Asset pipeline | | | Not started |
| UX-001 | All surfaces | | | Not started |
| UX-002 | All surfaces | | | Not started |

## Implementation notes

Suggested order, cheapest and most independent first: DATA-001 indexes →
REQ-001 clade sheet → REQ-005 neighbours → REQ-002 common ancestor → REQ-003
descent (needs DATA-002 assets) → REQ-004 fan (highest layout risk). The fan is
the only surface likely to need design iteration before it is worth building; the
first four are layout over data already in the browser.

## Spec amendments

None yet.

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [ ] Open questions are resolved or explicitly deferred.
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed.
- [ ] Human approval recorded before status set to Approved.
