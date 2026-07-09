# Requirements Traceability

> Derived document. It maps requirements from the
> [functional specification](../product/functional-specification.md) to the
> documentation artifacts that will describe or verify them. It introduces no new
> requirements.

**Purpose.** Give every requirement a forward path to a screen, a UML diagram,
and an acceptance criterion. Acceptance criteria IDs point to
[`acceptance-criteria.md`](acceptance-criteria.md); `TBD` marks criteria not yet
written (V1/V2).

**Diagram names** below refer to the now-live diagrams: behavioural diagrams (use
case / activity / state / sequence) are in [`../uml/`](../uml/); "Domain model"
and other class models are the typed class models in the
[data architecture design](../design/data-model.md). All are also rendered
in-place in the [specification PDF](../Interactive-Mesozoic-Dinosaur-Atlas-Specification.pdf).

**Status legend:** `Draft` — mapped, not yet verified. Update to
`Specified` / `Designed` / `Verified` as artifacts are produced.

**Screen names** refer to pages under [`../mockups/`](../mockups/):
Exploration view, Taxon profile, Occurrence panel, Filters panel, Empty/error
states. Constraints and performance requirements are often cross-cutting and are
grouped by subsection; their "Related screen" is "All / cross-cutting" where they
apply everywhere.

## Features (`FONC-*`)

