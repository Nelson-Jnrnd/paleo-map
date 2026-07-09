# Functional Specification V2 — Interactive Mesozoic Dinosaur Atlas

> **Authoritative source of product requirements.** This is the single source of
> truth for what the atlas must do. Derived documents (indexes, traceability,
> vision, scope, glossary) summarize this file and must not contradict it. If a
> derived document conflicts with this specification, this specification wins.
>
> Requirement IDs are **stable** and must not be renumbered. Priorities
> (`[MVP]`, `[V1]`, `[V2]`) and requirement verbs (**must** vs **should**) are
> normative and must be preserved.

## Table of contents

- [0. Conventions](#0-conventions)
  - [0.1 Priorities](#01-priorities)
  - [0.2 Interpretation of requirement verbs](#02-interpretation-of-requirement-verbs)
  - [0.3 Glossary](#03-glossary)
- [1. Features](#1-features)
  - [1.1 Main exploration view](#11-main-exploration-view)
  - [1.2 Time exploration](#12-time-exploration)
  - [1.3 Paleogeographic map](#13-paleogeographic-map)
  - [1.4 Scope of represented groups](#14-scope-of-represented-groups)
  - [1.5 Taxon content levels](#15-taxon-content-levels)
  - [1.6 Taxon and species profile](#16-taxon-and-species-profile)
  - [1.7 Classification and taxonomy](#17-classification-and-taxonomy)
  - [1.8 Search and filters](#18-search-and-filters)
  - [1.9 Locations, occurrences and formations](#19-locations-occurrences-and-formations)
  - [1.10 Navigation between content](#110-navigation-between-content)
  - [1.11 Sources, provenance and uncertainty](#111-sources-provenance-and-uncertainty)
  - [1.12 Images and illustrations](#112-images-and-illustrations)
  - [1.13 Interface states](#113-interface-states)
  - [1.14 Comparison and guided paths](#114-comparison-and-guided-paths)
- [2. Constraints](#2-constraints)
  - [2.1 Scientific scope](#21-scientific-scope)
  - [2.2 Geographic representation](#22-geographic-representation)
  - [2.3 Temporal representation](#23-temporal-representation)
  - [2.4 Scientific consistency](#24-scientific-consistency)
  - [2.5 Editorial content](#25-editorial-content)
  - [2.6 Sources and provenance](#26-sources-and-provenance)
  - [2.7 Interface and usability](#27-interface-and-usability)
- [3. Performance](#3-performance)
  - [3.1 Response time](#31-response-time)
  - [3.2 Readability and map density](#32-readability-and-map-density)
  - [3.3 Minimum quality of visible data](#33-minimum-quality-of-visible-data)
  - [3.4 Accessibility and usability](#34-accessibility-and-usability)
  - [3.5 Display robustness](#35-display-robustness)
  - [3.6 MVP functional validation](#36-mvp-functional-validation)
- [4. MVP Scope Summary](#4-mvp-scope-summary)
- [5. Explicitly Out of MVP Scope](#5-explicitly-out-of-mvp-scope)

---

## 0. Conventions

### 0.1 Priorities

Requirements are marked with a priority:

- **[MVP]**: required for a first usable version.
- **[V1]**: desirable for a complete first version, but not required for the MVP.
- **[V2]**: advanced feature or later enhancement.

### 0.2 Interpretation of requirement verbs

- **must**: mandatory requirement.
- **should**: optional or recommended requirement.

> **Clarification (priority vs. verb).** Priority (§0.1) and verb are two
> independent axes: the **priority** says *which release* a requirement belongs to
> (MVP / V1 / V2), and the **verb** says *how binding* it is *within that
> release*. Consequently a "[V1] must" requirement is not required for the MVP but
> becomes mandatory once V1 is undertaken. For example, showing a taxon image is
> optional (FONC-1190, "[V1] should"), but *if* an image is shown, labeling its
> type, credit, and artistic nature is mandatory (FONC-1200–FONC-1230, "[V1]
> must"). This note documents interpretation only; it changes no requirement
> wording or ID.

### 0.3 Glossary

**Mesozoic**: geological interval between approximately 252 Ma and 66 Ma.

**Ma**: millions of years before present.

**Non-avian dinosaurs**: dinosaurs in the common sense, excluding modern birds
and strictly avian lineages.

**Taxon**: biological classification unit, for example clade, family, genus or
species.

**Fossil occurrence**: documented fossil evidence associated with a taxon, a
discovery location and a geological time range.

**Geological formation**: named geological unit associated with rocks and, in
some cases, fossils.

**Modern position**: present-day location where a fossil was discovered.

**Paleogeographic position**: approximate reconstructed position of that location
during a past geological period.

**Time range**: interval between a minimum age boundary and a maximum age
boundary.

**Interpretative data**: inferred or synthesized information, for example diet,
estimated mass or assumed behavior.

**Sourced data**: information linked to an identifiable source.

**Geological stage**: a subdivision of a geological period in the International
Chronostratigraphic Chart. The time control's selectable resolution is the
geological stage (see §1.2).

**Action**: one primary user interaction that causes a navigation or state
transition — a click/tap or its keyboard equivalent. Hover, scroll, zoom and pan
are not counted. This is the unit used by the navigation limits in FONC-1070 /
FONC-1080 and CONS-460 / CONS-470 (for example, occurrence → occurrence panel →
taxon profile is two actions).

---

## 1. Features

### 1.1 Main exploration view

- **FONC-010** [MVP] — The system must provide a main exploration view combining a map, a time control and filters.
- **FONC-020** [MVP] — The system must display dinosaurs as the active category by default when the main exploration view first loads.
- **FONC-030** [MVP] — The system must allow access from the main exploration view to a fossil occurrence, a taxon page and a filter panel.
- **FONC-040** [MVP] — The system must permanently display the selected geological age on the main exploration view.
- **FONC-050** [MVP] — The system must permanently display the currently selected taxonomic group on the main exploration view.
- **FONC-060** [MVP] — The system must permanently display the number of visible occurrences matching the active filters.
- **FONC-070** [V1] — The system should display a short textual summary of the current selection, including the period, taxonomic group and number of results.
- **FONC-080** [MVP] — The system must allow the active filters to be reset from the main exploration view.

### 1.2 Time exploration

> **Clarification (time control resolution).** The selected age is chosen in
> discrete steps at **geological-stage** boundaries and is displayed in Ma;
> quick selection of a whole period (FONC-190) is a shortcut over the same
> control. This fixes how FONC-120 and FONC-170 behave and how the overlap
> between the selected age and a known time range (FONC-150 / FONC-160) is
> evaluated. A continuous, sub-stage age selector is out of scope.

- **FONC-090** [MVP] — The system must allow exploration of the interval between 252 Ma and 66 Ma.
- **FONC-100** [MVP] — The system must divide the main time interval into three periods: Triassic, Jurassic and Cretaceous.
- **FONC-110** [MVP] — The system must display the selected age in millions of years before present using the unit Ma.
- **FONC-120** [MVP] — The system must allow the selected age to be changed through a time control visible on the main exploration view.
- **FONC-130** [MVP] — The system must update the map when the selected age changes.
- **FONC-140** [MVP] — The system must update the visible fossil occurrences when the selected age changes.
- **FONC-150** [MVP] — The system must display an occurrence only when the selected age overlaps with the known time range of that occurrence.
- **FONC-160** [MVP] — The system must display a taxon only when the selected age overlaps with its known time range.
- **FONC-170** [MVP] — The system must visually distinguish a selected precise age from a known time range.
- **FONC-180** [V1] — The system should display the geological stage corresponding to the selected age when this information is available.
- **FONC-190** [V1] — The system should allow quick selection of a complete period, for example Triassic, Jurassic or Cretaceous.
- **FONC-200** [V2] — The system should allow two geological ages to be compared side by side.

### 1.3 Paleogeographic map

- **FONC-210** [MVP] — The system must display a world map corresponding to the selected age.
- **FONC-220** [MVP] — The system must show the approximate position of continental landmasses for the selected age.
- **FONC-230** [MVP] — The system must display fossil occurrences as points or grouped points on the map.
- **FONC-240** [MVP] — The system must visually distinguish individual occurrences from occurrence groups.
- **FONC-250** [MVP] — The system must allow the user to zoom on the map.
- **FONC-260** [MVP] — The system must allow the user to pan the map horizontally and vertically.
- **FONC-270** [MVP] — The system must allow a fossil occurrence displayed on the map to be selected.
- **FONC-280** [MVP] — The system must display an information panel when a fossil occurrence is selected.
- **FONC-290** [MVP] — The system must display at minimum, for a selected occurrence: the associated taxon, the time range, the modern location, the paleogeographic position and the source.
- **FONC-300** [MVP] — The system must clearly indicate that the ancient map displayed is a paleogeographic reconstruction.
- **FONC-310** [V1] — The system should allow a comparison layer with present-day continents to be displayed.
- **FONC-320** [V1] — The system should allow fossil occurrence display to be enabled or disabled.
- **FONC-330** [V2] — The system should allow the map transition between two geological ages to be animated.

### 1.4 Scope of represented groups

> **Clarification (MVP data scope).** The MVP data set contains **non-avian
> dinosaurs only**; secondary Mesozoic reptile groups (FONC-380 / FONC-390) are
> introduced in V1. The main-vs-secondary distinction (FONC-360 / FONC-410) is
> therefore present in the MVP as labelling machinery applied to dinosaur content;
> it is not satisfied by shipping any secondary taxa in the MVP.

- **FONC-340** [MVP] — The system must treat non-avian dinosaurs as the main content.
- **FONC-350** [MVP] — The system must allow only non-avian dinosaurs to be displayed.
- **FONC-360** [MVP] — The system must distinguish non-avian dinosaurs from other included Mesozoic reptiles.
- **FONC-370** [MVP] — The system must cover the major dinosaur groups when data is available: theropods, sauropodomorphs, ornithopods, thyreophorans, ceratopsians and pachycephalosaurs.
- **FONC-380** [V1] — The system should include selected secondary groups among pterosaurs, marine reptiles, crocodylomorphs and Mesozoic lepidosaurs.
- **FONC-390** [V1] — The system should allow only included secondary groups to be displayed.
- **FONC-400** [MVP] — The system must not present the application as a complete atlas of all Mesozoic life.
- **FONC-410** [MVP] — The system must clearly indicate whether a taxon belongs to the main content or secondary content.
- **FONC-420** [V1] — The system should allow secondary groups to be hidden in order to preserve a dinosaur-centered experience.

### 1.5 Taxon content levels

- **FONC-430** [MVP] — The system must classify each displayed taxon according to a content level.
- **FONC-440** [MVP] — The system must support an Occurrence only level for taxa that only have basic fossil occurrence data.
- **FONC-450** [MVP] — The system must support a Short profile level for taxa that have a name, classification, time range and at least one occurrence.
- **FONC-460** [V1] — The system should support a Detailed profile level for taxa that have sourced morphological or ecological information.
- **FONC-470** [V1] — The system should support a Featured species level for species that have an enriched profile, a dedicated map and associated information.
- **FONC-480** [MVP] — The system must clearly indicate when a taxon profile is incomplete.
- **FONC-490** [MVP] — The system must display unavailable fields with an explicit label instead of an empty space.
- **FONC-500** [V1] — The system should allow taxa to be filtered or sorted by content level.

### 1.6 Taxon and species profile

- **FONC-510** [MVP] — The system must provide a profile for each taxon selectable from the map or search results.
- **FONC-520** [MVP] — The system must display the scientific name of the taxon on its profile.
- **FONC-530** [MVP] — The system must display the taxonomic rank of the taxon on its profile.
- **FONC-540** [MVP] — The system must display the available taxonomic classification of the taxon on its profile.
- **FONC-550** [MVP] — The system must display the known time range of the taxon on its profile.
- **FONC-560** [MVP] — The system must display the known fossil occurrences associated with the taxon.
- **FONC-570** [MVP] — The system must display the modern discovery locations associated with the taxon.
- **FONC-580** [MVP] — The system must display the reconstructed paleogeographic positions associated with the taxon.
- **FONC-590** [MVP] — The system must display the sources used for the main information on the profile.
- **FONC-600** [V1] — The system should display the assumed diet of the taxon when this information is available.
- **FONC-610** [V1] — The system should display the assumed locomotion mode of the taxon when this information is available.
- **FONC-620** [V1] — The system should display an estimated length when this information is available.
- **FONC-630** [V1] — The system should display an estimated mass when this information is available.
- **FONC-640** [V1] — The system should display a short descriptive summary for taxa at the Detailed profile or Featured species level.
- **FONC-650** [V1] — The system should display related taxa when this information is available.
- **FONC-660** [V1] — The system should display taxa known from the same formation or region and from an overlapping time range.
- **FONC-670** [MVP] — The system must indicate when profile information is interpretative rather than directly derived from a fossil occurrence.

### 1.7 Classification and taxonomy

- **FONC-680** [MVP] — The system must allow taxa to be explored by taxonomic group.
- **FONC-690** [MVP] — The system must display the available taxonomic hierarchy of a selected taxon.
- **FONC-700** [MVP] — The system must allow a taxonomic group to be selected and the map to be updated according to that group.
- **FONC-710** [MVP] — The system must distinguish the displayed taxonomic levels, for example clade, family, genus and species.
- **FONC-720** [MVP] — The system must indicate when a taxon is invalid, doubtful, synonymous or uncertain when this information is available.
- **FONC-730** [V1] — The system should allow navigation from a species to its parent groups.
- **FONC-740** [V1] — The system should allow navigation from a group to its associated genera or species.
- **FONC-750** [V1] — The system should allow the map to be filtered from a selection in the taxonomic tree.

### 1.8 Search and filters

- **FONC-760** [MVP] — The system must allow a taxon to be searched by scientific name.
- **FONC-770** [V1] — The system should allow a taxon to be searched by common name or popular name when one is available.
- **FONC-780** [MVP] — The system must allow occurrences to be filtered by geological period.
- **FONC-790** [MVP] — The system must allow occurrences to be filtered by taxonomic group.
- **FONC-800** [MVP] — The system must allow occurrences to be filtered to display only non-avian dinosaurs.
- **FONC-810** [V1] — The system should allow occurrences to be filtered by diet.
- **FONC-820** [V1] — The system should allow occurrences to be filtered by modern discovery region.
- **FONC-830** [V1] — The system should allow occurrences to be filtered by taxon content level.
- **FONC-840** [V1] — The system should allow occurrences to be filtered by data completeness or reliability level.
- **FONC-850** [MVP] — The system must display the number of results matching the active filters.
- **FONC-860** [MVP] — The system must display an explicit empty state when no result matches the active filters.
- **FONC-870** [MVP] — The system must allow an active filter to be removed individually.
- **FONC-880** [MVP] — The system must allow all active filters to be removed in a single action.

### 1.9 Locations, occurrences and formations

- **FONC-890** [MVP] — The system must provide a profile or information panel for each selected fossil occurrence.
- **FONC-900** [MVP] — The system must display the modern location associated with a fossil occurrence when this information is available.
- **FONC-910** [MVP] — The system must display the reconstructed paleogeographic position associated with a fossil occurrence when this information is available.
- **FONC-920** [MVP] — The system must display the time range associated with a fossil occurrence.
- **FONC-930** [MVP] — The system must display the source associated with a fossil occurrence.
- **FONC-940** [V1] — The system should display the name of the geological formation associated with an occurrence when this information is available.
- **FONC-950** [V1] — The system should provide a profile for a selected geological formation.
- **FONC-960** [V1] — The system should display the taxa known from a selected geological formation.
- **FONC-970** [V1] — The system should display the age or time range of a geological formation when this information is available.
- **FONC-980** [V1] — The system should allow comparison between the modern position and paleogeographic position of a selected location.

### 1.10 Navigation between content

- **FONC-990** [MVP] — The system must allow a taxon profile to be opened from a selected fossil occurrence.
- **FONC-1000** [MVP] — The system must allow the user to return to the map from a taxon profile.
- **FONC-1010** [MVP] — The system must preserve the selected age when navigating from the map to a taxon profile.
- **FONC-1020** [MVP] — The system must preserve the active filters when navigating from the map to a taxon profile.
- **FONC-1030** [V1] — The system should allow a formation profile to be opened from a selected fossil occurrence.
- **FONC-1040** [V1] — The system should allow a taxon profile to be opened from a formation profile.
- **FONC-1050** [V1] — The system should allow a related taxon profile to be opened from a taxon profile.
- **FONC-1060** [V1] — The system should allow the user to return to the previous search result after viewing a profile.
- **FONC-1070** [MVP] — The system must allow access to a taxon profile in a maximum of 2 actions from an occurrence visible on the map.
- **FONC-1080** [MVP] — The system must allow the user to return to the map in a maximum of 1 action from a taxon profile.

### 1.11 Sources, provenance and uncertainty

> **Clarification (which sources).** These requirements demand an *identifiable*
> source for every visible occurrence and time range but deliberately do **not**
> mandate a particular provider. The concrete dataset(s) are a technical-design
> decision recorded in the [data architecture design](../design/data-model.md)
> (Paleobiology Database + Wikipedia/Wikidata); any provider that supplies sourced
> occurrences, time ranges and reconstructions satisfies the requirements below.

- **FONC-1090** [MVP] — The system must display the sources of the scientific data used.
- **FONC-1100** [MVP] — The system must display an identifiable source for each visible fossil occurrence.
- **FONC-1110** [MVP] — The system must distinguish data directly derived from fossil occurrences from interpretative data.
- **FONC-1120** [MVP] — The system must indicate when information is missing instead of replacing it with an unmarked assumption.
- **FONC-1130** [MVP] — The system must indicate when a geographic position is reconstructed.
- **FONC-1140** [MVP] — The system must indicate when a time range is approximate.
- **FONC-1150** [MVP] — The system must display fossil occurrences as evidence of discovery, not as complete distribution boundaries.
- **FONC-1160** [V1] — The system should display a confidence level for morphological, ecological or behavioral information when such a level is available.
- **FONC-1170** [V1] — The system should display the consultation or import date of the data when this information is available.
- **FONC-1180** [V1] — The system should display a link to the external source when this link is available.

### 1.12 Images and illustrations

- **FONC-1190** [V1] — The system should display an image or illustration for taxa at the Detailed profile or Featured species level when this resource is available.
- **FONC-1200** [V1] — The system must distinguish between a fossil photograph, an artistic reconstruction and a silhouette when an image is displayed.
- **FONC-1210** [V1] — The system must display the source or credit for an image when the image is displayed.
- **FONC-1220** [V1] — The system must indicate when an image is an artistic representation.
- **FONC-1230** [V1] — The system must not present an artistic illustration as direct evidence of the animal's exact appearance.
- **FONC-1240** [MVP] — The system must display an alternative state when no image is available for a taxon.
- **FONC-1250** [V2] — The system should allow the animal's size to be visually compared with a human reference when dimensions are available.

### 1.13 Interface states

- **FONC-1260** [MVP] — The system must display a loading state while the map initially loads.
- **FONC-1270** [MVP] — The system must display a loading state when opening a taxon profile if the data is not already available.
- **FONC-1280** [MVP] — The system must display an empty state when the active filters return no occurrence.
- **FONC-1290** [MVP] — The system must display an empty state when a search returns no taxon.
- **FONC-1300** [MVP] — The system must display an explicit message when a taxon profile exists but contains only minimal data.
- **FONC-1310** [MVP] — The system must display a clear error message when a map cannot be loaded.
- **FONC-1320** [MVP] — The system must display a clear error message when a taxon profile cannot be loaded.
- **FONC-1330** [MVP] — The system must allow a failed load to be retried.
- **FONC-1340** [MVP] — The system must preserve active filters after a profile, map or occurrence loading failure.

### 1.14 Comparison and guided paths

- **FONC-1350** [V2] — The system should allow two geological periods to be compared in a dedicated view.
- **FONC-1360** [V2] — The system should allow two taxonomic groups to be compared in a dedicated view.
- **FONC-1370** [V1] — The system should display a timeline for a selected taxon.
- **FONC-1380** [V1] — The system should display the known first and last appearance of a taxon on a timeline.
- **FONC-1390** [V2] — The system should allow a region to be selected and display the taxa known from that region for the selected age.
- **FONC-1400** [V2] — The system should provide thematic guided paths.
- **FONC-1410** [V2] — The system should provide at least one guided path focused on large theropods.
- **FONC-1420** [V2] — The system should provide at least one guided path focused on Jurassic dinosaurs.
- **FONC-1430** [V2] — The system should provide at least one guided path focused on Late Cretaceous dinosaurs.

---

## 2. Constraints

### 2.1 Scientific scope

- **CONS-010** [MVP] — The system must limit its main temporal scope to the Mesozoic, between 252 Ma and 66 Ma.
- **CONS-020** [MVP] — The system must exclude species after the Cretaceous–Paleogene extinction, except in explanatory content explicitly marked as context.
- **CONS-030** [MVP] — The system must treat non-avian dinosaurs as the main scope.
- **CONS-040** [MVP] — The system must treat other Mesozoic reptiles as secondary scope.
- **CONS-050** [MVP] — The system must not cover all Mesozoic plants, invertebrates, mammals, fish or microorganisms in its main scope.
- **CONS-060** [MVP] — The system must display only taxa with at least one identifiable source.
- **CONS-070** [MVP] — The system must display only occurrences with at least one identifiable source.
- **CONS-080** [MVP] — The system must not display a numeric value for size, mass or age without a source or uncertainty indication.
- **CONS-090** [V1] — The system should limit secondary groups to a list explicitly defined in the interface or product documentation.
- **CONS-100** [MVP] — The system must avoid wording that implies secondary content has the same editorial status as dinosaurs.

### 2.2 Geographic representation

- **CONS-110** [MVP] — The system must distinguish modern coordinates from reconstructed paleogeographic coordinates.
- **CONS-120** [MVP] — The system must state that ancient maps are scientific reconstructions and not direct observations.
- **CONS-130** [MVP] — The system must not present fossil points as exact positions where the animal lived.
- **CONS-140** [MVP] — The system must present fossil points as documented discovery, collection or fossil observation locations.
- **CONS-150** [MVP] — The system must not automatically extrapolate a continuous distribution area from isolated fossil points.
- **CONS-160** [MVP] — The system must not display a complete distribution area unless that area is explicitly sourced.
- **CONS-170** [V1] — The system should display an uncertainty note when the geographic resolution of an occurrence is insufficient for the displayed map scale.
- **CONS-180** [MVP] — The system must use consistent geographic units throughout the interface.

### 2.3 Temporal representation

- **CONS-190** [MVP] — The system must represent geological ages in millions of years before present.
- **CONS-200** [MVP] — The system must display time ranges with a minimum boundary and a maximum boundary when both values are available.
- **CONS-210** [MVP] — The system must clearly indicate when a species is known from a broad time range.
- **CONS-220** [MVP] — The system must not present a species as present at a precise age when only a time range is available.
- **CONS-230** [MVP] — The system must not display two taxa as contemporaneous if their known time ranges do not overlap.
- **CONS-240** [V1] — The system should indicate the period, epoch or geological stage associated with a time range when this information is available.

### 2.4 Scientific consistency

- **CONS-250** [MVP] — The system must not display a taxon outside its known time range.
- **CONS-260** [MVP] — The system must not display an occurrence outside its known time range.
- **CONS-270** [MVP] — The system must not present a predator-prey relationship as certain without an explicit source.
- **CONS-280** [MVP] — The system must not present assumed behavior as an established fact.
- **CONS-290** [MVP] — The system must distinguish fossil facts, scientific estimates and hypotheses.
- **CONS-300** [MVP] — The system must indicate when a taxon is controversial, invalid, doubtful or synonymous when this information is available.
- **CONS-310** [V1] — The system should display an explanatory note when a taxon known to the public is not recognized as valid in the data used.

### 2.5 Editorial content

- **CONS-320** [MVP] — The system must use an informative, scientific and accessible tone.
- **CONS-330** [MVP] — The system must not use unverifiable sensationalist wording.
- **CONS-340** [MVP] — The system must avoid absolute claims when data is incomplete or uncertain.
- **CONS-350** [MVP] — The system must use scientific names as the primary reference for taxa.
- **CONS-360** [V1] — The system should use common names as reading aids when they are available.
- **CONS-370** [MVP] — The system must display units for numeric values, for example meters, kilograms or millions of years.
- **CONS-380** [V1] — The system should avoid an overly childish art direction in order to preserve a scientific atlas identity.

### 2.6 Sources and provenance

- **CONS-390** [MVP] — The system must associate each visible fossil occurrence with an identifiable source.
- **CONS-400** [MVP] — The system must associate each displayed time range with an identifiable source or dataset.
- **CONS-410** [MVP] — The system must associate each size or mass estimate with a source or uncertainty indication.
- **CONS-420** [MVP] — The system must distinguish a primary source, a database and an editorial synthesis when this information is available.
- **CONS-430** [V1] — The system should display the consultation or import date of an external source.
- **CONS-440** [MVP] — The system must not mix sourced data and unmarked assumptions in the same field.

### 2.7 Interface and usability

- **CONS-450** [MVP] — The system must keep the main time, map and filter controls visible on the exploration view.
- **CONS-460** [MVP] — The system must allow access to a taxon profile in a maximum of 2 actions from an occurrence visible on the map.
- **CONS-470** [MVP] — The system must allow the user to return to the map from a taxon profile in a maximum of 1 action.
- **CONS-480** [MVP] — The system must maintain consistent nomenclature for periods, groups and taxa throughout the interface.
- **CONS-490** [MVP] — The system must avoid hiding uncertainty information behind a secondary interaction when that information changes the scientific interpretation of the content.
- **CONS-500** [V1] — The system should allow the application to be used on desktop and tablet screens.
- **CONS-510** [V2] — The system should allow the application to be used on mobile phones without loss of the main features.

---

## 3. Performance

### 3.1 Response time

- **PERF-010** [MVP] — The system must display the main view in 5 seconds maximum after the initial load on a standard desktop connection.
- **PERF-020** [MVP] — The system must display the first useful content in 3 seconds maximum after the initial load.
- **PERF-030** [MVP] — The system must update visible occurrences in 1 second maximum after an age change when the required data is already loaded.
- **PERF-040** [MVP] — The system must open a taxon profile in 1 second maximum when the profile data is already loaded.
- **PERF-050** [MVP] — The system must display a loading indicator when a view update exceeds 500 milliseconds.
- **PERF-060** [MVP] — The system must provide visual feedback in 100 milliseconds maximum after a zoom or pan interaction on the map.
- **PERF-070** [V1] — The system should perform a simple text search in 500 milliseconds maximum when the required data is already loaded.

### 3.2 Readability and map density

- **PERF-080** [MVP] — The system must keep main labels readable at a minimum size of 12 CSS px.
- **PERF-090** [MVP] — The system must prevent more than 30 individual markers from visually overlapping in a 100 × 100 CSS px area without grouping.
- **PERF-100** [MVP] — The system must group occurrences into clusters when their density prevents reliable selection of individual points.
- **PERF-110** [MVP] — The system must display at least 3 zoom levels: global, regional and local.
- **PERF-120** [MVP] — The system must ensure that each displayed point or cluster is selectable with a minimum interactive area of 24 × 24 CSS px.
- **PERF-130** [V1] — The system should display taxon or formation names only when the zoom level allows them to be read without excessive overlap.

### 3.3 Minimum quality of visible data

- **PERF-140** [MVP] — The system must display an identifiable source for 100% of visible fossil occurrences.
- **PERF-150** [MVP] — The system must display a time range for 100% of visible fossil occurrences.
- **PERF-160** [MVP] — The system must display a minimum taxonomic classification for 100% of visible taxa.
- **PERF-170** [MVP] — The system must display at least one parent group above genus or species for 100% of visible taxa when this information is available.
- **PERF-180** [MVP] — The system must explicitly signal missing fields in 100% of affected taxon profiles.
- **PERF-190** [MVP] — The system must not display a taxon profile containing more than 20% silently empty fields.
- **PERF-200** [V1] — The system should display at least 50 detailed dinosaur profiles in the first enriched version.
- **PERF-210** [V1] — The system should display at least 10 featured species in the first enriched version.

### 3.4 Accessibility and usability

- **PERF-220** [MVP] — The system must allow the main view to be used with a mouse or trackpad.
- **PERF-230** [MVP] — The system must allow the main filters to be used with a keyboard.
- **PERF-240** [MVP] — The system must maintain sufficient contrast for main text to remain readable.
- **PERF-250** [MVP] — The system must display critical information without relying only on color.
- **PERF-260** [V1] — The system should provide alternative or descriptive text for species images when they are displayed.
- **PERF-270** [MVP] — The system must allow a point or cluster to be selected without requiring click precision below 24 × 24 CSS px.

### 3.5 Display robustness

- **PERF-280** [MVP] — The system must display a clear error message when map data cannot be loaded.
- **PERF-290** [MVP] — The system must display a clear error message when a taxon profile cannot be loaded.
- **PERF-300** [MVP] — The system must allow a failed load to be retried without reloading the entire application.
- **PERF-310** [MVP] — The system must preserve active filters after the loading failure of a profile, map or occurrence.
- **PERF-320** [MVP] — The system must display an empty state when active filters return no occurrence.
- **PERF-330** [MVP] — The system must display an empty state when search returns no result.

### 3.6 MVP functional validation

- **PERF-340** [MVP] — The system must allow the full scenario "select a period → filter dinosaurs → select an occurrence → open a taxon profile → return to the map" to be completed without a blocking error.
- **PERF-350** [MVP] — The system must allow the full scenario "search for a taxon → open its profile → display its occurrences on the map" to be completed without a blocking error.
- **PERF-360** [MVP] — The system must allow the full scenario "change the selected age → observe the change in visible occurrences" to be completed without a full application reload.
- **PERF-370** [MVP] — The system must allow the full scenario "activate a filter with no result → display an empty state → reset filters" to be completed without a blocking error.

---

## 4. MVP Scope Summary

The MVP must allow users to:

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

## 5. Explicitly Out of MVP Scope

The MVP does not need to include:

1. Continuous animation of continental drift.
2. A 3D globe view.
3. Side-by-side comparison between two periods.
4. A complete phylogeny.
5. Guided paths.
6. Complete coverage of all Mesozoic reptiles.
7. Complete coverage of all Mesozoic life.
8. Artistic reconstructions for all taxa.
9. Systematic predator-prey relationships.
10. Extrapolated distribution range maps.

The map is a 2-D paleogeographic view. The **3D globe view (item 2) is an explicit
product non-goal**, not merely a deferred feature: adding it would require a new
(V2) requirement. The remaining items are deferred to V1 or V2 as indicated by the
priorities in §§1–3.
