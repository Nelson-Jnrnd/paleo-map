---
doc_type: spec
spec_id: SPEC-019
title: Daily Genus — a daily taxonomic deduction puzzle
status: In Implementation
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, app-shell, read-model, domain, styling]
affected_interfaces: [ReadTaxon, ReadProfile, taxonomy-index, local-storage]
supersedes: []
superseded_by:
depends_on: [SPEC-001, SPEC-002, SPEC-003, SPEC-012, SPEC-013, SPEC-017]
conflicts_with: []
last_verified_at: 2026-08-11
---

# SPEC-019: Daily Genus — a daily taxonomic deduction puzzle

## Summary

A second surface in the atlas: one dinosaur genus per day, guessed in at most
eight tries. Where Wordle reveals letters, **Daily Genus reveals classification**
— every guess is a genus, and the answer that comes back is the deepest clade
that genus shares with the hidden one, plus the branch of the tree that has just
been ruled out. Guess *Triceratops* against a hidden *Tyrannosaurus* and you
learn you share only `Dinosauria` and that all of `Ornithischia` is out; guess a
theropod next and the shared clade drops deeper. The tree the player builds this
way is the game. A practice mode plays the same puzzle on demand. It reads only
the taxonomy and profile data already loaded at boot — no new data file, no
network, no occurrence fetches — stores progress locally, and hands the finished
puzzle to the atlas's taxon page.

## Context

Measured from the shipped snapshot (`public/data/reference.json`,
`retrievedOn: 2026-07-26`) on 2026-08-08. These numbers size the requirements
below.

**The tree the game plays on.** 2,555 taxa ship; 2,123 genera sit under
`Dinosauria`, of which **1,731 are `Valid`** and **1,492 are valid non-avian**
(the `Avialae`/`Aves` subtrees hold the rest — SPEC-017 REQ-006 already draws
that line). Those 1,492 are the guessable set. Depth below `Dinosauria` runs 1 to
19 steps, median 9 — e.g. `Dinosauria > Theropoda > Neotheropoda > Averostra >
Tetanurae > Coelurosauria > Tyrannosauroidea > Tyrannosauridae > Tyrannosaurinae
> Tyrannosaurini > Tyrannosaurus`.

**What the profiles can support as clues, with zero pipeline work.**

| Field | Coverage over the 1,731 valid genera | Used? |
| --- | --- | --- |
| Parent chain (classification) | 100% | **Yes — the mechanic** |
| Silhouette | 1,731 (100%) | Yes — optional hint and answer reveal |
| `timeSpan` (min/max Ma) | 1,730 (99.9%) | Yes — the one secondary clue (REQ-006) |
| Wikipedia summary | 1,491 (86%) | Answer-pool gate |
| Image | 1,045 (60.4%) | Answer-pool gate |
| `Diet` attribute | 1,622 (93.7%) | **No** — owner decision, 2026-08-08 |
| PBDB `measurements` | **0 (0%)** | **No** — no size clue is possible |
| Geography (continent / region) | **not on the profile** | **No** — see Non-goals |

Body size and geography are the two clues a player would most expect and neither
is available: PBDB measurements are empty on every profile, and geography lives
on occurrences in the 40 MB per-stage files, not on the taxon. Diet is available
but excluded by owner decision — taxonomy and time are the clue set.

**Two structural facts the design has to respect.**

1. **The shared clade is `Dinosauria` about two-thirds of the time.** Over
   answers drawn from the pool against guesses drawn from the whole guessable
   set, the deepest shared clade is `Dinosauria` in **67.0%** of pairs (over
   pairs of the 77 best-known genera specifically, 64.6%: `Ornithischia` 5.1%,
   `Cerapoda` 4.8%, `Tetanurae` 3.9%, `Coelurosauria` 3.2%, the rest below 3%).
   This is not a defect — it is what makes the **ruled-out branch** (REQ-005) the
   load-bearing half of the feedback: a shared clade of `Dinosauria` against a
   *Triceratops* guess eliminates all 753 taxa in `Ornithischia`, and the player's
   next move is to guess into a different division. *(Owner decision, 2026-08-08:
   the answer's depth and the remaining distance to it are **not** published —
   working out how specific the answer is, is part of the puzzle. Recorded in
   Assumptions with the measurement that prompted the question.)*
2. **`Dinosauria` has 26 direct children, and most are not clades.**
   `Saurischia`, `Theropoda` and `Ornithischia` sit alongside ichnotaxa and
   ootaxa promoted to that level by PBDB — `Toyamasauripus`, `Sauropodichnus`,
   `Youngoolithidae`, `Polyclonoolithidae`, `Sinoichnites` and eighteen more.
   The revealed tree therefore renders only the nodes guesses have touched and
   **never enumerates a node's siblings** (REQ-005): a full sibling list would
   read as database noise and would leak the answer by elimination.

**Prior art in-repo.** SPEC-017 established the Dinosauria-rooted scope boundary,
the lineage helper (`src/app/components/lineage.ts`), the clade tints, and the
`screen: "taxonomy"` pattern in the exploration reducer that this spec's screen
mirrors. SPEC-013 established taxon search and its autocomplete, which the guess
input reuses. SPEC-012 shipped the silhouettes. SPEC-001 DATA-005 forbids runtime
network access and is why the puzzle is computed in the browser.

## Problem statement

The atlas rewards a visit but does not earn a return visit, and its richest
hidden structure — a 2,555-node classification tree with a silhouette on every
node — is something a user browses past rather than learns. A daily puzzle whose
feedback *is* the classification turns that tree into the thing being played
with: a player who guesses *Velociraptor* and learns the answer shares
`Coelurosauria` with it has just been taught where `Coelurosauria` sits, and has
several branches fewer to search.

## Goals

- One genus per day, the same genus for every player worldwide, computed offline
  and deterministically.
- Make classification the feedback channel: shared clade in, ruled-out branch out.
- Leave the player with a tree they built themselves, and a route into the
  atlas's taxon page for the answer.
- Let a player who wants another round have one, without touching the daily.
- Add no data source, no network call, and no build step.

## Non-goals

- **No diet clue.** Owner decision, 2026-08-08. Taxonomy and time only.
- **No size clue.** Zero profiles carry a PBDB measurement (Context). A
  taller/shorter row would read "Not available" on every line.
- **No geography clue in this spec.** Per-taxon continent or region is not on the
  profile; deriving it means aggregating the per-stage occurrence files at build
  time plus a country→continent table. A plausible follow-up spec, not this one.
- **No published depth or distance.** The game never states how deep the answer
  sits or how many steps remain (owner decision, 2026-08-08).
- **No curated answer pool.** The pool is derived mechanically (REQ-002); there is
  no hand-authored list of "famous" genera and no editorial data file.
- **No backend, no accounts, no leaderboard, no cross-device sync.** SPEC-001
  DATA-005 stands.
- **No anti-cheat.** The answer is in the client (SEC-001); this spec does not
  pretend otherwise.
- **Nothing above `Dinosauria`** — the 34-node stem to `Life` is out of scope, as
  in SPEC-017 REQ-001.
