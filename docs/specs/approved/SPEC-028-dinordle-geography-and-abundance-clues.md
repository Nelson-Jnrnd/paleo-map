---
doc_type: spec
spec_id: SPEC-028
title: Dinordle geography and abundance clue channels; the silhouette hint is retired
status: Approved
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components:
  - src/app/state/dailyGenus.ts
  - src/app/components/DailyGenusScreen.tsx
  - src/app/components/dailyGenus.module.css
  - src/app/state/dailyGenusStorage.ts
  - src/app/data/atlas.ts
  - src/read/api.ts
  - scripts/gen_geography.ts
affected_interfaces:
  - ReadApi.countriesFor
  - GameTaxon
  - Guess
  - shareSummary
supersedes: []
superseded_by:
depends_on:
  - SPEC-019
  - SPEC-020
  - SPEC-024
conflicts_with: []
last_verified_at:
---

# SPEC-028: Dinordle geography and abundance clue channels; the silhouette hint is retired

## Summary

Dinordle gives a player two clue channels per guess — the deepest shared clade
(the tree) and a time verdict (the Ma column) — and one optional one-shot hint,
the answer's silhouette. The owner reports the game is too hard even on the
well-known track, and that the silhouette hint "is not helping because it's not
precise at all."

This spec adds **two new per-guess clue channels** derived from the snapshot —
**shared countries of occurrence** and an **occurrence-count comparison** — and
**retires the silhouette as a hint**. It introduces one new committed data
artifact, a per-taxon country index, because the shipped read model does not
carry occurrence geography at the taxon level.

## Context

The measurements below were taken against the shipped snapshot
(`retrievedOn 2026-07-26`, `public/data/reference.json` plus the 30 committed
`stage-*.json` files) on 2026-08-26, and against the app running in Chromium.

**Why the silhouette hint fails.** `pipeline/silhouettes.ts` resolves a genus to
a PhyloPic silhouette by name and then falls back up the parent chain to the
nearest relative PhyloPic knows. That yields the 100% coverage SPEC-019 REQ-008's
rationale relies on, but the coverage is mostly borrowed:

- 1,731 valid genera resolve to **403 distinct silhouettes**.
- Only **236 genera (14%)** carry a silhouette no other genus uses.
- The single most-reused silhouette stands in for **86 genera**.

So for roughly six genera in seven the hint shows an outline that is not the
animal, and nothing on the screen says so. It is a documented fallback presented
as a fact — which is the one thing the charter forbids.

**Why the two new channels.** Coverage measured across the 1,731 valid genera:

| Signal | Coverage | Discriminating power |
| --- | --- | --- |
| Country of occurrence | 1,730 / 1,731 | 72 countries; **85% of genera occur in exactly one** |
| Diet | 1,622 / 1,731 | Herbivore 866 / Carnivore 706 / Omnivore 46 |
| Occurrence count | 1,731 / 1,731 | median 1, p75 3, max 431 |
| Habitat | 1,731 / 1,731 | 98% "Terrestrial" — informative only for 25 marine genera |
| Locomotion | 1,731 / 1,731 | 1,729 of 1,731 "Actively mobile" — no information |
| Body length / mass | 0 in PBDB; 77 in the enrichment cache | too sparse |

Geography is the strongest available signal and abundance is the cheapest, both
fully covered, both from PBDB rather than Wikipedia prose. Diet is deliberately
held back (see Non-goals).

## Problem statement

The puzzle's two existing channels do not narrow a 985-genus (or 250-genus)
answer space inside eight guesses often enough for the game to be enjoyable, and
its only rescue hint is unreliable in a way the screen does not disclose.

## Goals

- Give each guess two further channels of true, sourced feedback.
- Stop presenting a phylogenetic fallback as if it were the answer's own outline.
- Add no upstream dependency and no network at play time.

## Non-goals

- **Not** adding diet as a third new channel in this spec. Four channels at once
  is untestable as a difficulty change; diet is recorded as the next candidate if
  measurement shows two are not enough.
- **Not** changing `MAX_GUESSES`, the answer pools, the selection algorithm, the
  per-track records, or the puzzle numbering.
