# State Diagrams

> Diagram page. Status: **planned**. Source files (planned) under
> `../assets/uml/`. Convention: PlantUML (see [README](README.md)).

State diagrams model the lifecycle of a view or control, focusing on loading,
empty, error, and retry states required by the specification. Each section is one
diagram.

---

## Map loading state

**Source (planned):** `../assets/uml/map-loading-state.puml`

**Purpose:** lifecycle of the paleogeographic map from initial load through
success, error, and retry.

**Related requirements:** FONC-1260, FONC-1310, FONC-1330, FONC-1340, PERF-010,
PERF-020, PERF-050, PERF-280, PERF-300, PERF-310.

**States:** `Idle → Loading → Loaded` and `Loading → Error → (Retry) → Loading`.
On error, filters are preserved (FONC-1340). A loading indicator appears when the
update exceeds 500 ms (PERF-050).

**TODO:** [ ] author `.puml`; [ ] model age-change re-load transitions.

---

## Taxon profile loading state

**Source (planned):** `../assets/uml/taxon-profile-loading-state.puml`

**Purpose:** lifecycle of a taxon profile, including the minimal-data and no-image
variants.

**Related requirements:** FONC-1270, FONC-1300, FONC-1320, FONC-1330, FONC-1240,
FONC-480, PERF-040, PERF-290, PERF-300.

**States:** `Closed → Loading → Loaded` with substates `Loaded/Complete`,
`Loaded/Minimal` (FONC-1300), and `Loaded/NoImage` (FONC-1240); plus
`Loading → Error → (Retry) → Loading`.

**TODO:** [ ] author `.puml`; [ ] distinguish incomplete vs minimal profiles.

---

## Search state

**Source (planned):** `../assets/uml/search-state.puml`

**Purpose:** lifecycle of the search interaction.

**Related requirements:** FONC-760, FONC-1290, PERF-070, PERF-330.

**States:** `Empty → Typing → Results` and `Typing → NoResults` (empty state,
FONC-1290); `Results → (select) → open profile`. Optional `Searching`
intermediate if the search is not instantaneous (PERF-070).

**TODO:** [ ] author `.puml`; [ ] confirm whether search is incremental.

---

## Filter state

**Source (planned):** `../assets/uml/filter-state.puml`

**Purpose:** lifecycle of the active-filter set.

**Related requirements:** FONC-780, FONC-790, FONC-800, FONC-850, FONC-860,
FONC-870, FONC-880, FONC-1280, FONC-1340, PERF-320.

**States:** `NoFilters → FiltersActive` (with a live result count) →
`FiltersActive/HasResults` or `FiltersActive/NoResults` (empty state). Transitions:
add filter, remove one filter, reset all → `NoFilters`. Filters persist across
load failures (FONC-1340).

**TODO:** [ ] author `.puml`; [ ] model persistence across navigation and failure.
