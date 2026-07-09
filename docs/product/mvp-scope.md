# MVP Scope

> Derived document. It reorganizes MVP material from the
> [functional specification](functional-specification.md) for readability. It
> introduces no new requirements. If it conflicts with the specification, the
> specification wins. Requirement IDs are the canonical reference.

## MVP goals

The MVP delivers a **first usable version** of the atlas: a credible, map-first
way to explore where and when non-avian dinosaurs are known from fossil evidence
across the Mesozoic, with sources and uncertainty always visible.

Per the specification (§4), the MVP must let users:

1. Explore the Mesozoic between 252 Ma and 66 Ma.
2. Display a paleogeographic map corresponding to the selected age.
3. Display fossil occurrences of non-avian dinosaurs.
4. Filter occurrences by period and taxonomic group.
5. Select a fossil occurrence.
6. Open a taxon profile from an occurrence.
7. Display classification, time range, discovery locations and sources.
8. Distinguish direct fossil data from interpretative data.
9. Clearly display missing, uncertain or reconstructed data.
10. Avoid misleading representation of actual species distribution.

## MVP user-facing capabilities

Grouped by area, with the governing requirement IDs. All are **[MVP]**.

### Main exploration view

- Combined map + time control + filters; dinosaurs active by default; permanent
  display of selected age, selected group, and visible occurrence count; reset
  filters. → FONC-010, FONC-020, FONC-030, FONC-040, FONC-050, FONC-060,
  FONC-080; CONS-450.

### Time exploration

- Explore 252–66 Ma, split into Triassic / Jurassic / Cretaceous; change the
  selected age via a visible time control; map and occurrences update on change;
  occurrences and taxa shown only when the age overlaps their time range; precise
  age visually distinct from a time range. → FONC-090…FONC-170.

### Paleogeographic map

- World map for the selected age with approximate continental positions;
  occurrences as points/clusters with individual vs group distinction; zoom and
  pan; select an occurrence; information panel showing taxon, time range, modern
  location, paleogeographic position, source; explicit "reconstruction" label. →
  FONC-210…FONC-300.

### Scope of groups

- Non-avian dinosaurs as main content and the only-dinosaurs display; distinction
  from other Mesozoic reptiles; coverage of major dinosaur groups when data
  exists; no claim of covering all Mesozoic life; main vs secondary content
  clearly indicated. → FONC-340, FONC-350, FONC-360, FONC-370, FONC-400,
  FONC-410.
  - **MVP data is dinosaurs-only (OQ-050, resolved).** Secondary reptile groups
    are V1 (FONC-380/FONC-390); the main/secondary labeling machinery is present
    in the MVP but satisfied vacuously — every taxon is tagged "main content."

### Content levels

- Each taxon classified by content level; "Occurrence only" and "Short profile"
  levels supported; incomplete profiles flagged; unavailable fields shown with an
  explicit label. → FONC-430, FONC-440, FONC-450, FONC-480, FONC-490.

### Taxon profile

- Scientific name, taxonomic rank, classification, time range, occurrences,
  modern discovery locations, paleogeographic positions, sources; interpretative
  vs fossil-derived information indicated. → FONC-510…FONC-590, FONC-670.

### Classification and taxonomy

- Explore by taxonomic group; show taxonomic hierarchy of a selected taxon;
  select a group and update the map; distinguish taxonomic levels; flag
  invalid/doubtful/synonymous/uncertain taxa when known. → FONC-680…FONC-720.

### Search and filters

- Search by scientific name; filter by period, by taxonomic group, and to
  dinosaurs only; result count; explicit empty state; remove one filter or all
  filters. → FONC-760, FONC-780, FONC-790, FONC-800, FONC-850, FONC-860,
  FONC-870, FONC-880.

### Occurrences

- Panel per selected occurrence; modern location, paleogeographic position, time
  range, and source shown. → FONC-890, FONC-900, FONC-910, FONC-920, FONC-930.

### Navigation

- Open a taxon profile from an occurrence; return to the map; preserve selected
  age and active filters across navigation; ≤2 actions to a profile from a
  visible occurrence; ≤1 action back to the map. → FONC-990…FONC-1020,
  FONC-1070, FONC-1080; CONS-460, CONS-470.

### Sources, provenance and uncertainty

- Sources shown; identifiable source per visible occurrence; fossil-derived vs
  interpretative distinguished; missing data marked; reconstructed positions and
  approximate time ranges labeled; occurrences shown as discovery evidence, not
  distribution boundaries. → FONC-1090…FONC-1150.

### Images

- Alternative state when no image is available. → FONC-1240.

### Interface states

- Loading states for map and profile; empty states for filters and search;
  minimal-data message; clear error messages for map and profile; retry; filters
  preserved after failure. → FONC-1260…FONC-1340.

## MVP quality and validation requirements (non-functional)

- **Response time:** PERF-010…PERF-060.
- **Readability / map density:** PERF-080…PERF-120.
- **Minimum data quality:** PERF-140…PERF-190.
- **Accessibility:** PERF-220, PERF-230, PERF-240, PERF-250, PERF-270.
- **Display robustness:** PERF-280…PERF-330.

## MVP validation scenarios

The MVP must complete these end-to-end scenarios without a blocking error:

- **PERF-340** — select a period → filter dinosaurs → select an occurrence → open
  a taxon profile → return to the map.
- **PERF-350** — search for a taxon → open its profile → display its occurrences
  on the map.
- **PERF-360** — change the selected age → observe the change in visible
  occurrences (no full reload).
- **PERF-370** — activate a filter with no result → display an empty state →
  reset filters.

## MVP excluded features

Explicitly **not** required for the MVP (specification §5): continuous drift
animation, 3D globe, side-by-side period comparison, complete phylogeny, guided
paths, complete coverage of all Mesozoic reptiles or all Mesozoic life, artistic
reconstructions for all taxa, systematic predator-prey relationships, and
extrapolated distribution range maps. See
[`out-of-scope.md`](out-of-scope.md) for the full breakdown, including V1/V2
items and scientific/representation limitations.

## What makes the MVP usable

The MVP is usable because it closes a complete exploration loop — **time → map →
occurrence → taxon → back to map** — while never misleading the user. Age, group,
and result count are always on screen; sources and uncertainty are always
visible; missing data is labeled rather than hidden; and fossil points are framed
as discovery evidence rather than distribution ranges. A user can answer "what
dinosaurs are known from this age, and where were they found?" with confidence in
the provenance of every answer.
