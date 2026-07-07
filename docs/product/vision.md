# Product Vision — Interactive Mesozoic Dinosaur Atlas

> Derived document. It summarizes intent; it does not introduce requirements.
> Authoritative requirements live in
> [`functional-specification.md`](functional-specification.md).

## One-line vision

A map-first tool for exploring **where** and **when** non-avian dinosaurs are
known from fossil evidence across the Mesozoic era — scientifically cautious,
source-driven, and honest about uncertainty.

## What the product is

The atlas is built around an interactive **paleogeographic map** paired with a
**geological time control**. As the user moves through geological time, the map
redraws the ancient positions of the continents and shows the fossil occurrences
that overlap the selected age. From any occurrence the user can open a **taxon
profile** to see classification, time range, discovery locations, and sources.

The experience deliberately combines three dimensions:

- **Geography** — reconstructed paleogeographic positions plus modern discovery
  locations.
- **Time** — the Mesozoic interval (≈252–66 Ma), split into Triassic, Jurassic,
  and Cretaceous.
- **Taxonomy** — exploration and filtering by taxonomic group and taxon.

## Focus and content hierarchy

- **Non-avian dinosaurs are the primary content.** They are the default active
  category and the center of the experience.
- **Other Mesozoic reptiles are secondary content** (e.g. pterosaurs, marine
  reptiles). They are clearly labeled as secondary and can be hidden to preserve
  a dinosaur-centered view.
- The atlas does **not** claim to cover all Mesozoic life. It is not a complete
  atlas of plants, invertebrates, mammals, fish, or microorganisms.

## Guiding principle: scientific caution

The product's identity depends on being trustworthy:

- Every visible fossil occurrence and time range is tied to an **identifiable
  source**.
- **Fossil points are evidence of discovery**, not claims about exact where an
  animal lived, and never an extrapolated distribution range.
- **Reconstructed** paleogeographic positions and **approximate** time ranges are
  labeled as such.
- **Interpretative data** (diet, mass, behavior) is distinguished from direct
  fossil facts, and **missing data is shown explicitly**, never silently filled
  with an unmarked assumption.
- The tone is informative, scientific, and accessible — not sensationalist and
  not overly childish.

## Who it is for

Curious explorers who want a credible, visual way to understand the geography and
timeline of dinosaurs — from enthusiasts to students and educators — without
being misled by oversimplified or unsourced claims.

## What success looks like (MVP)

A user can explore the Mesozoic, see a paleogeographic map for a chosen age,
filter to dinosaurs, select a fossil occurrence, open its taxon profile, and
return to the map — with sources, uncertainty, and missing data always visible.
See [`mvp-scope.md`](mvp-scope.md).
