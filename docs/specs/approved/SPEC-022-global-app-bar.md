---
doc_type: spec
spec_id: SPEC-022
title: Global app bar (Map · Dinordle · Taxonomy) and the Dinordle rename
status: Approved
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, app-shell, exploration-view, daily-genus, taxonomy-screen, taxon-page, styling]
affected_interfaces: [url-fragments, local-storage]
supersedes: []
superseded_by:
depends_on: [SPEC-003, SPEC-011, SPEC-013, SPEC-017, SPEC-019, SPEC-020]
conflicts_with: []
last_verified_at:
---

# SPEC-022: Global app bar (Map · Dinordle · Taxonomy) and the Dinordle rename

## Summary

The atlas has four screens and no navigation. Only the map screen shows any
links, and each other screen invented its own "← Back to map". This spec adds one
**app bar across all four screens** with three destinations — **Map**,
**Dinordle**, **Taxonomy** — removes the three bespoke back buttons, shrinks the
"Reset view" control that currently looks as important as a destination, and
renames the puzzle from "Daily Genus" to **Dinordle** in what the user reads. The
URL fragments (`#daily`, `#practice`, `#daily-known`, `#practice-known`) and the
local-storage keys are **deliberately left untouched**, so shared links keep
working and nobody's streak resets.

## Context

Owner feedback, 2026-08-14: *"We need a real app bar in all pages with Map /
Dinosaurdle (find a fitting -dle name) / Taxonomy buttons"* and *"Reset view
button takes too much place for what it is"*. The owner chose **Dinordle** from
the candidates (Cladle / Saurdle / Dinordle / Taxordle) in the same session.

Current state, verified in the working tree at `c1bfb1d`:

- **There is no app bar.** Navigation lives only in `ContextBar`
  (`src/app/components/ContextBar.tsx`), which renders on the map screen only. It
  holds the brand title and the not-a-complete-atlas line, the taxon search
  (SPEC-013), three stats (Selected age / Group / Occurrences — SPEC-003 REQ-001),
  and three buttons — **Taxonomy**, **Daily Genus**, **Reset view** — all three
  carrying the same `styles.reset` class, so the reset reads as a peer of the two
  destinations.
- **Three bespoke back affordances.** `TaxonProfile.tsx:48`,
  `TaxonomyScreen.tsx:84` and `:102`, `DailyGenusScreen.tsx:451` each render
  "← Back to map", all wired to the same `backToMap` action.
- **Routing is a reducer, not a router.** `state.screen ∈ map | taxonomy | daily
  | profile` (`src/app/state/exploration.ts:38`), rendered by early returns in
  `ExplorationView.tsx:353–407`. `test/ui/spec019-entry-point.test.tsx` asserts
  no routing library is in `package.json`.
- **Only the puzzle is addressable.** `src/app/state/screenFragment.ts` maps four
  fragments to (mode × track); `fragmentFor` returns `""` for every other screen.
  The two effects in `ExplorationView.tsx:155–179` are **deliberately one-way
  each** — the reader runs on mount and `hashchange` only, and reads the current
  screen from a ref, because re-running it on screen change makes the pair
  ping-pong (the reader re-opens the screen the writer is in the middle of
  leaving). That contract is load-bearing and this spec must not disturb it.
- **A second "Reset view"** exists in the empty state
  (`src/app/components/states.tsx:77`), where it is that surface's *primary*
  action (SPEC-003 REQ-008, SPEC-011 REQ-004).

Related specs: SPEC-003 (exploration shell and persistent context), SPEC-011
REQ-004 (the reset is labelled "Reset view", not "Reset filters"), SPEC-013
(taxon search), SPEC-017 (taxonomy screen), SPEC-019 and SPEC-020 (the puzzle).
Binding design documents: `docs/mockups/design-guidelines.md` and
`docs/mockups/anti-slop-checklist.md`.

## Problem statement

1. A user on the taxonomy screen, the puzzle or a taxon page can only go **back
   to the map**. Reaching any other screen costs two navigations through the map.
2. Each screen invents its own return control, so the same idea is drawn three
   times and is discoverable in three different places.
3. On the map, "Reset view" is styled identically to Taxonomy and Daily Genus,
   giving a small, reversible housekeeping action the same weight as a
   destination — the charter's hierarchy rule (§5) inverted.
4. The puzzle's name, "Daily Genus", is descriptive rather than a product name.
   The owner has chosen **Dinordle**. Renaming naively would change URL fragments
   and storage keys and would break shared links and reset every player's record.

## Goals

- One navigation surface, present on all four screens, carrying exactly three
  destinations: Map, Dinordle, Taxonomy.
- Remove the per-screen back buttons; the bar is the single return path.
- Keep the return to the map at **≤1 action** from every screen
  (FONC-1080, CONS-470).
- Demote the reset control to the weight of the small, reversible action it is,
  without losing its accessible name or its ≥24×24 target.
- Rename the puzzle to Dinordle everywhere a user reads it.
- Change **no** address and **no** storage key, so existing links and existing
  player records survive the rename untouched.

## Non-goals

- **No router, and no new fragment addresses.** `#map`, `#taxonomy` and a
  per-taxon profile address are explicitly out of scope (see OQ-001 and API-001).
- **No change to the empty state's "Reset view"** (`states.tsx:77`). It is that
  surface's primary action and stays exactly as it is (see REQ-006).
- **No rename of code identifiers, file names or CSS modules.** `DailyGenusScreen`,
  `dailyGenus.ts`, `dailyGenusStorage.ts`, `dailyGenus.module.css`, `DailyMode`,
  `dailyTrack`, `screen === "daily"` and the `test/**/spec019-*`,
  `test/**/spec020-*` file names all keep their current spelling. Renaming them is
  a large diff with no user-visible effect and would breach the no-opportunistic-
  refactor rule.
- **No change to the puzzle's rules, pools, selection, scoring or persistence
  schema.** SPEC-019 and SPEC-020 behaviour is untouched apart from the displayed
  name.
- **No new page, screen or destination.** The bar carries three items and stops.
- **No mobile menu, hamburger, drawer, icon set, avatar, notification bell or
  search field in the bar.**
- No change to the timeline, map, grouping controls, sidebar, or taxon search.

## Users or actors

- **The Explorer** (charter §1) — moves between the map loop, the taxonomy screen
  and the puzzle, and expects to know where they are and to get anywhere in one
  action.
- **A returning Dinordle player** — has an in-progress round, a streak and a
  track choice in browser local storage, and possibly a bookmark on `#daily` or
  `#daily-known`.
- **Assistive-technology users** — navigate by landmark and by keyboard; the bar
  is the first thing in the tab order on every screen.

## Functional requirements

### REQ-001: One global app bar, rendered by the shell

- **Statement:** The application must render a single app bar on **all four
  screens** (map, taxonomy, daily/Dinordle, profile). It is rendered **once by
  the shell** (`ExplorationView`), not by the individual screen components, and
  it sits above every other surface. It contains, in this order and nothing else:
  the product wordmark ("Mesozoic Dinosaur Atlas"), the primary navigation
  (REQ-002), and — on the map screen only — the compact reset control (REQ-006).
  The bar and, on the map screen, the exploration context (REQ-005) are children
  of the document's single `<header>` (`role="banner"`); the navigation is a
  `<nav>` with an accessible name. The wordmark is **not** a heading element.