- **No phylogenetic inference.** The game plays on the shipped classification
  hierarchy; it does not compute or imply divergence dates or cladistic support.
- **No change to the map, timeline, occurrence loop, or taxon page** beyond the
  entry points (REQ-012) and the answer handoff (REQ-007).
- **No archive of past dailies** — practice mode (REQ-010) covers the wish to
  play more; replaying a specific past date is out of scope.
- **No new taxonomy source, no re-parenting, no correction of the shipped tree.**

## Users or actors

- **The Explorer** (charter §1) — a returning player, on a phone as often as a
  desktop.
- **A first-time visitor** who arrives at the puzzle before ever seeing the map,
  and must be able to finish a round without knowing the atlas exists.

## Functional requirements

### REQ-001: Deterministic daily selection, in UTC

- **Statement:** The puzzle for a given day must be a pure function
  `selectDailyGenus(utcDate, pool) → taxonId` of that day's **UTC calendar date**
  and the derived answer pool, with no randomness, no clock-time component, and
  no network or storage input. Selection walks a fixed permutation of the pool so
  every entry is used exactly once before any entry repeats.
- **Rationale:** UTC (owner decision, 2026-08-08) means one puzzle worldwide at
  one moment, so a shared result is never a spoiler for someone still on
  yesterday's. Purity is what makes it testable without mocking a clock or a
  server.
- **Acceptance criteria:**
  - Calling the function twice with the same UTC date and pool returns the same
    `taxonId`.
  - Two machines in different time zones at the same instant compute the same
    answer.
  - Over `poolLength` consecutive days every pool entry is returned exactly once,
    and day `N + poolLength` repeats day `N`.
  - The function reads only its two arguments — a unit test with no DOM, no
    `localStorage` and no network passes.
  - Two consecutive UTC dates never yield the same genus.
- **Verification method:** automated test (Vitest, pure function).
- **Evidence location:** `test/spec019-daily-selection.test.ts`

### REQ-002: The answer pool, derived not curated

- **Statement:** The answer pool is derived mechanically from the shipped
  snapshot: every taxon of rank `Genus`, inside the `Dinosauria` subtree, outside
  `Avialae` and `Aves`, with `validity` `Valid`, and carrying a silhouette, a
  `timeSpan`, a summary and at least one image. No hand-authored inclusion or
  exclusion list exists, and no editorial data file is shipped. The pool must
  contain at least 500 entries or the build fails.
- **Rationale:** Owner decision, 2026-08-08. The gate is exactly "there is enough
  material for a player to recognise the animal when it is revealed". The
  snapshot carries no signal for how well known a genus is, and inventing one by
  hand would be a second source of truth about paleontology's popular canon —
  something this repository's charter exists to avoid. The measured pool is
  **985 genera, 2.7 years before a repeat**.
- **Acceptance criteria:**
  - Every pool entry satisfies every listed condition, checked against the
    shipped `reference.json`.
  - The pool is computed from the read model alone — no file, constant, or list
    of names is consulted.
  - `poolLength >= 500`; a smaller pool fails the test rather than shipping.
  - Re-deriving the pool from the same snapshot yields the same set in the same
    order (byte-stable, per SPEC-001 NFR-001).
- **Verification method:** automated test against the shipped data artifact.
- **Evidence location:** `test/spec019-answer-pool.test.ts`

### REQ-003: The guessable set and guess validation

- **Statement:** A guess must be one of the **valid non-avian genera under
  `Dinosauria`** (1,492 at the measured snapshot) — a superset of the answer pool.
  Input is an autocomplete over that set (reusing the SPEC-013 search behaviour);
  a submission that does not resolve to a member is rejected without consuming a
  guess, and states why in domain terms — distinguishing "no such genus in this
  snapshot" from "that name is in the snapshot but is not a valid genus" (naming
  its `validity` status, e.g. `Synonymous`) from "that genus is outside
  `Dinosauria`".
- **Rationale:** Wordle's split between a wide guess dictionary and a narrower
  answer list is what makes guessing feel free while keeping answers fair. The
  rejection messages are the product's honesty rule applied to input: a snapshot
  that calls a name `Synonymous` should say so rather than "not found".
- **Acceptance criteria:**
  - Every one of the 1,492 valid non-avian genera is accepted as a guess.
  - Only genera are guessable — a clade or family name (`Ornithischia`,
    `Tyrannosauridae`) is rejected with the "not a genus" reason.
  - A rejected submission leaves the guess count, the revealed tree and the
    stored state unchanged.
  - Each of the rejection reasons renders its own message naming the taxon or
    status it is about.
  - The same genus cannot be guessed twice in one puzzle; a repeat is rejected as
    "already guessed" and consumes no guess.
  - Autocomplete matching is case-insensitive and diacritic-insensitive.
- **Verification method:** automated test (Vitest + Testing Library) over the
  shipped data artifact.
- **Evidence location:** `test/ui/spec019-guess-input.test.tsx`

### REQ-004: Per-guess classification feedback

- **Statement:** For each accepted guess the game reports, computed from the
  shipped classification: the **deepest clade shared** by the guess and the
  answer — its scientific name and rank — and nothing about the answer below that
  clade. Where a guess's shared clade is deeper than every previous guess's, that
  guess is marked as the one that advanced the tree. The game must not state the
  answer's depth, the number of steps remaining, or any numeric measure of
  closeness.
- **Rationale:** The shared clade plus the elimination it implies (REQ-005) is the
  whole deduction: a `Dinosauria` result tells you to leave that division, a
  `Coelurosauria` result tells you where to dig. Owner decision, 2026-08-08:
  working out how specific the answer is, is part of the puzzle, so no distance
  number is published.
- **Acceptance criteria:**
  - For guess *Velociraptor* against answer *Tyrannosaurus* the shared clade is
    `Coelurosauria`; against *Triceratops* it is `Dinosauria`.
  - No rendered output, DOM attribute, or stored value names a taxon strictly
    below the shared clade before the puzzle ends.
  - No rendered output states a depth, a step count, or a percentage.
  - The shared clade is never a node above `Dinosauria`; where two genera would
    otherwise meet higher, it is `Dinosauria`.
  - Exactly one guess at a time carries the advanced-the-tree marker: the most
    recent guess whose shared clade is the deepest reached.
- **Verification method:** automated test (pure function + rendered screen).
- **Evidence location:** `test/spec019-guess-evaluation.test.ts`

### REQ-005: The progressive revealed tree

- **Statement:** The game's primary surface is a tree, rooted at `Dinosauria`,
  that accumulates across guesses. It shows at all times: every node on the path
  from `Dinosauria` to the **deepest shared clade reached so far**, marked as a
  confirmed ancestor of the answer; for each guess, the **child branch of its
  shared clade that contains that guess**, marked as ruled out and labelled with
  the guessed genus; and an unresolved continuation below the deepest confirmed
  ancestor. It must render **only nodes that a guess has touched** — it must never
  enumerate a node's other children — and no node may be marked confirmed unless
  it is an ancestor of the answer.
