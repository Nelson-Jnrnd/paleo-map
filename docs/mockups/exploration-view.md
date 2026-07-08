# Screen: Exploration View

> Mockup page. Status: **planned**. Image (planned):
> `../assets/mockups/exploration-view.png`. Convention: see [README](README.md).

The main screen: a paleogeographic map with a time control and filters, plus
persistent context (selected age, selected group, result count). This is the hub
from which all other screens are reached.

## Related requirements

FONC-010, FONC-020, FONC-030, FONC-040, FONC-050, FONC-060, FONC-080, FONC-120,
FONC-130, FONC-210, FONC-220, FONC-230, FONC-240, FONC-250, FONC-260, FONC-270,
FONC-300, CONS-450, PERF-010, PERF-020, PERF-080…PERF-120, PERF-220, PERF-230.

## Expected contents

- **Map** — world map for the selected age with approximate continental positions;
  clearly labeled as a paleogeographic reconstruction (FONC-210, FONC-220,
  FONC-300).
- **Time control** — visible control to change the selected age across 252–66 Ma,
  split into Triassic / Jurassic / Cretaceous (FONC-120, FONC-100). The control
  **steps by geological stage** (standard ICS Mesozoic stages) and displays the
  selected age in Ma; period-level quick jumps (FONC-190, V1) sit on top as
  shortcuts. (Per OQ-030.)
- **Selected age** — permanently displayed in Ma (FONC-040, FONC-110).
- **Selected group** — permanently displayed; dinosaurs active by default
  (FONC-050, FONC-020).
- **Result count** — permanent count of visible occurrences matching filters
  (FONC-060).
- **Filters** — entry to the [filters panel](filters-panel.md); reset action
  available (FONC-030, FONC-080).
- **Occurrence markers** — occurrences as points/clusters, individual vs group
  visually distinct, selectable at ≥24×24 CSS px (FONC-230, FONC-240, FONC-270,
  PERF-120).
- **Zoom & pan** — with at least global/regional/local zoom levels (FONC-250,
  FONC-260, PERF-110).
- Access points to the [occurrence panel](occurrence-panel.md) and
  [taxon profile](taxon-profile.md) (FONC-030).

## States to document

- **Loading state** — while the map initially loads (FONC-1260); indicator when an
  update exceeds 500 ms (PERF-050). Variant: `exploration-view-loading.png`.
- **Empty state** — filters return no occurrence (FONC-1280, FONC-860); offer
  reset. Variant: `exploration-view-empty.png`. See
  [empty & error states](empty-error-states.md).
- **Error state** — map fails to load (FONC-1310) with retry, filters preserved
  (FONC-1330, FONC-1340). See [empty & error states](empty-error-states.md).

## Notes

- Main controls (time, map, filters) stay visible — do not hide behind menus
  (CONS-450).
- Convey marker distinctions without relying on color alone (PERF-250).

## TODO

- [ ] Add `../assets/mockups/exploration-view.png` and state variants.
- [ ] Annotate each region with its requirement ID(s).
- [x] Time-control granularity resolved (OQ-030): stepped by geological stage,
      age displayed in Ma.