- **Rationale:** Owner request. Rendering in the shell keeps the screen
  components (and their existing component tests, including the SPEC-019/SPEC-020
  no-egress suites, which render `DailyGenusScreen` directly) unchanged. One
  `<header>` keeps exactly one `banner` landmark in the document; a wordmark that
  is not a heading avoids introducing a second `<h1>` on the taxonomy screen,
  where the focus taxon already owns `<h1>` (`TaxonomyScreen.tsx:116`), and
  respects the anti-slop rule that the subject of the screen — the map, the tree,
  the cladogram — is the largest thing on it, not the chrome.
- **Acceptance criteria:**
  - Rendering the shell on each of the four screens shows the bar with the
    wordmark and the three destinations.
  - The document contains exactly one element with `role="banner"` and exactly
    one `<nav>` with the navigation's accessible name, on every screen.
  - The bar is present in `ExplorationView`'s output for `state.screen` of
    `map`, `taxonomy`, `daily` and `profile`; no screen component
    (`TaxonomyScreen`, `DailyGenusScreen`, `TaxonProfile`) renders a bar of its
    own.
  - The wordmark is not exposed with `role="heading"`.
- **Verification method:** automated test (rendered shell, all four screens).
- **Evidence location:** `test/ui/spec022-app-bar.test.tsx`

### REQ-002: Three destinations — Map, Dinordle, Taxonomy

- **Statement:** The navigation must offer exactly three controls, labelled
  **Map**, **Dinordle** and **Taxonomy**, in that order, each a `<button>`
  (the app has no URLs for these screens — API-001). Activating them:
  - **Map** — returns to the exploration view, preserving the selected age, the
    grouping mode/rank and any selection (`backToMap`).
  - **Dinordle** — opens the puzzle's **daily** round on the player's currently
    chosen track, exactly as today's "Daily Genus" button does.
  - **Taxonomy** — opens the taxonomy screen at its existing focus taxon. Only
    when opened **from the map in taxon mode** is the focus seeded from the
    current taxon selection, as today; from any other screen the screen's
    existing focus is preserved and never silently reset to the root.

  Activating the destination the user is already on is a no-op that must not
  reset that screen's state.
- **Rationale:** Owner request, in the owner's order. Preserving each screen's
  state across navigation is the same contract the app already holds for age and
  filters (FONC-1010/1020); a bar that quietly discards where you were on the
  taxonomy tree would make the bar worse than the back button it replaces.
- **Acceptance criteria:**
  - The three buttons exist with exactly those accessible names on every screen.
  - From the taxonomy screen, Map returns to the exploration view with the
    selected stage, grouping mode and rank unchanged.
  - From a taxon page opened out of the taxonomy screen, Taxonomy returns to the
    taxonomy screen focused on the same taxon it was focused on before.
  - From the map in taxon mode with a taxon selected, Taxonomy opens focused on
    that taxon (unchanged from today).
  - Dinordle from any screen opens the daily round on the stored track.
  - Clicking the current destination leaves the screen and its state unchanged.
- **Verification method:** automated test (rendered shell) + automated reducer
  test.
- **Evidence location:** `test/ui/spec022-app-bar.test.tsx`

### REQ-003: The current destination is marked, in shape and in words

- **Statement:** On the map, taxonomy and Dinordle screens the corresponding
  navigation control must carry `aria-current="page"` and a visible mark that is
  **not colour alone** (a heavier weight plus a rule under the label). On the
  **taxon page no destination is marked current**, because the taxon page is not
  one of the three destinations — it is a detail view reached from within the map
  loop, from the Dinordle reveal, or from the taxonomy screen.
- **Rationale:** Charter §8 ("always show where the user is") and PERF-250
  (never colour alone). Marking "Map" as current while the user is on a taxon
  page would be a false statement to assistive technology; the taxon page names
  itself through its own region label (`aria-label="Taxon page: <name>"`).
- **Acceptance criteria:**
  - On each of map / taxonomy / daily, exactly one navigation control has
    `aria-current="page"` and it is the matching one.
  - On the profile screen no navigation control has `aria-current`.
  - The current control is distinguishable with colour removed (weight + rule),
    verified by asserting the state-carrying class, not the colour.
- **Verification method:** automated test.
- **Evidence location:** `test/ui/spec022-app-bar.test.tsx`

### REQ-004: The bar replaces every bespoke back control

- **Statement:** The "← Back to map" controls in `TaxonProfile.tsx`,
  `TaxonomyScreen.tsx` (both the populated and the no-root branch) and
  `DailyGenusScreen.tsx` must be removed. The app bar is the single return path,
  and the return to the map must remain **one action** from every screen. No
  screen may render a second control that duplicates a destination already in the
  bar.
- **Rationale:** Owner request ("a real app bar in all pages"); FONC-1000/1080
  and CONS-470 (≤1 action back to the map); and the instruction not to duplicate
  chrome. Removing them is also a net gain: today a taxon page opened from the
  puzzle or from the taxonomy screen offers only "back to map", losing the screen
  the user came from; with the bar, all three destinations are one action away.
- **Acceptance criteria:**
  - No component under `src/app/components/` renders the string "Back to map".
  - From the taxon page, the taxonomy screen and the Dinordle screen, the map is
    reached in exactly one activation.
  - The Dinordle "no puzzle today" error surface (`DailyGenusScreen.tsx:400–418`)
    keeps its own primary recovery action; the user is never trapped on a screen
    whose body failed to build.
- **Verification method:** automated test (rendered shell) + repository grep in
  the test.
- **Evidence location:** `test/ui/spec022-app-bar.test.tsx`

### REQ-005: The context bar is reduced, not duplicated

- **Statement:** `ContextBar` **survives in reduced form** on the map screen. It
  keeps the taxon search (SPEC-013), the three permanent stats — Selected age,
  Group, Occurrences (SPEC-003 REQ-001) — the not-a-complete-atlas line
  (FONC-400), and the reset control in its new compact form (REQ-006). It **loses**
  the brand title (which moves into the app bar) and the Taxonomy and Daily Genus
  buttons (which become app-bar destinations). Nothing that moves to the bar may
  also remain in the context bar.
- **Rationale:** The instruction not to silently duplicate chrome. Age, group and
  count are map-screen context, not global navigation, and SPEC-003 REQ-001
  requires them to stay permanently visible on the exploration view — so they
  stay where they are. The disclaimer line qualifies the occurrence data on
  screen, so it stays with the data; its visibility is unchanged (map screen,
  always visible), which is exactly its status today.
- **Acceptance criteria:**
  - On the map screen the banner contains: wordmark, three destinations, reset,
    search, Selected age (stage name and Ma span), Group ("Dinosaurs"), the live
    occurrence count, and the not-a-complete-atlas line.
  - The strings "Mesozoic Dinosaur Atlas", "Taxonomy" and "Dinordle" each appear
    exactly once in the banner.
  - On the taxonomy, Dinordle and profile screens the age/group/count stats and
    the taxon search are **not** rendered.
  - `ContextBar` no longer accepts `onOpenTaxonomy` / `onOpenDaily`.
- **Verification method:** automated test.
- **Evidence location:** `test/ui/exploration-context.test.tsx`,
  `test/ui/spec022-app-bar.test.tsx`

### REQ-006: A compact reset control

- **Statement:** The map screen's reset control must stop being drawn as a peer
  of the navigation. It becomes a **quiet text control** — the visible words
  "Reset view", no button border or filled chrome, set at the small type size,
  placed at the trailing end of the exploration-context row. Its accessible name
  stays exactly **"Reset view"**, its behaviour is unchanged (`reset` action), and
  its interactive target stays at least 24 × 24 CSS px. It must **not** become an
  icon-only control. The empty state's "Reset view" (`states.tsx:77`) is
  **explicitly out of scope** and is not changed by this spec.
