# Screens Index

> Derived document. Master list of expected screens and their status. It
> introduces no requirements. Requirement IDs are canonical; see the
> [functional specification](../product/functional-specification.md).

| Screen | Description | Related requirements | Mockup file | Status |
| --- | --- | --- | --- | --- |
| [Exploration view](exploration-view.md) | Main map, timeline and filters; permanent age/group/count | FONC-010, FONC-040, FONC-050, FONC-060, FONC-210, FONC-230, FONC-120, CONS-450 | `assets/mockups/exploration-view.png` (TBD) | Planned |
| [Taxon profile](taxon-profile.md) | Scientific name, classification, time range, occurrences, sources | FONC-510…FONC-590, FONC-670, FONC-480, FONC-490, FONC-1240 | `assets/mockups/taxon-profile.png` (TBD) | Planned |
| [Occurrence panel](occurrence-panel.md) | Info panel for a selected occurrence | FONC-280, FONC-290, FONC-890…FONC-930, FONC-1150 | `assets/mockups/occurrence-panel.png` (TBD) | Planned |
| [Filters panel](filters-panel.md) | Period, group, dinosaurs-only, reset, result count | FONC-780, FONC-790, FONC-800, FONC-850, FONC-870, FONC-880 | `assets/mockups/filters-panel.png` (TBD) | Planned |
| [Empty & error states](empty-error-states.md) | Empty/error/retry states shared across screens | FONC-860, FONC-1280…FONC-1340, PERF-320, PERF-330 | `assets/mockups/empty-state.png`, `assets/mockups/error-state.png` (TBD) | Planned |

## State variants to capture

| State | Screen(s) | Requirement | Mockup file (TBD) |
| --- | --- | --- | --- |
| Map loading | Exploration view | FONC-1260 | `exploration-view-loading.png` |
| Filters empty result | Exploration view / Filters | FONC-1280, FONC-860 | `exploration-view-empty.png` |
| Search empty result | Exploration view | FONC-1290 | `search-empty.png` |
| Map load error + retry | Exploration view | FONC-1310, FONC-1330 | `error-state.png` |
| Profile loading | Taxon profile | FONC-1270 | `taxon-profile-loading.png` |
| Profile minimal data | Taxon profile | FONC-1300, FONC-480 | `taxon-profile-minimal.png` |
| Profile no image | Taxon profile | FONC-1240 | `taxon-profile-no-image.png` |
| Profile load error + retry | Taxon profile | FONC-1320, FONC-1330 | `taxon-profile-error.png` |

## Future / non-MVP screens (placeholders)

These are not MVP screens; create pages when the corresponding requirements are
scheduled.

| Screen | Requirement | Status |
| --- | --- | --- |
| Formation profile | FONC-950…FONC-970 (V1) | Not started |
| Taxon timeline | FONC-1370, FONC-1380 (V1) | Not started |
| Period comparison view | FONC-200, FONC-1350 (V2) | Not started |
| Group comparison view | FONC-1360 (V2) | Not started |
| Guided paths | FONC-1400…FONC-1430 (V2) | Not started |
