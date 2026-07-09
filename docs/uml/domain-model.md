# Domain / Data Class Models

The data-layer class models are **canonical in the
[data architecture design](../design/data-model.md)**, where they are typed and
use composition/aggregation, and where the sourcing and provenance rules that
shape them are explained. This page is a thin index so there is a single source of
truth per model.

> An earlier draft of this page carried a naïve domain sketch with intrinsic
> `validity` / `evidence` / `uncertainty` enums. That was superseded: those values
> are not intrinsic — they are sourced assertions or derived flags. See the design
> doc for the corrected models.

## Where each model lives (all in `../design/data-model.md`)

| Model | Covers | Requirements |
| --- | --- | --- |
| Provenance & assertion | `Source` (kind + `derivedFrom` chain), `Assertion`, `ConfidenceLevel`, derived `ProvenanceView` | FONC-1090…1150, CONS-390…440 |
| Taxonomy & validity (opinion-based) | `Taxon`, `TaxonName`, `TaxonomicOpinion`, `TaxonomicGroup`, ranks/scope | FONC-680…720, FONC-340…410, CONS-300/310 |
| Occurrences, collections & geography | `FossilOccurrence`, `Identification`, `Collection`, modern/paleo positions, `TimeRange` | FONC-230, FONC-290, FONC-890…930, CONS-110…160 |
| Geological time | `GeologicalTimescale`, `GeologicalPeriod`, `GeologicalStage`, `SelectedAge` | FONC-090…170, CONS-190…240 |
| Taxon profile & media | `TaxonProfile`, sourced `BiologyAttribute`/`Measurement`, `ImageAsset`, `ContentLevel` | FONC-430…670, FONC-1190…1240 |
| Application & view model | `ExplorationView` and its parts, `FilterSet`, `Selection`, `ViewState` | FONC-010…080, FONC-1010/1020, FONC-1260…1340 |

## Key modelling decisions (summary)

- **Validity is a `TaxonomicOpinion`**, not an attribute — a claim by a reference at
  a date; the accepted status is derived and shown with its citation.
- **Reconstructed / approximate / interpretative / missing are derived**
  (`ProvenanceView`, `«derived»`), computed from structure — never stored.
- **Biology is structured, sourced and nullable** (`Measurement`/`BiologyAttribute`
  with bounds + `Source`), with sparsity handled by the content-level ladder and
  the explicit "not available" rule.
- **Provenance is a structural invariant** — every displayed value resolves to a
  `Source` (PBDB / primary / Wikipedia-encyclopedic / editorial) or is marked
  editorial.

See [`../design/data-model.md`](../design/data-model.md) for the full diagrams,
the three data tiers, and the ingestion pipeline.