- **Rationale:** Owner: *"Reset view button takes too much place for what it
  is"*. The real cause is that it shares the `styles.reset` class with the two
  destinations, so three identical bordered buttons claim equal weight; charter
  §5 says secondary actions are text, not filled, and that not everything is
  equal. An icon-only reset is rejected: the charter forbids meaning carried by
  an icon with no accessible name, and "Reset view" is not a conventional glyph.
  Keeping the words also preserves SPEC-011 REQ-004, which deliberately labelled
  this control "Reset view" rather than "Reset filters" because the app exposes no
  user-set filters. The empty state's control is that surface's single primary
  action (charter §5, SPEC-003 REQ-008) and must stay prominent.
- **Acceptance criteria:**
  - The reset control's accessible name is still matched by `/Reset view/i` and
    it still restores the default stage and clears the selection.
  - It does not carry the class used by any navigation control, and it is not
    rendered with a border or an accent fill.
  - Its computed interactive box is ≥ 24 × 24 CSS px.
  - It is absent from the taxonomy, Dinordle and profile screens.
  - `states.tsx` is unmodified; `test/ui/spec011-profile-labels.test.tsx` and
    `test/ui/scenario-perf-370.test.tsx` pass unchanged.
- **Verification method:** automated test + manual check against the charter.
- **Evidence location:** `test/ui/exploration-context.test.tsx`

### REQ-007: The puzzle is called Dinordle wherever a user reads it

- **Statement:** Every user-visible occurrence of "Daily Genus" becomes
  **"Dinordle"**:
  - the app-bar destination label (was `ContextBar.tsx:92`);
  - the puzzle screen's eyebrow — `Dinordle · No. <n>` and `Dinordle · practice`
    (`DailyGenusScreen.tsx:435–436`), with the ` · well-known` track suffix
    unchanged;
  - the shared summary produced by `shareSummary`
    (`dailyGenusStorage.ts:236`): `Dinordle <n>[ · well-known] · <score>[ ·
    hint] · <marks>`.

  The doc-comment headers of the puzzle's modules must not continue to present
  "Daily Genus" as the current product name; they name it Dinordle and may note
  the former name once, against SPEC-019/SPEC-020. No identifier, file name, CSS
  class, storage key or URL fragment changes (see Non-goals, DATA-001, API-001).
- **Rationale:** Owner decision, 2026-08-14. Confining the change to strings
  keeps the diff reviewable and keeps the rename free of behavioural risk;
  everything that could carry risk — addresses and stored keys — is frozen by
  DATA-001 and API-001.
- **Acceptance criteria:**
  - No file under `src/` renders the string "Daily Genus" into the DOM or into
    the shared summary.
  - `shareSummary` for a won daily round on the full track begins `Dinordle `.
  - The puzzle screen's eyebrow reads `Dinordle · No. <n>` (daily) and
    `Dinordle · practice` (practice), with ` · well-known` appended on that
    track.
  - The bar's puzzle destination is named "Dinordle".
  - The summary's spoiler-free content rules (SPEC-019 REQ-011) are otherwise
    unchanged: no taxon name, rank, clade name, depth or distance.
- **Verification method:** automated test (unit + rendered screen).
- **Evidence location:** `test/spec019-persistence.test.ts`,
  `test/spec020-share-track.test.ts`, `test/ui/spec019-practice.test.tsx`,
  `test/ui/spec020-track-option.test.tsx`

## Non-functional requirements

### NFR-001: The one-way fragment contract is preserved

- **Statement:** The bar must not change the fragment machinery. The reader
  effect keeps its empty dependency list and its screen ref; the writer effect
  keeps pushing on entry and `replaceState` on exit; `fragmentFor` keeps
  returning `""` for `map`, `taxonomy` and `profile`. Navigating between screens
  with the bar must produce no fragment ping-pong: leaving Dinordle clears the
  fragment exactly once and does not re-open the puzzle.
- **Rationale:** The comments at `ExplorationView.tsx:143–179` document a real
  hazard — a reader that re-runs on screen change re-opens the screen the writer
  is leaving. A navigation bar multiplies the number of screen transitions, so
  this is the failure this change is most likely to cause.
- **Acceptance criteria:**
  - From `#daily`, activating **Map** in the bar leaves the puzzle and ends with
    an empty `location.hash`, and the screen stays on the map (no re-entry).
  - Map → Taxonomy → Dinordle → Map via the bar ends with an empty hash and the
    map screen, with no intermediate re-entry into the puzzle.
  - The `useEffect` that reads the fragment still has an empty dependency array.
  - No routing library appears in `package.json`.
- **Verification method:** automated test (rendered shell driving the bar) +
  inspection.
- **Evidence location:** `test/ui/spec022-app-bar.test.tsx`,
  `test/ui/spec019-entry-point.test.tsx`

### NFR-002: No new dependency, no new network traffic, no data cost

- **Statement:** The bar adds no runtime dependency, performs no fetch, and adds
  no request to any screen. It adds at most one row of chrome (≤ 56 CSS px tall
  at the default type scale) to each screen.
- **Rationale:** SPEC-002 NFR / SPEC-003 NFR-001 (static build, no runtime
  egress) and SPEC-019 NFR-001 / SPEC-020 NFR-001 (the puzzle is offline). The
  bar now renders on the puzzle screen, so it is inside the no-egress perimeter.
- **Acceptance criteria:**
  - `package.json` gains no dependency.
  - The existing no-egress suites still pass, and a shell-level render at
    `#daily` with `fetch` stubbed to throw performs no call.
  - The bar introduces no timer, observer or animation.
- **Verification method:** automated test.
- **Evidence location:** `test/ui/spec019-entry-point.test.tsx`,
  `test/ui/spec019-no-egress.test.tsx`, `test/ui/spec020-no-egress.test.tsx`

## Security and privacy considerations

### SEC-001: The bar stores and transmits nothing

- **Statement:** The app bar must not read or write browser storage, cookies or
  any network resource, and must not record navigation.
- **Rationale:** Consistent with SPEC-019 SEC-002 (the stored payload is ids,
  counts, dates and outcomes and nothing else). Navigation is not persisted
  today and this spec introduces no reason to start.
- **Acceptance criteria:** With a stubbed `KeyValueStore` and a throwing `fetch`,
  driving every bar destination performs no read, no write and no request beyond
  those the destination screens already make.
- **Verification method:** automated test.
- **Evidence location:** `test/ui/spec022-app-bar.test.tsx`

## Data model impact

No new or changed data structure. One structure is explicitly **frozen**.

### DATA-001: Local-storage keys are frozen by the rename

- **Statement:** The rename must not change any local-storage key. The keys stay
  exactly:
  - `paleo-map:daily-genus:round` and `paleo-map:daily-genus:round:wellKnown`
  - `paleo-map:daily-genus:record` and `paleo-map:daily-genus:record:wellKnown`
  - `paleo-map:daily-genus:track`

  The stored payload shapes (`StoredRound`, `StoredRecord`, the track record) are
  unchanged, and no migration is written.
- **Rationale:** `src/app/state/dailyGenusStorage.ts` has **no migration path by
  design**: `readJson` returns `null` for a missing key and every caller treats
  that as "no stored state" — `loadRecord` returns `EMPTY_RECORD` (played 0, won
  0, streak 0, bestStreak 0, empty distribution), `loadRound` returns `null`, and
  `loadTrack` falls back to `"full"`. Renaming the keys to match "Dinordle" would
  therefore **silently zero every player's record and best streak, discard an
  in-progress round, and switch a well-known-track player back to the full
  puzzle** on their next visit — with no error and no way back. It would also
  contradict SPEC-020 REQ-008, which kept the full track's keys unsuffixed
  precisely so existing history survives. The key is an internal identifier, not
  a display name; nothing a user sees contains it.
