# Open Questions

Genuine ambiguities discovered while organizing the
[functional specification](functional-specification.md) into documentation. Each
entry is a real question that affects scope, requirements, or design and cannot
be resolved without a decision. Questions are numbered in increments of 10.

These are **not** requirements and must not be treated as such. Resolving one may
lead to a spec amendment; until then, work should record an assumption rather
than guess silently.

---

## OQ-010 — 3D globe view is listed out of MVP but has no requirement

**Context:**
Specification §5 lists "A 3D globe view" among items explicitly out of MVP scope,
which implies it might be considered later. However, no `FONC-*` requirement (at
any priority) defines a 3D globe view. The map requirements (FONC-210…FONC-330)
describe a 2D world map.

**Question:**
Is a 3D globe an intended future feature (which would warrant a V1/V2
requirement), or is it named only to clarify that the map is 2D — with no future
intent?

**Impact:**
Affects whether the UML/mockup structure should reserve space for a globe view,
and whether the map domain concepts should be projection-agnostic.

---

## OQ-020 — "must" verb combined with [V1] / [V2] priority

**Context:**
§0.2 defines **must** as mandatory and **should** as optional. §0.1 defines
**[V1]/[V2]** as not required for the MVP. Several requirements combine a
mandatory verb with a non-MVP priority — for example FONC-1200, FONC-1210,
FONC-1220, and FONC-1230 are **[V1]** but use "must". FONC-1190 (also about
images) is **[V1]** and uses "should".

**Question:**
When a requirement is "[V1] must", does "must" mean it is mandatory **only once
V1 is undertaken** (i.e. conditional on the feature being built), or is this an
inconsistency to reconcile?

**Impact:**
Affects how the requirements index and traceability matrix classify obligation,
and how acceptance criteria are gated by release.

---

## OQ-030 — Granularity of the time control

**Context:**
FONC-120 requires the selected age to be changed through a time control, and
FONC-110 requires displaying the selected age in Ma. FONC-170 requires
distinguishing a selected **precise** age from a known time range. FONC-100
divides the interval into three periods. The specification does not state whether
age selection is continuous (any Ma value) or stepped (e.g. by stage, by fixed
increment, or by period).

**Question:**
Is the selected age a continuous value across 252–66 Ma, or is it constrained to
discrete steps (stages, periods, or fixed increments)?

**Impact:**
Affects the time-control mockup, the age-change activity/state diagrams, and how
"overlap" between the selected age and a time range is evaluated
(FONC-150, FONC-160).

---

## OQ-040 — Definition of an "action" for navigation limits

**Context:**
FONC-1070 / CONS-460 require reaching a taxon profile in a maximum of **2
actions** from a visible occurrence, and FONC-1080 / CONS-470 require returning to
the map in a maximum of **1 action**. "Action" is not defined.

**Question:**
What counts as one action — a single click/tap, any discrete user interaction
(including keyboard), or a navigation step (screen transition)? Do hover or
scroll interactions count?

**Impact:**
Affects the acceptance criteria for navigation (measurable pass/fail) and the
occurrence-selection and profile-opening flows.

---

## OQ-050 — Whether secondary content exists in the MVP data set

**Context:**
FONC-360 (distinguish non-avian dinosaurs from other included Mesozoic reptiles),
FONC-410 (indicate main vs secondary content), and CONS-040 (treat other reptiles
as secondary scope) are **[MVP]**. But the inclusion of secondary groups
themselves — FONC-380, FONC-390 — is **[V1]**.

**Question:**
Does the MVP data set contain any secondary (non-dinosaur) reptile content at
all? If not, are the MVP "distinguish main vs secondary" requirements satisfied
vacuously (labeling machinery present but no secondary items shown)?

**Impact:**
Affects MVP acceptance criteria for content labeling, the filters panel
(dinosaurs-only vs secondary-group filters), and test data expectations.

---

## OQ-060 — Source dataset(s) that supply occurrences and time ranges

**Context:**
Many MVP requirements demand an identifiable source for every visible occurrence
and time range (FONC-1100, PERF-140, PERF-150, CONS-390, CONS-400), and
distinguish primary source vs database vs editorial synthesis (CONS-420). V1
targets specify data volume (PERF-200: ≥50 detailed profiles; PERF-210: ≥10
featured species). The specification does not name any dataset or provider.

**Question:**
Which dataset(s) or provider(s) supply the fossil occurrences, time ranges, and
paleogeographic reconstructions? Is this intentionally left to technical design,
or is a specific source expected by the product?

**Impact:**
Affects feasibility of the data-quality performance targets, the source-labeling
UI, and whether external-link requirements (FONC-1180) are achievable. This may
be an intentional technical-design decision rather than a product ambiguity.
