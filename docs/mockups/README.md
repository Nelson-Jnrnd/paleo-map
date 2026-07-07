# UI Mockups

This folder holds **screen documentation pages**: the expected contents,
requirement links, and states for each screen. The **mockup image files** live
under [`../assets/mockups/`](../assets/mockups/).

These pages introduce no requirements and imply no visual/implementation
decisions beyond what the
[functional specification](../product/functional-specification.md) states. They
describe *what must be present*, not a final visual design.

## Where mockups go

- Documentation page per screen: `docs/mockups/<screen>.md` (this folder).
- Image file per screen/state: `docs/assets/mockups/<screen>[-<state>].png`.
- The [screens index](screens-index.md) is the master list.

## Naming convention

Lowercase, hyphen-separated, one file per screen; append a state suffix for state
variants:

```
docs/assets/mockups/exploration-view.png
docs/assets/mockups/taxon-profile.png
docs/assets/mockups/occurrence-panel.png
docs/assets/mockups/filters-panel.png
docs/assets/mockups/empty-state.png
docs/assets/mockups/error-state.png
```

State-variant examples: `exploration-view-loading.png`,
`exploration-view-empty.png`, `taxon-profile-no-image.png`,
`taxon-profile-minimal.png`.

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

All mockups are **planned**. These pages define required content and states; the
image files are TODO.