- **Not** regenerating the shipped snapshot artifacts.
- **Not** removing the silhouette from the reveal, or from `derivePool`'s
  eligibility gate — there it is a proxy for "recognisable when revealed" and
  keeps that job.

## Users or actors

A Dinordle player, on either track, on desktop or phone, with or without a
pointer, with or without colour vision.

## Functional requirements

### REQ-001: A per-taxon country index is derived from the committed snapshot

- **Statement:** A committed artifact `public/data/geography.json` maps every
  taxon id that has at least one occurrence to the **sorted, de-duplicated list
  of country codes** of its occurrences. A code is the final comma-separated
  segment of an occurrence's `modernPosition.value.region`, trimmed, accepted
  only when it matches `/^[A-Z]{2}$/`. An occurrence naming a taxon the shipped
  reference does not carry is excluded, so every id in the index resolves —
  measured: 78 such taxa in the shipped snapshot, from ranks the reference
  prunes. Codes are recorded **verbatim as PBDB states them** — they are not normalised to ISO (PBDB writes `UK`, not `GB`),
  because rewriting them would make this file assert something its source does
  not. The artifact is generated by `scripts/gen_geography.ts` reading only
  committed files (`public/data/stage-*.json` and `public/data/reference.json`),
  with no network access, and is byte-identical on re-run.
- **Rationale:** The read model carries `modernPosition` per **occurrence**, but
  occurrences are delivered per stage and Dinordle would otherwise have to load
  all 30 stage files (29 MB) to know one genus's countries. The taxon-level
  aggregate is the same shape of precomputation SPEC-008 AMEND-001 already makes
  for `occurrenceCount` and `timeSpan`. It is a **separate artifact rather than a
  new profile field** because adding a profile field would require regenerating
  `reference.json`, and the offline `gen:web-data` path builds from the fixture
  client — regenerating offline would silently replace the shipped 1,731-genus
  dataset with the fixture subset. Deriving an index over the committed data is
  reproducible without that risk.
- **Acceptance criteria:**
  - Running the script twice produces identical bytes.
  - Every code in the output matches `/^[A-Z]{2}$/`.
  - The taxon ids in the output are a subset of those in `reference.json`.
  - The artifact is ≤ 128 KB (measured: 46.6 KB — 1,946 taxa and 94 country
    codes folded from 41,116 occurrences across 30 stage files).
  - The script makes no network request.
- **Verification method:** automated test against the shipped artifact.
- **Evidence location:** `test/spec028-geography-index.test.ts`

### REQ-002: Each guess reports the countries it shares with the answer

- **Statement:** For every guess, the game computes the **intersection** of the
  guess's country set and the answer's country set, and displays it. When the
  intersection is empty the screen says so in words. When either the guess or the
  answer has no recorded countries at all, the channel reports "not recorded" for
  that guess and never an empty intersection — an absence of data must not read
  as a "no overlap" verdict.
- **Rationale:** The owner's decision, 2026-08-26: reveal collisions between the
  guess's countries and the answer's. Intersection rather than a same/different
  boolean because 85% of genera sit in exactly one country, so a shared code is
  usually a strong, honest narrowing, and it publishes only a subset of the
  answer's own countries — never the full set.
- **Acceptance criteria:**
  - The displayed set is exactly the intersection, sorted, with no code that is
    not in both sets.
  - An empty intersection renders a worded "no shared country", not blank.
  - A guess or answer with no country data renders "not recorded", distinct from
    an empty intersection.
  - The verdict is a pure function of the two country sets.
- **Verification method:** automated test (pure function + rendered screen).
- **Evidence location:** `test/spec028-clue-channels.test.ts`,
  `test/ui/spec028-clue-ledger.test.tsx`

### REQ-003: Each guess reports how its occurrence count compares to the answer's

