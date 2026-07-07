# Acceptance Criteria

> Derived document. Testable acceptance criteria (AC) derived from MVP
> requirements in the
> [functional specification](../product/functional-specification.md). ACs restate
> requirements as verifiable Given/When/Then scenarios; they do not introduce new
> requirements. If an AC conflicts with the specification, the specification wins.

**Numbering:** ACs are numbered in increments of 10. Each AC lists the
requirement IDs it verifies. Coverage focuses on **MVP** requirements; a small
number of V1/V2 placeholders (`AC-9xx`) are stubbed for future use.

**Open dependencies:** some criteria depend on unresolved
[open questions](../product/open-questions.md) — noted inline where relevant
(e.g. the meaning of an "action" in OQ-040).

---

## AC-010 — Main exploration view loads

Related requirements: FONC-010, FONC-030, FONC-040, FONC-050, FONC-060,
CONS-450, PERF-010, PERF-020.

- **Given** the application is opened on a standard desktop connection,
- **When** the main exploration view finishes loading,
- **Then** the map, the time control, and the filter controls are all visible and
  remain visible; the selected geological age, the selected taxonomic group, and
  the count of visible occurrences are each shown; first useful content appears
  within 3 s and the full view within 5 s.

## AC-020 — Dinosaurs are the default active category

Related requirements: FONC-020, FONC-340, FONC-350, FONC-800.

- **Given** the main exploration view loads for the first time,
- **When** no filter has been changed by the user,
- **Then** non-avian dinosaurs are the active category, and only non-avian
  dinosaur occurrences are shown.

## AC-030 — Changing the selected age updates the map and occurrences

Related requirements: FONC-120, FONC-130, FONC-140, FONC-150, FONC-160,
PERF-030, PERF-360.

- **Given** the exploration view is loaded and the required data is already
  loaded,
- **When** the user changes the selected age via the time control,
- **Then** the map redraws for the new age and the visible occurrences update to
  only those whose time range overlaps the new age, within 1 s and without a full
  application reload.

## AC-040 — Geological age is displayed correctly

Related requirements: FONC-090, FONC-100, FONC-110, FONC-170, CONS-190.

- **Given** the exploration view is loaded,
- **When** the user inspects the time control,
- **Then** the selected age is shown in Ma within the 252–66 Ma interval; the
  interval is divided into Triassic, Jurassic, and Cretaceous; and a selected
  precise age is visually distinct from a displayed time range.

> Note: exact time-control behavior depends on OQ-030 (continuous vs stepped age).

## AC-050 — Map is clearly a paleogeographic reconstruction

Related requirements: FONC-210, FONC-220, FONC-300, CONS-120.

- **Given** a selected age,
- **When** the world map is displayed,
- **Then** it shows the approximate continental positions for that age and carries
  a clear indication that it is a scientific paleogeographic reconstruction, not a
  direct observation.

## AC-060 — Occurrences render as points and clusters

Related requirements: FONC-230, FONC-240, PERF-090, PERF-100, PERF-110.

- **Given** occurrences exist for the selected age and filters,
- **When** they are displayed on the map,
- **Then** individual occurrences are visually distinct from occurrence groups;
  when density would place more than 30 markers in a 100×100 CSS px area they are
  clustered; and at least 3 zoom levels (global, regional, local) are available.

## AC-070 — Map zoom and pan with accessible targets

Related requirements: FONC-250, FONC-260, PERF-060, PERF-120, PERF-270.

- **Given** the map is displayed,
- **When** the user zooms or pans,
- **Then** the map responds with visual feedback within 100 ms, and every point or
  cluster remains selectable within an interactive area of at least 24×24 CSS px.

## AC-080 — Selecting an occurrence opens its information panel

Related requirements: FONC-270, FONC-280, FONC-290, FONC-890, FONC-900,
FONC-910, FONC-920, FONC-930.

- **Given** an occurrence is visible on the map,
- **When** the user selects it,
- **Then** an information panel opens showing at minimum the associated taxon, the
  time range, the modern location, the paleogeographic position, and the source.

## AC-090 — Opening a taxon profile from an occurrence

Related requirements: FONC-990, FONC-1070, CONS-460, PERF-340.

- **Given** an occurrence is visible on the map,
- **When** the user opens the associated taxon profile,
- **Then** the taxon profile opens in no more than 2 actions from the visible
  occurrence.

> Note: pass/fail counting of "actions" depends on OQ-040.

## AC-100 — Taxon profile shows required content

Related requirements: FONC-510, FONC-520, FONC-530, FONC-540, FONC-550,
FONC-560, FONC-570, FONC-580, FONC-590.

- **Given** a taxon selected from the map or search results,
- **When** its profile opens,
- **Then** the profile shows the scientific name, taxonomic rank, available
  classification, known time range, known fossil occurrences, modern discovery
  locations, reconstructed paleogeographic positions, and the sources used.

## AC-110 — Returning to the map preserves state

Related requirements: FONC-1000, FONC-1010, FONC-1020, FONC-1080, CONS-470.

- **Given** the user navigated from the map to a taxon profile with a selected age
  and active filters,
- **When** the user returns to the map,
- **Then** the return takes no more than 1 action, and the previously selected age
  and active filters are still applied.

## AC-120 — Filtering by period, group, and dinosaurs-only with a live count

Related requirements: FONC-780, FONC-790, FONC-800, FONC-850, FONC-060.

- **Given** the exploration view is loaded,
- **When** the user filters by geological period, by taxonomic group, or to
  dinosaurs only,
