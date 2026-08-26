# UI Design Guidelines

**Status:** Working conventions (binding for all UI design and implementation in
this repository). These are *design* rules, not product requirements — product
requirements live only in the
[functional specification](../product/functional-specification.md). If a guideline
here appears to conflict with a requirement, the requirement wins and the
conflict goes to [`/drift-check`](../../CLAUDE.md).

Every screen, mockup, and component built for the Interactive Mesozoic Dinosaur
Atlas must follow this charter. The goal is a UI that feels **specific,
grounded, and built for repeated use by someone who cares whether a claim is
sourced** — not a screenshot-optimized SaaS dashboard.

---

## 1. Who this is for, and the one job

- **Primary user — the Explorer.** Curious, scientifically literate but not
  necessarily a specialist: enthusiasts, students, educators. They want to know
  *where and when* a dinosaur is known from fossil evidence, and to trust what
  they see.
- **The screen's single job** is always a step in this loop:
  **time → map → occurrence → taxon → back to map.** Design each surface to
  advance that loop, not to showcase features.
- **Secondary reader — a reviewer** checking a mockup against requirements. That
  is why annotations reference `FONC-/CONS-/PERF-` IDs; keep them present in
  design artifacts, absent from the shipped product UI.

## 2. The north star: uncertainty is first-class, not a footnote

This product's credibility *is* the product. The interface must make provenance
and uncertainty legible at a glance, never buried behind a hover or a secondary
click (CONS-490):

> **One recorded exception, owner-authorised 2026-08-26.** Dinordle's "well-known"
> ranking caveat sits behind an information control on the puzzle screen — see
> SPEC-020 AMEND-006, which states the reasoning and the constraints the
> disclosure must still meet. It is scoped to that one caveat on that one screen
> and is **not** precedent: every other provenance and uncertainty disclosure in
> the product stays on the surface.


- Fossil points are **discovery evidence**, never a distribution range or an
  exact life position (FONC-1150, CONS-130/140).
- Time ranges that **span multiple stages** are labeled as such (FONC-1140).
  Reconstructed paleo positions carry **no on-screen cue**; the rotation model
  behind them stays inspectable in the basemap attribution popover.
  *(SPEC-021, 2026-08-14, owner-approved: the standing map-level "Paleogeographic
  reconstruction" label was removed, retiring FONC-300, CONS-120 and FONC-1130
  with it. SPEC-007, 2026-07-21: the per-occurrence "reconstructed" chip had
  already been retired in favour of that label, and the time cue was reworded
  from "approximate" to the factual "spans multiple stages".)*
- **Missing** data is shown with an explicit label, never a blank or a silent
  default (FONC-490, FONC-1120, PERF-180).
- *(SPEC-007, 2026-07-21, owner-approved: the fossil-derived vs. **interpretative**
  distinction was removed from the product — FONC-670/1110 retired. Sources remain
  shown, so provenance stays inspectable.)*
- Every visible occurrence and time range carries an **identifiable source**
  (FONC-1100, PERF-140/150).

If a design choice makes uncertainty *less* visible to look cleaner, it is wrong.

## 3. Domain language

Use the vocabulary of paleontology and stratigraphy, and the terms defined in the
[glossary](../product/glossary.md). Never generic product-speak.

- **Say:** taxon, occurrence, formation, clade / genus / species, Ma, time range,
  paleogeographic position, Triassic / Jurassic / Cretaceous, "reconstructed",
  "approximate", "no image available", "occurrence only".
- **Never say:** Insights, Overview, Engagement, Activity, Performance, Growth,
  "items", "records" (they are *occurrences*), or any label that could belong to
  five unrelated apps.
- Scientific names are the primary reference and are set in *italics*
  (CONS-350); common names are secondary reading aids only (CONS-360).

## 4. Visual system

