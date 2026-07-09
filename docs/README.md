# Documentation

Entry point for the **Interactive Mesozoic Dinosaur Atlas** documentation.

This folder holds the product documentation, requirements, and the structure for
future UML diagrams and UI mockups. It complements the specification-first
workflow described in [`../CLAUDE.md`](../CLAUDE.md) and
[`../AGENTS.md`](../AGENTS.md). The repository is the single source of truth.

## What the project is

A map-first exploration tool for **non-avian dinosaurs** of the Mesozoic era
(≈252–66 Ma). It combines a paleogeographic map, a geological time control, and
taxonomy so that users can explore where and when dinosaurs are known from
fossil evidence. Other Mesozoic reptiles are secondary content. See
[`product/vision.md`](product/vision.md).

## Where things live

| Topic | Location |
| ----- | -------- |
| Product vision | [`product/vision.md`](product/vision.md) |
| **Functional specification (source of truth for product requirements)** | [`product/functional-specification.md`](product/functional-specification.md) |
| MVP scope | [`product/mvp-scope.md`](product/mvp-scope.md) |
| Out-of-scope items | [`product/out-of-scope.md`](product/out-of-scope.md) |
| Glossary | [`product/glossary.md`](product/glossary.md) |
| Open questions | [`product/open-questions.md`](product/open-questions.md) |
| Requirements index | [`requirements/requirements-index.md`](requirements/requirements-index.md) |
| Requirements traceability | [`requirements/requirements-traceability.md`](requirements/requirements-traceability.md) |
| Acceptance criteria | [`requirements/acceptance-criteria.md`](requirements/acceptance-criteria.md) |
| UML diagrams (pages + conventions) | [`uml/README.md`](uml/README.md) |
| UI mockups (pages + conventions) | [`mockups/README.md`](mockups/README.md) |
| **UI design charter (binding on all UI work)** | [`mockups/design-guidelines.md`](mockups/design-guidelines.md) |
| Data architecture & model (technical design) | [`design/data-model.md`](design/data-model.md) |
| Diagram / mockup binary assets | [`assets/`](assets/) |

## Where to add UML diagrams

Diagram **pages** (context, actors, requirement links, TODOs) live in
[`uml/`](uml/). Diagram **source files** (PlantUML `.puml`) live in
[`assets/uml/`](assets/uml/). See [`uml/README.md`](uml/README.md) for the naming
convention.

## Where to add mockups

Mockup **pages** (screen contents, states, requirement links) live in
[`mockups/`](mockups/). Mockup **image files** (`.svg`) live in
[`assets/mockups/`](assets/mockups/). See [`mockups/README.md`](mockups/README.md)
for the naming convention.

## How requirements are organized

- Requirements are defined **only** in the functional specification, each with a
  stable ID (`FONC-*` for features, `CONS-*` for constraints, `PERF-*` for
  performance).
- Each requirement carries a priority: **[MVP]**, **[V1]**, or **[V2]**.
- Verbs matter: **must** = mandatory, **should** = optional/recommended.
- The [requirements index](requirements/requirements-index.md) is a searchable
  catalog; the [traceability matrix](requirements/requirements-traceability.md)
  links each requirement to screens, diagrams, and acceptance criteria.
- Derived documents (indexes, traceability, this README) never introduce new
  requirements. If a derived doc conflicts with the specification, the
  specification wins.

## Relationship to the spec workflow

This product documentation describes **what** the atlas should do. It does not
replace the lifecycle specs under [`specs/`](specs/), which govern **how** and
**when** individual changes are implemented and approved. No application code is
implied or authorized by these documents.