- **Then** the visible occurrences update to match, and the displayed result count
  reflects the active filters.

## AC-130 — Removing filters individually and all at once

Related requirements: FONC-870, FONC-880, FONC-080.

- **Given** one or more filters are active,
- **When** the user removes a single filter, or resets all filters,
- **Then** the removed filter(s) no longer apply, the result set and count update
  accordingly, and a single action clears all active filters.

## AC-140 — Empty state when filters return no occurrence

Related requirements: FONC-860, FONC-1280, PERF-320, PERF-370.

- **Given** active filters that match no occurrence,
- **When** the filtered result is displayed,
- **Then** an explicit empty state is shown (not a blank map), and the user can
  reset the filters to leave the empty state.

## AC-150 — Searching a taxon by scientific name

Related requirements: FONC-760, PERF-350.

- **Given** the exploration view is loaded,
- **When** the user searches for a taxon by its scientific name,
- **Then** matching taxa are returned, and from a result the user can open the
  profile and display the taxon's occurrences on the map.

## AC-160 — Empty state when a search returns nothing

Related requirements: FONC-1290, PERF-330.

- **Given** a search term that matches no taxon,
- **When** the search completes,
- **Then** an explicit empty state is shown for the search.

## AC-170 — Content level and incomplete-profile labeling

Related requirements: FONC-430, FONC-440, FONC-450, FONC-480, FONC-490,
FONC-1120, PERF-180, PERF-190.

- **Given** a displayed taxon,
- **When** its profile or listing is shown,
- **Then** the taxon carries a content level (at least "Occurrence only" or "Short
  profile"); an incomplete profile is clearly flagged; every unavailable field is
  shown with an explicit label rather than a blank; and no profile has more than
  20% silently empty fields.

## AC-180 — Sources and uncertainty are always visible

Related requirements: FONC-670, FONC-1090, FONC-1100, FONC-1110, FONC-1130,
FONC-1140, FONC-1150, CONS-390, CONS-440.

- **Given** any visible occurrence or taxon profile,
- **When** its data is displayed,
- **Then** an identifiable source is shown; interpretative data is distinguished
  from fossil-derived data; reconstructed positions and approximate time ranges
  are labeled as such; occurrences are presented as discovery evidence rather than
  distribution boundaries; and sourced data is not mixed with unmarked
  assumptions in the same field.

## AC-190 — Alternative state when no image is available

Related requirements: FONC-1240.

- **Given** a taxon with no available image,
- **When** its profile is displayed,
- **Then** an explicit alternative (fallback) state is shown in place of the
  image.

## AC-200 — Loading states for map and profile

Related requirements: FONC-1260, FONC-1270, PERF-050.

- **Given** the map is loading initially, or a taxon profile whose data is not
  already available is being opened,
- **When** the operation takes longer than 500 ms,
- **Then** a loading state / indicator is displayed until content is ready.

## AC-210 — Error, retry, and filter preservation

Related requirements: FONC-1310, FONC-1320, FONC-1330, FONC-1340, PERF-280,
PERF-290, PERF-300, PERF-310.

- **Given** a map or taxon profile fails to load,
- **When** the failure is surfaced,
- **Then** a clear error message is shown; the user can retry without reloading
  the entire application; and any active filters are preserved through the
  failure and retry.

## AC-220 — Taxonomy exploration and group selection

Related requirements: FONC-680, FONC-690, FONC-700, FONC-710, FONC-720.

- **Given** the exploration view,
- **When** the user explores by taxonomic group and selects one,
- **Then** the map updates for that group; a selected taxon shows its available
  taxonomic hierarchy with distinguished levels (clade, family, genus, species);
  and invalid/doubtful/synonymous/uncertain taxa are flagged when that information
  is available.

## AC-230 — Scope labeling: main vs secondary content

Related requirements: FONC-360, FONC-400, FONC-410.

- **Given** displayed taxa,
- **When** their content is shown,
- **Then** non-avian dinosaurs are distinguished from other Mesozoic reptiles,
  each taxon is marked as main or secondary content, and the application does not
  present itself as a complete atlas of all Mesozoic life.

> Note: whether any secondary content is present in the MVP data set depends on
> OQ-050; the labeling requirement may be satisfied vacuously.

## AC-240 — Minimal-data profile message

Related requirements: FONC-480, FONC-1300.

- **Given** a taxon profile that exists but contains only minimal data,
- **When** it is opened,
- **Then** an explicit message indicates that the profile is minimal/incomplete.

---

## Placeholders for later releases (V1 / V2)

These are stubs to be expanded when the corresponding requirements are scheduled.
Do not treat them as complete.

- **AC-900 — Selection summary text (V1):** covers FONC-070. _TODO._
- **AC-910 — Present-day comparison layer (V1):** covers FONC-310, FONC-980.
  _TODO._
- **AC-920 — Enriched profile fields (V1):** covers FONC-600…FONC-640. _TODO._
- **AC-930 — Formation profiles (V1):** covers FONC-940…FONC-970, FONC-1030,
  FONC-1040. _TODO._
- **AC-940 — Image typing and credit (V1):** covers FONC-1190…FONC-1230,
  PERF-260. _TODO._
- **AC-950 — Taxon timeline (V1):** covers FONC-1370, FONC-1380. _TODO._
- **AC-960 — Period/group comparison views (V2):** covers FONC-200, FONC-1350,
  FONC-1360. _TODO._
- **AC-970 — Guided paths (V2):** covers FONC-1400…FONC-1430. _TODO._
- **AC-980 — Mobile support (V2):** covers CONS-510. _TODO._
