---
doc_type: spec
spec_id: SPEC-021
title: Remove five pieces of explanatory interface copy, and rename one heading
status: Draft
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components:
  [
    src/app/components/ContextBar.tsx,
    src/app/components/TimelineControl.tsx,
    src/app/components/ExplorationView.tsx,
    src/app/components/OccurrenceMap.tsx,
    src/app/components/DailyGenusScreen.tsx,
    src/app/components/exploration.module.css,
    src/app/components/dailyGenus.module.css,
  ]
affected_interfaces: [rendered-DOM, accessible-names]
supersedes: []
superseded_by:
depends_on: [SPEC-003, SPEC-010, SPEC-011, SPEC-015, SPEC-018, SPEC-019, SPEC-020]
conflicts_with: [SPEC-003, SPEC-010, SPEC-011, SPEC-018, SPEC-019]
last_verified_at: 2026-08-14
---

# SPEC-021: Remove five pieces of explanatory interface copy, and rename one heading

## Summary

The owner has asked for five lines of interface copy to be deleted outright —
the brand subtext, the timeline's period hint, the map's "Paleogeographic
reconstruction" banner, the cluster-semantics legend, and the puzzle's footer
provenance line — plus one heading renamed from "Established classification" to
"Taxonomic tree". Four of those five lines are the **only** thing currently
carrying a requirement, so this spec deletes the copy *and* says where each
requirement lands afterwards: the cluster meaning moves onto the clusters
themselves as an accessible name (better than today), the puzzle's snapshot date
moves into the answer reveal, and the brand disclaimer is retired because the
requirement behind it is a prohibition, not a mandate to print a disclaimer. One
deletion — the map banner — collides with two **MVP "must"** constraints in the
functional specification and is therefore **gated on an owner decision recorded
below**; nothing else in the app states that the map is a reconstruction.

## Context

The five lines share a shape: they are sentences that explain the interface or
restate the product's scope, sitting beside the thing they describe. The
anti-slop checklist calls this out directly ("Don't caption your own interface",
"Cut copy to what the object cannot say for itself"), and the design charter's
final quality check asks the same question. This spec is the cleanup pass.

The complication is that this repository put several genuine, spec-mandated
disclosures *into* that copy. The design charter's §2 tenet — uncertainty and
provenance are first-class and never buried behind a hover or a secondary click
(CONS-490) — is why those sentences were written as visible static text in the
first place. Deleting them is therefore not a pure copy edit; each one has to be
checked against the requirement that produced it.

Relevant prior art, in the order it matters here:

- **SPEC-003** (Implemented) — REQ-002 requires the persistent "Paleogeographic
  reconstruction" label; REQ-005's acceptance criterion requires a
  disclaimer/label conveying the app is not a complete atlas.
- **SPEC-007** (Approved) — retired the *per-occurrence* "reconstructed" cue
  explicitly **because** a single standing map-level label was retained in its
  place (SPEC-007 REQ-001 rationale). That is why the banner is now the sole
  visible carrier.
- **SPEC-010** (Approved) — REQ-002 asked for a cluster **accessible name**;
  AMEND-001 replaced that with the DOM legend paragraph, on the grounds that a
  WebGL canvas has no per-feature DOM.
- **SPEC-011** (Approved) — REQ-006, added by AMEND-001 on an owner decision of
  2026-07-24, mandates the period-hint caption.
- **SPEC-015** — added the DOM overlay (`mapOverlay`) that renders cluster count
  badges as real `<span>` elements. This is what makes SPEC-010 AMEND-001's
  architectural premise out of date.
- **SPEC-018** (Implemented) — UX-002's second acceptance criterion pins the
  standing reconstruction label as "present and unchanged".
- **SPEC-019** (Implemented) — UX-004 requires the snapshot date to be visible
  without a hover or a second click, and `acceptedPer` on the reveal.

This spec introduces no new product capability. It removes copy, moves two
disclosures to better carriers, and renames one heading.

## Problem statement

Five sentences in the shipped UI explain the interface rather than let the
interface speak, and one heading uses a phrase ("Established classification")
that is longer and vaguer than the object it labels (a taxonomic tree). Deleting
them naively would silently drop four requirements, which the repository's rules
forbid. The problem is to remove the copy *and* leave every requirement either
still satisfied by a named carrier or explicitly amended by the owner.

## Goals

- Delete the five pieces of copy the owner named, at their exact sites.
- Rename one heading.
- Keep every affected requirement satisfied by a named, verifiable carrier, or
  record an owner-approved amendment that retires it.
