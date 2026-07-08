# Mockup Assets

Image files for UI mockups. The **screen documentation pages** that describe and
link these images live under [`../../mockups/`](../../mockups/).

## What goes here

- One file per screen, and per state variant: `<screen>[-<state>].svg`.
- **SVG** is the format (see [`../../mockups/README.md`](../../mockups/README.md)):
  it renders inline in GitHub Markdown, is diff-friendly, and needs no build step.
  Optional PNG renders may be produced for previews/exports, but the SVG is the
  source of truth.

## Convention

- Naming: lowercase, hyphen-separated; append a state suffix for variants (see
  [`../../mockups/README.md`](../../mockups/README.md)).
- Palette (shared across sheets — light deep-time cartographic / bathymetric
  chart, see
  [`../../mockups/design-guidelines.md`](../../mockups/design-guidelines.md) §4):
  page `#e9eef2`, pale ocean `#d7e4ec`→`#eef4f7`, panels `#ffffff`, land
  `#edf1f1`, text `#1f2b38`, one teal accent `#0f9d83` (occurrence/data +
  interaction), ICS period colours on the timeline (Triassic `#8E5AA5`, Jurassic
  `#3E93C6`, Cretaceous `#5FA96A`), red `#cf4436` for error states only.

## Files

| File | Screen page | Status |
| --- | --- | --- |
| `exploration-view.svg` | [Exploration view](../../mockups/exploration-view.md) | ✅ Drafted |
| `taxon-profile.svg` | [Taxon profile](../../mockups/taxon-profile.md) | ✅ Drafted |
| `occurrence-panel.svg` | [Occurrence panel](../../mockups/occurrence-panel.md) | ✅ Drafted |
| `filters-panel.svg` | [Filters panel](../../mockups/filters-panel.md) | ✅ Drafted |
| `empty-error-states.svg` | [Empty & error states](../../mockups/empty-error-states.md) | ✅ Drafted |
| `exploration-view-loading.svg` | [Exploration view](../../mockups/exploration-view.md) | ⬜ TODO |
| `exploration-view-empty.svg` | [Exploration view](../../mockups/exploration-view.md) | ⬜ TODO |
| `taxon-profile-loading.svg` | [Taxon profile](../../mockups/taxon-profile.md) | ⬜ TODO |
| `taxon-profile-minimal.svg` | [Taxon profile](../../mockups/taxon-profile.md) | ⬜ TODO |
| `taxon-profile-no-image.svg` | [Taxon profile](../../mockups/taxon-profile.md) | ⬜ TODO |
| `taxon-profile-error.svg` | [Taxon profile](../../mockups/taxon-profile.md) | ⬜ TODO |
| `search-empty.svg` | [Empty & error states](../../mockups/empty-error-states.md) | ⬜ TODO |

> The five MVP screens are high-fidelity mockups. When adding an
> image, embed it on its screen page and annotate which requirement each region
> satisfies. State-variant sheets remain to be produced; several states are
> already illustrated within the drafted screens (e.g. empty/error states are
> covered by `empty-error-states.svg`).