Restrained, and derived from the subject — a **deep-time cartographic console**
(what real paleogeographic / deep-time GIS tools look like: GPlates, Macrostrat),
not a warm-paper document and not an AI startup. Deliberately *not* the
over-used warm-cream-and-graphite look: the neutrals are **cool blue-greys** and
the map is a pale **bathymetric chart** so the map and its data read as the
primary object.

**Palette (one accent + a meaning-only status system).** The product is
**single-theme, light** — a deliberate light cartographic world. Style through
tokens; do not hand-code a second theme.

| Token | Value (light) | Use |
| --- | --- | --- |
| Ground / page | `#e9eef2` (cool blue-grey) | Page background behind panels |
| Ocean | radial `#d7e4ec`→`#eef4f7` | Map sea (pale bathymetric tint) |
| Panel / surface | `#ffffff` | Sidebars, panels, cards, control bars |
| Land | `#edf1f1`, coast `#a9b9c3` | Reconstructed continental masses |
| Graticule / line | `#cdd9e0` grid · `#cfd8de` / `#dde5ea` borders & dividers | Map grid, borders |
| Text | `#1f2b38` hi · `#33424f` · `#52606e` muted · `#5b6773` faint · `#5f6a75` id | Type ramp |
| **Accent — teal** | `#0f9d83` (deep `#0a7f66`, cluster `#17a98c`, on-accent `#ffffff`) | The single accent: the occurrence/data layer, selection, primary action, current-age handle |

Teal is the *only* accent, and it belongs to the data + interaction layer
(occurrence markers, the selected point, primary buttons, the time handle).
Everything else is cool neutral. Two additional colour systems exist, both
**meaning-only, never decorative**:

- **ICS period colours** on the geological timeline — the real International
  Chronostratigraphic Chart hues: **Triassic** violet `#8E5AA5`, **Jurassic**
  blue `#3E93C6`, **Cretaceous** green `#5FA96A`. A period filter dot uses the
  same hue so the mapping is learnable. These are domain codes, not styling.
- **Clade tints** — one muted hue per major dinosaur group, defined in
  `src/app/components/mapCladeMarkers.ts` and established by SPEC-015 for the map's
  occurrence markers: Theropod `#dc9a80`, Sauropod `#82b6a7`, Ornithopod
  `#93a9cc`, Thyreophoran `#cbbd7f`, Ceratopsian `#c893ad`, Pachycephalosaur
  `#aa9cc8`, plus the two great divisions for taxa that resolve no deeper —
  Ornithischian `#9cc49b` and Saurischian `#cbb49b` (SPEC-015 AMEND-003) — and a
  neutral `#b4bcc6` for anything else.

  > **Owner decision (2026-08-06, SPEC-017 AMEND-001).** These tints are the
  > product's clade code and are **not** confined to the map: the taxonomy fan
  > uses the same hue for the same clade, so the mapping is learnable across
  > screens the way the ICS period colours are. The rule that has always applied
  > still applies — **shape and name carry identity first, the tint reinforces**
  > (charter §4, PERF-250). A clade tint may never be the only way a clade is
  > identified, and it is never applied decoratively to something that is not a
  > clade.
- **Provenance / status cues** — kept neutral so the accent stays singular:

| Status | Cue | Meaning |
| --- | --- | --- |
| Reconstructed | ▲ standing map label | Paleogeographic positions are modeled, not observed (SPEC-007: standing label, not a per-occurrence chip) |
| Spans multiple stages | ≈ + neutral chip | Time range spans more than one geological stage (SPEC-007: reworded from "Approximate") |
| Incomplete / attention | muted amber `#8a5a12`, sparing | Profile is partial (a "note", not an error) |
| Missing | explicit "Not available" label | Field has no sourced value |
| Error | red `#c0392b`, sparing | Load failure only — signals the state; the recovery action stays the teal accent |