| Requirement ID | Related screen | Related UML diagram | Acceptance criteria | Status |
| --- | --- | --- | --- | --- |
| FONC-010 | Exploration view | Use case diagram, exploration-flow activity | AC-010 | Draft |
| FONC-020 | Exploration view, Filters panel | Exploration-flow activity | AC-020 | Draft |
| FONC-030 | Exploration view | Use case diagram, exploration-flow activity | AC-010 | Draft |
| FONC-040 | Exploration view | Exploration-flow activity | AC-010 | Draft |
| FONC-050 | Exploration view | Exploration-flow activity | AC-010 | Draft |
| FONC-060 | Exploration view, Filters panel | Filter-application activity | AC-010, AC-120 | Draft |
| FONC-070 | Exploration view | Exploration-flow activity | TBD | Draft |
| FONC-080 | Exploration view, Filters panel | Filter-application activity | AC-130 | Draft |
| FONC-090 | Exploration view | Age-change activity | AC-040 | Draft |
| FONC-100 | Exploration view | Age-change activity | AC-040 | Draft |
| FONC-110 | Exploration view | Age-change activity | AC-040 | Draft |
| FONC-120 | Exploration view | Age-change activity, map-loading state | AC-030 | Draft |
| FONC-130 | Exploration view | Age-change activity, map-loading state | AC-030 | Draft |
| FONC-140 | Exploration view | Age-change activity | AC-030 | Draft |
| FONC-150 | Exploration view | Age-change activity, domain model | AC-030 | Draft |
| FONC-160 | Exploration view, Taxon profile | Age-change activity, domain model | AC-030 | Draft |
| FONC-170 | Exploration view | Age-change activity | AC-040 | Draft |
| FONC-180 | Exploration view | Age-change activity | TBD | Draft |
| FONC-190 | Exploration view | Age-change activity | TBD | Draft |
| FONC-200 | (V2 comparison view) | — | TBD | Draft |
| FONC-210 | Exploration view | Map-loading state, domain model | AC-050 | Draft |
| FONC-220 | Exploration view | Domain model | AC-050 | Draft |
| FONC-230 | Exploration view | Domain model | AC-060 | Draft |
| FONC-240 | Exploration view | Domain model | AC-060 | Draft |
| FONC-250 | Exploration view | — | AC-070 | Draft |
| FONC-260 | Exploration view | — | AC-070 | Draft |
| FONC-270 | Exploration view, Occurrence panel | Occurrence-selection activity | AC-080 | Draft |
| FONC-280 | Occurrence panel | Occurrence-selection activity | AC-080 | Draft |
| FONC-290 | Occurrence panel | Occurrence-selection activity, domain model | AC-080 | Draft |
| FONC-300 | Exploration view | — | AC-050 | Draft |
| FONC-310 | Exploration view | — | TBD | Draft |
| FONC-320 | Exploration view, Filters panel | — | TBD | Draft |
| FONC-330 | Exploration view | — | TBD | Draft |
| FONC-340 | Exploration view, Filters panel | Domain model | AC-020, AC-230 | Draft |
| FONC-350 | Filters panel | Filter-application activity | AC-020 | Draft |
| FONC-360 | Exploration view, Taxon profile | Domain model | AC-230 | Draft |
| FONC-370 | Filters panel | Domain model | AC-230 | Draft |
| FONC-380 | Filters panel | Domain model | TBD | Draft |
| FONC-390 | Filters panel | — | TBD | Draft |
| FONC-400 | Exploration view | — | AC-230 | Draft |
| FONC-410 | Taxon profile, Occurrence panel | Domain model | AC-230 | Draft |
| FONC-420 | Filters panel | — | TBD | Draft |
| FONC-430 | Taxon profile | Domain model | AC-170 | Draft |
| FONC-440 | Taxon profile | Domain model | AC-170 | Draft |
| FONC-450 | Taxon profile | Domain model | AC-170 | Draft |
| FONC-460 | Taxon profile | Domain model | TBD | Draft |
| FONC-470 | Taxon profile | Domain model | TBD | Draft |
| FONC-480 | Taxon profile | Taxon-profile-loading state | AC-170, AC-240 | Draft |
| FONC-490 | Taxon profile | — | AC-170 | Draft |
| FONC-500 | Filters panel | — | TBD | Draft |
| FONC-510 | Taxon profile | Taxon-profile-flow activity | AC-100 | Draft |
| FONC-520 | Taxon profile | — | AC-100 | Draft |
| FONC-530 | Taxon profile | Domain model | AC-100 | Draft |
| FONC-540 | Taxon profile | Domain model | AC-100 | Draft |
| FONC-550 | Taxon profile | Domain model | AC-100 | Draft |
| FONC-560 | Taxon profile | Domain model | AC-100 | Draft |
| FONC-570 | Taxon profile | Domain model | AC-100 | Draft |
| FONC-580 | Taxon profile | Domain model | AC-100 | Draft |
| FONC-590 | Taxon profile | Domain model | AC-100, AC-180 | Draft |
| FONC-600 | Taxon profile | — | TBD | Draft |
| FONC-610 | Taxon profile | — | TBD | Draft |
| FONC-620 | Taxon profile | — | TBD | Draft |
| FONC-630 | Taxon profile | — | TBD | Draft |
| FONC-640 | Taxon profile | — | TBD | Draft |
| FONC-650 | Taxon profile | — | TBD | Draft |
| FONC-660 | Taxon profile | Domain model | TBD | Draft |
| FONC-670 | Taxon profile | — | AC-180 | Draft |
| FONC-680 | Exploration view, Filters panel | Domain model | AC-220 | Draft |
| FONC-690 | Taxon profile | Domain model | AC-220 | Draft |
| FONC-700 | Exploration view, Filters panel | Filter-application activity | AC-220 | Draft |
| FONC-710 | Taxon profile | Domain model | AC-220 | Draft |
| FONC-720 | Taxon profile | Domain model | AC-220 | Draft |
| FONC-730 | Taxon profile | — | TBD | Draft |
| FONC-740 | Taxon profile | — | TBD | Draft |
| FONC-750 | Filters panel | — | TBD | Draft |
| FONC-760 | Exploration view | Search state | AC-150 | Draft |
| FONC-770 | Exploration view | Search state | TBD | Draft |
| FONC-780 | Filters panel | Filter-application activity | AC-120 | Draft |
| FONC-790 | Filters panel | Filter-application activity | AC-120 | Draft |
| FONC-800 | Filters panel | Filter-application activity | AC-020, AC-120 | Draft |
| FONC-810 | Filters panel | — | TBD | Draft |
| FONC-820 | Filters panel | — | TBD | Draft |
| FONC-830 | Filters panel | — | TBD | Draft |
| FONC-840 | Filters panel | — | TBD | Draft |
| FONC-850 | Exploration view, Filters panel | Filter-application activity | AC-120 | Draft |
| FONC-860 | Empty/error states, Filters panel | Empty-state activity, filter state | AC-140 | Draft |
| FONC-870 | Filters panel | Filter-application activity, filter state | AC-130 | Draft |
| FONC-880 | Filters panel | Filter-application activity, filter state | AC-130 | Draft |
| FONC-890 | Occurrence panel | Occurrence-selection activity | AC-080 | Draft |
| FONC-900 | Occurrence panel | Domain model | AC-080 | Draft |
| FONC-910 | Occurrence panel | Domain model | AC-080 | Draft |
| FONC-920 | Occurrence panel | Domain model | AC-080 | Draft |
| FONC-930 | Occurrence panel | Domain model | AC-080, AC-180 | Draft |
| FONC-940 | Occurrence panel | Domain model | TBD | Draft |
| FONC-950 | (Formation profile — future) | Domain model | TBD | Draft |
| FONC-960 | (Formation profile — future) | Domain model | TBD | Draft |
| FONC-970 | (Formation profile — future) | Domain model | TBD | Draft |
| FONC-980 | Occurrence panel | Domain model | TBD | Draft |
| FONC-990 | Occurrence panel, Taxon profile | Taxon-profile-flow activity | AC-090 | Draft |
| FONC-1000 | Taxon profile | Taxon-profile-flow activity | AC-110 | Draft |
| FONC-1010 | Taxon profile | Taxon-profile-flow activity | AC-110 | Draft |
| FONC-1020 | Taxon profile | Taxon-profile-flow activity | AC-110 | Draft |
| FONC-1030 | Occurrence panel | — | TBD | Draft |
| FONC-1040 | (Formation profile — future) | — | TBD | Draft |
| FONC-1050 | Taxon profile | — | TBD | Draft |
| FONC-1060 | Taxon profile | Search state | TBD | Draft |
| FONC-1070 | Occurrence panel, Taxon profile | Taxon-profile-flow activity | AC-090 | Draft |
| FONC-1080 | Taxon profile | Taxon-profile-flow activity | AC-110 | Draft |
| FONC-1090 | Taxon profile, Occurrence panel | — | AC-180 | Draft |
| FONC-1100 | Occurrence panel | — | AC-180 | Draft |
| FONC-1110 | Taxon profile | — | AC-180 | Draft |
| FONC-1120 | Taxon profile | — | AC-170, AC-180 | Draft |
| FONC-1130 | Occurrence panel, Taxon profile | — | AC-180 | Draft |
| FONC-1140 | Occurrence panel, Taxon profile | — | AC-180 | Draft |
| FONC-1150 | Occurrence panel | — | AC-180 | Draft |
| FONC-1160 | Taxon profile | — | TBD | Draft |
| FONC-1170 | Taxon profile, Occurrence panel | — | TBD | Draft |
| FONC-1180 | Taxon profile, Occurrence panel | — | TBD | Draft |
| FONC-1190 | Taxon profile | — | TBD | Draft |
| FONC-1200 | Taxon profile | — | TBD | Draft |
| FONC-1210 | Taxon profile | — | TBD | Draft |
| FONC-1220 | Taxon profile | — | TBD | Draft |
| FONC-1230 | Taxon profile | — | TBD | Draft |
| FONC-1240 | Taxon profile, Empty/error states | Taxon-profile-loading state | AC-190 | Draft |
| FONC-1250 | Taxon profile | — | TBD | Draft |
| FONC-1260 | Exploration view, Empty/error states | Map-loading state | AC-200 | Draft |
| FONC-1270 | Taxon profile, Empty/error states | Taxon-profile-loading state | AC-200 | Draft |
| FONC-1280 | Empty/error states | Empty-state activity, filter state | AC-140 | Draft |
| FONC-1290 | Empty/error states | Search state | AC-160 | Draft |
| FONC-1300 | Taxon profile, Empty/error states | Taxon-profile-loading state | AC-240 | Draft |
| FONC-1310 | Empty/error states | Map-loading state | AC-210 | Draft |
| FONC-1320 | Empty/error states | Taxon-profile-loading state | AC-210 | Draft |
| FONC-1330 | Empty/error states | Map-loading state, taxon-profile-loading state | AC-210 | Draft |
| FONC-1340 | Empty/error states, Filters panel | Filter state | AC-210 | Draft |
| FONC-1350 | (V2 comparison view) | — | TBD | Draft |
| FONC-1360 | (V2 comparison view) | — | TBD | Draft |
| FONC-1370 | Taxon profile | — | TBD | Draft |
| FONC-1380 | Taxon profile | — | TBD | Draft |
| FONC-1390 | (V2 region view) | — | TBD | Draft |
| FONC-1400 | (V2 guided paths) | — | TBD | Draft |
| FONC-1410 | (V2 guided paths) | — | TBD | Draft |
| FONC-1420 | (V2 guided paths) | — | TBD | Draft |
| FONC-1430 | (V2 guided paths) | — | TBD | Draft |

