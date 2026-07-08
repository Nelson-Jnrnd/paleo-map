# Open Questions

Ambiguities discovered while organizing the
[functional specification](functional-specification.md) into documentation. Each
entry affects scope, requirements, or design.

All entries below have been **resolved** by the product owner. Resolutions are
recorded here for traceability and reflected in the relevant docs (conventions,
glossary, scope, acceptance criteria, and diagram pages). Where a resolution
narrows scope or fixes a design model, it is noted as such; those may warrant a
future spec amendment when implementation begins.

Questions are numbered in increments of 10. Resolutions are **not** themselves
requirements — they are decisions that guide how requirements are documented and
built.

---

## OQ-010 — 3D globe view is listed out of MVP but has no requirement

**Status:** Resolved (2026-07-08).

**Context:**
Specification §5 lists "A 3D globe view" among items explicitly out of MVP scope,
which implies it might be considered later. However, no `FONC-*` requirement (at
any priority) defines a 3D globe view. The map requirements (FONC-210…FONC-330)
describe a 2D world map.

**Question:**
Is a 3D globe an intended future feature, or is it named only to clarify that the
map is 2D — with no future intent?

**Resolution:**
Treat the 3D globe as an **explicit non-goal**, not a deferred feature. §5 names
it only to set expectations; the map is a flat world map (FONC-210…FONC-330). No
requirement is reserved for it. The domain model stays projection-agnostic so a
globe could be added later, but only via a new (V2) requirement — never as an
implied one. Reflected in [`out-of-scope.md`](out-of-scope.md) §2.

---

## OQ-020 — "must" verb combined with [V1] / [V2] priority

**Status:** Resolved (2026-07-08).

**Context:**
§0.2 defines **must** as mandatory and **should** as optional. §0.1 defines
**[V1]/[V2]** as not required for the MVP. Several requirements combine a
mandatory verb with a non-MVP priority — for example FONC-1200, FONC-1210,
FONC-1220, and FONC-1230 are **[V1]** but use "must". FONC-1190 (also about
images) is **[V1]** and uses "should".

**Question:**
When a requirement is "[V1] must", is "must" mandatory only once V1 is
undertaken, or is this an inconsistency?

**Resolution:**
Priority and verb are **two independent axes**: priority answers *which release*
(MVP/V1/V2); the verb answers *how binding within that release*. So "[V1] must"
means "not required for the MVP, but mandatory once V1 is built." The image
cluster is coherent under this reading: FONC-1190 (*show* an image) is "should" =
optional, while FONC-1200–1230 (*if* an image is shown, label its type, credit,
and artistic nature) are "must" = conditionally mandatory. A clarifying note has
been added to §0.2 of the [functional specification](functional-specification.md);
no requirement wording or ID changed.

---

## OQ-030 — Granularity of the time control

**Status:** Resolved (2026-07-08).

**Context:**
FONC-120 requires changing the selected age through a time control, FONC-110
requires displaying the age in Ma, FONC-170 requires distinguishing a precise age
from a time range, and FONC-100 divides the interval into three periods. The
specification does not state whether age selection is continuous or stepped.

**Question:**
Is the selected age a continuous value across 252–66 Ma, or constrained to
discrete steps?

**Resolution:**
The time control **steps by geological stage** (standard ICS Mesozoic stages) and
**displays the selected age in Ma**. Continuous per-Ma selection would imply false
precision the data cannot support; period-level (3 steps) is too coarse.
Stage-level steps make "precise age vs. time range" (FONC-170) natural and keep the
overlap test (FONC-150/FONC-160) simple; FONC-190's quick period selection sits on
top as shortcuts. This is a **design decision** (not a requirement change) and is
reflected in [`../mockups/exploration-view.md`](../mockups/exploration-view.md) and
the age-change activity/sequence diagram pages.

---

## OQ-040 — Definition of an "action" for navigation limits

**Status:** Resolved (2026-07-08).

**Context:**
FONC-1070 / CONS-460 require reaching a taxon profile in a maximum of **2
actions** from a visible occurrence, and FONC-1080 / CONS-470 require returning to
the map in a maximum of **1 action**. "Action" is not defined.

**Question:**
What counts as one action?

**Resolution:**
An **action = one primary user interaction that causes a navigation or state
transition** — a click/tap or its keyboard equivalent. Hover, scroll, zoom, and
pan do **not** count. Under this definition: occurrence → info panel (1) → open
profile (2) satisfies "≤2 actions"; a single "back to map" satisfies "≤1 action."
The definition has been added to the [glossary](glossary.md) and the dependent
acceptance criteria (AC-090, AC-110) and diagram pages updated.

---

## OQ-050 — Whether secondary content exists in the MVP data set

**Status:** Resolved (2026-07-08).

**Context:**
FONC-360 (distinguish dinosaurs from other reptiles), FONC-410 (indicate main vs
secondary content), and CONS-040 (treat other reptiles as secondary scope) are
**[MVP]**. But the inclusion of secondary groups themselves — FONC-380, FONC-390 —
is **[V1]**.

**Question:**
Does the MVP data set contain any secondary (non-dinosaur) reptile content?

**Resolution:**
**The MVP ships non-avian dinosaurs only.** The main/secondary labeling machinery
(FONC-360/FONC-410) is present but satisfied **vacuously** in the MVP: every taxon
is tagged "main content," with the mechanism ready for secondary items in V1
(FONC-380/FONC-390). Acceptance criterion AC-230 therefore tests the labeling
*mechanism*, not the presence of secondary taxa. This **narrows MVP data scope**
and is reflected in [`mvp-scope.md`](mvp-scope.md) and
[`../requirements/acceptance-criteria.md`](../requirements/acceptance-criteria.md).

---

## OQ-060 — Source dataset(s) that supply occurrences and time ranges

**Status:** Resolved (2026-07-08).

**Context:**
Many MVP requirements demand an identifiable source for every visible occurrence
and time range (FONC-1100, PERF-140, PERF-150, CONS-390, CONS-400) and distinguish
primary source vs database vs editorial synthesis (CONS-420). The specification
does not name any dataset.

**Question:**
Which dataset(s) supply the fossil occurrences, time ranges, and paleogeographic
reconstructions?

**Resolution:**
**Default to the Paleobiology Database (PBDB)** for occurrences and time ranges,
and a **plate-rotation model** (e.g. GPlates / Scotese-style reconstructions) for
paleogeographic positions. However, this is recorded as a **technical-design
decision for a future design spec, not a product requirement**: the product
documentation stays source-neutral because the specification only requires "an
identifiable source." PBDB is the pragmatic default because it directly provides
sourced occurrences with coordinates and time ranges, satisfying the MVP
data-quality rules (PERF-140/150, CONS-390/400). Reflected as an abstract "Data"
participant note in [`../uml/sequence-diagrams.md`](../uml/sequence-diagrams.md).
