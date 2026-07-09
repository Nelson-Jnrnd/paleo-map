# Requirements Index

> Derived, searchable catalog of every requirement in the
> [functional specification](../product/functional-specification.md). It
> introduces no new requirements; summaries are abbreviations of the normative
> text. If a summary conflicts with the specification, the specification wins.
> IDs and priorities are canonical.

**Legend** — Priority: MVP / V1 / V2. Every ID here exists in the specification.
Verbs (must/should) are preserved in the source; the summaries drop them for
brevity.

## Features (`FONC-*`)

| ID | Priority | Section | Short summary |
| --- | --- | --- | --- |
| FONC-010 | MVP | Main exploration view | Provide a main view combining map, time control and filters. |
| FONC-020 | MVP | Main exploration view | Dinosaurs are the active category by default on first load. |
| FONC-030 | MVP | Main exploration view | Give access to an occurrence, a taxon page and a filter panel. |
| FONC-040 | MVP | Main exploration view | Permanently display the selected geological age. |
| FONC-050 | MVP | Main exploration view | Permanently display the selected taxonomic group. |
| FONC-060 | MVP | Main exploration view | Permanently display the count of visible occurrences. |
| FONC-070 | V1 | Main exploration view | Show a short textual summary of the current selection. |
| FONC-080 | MVP | Main exploration view | Allow active filters to be reset from the main view. |
| FONC-090 | MVP | Time exploration | Allow exploration of the 252–66 Ma interval. |
| FONC-100 | MVP | Time exploration | Divide the interval into Triassic, Jurassic, Cretaceous. |
| FONC-110 | MVP | Time exploration | Display the selected age in Ma. |
| FONC-120 | MVP | Time exploration | Change the selected age via a visible time control. |
| FONC-130 | MVP | Time exploration | Update the map when the selected age changes. |
| FONC-140 | MVP | Time exploration | Update visible occurrences when the selected age changes. |
| FONC-150 | MVP | Time exploration | Show an occurrence only when the age overlaps its time range. |
| FONC-160 | MVP | Time exploration | Show a taxon only when the age overlaps its time range. |
| FONC-170 | MVP | Time exploration | Visually distinguish a precise age from a time range. |
| FONC-180 | V1 | Time exploration | Show the geological stage for the selected age when available. |
| FONC-190 | V1 | Time exploration | Allow quick selection of a complete period. |
| FONC-200 | V2 | Time exploration | Compare two geological ages side by side. |
| FONC-210 | MVP | Paleogeographic map | Display a world map for the selected age. |
| FONC-220 | MVP | Paleogeographic map | Show approximate continental positions for the age. |
| FONC-230 | MVP | Paleogeographic map | Display occurrences as points or grouped points. |
| FONC-240 | MVP | Paleogeographic map | Distinguish individual occurrences from groups. |
| FONC-250 | MVP | Paleogeographic map | Allow the user to zoom the map. |
| FONC-260 | MVP | Paleogeographic map | Allow the user to pan the map horizontally and vertically. |
| FONC-270 | MVP | Paleogeographic map | Allow a displayed occurrence to be selected. |
| FONC-280 | MVP | Paleogeographic map | Show an information panel when an occurrence is selected. |
| FONC-290 | MVP | Paleogeographic map | Panel shows taxon, time range, modern & paleo position, source. |
| FONC-300 | MVP | Paleogeographic map | Clearly indicate the map is a paleogeographic reconstruction. |
| FONC-310 | V1 | Paleogeographic map | Allow a present-day continents comparison layer. |
| FONC-320 | V1 | Paleogeographic map | Allow occurrence display to be toggled on/off. |
| FONC-330 | V2 | Paleogeographic map | Animate the map transition between two ages. |
| FONC-340 | MVP | Scope of groups | Treat non-avian dinosaurs as the main content. |
| FONC-350 | MVP | Scope of groups | Allow only non-avian dinosaurs to be displayed. |
| FONC-360 | MVP | Scope of groups | Distinguish dinosaurs from other included Mesozoic reptiles. |
| FONC-370 | MVP | Scope of groups | Cover major dinosaur groups when data is available. |
| FONC-380 | V1 | Scope of groups | Include selected secondary reptile groups. |
| FONC-390 | V1 | Scope of groups | Allow only included secondary groups to be displayed. |
| FONC-400 | MVP | Scope of groups | Do not present the app as a complete atlas of all Mesozoic life. |
| FONC-410 | MVP | Scope of groups | Indicate whether a taxon is main or secondary content. |
| FONC-420 | V1 | Scope of groups | Allow secondary groups to be hidden. |
| FONC-430 | MVP | Content levels | Classify each displayed taxon by content level. |
| FONC-440 | MVP | Content levels | Support an "Occurrence only" level. |
| FONC-450 | MVP | Content levels | Support a "Short profile" level. |
| FONC-460 | V1 | Content levels | Support a "Detailed profile" level. |
| FONC-470 | V1 | Content levels | Support a "Featured species" level. |
| FONC-480 | MVP | Content levels | Clearly indicate when a taxon profile is incomplete. |
| FONC-490 | MVP | Content levels | Show unavailable fields with an explicit label, not blank. |
| FONC-500 | V1 | Content levels | Filter or sort taxa by content level. |
| FONC-510 | MVP | Taxon profile | Provide a profile for each selectable taxon. |
| FONC-520 | MVP | Taxon profile | Display the scientific name on the profile. |
| FONC-530 | MVP | Taxon profile | Display the taxonomic rank on the profile. |
| FONC-540 | MVP | Taxon profile | Display the available taxonomic classification. |
| FONC-550 | MVP | Taxon profile | Display the known time range of the taxon. |
| FONC-560 | MVP | Taxon profile | Display the known fossil occurrences of the taxon. |
| FONC-570 | MVP | Taxon profile | Display the modern discovery locations. |
| FONC-580 | MVP | Taxon profile | Display the reconstructed paleogeographic positions. |
| FONC-590 | MVP | Taxon profile | Display the sources used for main profile information. |
| FONC-600 | V1 | Taxon profile | Display assumed diet when available. |
| FONC-610 | V1 | Taxon profile | Display assumed locomotion mode when available. |
| FONC-620 | V1 | Taxon profile | Display estimated length when available. |
| FONC-630 | V1 | Taxon profile | Display estimated mass when available. |
| FONC-640 | V1 | Taxon profile | Display a short summary for detailed/featured taxa. |
| FONC-650 | V1 | Taxon profile | Display related taxa when available. |
| FONC-660 | V1 | Taxon profile | Display taxa from the same formation/region and overlapping time. |
| FONC-670 | MVP | Taxon profile | Indicate when information is interpretative, not fossil-derived. |
| FONC-680 | MVP | Classification | Allow taxa to be explored by taxonomic group. |
| FONC-690 | MVP | Classification | Display the taxonomic hierarchy of a selected taxon. |
| FONC-700 | MVP | Classification | Select a group and update the map accordingly. |
| FONC-710 | MVP | Classification | Distinguish taxonomic levels (clade, family, genus, species). |
| FONC-720 | MVP | Classification | Flag invalid/doubtful/synonymous/uncertain taxa when known. |
| FONC-730 | V1 | Classification | Navigate from a species to its parent groups. |
| FONC-740 | V1 | Classification | Navigate from a group to its genera or species. |
| FONC-750 | V1 | Classification | Filter the map from a selection in the taxonomic tree. |
| FONC-760 | MVP | Search & filters | Search a taxon by scientific name. |
| FONC-770 | V1 | Search & filters | Search a taxon by common/popular name when available. |
| FONC-780 | MVP | Search & filters | Filter occurrences by geological period. |
| FONC-790 | MVP | Search & filters | Filter occurrences by taxonomic group. |
| FONC-800 | MVP | Search & filters | Filter to display only non-avian dinosaurs. |
| FONC-810 | V1 | Search & filters | Filter occurrences by diet. |
| FONC-820 | V1 | Search & filters | Filter occurrences by modern discovery region. |
| FONC-830 | V1 | Search & filters | Filter occurrences by taxon content level. |
| FONC-840 | V1 | Search & filters | Filter by data completeness or reliability level. |
| FONC-850 | MVP | Search & filters | Display the number of results matching active filters. |
| FONC-860 | MVP | Search & filters | Show an explicit empty state when no result matches. |
| FONC-870 | MVP | Search & filters | Remove an active filter individually. |
| FONC-880 | MVP | Search & filters | Remove all active filters in a single action. |
| FONC-890 | MVP | Occurrences & formations | Provide a panel/profile for each selected occurrence. |
| FONC-900 | MVP | Occurrences & formations | Display the modern location of an occurrence when available. |
| FONC-910 | MVP | Occurrences & formations | Display the reconstructed paleo position when available. |
| FONC-920 | MVP | Occurrences & formations | Display the time range of an occurrence. |
| FONC-930 | MVP | Occurrences & formations | Display the source of an occurrence. |
| FONC-940 | V1 | Occurrences & formations | Display the formation name of an occurrence when available. |
| FONC-950 | V1 | Occurrences & formations | Provide a profile for a selected geological formation. |
| FONC-960 | V1 | Occurrences & formations | Display taxa known from a selected formation. |
| FONC-970 | V1 | Occurrences & formations | Display the age/time range of a formation when available. |
| FONC-980 | V1 | Occurrences & formations | Compare modern vs paleo position of a location. |
| FONC-990 | MVP | Navigation | Open a taxon profile from a selected occurrence. |
| FONC-1000 | MVP | Navigation | Return to the map from a taxon profile. |
| FONC-1010 | MVP | Navigation | Preserve the selected age when navigating to a profile. |
| FONC-1020 | MVP | Navigation | Preserve active filters when navigating to a profile. |
| FONC-1030 | V1 | Navigation | Open a formation profile from a selected occurrence. |
| FONC-1040 | V1 | Navigation | Open a taxon profile from a formation profile. |
| FONC-1050 | V1 | Navigation | Open a related taxon profile from a taxon profile. |
| FONC-1060 | V1 | Navigation | Return to the previous search result after a profile. |
| FONC-1070 | MVP | Navigation | Reach a taxon profile in ≤2 actions from a visible occurrence. |
| FONC-1080 | MVP | Navigation | Return to the map in ≤1 action from a taxon profile. |
| FONC-1090 | MVP | Sources & uncertainty | Display the sources of the scientific data used. |
| FONC-1100 | MVP | Sources & uncertainty | Display an identifiable source per visible occurrence. |
| FONC-1110 | MVP | Sources & uncertainty | Distinguish fossil-derived data from interpretative data. |
| FONC-1120 | MVP | Sources & uncertainty | Indicate missing info instead of an unmarked assumption. |
| FONC-1130 | MVP | Sources & uncertainty | Indicate when a geographic position is reconstructed. |
| FONC-1140 | MVP | Sources & uncertainty | Indicate when a time range is approximate. |
| FONC-1150 | MVP | Sources & uncertainty | Show occurrences as discovery evidence, not distribution. |
| FONC-1160 | V1 | Sources & uncertainty | Show a confidence level for interpretative info when available. |
| FONC-1170 | V1 | Sources & uncertainty | Show the consultation/import date of data when available. |
| FONC-1180 | V1 | Sources & uncertainty | Show a link to the external source when available. |
| FONC-1190 | V1 | Images | Show an image for detailed/featured taxa when available. |
| FONC-1200 | V1 | Images | Distinguish fossil photo, artistic reconstruction, silhouette. |
| FONC-1210 | V1 | Images | Display the source/credit for an image when shown. |
| FONC-1220 | V1 | Images | Indicate when an image is an artistic representation. |
| FONC-1230 | V1 | Images | Do not present art as evidence of exact appearance. |
| FONC-1240 | MVP | Images | Show an alternative state when no image is available. |
| FONC-1250 | V2 | Images | Compare animal size with a human reference when available. |
| FONC-1260 | MVP | Interface states | Show a loading state while the map initially loads. |
| FONC-1270 | MVP | Interface states | Show a loading state when opening a not-yet-available profile. |
| FONC-1280 | MVP | Interface states | Show an empty state when filters return no occurrence. |
| FONC-1290 | MVP | Interface states | Show an empty state when a search returns no taxon. |
| FONC-1300 | MVP | Interface states | Show a message when a profile exists but has minimal data. |
| FONC-1310 | MVP | Interface states | Show a clear error when a map cannot be loaded. |
| FONC-1320 | MVP | Interface states | Show a clear error when a taxon profile cannot be loaded. |
| FONC-1330 | MVP | Interface states | Allow a failed load to be retried. |
| FONC-1340 | MVP | Interface states | Preserve active filters after a loading failure. |
| FONC-1350 | V2 | Comparison & guided paths | Compare two geological periods in a dedicated view. |
| FONC-1360 | V2 | Comparison & guided paths | Compare two taxonomic groups in a dedicated view. |
| FONC-1370 | V1 | Comparison & guided paths | Display a timeline for a selected taxon. |
| FONC-1380 | V1 | Comparison & guided paths | Show a taxon's first and last appearance on a timeline. |
| FONC-1390 | V2 | Comparison & guided paths | Select a region and list its taxa for the selected age. |
| FONC-1400 | V2 | Comparison & guided paths | Provide thematic guided paths. |
| FONC-1410 | V2 | Comparison & guided paths | Provide a guided path on large theropods. |
| FONC-1420 | V2 | Comparison & guided paths | Provide a guided path on Jurassic dinosaurs. |
| FONC-1430 | V2 | Comparison & guided paths | Provide a guided path on Late Cretaceous dinosaurs. |

