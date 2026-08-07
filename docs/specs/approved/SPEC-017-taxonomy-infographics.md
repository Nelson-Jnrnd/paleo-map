---
doc_type: spec
spec_id: SPEC-017
title: Taxonomy infographics — clade sheet, common ancestor, descent, fan, neighbours (rooted at Dinosauria)
status: In Implementation
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, taxon-page, exploration-view, read-model, domain, styling]
affected_interfaces: [ReadTaxon, ReadProfile, taxonomy-index]
supersedes: []
superseded_by:
depends_on: [SPEC-001, SPEC-003, SPEC-010, SPEC-012, SPEC-013, SPEC-014]
conflicts_with: []
last_verified_at: 2026-08-05
---

# SPEC-017: Taxonomy infographics

## Summary

The atlas holds a classification tree of 2,555 taxa with a silhouette on every
node, and renders it as one line of italic names with the middle collapsed into
an ellipsis. This spec turns it into five visual surfaces — a **clade silhouette
sheet**, a **common ancestor comparison**, a **full lineage descent**, a **radial
clade fan**, and **sideways navigation** to parent, siblings and children. Per
the owner's decision of 2026-08-05, **every surface is rooted at `Dinosauria`**:
the stem above it is out of scope. All five read the tree already loaded in the
browser — no new data, no pipeline work, no network.

## Context

Verified from the shipped snapshot (`public/data/reference.json`) on 2026-08-05.

**Scope decision (owner, 2026-08-05): Dinosauria and below.** The measured
consequences:

- The `Dinosauria` subtree holds **2,521 of the 2,555 taxa (98.7%)** — 2,123
  genera, 251 clades, 147 families, of which **400 are internal nodes** with
  children. Rooting at Dinosauria discards only the **34-node stem** between
  `Life` and `Dinosauria`.
- The descent shortens accordingly: `Life` → *Tyrannosaurus* is 45 nodes;
  **`Dinosauria` → *Tyrannosaurus* is 11**:
  `Dinosauria > Theropoda > Neotheropoda > Averostra > Tetanurae > Coelurosauria
  > Tyrannosauroidea > Tyrannosauridae > Tyrannosaurinae > Tyrannosaurini >
  Tyrannosaurus`.
- **Every one of the 2,521 in-scope taxa already has a profile and a committed
  silhouette** — zero missing. This removes the only pipeline dependency the
  earlier draft carried: sourcing PhyloPic silhouettes for deep ancestors
  (Chordata, Amniota, Diapsida…) is no longer needed, because those nodes are now
  out of scope. **This spec therefore requires no new assets and no build-time
  work at all.**
- Major branches: Theropoda (1,148 taxa), Ornithischia (753), Saurischia (582),
  Sauropodomorpha (545).
- **Avian branches sit inside Dinosauria**: Aves, Avialae and Enantiornithes
  together account for **351 in-scope taxa (13.9%)**, leaving **2,170 non-avian**.
  This matters because birds *are* dinosaurs — structurally in scope — while the
  product covers **non-avian** dinosaurs (CONS-020/030). REQ-006 handles it.

Prior art in-repo: SPEC-010 introduced `ReadTaxon.parentId` and rank roll-up;
SPEC-012 introduced clade silhouettes; SPEC-014 introduced the `TaxonomyTree`
breadcrumb, retained by AMEND-005. Direction explored in
[`../../reports/taxonomy-infographic-and-map-craft.md`](../../reports/taxonomy-infographic-and-map-craft.md)
(Direction A), approved for specification by the owner on 2026-08-05.

`src/read/api.ts` resolves taxa with `Array.prototype.find` (`getTaxon`,
`getProfile`) — O(n) per lookup, which is why NFR-002 requires indexes.

## Problem statement

The classification is the second-richest thing in the product after the map, and
it is invisible. A user can see that *Tyrannosaurus* sits under `Tyrannosaurini`
and can click upward one ancestor at a time. They cannot see what a clade
contains, how two animals relate to each other, what the descent through
Dinosauria looks like, or what a taxon's siblings are. The data supports all
four; the interface exposes none of them.

## Goals

- Make the shape of a clade visible at a glance, using silhouettes that ship.
- Let a user compare two taxa and see where their lineages converge.
- Show the descent through Dinosauria without an ellipsis.
- Give Dinosauria a single overview surface.
- Allow sideways movement through the tree, not only upward.