- **Rationale:** This is the mechanic that replaces Wordle's letters, and the
  ruled-out branch is what makes the commonest feedback (`Dinosauria`, 67%) worth
  something. The no-siblings rule is not cosmetic: `Dinosauria` has 26 direct
  children, most of them ichnotaxa and ootaxa (Context), so enumerating them
  would both look like database noise and hand the player the answer by
  elimination.
- **Acceptance criteria:**
  - After a guess whose shared clade is `Dinosauria`, exactly one child of
    `Dinosauria` is marked ruled out, and it is the one containing that guess.
  - After a guess with a deeper shared clade, every node from `Dinosauria` down to
    that clade is marked confirmed.
  - A later, shallower guess never retracts a confirmed node.
  - Ruled-out branches accumulate; two guesses in the same ruled-out branch
    produce one elimination marker, not two.
  - At no point does the tree render a node that no guess has touched, other than
    the unresolved continuation, which carries no name, id, or silhouette.
  - The tree updates without issuing any network request.
- **Verification method:** automated test (pure reducer + rendered screen).
- **Evidence location:** `test/spec019-revealed-tree.test.ts`

### REQ-006: The time clue

- **Statement:** Each guess additionally compares its **time span**
  (`timeSpan.minMa`/`maxMa`) against the answer's, reporting whether the answer is
  older, younger, or overlapping, and disclosing the answer's geological period
  once a guess's span overlaps it. Where either span is absent the row reads as
  an explicit "Not available" — never a blank, a dash, or a negative result.
- **Rationale:** Time is the only secondary clue kept (owner decision,
  2026-08-08) and it is near-total in coverage (99.9%). It carries the early game
  while the tree signal is still coarse, and it is the atlas's own axis. The
  explicit-missing rule is the charter's first-class-uncertainty rule (FONC-490,
  FONC-1120) applied to a game.
- **Acceptance criteria:**
  - Older / younger / overlapping is decided from the two spans, and reported as
    overlapping when they intersect.
  - The answer's period is disclosed only after a guess whose span overlaps it,
    and never before.
  - The single pool genus with no `timeSpan` renders "Not available" and does not
    break the round.
  - No clue row invents a value the snapshot does not carry.
- **Verification method:** automated test (pure function + rendered screen).
- **Evidence location:** `test/spec019-clue-rows.test.ts`

### REQ-007: Termination, reveal, and handoff to the atlas

- **Statement:** A round ends when the answer is guessed or after **eight**
  unsuccessful guesses. On either ending the game reveals the answer's scientific
  name, silhouette, full descent from `Dinosauria`, time span, and the reference
  its accepted name rests on (`acceptedPer`), and offers a control that opens that
  genus's taxon page in the atlas.
- **Rationale:** Eight is sized against the measured tree: the first guesses
  eliminate divisions, then the shared clade drops fast once the player is in the
  right branch. The handoff is the point of building the game inside the atlas —
  the puzzle ends where the product's real content begins.
- **Acceptance criteria:**
  - A correct guess at any position ends the round as a win; a ninth guess is
    never accepted.
  - Both endings show the same reveal block.
  - The handoff opens the taxon page for exactly the answer's `taxonId`.
  - The reveal names the source of the accepted name; it is not presented as an
    unsourced fact.
- **Verification method:** automated test (rendered screen) + manual check.
- **Evidence location:** `test/ui/spec019-daily-screen.test.tsx`

### REQ-008: Optional silhouette hint

- **Statement:** From the fifth unsuccessful guess onward the player may reveal
  the answer's silhouette. Taking it is recorded in the round state and marked in
  the shared summary (REQ-011). It consumes no guess and is never taken
  automatically.
- **Rationale:** Every genus in the snapshot has a silhouette (100% coverage) and
  it is the most on-brand hint the data can offer. Gating it to the fifth guess
  keeps it a rescue rather than a shortcut; marking it keeps a shared result
  honest.
- **Acceptance criteria:**
  - The control is unavailable before the fifth unsuccessful guess, available
    after it, and never triggers on its own.
  - Revealing the silhouette does not change the guess count or end the round.
  - A round finished with a hint is distinguishable from one finished without, in
    both the stored state and the shared summary.
- **Verification method:** automated test (rendered screen).
- **Evidence location:** `test/ui/spec019-daily-screen.test.tsx`

### REQ-009: Countdown to the next puzzle

- **Statement:** The game displays the time remaining until the next puzzle — the
  next 00:00 UTC — as hours, minutes and seconds, updating at least once per
  second while visible, computed from the device clock with no network call. It
  is shown at least on the finished-round surface, and reaching zero triggers the
  rollover behaviour of REQ-013.
- **Rationale:** With a UTC reset, "tomorrow" is not the player's midnight and is
  not guessable from their local time; a countdown is the only honest way to say
  when the next one lands. Requested by the owner, 2026-08-08.
- **Acceptance criteria:**
  - At a controlled instant the displayed remainder equals the true interval to
    the next 00:00 UTC, to the second.
  - It ticks down while the screen is open and is correct after the tab has been
    backgrounded (recomputed from the clock, not decremented blindly).
  - It never issues a network request.
  - It reads zero for at most one tick before the rollover control appears.
- **Verification method:** automated test (controlled clock) + manual check.
- **Evidence location:** `test/ui/spec019-rollover.test.tsx`

### REQ-010: Practice mode

- **Statement:** A non-daily mode plays the same puzzle on demand: an answer drawn
  at random from the same pool, unlimited rounds, the same guessable set, guess
  limit, feedback, clue, hint and reveal. It must never draw the current day's
  answer, must not consume or alter the daily round's state, and must not
  contribute to the daily record (games, wins, streaks). A practice round in
  progress and a daily round in progress coexist without either disturbing the
  other.
- **Rationale:** Requested by the owner, 2026-08-08. It also carries the first
  minute of a new player's visit — someone who arrives and wants to understand the
  game should not have to spend the day's only round learning the rules.
- **Acceptance criteria:**
  - Starting a practice round never yields today's daily answer.
  - Playing, winning, or losing practice rounds leaves the daily guesses,
    outcome, streak and record untouched.
  - Practice rounds can be started repeatedly with no per-day limit.
  - Consecutive practice rounds do not repeat the same answer.
  - The surface states plainly which mode is being played.
- **Verification method:** automated test (rendered screen).
- **Evidence location:** `test/ui/spec019-practice.test.tsx`

### REQ-011: Local persistence and the spoiler-free summary

- **Statement:** The daily round's state (the answer's `taxonId`, the guesses in
  order, whether the hint was used, the outcome) and a running record (games
  played, wins, current and best streak, distribution of winning guess counts)
  persist in browser local storage keyed by the **UTC date**, so a reload resumes
  the same round in the same state. The game also produces a **spoiler-free** text
  summary — puzzle number, guess count out of eight, hint marker, and one line per
  guess marking only whether that guess advanced the tree — containing **no taxon
  name, rank, or clade name** — and copies it to the clipboard on request.
  Practice rounds are not persisted across reloads and never appear in the record.
