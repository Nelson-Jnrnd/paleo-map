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
- Palette (shared across sheets): paper `#f6f5f2`, ink `#2b2b28`, stone lines
  `#b8b4aa`/`#d8d5cd`, ochre accent `#b07a35` (active/selected), brick `#a3453b`
  (semantic — error states), survey-slate `#5f7891` (requirement-ID annotations).

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

> The five MVP screens are drafted as low-fidelity wireframes. When adding an
> image, embed it on its screen page and annotate which requirement each region
> satisfies. State-variant sheets remain to be produced; several states are
> already illustrated within the drafted screens (e.g. empty/error states are
> covered by `empty-error-states.svg`).