- **Acceptance criteria:**
  - A test asserts the five literal key strings.
  - A record and an in-progress round written before the rename are read back
    unchanged after it (same keys, same values, same streak).
  - `git grep "paleo-map:daily-genus"` returns the same key strings before and
    after the change.
- **Verification method:** automated test.
- **Evidence location:** `test/spec022-rename-compatibility.test.ts`

## API impact

No new interface. One vocabulary is explicitly **frozen**.

### API-001: The fragment vocabulary is frozen, and no screen becomes addressable

- **Statement:** `#daily`, `#practice`, `#daily-known` and `#practice-known` keep
  their exact spellings and meanings, and `parseFragment` keeps returning `null`
  for everything else — including `#map`, `#taxonomy` and `#daily-genus`. No new
  fragment is introduced; the map, taxonomy and profile screens remain
  non-addressable.
- **Rationale:** Two separate reasons, kept separate. (a) Renaming the fragments
  (say, to `#dinordle`) would break every link and bookmark already shared —
  including the two addresses shipped and documented by SPEC-020 REQ-007 — and
  buys nothing: the existing spellings say *daily* and *practice*, which describe
  the round, not the product, and read correctly under any product name. (b)
  Making map/taxonomy addressable is a genuinely larger change: it would
  generalise the deliberately one-way effect pair (NFR-001), require deciding
  what `#taxonomy` means when the screen has a focus taxon, and re-open whether a
  taxon page needs a per-taxon address — which is a router in all but name. It is
  **not decided silently here**: it is answered *no for this spec* and carried as
  OQ-001 for a follow-up spec.
- **Acceptance criteria:**
  - The four fragment constants are unchanged, and `parseFragment` still returns
    `null` for `""`, `"#"`, `"#map"`, `"#taxonomy"`, `"#dinordle"` and
    `"#daily-genus"`.
  - `fragmentFor` still returns `""` for `map`, `taxonomy` and `profile`.
  - Navigating to the map or the taxonomy screen via the bar leaves
    `location.hash` empty.
- **Verification method:** automated test.
- **Evidence location:** `test/spec022-rename-compatibility.test.ts`,
  `test/ui/spec020-track-fragments.test.tsx`

## UI or UX impact

### UX-001: The bar obeys the charter and the anti-slop checklist

- **Statement:** The bar is a single row on the panel surface, separated from
  what is below it by **one hairline** (the existing `--color-border` bottom
  rule that `.header` already carries). It uses only existing tokens
  (`src/app/styles/tokens.css`); no new token is invented. It contains **no
  card, no bordered box per item, no pill chip, no icon, and no explanatory
  copy**. Navigation labels are plain text in domain language. Teal appears only
  as the current-destination rule and on hover/focus — the accent stays with the
  interaction layer; everything else in the bar is cool neutral.
- **Rationale:** `docs/mockups/design-guidelines.md` §4/§5 and
  `docs/mockups/anti-slop-checklist.md` "Don't" 1–3 and 7. An app bar is exactly
  the surface where the generic look creeps in — a row of bordered pill buttons
  with icons is the default an unconstrained implementation produces.
- **Acceptance criteria:**
  - Bordered containers added by this change: **0** (one hairline rule).
  - Pill-shaped chips added: **0**.
  - Sentences explaining the interface added: **0**.
  - No colour value outside `tokens.css` appears in the bar's styles.
  - The self-check in `docs/mockups/anti-slop-checklist.md` is completed in the
    PR (see "Anti-slop self-check" below).
- **Verification method:** inspection + automated token test.
- **Evidence location:** `test/ui/spec018-tokens.test.ts` (token discipline),
  PR review notes.

### UX-002: Every real state of the bar is designed

- **Statement:** The bar must be designed for all of its real states, not the
  happy path: **narrow viewport** (the row wraps to a second line — wordmark
  above, destinations below; it never collapses into a hidden menu), **long
  wordmark** (wraps or truncates with a title, never clips), **current** and
  **not current** destinations, **focus** and **hover**, **reduced motion** (no
  transition on the current-destination rule), and the screens' own **loading**
  and **error** states (the bar renders identically while the stage is loading,
  while the snapshot failed, and on the Dinordle "no puzzle today" surface, so
  the user is never trapped). No destination is ever **disabled**: all three are
  always reachable.
- **Rationale:** Charter §7. The bar's value is highest precisely when the screen
  below it has failed.
- **Acceptance criteria:**
  - The bar renders with all three destinations while `stageStatus` is `loading`
    and while it is `error`.
  - The bar renders on the Dinordle insufficient-pool error surface.
  - At a 360 px viewport the bar wraps, and no destination is hidden behind a
    menu control.
  - `prefers-reduced-motion: reduce` removes any transition the bar declares.
- **Verification method:** automated test + manual check at 360 px.
- **Evidence location:** `test/ui/spec022-app-bar.test.tsx`

### UX-003: Accessibility

- **Statement:** The bar must be a `<nav>` with an accessible name inside the
  document's single `banner` landmark; every destination must be reachable and
  operable by keyboard in DOM order, must expose a visible focus ring, must meet
  a ≥ 24 × 24 CSS px target (PERF-120), must meet WCAG 2 AA contrast (4.5:1) in
  both current and non-current states, and must convey "current" through
  `aria-current="page"` and a non-colour visual mark (PERF-250). The axe gate
  must find no serious or critical WCAG 2 A/AA violation on any screen that
  now carries the bar.
- **Rationale:** SPEC-002 NFR-002 and the accessibility reconciliation recorded
  in the charter §4 (accessibility wins over the aesthetic hex). The bar is
  repeated on every screen, so a defect in it is a defect four times over.
- **Acceptance criteria:**
  - The axe run on the exploration view, the taxonomy screen and the Dinordle
    screen reports no serious/critical violation, with the bar present.
  - Every destination is reachable by `Tab` and activated by `Enter`/`Space`.
  - The current destination is identifiable with colour disabled.
- **Verification method:** automated test (axe, Playwright) + automated
  component test.
- **Evidence location:** `test/e2e/a11y.e2e.ts`,
  `test/ui/spec022-app-bar.test.tsx`

## Configuration impact

None. No new configuration, default, environment variable or feature flag. The
Dinordle rename introduces no build-time constant; the puzzle's epoch, pools and
salts are untouched.

## Error handling

- **No new error conditions.** The bar is stateless and performs no I/O.
- **Screen build failure.** When a destination's screen cannot build its body
  (the Dinordle insufficient-pool case, a stage load failure, a snapshot load
  failure), the bar still renders, so the user always has a one-action way out.
- **Unknown screen state.** If `state.screen` ever holds a value with no matching
  destination (today only `profile`), the bar renders with no destination marked
  current rather than guessing one (REQ-003).
- **Storage denied.** Unchanged: `browserStore()` already returns `null` and the
  puzzle stays playable for the session. The bar does not touch storage
  (SEC-001).

## Edge cases

- **Double activation of the current destination** — a no-op; must not reset the
  taxonomy focus, the map selection or an in-progress round (REQ-002).
- **Taxon page opened from Dinordle, then Dinordle activated** — returns to the
  daily round of the stored track, which is restored from storage for a daily
  round. A *practice* round in progress is not restored (it is never persisted —
  SPEC-019 REQ-011); this is the same outcome as today's "Back to map", so it is
  not a regression, and it is carried as OQ-002.