## Non-goals

- **Nothing above Dinosauria.** The 34-node stem from `Life` down to
  `Dinosauriformes` is out of scope for every surface in this spec. It is not
  hidden data — it remains in the snapshot — it is simply not a surface this spec
  builds.
- **No phylogenetic inference.** These surfaces visualise the shipped
  classification hierarchy. They do not compute, display, or imply divergence
  dates, branch lengths in time, or cladistic support.
- **No new taxonomy source, no re-parenting, no correction of the shipped tree.**
- **No new assets and no pipeline work** — see Context; everything needed ships.
- **No change to the map, timeline, or occurrence loop.** Filtering the map from
  a taxonomy surface is deferred (Open questions).
- **No change to the taxon page's Wikipedia embed** (SPEC-014 AMEND-005).
- **No runtime network access.** DATA-005 (SPEC-001) continues to hold.
- No 3D or animated tree rendering.

## Users or actors

- **The Explorer** (charter §1) — the user of all five surfaces.

## Functional requirements

### REQ-001: Scope boundary at Dinosauria

- **Statement:** Every surface in this spec must treat `Dinosauria` as the root of
  the tree. No surface may render, traverse to, or link to a taxon outside the
  `Dinosauria` subtree. Where a traversal would leave that subtree, it must
  terminate at `Dinosauria` and present it as the root.
- **Rationale:** Owner decision of 2026-08-05. It also matches the product's
  stated focus (non-avian dinosaurs as main content, FONC-340/350) and costs
  almost nothing — 98.7% of the tree is inside the boundary.
- **Acceptance criteria:**
  - For any in-scope taxon, the rendered ancestor chain begins at `Dinosauria`.
  - No surface renders a node outside the `Dinosauria` subtree.
  - A request for a surface on an out-of-scope taxon renders the defined
    out-of-scope state (UX-002) rather than an empty or partial view.
  - The in-scope taxon count asserted by test is 2,521 against the shipped
    snapshot.
- **Verification method:** automated test
- **Evidence location:** `test/ui/spec017-scope.test.ts`

### REQ-002: Clade silhouette sheet

- **Statement:** For any in-scope taxon with at least one descendant genus, the
  system must render a sheet of its descendant genera as silhouettes, each
  labelled with its scientific name and each activating navigation to that taxon.
  The sheet must state the total number of descendant genera, and when it renders
  fewer than that total it must say so explicitly.
- **Rationale:** Seeing thirty ceratopsian silhouettes together communicates the
  morphological range of a clade in a way no list of names can.
- **Acceptance criteria:**
  - Given a clade with N descendant genera, one entry renders per included genus,
    each with a silhouette and its scientific name in italics.
  - The displayed descendant-genus count equals N.
  - When the render cap (NFR-002) applies, an explicit "showing X of N" statement
    is present.
  - Activating an entry navigates to that taxon.
  - A taxon with no descendant genera renders the defined empty state (UX-002).
- **Verification method:** automated test
- **Evidence location:** `test/ui/spec017-clade-sheet.test.tsx`

### REQ-003: Common ancestor comparison

- **Statement:** Given two in-scope taxa, the system must compute their last
  common ancestor from the `parentId` chains and display both taxa, the named
  ancestor, and the number of branchings separating each taxon from it. The
  display must express separation **only** in branchings and named ancestors, and
  must never state or imply an elapsed time, a date, or a rate of divergence.
- **Rationale:** "How closely related are these two?" is the question the tree
  answers best and users most often get wrong. The wording constraint exists
  because a taxonomic containment hierarchy carries no temporal information
  (CONS-290).
- **Acceptance criteria:**
  - The displayed ancestor equals the deepest node present in both ancestor
    chains, bounded below by `Dinosauria` (REQ-001).
  - Branching counts equal the steps from each taxon up to that ancestor.
  - When one taxon is an ancestor of the other, the relationship is stated as
    containment rather than convergence (Edge cases).
  - Comparing a taxon with itself yields zero on both arms and is stated as such.
  - No rendered string expresses a duration, a year, or a Ma value.
- **Verification method:** automated test (unit for the algorithm, UI for the
  rendered output and the wording constraint)