## Constraints (`CONS-*`) — grouped by subsection

Constraints are cross-cutting. They are grouped here; each row lists the ID range
and the primary artifacts that must honor it.

| Requirement IDs | Related screen | Related UML diagram | Acceptance criteria | Status |
| --- | --- | --- | --- | --- |
| CONS-010…CONS-100 (Scientific scope) | Exploration view, Taxon profile | Domain model | AC-180, AC-230 | Draft |
| CONS-110…CONS-180 (Geographic representation) | Exploration view, Occurrence panel | Domain model | AC-050, AC-180 | Draft |
| CONS-190…CONS-240 (Temporal representation) | Exploration view, Taxon profile, Occurrence panel | Age-change activity, domain model | AC-040, AC-180 | Draft |
| CONS-250…CONS-310 (Scientific consistency) | Taxon profile, Occurrence panel | Age-change activity, domain model | AC-180 | Draft |
| CONS-320…CONS-380 (Editorial content) | All / cross-cutting | — | AC-180 | Draft |
| CONS-390…CONS-440 (Sources & provenance) | Taxon profile, Occurrence panel | Domain model | AC-180 | Draft |
| CONS-450…CONS-510 (Interface & usability) | Exploration view, Taxon profile | Exploration-flow activity, taxon-profile-flow activity | AC-010, AC-090, AC-110 | Draft |