- **Rationale:** A round that resets on reload is not a daily. The spoiler-free
  rule is what makes a result shareable; the advanced-the-tree marker is this
  game's equivalent of Wordle's coloured squares and exposes nothing the player's
  audience could not already guess — in particular it publishes no distance
  number, consistent with REQ-004.
- **Acceptance criteria:**
  - Reloading mid-round restores the exact guess list, revealed tree, hint state
    and outcome.
  - Stored state for a previous UTC date does not resume as today's round.
  - The summary contains no scientific name, taxon id, rank, or clade name, and
    no depth or distance number.
  - With local storage unavailable or full, the game remains fully playable for
    the session and says plainly that progress will not be kept (UX-002).
  - With the clipboard unavailable, the summary is still shown as selectable text.
- **Verification method:** automated test (rendered screen with a stubbed
  storage) + manual check.
- **Evidence location:** `test/spec019-persistence.test.ts`

### REQ-012: Entry points and addressability

- **Statement:** The game is a screen in the existing app shell, reached from the
  context bar alongside the taxonomy screen, and addressable by URL fragment:
  `#daily` opens the daily round and `#practice` opens a practice round. Entering
  and leaving update the fragment, and the browser back control returns to the
  previous screen.
- **Rationale:** The app has no router (SPEC-003 shell, SPEC-017 screen pattern);
  a fragment gives both modes a linkable, bookmarkable address without making
  routing a dependency of this spec.
- **Acceptance criteria:**
  - Booting with `#daily` lands on the daily round; with `#practice`, on a
    practice round.
  - Opening either from the context bar sets the fragment; leaving clears it.
  - Back from the game returns to the screen the player came from.
  - No routing library is added to `package.json`.
- **Verification method:** automated test (rendered shell) + manual check.
- **Evidence location:** `test/ui/spec019-entry-point.test.tsx`

### REQ-013: UTC rollover

- **Statement:** When the UTC date changes while the game is open, the game must
  not swap the answer under the player. A round in progress continues to
  completion, and a new day's round starts only through an explicit control.
- **Rationale:** A puzzle that mutates mid-round at 00:00 UTC destroys the round
  and the streak record with it — and with a UTC reset that moment falls in the
  middle of the day for most of the world.
- **Acceptance criteria:**
  - Across a simulated UTC date change with a round in progress, the answer,
    guesses and revealed tree are unchanged.
  - The new day's round starts only after the explicit control is used.
  - The completed previous day's result stays recorded against its own UTC date.
  - The countdown (REQ-009) restarts from the new day's full interval.
- **Verification method:** automated test (rendered screen with a controlled
  clock).
- **Evidence location:** `test/ui/spec019-rollover.test.tsx`

### REQ-014: Scope boundary at `Dinosauria`

- **Statement:** No surface in this spec may render, traverse to, or link to a
  taxon outside the `Dinosauria` subtree. Any traversal that would leave the
  subtree terminates at `Dinosauria` and presents it as the root.
- **Rationale:** Consistency with SPEC-017 REQ-001 (owner decision, 2026-08-05).
  `Dinosauria` is also already the game's way of saying "nothing in common", so a
  higher shared node would add no information.
- **Acceptance criteria:**
  - Every rendered ancestor chain begins at `Dinosauria`.
  - No node outside the subtree appears in the tree, the clue row, the reveal, or
    the guess autocomplete.
- **Verification method:** automated test.
- **Evidence location:** `test/spec019-revealed-tree.test.ts`

## Non-functional requirements

### NFR-001: No runtime network access, and no occurrence fetches

- **Statement:** The game issues no network request of any kind — in particular it
  must not trigger the per-stage occurrence fetches the map screen uses. It runs
  entirely on `reference.json`, already loaded at boot.
- **Rationale:** SPEC-001 DATA-005. The stage files total roughly 40 MB; a puzzle
  that pulled them would cost more to load than the whole game is worth.
- **Acceptance criteria:**
  - With `fetch` stubbed to throw, a full round (open, guess, win, share,
    countdown) completes.
  - Opening the game from a cold boot performs zero stage fetches.
- **Verification method:** automated test (network-stubbed render), extending the
  existing `test/data-005-no-runtime-egress.test.ts` pattern.
- **Evidence location:** `test/ui/spec019-no-egress.test.tsx`

### NFR-002: Evaluation cost

- **Statement:** Guess evaluation (shared clade, tree update, time clue) is
  O(depth) per guess using pre-built id→taxon, id→profile and parent→children
  indexes, not repeated linear scans of the 2,555-taxon array, and completes
  within 50 ms on the reference phone profile used by SPEC-017. Deriving the pool
  (REQ-002) is a single pass at screen open, not per guess.
- **Rationale:** `src/read/api.ts` resolves taxa with `Array.prototype.find`
  (O(n)); SPEC-017 NFR-002 already required indexes for the same reason. Depth is
  at most 19.
- **Acceptance criteria:**
  - No code path in the game performs a linear taxon lookup per guess.
  - A measured worst-case (depth-19) evaluation stays under 50 ms.
  - The pool is derived at most once per screen open.
- **Verification method:** automated test + inspection.
- **Evidence location:** `test/spec019-guess-evaluation.test.ts`

### NFR-003: No new data artifact at all

- **Statement:** The feature ships no new data file. Everything — the pool, the
  indexes, the answer — is derived in the browser from the read model already
  loaded. No change to `reference.json`, the stage files, or the basemap; no new
  build step; no new runtime dependency.
- **Rationale:** SPEC-017 set the precedent that a feature built on data that
  already ships costs nothing to load. With the pool derived (REQ-002) rather than
  curated, that holds completely here.
- **Acceptance criteria:**
  - `git status` after implementation shows no change under `public/data/`.
  - `pnpm run check:budget` passes unchanged.
  - `package.json` gains no dependency.
- **Verification method:** script + inspection.
- **Evidence location:** `pnpm run check:budget` output in the PR.

### NFR-004: Deterministic and clock-independent tests

- **Statement:** Every date- or time-dependent behaviour is testable by injecting
  the instant; no test depends on the wall clock or is time-of-day flaky.
- **Rationale:** A daily game with a countdown is otherwise untestable in CI.
- **Acceptance criteria:**
  - The current instant enters the game through a single injected value,
    defaulted at the app boundary.
  - The suite passes with the system clock set to any date, in any time zone.
- **Verification method:** automated test + inspection.
- **Evidence location:** `test/spec019-daily-selection.test.ts`

## Security and privacy considerations

### SEC-001: The answer is client-side and is not treated as a secret

- **Statement:** The daily answer is computed in the browser from shipped data and
  is discoverable by anyone reading the bundle or the console. The product must
  not claim otherwise, must not attempt obfuscation or anti-tamper measures, and
  must not add a backend to hide it.
- **Rationale:** SPEC-001 DATA-005 rules out a server. Pretending a client-side
  value is secret is the kind of dishonesty this product's charter exists to
  avoid; the stake is a puzzle, not an asset.
- **Acceptance criteria:**
  - No obfuscation, encryption, or integrity check of the answer is implemented.
  - No requirement in this spec depends on the answer being unknowable.
