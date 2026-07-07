# UML Diagrams

This folder holds **diagram pages**: context, actors, expected content,
requirement links, and TODO lists for each UML diagram. The **diagram source
files** live separately under [`../assets/uml/`](../assets/uml/), and rendered
images (if committed) under the same folder.

These pages introduce no requirements. Every diagram must trace back to
requirement IDs from the
[functional specification](../product/functional-specification.md).

## Diagram convention: PlantUML

This project uses **PlantUML** for UML diagrams. (Mermaid is used elsewhere for
lightweight inline sketches, but authored UML diagrams are PlantUML `.puml`
files so they can be versioned and rendered consistently.) Choose one convention
per diagram and do not mix.

- Source files: `docs/assets/uml/<name>.puml`
- Optional rendered output committed alongside: `docs/assets/uml/<name>.svg` (or
  `.png`).
- Each diagram page embeds or links its source once it exists.

## Expected diagrams

| Diagram | Page | Source file (planned) |
| --- | --- | --- |
| Use case overview | [`use-case-diagram.md`](use-case-diagram.md) | `docs/assets/uml/use-case-overview.puml` |
| Domain model | [`domain-model.md`](domain-model.md) | `docs/assets/uml/domain-model.puml` |
| Activity diagrams | [`activity-diagrams.md`](activity-diagrams.md) | `docs/assets/uml/exploration-flow.puml`, `docs/assets/uml/taxon-profile-flow.puml`, and others below |
| State diagrams | [`state-diagrams.md`](state-diagrams.md) | `docs/assets/uml/*-state.puml` |
| Sequence diagrams | [`sequence-diagrams.md`](sequence-diagrams.md) | `docs/assets/uml/*-sequence.puml` |

## Naming convention

- Lowercase, hyphen-separated, descriptive: `use-case-overview.puml`,
  `domain-model.puml`, `exploration-flow.puml`, `taxon-profile-flow.puml`,
  `age-change-flow.puml`, `filter-application-flow.puml`,
  `occurrence-selection-flow.puml`, `empty-state-flow.puml`.
- State diagrams end with `-state`: `map-loading-state.puml`,
  `taxon-profile-loading-state.puml`, `search-state.puml`, `filter-state.puml`.
- Sequence diagrams end with `-sequence`:
  `occurrence-to-profile-sequence.puml`, `search-to-map-sequence.puml`.

## How diagrams reference requirement IDs

Every diagram must be traceable to the specification:

1. The diagram **page** lists the related requirement IDs (`FONC-*`, `CONS-*`,
   `PERF-*`) in a "Related requirements" section.
2. Inside the `.puml` source, add requirement IDs as notes or comments, e.g.
   `note right: FONC-270, FONC-280`.
3. Keep the [traceability matrix](../requirements/requirements-traceability.md)
   in sync — its "Related UML diagram" column names these diagrams.

## Product-facing scope

Diagrams stay **product-facing**. Do not assume a backend, database, or API
architecture that the specification has not defined — the repository currently
contains no application code. Model user-visible behavior and domain concepts,
not implementation internals.

## Status

All diagrams are **planned**. These pages define structure; the `.puml` sources
are TODO. See each page's TODO list.