- **Statement:** For every guess the game compares the guess's
  `occurrenceCount` to the answer's and reports one of four verdicts:
  - **same** — the counts are equal;
  - **more** — the answer has more occurrences than the guess;
  - **fewer** — the answer has fewer occurrences than the guess;
  - **not recorded** — either count is absent.

  A **more** or **fewer** verdict is additionally qualified as **close** when the
  two counts are within a factor of two of each other, that is when
  `max(a, b) <= 2 * min(a, b)`, and **far** otherwise.
- **Rationale:** The owner asked for an up/down arrow with "close" coloured and
  "exact" coloured differently, and left the definition of close to this spec.
  A **ratio** band rather than an absolute one because the distribution is
  extremely skewed — median 1, p75 3, maximum 431 — so an absolute ±2 band would
  make 429-vs-431 "close" while calling 30-vs-34 "far". A ratio is scale-free.
  The factor of two was chosen by measurement over 200,000 random guess/answer
  pairs from each pool:

  | Band | Full pool | Well-known pool |
  | --- | --- | --- |
  | within 2× | 20.7% close | 20.8% close |
  | within 3× | 29.9% close | 31.7% close |
  | absolute ±2 | 25.7% close | 18.7% close |

  Within 2× is the only candidate that lands near a fifth of guesses on **both**
  pools, so the qualifier means the same thing on either track — which an
  absolute band does not.
- **Acceptance criteria:**
  - `same` requires exact equality of the two counts.
  - `close` is true exactly when `max <= 2 * min` and the counts differ.
  - The direction is stated from the **answer's** point of view: "more" means the
    answer has more.
  - The verdict is a pure function of the two counts.
- **Verification method:** automated test (pure function), including the
  boundary cases 1-vs-2 (close), 1-vs-3 (far), 10-vs-20 (close), 10-vs-21 (far).
- **Evidence location:** `test/spec028-clue-channels.test.ts`

### REQ-004: Both verdicts are marks on the guess's own row in the tree

- **Statement:** The two verdicts are rendered **on the cladogram row that is the
  guessed genus** — the `guess` row, or the `cut` row in the case where the guess
  *is* the branch it eliminated. No separate guess list, panel, table or card is
  introduced. Each such row carries, after the taxon name:
  - the shared country codes as plain text in the product's existing
    middot-separated idiom (`CA · US`), never as chips or badges; or a worded
    "no shared country"; or a worded "not recorded";
  - the occurrence verdict as a single compact mark (UX-001).

  Rows that are **not** a guess — the established trunk and a ruled-out clade
  that is not itself the guess — carry neither mark. SPEC-025's invariants hold
  unchanged: one label per row, one line, `white-space: nowrap`, no wrapping and
  no truncation, with the region scrolling horizontally and the trunk pinned at
  its left edge.
- **Rationale:** The design charter and
  `docs/mockups/anti-slop-checklist.md` both point here, and the checklist's
  worked example for this very screen rejects the alternative by name: "Separate
  guess list in the right panel" → "No guess list — each guess **is** the branch
  it ruled out", and "a verdict is a mark on the object, not a badge beside it".
  A guess already has a row on this screen; two facts about that guess belong on
  it. A second aligned region would also be the "symmetric equal-weight panels"
  the checklist warns against, and would caption the interface with a third
  heading.
  Plain codes rather than chips because the map sidebar already renders locality
  data as middot-separated plain text (`72.2–66 Ma · SMP Loc. 410b, Willow
  Wash`) — the product has an idiom for this and it is not a badge.
- **Acceptance criteria:**
  - Exactly the guess rows carry the marks; trunk rows and non-guess ruled-out
    rows carry neither.
  - Every guess made has its marks on exactly one row.
  - No new bordered container, panel, card or chip is added to the screen.
  - SPEC-025 NFR-001's non-overlap gate still passes at every viewport in its
    matrix, with the marks present.
  - Nothing restates the shared clade, the ruled-out branch, or the time verdict.
- **Verification method:** automated test (rendered screen) plus the existing
  SPEC-025 geometry gate.
- **Evidence location:** `test/ui/spec028-clue-ledger.test.tsx`,
  `test/e2e/cladogram.e2e.ts`