- **Verification method:** inspection.
- **Evidence location:** PR review notes.

### SEC-002: Local storage holds no personal data

- **Statement:** Stored state is limited to the fields listed in REQ-011 — taxon
  ids, guess names, counts, UTC dates, outcomes. No identifier, no free text, no
  telemetry, nothing transmitted. Clearing site data fully resets the game with no
  error.
- **Rationale:** The product collects nothing today; a game is not a reason to
  start.
- **Acceptance criteria:**
  - The stored payload matches a documented schema and contains no other field.
  - Clearing storage mid-round leaves the app functional.
- **Verification method:** automated test + inspection.
- **Evidence location:** `test/spec019-persistence.test.ts`

## Data model impact

### DATA-001: In-browser derived pool and index

- **Statement:** The game derives its working structures — the answer pool, and
  the id→taxon, id→profile, parent→children and ancestor-path indexes — in the
  browser from the loaded read model, at screen open. Nothing is precomputed at
  build time, nothing is written back to the read model, and no new persisted data
  structure is introduced beyond the local-storage record of REQ-011.
- **Rationale:** Keeps NFR-003 absolute (no new artifact) while satisfying
  NFR-002, and keeps the pool a pure function of the snapshot so a new snapshot
  updates it with no other action.
- **Acceptance criteria:**
  - The pool and indexes build from `ReadModel` alone.
  - The read model is not mutated.
  - Re-deriving from the same model yields identical results.
- **Verification method:** automated test.
- **Evidence location:** `test/spec019-answer-pool.test.ts`

## API impact

### API-001: Read API additions

- **Statement:** Any lookup the game needs beyond today's `ReadApi` (indexed
  taxon/profile access, children of a node, ancestor path) is added to the read
  layer as pure, side-effect-free methods. No existing method changes signature or
  behaviour.
- **Rationale:** SPEC-017 introduced the same need; this spec must not fork a
  second taxonomy traversal helper alongside `src/app/components/lineage.ts`.
- **Acceptance criteria:**
  - Existing read-API tests pass unchanged.
  - The game contains no second implementation of ancestor-path traversal.
- **Verification method:** automated test + inspection.
- **Evidence location:** `test/data-010-rank-map.test.ts` (unchanged) and PR diff.

## UI or UX impact

### UX-001: Charter compliance

- **Statement:** The screen follows `docs/mockups/design-guidelines.md`: domain
  language only (taxa, clades, Ma, periods — never "score", "level", "points",
  "XP"; "streak" is permitted as the plain word for consecutive days); the teal
  accent only for the data and interaction layer; ICS period hues and clade tints
  for meaning only; the light cartographic neutrals; restraint over decoration.
  Scientific names are italic (CONS-350).
- **Rationale:** A game is the easiest place to drift into generic product-speak
  and decorative colour, and the charter is binding on all UI in this repository.
- **Acceptance criteria:**
  - No banned vocabulary (charter §3) appears in the screen's copy.
  - The only accent is teal; clade tints appear only on clade nodes; period hues
    only on period statements.
  - Every colour that conveys a verdict is paired with a shape or a word.
- **Verification method:** inspection against the guidelines + automated copy
  check.
- **Evidence location:** `test/ui/spec019-daily-screen.test.tsx`

### UX-002: Every state is designed