- Improve, not merely preserve, the cluster disclosure: put the meaning on the
  cluster itself as an accessible name (SPEC-010 REQ-002's original intent).
- Keep the puzzle's snapshot-date provenance on screen at the moment the
  classification is asserted (the reveal).
- Leave no orphaned CSS, no orphaned comment, and no deleted or skipped test.
- Surface — not resolve unilaterally — the one deletion that collides with the
  authoritative functional specification.

## Non-goals

- **Not** a redesign of any of the five surfaces. Nothing moves, resizes or
  restyles beyond removing the deleted element and its dead rules.
- **Not** a change to any behaviour the deleted copy described. Clusters still
  cluster the same way; the period quick-select still jumps to the same stage;
  the map is still a reconstruction; the snapshot is still the same snapshot.
- **Not** a change to the taxonomy tree itself, its ordering, its marks, or its
  interaction — only its heading string.
- **Not** a general sweep for other explanatory copy. Only the six sites named by
  the owner are in scope; anything else found is recorded for a future spec, per
  the no-opportunistic-refactor rule.
- **Not** an update of the mockup SVGs and mockup pages that will drift as a
  result. They are listed below as a follow-up, not changed here.
- **Not** a retirement of FONC-300 or CONS-120. This spec has no authority to
  amend the functional specification; it asks the owner to decide.

## Users or actors

- **The Explorer** (charter §1) — the primary reader of every deleted line. Four
  of the five carry provenance or scope information this user relies on to judge
  what they are looking at.
- **Screen-reader users** — directly affected, and net better off: REQ-001/002
  give clusters a spoken name they do not have today.
- **A reviewer** checking the shipped UI against requirements — affected by the
  amendments, since three requirement texts change meaning.

## Requirement collision analysis

This section is analysis, not requirements. It records what was verified in the
code and the governing documents on 2026-08-14, because the amendments below
depend on it.

| # | Deleted copy | Site | Claimed carrier | Verified? |
| - | ------------ | ---- | --------------- | --------- |
| 1 | Brand subtext | `ContextBar.tsx:46-49` | FONC-400 | **Partly — corrected below** |
| 2 | Period hint | `TimelineControl.tsx:282-284` | SPEC-011 REQ-006 | Yes |
| 3 | Reconstruction banner | `ExplorationView.tsx:458-460` | SPEC-018 UX-002 | Yes, **and more** |
| 4 | Cluster legend | `ExplorationView.tsx:477-483` | SPEC-010 REQ-002 | Yes, **but via AMEND-001** |
| 5 | Puzzle footer line | `DailyGenusScreen.tsx:884-887` | SPEC-019 UX-004 | Yes |
| 6 | Heading rename | `DailyGenusScreen.tsx:518` | — | No spec mandates the string |

**Item 1 — FONC-400 does not need an amendment; SPEC-003 REQ-005 does.**
FONC-400 reads "The system must **not present** the application as a complete
atlas of all Mesozoic life." That is a **prohibition**, and a prohibition is
satisfied by omission: deleting a disclaimer cannot cause the app to start
claiming completeness. The same is true of AC-230 in
`docs/requirements/acceptance-criteria.md` ("…**does not** present itself as…"),
which is a derived document in any case. What *does* mandate visible text is
**SPEC-003 REQ-005's acceptance criterion**: "a disclaimer/label conveys the app
is not a complete atlas of all Mesozoic life." That criterion is the thing this
deletion breaks, and it is what AMEND-005 below changes. The functional
specification is left untouched, and FONC-400 stays live and satisfied — the
permanent `Group: Dinosaurs` context stat (FONC-050, `ContextBar.tsx:65-68`) and
the product title "Mesozoic **Dinosaur** Atlas" continue to bound the scope
without asserting completeness.

**Item 3 — the collision is wider than SPEC-018, and it is blocking.** The
banner is pinned by *three* documents, not one:

- `SPEC-003` REQ-002 acceptance: "a persistent 'Paleogeographic reconstruction'
  label is present" (`docs/specs/implemented/SPEC-003-exploration-view.md:131`).
- `SPEC-018` UX-002 acceptance: "The standing 'Paleogeographic reconstruction'
  label remains present and unchanged" (line 326).
- **`FONC-300` [MVP]** — "The system **must clearly indicate** that the ancient
  map displayed is a paleogeographic reconstruction" — and **`CONS-120` [MVP]**
  — "The system **must state** that ancient maps are scientific reconstructions
  and not direct observations."

FONC-300 and CONS-120 live in the **functional specification**, which is tier-1
authoritative and outranks every spec. They are positive, visible-statement
requirements, and a full inspection of `src/app/` found **no other visible
carrier**:

- The per-occurrence "reconstructed" cue was deliberately deleted by SPEC-007
  REQ-001, whose rationale says the standing map label is retained *instead*.
- `OccurrenceMap.tsx:959` carries `aria-label="Paleogeographic map of fossil
  occurrences (reconstruction)"` — accessible only, not visible.
- The basemap attribution (`OccurrenceMap.tsx:1051-1105`) states the
  reconstruction detail **inside a popover behind an icon button** — i.e. a
  secondary interaction, which **CONS-490** forbids for information that changes
  the scientific interpretation of the content. `test/e2e/exploration.e2e.ts:29-33`
  records this in a comment: the banner is "the always-visible provenance cue"
  and the detail "lives behind the labelled attribution toggle".

Deleting the banner therefore leaves FONC-300 and CONS-120 with no compliant
carrier. Per `DOCUMENTATION_AUTHORITY.md` rule 8 and CLAUDE.md ("if a blocking
conflict exists, ask the human to decide — do not guess"), UX-003 below is
**gated** on the owner decision in *Human decisions required*.

**Item 4 — the parent analysis is right about REQ-002's original text but the
governing text today is AMEND-001, and the architecture has since changed.**
SPEC-010 REQ-002's acceptance did ask for "a cluster's accessible name states a
record count (e.g. '42 occurrence records')", and
`src/app/components/OccurrenceMap.tsx` has **no accessible name on any cluster**
— verified: the count badges at lines 976-988 are explicitly
`aria-hidden="true"`, and no other element names a cluster. But **SPEC-010
AMEND-001** (2026-07-22) already replaced that criterion with the DOM legend
paragraph, on the stated grounds that "the map is a WebGL canvas with no
per-feature DOM … so a per-cluster accessible name is not achievable in this
architecture". So the paragraph is not an accidental carrier — it is the
*current, amended* carrier, by design.

That amendment's premise is now **out of date**. SPEC-015 introduced a DOM
overlay (`styles.mapOverlay`) that renders one real `<span>` per rendered
cluster, positioned in the map's pixel space, carrying the cluster's count.
A per-cluster accessible name **is** achievable today: it only requires dropping
`aria-hidden` and giving the span text that names the unit. REQ-001 and REQ-002
below do exactly that, which restores SPEC-010 REQ-002's *original* acceptance
criterion and makes the amendment a reversion rather than a further weakening.

One consequence the overlay imposes: it renders only when `showCladeUi` is true,
and `showCladeUi = mode !== "locality"` (`OccurrenceMap.tsx:951`, `971`). In
**Locality** mode there are no DOM badges at all, so deleting the legend's
locality-mode sibling sentence would leave that mode with no carrier of any
kind. REQ-002 therefore requires the count overlay to render in Locality mode
too. This was not in the original brief and is the minimum needed to avoid a
regression.

**Item 5 — the letter of UX-004 survives; its timing narrows.** UX-004's two
relevant acceptance criteria are "The snapshot date is visible without a hover or
a second click" and "The reveal shows `acceptedPer` for the answer". The reveal
(`DailyGenusScreen.tsx:683-702`) currently shows `accepted per …` but **not** the
snapshot date — confirmed; the date lives only in the deleted footer
(`snapshotDate = api.metadata().retrievedOn`, line 425). Moving it into the
reveal's meta line keeps **both criteria literally true**: the reveal appears on
its own when the round finishes, so the date is still behind neither a hover nor
a click. The parent's reading holds to the letter, and SPEC-019's traceability
row already *describes* the intended state ("snapshot date + `acceptedPer` in the
reveal", line 935) — implementing REQ-003 makes that row accurate for the first
time.

What does change is **when** it is visible: today, throughout the round; after
this change, from the reveal onward. UX-004's *statement* says "The screen states
that the classification being played on is the shipped PBDB snapshot at its
`retrievedOn` date", which reads as a standing property of the screen. Narrowing
a provenance disclosure is a behavioral change under `DOCUMENTATION_AUTHORITY.md`
rule 6, so AMEND-001 for SPEC-019 is provided below to record it. If the owner
reads UX-004's acceptance criteria strictly (both remain satisfied), that block
may be dropped without changing anything this spec requires.

**Item 6 — no amendment needed, confirmed.** The string "Established
classification" appears **only** in `src/app/components/DailyGenusScreen.tsx:518`
and in tests and one mockup asset. SPEC-019 and SPEC-020 nowhere mandate a
heading string; SPEC-019 specifies the tree's structure, marks and behaviour, not
its label. The rename is unconstrained by any requirement.

## Functional requirements

### REQ-001: A cluster states its own unit as an accessible name

- **Statement:** Each rendered map cluster must carry an accessible name in the
  DOM that states both its count and the unit being counted, so the meaning
  "records at this location, not distinct taxa" is attached to the cluster
  itself rather than to a paragraph elsewhere on the page. In **Occurrence** mode
  the name must read as an occurrence-record count (e.g. "42 occurrence
  records"); in **Locality** mode as a locality count (e.g. "12 localities"). The
  visible badge glyph (the bare number) is unchanged. The name must be delivered
  on the existing SPEC-015 count-badge spans in `styles.mapOverlay`
  (`OccurrenceMap.tsx:976-988`) by removing `aria-hidden="true"` and supplying
  text; no new visible element is added.
- **Rationale:** This restores SPEC-010 REQ-002's original acceptance criterion
  ("a cluster's accessible name states a record count"), which SPEC-010 AMEND-001
  had to abandon in 2026-07 because no per-cluster DOM existed. SPEC-015's
  overlay removed that obstacle. Attaching the meaning to the object rather than
  captioning it beside the object is also what the anti-slop checklist asks for
  ("make a verdict a mark on the object, not a badge beside it").
- **Acceptance criteria:**
  - With mode = Occurrences and at least one cluster rendered, an element with an
    accessible name matching `/\d+ occurrence records?/i` exists for each cluster.
  - With mode = Localities, the equivalent name matches `/\d+ localit(y|ies)/i`.
  - No cluster badge remains `aria-hidden`.
  - The visible badge text is still the bare integer — no visible wording added.
  - No colour-only signal is introduced (SPEC-010 REQ-002, unchanged).
- **Verification method:** automated component test + inspection.
- **Evidence location:** `test/ui/grouping-mode.test.tsx`,
  `src/app/components/OccurrenceMap.tsx`.

### REQ-002: The cluster-count overlay renders in Locality mode

- **Statement:** The map's count-badge overlay must render in **Locality** mode
  as well as Occurrence mode, so that REQ-001's accessible name has a carrier in
  every mode where clusters exist. The clade key and the name labels, which are
  the reason the overlay is currently gated on `showCladeUi`
  (`OccurrenceMap.tsx:951`), must remain hidden in Locality mode; only the count
  badges become mode-independent.
- **Rationale:** Without this, deleting the legend's locality-mode sentence
  (UX-004) leaves Locality mode with no disclosure at all — neither visible nor
  accessible — which would be a regression against SPEC-010 REQ-003 and against
  charter §2. Taxon mode is excluded because it does not collapse points into
  clusters (SPEC-010 AMEND-001).
- **Acceptance criteria:**
  - In Locality mode with a cluster rendered, a count badge is present with
    REQ-001's accessible name.
  - In Locality mode the clade key (`aria-label="Clade key"`) and the map name
    labels remain absent, exactly as today.
  - In Taxon mode no cluster badge is required and none is added.
- **Verification method:** automated component test.
- **Evidence location:** `test/ui/grouping-mode.test.tsx`.

### REQ-003: The snapshot date moves into the answer reveal

- **Statement:** The puzzle's answer reveal must state the snapshot the
  classification comes from, using the same `api.metadata().retrievedOn` value
  the deleted footer used, rendered as part of the reveal's existing meta or
  source line alongside `accepted per …`. No new element, container or heading is
  added; the date joins a line that already exists.
- **Rationale:** SPEC-019 UX-004 requires the snapshot date to be legible without
  a hover or a second click, and requires the reveal to name what the accepted
  name rests on. The reveal is the exact moment the game asserts a placement, so
  it is where the "whose classification is this" question is actually asked
  (UX-004 rationale). This keeps the deletion in UX-005 from dropping the date.
- **Acceptance criteria:**
  - On a finished round (won or lost), the reveal contains the snapshot date
    string returned by `api.metadata().retrievedOn`.
  - The reveal still shows `accepted per …`, or the existing "accepted name —
    source not available" fallback when `acceptedPer` is absent.
  - The date is plain text in the reveal — not a tooltip, `title`, or anything
    requiring an interaction.
  - No copy in the reveal asserts a placement without naming its source.
- **Verification method:** automated component test + inspection.
- **Evidence location:** `test/ui/spec019-daily-screen.test.tsx`,
  `test/e2e/spec019-daily.e2e.ts`.

## Non-functional requirements

### NFR-001: Tests are updated to the new state, never removed or skipped

- **Statement:** Every test that asserts one of the deleted strings must be
  **updated** to assert the new state — the absence of the deleted copy plus the
  presence of its replacement carrier where one exists. No test may be deleted,
  skipped, `.only`-d around, or weakened to a no-op to make the suite pass. Where
  a deletion removes a test's entire subject and a replacement carrier exists
  (items 4 and 5), the test must assert the replacement.
- **Rationale:** CLAUDE.md core rule — failing tests are not to be suppressed,
  skipped or deleted. These assertions are the evidence trail for four
  requirements; silently dropping them would erase the traceability the
  amendments depend on.
- **Acceptance criteria:**
  - The seven test files listed in the Test plan are all modified, and none is
    deleted.
  - `git diff` shows no new `.skip`, `.todo`, `.only`, or commented-out
    assertion in the test tree.
  - `pnpm test` passes with no skipped tests introduced by this change.
- **Verification method:** automated (`pnpm test`) + diff inspection at review.
- **Evidence location:** the change's diff; CI run on the PR.

### NFR-002: No orphaned styles or stale comments are left behind

- **Statement:** The CSS rules and source comments that exist only to support the
  deleted copy must be removed in the same change, and no rule may be left
  matching nothing. Specifically: `.brandSub`, `.periodHint`,
  `.reconstructionBanner` and `.mapLegend` in
  `src/app/components/exploration.module.css`; the `.provenance` selector within
  the shared `.entryNote, .note, .record, .provenance` group in
  `src/app/components/dailyGenus.module.css` (the group itself stays — the other
  three selectors are live); the explanatory comments at
  `TimelineControl.tsx:278-281`, `exploration.module.css:190-191` and
  `exploration.module.css:1296-1298`; and the scope sentence in `ContextBar.tsx`'s
  file header comment (line 5).
- **Rationale:** Dead CSS and comments describing removed elements are exactly
  the drift the repository's rules exist to prevent, and a comment that still
  cites SPEC-010 REQ-002 for a paragraph that no longer exists would mislead the
  next agent.
- **Acceptance criteria:**
  - None of `brandSub`, `periodHint`, `reconstructionBanner`, `mapLegend`
    appears in any `.css` or `.tsx` file after the change. (`mapLegend2`, the
    clade key in `OccurrenceMap.tsx:1036`, is a **different** class and stays.)
  - `.provenance` appears in no stylesheet; `.entryNote`, `.note` and `.record`
    are unchanged.
  - `styles.foot` in `DailyGenusScreen.tsx` is not rendered as an empty bordered
    footer when the storage note is absent — see UX-005.
  - `pnpm run typecheck` and the lint step pass.
- **Verification method:** automated grep-style test + `pnpm run typecheck` +
  inspection.
- **Evidence location:** `test/ui/spec018-no-depth-claim.test.ts` (already reads
  the source files as text and is the established pattern for this kind of
  assertion), `src/app/components/*.module.css`.

## Security and privacy considerations

None. No requirement here touches data, network, storage or a trust boundary.
SPEC-020 NFR-001 (no network egress on the Daily Genus screens) is unaffected —
the change removes DOM and CSS only, and the one test that guards it
(`test/ui/spec020-no-egress.test.tsx`) is updated for the heading rename without
touching its egress assertion.

## Data model impact

None. No domain type, snapshot field, read-model shape or pipeline step changes.
REQ-003 reuses `api.metadata().retrievedOn`, which is already read on
`DailyGenusScreen.tsx:425`.

## API impact

None. No interface signature changes. The only interface-visible change is the
rendered DOM and the accessible-name surface described in REQ-001/002.

## UI or UX impact

### UX-001: The brand subtext is removed

- **Statement:** The `<span className={styles.brandSub}>` and its text
  "Non-avian dinosaurs · fossil occurrences · not a complete atlas of Mesozoic
  life" must be removed from `src/app/components/ContextBar.tsx:46-49`. The
  `<h1>` brand title stays. The surrounding `.brand` container is not restyled;
  it simply holds one child instead of two.
- **Rationale:** Owner decision, 2026-08-14 — delete outright rather than
  relocate. FONC-400 is a prohibition and stays satisfied by omission (see the
  collision analysis); SPEC-003 REQ-005's acceptance criterion is amended.
- **Acceptance criteria:**
  - No rendered text matches `/complete atlas/i` anywhere in the app.
  - The `<h1>` "Mesozoic Dinosaur Atlas" is unchanged and still the banner's
    heading.
  - The permanent `Group` context stat still reads "Dinosaurs" on load (SPEC-003
    REQ-005, otherwise unchanged).
- **Verification method:** automated component test.
- **Evidence location:** `test/ui/exploration-context.test.tsx`.

### UX-002: The period hint is removed

- **Statement:** The `<p className={styles.periodHint}>` and its text "Periods
  jump to their most fossil-rich stage." must be removed from
  `src/app/components/TimelineControl.tsx:282-284`, together with the comment
  above it. The period quick-select buttons and the stage track are otherwise
  untouched.
- **Rationale:** Owner decision, 2026-08-14, reversing the 2026-07-24 decision
  (a) that created SPEC-011 REQ-006. The caption described behaviour, not
  uncertainty or provenance, so CONS-490 does not apply to it.
- **Acceptance criteria:**
  - No rendered text matches `/fossil-rich/i` anywhere in the app.
  - Selecting a period still selects that period's `representative` stage —
    identical behaviour, verified by the existing assertion in
    `test/ui/timeline-periods.test.tsx`.
- **Verification method:** automated component test.
- **Evidence location:** `test/ui/timeline-periods.test.tsx`.

### UX-003: The map's reconstruction banner is removed — **ungated (disposition A)**

- **Statement:** The `<span className={styles.reconstructionBanner}>` and its
  content "▲ Paleogeographic reconstruction" must be removed from
  `src/app/components/ExplorationView.tsx:458-460`, with **no compensating
  carrier**. The owner recorded disposition **A** (retire FONC-300 and CONS-120)
  on 2026-08-14 under *Human decisions required*, so this requirement is ungated
  and implemented as written. Implementation is conditional only on the
  functional-specification amendment below being applied in the same change —
  the banner must not be deleted while FONC-300 and CONS-120 still stand, or the
  repository is left in violation of its own tier-1 document.
- **Rationale:** Owner decision, 2026-08-14, to delete. A gate existed because
  FONC-300 [MVP] and CONS-120 [MVP] are positive, visible-statement requirements
  in the tier-1 authoritative functional specification, and inspection found no
  other compliant carrier: the per-occurrence cue was removed by SPEC-007
  specifically because this label was kept, the map's `aria-label` is not
  visible, and the attribution popover is a secondary interaction that CONS-490
  rules out for interpretation-changing information. The owner resolved the gate
  by retiring both requirements rather than relocating the statement.
- **Acceptance criteria:**
  - No rendered text matches `/Paleogeographic reconstruction/i` in
    `ExplorationView.tsx`, and `.reconstructionBanner` is gone from the
    stylesheet.
  - FONC-300 and CONS-120 carry an owner-approved retirement note in
    `docs/product/functional-specification.md`, and charter §2 and its status
    table no longer cite the standing label as the mechanism — applied in the
    same change as the deletion, never after it.
  - No compensating carrier is added: the map states nothing about being a
    reconstruction outside the attribution popover.
  - The basemap attribution control and its popover are unchanged.
- **Verification method:** automated component test + inspection of the retired
  FONC-300/CONS-120 notes and the recorded decision.
- **Evidence location:** `test/ui/spec018-no-depth-claim.test.ts`,
  `test/e2e/exploration.e2e.ts`.

### UX-004: The cluster-semantics legend is removed

- **Statement:** The `<p className={styles.mapLegend} role="note">` block at
  `src/app/components/ExplorationView.tsx:477-483` must be removed in full —
  both branches: the occurrence-mode sentence "Clusters count fossil records at a
  location (density), not distinct taxa." and its locality-mode sibling "Each
  marker is one locality; clusters count how many localities are grouped here —
  not distinct taxa." The `state.mode !== "taxon"` guard goes with it.
- **Rationale:** Owner decision, 2026-08-14. The meaning it carried does not
  disappear — REQ-001/002 move it onto the clusters themselves, which is what
  SPEC-010 REQ-002 asked for originally and what the anti-slop checklist prefers
  to a caption beside the object.
- **Acceptance criteria:**
  - No rendered text matches `/not distinct taxa/i` anywhere in the app.
  - REQ-001's accessible name is present in the same render where the paragraph
    used to be, in both Occurrence and Locality mode.
  - Taxon mode is unaffected (it never rendered the paragraph).
- **Verification method:** automated component test.
- **Evidence location:** `test/ui/grouping-mode.test.tsx`.

### UX-005: The puzzle's footer provenance line is removed

- **Statement:** The `<span className={styles.provenance}>` and its text "Per
  PBDB snapshot {snapshotDate} — a placement is a sourced opinion, not a settled
  fact" must be removed from `src/app/components/DailyGenusScreen.tsx:884-887`.
  Because that span was the footer's only unconditional child, the
  `<footer className={styles.foot}>` element must not render at all when the
  storage note is absent, so no empty bordered bar is left on the page.
- **Rationale:** Owner decision, 2026-08-14. The snapshot date it carried moves
  to the reveal under REQ-003; the "sourced opinion, not a settled fact" framing
  is retired as copy — the reveal's `accepted per …` line states whose opinion
  the placement is, which is UX-004's actual mechanism.
- **Acceptance criteria:**
  - No rendered text matches `/sourced opinion/i` or `/Per PBDB snapshot/i`
    anywhere in the app.
  - With storage available, no `footer` element renders on the Daily Genus
    screen and no stray top border appears above the board.
  - With storage blocked, the footer still renders and still carries the
    "Progress will not be kept…" note unchanged.
  - REQ-003's snapshot date is present on the reveal.
- **Verification method:** automated component test (both storage states) +
  inspection.
- **Evidence location:** `test/ui/spec019-daily-screen.test.tsx`,
  `test/e2e/spec019-daily.e2e.ts`.

### UX-006: The tree heading is renamed

- **Statement:** The `<h2 className={styles.eyebrow}>` at
  `src/app/components/DailyGenusScreen.tsx:517-519` must read **"Taxonomic
  tree"** instead of "Established classification". The heading level, its
  `id`/`aria-labelledby` wiring to the tree `<section>`, and its styling are
  unchanged.
- **Rationale:** Owner decision, 2026-08-14. "Taxonomic tree" names the object on
  screen in the domain's own vocabulary (charter §3); "Established
  classification" describes a property of it. No spec mandates either string —
  verified: the phrase occurs nowhere in `docs/specs/**`.
- **Acceptance criteria:**
  - The tree section's accessible name is "Taxonomic tree".
  - No rendered text matches `/established classification/i` anywhere in the app.
  - The section is still labelled by this heading (`aria-labelledby` intact), so
    the region remains named for screen readers.
- **Verification method:** automated component test.
- **Evidence location:** `test/ui/spec019-daily-screen.test.tsx`,
  `test/ui/spec020-no-egress.test.tsx`, `test/e2e/spec019-daily.e2e.ts`.

## Configuration impact

None. No environment variable, feature flag, build setting or token value
changes. No value is added to `src/app/styles/tokens.css`; the change only
removes rules that consumed existing tokens.

## Error handling

No new error conditions. Two existing states are explicitly preserved:

- **Map error / loading state.** The reconstruction banner sits outside the
  `stageStatus` branch in `ExplorationView.tsx`, so it renders over the error and
  loading states too. Under UX-003 disposition B, the compensating carrier must
  also be present in those states, or the map's error state would assert nothing
  about what the map is. Under A it is absent in all three states alike.
- **Storage-blocked state.** UX-005 must not disturb the "Progress will not be
  kept" note, which is the Daily Genus screen's only footer content once the
  provenance line is gone.

## Edge cases

- **No clusters on screen.** At high zoom, or with a sparse stage, MapLibre may
  render zero clusters. REQ-001's accessible names then simply do not exist —
  which is correct, since there is nothing to misread. Tests must not assume a
  cluster is always present; they must select a fixture/stage that produces one.
- **A cluster of exactly one.** `clusterMaxZoom` and `clusterRadius`
  (`OccurrenceMap.tsx:574-582`) mean single points are unclustered, so a count of
  1 should not occur; if it does, the accessible name must still read
  grammatically ("1 occurrence record", "1 locality"), not "1 occurrence
  records".
- **WebGL unavailable.** `OccurrenceMap.tsx:962-970` replaces the map with a
  note and renders no overlay. There are no clusters, so REQ-001/002 are
  vacuously satisfied and the note is unchanged by this spec.
- **Taxon mode.** Points are not collapsed, so no cluster badge and no accessible
  name is required (SPEC-010 AMEND-001). Deleting the paragraph is a no-op there.
- **`acceptedPer` absent.** REQ-003 must still render the snapshot date; the
  existing "accepted name — source not available" fallback is untouched.
- **A very long `retrievedOn` string.** The reveal meta line must wrap rather
  than clip (charter §6, long labels).
- **Practice / well-known track (SPEC-020).** Both tracks render the same
  `DailyGenusScreen`, so UX-005, UX-006 and REQ-003 apply to both. The
  well-known-track test asserts the heading and must be updated.

## Acceptance criteria

This spec is satisfied when all of the following hold:

1. None of these strings is rendered anywhere in the app: `complete atlas`,
   `fossil-rich`, `not distinct taxa`, `sourced opinion`, `Per PBDB snapshot`,
   `established classification`. Plus `Paleogeographic reconstruction` in
   `ExplorationView.tsx`, subject to the UX-003 gate.
2. The tree section on the Daily Genus screen is named "Taxonomic tree".
3. Every rendered cluster has an accessible name stating its count and unit, in
   both Occurrence and Locality mode.
4. The answer reveal shows the snapshot date and `accepted per …` together.
5. Every one of the seven affected test files has been updated — none deleted,
   none skipped — and `pnpm test` and `pnpm run typecheck` pass.
6. `.brandSub`, `.periodHint`, `.reconstructionBanner`, `.mapLegend` and the
   `.provenance` selector no longer exist, and no stale comment references them.
7. The five amendment blocks in *Required amendments to existing specs* have been
   transplanted into their target specs, with correct numbering.
8. The owner's FONC-300 / CONS-120 disposition is recorded, and UX-003 has been
   implemented or withdrawn accordingly.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Each cluster has an accessible name naming count + unit; badges not `aria-hidden`; visible glyph still the bare integer | automated + inspection | `pnpm test grouping-mode` | `test/ui/grouping-mode.test.tsx` | |
| REQ-002 | Count badges render in Locality mode; clade key and name labels stay hidden there | automated | `pnpm test grouping-mode` | `test/ui/grouping-mode.test.tsx` | |
| REQ-003 | Finished reveal contains `retrievedOn` and `accepted per …`, as plain text | automated + inspection | `pnpm test spec019-daily-screen` | `test/ui/spec019-daily-screen.test.tsx`, `test/e2e/spec019-daily.e2e.ts` | |
| UX-001 | No `/complete atlas/i` rendered; `<h1>` and the Group stat unchanged | automated | `pnpm test exploration-context` | `test/ui/exploration-context.test.tsx` | |
| UX-002 | No `/fossil-rich/i` rendered; period quick-select still picks `representative` | automated | `pnpm test timeline-periods` | `test/ui/timeline-periods.test.tsx` | |
| UX-003 | Disposition recorded; banner absent (A/B) with B's carrier present and visible; attribution unchanged | automated + manual | `pnpm test spec018-no-depth-claim`; `pnpm exec playwright test exploration` | `test/ui/spec018-no-depth-claim.test.ts`, `test/e2e/exploration.e2e.ts` | |
| UX-004 | No `/not distinct taxa/i` rendered; REQ-001 name present in both modes | automated | `pnpm test grouping-mode` | `test/ui/grouping-mode.test.tsx` | |
| UX-005 | No `/sourced opinion/i` or `/Per PBDB snapshot/i`; no empty footer with storage; storage-blocked note intact | automated + inspection | `pnpm test spec019-daily-screen` | `test/ui/spec019-daily-screen.test.tsx`, `test/e2e/spec019-daily.e2e.ts` | |
| UX-006 | Tree section named "Taxonomic tree"; no `/established classification/i`; `aria-labelledby` intact | automated | `pnpm test spec019-daily-screen spec020-no-egress` | `test/ui/spec019-daily-screen.test.tsx`, `test/ui/spec020-no-egress.test.tsx`, `test/e2e/spec019-daily.e2e.ts` | |
| NFR-001 | All seven test files modified, none deleted; no new skip/only/todo; suite green | automated + diff review | `pnpm test`; `git diff -- test` | CI run on the PR | |
| NFR-002 | Four classes plus the `.provenance` selector gone; comments updated; typecheck clean | automated + inspection | `pnpm run typecheck`; `pnpm test spec018-no-depth-claim` | `test/ui/spec018-no-depth-claim.test.ts`, `src/app/components/*.module.css` | |

## Test plan

**Unit / component (Vitest, `pnpm test`).** Seven files assert on the affected
strings. All were located by grepping the literals across `src`, `test` and
`docs`; every one is **updated**, none removed (NFR-001).

| File | Line | Asserts today | Required change |
| ---- | ---- | ------------- | --------------- |
| `test/ui/exploration-context.test.tsx` | 38-40 | `getByText(/not a complete atlas of Mesozoic life/i)` (comment cites FONC-400) | Invert to `queryByText(...)` → `null`; retarget the FONC-400 comment at the permanent `Group: Dinosaurs` stat, which the same test already exercises (UX-001) |
| `test/ui/timeline-periods.test.tsx` | 43-45 | `getByText(/most fossil-rich stage/i)` | Invert to absent; the file's existing assertion that a period selects its `representative` stage stays and becomes the regression guard (UX-002) |
| `test/ui/spec018-no-depth-claim.test.ts` | 44-47 | `expect(exploration).toMatch(/Paleogeographic reconstruction/i)` in the test "the standing reconstruction label is untouched" | Under UX-003 A/B: rewrite the test to assert the banner's absence, and under B to assert the compensating carrier. Under C: unchanged. Also add NFR-002's dead-class assertions here — this file already reads component sources as text, so it is the established home for them |
| `test/ui/grouping-mode.test.tsx` | 36-39 | `getByText(/clusters count fossil records .* not distinct taxa/i)` under the comment "REQ-002: the cluster legend discloses…" | Replace with REQ-001's accessible-name assertion in Occurrence mode, add the Locality-mode case (REQ-002), and assert the paragraph is gone (UX-004) |
| `test/ui/spec019-daily-screen.test.tsx` | 133-139 | `getByText(/Per PBDB snapshot 2026-07-26 — a placement is a sourced opinion/i)` in "UX-004: the snapshot date is visible…" | Rewrite to play a round to completion and assert the date on the reveal beside `accepted per …` (REQ-003, UX-005); keep the test name tied to UX-004 |
| `test/ui/spec019-daily-screen.test.tsx` | 221 | `expect(text).toContain("established classification")` inside the domain-language test | Change to `"taxonomic tree"`; the banned-word list around it is untouched (UX-006) |
| `test/ui/spec020-no-egress.test.tsx` | 86 | `getByText(/ESTABLISHED CLASSIFICATION/i)` as the "screen rendered" probe for the well-known track | Change the probe to `/TAXONOMIC TREE/i`; the egress assertions in the same test are untouched (UX-006) |

**End-to-end (Playwright).**

| File | Line | Asserts today | Required change |
| ---- | ---- | ------------- | --------------- |
| `test/e2e/exploration.e2e.ts` | 23, 29-33 | `getByText(/Paleogeographic reconstruction/i)` visible, and a comment calling it "the always-visible provenance cue" | Governed by the UX-003 gate. Under A: drop the visibility assertion and rewrite the comment to record that FONC-300's carrier was retired by owner decision. Under B: point both at the new carrier. Under C: unchanged |
| `test/e2e/spec019-daily.e2e.ts` | 22 | `getByText(/ESTABLISHED CLASSIFICATION/i)` | Change to `/TAXONOMIC TREE/i` (UX-006) |
| `test/e2e/spec019-daily.e2e.ts` | 45 | `getByText(/Per PBDB snapshot/i)` visible | Move the assertion to the finished-round reveal (REQ-003) |

**Checked and confirmed *not* affected** (they were candidates but contain none
of the strings): `test/ui/scenario-perf-370.test.tsx`, `test/e2e/a11y.e2e.ts`.
The a11y e2e run is still a required gate for REQ-001/002 — adding accessible
names to previously `aria-hidden` elements is exactly the kind of change that can
trip the axe gate — so `pnpm exec playwright test a11y` must be run and reported
even though the file needs no edit.

**Fixtures.** No new fixture. REQ-001/002 need a render in which MapLibre
produces at least one cluster; the existing `grouping-mode` harness already
renders the fixture stage that the current legend assertion runs against, so the
same setup applies. If the jsdom harness cannot produce a rendered cluster, the
accessible-name assertion must be made against the badge-rendering unit rather
than skipped — see *Open questions*.

**Commands to run and report** (CLAUDE.md — report every command and its real
result): `pnpm run typecheck`, `pnpm test`, `pnpm exec playwright test`, plus
`python3 scripts/validate_specs.py`, `python3 scripts/validate_governance.py`
and `python3 scripts/validate_drift.py`.

## Documentation follow-up (not changed by this spec)

Deleting the copy puts the following design assets out of date. They are
**listed, not edited** — updating mockups is a separate change under its own
spec, per the no-opportunistic-refactor rule. Recording them here is what stops
`/drift-check` from finding an unexplained conflict later.

| Asset | Line | Drifts because |
| ----- | ---- | -------------- |
| `docs/assets/mockups/exploration-view.svg` | 74 | Draws "Paleogeographic reconstruction · 150 Ma" on the map (UX-003, disposition-dependent) |
| `docs/mockups/exploration-view.md` | 21 | Prose: the map is "clearly labeled as a paleogeographic reconstruction (FONC-210, FONC-220…)" (UX-003) |
| `docs/assets/mockups/daily-genus.svg` | 24 | Eyebrow reads "ESTABLISHED CLASSIFICATION" (UX-006) |
| `docs/assets/mockups/daily-genus.svg` | 159 | Footer reads "Per PBDB snapshot 26 Jul 2026 — a placement is a sourced opinion" (UX-005) |
| `docs/assets/mockups/daily-genus-states.svg` | 154 | Same footer line, on the state-variants sheet (UX-005) |
| `docs/mockups/daily-genus.md` | 66 | Prose: "the snapshot date **on the screen**, and `acceptedPer` on the reveal" — becomes "both on the reveal" (REQ-003) |
| `docs/mockups/design-guidelines.md` | 41-42, 119 | Charter §2 and the status table both state that reconstructed positions carry a standing map-level "Paleogeographic reconstruction" label. **Only under UX-003 disposition A or B**, and only after the owner decides — the charter is binding on UI work, so this one is not optional follow-up but a required consequence of the decision |

No mockup asset carries the brand subtext, the period hint or the cluster legend,
so UX-001, UX-002 and UX-004 create no documentation drift.

## Rollback plan

Low risk and cleanly reversible. The change is confined to five components, two
stylesheets and ten test files; there is no data, migration, storage or network
surface, so `git revert` of the single squashed commit restores the previous
behaviour exactly, with no cleanup step.

Partial rollback is also safe, because the six sites are independent: any one
UX-00N can be reverted on its own. Two ordering constraints apply:

- Reverting UX-004 without also reverting REQ-001/002 is fine (the paragraph
  returns and the accessible names simply remain — a duplicate disclosure, not a
  conflict). Reverting REQ-001/002 **without** reverting UX-004 is not: that
  would leave clusters with no disclosure at all. Revert them together.
- Reverting UX-005 without REQ-003 leaves the date in two places (harmless);
  reverting REQ-003 without UX-005 is fine (the footer carries the date again).

If the amendments have already been transplanted, a revert must also strike the
transplanted AMEND blocks, or the specs will describe a state the code no longer
has.

## Open questions

- [x] Does FONC-400 need a functional-specification amendment? **No** — resolved
      in the collision analysis: it is a prohibition, satisfied by omission. The
      amendment belongs to SPEC-003 REQ-005's acceptance criterion instead.
- [x] Does any spec mandate the string "Established classification"? **No** —
      resolved by inspection; it appears in no document under `docs/specs/`.
- [x] Is a per-cluster accessible name achievable, given SPEC-010 AMEND-001 says
      it is not? **Yes** — resolved: SPEC-015's DOM overlay post-dates that
      amendment and renders one span per cluster.
- [x] Does moving the snapshot date to the reveal keep UX-004 satisfied? **Yes to
      the letter of both acceptance criteria**, with a narrowing of *when* it is
      visible; recorded as SPEC-019 AMEND-001 rather than left implicit.
- [ ] **Deferred to implementation:** can the jsdom test harness render a real
      MapLibre cluster badge? If not, REQ-001/002's assertion is made against the
      badge-rendering unit (the overlay's name-construction function, extracted
      if necessary) plus a Playwright assertion in `test/e2e/a11y.e2e.ts`. Either
      route satisfies the acceptance criteria; the choice is an implementation
      detail with no requirement consequence. It must **not** be resolved by
      skipping the test (NFR-001).
- [ ] **Deferred to implementation:** exact wording and placement of the snapshot
      date within the reveal (its own line versus appended to `revealSource`).
      Any form meeting REQ-003's criteria is acceptable; the charter's restraint
      rule favours appending to the existing line over adding a new one.

## Human decisions required

- [x] **RESOLVED — FONC-300 and CONS-120 have no carrier after UX-003.**
      Deleting the map banner removes the only visible statement that the map is
      a paleogeographic reconstruction. Both requirements are **[MVP] "must"** in
      the functional specification, which outranks every spec in this repository.
      Choose one:

      **A — Retire the requirements.** Accept that the atlas no longer states on
      screen that the map is a reconstruction. This needs an owner-approved
      strikethrough note on FONC-300 and CONS-120 in
      `docs/product/functional-specification.md`, following the SPEC-007
      precedent (lines 219 and 285), plus the corresponding edit to charter §2 and
      its status table. Cheapest visually, largest product concession — it moves
      the product's central credibility claim off the screen entirely, which
      charter §2 exists to prevent.

      **B — Delete the banner, move the statement onto the attribution control
      (recommended).** The map already has an always-visible control at the
      bottom-left whose popover states the reconstruction detail. Give that
      control a short visible text label (e.g. `▲ reconstruction`) instead of an
      icon alone. The banner disappears, no second element is added — one control
      replaces two — and FONC-300, CONS-120 and CONS-490 all stay satisfied
      because the statement is visible without any interaction. This also removes
      a bordered floating box from the map, which is what the anti-slop checklist
      wants.

      **C — Keep the banner.** Withdraw UX-003 from this spec; the other five
      changes proceed unaffected.

      **Answer: A — retire the requirements.** Recorded by the owner
      (nelsonjeanrenaud@gmail.com) in session on 2026-08-14, after being shown
      the trade-off above and the recommendation of B. The owner elected to
      remove the on-screen reconstruction statement entirely rather than relocate
      it onto the attribution control.

      This disposition is the **only** part of this spec that changes a tier-1
      document. It authorises the strikethrough note on FONC-300 and CONS-120 in
      `docs/product/functional-specification.md` recorded under *Required
      amendments to existing specs* below, following the SPEC-007 precedent, plus
      the consequent edit to charter §2 and its status table. UX-003 is therefore
      ungated and implemented as written: the banner is deleted with no
      compensating carrier.

      Agent note, recorded for the file rather than to reopen the decision: this
      is a product concession, not a documentation tidy-up. After it, nothing on
      the map states that the plate positions are a reconstruction of deep-time
      geography rather than present-day coastlines, and charter §2 ("uncertainty
      and provenance are first-class and always legible") loses its most
      load-bearing instance. The information survives only inside the attribution
      popover, which is a secondary interaction. Reversing later means restoring
      two [MVP] requirements and finding a carrier again.

- [x] **RESOLVED — FONC-1130 also loses its carrier, and was not part of
      disposition A.** Discovered after the owner answered the FONC-300/CONS-120
      question, so it was put to the owner separately rather than folded into
      that answer.

      **FONC-1130** [MVP] — "The system must indicate when a geographic position
      is reconstructed." Verified carrier chain: SPEC-007 (2026-07-21) retired
      the per-occurrence "reconstructed" chip **in favour of** the standing map
      label — `docs/mockups/design-guidelines.md:38-42` states this explicitly,
      and `src/app/components/OccurrencePanel.tsx:7` carries the matching code
      comment ("SPEC-007 retired the reconstructed cue"). A search of
      `OccurrencePanel`, `GroupedPanels`, `TaxonProfile` and `format.ts` finds no
      other cue. So the banner is FONC-1130's sole carrier too.

      This is a narrower and more concrete claim than FONC-300's: occurrence
      coordinates are rotated by a plate model (`rotationModel`), so without any
      cue a reader takes plotted points for literal modern positions. Choose one:

      **A2 — Retire FONC-1130 as well.** Consistent with disposition A; add a
      third strikethrough note in the same change.

      **B2 — Keep FONC-1130 and give it a carrier.** The occurrence and locality
      panels already exist and are where a position is actually read; a short
      factual line there satisfies it without putting anything back on the map.

      **C2 — Keep FONC-1130 with no carrier.** Not recommended: it leaves a live
      [MVP] "must" knowingly unsatisfied, which `/drift-check` should then fail
      on.

      **Answer: A2 — retire FONC-1130 as well.** Recorded by the owner
      (nelsonjeanrenaud@gmail.com) in session on 2026-08-14, after being shown
      the trade-off above and the recommendation of B2. Consistent with
      disposition A: the retirement note is added in the same change, and no
      carrier is introduced anywhere.

      Agent note, recorded for the file rather than to reopen the decision: with
      A and A2 together, the atlas no longer states at any point of reading that
      its plotted positions are plate-model reconstructions rather than modern
      coordinates. That fact remains inspectable only inside the basemap
      attribution popover. This is the third [MVP] requirement retired by this
      spec and the point at which charter §2's "uncertainty and provenance are
      first-class and always legible" no longer describes the map surface;
      whoever next edits the charter should read §2 as a whole rather than
      patching the one bullet.

- [ ] **Confirm the SPEC-019 amendment is wanted.** AMEND-001 for SPEC-019 below
      records that the snapshot date becomes visible at the reveal rather than
      throughout the round. Both of UX-004's acceptance criteria remain literally
      satisfied either way, so this is a record-keeping judgement: transplant the
      block, or drop it and rely on the criteria as written.

      **Answer:** _______________

- [ ] **Approve this spec** (status → Approved, move to `docs/specs/approved/`).

      **Answer:** _______________

## Conflict check

This spec conflicts with five approved or implemented specs. Every conflict is
resolved by an amendment below, except the functional-specification conflict,
which is escalated to the owner as required by `DOCUMENTATION_AUTHORITY.md`
rule 8.

| Document | What conflicts | Resolution |
| -------- | -------------- | ---------- |
| `SPEC-003` REQ-002 acceptance | Requires a persistent "Paleogeographic reconstruction" label | AMEND-005 (gated on the UX-003 disposition) |
| `SPEC-003` REQ-005 acceptance | Requires a disclaimer conveying the app is not a complete atlas | AMEND-005 |
| `SPEC-010` REQ-002 + AMEND-001 | AMEND-001 made the DOM legend the carrier | AMEND-002 — reverts to the original per-cluster accessible name |
| `SPEC-011` REQ-006 | Mandates the period-hint caption | AMEND-002 — retires REQ-006 |
| `SPEC-018` UX-002 acceptance | "The standing label remains present and unchanged" | AMEND-002 (gated on the UX-003 disposition) |
| `SPEC-019` UX-004 | Snapshot date visible throughout the round | AMEND-001 — narrows to the reveal (owner-confirmable) |
| `FONC-300`, `CONS-120` [MVP] | Positive requirements to state the map is a reconstruction; no carrier remains | **Unresolved — owner decision required** (see above) |
| `FONC-400` | Prohibition on presenting the app as a complete atlas | **No conflict** — satisfied by omission; no amendment |
| `docs/mockups/design-guidelines.md` §2 | Charter states the standing map label is the mechanism | Follows the UX-003 disposition; listed in the documentation follow-up |
| `SPEC-020` NFR-001 | No network egress on the Daily Genus screens | **No conflict** — its test is edited for the heading string only |
| `SPEC-015` | Owns the map overlay REQ-001/002 modify | **No conflict** — additive; no marker, label or clustering behaviour changes |

`docs/requirements/acceptance-criteria.md` (AC-230) and
`docs/requirements/requirements-index.md` are derived documents; neither
introduces truth and neither needs an edit, since FONC-400 is unchanged.

## Required amendments to existing specs

Six ready-to-transplant blocks, one per target document. **Do not edit the
target specs from this spec** — the orchestrator transplants each block into its
target's `## Spec amendments` section, under the number given.

The first block below is not a spec amendment but a **tier-1 product change**,
authorised by the owner's disposition A of 2026-08-14. It must be applied in the
same change as UX-003, never after it.

---

### For `docs/product/functional-specification.md` — retirement notes, SPEC-007 format (no AMEND number; the functional specification does not carry an amendment log)

Apply the SPEC-007 precedent exactly (see FONC-670 at line 219 and FONC-1110 at
line 285): strike the requirement text through and append an owner-approved
retirement note on the same line.

```markdown
- **FONC-300** [MVP] — ~~The system must clearly indicate that the ancient map displayed is a paleogeographic reconstruction.~~ **Retired by SPEC-021 (2026-08-14, owner-approved):** the standing map label was removed; the reconstruction detail remains available in the basemap attribution popover.

- **CONS-120** [MVP] — ~~The system must state that ancient maps are scientific reconstructions and not direct observations.~~ **Retired by SPEC-021 (2026-08-14, owner-approved):** see FONC-300.

- **FONC-1130** [MVP] — ~~The system must indicate when a geographic position is reconstructed.~~ **Retired by SPEC-021 (2026-08-14, owner-approved):** its sole carrier was the standing map label retired above — SPEC-007 (2026-07-21) had already retired the per-occurrence "reconstructed" chip in favour of that label. Occurrence paleocoordinates are still derived from the recorded `rotationModel`, which remains inspectable in the basemap attribution popover; the product no longer marks them as reconstructed at the point of reading.
```

Consequent edits in the same change, because they cite the retired mechanism by
name:

- `docs/mockups/design-guidelines.md:38-42` — charter §2 states that reconstructed
  paleo positions "carry a standing map-level 'Paleogeographic reconstruction'
  label" and cites FONC-1130/1140. That bullet must be **rewritten, not merely
  footnoted**, since the mechanism it describes no longer exists and half its
  requirement citation is retired. The `FONC-1140` half (time ranges that span
  multiple stages are labelled as such) is untouched by this spec and must
  survive the rewrite.
- `docs/requirements/requirements-index.md` and
  `docs/requirements/requirements-traceability.md` — mark all three requirements
  retired so the derived tables stop asserting live coverage. Note
  `requirements-traceability.md:144` currently lists FONC-1130 against
  "Occurrence panel, Taxon profile", which has been stale since SPEC-007; retire
  the row rather than repointing it.
- `docs/mockups/occurrence-panel.md:15,27` and `docs/mockups/taxon-profile.md:15,31`
  cite FONC-1130 in their related-requirements lists. Drop the citation.
- `docs/design/data-model.md:564` and `docs/product/out-of-scope.md:136` also cite
  FONC-1130. Check each and update.

**Scope note.** Three [MVP] requirements are retired by this spec — FONC-300,
CONS-120 and FONC-1130 — each on a separate owner decision recorded under *Human
decisions required* (disposition A, 2026-08-14, and disposition A2, 2026-08-14).
No other requirement was found to depend on the banner. `CONS-110` and
`FONC-1140` (approximate/multi-stage time) have their own carriers and are
unaffected.

---

### For `docs/specs/implemented/SPEC-003-exploration-view.md` — next free number is **AMEND-005** (AMEND-001…004 are used)

```markdown
### AMEND-005: Two acceptance criteria retired — the scope disclaimer, and the standing reconstruction label (via SPEC-021)

- **Date:** 2026-08-14
- **Reason:** SPEC-021 removes five pieces of explanatory interface copy on the
  owner's instruction to delete rather than relocate them. Two of those lines are
  the only carriers of acceptance criteria in this spec: the brand subtext
  ("…not a complete atlas of Mesozoic life") and the map's standing
  "▲ Paleogeographic reconstruction" banner.
- **Changed requirements:**
  - **REQ-005** — the acceptance criterion "a disclaimer/label conveys the app is
    not a complete atlas of all Mesozoic life" is **struck**. REQ-005's statement
    is unchanged and still binds: the app must not *present* itself as a complete
    atlas. FONC-400 is a prohibition, not a mandate to print a disclaimer, and it
    remains satisfied by the permanent `Group: Dinosaurs` context stat and the
    product title. Nothing in the functional specification changes.
  - **REQ-002** — the acceptance criterion "a persistent 'Paleogeographic
    reconstruction' label is present" is **changed**, subject to the owner's
    FONC-300 / CONS-120 disposition recorded in SPEC-021. Under disposition A it
    is struck; under disposition B it is reworded to require an always-visible
    statement on the basemap attribution control instead of a separate banner;
    under disposition C this half of the amendment does not apply. The rest of
    REQ-002 — reconstructed paleocoordinates, single-vs-group distinguishable by
    shape not colour, zoom and pan — is unchanged.
- **Behavioral impact:** The header loses its subtitle; the map loses its
  floating reconstruction banner (or gains a labelled attribution control under
  disposition B). No change to what is mapped, how occurrences are placed, how
  they cluster, what the group filter defaults to, or what reset does.
- **Test impact:** `test/ui/exploration-context.test.tsx` inverts its
  "complete atlas" assertion and retargets the FONC-400 comment at the Group
  stat. `test/ui/spec018-no-depth-claim.test.ts` and
  `test/e2e/exploration.e2e.ts` follow the UX-003 disposition. No test is deleted
  or skipped.
- **Human approval reference:** Owner approval in session, 2026-08-14.
```

---

### For `docs/specs/approved/SPEC-010-occurrence-locality-taxon-modes.md` — next free number is **AMEND-002** (AMEND-001 is used)

```markdown
### AMEND-002: REQ-002 reverts to a per-cluster accessible name — AMEND-001's premise no longer holds

- **Date:** 2026-08-14
- **Reason:** AMEND-001 replaced REQ-002's per-cluster accessible name with a DOM
  legend paragraph, on the grounds that "the map is a WebGL canvas with no
  per-feature DOM … so a per-cluster accessible name is not achievable in this
  architecture". That premise was true in 2026-07 and is not true now: SPEC-015
  introduced an HTML overlay (`styles.mapOverlay`) that renders one real `<span>`
  per rendered cluster carrying its count, currently `aria-hidden="true"`. Under
  SPEC-021 the owner is deleting the legend paragraph, and the correct
  replacement is the mechanism REQ-002 originally asked for.
- **Changed requirements:** **REQ-002** acceptance — the "records, not diversity"
  meaning is once again conveyed by **each cluster's own accessible name**
  ("42 occurrence records" in Occurrence mode, "12 localities" in Locality mode),
  not by a DOM legend. AMEND-001's legend mechanism is **withdrawn**. REQ-002's
  statement, the SPEC-009 regression clause, and the "no colour-only signal"
  clause are unchanged. As a consequence the cluster-count overlay must also
  render in **Locality** mode, where SPEC-015 currently suppresses it; Taxon mode
  is still excluded, since it does not collapse points into clusters.
- **Behavioral impact:** The legend paragraph disappears from the map pane in
  Occurrence and Locality mode. Cluster count badges gain a spoken name they did
  not have before, and appear in Locality mode. The visible badge glyph is still
  the bare integer. Clustering itself, marker rendering, the clade key and the
  name labels are unchanged, and the clade key stays hidden in Locality mode.
- **Test impact:** `test/ui/grouping-mode.test.tsx` replaces its legend assertion
  with the per-cluster accessible-name assertion in both modes, and asserts the
  paragraph is gone. `test/e2e/a11y.e2e.ts` needs no edit but must be re-run,
  since previously `aria-hidden` elements become named. No test is deleted or
  skipped.
- **Human approval reference:** Owner approval in session, 2026-08-14.
```

---

### For `docs/specs/approved/SPEC-011-exploration-polish-fixes.md` — next free number is **AMEND-002** (AMEND-001 is used)

```markdown
### AMEND-002: REQ-006 retired — the period-hint caption is removed

- **Date:** 2026-08-14
- **Reason:** REQ-006 was added by AMEND-001 on the owner's 2026-07-24 decision
  (a): keep the most-populated quick-select target and disclose it with a static
  caption. On 2026-08-14 the owner reversed the disclosure half of that decision,
  choosing to delete the caption outright rather than relocate or reword it
  (SPEC-021 UX-002).
- **Changed requirements:** **REQ-006** ("Disclose the period quick-select
  target") is **retired in full**. The behaviour it accompanied is untouched:
  SPEC-008 REQ-003's most-populated target still governs which stage a period
  quick-select selects. REQ-001…005 are unaffected.
- **Behavioral impact:** The timeline no longer renders the line "Periods jump to
  their most fossil-rich stage." Picking a period still lands on that period's
  `representative` stage — identical behaviour, now undisclosed. The caption
  described a control's behaviour, not scientific uncertainty or provenance, so
  CONS-490 does not apply and no other requirement is affected.
- **Test impact:** `test/ui/timeline-periods.test.tsx` inverts its caption
  assertion to assert absence; the file's existing assertion that a period selects
  its `representative` stage remains and becomes the regression guard. No test is
  deleted or skipped.
- **Human approval reference:** Owner approval in session, 2026-08-14.
```

---

### For `docs/specs/implemented/SPEC-018-map-cartographic-styling.md` — next free number is **AMEND-002** (AMEND-001 is used)

```markdown
### AMEND-002: UX-002's second acceptance criterion follows the reconstruction-label disposition (via SPEC-021)

- **Date:** 2026-08-14
- **Reason:** UX-002's second acceptance criterion pins the standing
  "Paleogeographic reconstruction" label as "present and unchanged". SPEC-021
  removes that banner on the owner's instruction. The criterion was written to
  stop this spec's richer basemap from eroding an existing provenance cue — it
  was never intended to freeze the cue against a later, deliberate owner
  decision.
- **Changed requirements:** **UX-002** — the acceptance criterion "The standing
  'Paleogeographic reconstruction' label remains present and unchanged" is
  **replaced**, per the owner's FONC-300 / CONS-120 disposition recorded in
  SPEC-021: under disposition A it is struck; under disposition B it becomes
  "the map carries an always-visible statement that it is a paleogeographic
  reconstruction, on the basemap attribution control"; under disposition C it is
  unchanged and this amendment does not apply. **UX-002's statement is entirely
  unchanged and still binds in full** — the depth gradation must never be
  labelled, captioned, or legended as measured bathymetry, sea depth or
  reconstructed sea level, and its first acceptance criterion (no depth scale, no
  metre or fathom value, no depth legend anywhere in the UI) is untouched.
- **Behavioral impact:** The floating banner over the map's top-left disappears
  (or is replaced by a labelled attribution control). Nothing about the basemap
  itself changes: ocean bands, graticule, equator emphasis, land edge, relief and
  the interior stipple from AMEND-001 are all unaffected.
- **Test impact:** In `test/ui/spec018-no-depth-claim.test.ts` the test "the
  standing reconstruction label is untouched" is rewritten to assert the new
  state rather than removed; the depth-claim tests in the same file are
  untouched. `test/e2e/exploration.e2e.ts` follows the same disposition. No test
  is deleted or skipped.
- **Human approval reference:** Owner approval in session, 2026-08-14.
```

---

### For `docs/specs/implemented/SPEC-019-daily-genus-puzzle.md` — use **AMEND-001**, filling the existing empty stub in place (do not append a second AMEND-001)

> Transplant only if the owner confirms it is wanted — see *Human decisions
> required*. Both of UX-004's acceptance criteria remain literally satisfied
> without it.

```markdown
### AMEND-001

- **Date:** 2026-08-14
- **Reason:** SPEC-021 deletes the screen footer that carried "Per PBDB snapshot
  {date} — a placement is a sourced opinion, not a settled fact", on the owner's
  instruction to delete rather than relocate. The snapshot date it carried is
  moved into the answer reveal so the provenance is stated at the moment the game
  asserts a placement.
- **Changed requirements:** **UX-004** — the snapshot date is now shown **in the
  answer reveal**, alongside `accepted per …`, rather than standing in the screen
  footer for the whole round. Both acceptance criteria are still met literally:
  the reveal opens by itself when the round finishes, so the date is behind
  neither a hover nor a second click, and the reveal still shows `acceptedPer`.
  The third criterion ("no copy asserts a placement without its source") is
  unaffected. This amendment records the narrowing of *when* the date is on
  screen; UX-004's statement is otherwise unchanged. The traceability row for
  UX-004 already reads "snapshot date + `acceptedPer` in the reveal" and becomes
  accurate for the first time.
- **Behavioral impact:** During a round the snapshot date is no longer displayed;
  it appears with the reveal. The "a placement is a sourced opinion, not a settled
  fact" sentence is retired as copy — the reveal's `accepted per …` line remains
  the mechanism that names whose classification is being played on. The screen
  footer no longer renders at all unless the storage-blocked note is present. The
  tree heading is separately renamed from "Established classification" to
  "Taxonomic tree" (SPEC-021 UX-006); no requirement in this spec mandated that
  string, so it needs no amendment.
- **Test impact:** In `test/ui/spec019-daily-screen.test.tsx` the UX-004 test is
  rewritten to play a round to completion and assert the date on the reveal; the
  domain-language test's `"established classification"` expectation becomes
  `"taxonomic tree"`. `test/e2e/spec019-daily.e2e.ts` moves its snapshot-date
  assertion to the reveal and updates the heading probe. No test is deleted or
  skipped.
- **Human approval reference:** Owner approval in session, 2026-08-14.
```

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Map cluster overlay | `src/app/components/OccurrenceMap.tsx` (count-badge overlay, ~L976-988) | `test/ui/grouping-mode.test.tsx` | Not started |
| REQ-002 | Map cluster overlay | `src/app/components/OccurrenceMap.tsx` (`showCladeUi` gating, L951/L971) | `test/ui/grouping-mode.test.tsx` | Not started |
| REQ-003 | Puzzle reveal | `src/app/components/DailyGenusScreen.tsx` (reveal, ~L683-702) | `test/ui/spec019-daily-screen.test.tsx`, `test/e2e/spec019-daily.e2e.ts` | Not started |
| UX-001 | Context bar brand | `src/app/components/ContextBar.tsx` L46-49 + header comment L5 | `test/ui/exploration-context.test.tsx` | Not started |
| UX-002 | Timeline period row | `src/app/components/TimelineControl.tsx` L278-284 | `test/ui/timeline-periods.test.tsx` | Not started |
| UX-003 | Map pane | `src/app/components/ExplorationView.tsx` L458-460 | `test/ui/spec018-no-depth-claim.test.ts`, `test/e2e/exploration.e2e.ts` | **Blocked on owner decision** |
| UX-004 | Map pane | `src/app/components/ExplorationView.tsx` L477-483 | `test/ui/grouping-mode.test.tsx` | Not started |
| UX-005 | Puzzle footer | `src/app/components/DailyGenusScreen.tsx` L877-888 | `test/ui/spec019-daily-screen.test.tsx`, `test/e2e/spec019-daily.e2e.ts` | Not started |
| UX-006 | Puzzle tree heading | `src/app/components/DailyGenusScreen.tsx` L517-519 | `test/ui/spec019-daily-screen.test.tsx`, `test/ui/spec020-no-egress.test.tsx`, `test/e2e/spec019-daily.e2e.ts` | Not started |
| NFR-001 | Test suite | `test/**` (ten call sites across seven files) | `pnpm test`; diff review | Not started |
| NFR-002 | Stylesheets | `src/app/components/exploration.module.css` (L32, L190-195, L456, L1296-1315), `src/app/components/dailyGenus.module.css` (L508-513) | `test/ui/spec018-no-depth-claim.test.ts` | Not started |

## Implementation notes

To be filled during implementation. Points already known:

- The `.provenance` selector shares a rule with `.entryNote, .note, .record` in
  `dailyGenus.module.css:508-513`. Remove the one selector, keep the rule.
- `mapLegend2` (`OccurrenceMap.tsx:1036`, the clade key) is a different class
  from `mapLegend` and must survive. Do not pattern-match on the prefix.
- `ExplorationView.tsx`'s deleted `<p>` is wrapped in a
  `state.mode !== "taxon"` guard; the guard is dead once the paragraph is gone.
- The reconstruction banner is positioned `absolute` inside `.mapPane` and sits
  outside the loading/error branch, so it renders over all three map states.
  Whatever replaces it under disposition B must too.
- The count badges are positioned in the map's pixel space and recomputed on
  every render tick (`OccurrenceMap.tsx:351-379`). Attaching an accessible name
  must not add per-frame string work in that loop — build the name where the
  badge is rendered, not in the query loop.
- SPEC-020's well-known track renders the same `DailyGenusScreen`, so UX-005,
  UX-006 and REQ-003 apply to both tracks and both must be verified.

## Spec amendments

> Required for any behavioral change after this spec is Approved. None yet —
> this spec is Draft. The blocks in *Required amendments to existing specs* above
> are amendments to **other** specs and do not belong here.

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [x] Open questions are resolved or explicitly deferred.
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed.
- [ ] **Human decision recorded on FONC-300 / CONS-120 (UX-003).** This is a
      genuine conflict with the tier-1 authoritative functional specification and
      cannot be resolved by an agent (`DOCUMENTATION_AUTHORITY.md` rule 8). The
      other five changes are ready and do not depend on it.
- [ ] Human approval recorded before status set to Approved.
