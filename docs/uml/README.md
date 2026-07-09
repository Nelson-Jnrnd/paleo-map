# UML Diagrams

This folder holds the project's UML diagrams as **Mermaid** embedded directly in
Markdown, so they render inline on GitHub and stay diff-friendly. No separate
source/export step is required.

These pages introduce no requirements. Every diagram traces back to requirement
IDs from the
[functional specification](../product/functional-specification.md).

## Where the diagrams live

| Diagram kind | Page / source |
| --- | --- |
| Use case | [`use-case-diagram.md`](use-case-diagram.md) |
| Activity (exploration, filters, occurrence→profile) | [`activity-diagrams.md`](activity-diagrams.md) |
| State (map, taxon profile, filters) | [`state-diagrams.md`](state-diagrams.md) |
| Sequence (occurrence→profile, search→map) | [`sequence-diagrams.md`](sequence-diagrams.md) |
| Domain / data class models (typed, composition/aggregation) | [`domain-model.md`](domain-model.md) → [`../design/data-model.md`](../design/data-model.md) |

The **behavioural** diagrams (use case / activity / state / sequence) are
canonical here. The **data-layer class models** are canonical in the
[data architecture design](../design/data-model.md); `domain-model.md` is a thin
index into them so there is a single source of truth per diagram.

## Convention: Mermaid

- Diagrams are authored as ```` ```mermaid ```` fenced blocks inside these pages.
- GitHub renders them inline; the specification PDF renders the **same** blocks
  (the build reads them straight from these files — see `tools/spec-pdf/`).
- A block that the PDF places in a specific spec section is preceded by an HTML
  comment marker the build reads, e.g.
  `<!-- pdf-fig: usecase | Use case diagram — Explorer and the top-level use cases -->`.
  GitHub ignores the comment.

## How diagrams reference requirement IDs

1. Each page lists the related requirement IDs (`FONC-*`, `CONS-*`, `PERF-*`).
2. The [traceability matrix](../requirements/requirements-traceability.md) names
   these diagrams in its "Related UML diagram" column.

## Product-facing scope

Diagrams stay product-facing (Explorer + the interface). Data-layer models
additionally reflect the sourcing/provenance design in
[`../design/data-model.md`](../design/data-model.md).