- **Statement:** All of these states are designed and implemented, not just the
  win: fresh round (zero guesses); in progress; won; lost; daily already completed
  today (with the countdown); practice in progress; invalid guess (each rejection
  reason of REQ-003); repeated guess; hint available; hint taken; storage
  unavailable; clipboard unavailable; awaiting rollover after the countdown
  reaches zero; and snapshot loaded but the pool unusable (an error state with a
  retry, matching the shell's existing pattern).
- **Rationale:** Charter §2 and the repo's `empty-error-states` convention: real
  states are designed, never left to fall out of the happy path.
- **Acceptance criteria:**
  - Each listed state renders a distinct, labelled surface.
  - No state renders a blank region or a silent default.
- **Verification method:** automated test (rendered screen per state).
- **Evidence location:** `test/ui/spec019-states.test.tsx`

### UX-003: Accessibility

- **Statement:** The screen is fully keyboard operable (guess input, submit, hint,
  share, handoff, practice, tree navigation); guess results are announced through
  a live region; colour is never the sole carrier of a verdict; contrast meets
  WCAG 2 AA; tree nodes carry accessible names describing their state (confirmed
  ancestor / ruled out / unresolved); and the countdown does not spam assistive
  technology — it is not a live region.
- **Rationale:** The repository already gates on axe (`test/e2e/a11y.e2e.ts`), and
  SPEC-003 AMEND-002 established that accessibility wins over the aesthetic hex. A
  per-second live region would make the screen unusable with a screen reader.
- **Acceptance criteria:**
  - The axe gate passes on the game screen with no new violations.
  - A round is completable with the keyboard alone.
  - Each guess result is announced once, and only once.
  - The countdown is not announced on every tick.
- **Verification method:** automated test (Playwright + axe) + manual check.
- **Evidence location:** `test/e2e/a11y.e2e.ts`, `test/e2e/spec019-daily.e2e.ts`

### UX-004: The snapshot's classification is presented as sourced, not settled

- **Statement:** The screen states that the classification being played on is the
  shipped PBDB snapshot at its `retrievedOn` date, and the answer reveal names the
  reference the accepted name rests on (`acceptedPer`). The game must never imply
  that a placement is a settled fact or that a player's disagreement with the tree
  is an error.
- **Rationale:** The product's credibility rests on never presenting an assertion
  as an intrinsic fact (charter §2, SPEC-001 §4). A quiz format sharpens that
  risk: being told "wrong" by a classification is exactly where a user needs to
  see whose classification it is.
- **Acceptance criteria:**
  - The snapshot date is visible without a hover or a second click.
  - The reveal shows `acceptedPer` for the answer.
  - No copy asserts a placement without its source.
- **Verification method:** automated test (rendered screen) + inspection.
- **Evidence location:** `test/ui/spec019-daily-screen.test.tsx`

## Configuration impact

- No environment variables, no feature flags, no build configuration.
- The guess limit (8) and the hint threshold (5) are named constants in one
  module, so changing either is a one-line, testable edit under an amendment.
- The puzzle-numbering epoch is a single constant holding **the UTC date of first
  release**, so the first day the game is live is "Daily Genus No. 1". It is set
  in the release PR and never changed afterwards — it is baked into every shared
  result, and moving it renumbers every player's history.

## Error handling

| Condition | Response |
| --- | --- |
| The derived pool has fewer than 500 usable genera | Error state with the shell's existing retry; the game does not start with a degraded pool (REQ-002) |
| Local storage read fails or holds malformed JSON | Treated as "no stored state"; the round starts fresh and the storage-unavailable notice is shown (UX-002) |
| Stored state names a `taxonId` that is not today's answer | Discarded for that date, not migrated |
| Clipboard write rejected | The summary renders as selectable text with an explanation |
| Guess submitted after the round ended | Rejected; the ended state is unchanged |
| Device clock is wrong or shifts backwards | The countdown recomputes from the clock rather than decrementing blindly; a backwards shift shows the longer remainder rather than a negative value |

## Edge cases

- **The answer is a direct child of `Dinosauria`** (depth 1 — the pool contains
  such genera): every guess outside its branch returns `Dinosauria`, and the tree
  can confirm nothing beyond the root until the branch is hit. The loss reveal
  must still read sensibly.
- **The answer is the deepest** (depth 19): eight guesses may not be enough; the
  loss path must read as a near miss, showing the deepest confirmed ancestor
  reached.
- **A guess is a sibling of the answer** — the shared clade sits one step above the
  answer; the tree must not thereby name the answer, and no distance is published
  that would say "one step".
- **Two guesses in the same ruled-out branch** — one elimination marker, not two.
- **The answer is a trace-fossil genus.** The derived pool (owner decision,
  REQ-002) includes roughly nine footprint genera — *Wintonopus*, *Deltapodus*,
  *Anomoepus*, *Megalosauripus* and a handful more — about **1 puzzle in 100**.
  They are `Genus`-rank taxa with an image and a summary and therefore qualify.
  Accepted consequence, recorded in Open questions.
- **A player's clock is set to a past or future date** — they get that UTC date's
  puzzle; nothing breaks, and the result is stored against that date.
- **The pool changes in a later snapshot** — the daily sequence changes from that
  release onward. Stored results keep their own `taxonId` and stay readable. Past
  puzzles are not reproducible across pool changes and this spec does not promise
  they are.
- **A first-time visitor lands on `#daily`** — the shell performs its normal boot
  (reference load) and the game renders its own loading state, never a blank
  screen.
- **A practice round is open when the UTC date rolls over** — practice is unaffected
  (REQ-010, REQ-013).

## Acceptance criteria

This spec is satisfied when all of the following hold:

1. Opening the app at `#daily`, or from the context bar, presents a round whose
   answer is the same for a given UTC date on every device, computed with no
   network access, with a countdown to the next 00:00 UTC.
2. Every guess is a genus; each accepted guess reports the deepest shared clade
   and the ruled-out branch, compares time spans, and grows a tree that marks
   confirmed ancestors and eliminations — revealing nothing below the shared
   clade, enumerating no siblings, and publishing no depth or distance number.
3. A round ends in a win or after eight guesses, reveals the answer with its
   descent, silhouette, time span and `acceptedPer`, and offers a route to that
   genus's taxon page.
4. Practice mode plays the same game on demand without touching the daily round
   or the record.
5. Daily progress and the record survive a reload; the shared summary contains no
   taxon name and no number beyond the guess count.
6. Every state in UX-002 is implemented and labelled; the axe gate passes; a round
   is completable by keyboard alone.
7. `pnpm run typecheck`, `pnpm test`, `pnpm run lint`, `pnpm run format`,
   `pnpm e2e`, `pnpm run check:budget` and the three governance scripts all pass,
   and no file under `public/data/` changes.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Same UTC date + pool → same genus; full cycle before repeat | automated test | `pnpm test spec019-daily-selection` | `test/spec019-daily-selection.test.ts` | |
| REQ-002 | Pool derived from the model alone; ≥ 500 entries; stable | automated test | `pnpm test spec019-answer-pool` | `test/spec019-answer-pool.test.ts` | |
| REQ-003 | 1,492 genera guessable; non-genera rejected; no guess consumed | automated test | `pnpm test spec019-guess-input` | `test/ui/spec019-guess-input.test.tsx` | |
| REQ-004 | Shared clade correct; nothing below it revealed; no numbers | automated test | `pnpm test spec019-guess-evaluation` | `test/spec019-guess-evaluation.test.ts` | |
| REQ-005 | Confirmed path and eliminations accumulate; no siblings rendered | automated test | `pnpm test spec019-revealed-tree` | `test/spec019-revealed-tree.test.ts` | |
| REQ-006 | Older/younger/overlap; period gated; explicit "Not available" | automated test | `pnpm test spec019-clue-rows` | `test/spec019-clue-rows.test.ts` | |
| REQ-007 | Win/loss at 8; reveal block; taxon-page handoff | automated test + manual | `pnpm test spec019-daily-screen` | `test/ui/spec019-daily-screen.test.tsx` | |
| REQ-008 | Hint gated at guess 5; recorded; consumes no guess | automated test | `pnpm test spec019-daily-screen` | `test/ui/spec019-daily-screen.test.tsx` | |
| REQ-009 | Countdown matches the interval to 00:00 UTC; no network | automated test + manual | `pnpm test spec019-rollover` | `test/ui/spec019-rollover.test.tsx` | |
| REQ-010 | Practice never draws today's answer and never alters the record | automated test | `pnpm test spec019-practice` | `test/ui/spec019-practice.test.tsx` | |
| REQ-011 | Reload resumes; summary is spoiler-free and number-free | automated test + manual | `pnpm test spec019-persistence` | `test/spec019-persistence.test.ts` | |
| REQ-012 | `#daily` and `#practice` boot the right mode; no router added | automated test + manual | `pnpm test spec019-entry-point` | `test/ui/spec019-entry-point.test.tsx` | |
| REQ-013 | UTC date change mid-round does not swap the answer | automated test | `pnpm test spec019-rollover` | `test/ui/spec019-rollover.test.tsx` | |
| REQ-014 | Nothing outside the `Dinosauria` subtree is rendered | automated test | `pnpm test spec019-revealed-tree` | `test/spec019-revealed-tree.test.ts` | |
| NFR-001 | Full round with `fetch` stubbed to throw; zero stage fetches | automated test | `pnpm test spec019-no-egress` | `test/ui/spec019-no-egress.test.tsx` | |
| NFR-002 | Indexed lookups; depth-19 evaluation under 50 ms | automated test + inspection | `pnpm test spec019-guess-evaluation` | `test/spec019-guess-evaluation.test.ts` | |
| NFR-003 | No `public/data/` change; budget unchanged; no dependency | script + inspection | `pnpm run check:budget`, `git status` | PR diff | |
| NFR-004 | Instant injected; suite clock- and timezone-independent | automated test + inspection | `pnpm test` with a shifted clock and TZ | `test/spec019-daily-selection.test.ts` | |
| SEC-001 | No obfuscation implemented or implied | inspection | PR review | PR review notes | |
| SEC-002 | Stored payload matches the documented schema only | automated test | `pnpm test spec019-persistence` | `test/spec019-persistence.test.ts` | |
| DATA-001 | Pool and indexes built from `ReadModel`; model not mutated | automated test | `pnpm test spec019-answer-pool` | `test/spec019-answer-pool.test.ts` | |
| API-001 | Existing read-API behaviour unchanged; no duplicate traversal | automated test + inspection | `pnpm test` | PR diff | |
| UX-001 | Charter vocabulary and colour rules honoured | inspection + automated copy check | `pnpm test spec019-daily-screen` | `test/ui/spec019-daily-screen.test.tsx` | |
| UX-002 | Each listed state renders a distinct labelled surface | automated test | `pnpm test spec019-states` | `test/ui/spec019-states.test.tsx` | |
| UX-003 | Axe passes; keyboard-only round; countdown not announced | automated test + manual | `pnpm e2e` | `test/e2e/spec019-daily.e2e.ts`, `test/e2e/a11y.e2e.ts` | |
| UX-004 | Snapshot date visible; `acceptedPer` shown on reveal | automated test + inspection | `pnpm test spec019-daily-screen` | `test/ui/spec019-daily-screen.test.tsx` | |

## Test plan

**Unit (Vitest, no DOM).** The pure core — daily selection over an injected UTC
date and pool (REQ-001), pool derivation (REQ-002), guess evaluation and shared
clade (REQ-004), the revealed-tree reducer (REQ-005, REQ-014), the time
comparison (REQ-006), the countdown computation (REQ-009) — against small
hand-built fixture trees for the logic and against the shipped `reference.json`
for the real-data assertions. *Tyrannosaurus* / *Velociraptor* / *Triceratops*
are the worked examples in the Context and make good fixtures.

**Data (Vitest, shipped artifact).** The pool gate (REQ-002, DATA-001): every
entry qualifies, is non-avian, is a genus; the pool is at least 500 and stable
across re-derivation.

**Component (Vitest + Testing Library).** The screen across every state in
UX-002; persistence with a stubbed storage; rollover and the countdown with a
controlled clock; practice-vs-daily isolation; `#daily` and `#practice` entry;
and the no-egress check with `fetch` stubbed to throw.

**End-to-end (Playwright).** One full round in a real browser — open at `#daily`,
guess, lose, reveal, hand off to the taxon page — plus a practice round, the axe
gate on the game screen, and a keyboard-only round.

**Fixtures.** No new data fixtures; the shipped snapshot is the fixture for the
real-data assertions, and small in-test trees cover the logic.

**Before implementation.** Per repo convention
(`docs/mockups/screens-index.md`), a mockup for this screen — including the
UX-002 states — should exist and be listed in the screens index before the
screen is built.

## Rollback plan

The game is additive: one new screen, two new entry fragments, and pure modules
under `src/app`. No new data file, no snapshot rebuild, no migration, no change
to any existing artifact — rollback is reverting the PR. If only the entry point
is at fault, removing the context-bar control and the fragment handler disables
both modes while leaving the modules dormant and harmless. Local storage left
behind is inert and is ignored on the next UTC date change; nothing outside the
game reads it.

## Open questions

- [ ] **Trace-fossil answers.** With the pool uncurated (owner decision), about
      1 puzzle in 100 is a footprint genus — a named set of tracks rather than an
      animal. Accepted for now; revisit if it lands badly in play.
- [ ] **Geography clue.** Deriving a per-genus continent set at build time (from
      the per-stage occurrences plus a country→continent table) would add the most
      atlas-native clue — "known from South America". Deferred as pipeline work.
      Should it be a follow-up spec?
- [ ] **Junior synonyms as guesses.** The snapshot marks 392 genera non-`Valid`
      but carries no explicit senior-synonym pointer. Should a synonym guess
      resolve to its accepted genus (deriving the link from the parent relation,
      which is unverified) or stay rejected with its status, as REQ-003 specifies?
- [ ] **Guess budget.** Eight is reasoned from the measured tree, not playtested.
      Confirm after the first playable build. If the early game proves inert, the
      lever held in reserve is publishing the answer's depth — deliberately
      excluded here (Assumptions 3) and re-addable by amendment.

All other open questions are **explicitly deferred**, not unresolved: the
trace-fossil rate and the guess budget are accepted for the first build and
revisited from play; geography is a candidate follow-up spec; synonym guesses
stay rejected per REQ-003 until the snapshot carries a senior-synonym pointer.

## Human decisions required

- [x] **Approve the concept and the mechanic** — comparative feedback only: shared
      clade plus ruled-out branch, no depth, no distance.
      Answer: **Approved by the owner, 2026-08-10** ("I approve the mechanics"),
      following the decisions of 2026-08-08 recorded in Assumptions 1.
- [x] **Puzzle numbering epoch.** Answer: **the UTC date of first release** — day
      one is No. 1. Set once in the release PR, never moved (Configuration
      impact).
- [x] **Does the functional specification need a section for the game?**
      Answer: **No.** `docs/workflow/DOCUMENTATION_AUTHORITY.md` rule 1 makes
      specs the only place requirements may be introduced, so SPEC-019 is the
      requirement source for this surface. No `FONC-` ids are minted for it; the
      charter rules it must honour are carried here as UX-001 and UX-004.

## Assumptions

Recorded per `CLAUDE.md` rather than decided silently.

1. **Owner decisions of 2026-08-08, carried into requirements:** UTC day boundary
   with a visible countdown (REQ-001, REQ-009); a non-daily practice mode
   (REQ-010); the silhouette hint kept as a player option (REQ-008); no diet clue,
   taxonomy and time only (REQ-006); and no curated answer pool (REQ-002).
2. **The guessable set is the 1,492 valid non-avian genera**, not all 1,731 valid
   genera — avian taxa are excluded from guessing for the same reason they are
   excluded from answers (SPEC-017 REQ-006, CONS-020/030).
3. **No depth and no distance are published** (owner decision, 2026-08-08). The
   measurement that prompted the question is on record in the Context — the shared
   clade is `Dinosauria` for 67% of guesses — and the ruled-out branch is what
   carries those turns. If play shows the early game is inert, publishing the
   answer's depth is the smallest lever, addable by amendment.
4. **Eight guesses, hint from the fifth**, sized against the measured tree, not
   playtested.
5. **The game is a screen with `#daily` / `#practice` fragments, not a routed
   page** — no router exists in the app and this spec does not introduce one.
6. **Practice rounds are not persisted across reloads** — they are throwaway by
   design, which also keeps the stored schema (SEC-002) small.

## Conflict check

No conflicts found.

- **SPEC-017 (taxonomy infographics)** — closest overlap. Both render the
  classification tree rooted at `Dinosauria`. This spec reuses SPEC-017's scope
  boundary (REQ-014), its lineage traversal and its clade tints rather than
  forking them (API-001). The surfaces are distinct: SPEC-017 explains a tree the
  user can see; this spec hides one and reveals it by deduction.
- **SPEC-001 (data architecture)** — DATA-005 (no runtime egress) is restated as
  NFR-001, not weakened. No L3 editorial artifact is introduced (REQ-002), so the
  data tiers are untouched.
- **SPEC-013 (taxon search)** — the guess input reuses its autocomplete behaviour
  over a narrower set; search itself is unchanged.
- **SPEC-003 / SPEC-006 (shell and loading)** — the game adds a screen to the
  existing reducer and reuses the shell's error/retry pattern; the boot sequence
  is unchanged.
- **Functional specification** — the game is a new product surface not covered by
  any existing `FONC-`/`CONS-` requirement. It introduces no requirement that
  contradicts one; the charter rules it must honour are carried here as UX-001 and
  UX-004. Whether the functional specification should gain a section for it is a
  question for the owner at approval (Human decisions).

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | daily selection | `state/dailyGenus.ts` · `selectDailyGenus`, `utcDateKey`, `puzzleNumber` | `test/spec019-daily-selection.test.ts` | Implemented |
| REQ-002 | derived pool | `state/dailyGenus.ts` · `derivePool`, `buildGameData` | `test/spec019-answer-pool.test.ts` | Implemented |
| REQ-003 | guess input | `state/dailyGenus.ts` · `resolveGuess`; `components/DailyGenusScreen.tsx` | `test/spec019-guess-evaluation.test.ts`, `test/ui/spec019-guess-input.test.tsx` | Implemented |
| REQ-004 | guess evaluation | `state/dailyGenus.ts` · `evaluateGuess` | `test/spec019-guess-evaluation.test.ts`, `test/ui/spec019-daily-screen.test.tsx` | Implemented |
| REQ-005 | revealed tree | `state/dailyGenus.ts` · `revealedTree`; `DailyGenusScreen` trunk | `test/spec019-revealed-tree.test.ts`, `test/ui/spec019-daily-screen.test.tsx` | Implemented |
| REQ-006 | time clue | `state/dailyGenus.ts` · `timeVerdict`; `DailyGenusScreen` column | `test/spec019-clue-rows.test.ts`, `test/ui/spec019-states.test.tsx` | Implemented |
| REQ-007 | termination + reveal | `state/dailyGenus.ts` · `applyGuess`; `DailyGenusScreen` reveal | `test/ui/spec019-daily-screen.test.tsx`, `test/e2e/spec019-daily.e2e.ts` | Implemented |
| REQ-008 | silhouette hint | `state/dailyGenus.ts` · `hintAvailable`, `takeHint` | `test/spec019-revealed-tree.test.ts`, `test/ui/spec019-daily-screen.test.tsx` | Implemented |
| REQ-009 | countdown | `state/dailyGenus.ts` · `msUntilNextUtcDay`, `formatCountdown` | `test/spec019-daily-selection.test.ts`, `test/ui/spec019-rollover.test.tsx` | Implemented |
| REQ-010 | practice mode | `state/dailyGenus.ts` · `selectPracticeGenus`; `DailyGenusScreen` | `test/ui/spec019-practice.test.tsx` | Implemented |
| REQ-011 | persistence + share | `state/dailyGenusStorage.ts` | `test/spec019-persistence.test.ts`, `test/ui/spec019-rollover.test.tsx` | Implemented |
| REQ-012 | app shell | `state/screenFragment.ts`; `ExplorationView`; `ContextBar` | `test/ui/spec019-entry-point.test.tsx`, `test/e2e/spec019-daily.e2e.ts` | Implemented |
| REQ-013 | rollover | `DailyGenusScreen` countdown effect | `test/ui/spec019-rollover.test.tsx` | Implemented |
| REQ-014 | scope boundary | `state/taxonomy.ts` (SPEC-017 index, reused) | `test/spec019-revealed-tree.test.ts` | Implemented |
| NFR-001 | no egress | `DailyGenusScreen` (snapshot only) | `test/ui/spec019-no-egress.test.tsx`, `test/ui/spec019-entry-point.test.tsx` | Implemented |
| NFR-002 | game index | `buildGameData` over `buildTaxonomyIndex` | `test/spec019-guess-evaluation.test.ts` | Implemented |
| NFR-003 | build budget | no new data artifact | `pnpm run check:budget` | Implemented |
| NFR-004 | clock injection | `now`/`random` props on `DailyGenusScreen` | `test/spec019-daily-selection.test.ts` | Implemented |
| SEC-001 | — | no obfuscation implemented | inspection | Implemented |
| SEC-002 | persistence | `state/dailyGenusStorage.ts` | `test/spec019-persistence.test.ts` | Implemented |
| DATA-001 | derived pool & index | `buildGameData` (in-browser, no artifact) | `test/spec019-answer-pool.test.ts` | Implemented |
| API-001 | read layer | reuses `buildTaxonomyIndex` + `relatedness` unchanged | `pnpm test` | Implemented |
| UX-001 | daily screen | `components/dailyGenus.module.css` (tokens only) | `test/ui/spec019-daily-screen.test.tsx` | Implemented |
| UX-002 | screen states | `DailyGenusScreen` state branches | `test/ui/spec019-states.test.tsx` | Implemented |
| UX-003 | accessibility | live region, labels, keyboard | `test/e2e/a11y.e2e.ts`, `test/e2e/spec019-daily.e2e.ts` | Implemented |
| UX-004 | provenance | snapshot date + `acceptedPer` in the reveal | `test/ui/spec019-daily-screen.test.tsx` | Implemented |

## Implementation notes

Implemented 2026-08-11. Shape as predicted at approval: a pure core
(`src/app/state/dailyGenus.ts`) with no React, no clock and no storage; the
storage adapter isolated in one module (`dailyGenusStorage.ts`) so SEC-002 is
checkable in one place; a screen over both; and the instant and the practice
draw injected as props so NFR-004 holds.

**No deviations from the approved requirements.** Four decisions worth
recording, all inside the approved scope:

1. **API-001 cost nothing.** SPEC-017's `buildTaxonomyIndex` and `relatedness`
   already provided indexed lookups and the last-common-ancestor walk, so the
   game added no traversal code and no read-API surface at all.
2. **The frontier no longer repeats its guess.** The mockup labelled both the
   frontier node (`◂ Gorgosaurus`) and the branch that guess ruled out
   (`✕ Albertosaurinae ◂ Gorgosaurus`). Since a guess's eliminated branch hangs
   from the very clade it established, that printed the same name twice on one
   row. The node label is now suppressed when one of its own eliminations
   already names that guess; the frontier stays marked by the teal ring, the
   underline, and its accessible text.
3. **The boot fragment is read before the first render, not dispatched after
   it.** Applying `#daily` in an effect let the map mount for one pass first,
   and the map fetches its basemap index on mount — so a cold boot at `#daily`
   touched the network before the puzzle appeared, breaking NFR-001. The
   fragment now seeds the reducer's initial state.
4. **The stratigraphic column gained its scale.** As first built it drew bands
   and bars with no tick labels, which made it decoration rather than an axis
   (anti-slop checklist, "turn a scalar into an axis"). It now carries the Ma
   boundaries and the period names.

**Verified on the shipped snapshot**, not only on fixtures: the derived pool is
**985 genera** from 1,492 guessable, and a real round was played end to end in a
browser at `#daily`.

**Known limitations**, all previously recorded rather than discovered late: no
size, diet or geography clue (Non-goals); roughly one puzzle in a hundred is a
trace-fossil genus (Open questions); the eight-guess budget is reasoned, not
playtested; and the answer is in the client bundle by construction (SEC-001).

## Spec amendments

> Required for any behavioral change after the spec is Approved.

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
- [x] Open questions are resolved or explicitly deferred.
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed.
- [x] Human approval recorded before status set to Approved (owner, 2026-08-10).
