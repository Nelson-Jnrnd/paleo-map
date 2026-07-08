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

- Fossil points are **discovery evidence**, never a distribution range or an
  exact life position (FONC-1150, CONS-130/140).
- **Reconstructed** paleo positions and **approximate** time ranges are labeled
  as such (FONC-1130/1140).
- **Interpretative** data (diet, mass, behavior) is visually separated from
  fossil-derived data and never mixed in one field (FONC-670, CONS-440).
- **Missing** data is shown with an explicit label, never a blank or a silent
  default (FONC-490, FONC-1120, PERF-180).
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

Restrained, and derived from the subject — a geological survey sheet, not an AI
startup.

**Palette (one accent + a semantic status system).**

| Token | Value (light) | Use |
| --- | --- | --- |
| Paper / ground | `#f6f5f2` | Page and sheet background |
| Ink | `#2b2b28` | Primary text |
| Muted / faint | `#6f6b62` / `#a29d92` | Secondary text, captions |
| Line | `#d8d5cd` / `#b8b4aa` | Borders, dividers, controls |
| **Accent — ochre** | `#b07a35` | The single accent: active/selected state, primary action, current age |

The accent is ochre (sediment / amber), and it is the *only* decorative color.
Everything else is neutral. Because provenance is core to this product, a small
**semantic status system** is allowed *in addition* to the accent — but it
encodes meaning, never decoration:

| Status | Cue | Meaning |
| --- | --- | --- |
| Reconstructed | ▲ + ochre-tint chip | Paleogeographic position is modeled, not observed |
| Approximate | ≈ + ochre-tint chip | Time range is uncertain / broad |
| Interpretative | muted, separated block | Inferred, not fossil-derived |
| Missing | explicit "Not available" label | Field has no sourced value |
| Error | brick `#a3453b`, sparing | Load failure only — never used decoratively |

Design **both light and dark themes** with equal care; drive everything through
tokens.

**Typography.** A clean sans for UI text; a monospace for IDs, coordinates, and
Ma values (a drafting convention, and it gives `tabular-nums` alignment for
numbers and ages). Set a type scale and hold to it; give running text room.

**Restraint.** No glassmorphism, glowing cards, pastel gradients, decorative
blobs, or fake analytics. Shadows, gradients, rounded corners, and animation are
used sparingly and only when they aid comprehension (e.g. a marker's selected
state, a cluster expanding). Respect `prefers-reduced-motion`.

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

---

### Relationship to the wireframes

The low-fidelity [wireframes](README.md) lock **layout and required content**.
Any higher-fidelity design or built UI must additionally satisfy this charter —
especially §2 (uncertainty is first-class) and §4 (one accent + a meaning-only
status system).