- **Taxon page opened from the taxonomy screen, then Taxonomy activated** —
  returns to the same focus taxon (REQ-002).
- **A profile of a taxon outside the taxonomy scope** — unchanged: the taxonomy
  screen already lands on the scope root for an out-of-scope taxon (SPEC-017
  REQ-001).
- **Boot at `#daily` on a cold load** — unchanged: the fragment is applied in the
  reducer initialiser before the first render, so the map never mounts and no
  basemap index is fetched (SPEC-019 REQ-012, NFR-001). The bar must not
  introduce a map mount on the puzzle screen.
- **Browser back button** — unchanged: entering the puzzle pushes a history
  entry, leaving replaces. Navigating between map and taxonomy via the bar
  creates no history entry, exactly as today (they are not addressable, API-001).
- **Very narrow viewport with a long wordmark** — the row wraps; destinations are
  never hidden (UX-002).
- **Keyboard users on every screen** — three extra controls precede the screen
  content in the tab order on the taxonomy, Dinordle and profile screens. This is
  accepted (three controls, all named, no menu to open); no skip link is
  introduced by this spec.
- **A player mid-round when the rename ships** — the round, the record and the
  track choice are read from the unchanged keys and continue (DATA-001). Only the
  words on screen change.
- **A bookmark on `#daily-known`** — still opens the well-known daily (API-001).

## Acceptance criteria

This spec is satisfied when all of the following hold:

1. All four screens render one app bar, from the shell, with Map · Dinordle ·
   Taxonomy and the wordmark, inside a single `banner` landmark (REQ-001,
   REQ-002).
2. The current destination is marked with `aria-current` and a non-colour mark;
   the taxon page marks none (REQ-003).
3. No "Back to map" control remains anywhere in `src/`, and every screen returns
   to the map in one action (REQ-004).
4. The context bar keeps age, group, count, search and the not-a-complete-atlas
   line, and holds no duplicate of anything in the bar (REQ-005).
5. "Reset view" keeps its name and behaviour, loses its button chrome, keeps a
   ≥ 24 × 24 target, and the empty state's reset is untouched (REQ-006).
6. Nothing a user reads says "Daily Genus"; the shared summary begins
   "Dinordle" (REQ-007).
7. The four fragments and the five storage keys are byte-identical to before,
   and a pre-existing record survives the upgrade (DATA-001, API-001).
8. The fragment effects are unchanged and no ping-pong occurs across a
   four-screen navigation sequence (NFR-001).
9. `pnpm run typecheck`, `pnpm test` and the axe gate pass, with every affected
   test **updated**, none skipped or deleted.
10. The anti-slop self-check is completed and recorded in the PR.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Bar on all four screens, from the shell; one banner, one nav; wordmark is not a heading | automated test | `pnpm test test/ui/spec022-app-bar.test.tsx` | `test/ui/spec022-app-bar.test.tsx` | |
| REQ-002 | Three named destinations; state preserved; current destination is a no-op | automated test | `pnpm test test/ui/spec022-app-bar.test.tsx` | `test/ui/spec022-app-bar.test.tsx` | |
| REQ-003 | `aria-current` on the current destination; none on the taxon page; non-colour mark | automated test | `pnpm test test/ui/spec022-app-bar.test.tsx` | `test/ui/spec022-app-bar.test.tsx` | |
| REQ-004 | No "Back to map" in `src/`; map in one action from each screen | automated test + grep in test | `pnpm test test/ui/spec022-app-bar.test.tsx` | `test/ui/spec022-app-bar.test.tsx` | |
| REQ-005 | Banner holds age/group/count/search/disclaimer; no duplicated chrome; stats absent off-map | automated test | `pnpm test test/ui/exploration-context.test.tsx` | `test/ui/exploration-context.test.tsx` | |
| REQ-006 | "Reset view" name and behaviour kept, chrome removed, ≥24×24, empty state untouched | automated test + manual check | `pnpm test test/ui/exploration-context.test.tsx test/ui/spec011-profile-labels.test.tsx` | `test/ui/exploration-context.test.tsx` | |
| REQ-007 | No "Daily Genus" rendered; eyebrow and summary read "Dinordle" | automated test | `pnpm test test/spec019-persistence.test.ts test/spec020-share-track.test.ts test/ui/spec019-practice.test.tsx test/ui/spec020-track-option.test.tsx` | `test/spec019-persistence.test.ts`, `test/spec020-share-track.test.ts` | |
| NFR-001 | Hash cleared once on leaving; no re-entry across a four-screen sequence; empty deps; no router | automated test + inspection | `pnpm test test/ui/spec022-app-bar.test.tsx test/ui/spec019-entry-point.test.tsx` | `test/ui/spec022-app-bar.test.tsx` | |
| NFR-002 | No new dependency; no fetch on any screen; ≤1 row of chrome | automated test | `pnpm test test/ui/spec019-no-egress.test.tsx test/ui/spec020-no-egress.test.tsx` | `test/ui/spec019-entry-point.test.tsx` | |
| SEC-001 | No storage read/write and no request from the bar | automated test | `pnpm test test/ui/spec022-app-bar.test.tsx` | `test/ui/spec022-app-bar.test.tsx` | |
| DATA-001 | Five literal keys unchanged; pre-existing record and round survive | automated test | `pnpm test test/spec022-rename-compatibility.test.ts` | `test/spec022-rename-compatibility.test.ts` | |
| API-001 | Four fragments unchanged; `#map`/`#taxonomy`/`#dinordle` address nothing; hash empty off-puzzle | automated test | `pnpm test test/spec022-rename-compatibility.test.ts test/ui/spec020-track-fragments.test.tsx` | `test/spec022-rename-compatibility.test.ts` | |
| UX-001 | 0 added containers, 0 chips, 0 explanatory sentences, tokens only | inspection + automated token test | `pnpm test test/ui/spec018-tokens.test.ts` + PR self-check | PR review notes | |
| UX-002 | Bar renders in loading, error and insufficient-pool states; wraps at 360 px; reduced motion honoured | automated test + manual check | `pnpm test test/ui/spec022-app-bar.test.tsx` + manual 360 px | `test/ui/spec022-app-bar.test.tsx` | |
| UX-003 | No serious/critical axe violation on map, taxonomy and Dinordle; keyboard operable; ≥24×24; AA contrast | automated test (axe/Playwright) | `pnpm run test:e2e` (a11y) | `test/e2e/a11y.e2e.ts` | |

## Test plan

Tests are **updated**, never skipped or deleted. Every path below was checked
against the working tree.

### New tests

- **`test/ui/spec022-app-bar.test.tsx`** (jsdom, renders `ExplorationView`) —
  REQ-001…004, NFR-001, SEC-001, UX-002:
  bar present on all four screens; exactly one `banner` and one named `nav`;
  wordmark is not a heading; the three destinations and their state-preserving
  behaviour; `aria-current` present/absent per screen; one-action return from
  each screen; no "Back to map" string in `src/app/components/`; the
  map → taxonomy → Dinordle → map sequence ends with an empty hash and no
  re-entry; no storage or `fetch` access from the bar; the bar renders in the
  loading and error states.
- **`test/spec022-rename-compatibility.test.ts`** (node, no DOM) — DATA-001,
  API-001: the five literal storage keys; a record and an in-progress round
  written under the old keys read back unchanged; the four fragment constants and
  `parseFragment` rejecting `#map`, `#taxonomy`, `#dinordle`, `#daily-genus`;
  `fragmentFor` returning `""` for `map`/`taxonomy`/`profile`.