- **Evidence location:** `test/ui/spec017-common-ancestor.test.ts`,
  `test/ui/spec017-common-ancestor-ui.test.tsx`

### REQ-004: Lineage descent from Dinosauria

- **Statement:** For any in-scope taxon, the system must render the complete
  ancestor chain from `Dinosauria` to that taxon with **no node elided**, and must
  visually emphasise a declared subset of milestone nodes. Each milestone must
  show a silhouette; non-milestone nodes must remain present and navigable.
- **Rationale:** The descent is the story the breadcrumb currently hides behind an
  ellipsis. Rooted at Dinosauria it is a legible 11 steps for *Tyrannosaurus*
  rather than an unreadable 45.
- **Acceptance criteria:**
  - For *Tyrannosaurus*, the chain contains exactly 11 nodes in root-to-taxon
    order, beginning `Dinosauria` and ending `Tyrannosaurus`.
  - Every node in the chain is individually identifiable and navigable.
  - Every milestone present in the chain renders with its silhouette and the
    emphasised treatment.
  - The milestone list is a single declared, reviewable constant.
- **Verification method:** automated test
- **Evidence location:** `test/ui/spec017-descent.test.tsx`

### REQ-005: Clade fan

- **Statement:** The system must render a radial view rooted at `Dinosauria`,
  where each wedge represents a child clade, wedge angle is proportional to the
  number of descendant genera in that branch, and wedges render to a bounded
  depth. Selecting a wedge must navigate to that taxon. A wedge must be labelled
  only when its rendered angle exceeds the declared legibility threshold;
  unlabelled wedges must remain identifiable on demand.
- **Rationale:** One frame showing the whole shape of Dinosauria, in which
  Theropoda's 1,148-taxon bulk is visible as area rather than as a number.
- **Acceptance criteria:**
  - Child wedge angles at any level sum to the parent's angle (within
    floating-point tolerance).
  - Wedge angle ordering matches descendant-genus-count ordering.
  - Rendering depth does not exceed the declared bound.
  - No label renders on a wedge below the legibility threshold.
  - Selecting a wedge navigates to that taxon.
  - An equivalent non-visual representation exists (NFR-003).
  - **(AMEND-001)** Each wedge is filled with its clade tint, resolved by the
    same function the map uses, with the neutral fallback when the major group
    does not resolve — and every wedge stays identifiable without colour.
- **Verification method:** automated test (geometry as a pure function; UI test
  for navigation and labelling)
- **Evidence location:** `test/ui/spec017-fan.test.ts`,
  `test/ui/spec017-fan-ui.test.tsx`

### REQ-006: Avian branches are shown and marked

- **Statement:** Taxa within the avian branches of the tree (`Aves`, `Avialae`,
  `Enantiornithes` and their descendants — 351 in-scope taxa) must remain visible
  on every surface, and must carry an explicit marker indicating that they fall
  outside the atlas's non-avian coverage. The marker must not present them as
  taxonomically excluded from Dinosauria.
- **Rationale:** Birds are dinosaurs; removing them from the dinosaur tree would
  be a scientific falsehood, and the tree would visibly lie about Theropoda's
  shape. But the product covers non-avian dinosaurs (CONS-020/030), and showing
  avian taxa unmarked would imply coverage the atlas does not claim (FONC-400,
  CONS-100). Both constraints are satisfied by showing and labelling.
- **Acceptance criteria:**
  - A taxon inside an avian branch renders with the coverage marker on every
    surface where it appears.
  - A taxon outside those branches never renders the marker.
  - The marker's wording states limited coverage, not exclusion from Dinosauria.
  - Counts displayed by other requirements state whether avian taxa are included.
- **Verification method:** automated test
- **Evidence location:** `test/ui/spec017-avian.test.tsx`

### REQ-007: Neighbour navigation

- **Statement:** For any in-scope taxon, the system must present its parent, its
  siblings and its children, each with a silhouette, its scientific name, and its
  descendant genus count, and each navigable in one action.
- **Rationale:** The tree is navigable only upward today; siblings and children
  are unreachable, which makes the classification a dead end.
- **Acceptance criteria:**
  - Siblings are exactly the other children of the taxon's parent, within scope.
  - Children are exactly the in-scope taxa whose `parentId` is this taxon.
  - Counts equal the descendant genus count for that node.
  - `Dinosauria` (no in-scope parent) and a leaf genus (no children) each render
    their defined state rather than an empty region.
  - Each entry navigates in one action (OQ-040 definition).
