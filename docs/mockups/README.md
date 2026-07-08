# UI Mockups

This folder holds **screen documentation pages**: the expected contents,
requirement links, and states for each screen. The **mockup image files** live
under [`../assets/mockups/`](../assets/mockups/).

These pages introduce no requirements and imply no visual/implementation
decisions beyond what the
[functional specification](../product/functional-specification.md) states. They
describe *what must be present*, not a final visual design.

> **All UI work is binding on [`design-guidelines.md`](design-guidelines.md)** —
> the product's design charter (uncertainty first, domain language, one accent +
> a meaning-only status system, all real states designed). Read it before
> designing or building any screen.

## Where mockups go

- Documentation page per screen: `docs/mockups/<screen>.md` (this folder).
- Image file per screen/state: `docs/assets/mockups/<screen>[-<state>].svg`.
- The [screens index](screens-index.md) is the master list.

## Format: SVG

Mockups are authored as **high-fidelity SVG** in the
[design charter](design-guidelines.md)'s dark deep-time cartographic system. SVG
renders inline in GitHub Markdown (so it shows directly on the screen pages and in
the spec), stays diff-friendly in version control, and needs no build step. Each
SVG carries its own dark ocean background so it reads as an intentional app
surface regardless of the viewer's GitHub theme.

A headless-Chromium PNG render can be produced for previews/exports, but the SVG
is the source of truth. (The MVP set was designed with Claude Code and also
published as a combined [Artifact](https://claude.ai/) for visual review.)

## Naming convention

Lowercase, hyphen-separated, one file per screen; append a state suffix for state
variants:

```
docs/assets/mockups/exploration-view.svg
docs/assets/mockups/taxon-profile.svg
docs/assets/mockups/occurrence-panel.svg
docs/assets/mockups/filters-panel.svg
docs/assets/mockups/empty-error-states.svg
```

State-variant examples: `exploration-view-loading.svg`,
`exploration-view-empty.svg`, `taxon-profile-no-image.svg`,
`taxon-profile-minimal.svg`.

## How mockups link to requirements

1. Each screen page lists its **Related requirements** (`FONC-*`, `CONS-*`,
   `PERF-*`).
2. When an image is added, embed it on the screen page and annotate which
   requirement each region satisfies.
3. Keep the [screens index](screens-index.md) and the
   [traceability matrix](../requirements/requirements-traceability.md) in sync.

## How screen states are documented

Every screen documents its relevant states explicitly, because the specification
requires them (loading, empty, error, minimal-data, no-image). For each state,
record: the trigger, what the user sees, and the recovery action. See
[`empty-error-states.md`](empty-error-states.md) for the shared state catalog.

## Status

The five MVP screens are **high-fidelity mockups** in the dark deep-time
cartographic system, embedded on their screen pages: exploration view, taxon
profile, occurrence panel, filters panel, and empty/error states. Per-state
variant sheets (loading, minimal-data, no-image, etc.) listed in the
[screens index](screens-index.md) are still TODO, as are the non-MVP screens
(formation profile, timeline, comparison, guided paths).