### Existing tests that must be updated

Navigation / back controls:

- `test/ui/exploration-context.test.tsx` — the banner now also holds the three
  destinations; the `within(banner)` assertions for Selected age / Group /
  Occurrences and the `/Reset view/i` button remain valid (the context row stays
  inside the same `<header>`), but the test must additionally assert the nav and
  the reset's new, non-navigation styling (REQ-005/006).
- `test/ui/spec017-screen.test.tsx:153–156` — asserts `TaxonomyScreen`'s own
  back button calls `onBack`. That control is removed (REQ-004); the assertion
  moves to `spec022-app-bar.test.tsx` at the shell level, and the component test
  drops the `onBack` click. (`onBack` may remain a prop or be removed; either way
  the test stops driving a control that no longer exists.)
- `test/ui/data-states.test.tsx:66` and `:87` — both assert a "Back to map"
  button inside a directly-rendered `TaxonProfile`. Those assertions are removed;
  the return path is covered at the shell level.
- `test/ui/locality-mode.test.tsx:56` — asserts a
  `/back to map|↤|←|back/i` affordance after landing on the profile; update the
  query to the bar's **Map** destination.
- `test/ui/spec019-entry-point.test.tsx:117–124` — "leaving the puzzle clears the
  fragment" clicks `/back to map/i`; update to the bar's **Map** destination.
  Line 101's `/Daily Genus · No\./i` becomes `/Dinordle · No\./i`.
- `test/e2e/spec019-daily.e2e.ts:47–50` — after "Open taxon page", asserts a
  visible `/back to map/i` button; update to the bar's **Map** destination.

Rename:

- `test/ui/spec019-states.test.tsx:75` — `/Daily Genus \d+ · 1\/8/` →
  `/Dinordle \d+ · 1\/8/`.
- `test/ui/spec019-practice.test.tsx:57` — `/Daily Genus · practice/i` →
  `/Dinordle · practice/i`.
- `test/ui/spec020-track-option.test.tsx:107` —
  `/Daily Genus · No\. \d+ · well-known/i` → `/Dinordle · No\. \d+ · well-known/i`.
- `test/spec019-persistence.test.ts:206` —
  `"Daily Genus 1 · 6/8 · hint · ▲·▲▲·▲"` → `"Dinordle 1 · 6/8 · hint · ▲·▲▲·▲"`.
- `test/spec020-share-track.test.ts:34,39` — `"Daily Genus 1 · 2/8 · ▲▲"` and
  `"Daily Genus 1 · well-known · 2/8 · ▲▲"` → the `Dinordle` forms.
- `test/e2e/a11y.e2e.ts:45` — `getByRole("button", { name: "Taxonomy", exact:
  true })` still resolves, now against the bar; keep, and confirm it is unique.
  `:63` — `name: "Daily Genus"` → `"Dinordle"`.
- `test/ui/spec019-no-egress.test.tsx:28`, `test/ui/spec020-no-egress.test.tsx:22`,
  `test/ui/spec019-harness.tsx:2` — the product name appears only in an error
  message and a doc comment; update for consistency (no behavioural effect).

### Existing tests confirmed **unaffected** (must keep passing unmodified)

- `test/ui/spec011-profile-labels.test.tsx` — the empty state's "Reset view"
  (out of scope, REQ-006).
- `test/ui/scenario-perf-370.test.tsx` — the empty-state reset flow.
- `test/ui/spec020-track-fragments.test.tsx` — the fragment vocabulary is frozen
  (API-001); it must pass byte-unmodified, which is itself the evidence.
- `test/e2e/exploration.e2e.ts` — boots the map and asserts the timeline, the
  reconstruction label, "Dinosaurs" and the sidebar; none of those move.
- All `test/spec019-*` / `test/spec020-*` pure-logic suites other than the two
  summary-string assertions listed above.

### Manual checks

- 360 px viewport: the bar wraps, no destination hidden (UX-002).
- Keyboard-only pass across all four screens (UX-003).
- Visual check of the bar against `docs/mockups/design-guidelines.md` §4/§5 and
  the anti-slop self-check (UX-001).

### Commands

```
pnpm run typecheck
pnpm test
pnpm run test:e2e     # includes the axe gate (see package.json for the exact script)
```

## Rollback plan

Revert the PR. The change is additive chrome plus string edits: there is no data
migration, no schema change, no new dependency and no address change, so nothing
persists that a revert would strand. Specifically:

- Player records, in-progress rounds and track choices are untouched by design
  (DATA-001), so a revert restores the old labels over identical stored state.
- Shared `#daily` / `#practice` / `#daily-known` / `#practice-known` links keep
  working both before and after a revert (API-001).
- If only the rename must be undone, revert the REQ-007 string commit alone; the
  bar does not depend on the name.
- If only the bar must be undone, the three back controls and the two context-bar
  buttons return with the revert; no screen becomes unreachable in the interim.

## Open questions

- [ ] **OQ-001 (deferred, deliberately): should the map, taxonomy and profile
      screens become fragment-addressable now that they are first-class
      destinations?** Answered **no for this spec** (API-001). It requires
      generalising the deliberately one-way effect pair documented at
      `ExplorationView.tsx:143–179`, deciding what `#taxonomy` means when the
      screen carries a focus taxon, and deciding whether a taxon page needs a
      per-taxon address — which is a router in all but name, and
      `test/ui/spec019-entry-point.test.tsx` currently asserts there is none.
      Deferred to a follow-up spec; not decided silently.
- [ ] **OQ-002 (deferred): should the Dinordle destination restore the exact mode
      the player last used (practice as well as daily)?** This spec keeps today's
      behaviour — the destination opens the **daily** round on the stored track.
      Restoring a practice round would also require persisting practice state,
      which SPEC-019 REQ-011 deliberately does not do.
- [x] **OQ-003 (answered): what does the bar do on a narrow viewport?** It wraps
      to two rows. It never collapses into a hamburger or drawer (UX-002,
      Non-goals).
- [x] **OQ-004 (answered): do code identifiers and file names get renamed?** No
      (Non-goals). Only user-visible strings and the puzzle modules' doc-comment
      headers change.
- [x] **OQ-005 (answered): is the empty state's "Reset view" in scope?** No
      (REQ-006). It is that surface's primary action and is left untouched.

## Human decisions required

- [x] **Approve this spec** (status → `Approved`, move to `docs/specs/approved/`).
- [x] **Confirm the wordmark casing "Dinordle"** as it will appear in the bar,
      the puzzle eyebrow and every shared result. *(Owner chose the name in
      session on 2026-08-14; this box confirms the exact rendering.)*
- [x] **Approve the two amendments below** for transplant into SPEC-019 and
      SPEC-020. *(Owner approval given in session, 2026-08-14; the box records
      the transplant.)*
- [x] **Confirm OQ-001 is deferred** rather than folded into this change.

**Approval record.** Owner approval recorded in session, 2026-08-14 (nelsonjeanrenaud@gmail.com). The owner confirmed every decision in this section and approved the spec for implementation.

## Conflict check

This spec touches surfaces owned by five implemented/approved specs. No
contradiction was found; each interaction is a scoped, amendment-covered change.

- **SPEC-003 REQ-001** (persistent context: age in Ma, group, occurrence count,
  controls not hidden behind menus) — **preserved.** The three stats stay
  permanently visible on the exploration view; they move nowhere. The bar adds a
  row above them and hides nothing behind a menu (UX-002 forbids a collapsing
  menu). No amendment needed.