- **Verification method:** automated test
- **Evidence location:** `test/ui/spec017-neighbours.test.tsx`

## Non-functional requirements

### NFR-001: No runtime network access

- **Statement:** All surfaces must derive entirely from the snapshot already
  loaded in the browser. No surface may issue a network request at runtime.
- **Rationale:** DATA-005 (SPEC-001); the Wikipedia embed remains the single
  documented exception and is untouched here.
- **Acceptance criteria:** With the network stubbed to fail, every surface in
  REQ-001…REQ-007 renders correctly.
- **Verification method:** automated test
- **Evidence location:** `test/ui/spec017-offline.test.tsx`

### NFR-002: Bounded derivation cost

- **Statement:** Taxon lookup, child lookup and descendant-genus counting must be
  served from indexes built once per loaded model, not by repeated linear scans.
  Building every index for the full tree must be a single pass, and no surface may
  exceed the declared render cap for silhouette entries.
- **Rationale:** `ReadApi.getTaxon`/`getProfile` are O(n) `find` calls; these
  surfaces perform many lookups per render, and a sheet for Theropoda (1,148
  taxa) could otherwise attempt over a thousand images at once.
- **Acceptance criteria:**
  - Ancestor-chain, child-list and descendant-count helpers are pure functions
    over prebuilt indexes, unit-tested as such.
  - Index construction visits each taxon a bounded number of times (asserted by an
    instrumented counter, not wall-clock timing).
  - The render cap is a single declared constant applied by REQ-002 and REQ-005,
    and its effect is disclosed in the UI.
- **Verification method:** automated test
- **Evidence location:** `test/ui/spec017-indexes.test.ts`

### NFR-003: Accessibility

- **Statement:** Every surface must be keyboard-operable, must convey every
  relationship through text as well as geometry, and must pass the project's axe
  gate with no new violations.
- **Rationale:** PERF-250 and charter §4 — meaning is never carried by colour or
  shape alone. The fan is a geometric encoding and needs a textual equivalent.
- **Acceptance criteria:**
  - Every silhouette carries an accessible name including its scientific name.
  - Every navigable entry is reachable and activatable by keyboard.
  - The fan (REQ-005) exposes an equivalent nested-list representation.
  - The avian marker (REQ-006) is conveyed as text, not by styling alone.
  - The axe run reports no new violations.
- **Verification method:** automated test (Testing Library +
  `@axe-core/playwright`)
- **Evidence location:** `test/ui/spec017-a11y.test.tsx`, `test/e2e/`

## Security and privacy considerations

None. This spec adds no asset acquisition, no new host, no storage, and no user
data. NFR-001 keeps every surface offline; SPEC-001 DATA-005 is unchanged.

## Data model impact

### DATA-001: Taxonomy indexes

- **Statement:** The read layer must expose, for a loaded model: a taxon-by-id
  index, a children-by-parent-id index, an ancestor chain bounded at `Dinosauria`,
  a descendant-genus count, and an avian-branch membership test. Cycles and
  dangling `parentId` references must terminate traversal safely rather than loop.
- **Rationale:** Required by REQ-001…REQ-007 and NFR-002. The data ships with
  `parentId` only, so the child direction must be derived.
- **Acceptance criteria:**
  - For a fixture tree, each index returns the expected members.
  - Descendant genus counts sum consistently: a node's count equals the sum of its
    children's counts plus its own genus-rank contribution.
  - Ancestor chains terminate at `Dinosauria`, never above it.
  - Fixtures containing a cycle and a dangling `parentId` both terminate and are
    reported as defined states.
- **Verification method:** automated test
- **Evidence location:** `test/ui/spec017-indexes.test.ts`

> **No DATA-002.** An earlier draft required sourcing PhyloPic silhouettes for
> deep ancestor nodes. Rooting at Dinosauria removed that need: all 2,521 in-scope
> taxa already carry a committed silhouette and a profile (verified 2026-08-05).
> This spec adds no assets.

## UI or UX impact

### UX-001: Charter compliance

- **Statement:** All surfaces must follow the design charter: scientific names in
  italics, domain language only, cool-neutral palette with teal as the single
  accent, ICS period hues reserved for the timeline, and silhouettes used as
  information rather than decoration.