> **Accessibility reconciliation (SPEC-003 AMEND-002).** The muted/faint/id greys,
> the deep teal used for small text and button fills, and the amber/error status
> hues above were **darkened from their original charter values** so that text and
> UI meet WCAG 2 AA contrast (4.5:1), which the axe gate enforces. The values in
> these tables are the shipped, AA-safe ones; where accessibility and the original
> aesthetic hex conflict, **accessibility wins** (charter restraint is preserved —
> only the luminance moved, not the hue family). The live source of truth is
> `src/app/styles/tokens.css`.

**Typography.** _Owner override (2026-07-27, SPEC-014 AMEND-003): the shipped app
uses a single standard monospace — `'Courier New',Courier,monospace` — across all
roles, superseding the three faces below. The `tokens.css` values are the source
of truth. The role guidance below is retained for context._

Three roles, chosen to avoid the generic system-sans default:

- **Serif** — `'Spectral','Source Serif 4','Charter','Georgia',serif` for
  headings and *scientific names* (italic). Gives the atlas a natural-history,
  field-guide voice.
- **Sans (UI)** — `'IBM Plex Sans','system-ui','Segoe UI',sans-serif` for labels,
  values, and body. Engineered, not Helvetica/Arial/Inter.
- **Mono** — `'IBM Plex Mono','SFMono-Regular','Menlo',monospace` for Ma values,
  coordinates, period ticks, and requirement IDs; use `tabular-nums`.

(In committed SVGs the exact face depends on the viewer's installed fonts, but
the stacks never fall back to Helvetica/Arial.)

**Restraint.** No glassmorphism, glowing cards, pastel gradients, decorative
blobs, or fake analytics. A single subtle radial on the ocean and a faint
graticule are the only "texture", and they are cartographic, not decorative.
Shadows, gradients, rounded corners, and animation are used sparingly and only
when they aid comprehension (a marker's selected halo, a cluster expanding).
Respect `prefers-reduced-motion`.

> **Owner override (2026-08-05, SPEC-018).** The restraint rule above **no longer
> constrains the paleogeographic basemap.** The map may be as visually rich as it
> needs to be to read as a real cartographic object: multiple tonal bands,
> gradients, depth gradation, relief and texture on land and sea are all
> permitted, and the "single subtle radial" ceiling is lifted. The rule still
> governs panels, cards, controls and every other surface — the override is
> scoped to the basemap.
>
> Three things this override explicitly does **not** relax, because they are not
> matters of taste:
> - **§2 (uncertainty is first-class).** Richer rendering must never read as data
>   the atlas does not have. Depth gradation is a cartographic device derived from
>   distance to the coastline, not measured bathymetry, and must never be labelled
>   or legended as depth (SPEC-018 UX-002).
> - **Accessibility.** WCAG 2 AA contrast and the axe gate still win over any
>   aesthetic choice (SPEC-003 AMEND-002).
> - **Accent semantics.** Teal still belongs to the data and interaction layer,
>   and ICS period hues still belong to the timeline. The basemap gets richer in
>   the cool-neutral family; it does not acquire a second accent.

## 5. Hierarchy and actions

- **One obvious primary action per surface.** On the map it is *select an
  occurrence*; in the occurrence panel it is *Open taxon profile*; in an error
  state it is *Retry*. Make it the highest-contrast control.
- **Quieter secondary actions.** Reset filters, toggle layers, and remove a
  single filter are present but visually subordinate (text/outline, not filled).
- **Not everything is equal.** Use spacing, weight, and contrast — not borders on
  everything — to express what matters first. Group into a card only when it
  improves scanning or a decision; never to fill space.
- **Icons earn their place.** Only when they clarify meaning or save space (zoom
  ±, remove ✕, the reconstructed ▲). No decorative icon sets.

## 6. Built for messy, real data

The UI must survive real paleo data, which is long, uneven, and often missing:

- **Long labels** — taxonomic names and formation names can be long
  (*Pachycephalosaurus wyomingensis*, "Hell Creek Formation"). Wrap or truncate
  with a title, never overlap or clip.
- **Missing / uncertain values** — render the explicit label (§2), don't hide the
  row.
- **Unusual numbers** — ages span 252→66 Ma; ranges may be a single stage or tens
  of millions of years. Use `tabular-nums`; show min–max with units (Ma).
- **Contested taxa** — invalid / doubtful / synonymous / uncertain taxa are
  flagged inline when known (FONC-720, CONS-300); do not silently drop them.
- **Density** — cluster occurrences before markers overlap; keep targets ≥24×24
  CSS px (PERF-090/100/120).

## 7. Required states

Every interactive surface designs for all of its real states, not just the happy
path. Tie them to the spec:

- **Loading** — map init (FONC-1260) and profile open (FONC-1270); indicator past
  500 ms (PERF-050).
- **Empty** — no occurrences after filters (FONC-1280), no search result
  (FONC-1290), with a recovery path.
- **Minimal data** — profile exists but is sparse (FONC-1300); label it.
- **Error** — map (FONC-1310) and profile (FONC-1320) load failures, with retry
  (FONC-1330) and **filters preserved** (FONC-1340).
- **Disabled** — controls that can't apply (e.g. a group with no occurrences at
  the selected age) are disabled with a reason, not hidden silently.

