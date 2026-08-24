# Specification Index

This is the catalog of all specifications in this repository. It is **derived**
documentation: it summarizes specs but does not introduce requirements. If this
index conflicts with a spec, the spec wins.

Specs live under `docs/specs/` and move between lifecycle folders as their
status changes:

- `docs/specs/active/` — Draft and In Review specs being worked on.
- `docs/specs/approved/` — Approved specs, ready to implement.
- `docs/specs/implemented/` — Implemented specs.
- `docs/specs/archived/` — Archived, Superseded, or Rejected specs.

## How to add a spec

1. Copy `docs/specs/SPEC_TEMPLATE.md` to
   `docs/specs/active/SPEC-XXX-short-slug.md`.
2. Pick the next unused `SPEC-XXX` id.
3. Fill in the frontmatter and requirements.
4. Add a row to the table below.

## Spec statuses

`Draft` → `In Review` → `Approved` → `In Implementation` → `Implemented`.
Terminal alternatives: `Superseded`, `Archived`, `Rejected`.

## Index

| Spec ID | Title | Status | Owner | Related issue | Related PRs | Location |
| ------- | ----- | ------ | ----- | ------------- | ----------- | -------- |
| SPEC-001 | Data architecture & model | Approved | nelsonjeanrenaud@gmail.com | — | — | [`specs/approved/SPEC-001-data-architecture.md`](specs/approved/SPEC-001-data-architecture.md) |
| SPEC-002 | Technology stack | Approved | nelsonjeanrenaud@gmail.com | — | — | [`specs/approved/SPEC-002-technology-stack.md`](specs/approved/SPEC-002-technology-stack.md) |
| SPEC-003 | Exploration view — first UI vertical slice | Implemented | nelsonjeanrenaud@gmail.com | — | #6 | [`specs/implemented/SPEC-003-exploration-view.md`](specs/implemented/SPEC-003-exploration-view.md) |
| SPEC-004 | Paleogeographic basemap — reconstructed continents | Implemented | nelsonjeanrenaud@gmail.com | — | #6 | [`specs/implemented/SPEC-004-paleogeographic-basemap.md`](specs/implemented/SPEC-004-paleogeographic-basemap.md) |
| SPEC-005 | Aggregated, viewport-linked occurrence list | Superseded | nelsonjeanrenaud@gmail.com | — | #6 | [`specs/archived/SPEC-005-aggregated-viewport-list.md`](specs/archived/SPEC-005-aggregated-viewport-list.md) |
| SPEC-006 | App loading experience — splash and progress | In Implementation | nelsonjeanrenaud@gmail.com | — | — | [`specs/approved/SPEC-006-app-loading-experience.md`](specs/approved/SPEC-006-app-loading-experience.md) |
| SPEC-007 | Provenance tag & taxon-profile simplification | In Implementation | nelsonjeanrenaud@gmail.com | — | — | [`specs/approved/SPEC-007-provenance-tags-and-profile-simplification.md`](specs/approved/SPEC-007-provenance-tags-and-profile-simplification.md) |
| SPEC-008 | Full-Mesozoic time window (252–66 Ma) | In Implementation | nelsonjeanrenaud@gmail.com | — | — | [`specs/approved/SPEC-008-full-mesozoic-time-window.md`](specs/approved/SPEC-008-full-mesozoic-time-window.md) |
| SPEC-009 | Ergonomic timeline slider & viewport-linked occurrence list | In Implementation | nelsonjeanrenaud@gmail.com | — | — | [`specs/active/SPEC-009-timeline-slider-and-viewport-list.md`](specs/active/SPEC-009-timeline-slider-and-viewport-list.md) |
| SPEC-017 | Taxonomy infographics — clade sheet, common ancestor, descent, fan, neighbours (rooted at Dinosauria) | In Implementation | nelsonjeanrenaud@gmail.com | — | — | [`specs/approved/SPEC-017-taxonomy-infographics.md`](specs/approved/SPEC-017-taxonomy-infographics.md) |
| SPEC-018 | Map cartographic styling — bathymetric ocean, land relief, graticule, marker retune | Implemented | nelsonjeanrenaud@gmail.com | — | #20 | [`specs/implemented/SPEC-018-map-cartographic-styling.md`](specs/implemented/SPEC-018-map-cartographic-styling.md) |
| SPEC-019 | Daily Genus — a daily taxonomic deduction puzzle | Implemented | nelsonjeanrenaud@gmail.com | — | #22 | [`specs/implemented/SPEC-019-daily-genus-puzzle.md`](specs/implemented/SPEC-019-daily-genus-puzzle.md) |
| SPEC-020 | Daily Genus — a parallel well-known track, ranked by encyclopedic attention | Implemented | nelsonjeanrenaud@gmail.com | — | #23 | [`specs/implemented/SPEC-020-daily-genus-well-known-track.md`](specs/implemented/SPEC-020-daily-genus-well-known-track.md) |
| SPEC-021 | Chrome copy removal — five interface lines retired, with compensating carriers | Approved | nelsonjeanrenaud@gmail.com | — | — | [`specs/approved/SPEC-021-chrome-copy-removal.md`](specs/approved/SPEC-021-chrome-copy-removal.md) |
| SPEC-022 | A global app bar — Map / Dinordle / Taxonomy, and the Dinordle rename | Approved | nelsonjeanrenaud@gmail.com | — | — | [`specs/approved/SPEC-022-global-app-bar.md`](specs/approved/SPEC-022-global-app-bar.md) |
| SPEC-023 | Map overlay layout — corner rails and an automated non-overlap gate | Approved | nelsonjeanrenaud@gmail.com | — | — | [`specs/approved/SPEC-023-map-overlay-layout.md`](specs/approved/SPEC-023-map-overlay-layout.md) |
| SPEC-024 | Dinordle legibility — named track controls and a per-guess overlap verdict | Approved | nelsonjeanrenaud@gmail.com | — | — | [`specs/approved/SPEC-024-puzzle-legibility.md`](specs/approved/SPEC-024-puzzle-legibility.md) |
| SPEC-025 | Dinordle cladogram render — a real horizontal cladogram | Draft | nelsonjeanrenaud@gmail.com | — | — | [`specs/active/SPEC-025-cladogram-render.md`](specs/active/SPEC-025-cladogram-render.md) |
| SPEC-026 | Exploration sidebar redesign — one five-unit selector, one list | Approved | nelsonjeanrenaud@gmail.com | — | — | [`specs/approved/SPEC-026-sidebar-redesign.md`](specs/approved/SPEC-026-sidebar-redesign.md) |

> **Known drift (2026-08-05):** rows for SPEC-010…SPEC-016 are missing from this
> table although those specs exist under `docs/specs/approved/`. Recorded in
> `docs/reports/fan-feature-wishlist.md`; left for a dedicated `/drift-check`
> rather than folded into an unrelated change.

> Keep this table in sync with the frontmatter of each spec. `/spec-report` and
> `scripts/validate_drift.py` help detect drift between this index and the
> actual spec files.