- **Rationale:** `docs/mockups/design-guidelines.md` is binding on UI work. Note
  that the 2026-08-05 owner override to the restraint rule is **scoped to the
  paleogeographic basemap (SPEC-018)** and does not apply to these surfaces.
- **Acceptance criteria:** No new accent colour; no ICS period hue on a taxonomy
  surface; no generic product-speak label; scientific names in italics.
- **Verification method:** manual check against the charter + automated test for
  the italics and label rules
- **Evidence location:** `test/ui/spec017-charter.test.tsx`

### UX-002: Defined states

- **Statement:** Each surface must define and render an explicit state for: a
  taxon with no descendants, `Dinosauria` itself (no in-scope parent), a taxon
  outside the Dinosauria subtree, two taxa whose only common ancestor is the root,
  a comparison where the same taxon is chosen twice, and a taxon whose silhouette
  fails to load.
- **Rationale:** Charter §2 and FONC-1260…FONC-1340 — real states are designed,
  not left blank.
- **Acceptance criteria:** Each condition renders a labelled state in domain
  wording; none renders an empty region, an unresolving spinner, or a raw error.
- **Verification method:** automated test
- **Evidence location:** `test/ui/spec017-states.test.tsx`

## Configuration impact

Four declared constants, each in one place and referenced by tests: the **scope
root** (`Dinosauria`), the **milestone node list** (REQ-004), the **silhouette
render cap** (NFR-002), and the **fan depth bound and label threshold**
(REQ-005). No environment variables, no feature flags, no build changes.

## Error handling

- A silhouette that fails to load renders the explicit missing-image state; it
  never renders a broken image or another taxon's silhouette as a substitute.
- A dangling `parentId` terminates the ancestor walk at the last resolvable node;
  the chain is presented as far as it resolves, marked incomplete.
- A cycle terminates traversal on revisit and surfaces a defined state rather
  than hanging the render.
- An unknown or out-of-scope taxon id renders the defined state (UX-002), never
  throws.

## Edge cases

- **`Dinosauria` itself** — the root: REQ-007 renders the no-parent state and
  REQ-004 renders a single-node chain.
- **Ancestor–descendant comparison** (REQ-003) — comparing *Tyrannosaurus* with
  Theropoda has no convergence point in the usual sense; the ancestor is one of
  the inputs and must be stated as containment.
- **Identical inputs** (REQ-003) — zero branchings on both arms, stated as such.
- **Very large clades** — Theropoda (1,148 taxa) and Ornithischia (753) exceed
  comfortable rendering; the cap and disclosure in REQ-002 apply.
- **Rank gaps** — the data carries only Genus, Family and Clade, so a sibling set
  may mix ranks. Sibling handling must not assume rank homogeneity.
- **Avian branches** — 351 in-scope taxa; REQ-006 governs. Note Theropoda's
  descendant counts include them, which is why REQ-006 requires counts to state
  whether avian taxa are included.
- **Out-of-scope entry points** — search (SPEC-013) indexes all 2,555 taxa,
  including the 34 above Dinosauria. Landing on one of those must produce the
  out-of-scope state, not a broken surface.

## Acceptance criteria