## 8. Interaction contract

For every control, its behavior must be unambiguous. When specifying a screen,
state:

- **On primary click** — what changes, where the user lands (respect ≤2 actions
  to a profile, ≤1 back to the map — FONC-1070/1080).
- **Validation** — for the one real form (search): empty query, no match
  (FONC-1290), and how results appear.
- **Reversible vs destructive** — this product has few destructive actions.
  *Reset all filters* is reversible and needs no modal, but it must be visibly
  reversible (filters reappear; state is preserved across navigation and load
  failures — FONC-1020/1340). If a genuinely destructive action is ever added,
  require explicit confirmation.
- **Feedback** — every action has a visible result: count updates, panel opens,
  error resolves. No silent success.
- **Navigation context** — always show where the user is (selected age, group,
  count are permanent — FONC-040/050/060) and the single-action way back.

## 9. Before designing any screen

Answer these, in the mockup page or the design note:

1. Who is on this screen and what step of the loop are they in?
2. What must they see first?
3. What's the most likely next action?
4. What can go wrong here (empty, error, missing, uncertain)?
5. Which data will be long, messy, or absent?
6. What should be collapsed, disabled, or deprioritized?

## 10. Final quality check

Before calling a screen done:

- Could it belong to five unrelated apps? If yes, make it more specific.
- Any vague marketing text? Replace with operational, domain language.
- Any decoration that doesn't help the user act or understand? Remove it.
- Would it still work with messy, missing, uncertain real data? If not, redesign.
- Is the primary action obvious within three seconds? If not, fix the hierarchy.
- Is provenance/uncertainty still legible at a glance? If not, it fails §2.

## What we deliberately avoid

Generic dashboards; vague summary cards ("Insights", "Engagement"); equal-weight
layouts; placeholder content that fits any app; decorative gradients, blobs, and
glassmorphism; icon soup; fake metrics; and anything that makes a fossil point
look like a range or hides how sure we are. Boring clarity beats decorative
complexity.

The specific failure modes, the reasons they happen, and a countable self-check
are in [`anti-slop-checklist.md`](anti-slop-checklist.md) — read it with this
charter. It is subordinate to this document and introduces no requirements.

---

### Relationship to the mockups

The high-fidelity [screen mockups](README.md) are the reference implementation of
this charter — they realize §2 (uncertainty first-class), §4 (light cartographic
system, one teal accent, ICS period colours, neutral status cues), and §7 (all
real states, including the disabled-group state on the filters panel). Any built
UI must match them and this charter; where a screen has no mockup yet, design it
to the same rules.