- **SPEC-003 REQ-005** (a reset control restores defaults) and **SPEC-011
  REQ-004** (it is labelled "Reset view", not "Reset filters") — **preserved.**
  REQ-006 changes weight and placement only; the name, the behaviour and the
  empty-state control are unchanged. No amendment needed.
- **SPEC-003 REQ-007 / FONC-1080 / CONS-470** (return to the map in ≤1 action
  from a taxon profile) — **preserved and improved**: one action, and now to any
  of three destinations. No amendment needed.
- **SPEC-013** (taxon search) — unchanged; it stays in the context row.
- **SPEC-017** (taxonomy screen) — its "← Back to map" control is removed
  (REQ-004) and its `<h1>` is untouched (REQ-001 keeps the wordmark out of the
  heading tree). The screen's own requirements are unaffected, so **no amendment
  is proposed**; only `test/ui/spec017-screen.test.tsx` is updated.
- **SPEC-019 REQ-012** (entry point "from the context bar"; `#daily` /
  `#practice`) — the entry point moves to the app bar and the label changes;
  the fragments do not. **Amendment required** (below).
- **SPEC-019 REQ-011** (spoiler-free summary) — the summary's leading label
  becomes the product name; its content rules and storage keys are unchanged.
  **Covered by the same amendment.**
- **SPEC-020 REQ-006** (the summary names its track) — same leading-label change;
  the track suffix rule is unchanged. **Amendment required** (below).
- **SPEC-020 REQ-005 / REQ-007 / REQ-008** (per-track keys, four addresses,
  existing history survives) — **explicitly unchanged** by DATA-001 and API-001;
  recorded in the amendment's behavioural impact so no future agent "aligns" them
  with the new name.
- **Spec numbering** — `SPEC-021` is unused in the tree at `c1bfb1d`; `SPEC-022`
  is free and `docs/SPEC_INDEX.md` has no row for either. If a concurrent session
  claims `SPEC-022`, this spec is renumbered before approval.
- **`docs/SPEC_INDEX.md`** needs a row for this spec and updated titles for
  SPEC-019/020 once the amendments land. That edit is out of this spec's file
  scope and is an implementation task.

## Required amendments to existing specs

The blocks below are ready to transplant verbatim. **Do not edit SPEC-019 or
SPEC-020 from this spec** — transplant these at implementation time, after the
owner's approval box above is ticked.

### To transplant into `docs/specs/implemented/SPEC-019-daily-genus-puzzle.md`

> **Placement note:** SPEC-019's "Spec amendments" section currently contains
> only the **unfilled template block** `### AMEND-001` (with empty fields).
> **AMEND-001 is therefore the next free number**: replace that empty block with
> the one below rather than appending an AMEND-002 beside it. Also update the
> frontmatter `title` and the `# SPEC-019:` heading from "Daily Genus" to
> "Dinordle (formerly Daily Genus)".

```markdown
### AMEND-001 — the puzzle is named Dinordle, and its entry point is the global app bar

- **Date:** 2026-08-14
- **Reason:** The owner named the product **Dinordle** (chosen from Cladle /
  Saurdle / Dinordle / Taxordle) and asked for a real app bar carrying Map /
  Dinordle / Taxonomy on every screen (SPEC-022). "Daily Genus" was a
  description, not a name, and the puzzle's only entry point was one button in
  the map screen's context bar — invisible from the other three screens.
- **Changed requirements:** **REQ-012** — the entry point is the **global app
  bar** (SPEC-022 REQ-001/002), present on all four screens, and the control is
  labelled **Dinordle**; the fragments `#daily` and `#practice` and their
  meanings are **unchanged**, and no routing library is added. **REQ-011** — the
  shared summary's leading label is the product name and therefore now begins
  `Dinordle `; its spoiler-free content rules (no taxon name, rank, clade name,
  depth or distance) and its storage behaviour are unchanged. Every other prose
  use of "Daily Genus" in this spec, including the title, becomes "Dinordle". No
  other requirement changes.
- **Behavioral impact:** Display only, plus a better entry point. Explicitly
  **unchanged**: the four URL fragments (SPEC-022 API-001), the local-storage
  keys `paleo-map:daily-genus:round` / `:record` / `:track` and the stored
  payload shapes (SPEC-022 DATA-001) — renaming them would silently zero every
  player's record and streak and drop an in-progress round, because
  `dailyGenusStorage.ts` has no migration path and reads a missing key as "no
  stored state". Also unchanged: selection, pools, guess evaluation, the revealed
  tree, the time clue, the hint, the countdown, rollover, and SEC-001/SEC-002.
  The screen's own "← Back to map" button is removed; the app bar's **Map**
  destination is the one-action return, so REQ-012's back contract still holds.
- **Test impact:** `test/spec019-persistence.test.ts` (summary string),
  `test/ui/spec019-states.test.tsx`, `test/ui/spec019-practice.test.tsx`,
  `test/ui/spec019-entry-point.test.tsx` (label and the return control),
  `test/e2e/spec019-daily.e2e.ts` and `test/e2e/a11y.e2e.ts` update their
  expected strings and drive the app bar instead of the removed back button.
  `test/ui/spec020-track-fragments.test.tsx` must pass **unmodified** — that is
  the evidence the addresses did not move. New:
  `test/spec022-rename-compatibility.test.ts` pins the literal storage keys and
  fragments. No test is skipped or deleted.
- **Human approval reference:** Owner approval in session, 2026-08-14
```

### To transplant into `docs/specs/implemented/SPEC-020-daily-genus-well-known-track.md`

> **Placement note:** SPEC-020 already uses **AMEND-001** and **AMEND-002**, so
> the next free number is **AMEND-003**; append the block after AMEND-002. Also
> update the frontmatter `title` and the `# SPEC-020:` heading from "Daily Genus"
> to "Dinordle".

```markdown
### AMEND-003 — the product is named Dinordle; addresses and per-track keys are unchanged

- **Date:** 2026-08-14
- **Reason:** The owner renamed the puzzle from "Daily Genus" to **Dinordle**
  (SPEC-022 REQ-007). This spec names the product in its title, its prose and in
  the one string it owns: the shared summary's label.
- **Changed requirements:** **REQ-006** only — the shared summary's leading label
  is the product name and now reads `Dinordle <n> · well-known · …`; the rule
  this requirement exists for, that the summary **names its track**, and the
  ` · well-known` suffix itself, are unchanged. Every prose use of "Daily Genus",
  including the title, becomes "Dinordle". **REQ-001…REQ-005, REQ-007 and
  REQ-008 are unchanged.**
- **Behavioral impact:** Display only. Explicitly **unchanged**, and deliberately
  so: **REQ-007** — the four addresses `#daily`, `#practice`, `#daily-known`,
  `#practice-known` keep their exact spellings, because renaming them would break
  every link and bookmark already shared. **REQ-005/REQ-008** — the per-track
  storage keys (`paleo-map:daily-genus:record[:wellKnown]`,
  `…:round[:wellKnown]`, `…:track`) keep their exact spellings, because
  `dailyGenusStorage.ts` has no migration path: a renamed key reads as absent,
  which would reset played/won/streak/best-streak to zero, discard an
  in-progress round, and silently switch a well-known player back to the full
  track — precisely the regression REQ-008 exists to prevent. The popularity
  signal, the pool, the per-track salt and the degradation behaviour are
  untouched.