## Constraints (`CONS-*`)

| ID | Priority | Section | Short summary |
| --- | --- | --- | --- |
| CONS-010 | MVP | Scientific scope | Limit main temporal scope to the Mesozoic (252–66 Ma). |
| CONS-020 | MVP | Scientific scope | Exclude post-K–Pg species except as marked context. |
| CONS-030 | MVP | Scientific scope | Treat non-avian dinosaurs as the main scope. |
| CONS-040 | MVP | Scientific scope | Treat other Mesozoic reptiles as secondary scope. |
| CONS-050 | MVP | Scientific scope | Do not cover all Mesozoic non-reptile life in main scope. |
| CONS-060 | MVP | Scientific scope | Display only taxa with an identifiable source. |
| CONS-070 | MVP | Scientific scope | Display only occurrences with an identifiable source. |
| CONS-080 | MVP | Scientific scope | No size/mass/age value without source or uncertainty. |
| CONS-090 | V1 | Scientific scope | Limit secondary groups to an explicitly defined list. |
| CONS-100 | MVP | Scientific scope | Avoid wording equating secondary content with dinosaurs. |
| CONS-110 | MVP | Geographic representation | Distinguish modern from reconstructed coordinates. |
| CONS-120 | MVP | Geographic representation | State ancient maps are reconstructions, not observations. |
| CONS-130 | MVP | Geographic representation | Do not present fossil points as exact life positions. |
| CONS-140 | MVP | Geographic representation | Present fossil points as discovery/collection locations. |
| CONS-150 | MVP | Geographic representation | Do not extrapolate continuous distribution from points. |
| CONS-160 | MVP | Geographic representation | No complete distribution area unless explicitly sourced. |
| CONS-170 | V1 | Geographic representation | Note insufficient geographic resolution for the map scale. |
| CONS-180 | MVP | Geographic representation | Use consistent geographic units throughout. |
| CONS-190 | MVP | Temporal representation | Represent ages in millions of years before present. |
| CONS-200 | MVP | Temporal representation | Show time ranges with min and max boundaries when available. |
| CONS-210 | MVP | Temporal representation | Clearly indicate a broad time range. |
| CONS-220 | MVP | Temporal representation | Do not present a range as a precise age. |
| CONS-230 | MVP | Temporal representation | Do not show non-overlapping taxa as contemporaneous. |
| CONS-240 | V1 | Temporal representation | Indicate period/epoch/stage for a time range when available. |
| CONS-250 | MVP | Scientific consistency | Do not display a taxon outside its known time range. |
| CONS-260 | MVP | Scientific consistency | Do not display an occurrence outside its known time range. |
| CONS-270 | MVP | Scientific consistency | No predator-prey relationship as certain without a source. |
| CONS-280 | MVP | Scientific consistency | Do not present assumed behavior as established fact. |
| CONS-290 | MVP | Scientific consistency | Distinguish facts, estimates and hypotheses. |
| CONS-300 | MVP | Scientific consistency | Flag controversial/invalid/doubtful/synonymous taxa when known. |
| CONS-310 | V1 | Scientific consistency | Note when a well-known taxon is not valid in the data used. |
| CONS-320 | MVP | Editorial content | Use an informative, scientific, accessible tone. |
| CONS-330 | MVP | Editorial content | Avoid unverifiable sensationalist wording. |
| CONS-340 | MVP | Editorial content | Avoid absolute claims under incomplete/uncertain data. |
| CONS-350 | MVP | Editorial content | Use scientific names as the primary reference. |
| CONS-360 | V1 | Editorial content | Use common names as reading aids when available. |
| CONS-370 | MVP | Editorial content | Display units for numeric values. |
| CONS-380 | V1 | Editorial content | Avoid an overly childish art direction. |
| CONS-390 | MVP | Sources & provenance | Associate each visible occurrence with an identifiable source. |
| CONS-400 | MVP | Sources & provenance | Associate each time range with a source or dataset. |
| CONS-410 | MVP | Sources & provenance | Associate each size/mass estimate with source or uncertainty. |
| CONS-420 | MVP | Sources & provenance | Distinguish primary source, database and editorial synthesis. |
| CONS-430 | V1 | Sources & provenance | Show the consultation/import date of an external source. |
| CONS-440 | MVP | Sources & provenance | Do not mix sourced data and unmarked assumptions in a field. |
| CONS-450 | MVP | Interface & usability | Keep time, map and filter controls visible on the main view. |
| CONS-460 | MVP | Interface & usability | Reach a taxon profile in ≤2 actions from a visible occurrence. |
| CONS-470 | MVP | Interface & usability | Return to the map in ≤1 action from a taxon profile. |
| CONS-480 | MVP | Interface & usability | Keep nomenclature consistent for periods, groups, taxa. |
| CONS-490 | MVP | Interface & usability | Do not hide interpretation-changing uncertainty behind extra steps. |
| CONS-500 | V1 | Interface & usability | Support desktop and tablet screens. |
| CONS-510 | V2 | Interface & usability | Support mobile phones without loss of main features. |

