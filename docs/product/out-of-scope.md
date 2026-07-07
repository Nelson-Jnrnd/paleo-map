# Out of Scope

> Derived document. It reorganizes scope boundaries from the
> [functional specification](functional-specification.md). It introduces no new
> requirements. If it conflicts with the specification, the specification wins.

This page separates four kinds of "not now / not ever":

1. **Out of MVP but possible later** — planned as V1 or V2.
2. **Explicitly not part of the product scope** — the product deliberately does
   not do this.
3. **Scientific limitations** — boundaries on the science the product represents.
4. **Representation limitations** — boundaries on how data may be displayed.

---

## 1. Out of MVP but possible later

These are deferred, not rejected. They carry a **[V1]** or **[V2]** priority in
the specification.

### Explicitly listed as out of MVP (specification §5)

| Item | Where it returns |
| ---- | ---------------- |
| Continuous animation of continental drift | FONC-330 [V2] |
| A 3D globe view | Not currently a requirement — see [open questions](open-questions.md) (OQ-010) |
| Side-by-side comparison between two periods | FONC-200 [V2], FONC-1350 [V2] |
| A complete phylogeny | Partial navigation only: FONC-730/FONC-740 [V1] |
| Guided paths | FONC-1400…FONC-1430 [V2] |
| Complete coverage of all Mesozoic reptiles | Secondary groups: FONC-380 [V1] (selected groups only) |
| Complete coverage of all Mesozoic life | Explicitly excluded (see §2 below) |
| Artistic reconstructions for all taxa | Images for detailed/featured taxa only: FONC-1190 [V1] |
| Systematic predator-prey relationships | Only if sourced: CONS-270 [MVP forbids unsourced] |
| Extrapolated distribution range maps | Only if explicitly sourced: CONS-160 [MVP forbids otherwise] |

### V1 enhancements (desirable, not required for MVP)

- **Exploration view:** textual selection summary (FONC-070).
- **Time:** geological stage for selected age (FONC-180); quick period selection
  (FONC-190).
- **Map:** present-day comparison layer (FONC-310); toggle occurrence display
  (FONC-320).
- **Groups:** selected secondary groups and their display/hiding (FONC-380,
  FONC-390, FONC-420).
- **Content levels:** Detailed profile and Featured species levels (FONC-460,
  FONC-470); filter/sort by content level (FONC-500).
- **Taxon profile:** diet, locomotion, length, mass, descriptive summary, related
  taxa, co-occurring taxa (FONC-600…FONC-660).
- **Taxonomy:** navigation up/down the tree and map filtering from the tree
  (FONC-730, FONC-740, FONC-750).
- **Search/filters:** common-name search; filters by diet, region, content level,
  reliability (FONC-770, FONC-810…FONC-840).
- **Formations:** formation names, formation profiles, taxa per formation,
  formation age, modern vs paleo comparison (FONC-940…FONC-980).
- **Navigation:** formation-related navigation, related-taxon navigation, return
  to search results (FONC-1030…FONC-1060).
- **Provenance:** confidence levels, consultation dates, external links
  (FONC-1160, FONC-1170, FONC-1180).
- **Images:** illustrations with type/credit/artistic labeling (FONC-1190…
  FONC-1230), alt text (PERF-260).
- **Timelines:** per-taxon timeline and first/last appearance (FONC-1370,
  FONC-1380).
- **Data volume targets:** ≥50 detailed profiles, ≥10 featured species
  (PERF-200, PERF-210).
- **Usability:** desktop + tablet support (CONS-500).

### V2 enhancements (later)

- Side-by-side age/period comparison (FONC-200, FONC-1350); group comparison
  (FONC-1360).
- Animated age-to-age map transition (FONC-330).
- Human size reference (FONC-1250).
- Region selection to list taxa for an age (FONC-1390).
- Thematic guided paths, including large theropods, Jurassic dinosaurs, and Late
  Cretaceous dinosaurs (FONC-1400…FONC-1430).
- Mobile-phone support without loss of main features (CONS-510).

---

## 2. Explicitly not part of the product scope

These are deliberate product boundaries, not deferrals.

- The system must **not** present the application as a complete atlas of all
  Mesozoic life (FONC-400).
- The main scope excludes all Mesozoic plants, invertebrates, mammals, fish, and
  microorganisms (CONS-050).
- Species after the Cretaceous–Paleogene extinction are excluded, except in
  explanatory content explicitly marked as context (CONS-020).
- Non-avian dinosaurs are the main scope; other Mesozoic reptiles are only
  secondary scope, limited to an explicitly defined list (CONS-030, CONS-040,
  CONS-090).
- Wording must not imply that secondary content has the same editorial status as
  dinosaurs (CONS-100).

---

## 3. Scientific limitations

Boundaries the product places on the science it represents:

- No taxon or occurrence shown outside its known time range (CONS-250, CONS-260).
- No two taxa shown as contemporaneous unless their time ranges overlap
  (CONS-230).
- No species shown as present at a precise age when only a range is known
  (CONS-220).
- No predator-prey relationship presented as certain without an explicit source
  (CONS-270); no assumed behavior presented as fact (CONS-280).
- Fossil facts, scientific estimates, and hypotheses must be distinguished
  (CONS-290).
- No numeric size/mass/age value without a source or uncertainty indication
  (CONS-080); no size/mass estimate without source or uncertainty (CONS-410).
- Only taxa and occurrences with at least one identifiable source are displayed
  (CONS-060, CONS-070).
- Controversial/invalid/doubtful/synonymous taxa must be flagged when known
  (CONS-300).

---

## 4. Representation limitations

Boundaries on how data may be displayed:

- Fossil points are **discovery evidence**, not exact life positions
  (CONS-130, CONS-140); shown as discovery evidence, not distribution boundaries
  (FONC-1150).
- No continuous distribution area extrapolated from isolated points (CONS-150);
  no complete distribution area unless explicitly sourced (CONS-160).
- Ancient maps must be labeled as scientific reconstructions, not direct
  observations (CONS-120, FONC-300); reconstructed positions must be marked
  (FONC-1130).
- Approximate time ranges must be marked as approximate (FONC-1140); broad time
  ranges must be indicated clearly (CONS-210).
- Modern coordinates must be distinguished from reconstructed paleogeographic
  coordinates (CONS-110).
- Missing information must be marked, never replaced by an unmarked assumption
  (FONC-1120, CONS-440); missing profile fields must be explicitly signalled
  (FONC-490, PERF-180).
- Artistic illustrations must not be presented as direct evidence of exact
  appearance (FONC-1230); images must be typed and credited (FONC-1200,
  FONC-1210, FONC-1220).
- Editorial tone must avoid sensationalism and absolute claims under uncertainty,
  and avoid an overly childish art direction (CONS-330, CONS-340, CONS-380).