- **Test impact:** `test/spec020-share-track.test.ts` and
  `test/ui/spec020-track-option.test.tsx` update their expected summary/eyebrow
  strings. `test/ui/spec020-track-fragments.test.tsx` and
  `test/spec020-popularity-cache.test.ts` must pass **unmodified**. New:
  `test/spec022-rename-compatibility.test.ts` asserts the per-track keys and the
  four fragments literally. No test is skipped or deleted.
- **Human approval reference:** Owner approval in session, 2026-08-14
```

## Anti-slop self-check

Run against `docs/mockups/anti-slop-checklist.md` for the app bar. Counts are
for what **this change adds**.

- **Bordered containers: 0.** The bar reuses the one hairline bottom rule
  `.header` already has. No box per item, no card.
- **Pill-shaped chips: 0.** Destinations are plain text controls; the current one
  is marked by weight and a rule, not a filled capsule.
- **Sentences explaining how to read the screen: 0.** The only prose in the
  banner is the pre-existing not-a-complete-atlas line, which is a data caveat
  required by FONC-400, not a caption for the interface.
- **Would this layout work unchanged for a CRM, an analytics tool and a to-do
  app?** A wordmark plus three destinations is a generic *form* — this is the
  honest answer, and the reason the charter is applied hard here: the
  specificity comes from what the bar refuses (no icons, no avatar, no
  notification bell, no search field, no menu, no chips) and from the destination
  names, which are the product's own nouns.
- **Is the subject of the screen the largest thing on it?** Yes. The bar is one
  row; the map, the cladogram and the taxonomy fan keep the canvas. This is also
  why the wordmark is not a heading (REQ-001).
- **Is every colour carrying a meaning defined in the charter?** Yes. Cool
  neutrals for the bar; teal only on the current destination's rule and on
  focus/hover — the accent stays with the interaction layer.
- **Is every state also legible in shape and in words?** Yes. Current = heavier
  weight + rule + `aria-current="page"`; never colour alone (PERF-250).
- **Is the content real?** Yes — three real destinations, the real product name,
  the real disclaimer.
- **Does anything here exist because a component library made it easy?** No; the
  project uses no component library and this change adds no dependency (NFR-002).

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | App bar | `src/app/components/AppBar.tsx` (new), `ExplorationView.tsx` (all four returns), `exploration.module.css` | `test/ui/spec022-app-bar.test.tsx` | Not started |
| REQ-002 | App bar navigation | `AppBar.tsx`, `ExplorationView.tsx` dispatchers (`backToMap`, `openDaily`, `openTaxonomy`) | `test/ui/spec022-app-bar.test.tsx` | Not started |
| REQ-003 | App bar navigation | `AppBar.tsx`, `exploration.module.css` (`.navCurrent`) | `test/ui/spec022-app-bar.test.tsx` | Not started |
| REQ-004 | Screen headers | `TaxonProfile.tsx`, `TaxonomyScreen.tsx`, `DailyGenusScreen.tsx` | `test/ui/spec022-app-bar.test.tsx`, `test/ui/spec017-screen.test.tsx`, `test/ui/data-states.test.tsx`, `test/ui/locality-mode.test.tsx` | Not started |
| REQ-005 | Context bar | `ContextBar.tsx` (props and brand/button removal) | `test/ui/exploration-context.test.tsx` | Not started |
| REQ-006 | Reset control | `ContextBar.tsx`, `exploration.module.css` (`.resetQuiet`) | `test/ui/exploration-context.test.tsx` | Not started |
| REQ-007 | Product name | `AppBar.tsx`, `DailyGenusScreen.tsx` (eyebrow), `dailyGenusStorage.ts` (`shareSummary`) | `test/spec019-persistence.test.ts`, `test/spec020-share-track.test.ts`, `test/ui/spec019-practice.test.tsx`, `test/ui/spec020-track-option.test.tsx` | Not started |
| NFR-001 | Fragment effects | `ExplorationView.tsx:155–179` (unchanged), `screenFragment.ts` (unchanged) | `test/ui/spec022-app-bar.test.tsx`, `test/ui/spec019-entry-point.test.tsx` | Not started |
| NFR-002 | Build + runtime | `package.json` (unchanged), `AppBar.tsx` | `test/ui/spec019-no-egress.test.tsx`, `test/ui/spec020-no-egress.test.tsx` | Not started |
| SEC-001 | App bar | `AppBar.tsx` | `test/ui/spec022-app-bar.test.tsx` | Not started |
| DATA-001 | Puzzle persistence | `src/app/state/dailyGenusStorage.ts` (keys unchanged) | `test/spec022-rename-compatibility.test.ts` | Not started |
| API-001 | Fragments | `src/app/state/screenFragment.ts` (unchanged) | `test/spec022-rename-compatibility.test.ts`, `test/ui/spec020-track-fragments.test.tsx` | Not started |
| UX-001 | Visual system | `exploration.module.css`, `src/app/styles/tokens.css` (unchanged) | `test/ui/spec018-tokens.test.ts`, PR self-check | Not started |
| UX-002 | App bar states | `AppBar.tsx`, `exploration.module.css` | `test/ui/spec022-app-bar.test.tsx` | Not started |
| UX-003 | Accessibility | `AppBar.tsx` (`nav`, `aria-current`), `exploration.module.css` | `test/e2e/a11y.e2e.ts`, `test/ui/spec022-app-bar.test.tsx` | Not started |

## Implementation notes

*(To be filled during implementation.)* Points already settled that the
implementer must not re-decide:

1. The bar is rendered by `ExplorationView`, once per screen branch — not inside
   `TaxonomyScreen`, `DailyGenusScreen` or `TaxonProfile`. This is what keeps the
   SPEC-017/019/020 component tests, including the two no-egress suites, valid.
2. The `<header>` element stays the single `banner`. On the map screen it holds
   two rows (bar, then exploration context); elsewhere it holds the bar alone.
3. Destinations are `<button>`s inside a named `<nav>`, not links — the app has
   no URL for the map or the taxonomy screen and is not gaining one (API-001).
4. `fragmentFor`, `parseFragment` and the two effects in `ExplorationView` are
   **not touched**. If a change to them appears necessary, stop: it means the
   scope has drifted into OQ-001.
5. No token is added to `src/app/styles/tokens.css`.
6. `docs/SPEC_INDEX.md` needs a row for SPEC-022 and the two amended titles.

## Assumptions

- **A-1.** "Dinordle" is spelled and cased exactly as written here in all user-
  visible text (owner's choice, 2026-08-14; confirmation box in *Human decisions
  required*).
- **A-2.** The owner's "Reset view button takes too much place" is about visual
  weight and equal footing with navigation, not about removing the control. It is
  kept, with its name and behaviour intact.
- **A-3.** The order Map · Dinordle · Taxonomy is the owner's stated order and is
  taken as the required order.
- **A-4.** The taxon page is a detail view, not a fourth destination; it
  therefore has no bar item and marks none current.
- **A-5.** Losing the map screen's `<h1>` (the brand title, which was chrome) is
  acceptable: landmarks carry this app's structure and the screen's subject is
  the map. Recorded so a later accessibility review sees the decision rather than
  an oversight.

## Spec amendments

> Required for any behavioral change after the spec is Approved. None yet — this
> spec is `Draft`.

### AMEND-001

- **Date:**
- **Reason:**
- **Changed requirements:**
- **Behavioral impact:**
- **Test impact:**
- **Human approval reference:**

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [x] Open questions are resolved or explicitly deferred (OQ-001 and OQ-002
      deferred with reasons; OQ-003…005 answered).
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed.
- [x] Risks listed (rollback plan and edge cases considered).
- [x] Human approval recorded before status set to Approved.