## Performance (`PERF-*`)

| ID | Priority | Section | Short summary |
| --- | --- | --- | --- |
| PERF-010 | MVP | Response time | Display the main view within 5 s after initial load. |
| PERF-020 | MVP | Response time | Display first useful content within 3 s after initial load. |
| PERF-030 | MVP | Response time | Update visible occurrences within 1 s after an age change (data loaded). |
| PERF-040 | MVP | Response time | Open a taxon profile within 1 s when data is already loaded. |
| PERF-050 | MVP | Response time | Show a loading indicator when an update exceeds 500 ms. |
| PERF-060 | MVP | Response time | Give visual feedback within 100 ms after zoom/pan. |
| PERF-070 | V1 | Response time | Perform a simple text search within 500 ms (data loaded). |
| PERF-080 | MVP | Readability & density | Keep main labels readable at ≥12 CSS px. |
| PERF-090 | MVP | Readability & density | Prevent >30 markers overlapping in 100×100 px without grouping. |
| PERF-100 | MVP | Readability & density | Cluster occurrences when density blocks reliable selection. |
| PERF-110 | MVP | Readability & density | Provide ≥3 zoom levels: global, regional, local. |
| PERF-120 | MVP | Readability & density | Make each point/cluster selectable at ≥24×24 CSS px. |
| PERF-130 | V1 | Readability & density | Show names only when zoom avoids excessive overlap. |
| PERF-140 | MVP | Visible data quality | Show a source for 100% of visible occurrences. |
| PERF-150 | MVP | Visible data quality | Show a time range for 100% of visible occurrences. |
| PERF-160 | MVP | Visible data quality | Show minimum classification for 100% of visible taxa. |
| PERF-170 | MVP | Visible data quality | Show ≥1 parent group above genus/species for 100% of taxa when available. |
| PERF-180 | MVP | Visible data quality | Explicitly signal missing fields in 100% of affected profiles. |
| PERF-190 | MVP | Visible data quality | No profile with >20% silently empty fields. |
| PERF-200 | V1 | Visible data quality | Provide ≥50 detailed dinosaur profiles in first enriched version. |
| PERF-210 | V1 | Visible data quality | Provide ≥10 featured species in first enriched version. |
| PERF-220 | MVP | Accessibility | Allow the main view to be used with a mouse or trackpad. |
| PERF-230 | MVP | Accessibility | Allow the main filters to be used with a keyboard. |
| PERF-240 | MVP | Accessibility | Maintain sufficient contrast for main text. |
| PERF-250 | MVP | Accessibility | Convey critical information without relying only on color. |
| PERF-260 | V1 | Accessibility | Provide alternative/descriptive text for species images. |
| PERF-270 | MVP | Accessibility | Allow selection without precision below 24×24 CSS px. |
| PERF-280 | MVP | Display robustness | Show a clear error when map data cannot be loaded. |
| PERF-290 | MVP | Display robustness | Show a clear error when a profile cannot be loaded. |
| PERF-300 | MVP | Display robustness | Allow retry of a failed load without full app reload. |
| PERF-310 | MVP | Display robustness | Preserve active filters after a load failure. |
| PERF-320 | MVP | Display robustness | Show an empty state when filters return no occurrence. |
| PERF-330 | MVP | Display robustness | Show an empty state when search returns no result. |
| PERF-340 | MVP | MVP validation | Complete the period→filter→occurrence→profile→map scenario. |
| PERF-350 | MVP | MVP validation | Complete the search→profile→occurrences-on-map scenario. |
| PERF-360 | MVP | MVP validation | Complete the age-change→occurrence-update scenario without full reload. |
| PERF-370 | MVP | MVP validation | Complete the empty-filter→empty-state→reset scenario. |