Satisfied when: all five surfaces render from the loaded snapshot with no runtime
network access; every ancestor chain is rooted at `Dinosauria` and the
*Tyrannosaurus* descent renders exactly 11 nodes with milestones illustrated; a
common-ancestor comparison returns the correct node with branching counts and
contains no temporal claim; avian taxa render with the coverage marker; the sheet,
fan and neighbour surfaces navigate correctly and disclose capping; every defined
state renders; and the axe gate reports no new violations.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Chains rooted at Dinosauria; 2,521 in scope; no out-of-scope node rendered | automated test | `pnpm test` | `test/ui/spec017-scope.test.ts` | |
| REQ-002 | Sheet renders descendant genera with silhouettes, count, cap disclosure | automated test | `pnpm test` | `test/ui/spec017-clade-sheet.test.tsx` | |
| REQ-003 | Correct ancestor, branching counts, no temporal claim | automated test | `pnpm test` | `test/ui/spec017-common-ancestor*.test.*` | |
| REQ-004 | 11-node *Tyrannosaurus* chain, no elision, milestones illustrated | automated test | `pnpm test` | `test/ui/spec017-descent.test.tsx` | |
| REQ-005 | Wedge angles proportional and summing; depth bound; label threshold | automated test | `pnpm test` | `test/ui/spec017-fan*.test.*` | |
| REQ-006 | Avian taxa shown and marked; non-avian never marked | automated test | `pnpm test` | `test/ui/spec017-avian.test.tsx` | |
| REQ-007 | Parent/siblings/children correct, counted, navigable in one action | automated test | `pnpm test` | `test/ui/spec017-neighbours.test.tsx` | |
| NFR-001 | All surfaces render with network stubbed to fail | automated test | `pnpm test` | `test/ui/spec017-offline.test.tsx` | |
| NFR-002 | Index-backed lookups; bounded construction; declared render cap | automated test | `pnpm test` | `test/ui/spec017-indexes.test.ts` | |
| NFR-003 | Keyboard operable, textual equivalents, axe clean | automated test | `pnpm test`, `pnpm run e2e` | `test/ui/spec017-a11y.test.tsx`, `test/e2e/` | |
| DATA-001 | Indexes correct; chains bounded; cycles and dangling parents terminate | automated test | `pnpm test` | `test/ui/spec017-indexes.test.ts` | |
| UX-001 | Charter palette, italics, domain language | manual + automated | inspection, `pnpm test` | `test/ui/spec017-charter.test.tsx` | |
| UX-002 | Every listed state renders with domain wording | automated test | `pnpm test` | `test/ui/spec017-states.test.tsx` | |

## Test plan

- **Unit** — ancestor chains bounded at Dinosauria, last-common-ancestor
  resolution, child indexing, descendant counting, avian membership, fan geometry.
  Pure functions over small hand-built fixtures, plus cycle and dangling-parent
  fixtures (DATA-001).
- **Component** — each surface rendered with Testing Library against a fixture
  model: membership, counts, cap disclosure, avian marking, navigation, and every
  state in UX-002.
- **Regression against real data** — assert the *Tyrannosaurus* chain is 11 nodes
  rooted at `Dinosauria` and the in-scope count is 2,521, so a snapshot
  regeneration that changes the tree's shape fails loudly rather than silently.
- **Accessibility** — semantics in component tests; the axe gate in the existing
  Playwright e2e run.
- **Fixtures** — extend the existing UI fixtures with a small tree exercising
  multi-rank siblings, a leaf, the scope root, an avian branch, an out-of-scope
  taxon, a cycle, and a dangling `parentId`.

## Rollback plan

Each surface is additive and independently mountable; rollback is removing its
entry point. The indexes (DATA-001) are pure additions to the read layer with no
change to existing behaviour and may stay. Nothing here alters the snapshot
format, pipeline output, committed assets, or the exploration loop, so no
regeneration is involved in a revert.

## Open questions

All three are **explicitly deferred** and none blocks implementation: each is a
placement or entry-point choice that changes no requirement above. Recorded here
so the deferral is deliberate rather than forgotten (Definition of Ready).

- [x] **Where does each surface live?** *Deferred to the implementation plan* —
      taxon page, exploration side panel, or a dedicated taxonomy screen.
- [x] **How is a comparison (REQ-003) initiated?** *Resolved in implementation:*
      a second-taxon picker on the taxonomy screen, reusing SPEC-013's
      `searchTaxa` unchanged over an in-scope-filtered index.
- [x] **Should a taxonomy surface filter the map?** *Deferred out of scope* — it
      would couple this spec to the exploration reducer. Candidate follow-up
      spec, not an implied requirement here.

## Human decisions required

- [x] **Scope root.** *Decided by owner, 2026-08-05: focus on Dinosauria and
      below.* Encoded as REQ-001; the 34-node stem above `Dinosauria` is a
      non-goal.
- [x] **Avian branches.** *Decided by agent under the owner's scope direction:*
      shown and marked (REQ-006), because birds are structurally inside
      Dinosauria and removing them would misrepresent Theropoda, while leaving
      them unmarked would imply coverage the atlas does not claim. *Ratified by
      the owner's approval of 2026-08-05.*
- [x] **Approve the milestone list for REQ-004.** *Approved as proposed, owner,
      2026-08-05:* `Dinosauria`, the ordinal branch (`Saurischia`/
      `Ornithischia`), the major clade (`Theropoda`/`Sauropodomorpha`/ etc.), the
      family, and the terminal genus. This is the declared constant REQ-004
      requires.
