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
| SPEC-005 | Aggregated, viewport-linked occurrence list | Implemented | nelsonjeanrenaud@gmail.com | — | #6 | [`specs/implemented/SPEC-005-aggregated-viewport-list.md`](specs/implemented/SPEC-005-aggregated-viewport-list.md) |
| SPEC-006 | App loading experience — splash and progress | In Implementation | nelsonjeanrenaud@gmail.com | — | — | [`specs/approved/SPEC-006-app-loading-experience.md`](specs/approved/SPEC-006-app-loading-experience.md) |
| SPEC-007 | Provenance tag & taxon-profile simplification | Draft | nelsonjeanrenaud@gmail.com | — | — | [`specs/active/SPEC-007-provenance-tags-and-profile-simplification.md`](specs/active/SPEC-007-provenance-tags-and-profile-simplification.md) |

> Keep this table in sync with the frontmatter of each spec. `/spec-report` and
> `scripts/validate_drift.py` help detect drift between this index and the
> actual spec files.