## Performance (`PERF-*`) — grouped by subsection

| Requirement IDs | Related screen | Related UML diagram | Acceptance criteria | Status |
| --- | --- | --- | --- | --- |
| PERF-010…PERF-070 (Response time) | Exploration view, Taxon profile | Map-loading state, taxon-profile-loading state | AC-010, AC-030, AC-200 | Draft |
| PERF-080…PERF-130 (Readability & density) | Exploration view | — | AC-060, AC-070 | Draft |
| PERF-140…PERF-210 (Visible data quality) | Exploration view, Taxon profile, Occurrence panel | Domain model | AC-170, AC-180 | Draft |
| PERF-220…PERF-270 (Accessibility) | Exploration view, Filters panel | — | AC-070, AC-120 | Draft |
| PERF-280…PERF-330 (Display robustness) | Empty/error states, Filters panel | Map-loading state, taxon-profile-loading state, filter state | AC-140, AC-160, AC-210 | Draft |
| PERF-340 (Validation scenario) | Exploration view → Occurrence panel → Taxon profile | Exploration-flow activity, taxon-profile-flow activity | AC-090, AC-110 | Draft |
| PERF-350 (Validation scenario) | Exploration view → Taxon profile | Taxon-profile-flow activity, search state | AC-150 | Draft |
| PERF-360 (Validation scenario) | Exploration view | Age-change activity | AC-030 | Draft |
| PERF-370 (Validation scenario) | Filters panel, Empty/error states | Filter-application activity, empty-state activity | AC-140, AC-130 | Draft |