- [x] **Approve the spec.** *Approved by owner, 2026-08-05* ("I approve").
      Status set to `Approved`; moved to `docs/specs/approved/`.

## Conflict check

No conflicts identified.

- **SPEC-014 / AMEND-005** — owns the taxon page and its Wikipedia embed, and
  retained the `TaxonomyTree` breadcrumb. REQ-004 supersedes the breadcrumb's
  *elision behaviour* only where the descent surface is used; it removes neither
  the breadcrumb nor the embed. Replacing the breadcrumb outright would be a
  SPEC-014 amendment, not a change here.
- **SPEC-010** — owns `parentId` and rank roll-up for grouping; consumed
  unchanged.
- **SPEC-012** — owns clade silhouettes; consumed unchanged, no new assets.
- **SPEC-013** — owns taxon search, which indexes all 2,555 taxa including the 34
  above Dinosauria. REQ-001 and UX-002 handle that boundary; search itself is
  unchanged.
- **SPEC-018** — shares the design charter. The 2026-08-05 restraint override is
  scoped to the basemap and does not apply here (UX-001).
- **SPEC-001 DATA-005** — NFR-001 restates and preserves it.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Scope boundary | `state/taxonomy.ts` `buildTaxonomyIndex()` scope set; `TaxonomyScreen` fallback | `spec017-scope.test.ts`, `spec017-indexes.test.ts` | Implemented |
| REQ-002 | Clade sheet | `TaxonomySurfaces.tsx` `CladeSheet` | `spec017-surfaces.test.tsx` | Implemented |
| REQ-003 | Common ancestor | `state/taxonomy.ts` `relatedness()`; `TaxonomySurfaces.tsx` `CommonAncestor` | `spec017-indexes.test.ts`, `spec017-screen.test.tsx` | Implemented |
| REQ-004 | Lineage descent | `TaxonomySurfaces.tsx` `LineageDescent`, `DESCENT_MILESTONES` | `spec017-surfaces.test.tsx`, `spec017-scope.test.ts` | Implemented |
| REQ-005 | Clade fan | `cladeFan.ts` `buildFan()`; `TaxonomySurfaces.tsx` `CladeFan` | `spec017-fan.test.ts`, `spec017-screen.test.tsx` | Implemented |
| REQ-006 | Avian marking | `state/taxonomy.ts` `AVIAN_ROOT_NAMES`; `TaxonomySurfaces.tsx` `AvianMark` | `spec017-surfaces.test.tsx`, `spec017-scope.test.ts` | Implemented |
| REQ-007 | Neighbour navigation | `TaxonomySurfaces.tsx` `TaxonNeighbours` | `spec017-surfaces.test.tsx` | Implemented |
| NFR-001 | All surfaces | no fetch in any surface | `spec017-screen.test.tsx` | Implemented |
| NFR-002 | Taxonomy indexes | `state/taxonomy.ts` (`stats.visits`, memoised `genera`) | `spec017-indexes.test.ts` | Implemented |
| NFR-003 | All surfaces | labelled regions, button entries, fan list equivalent | `spec017-screen.test.tsx`, `test/e2e/a11y.e2e.ts` | Implemented |
| DATA-001 | Read layer | `state/taxonomy.ts` `buildTaxonomyIndex()` | `spec017-indexes.test.ts` | Implemented |
| UX-001 | All surfaces | `exploration.module.css` (charter tokens only) | `spec017-surfaces.test.tsx` | Implemented |
| UX-002 | All surfaces | per-surface defined states | `spec017-surfaces.test.tsx`, `spec017-screen.test.tsx` | Implemented |

## Implementation notes

Built in the planned order: DATA-001 indexes → clade sheet → neighbours →
common ancestor → descent → fan. The fan was indeed the only surface that needed
design iteration.

Placement (owner, 2026-08-06): a **dedicated taxonomy screen**, added to the
exploration reducer as a third `Screen` value alongside `map` and `profile`, with
`openTaxonomy` mirroring `openProfile`'s navigation contract — age and filters
survive, one action returns to the map. Entry is a "Taxonomy" button in the
context bar, which carries the selected taxon when the view is in taxon mode.

Four decisions taken during implementation:

1. **The clade sheet excludes the focus taxon itself.** `index.genera()` counts a
   genus as its own member — correct for the fan and the neighbour counts, wrong
   for a sheet, where it would render a page showing only the animal you are
   already looking at. Caught by the UX-002 empty-state test.
2. **Only the fan's first ring is labelled.** A chain of nested clades
   (Theropoda → Neotheropoda → Averostra) shares an angular ray at close radii,
   so labelling every depth stacked the names on top of each other — visible in
   the first visual check. The textual list satisfies REQ-005's "identifiable on
   demand" for the rest.
3. **Counts are inflected** ("1 genus" / "N genera", and the root's descent reads
   "The root of the atlas's taxonomy" rather than "1 branchings"). Domain language
   the charter asks for, and the first render made the defect obvious.
4. **The comparison surface states its own limitation inline** rather than only
   in code comments, and the REQ-003 test scans the *claims* while excluding that
   disclaimer — otherwise the note's own "how long ago" phrasing would trip the
   no-temporal-language guard.

**UI review pass (2026-08-06).** Reviewing the built screen against the real
snapshot exposed three presentation defects, all fixed within the approved
requirements — none changed a requirement:

5. **Children were name-ordered, which buried the tree's trunk.** `Dinosauria`'s
   26 children are mostly one-genus eggshell and footprint families
   (Dictyoolithidae, Huanglongpus, Youngoolithidae…), so alphabetical order put
   `Theropoda` (940 genera), `Ornithischia` (652) and `Saurischia` (502) in the
   middle of a list of oddities. `index.children()` now orders by descendant
   genus count, ties broken by name — which also lays the fan out largest-first.
   REQ-007 specifies membership, not order, so this is presentation latitude.
6. **The clade sheet's cap took an alphabetical prefix.** For `Dinosauria` that
   meant 120 genera all starting with "A" — useless for a surface whose whole
   purpose is showing a clade's morphological range. It now samples evenly across
   the clade and says so ("showing 120, spread across the clade").
7. **The avian marker overflowed its grid cell** and collided with the
   neighbouring entry. It now has a compact form for dense grids and wraps rather
   than running past its cell. The meaning still arrives as text in both forms
   (PERF-250), with the full sentence in the title.

The neighbour lists also collapse their long tail behind a disclosure, so a taxon
with 26 children no longer pushes the rest of the screen down by a screenful.

**Resolved (AMEND-001, 2026-08-06).** The fan's monochrome fill was recorded here
as a known limitation: charter §4 left no colour available for clades. The owner
relaxed that constraint, and the fan now uses SPEC-015's existing clade tints, so
a clade is the same hue on the map and in the taxonomy.

## Spec amendments

The rewrite of 2026-08-05 (scope root moved from `Life` to `Dinosauria`,
DATA-002 removed, REQ-006 added) predates approval and therefore needs no
amendment entry.

### AMEND-001 — Clade tints on the fan (owner, 2026-08-06)

**What changed.** REQ-005's wedges were rendered in a single neutral fill, which
made the fan read as a shape rather than a chart — recorded as a known limitation
when the spec was first implemented. The owner has approved relaxing the colour
constraint. Each wedge now carries the **clade tint** of the major group it
belongs to.

**Why this is not a new colour system.** The tints are the ones SPEC-015 already
defined for the map's occurrence markers (`mapCladeMarkers.ts`), so the same
clade is the same hue on the map and in the taxonomy — learnable across screens
the way the ICS period colours are. No new palette is invented, and the charter
has been updated to record clade tints as a meaning-only system alongside the ICS
hues.

**What is unchanged.** Shape and name still carry identity; the tint reinforces
and may never be the only cue (NFR-003, PERF-250). Teal remains the accent for
data and interaction, ICS hues remain the timeline's, and nothing outside the
clade encoding gains colour.

**Requirement text affected.** REQ-005 gains one acceptance criterion:

- Each wedge is filled with its taxon's clade tint, resolved by the same function
  the map uses; a taxon whose major group does not resolve takes the neutral
  fallback.
- Every wedge remains identifiable without colour — by its label, or by the
  textual list for unlabelled wedges.

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [x] Open questions are resolved or explicitly deferred.
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed.
- [x] Human approval recorded before status set to Approved (owner, 2026-08-05).