- **Open risk, to be judged in the browser before this requirement is closed:**
  the marks lengthen guess rows, and SPEC-025 UX-001 measured the deepest
  diagram at 535 px against a 512 px column basis — already at the edge of its
  horizontal scroll. If eight guesses at 1440 px prove unreadable or force
  constant scrolling, the fallback is an amendment to this requirement, not a
  quiet redesign.

### REQ-005: The silhouette hint is retired

- **Statement:** The optional silhouette hint of SPEC-019 REQ-008 is removed: no
  reveal control, no `hintUsed` round state, no hint marker in the shared
  summary, and no `HINT_AFTER_GUESSES` gate. The silhouette continues to be shown
  **at the reveal**, where it accompanies the named answer and therefore asserts
  nothing the player must guess from. `derivePool`'s requirement that an answer
  have a silhouette is unchanged.
- **Rationale:** Owner decision, 2026-08-26 ("Demote the silhouette it's
  useless"), supported by the measurement in Context: for 86% of genera the
  silhouette is a relative's outline, so as a hint it is unreliable in a way the
  screen never disclosed. Retiring it is preferable to labelling it, because a
  hint captioned "this may not be the animal" is not a hint. At the reveal the
  same image is harmless: the answer is already named.
- **Acceptance criteria:**
  - No control offering a silhouette hint exists in any state of the screen.
  - A finished round's shared summary contains no hint marker.
  - The reveal still shows the answer's silhouette when it has one.
  - A stored round written by the previous version still loads (see Edge cases).
- **Verification method:** automated test (rendered screen + storage round-trip).
- **Evidence location:** `test/ui/spec028-clue-ledger.test.tsx`,
  `test/spec019-persistence.test.ts`

## Non-functional requirements

### NFR-001: No network at play time, and no new upstream dependency

- **Statement:** The clue channels read only data already loaded in the client.
  The geography index is fetched once at boot alongside the reference document,
  from our own origin; the puzzle screen itself performs no fetch. No PBDB,
  Wikipedia, Wikimedia or other external host is contacted at any point in play.
- **Rationale:** SPEC-019 NFR-001 and SPEC-001 DATA-005. Loading the index at
  boot rather than lazily on the puzzle screen keeps the screen synchronous and
  keeps SPEC-019 NFR-001 literally true, at a cost of 48 KB against a 7.3 MB
  reference — under 1%.
- **Acceptance criteria:** the existing no-egress tests still pass unmodified,
  extended to cover the new code path.
- **Verification method:** automated test.
- **Evidence location:** `test/ui/spec019-no-egress.test.tsx`,
  `test/ui/spec020-no-egress.test.tsx`

### NFR-002: The clue verdicts are pure and browser-free

- **Statement:** Both verdicts are computed by pure functions in
  `state/dailyGenus.ts`, taking plain values and returning plain values, testable
  without a DOM, with no measurement and no I/O.
- **Rationale:** The precedent SPEC-025 NFR-002 set for the cladogram layout: the
  logic is decided before anything is drawn, so it is regression-guarded without
  a browser.
- **Acceptance criteria:** every verdict case is covered by a test that imports
  no React and no jsdom.
- **Verification method:** automated test.
- **Evidence location:** `test/spec028-clue-channels.test.ts`

### NFR-003: Determinism

- **Statement:** Given the same snapshot, the same guess and the same answer, the
  verdicts are identical across runs and engines. Country lists are sorted; the
  intersection preserves that order.
- **Rationale:** SPEC-001 NFR-001 — every derivation downstream of the snapshot
  is byte-stable.
- **Acceptance criteria:** repeated evaluation yields identical output.
- **Verification method:** automated test.
- **Evidence location:** `test/spec028-clue-channels.test.ts`

## Security and privacy considerations

### SEC-001: No new data about people, and no new egress

- **Statement:** The geography index contains country codes of fossil
  localities and taxon ids. It carries no personal data. No new host is
  contacted.
- **Rationale:** completeness; this spec introduces no new class of data.
- **Acceptance criteria:** the artifact's keys are taxon ids and its values are
  two-letter codes, and nothing else.
- **Verification method:** automated test.
- **Evidence location:** `test/spec028-geography-index.test.ts`

## Data model impact

### DATA-001: `public/data/geography.json`

- **Statement:** A new committed artifact:

  ```json
  {
    "generatedFrom": "2026-07-26",
    "countriesByTaxon": { "txn:38513": ["AR", "BR", "CN"] }
  }
  ```

  `generatedFrom` is the snapshot's `retrievedOn`, so a stale index is
  detectable. The app loads it at boot and exposes it through `ReadApi` as
  `countriesFor(taxonId): readonly string[]` returning an empty array for an
  unknown taxon. `ReadModel` gains one **optional** field, `countriesByTaxon`,
  which the boot attaches; `reference.json`'s own shape is unchanged.
- **Rationale:** As REQ-001. The field has to live on `ReadModel` because that is
  what the `ModelLoader` contract returns and what `App` turns into a `ReadApi` —
  threading it any other way would mean changing that contract and every caller.
  Optional because a model built in memory (tests, fixtures) legitimately has
  none, so no existing construction site breaks and `reference.json` still need
  not be regenerated. It sits beside `occurrences` rather than inside them
  because it is a whole-snapshot aggregate: `withOccurrences` swaps one stage's
  occurrences and spreads the rest, so the countries survive every timeline step.
- **Acceptance criteria:**
  - `generatedFrom` equals the shipped snapshot's `retrievedOn`.
  - Every taxon id in the index exists in `reference.json`.
  - `countriesFor` returns `[]`, never `undefined`, for an unknown taxon.
  - A missing or malformed `geography.json` degrades per UX-003 rather than
    failing the boot.
- **Verification method:** automated test.
- **Evidence location:** `test/spec028-geography-index.test.ts`

## API impact

### API-001: `GameTaxon` and `Guess` gain the clue inputs and verdicts

- **Statement:** `GameTaxon` gains `countries: readonly string[]` and
  `occurrenceCount: number | null`. The recorded `Guess` gains
  `sharedCountries: readonly string[]`, `countryVerdict`, and
  `occurrenceVerdict`. `Round.hintUsed` is removed. `buildGameData` takes the
  country lookup as a new argument.
- **Rationale:** The verdicts are computed once at `evaluateGuess` time and
  stored on the guess, so a restored round shows the same clues it showed before
  the reload without re-deriving them — the pattern the existing clade and time
  verdicts already follow.
- **Acceptance criteria:** a round restored from storage renders the same clue
  ledger it rendered before the reload.
- **Verification method:** automated test.
- **Evidence location:** `test/spec019-persistence.test.ts`

## UI or UX impact

### UX-001: Neither verdict is carried by colour alone

- **Statement:** The occurrence verdict is carried by a **glyph** first and a
  colour second: `=` for same, a single arrow `▲`/`▼` for a close miss, a doubled
  arrow `▲▲`/`▼▼` for a far one. The arrow points the way the answer lies — up
  for more, down for fewer. Colour reinforces: the accent-family green for
  `same`, the existing `--color-attention` amber for `close`, and the neutral
  text colour for `far`. Every row also carries the verdict in words, either
  visibly or as `visuallyHidden` text.
- **Rationale:** PERF-250 and charter §4 — colour is meaning-only and never the
  sole carrier. The owner asked for green-exact and orange-close specifically;
  this keeps both while making the row survive with colour removed. The tokens
  are existing ones: no new hue enters the palette.
- **Acceptance criteria:**
  - Each verdict is distinguishable with colour removed.
  - No new colour token is introduced.
  - The amber and green both meet 4.5:1 against the surface they are drawn on.
- **Verification method:** automated test + the standing axe gate.
- **Evidence location:** `test/ui/spec028-clue-ledger.test.tsx`,
  `test/e2e/a11y.e2e.ts`

### UX-002: An occurrence count is a record count, never an abundance

- **Statement:** No copy on this screen may describe the occurrence comparison as
  how common, widespread, successful or abundant an animal was. The wording names
  **occurrences recorded in this snapshot**. The clue ledger states this once, in
  its column heading or caption.
- **Rationale:** This is the same trap SPEC-020 UX-001 identified for popularity.
  An occurrence count measures collection and publication effort — 556 of the 985
  pool genera have exactly one record — and presenting it as a property of the
  animal would be an assertion the repository cannot source. Charter §2.
- **Acceptance criteria:**
  - No screen copy calls a genus common, rare, widespread or abundant on this
    basis.
  - The heading or caption names the snapshot as what is being counted.
- **Verification method:** automated copy check.
- **Evidence location:** `test/ui/spec028-clue-ledger.test.tsx`

### UX-003: Every state is designed

- **Statement:** Designed and implemented: no guesses yet (no ledger); a guess
  sharing several countries; a guess sharing none; a guess or answer with no
  recorded countries; each of the four occurrence verdicts including
  "not recorded"; and the geography index absent or malformed, in which case the
  country channel is **withheld with its reason stated** and the occurrence
  channel continues to work. None of these is a blank surface.
- **Rationale:** Charter §7 and SPEC-019 UX-002 — real states are designed, and a
  missing artifact is disclosed rather than hidden.
- **Acceptance criteria:** each state renders a distinct, labelled surface.
- **Verification method:** automated test.
- **Evidence location:** `test/ui/spec028-clue-ledger.test.tsx`

### UX-004: Accessibility

- **Statement:** The ledger is a labelled table, reachable and readable by
  keyboard and screen reader, with each guess's two verdicts announced in words.
  The existing per-guess live-region sentence is extended to name both new
  verdicts, and is still announced once per guess.
- **Rationale:** SPEC-019 UX-003 and the standing axe gate.
- **Acceptance criteria:** axe passes with no new violations on both tracks; the
  live-region sentence names the shared countries and the occurrence verdict.
- **Verification method:** automated test (Playwright + axe).
- **Evidence location:** `test/e2e/a11y.e2e.ts`

## Configuration impact

- The close band is a single named constant (`CLOSE_OCCURRENCE_RATIO = 2`) in
  `state/dailyGenus.ts`, so changing it is a one-line, testable edit under an
  amendment.
- `HINT_AFTER_GUESSES` is deleted.

## Error handling

- A missing, unreadable or malformed `geography.json` is caught at boot: the app
  continues with an empty index, and the puzzle discloses that the country clue
  is unavailable (UX-003). It never fails the boot and never silently shows an
  empty intersection.
- A taxon absent from the index is indistinguishable from one with no
  occurrences, and both report "not recorded" — which is true in either case.

## Edge cases

- **A guess with the same country set as the answer** — the intersection is the
  whole set; that is correct and is not suppressed.
- **A stored round from before this change** carries `hintUsed` and lacks the new
  per-guess fields. The restore path already replays each stored guess through
  `evaluateGuess`, so the new verdicts are recomputed and `hintUsed` is ignored.
  No migration and no discarded round.
- **The two anomalous occurrences** whose region tail is `O2` rather than a
  country code are dropped by REQ-001's pattern check, so those two contribute no
  country. Measured: 2 of 41,116.
- **A genus with no occurrences at all** — 1 of 1,731 valid genera — reports
  "not recorded" on both channels.

## Acceptance criteria

The feature is complete when every requirement above passes its stated
verification, the governance scripts pass, and the puzzle screen renders both new
channels for a real round in a real browser with no console error.

## Verification matrix

| Requirement | Method | Evidence |
| --- | --- | --- |
| REQ-001 | automated | `test/spec028-geography-index.test.ts` |
| REQ-002 | automated | `test/spec028-clue-channels.test.ts`, `test/ui/spec028-clue-ledger.test.tsx` |
| REQ-003 | automated | `test/spec028-clue-channels.test.ts` |
| REQ-004 | automated | `test/ui/spec028-clue-ledger.test.tsx` |
| REQ-005 | automated | `test/ui/spec028-clue-ledger.test.tsx`, `test/spec019-persistence.test.ts` |
| NFR-001 | automated | `test/ui/spec019-no-egress.test.tsx`, `test/ui/spec020-no-egress.test.tsx` |
| NFR-002 | automated | `test/spec028-clue-channels.test.ts` |
| NFR-003 | automated | `test/spec028-clue-channels.test.ts` |
| SEC-001 | automated | `test/spec028-geography-index.test.ts` |
| DATA-001 | automated | `test/spec028-geography-index.test.ts` |
| API-001 | automated | `test/spec019-persistence.test.ts` |
| UX-001 | automated + axe | `test/ui/spec028-clue-ledger.test.tsx`, `test/e2e/a11y.e2e.ts` |
| UX-002 | automated copy check | `test/ui/spec028-clue-ledger.test.tsx` |
| UX-003 | automated | `test/ui/spec028-clue-ledger.test.tsx` |
| UX-004 | automated + axe | `test/e2e/a11y.e2e.ts` |

## Test plan

1. `test/spec028-geography-index.test.ts` — the shipped artifact's shape, code
   pattern, `generatedFrom`, size bound, and id subset.
2. `test/spec028-clue-channels.test.ts` — both verdict functions, every case and
   both "not recorded" paths, the four named ratio boundaries, and determinism.
3. `test/ui/spec028-clue-ledger.test.tsx` — the marks on the guess rows and only
   on them, every designed state, the absent-index degradation, the copy check,
   and the absence of any silhouette-hint control.
4. Existing suites that must stay green **unmodified**: `spec019-daily-selection`,
   `spec019-answer-pool`, `spec020-well-known-pool`, `spec020-tracks`.
5. Existing suites that change because their subject changed:
   `spec019-daily-screen` (the hint control is gone), `spec019-persistence` and
   `spec020-share-track` (the hint marker is gone from the summary).

## Rollback plan

Revert the PR. `geography.json` is additive and unreferenced after a revert; the
shipped snapshot artifacts are untouched by this spec, so there is nothing to
regenerate.

## Open questions

- **OQ-001:** Two channels may still not be enough. Diet (94% coverage, close to
  one clean bit) is the next candidate and is deliberately deferred so the effect
  of these two can be observed first.
- **OQ-002:** The "same" verdict fires on ~34% of random pairs on the **full**
  track, because 556 of its 985 answers have exactly one occurrence — so a green
  `=` there mostly means "you both have a single specimen". On the well-known
  track it is 12.5% and genuinely informative. Recorded rather than solved: it is
  a property of the data, and suppressing a true verdict to make it feel rarer
  would be dishonest.

## Human decisions required

- **Decided by the owner, 2026-08-26, in session:** add a shared-countries clue
  and an occurrence-count clue; arrow up for more and down for fewer; green for
  exact and orange for close; demote the silhouette.
- **Decided by this spec, flagged for review:** the "close" band is a factor of
  two (REQ-003, chosen by measurement); the channels render as a per-guess ledger
  below the board rather than being folded into the tree or the column (REQ-004);
  the silhouette is retired as a hint rather than relabelled (REQ-005); the
  country index ships as a separate artifact rather than a profile field
  (REQ-001).

## Conflict check

- **SPEC-019 REQ-008** (optional silhouette hint) is superseded by REQ-005 here.
  An amendment entry is recorded on SPEC-019.
- **SPEC-020 REQ-006** (the shared summary names its track) is unaffected in
  substance, but the summary's `· hint` marker disappears with the hint. An
  amendment entry is recorded on SPEC-020.
- **SPEC-019 NFR-001** ("no network") is preserved: the new fetch happens at
  boot, in the atlas loader, not on the puzzle screen.
- **SPEC-001 DATA-005** is preserved: the new artifact is our own, committed, and
  served from our own origin.
- No conflict with SPEC-024 (the Ma column) or SPEC-025 (the cladogram): neither
  channel touches either diagram.

## Traceability table

| Requirement | Implementation | Test | Status |
| --- | --- | --- | --- |
| REQ-001 | `src/pipeline/geography.ts`, `scripts/gen_geography.ts`, `public/data/geography.json` | `test/spec028-geography-index.test.ts` | Implemented |
| REQ-002 | `state/dailyGenus.ts` — `sharedCountries`, `countryVerdict` | `test/spec028-clue-channels.test.ts` | Implemented |
| REQ-003 | `state/dailyGenus.ts` — `occurrenceVerdict`, `CLOSE_OCCURRENCE_RATIO` | `test/spec028-clue-channels.test.ts` | Implemented |
| REQ-004 | `DailyGenusScreen.tsx` — `GuessMarks` on the guess rows; `.mark*` in `dailyGenus.module.css` | `test/ui/spec028-clue-marks.test.tsx` | Implemented |
| REQ-005 | `DailyGenusScreen.tsx`, `state/dailyGenus.ts`, `dailyGenusStorage.ts` | `test/ui/spec019-daily-screen.test.tsx`, `test/spec019-persistence.test.ts` | Implemented |
| NFR-001 | `data/atlas.ts` — `fetchGeography` at boot | `test/ui/spec019-no-egress.test.tsx`, `test/ui/spec020-no-egress.test.tsx` | Implemented |
| NFR-002 | pure functions in `state/dailyGenus.ts` | `test/spec028-clue-channels.test.ts` | Implemented |
| NFR-003 | sorted fold + pure verdicts | `test/spec028-clue-channels.test.ts`, `test/spec028-geography-index.test.ts` | Implemented |
| SEC-001 | `src/pipeline/geography.ts` | `test/spec028-geography-index.test.ts` | Implemented |
| DATA-001 | `domain/snapshot.ts` (`countriesByTaxon`), `read/api.ts` (`countriesFor`, `hasGeography`), `data/atlas.ts` | `test/spec028-geography-index.test.ts`, `test/ui/atlas-loader.test.tsx` | Implemented |
| API-001 | `state/dailyGenus.ts` — `GameTaxon`, `Guess` | `test/spec019-persistence.test.ts` | Implemented |
| UX-001 | `.markSame` / `.markClose` + glyph + words | `test/ui/spec028-clue-marks.test.tsx` | Implemented |
| UX-002 | `OCCURRENCE_WORDS`, the key line | `test/ui/spec028-clue-marks.test.tsx` | Implemented |
| UX-003 | `hasGeography()` + the withheld-channel note | `test/ui/spec028-clue-marks.test.tsx`, `test/ui/atlas-loader.test.tsx` | Implemented |
| UX-004 | the live-region sentence | `test/ui/spec028-clue-marks.test.tsx` | Implemented |

## Implementation notes

- Measurements in Context and REQ-003 were computed on 2026-08-26 from the
  committed artifacts; the scripts are one-off and not committed, but every
  figure is reproducible from `public/data/` with the stated rules.
- The pool reconstruction used for the REQ-003 measurement was validated against
  the running app: it yields exactly 1,492 guessable and 985 pool entries, the
  same figures the screen displays.
- **REQ-004's open risk did not materialise.** Measured in Chromium at 1440×1000
  after seven guesses on the shipped snapshot: the diagram's `scrollWidth` is
  438 px against a `clientWidth` of 436 px, so the marks cost 2 px of horizontal
  scroll, not the overflow the requirement flagged. Rows land at their depth
  (32, 48, 64 … 192 px) and no connector crosses a label.
- **UX-001's contrast was measured, not assumed.** `--color-overlap` for `same`
  resolves to `rgb(14, 107, 62)` at **6.58:1** against the surface, and
  `--color-attention` for `close` to `rgb(138, 90, 18)` at **5.91:1**. Both clear
  4.5:1, and no new colour token was introduced.
- **A bare country code was undefined on the diagram**, so the shared case reads
  "also in US · CA" rather than "US · CA". Two words were cheaper than a key
  entry, and an unexplained mark is the failure SPEC-019 AMEND-005 already
  identified for the retired `?`.
- The console is clean: zero errors across a full seven-guess round, which also
  confirms the SPEC-019 countdown render loop is gone.

## Spec amendments

None yet.

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are stated.
- [x] Conflicts with existing specs are checked and recorded.
- [x] Every claim of fact is measured, with the measurement recorded.
- [x] Every real state is designed, not just the happy path.
