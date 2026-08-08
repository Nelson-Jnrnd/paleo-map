---
doc_type: spec
spec_id: SPEC-019
title: Daily Genus — a daily taxonomic deduction puzzle
status: Draft
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, app-shell, read-model, domain, editorial-L3, styling]
affected_interfaces: [ReadTaxon, ReadProfile, taxonomy-index, local-storage]
supersedes: []
superseded_by:
depends_on: [SPEC-001, SPEC-002, SPEC-003, SPEC-012, SPEC-013, SPEC-017]
conflicts_with: []
last_verified_at: 2026-08-08
---

# SPEC-019: Daily Genus — a daily taxonomic deduction puzzle

## Summary

A second surface in the atlas: one dinosaur genus per day, guessed in at most
eight tries. Where Wordle reveals letters, **Daily Genus reveals classification**
— each guess reports the deepest clade the guess and the answer share, how many
classification steps still separate that clade from the answer, and which branch
of the tree has just been ruled out. The revealed tree grows guess by guess until
the player names the genus. It reads only the taxonomy and profile data already
loaded at boot (no new data source, no network, no occurrence fetches), stores
progress locally, and hands the finished puzzle back to the atlas's taxon page.

## Context

Measured from the shipped snapshot (`public/data/reference.json`,
`retrievedOn: 2026-07-26`) on 2026-08-08. These numbers are what the requirements
below are sized against.

**The tree the game will play on.** 2,555 taxa ship; 2,123 genera sit under
`Dinosauria`, of which **1,731 are `Valid`** and **1,492 are valid non-avian**
(the `Avialae`/`Aves` subtrees hold the rest — SPEC-017 REQ-006 already draws
that line). Depth below `Dinosauria` for well-known genera runs **3 to 19 steps,
median 10** (e.g. `Dinosauria > Theropoda > Neotheropoda > Averostra > Tetanurae
> Coelurosauria > Tyrannosauroidea > Tyrannosauridae > Tyrannosaurinae >
Tyrannosaurini > Tyrannosaurus`).

**What the profiles can support as clues, with zero pipeline work.**

| Field | Coverage over the 1,731 valid genera | Usable as a clue? |
| --- | --- | --- |
| Silhouette | 1,731 (100%) | Yes — hint and answer reveal |
| `timeSpan` (min/max Ma) | 1,730 (99.9%) | Yes — earlier/later + period |
| `Diet` attribute | 1,622 (93.7%) | Yes, with an explicit "Not available" |
| Wikipedia article | 1,635 (94.5%) | Answer-pool quality gate only |
| Image | 1,045 (60.4%) | Answer-pool quality gate only |
| PBDB `measurements` | **0 (0%)** | **No** — no size clue is possible |
| Geography (continent / region) | **not on the profile** | **No** — see Non-goals |

Body size and geography are the two clues a player would most expect, and
neither is available: PBDB measurements are empty across every profile, and
geography lives on occurrences in the 40 MB per-stage files, not on the taxon.
Both are excluded from this spec rather than half-built (Non-goals, Open
questions).

**The signal problem this spec has to solve.** Over all ordered pairs of the 77
best-known genera in the snapshot (those carrying a SPEC-014 enrichment record),
the deepest shared ancestor is **`Dinosauria` in 64.6% of pairs** —
`Ornithischia` 5.1%, `Cerapoda` 4.8%, `Tetanurae` 3.9%, `Coelurosauria` 3.2%,
everything else below 3%. The shared-clade name **on its own is a weak signal**:
two guesses in three would just say "Dinosauria". Three requirements exist
specifically to fix that and are not decorative:

- **REQ-005** publishes the answer's total depth, bounding the search to a known
  number of steps (3–19, median 10).
- **REQ-004** reports the remaining distance from the shared clade to the answer
  (median 9 steps, max 19) — a coarse "Dinosauria" still carries a number.
- **REQ-006** names the **ruled-out branch**: a shared ancestor of `Dinosauria`
  against a *Triceratops* guess eliminates the whole of `Ornithischia` (753
  taxa). This is what converts the commonest, weakest answer into real progress.

**Prior art in-repo.** SPEC-017 established the Dinosauria-rooted scope boundary,
the lineage path helper (`src/app/components/lineage.ts`), the clade tints, and
the `screen: "taxonomy"` pattern in the exploration reducer that this spec's
screen mirrors. SPEC-013 established taxon search and its autocomplete, which
REQ-003's guess input reuses. SPEC-012 shipped the silhouettes. SPEC-001 DATA-005
forbids runtime network access and is why the puzzle must be computed in the
browser from the snapshot.

## Problem statement

The atlas rewards a visit but does not earn a return visit. There is no reason to
open it tomorrow, and its richest hidden structure — a 2,555-node classification
tree with a silhouette on every node — is something a user browses past rather
than learns. A daily puzzle whose feedback *is* the classification turns that
tree into the thing being played with: a player who guesses *Velociraptor* and
learns the answer shares `Coelurosauria` with it has just been taught where
`Coelurosauria` sits, and has three fewer branches to search.

## Goals

- One genus per day, the same genus for every player on that calendar day,
  computed offline and deterministically.
- Make classification the feedback channel: shared clade, remaining distance,
  ruled-out branch.
- Leave the player with a tree they built themselves, and a route into the
  atlas's taxon page for the answer.
- Be winnable by a knowledgeable enthusiast and legible to a beginner, using
  clues that are honest about what the snapshot does and does not know.
- Add no data source, no network call, and no build step.

## Non-goals

- **No size clue.** Zero profiles carry a PBDB measurement (Context). A
  taller/shorter row would be "Not available" on every line and is excluded.
- **No geography clue in this spec.** Per-taxon continent or region is not on the
  profile; deriving it means aggregating the per-stage occurrence files at build
  time and adding a country→continent table. It is a plausible follow-up spec,
  not part of this one (Open questions).
- **No backend, no accounts, no leaderboard, no cross-device sync.** SPEC-001
  DATA-005 stands: no runtime network access of any kind.
- **No anti-cheat.** The answer is in the client (SEC-001). This spec does not
  obfuscate, encrypt, or otherwise pretend the answer is secret.
- **Nothing above `Dinosauria`** — the 34-node stem to `Life` is out of scope for
  every surface here, exactly as in SPEC-017 REQ-001.
- **No phylogenetic inference.** The game plays on the shipped classification
  hierarchy. It does not compute or imply divergence dates or cladistic support.
- **No change to the map, timeline, occurrence loop, or taxon page** beyond the
  entry point in REQ-011 and the answer handoff in REQ-008.
- **No archive of past puzzles**, no "play yesterday's", no practice/endless
  mode.
- **No new taxonomy source, no re-parenting, no correction of the shipped tree.**

## Users or actors

- **The Explorer** (charter §1) — a returning player, on a phone as often as a
  desktop.
- **A first-time visitor** who arrives at the puzzle before ever seeing the map,
  and must be able to finish a round without knowing the atlas exists.

## Functional requirements

### REQ-001: Deterministic daily selection

- **Statement:** The puzzle for a given calendar day must be a pure function
  `selectDailyGenus(date, pool) → taxonId` of that day's local calendar date and
  the shipped answer pool, with no randomness, no clock-time component, and no
  network or storage input. Selection must walk a fixed permutation of the pool
  so that every entry is used exactly once before any entry repeats.
- **Rationale:** Every player must get the same genus on the same day, results
  must be shareable, and the function must be testable without mocking a clock or
  a server.
- **Acceptance criteria:**
  - Calling the function twice with the same date and pool returns the same
    `taxonId`.
  - Over `poolLength` consecutive days the function returns every pool entry
    exactly once, and day `N + poolLength` repeats day `N`.
  - The function reads only its two arguments — a unit test that calls it with no
    DOM, no `localStorage`, and no network available passes.
  - Two dates one day apart never yield the same genus (for `poolLength > 1`).
- **Verification method:** automated test (Vitest, pure function).
- **Evidence location:** `test/spec019-daily-selection.test.ts`

### REQ-002: The answer pool

- **Statement:** Answers must be drawn from a defined pool of genera, each of
  which is, in the shipped snapshot: rank `Genus`; inside the `Dinosauria`
  subtree; non-avian (outside `Avialae` and `Aves`); `Valid`; and carrying a
  silhouette, a `timeSpan`, a Wikipedia-sourced summary, and at least one image.
  The pool is composed as: the derived candidate set matching those conditions
  with `occurrenceCount >= 3`, **plus** an editorial (L3) inclusion list, **minus**
  an editorial exclusion list. The shipped pool must contain **at least 120
  entries**, and the build must fail if it contains fewer.
- **Rationale:** An answer must be reachable — a player cannot deduce a genus
  with no picture, no summary and one occurrence. The derived set (298 genera at
  the measured snapshot) supplies the volume; the editorial lists exist because
  occurrence count is a poor proxy for how well known an animal is — it admits
  ichnotaxa (`Wintonopus`, `Megalosauripus`, `Deltapodus` are trace-fossil
  genera) and excludes famous animals known from a single skeleton
  (`Argentinosaurus`, `Carnotaurus`, `Eoraptor`, each `occurrenceCount = 1`).
  The 120-entry floor gives four months before a repeat.
- **Acceptance criteria:**
  - Every pool entry satisfies every listed condition, checked against the
    shipped `reference.json`.
  - No pool entry is an ichnotaxon or ootaxon (enforced via the exclusion list).
  - `poolLength >= 120`; a smaller pool fails the test rather than shipping.
  - The 77 genera carrying a SPEC-014 enrichment record are all in the pool.
  - Changing the snapshot cannot silently drop an editorial inclusion: an
    inclusion-list id that no longer resolves to a qualifying genus fails the
    test.
- **Verification method:** automated test against the shipped data artifact.
- **Evidence location:** `test/spec019-answer-pool.test.ts`

### REQ-003: The guessable set and guess validation

- **Statement:** A guess must be one of the **valid non-avian genera under
  `Dinosauria`** (1,492 at the measured snapshot) — a superset of the answer pool.
  Input must be an autocomplete over that set (reusing the SPEC-013 search
  behaviour); a submission that does not resolve to a member must be rejected
  without consuming a guess, and must state why in domain terms — distinguishing
  "no such genus in this snapshot" from "that name is in the snapshot but is not
  a valid genus" (naming its `validity` status, e.g. `Synonymous`), and from "that
  genus is outside `Dinosauria`".
- **Rationale:** Wordle's split between a large guess dictionary and a small
  answer list is what makes guessing feel free while keeping answers fair. The
  rejection messages are the product's honesty rule applied to input: a snapshot
  that calls a name `Synonymous` should say so rather than "not found".
- **Acceptance criteria:**
  - Every one of the 1,492 valid non-avian genera is accepted as a guess.
  - A rejected submission leaves the guess count, the revealed tree, and the
    stored state unchanged.
  - Each of the three rejection reasons renders its own message, and each names
    the taxon or status it is talking about.
  - The same genus cannot be guessed twice in one puzzle; a repeat is rejected as
    "already guessed" and does not consume a guess.
  - Autocomplete matches are case-insensitive and diacritic-insensitive.
- **Verification method:** automated test (Vitest + Testing Library) over the
  shipped data artifact.
- **Evidence location:** `test/ui/spec019-guess-input.test.tsx`

### REQ-004: Per-guess classification feedback

- **Statement:** For each accepted guess the game must report, computed from the
  shipped classification: (a) the **deepest clade shared** by the guess and the
  answer (its scientific name and rank); (b) the number of **classification steps
  from that shared clade down to the answer**; and (c) whether that number is
  smaller than for every previous guess (i.e. whether this guess is the closest
  so far). It must not report anything about the answer below the shared clade.
- **Rationale:** The shared clade alone is `Dinosauria` in 64.6% of well-known
  pairs (Context); the step count is what makes a coarse answer actionable, and
  the closest-so-far marker is what tells a player which line of attack is
  working.
- **Acceptance criteria:**
  - For guess *Velociraptor* against answer *Tyrannosaurus*, the shared clade is
    `Coelurosauria`; against *Triceratops* it is `Dinosauria`.
  - The reported step count equals the answer's depth minus the shared clade's
    depth, and is `0` only for the winning guess.
  - No rendered output, DOM attribute, or stored value names a taxon strictly
    below the shared clade before the puzzle ends (see REQ-013).
  - The shared clade is never a node above `Dinosauria`; for two genera whose
    only common ancestor would be higher, it is `Dinosauria`.
- **Verification method:** automated test (pure function + rendered screen).
- **Evidence location:** `test/spec019-guess-evaluation.test.ts`

### REQ-005: The answer's depth is published from the start

- **Statement:** Before the first guess, the game must display how many
  classification steps separate `Dinosauria` from the answer, and must display
  the revealed tree rooted at `Dinosauria` with that many empty rungs.
- **Rationale:** It bounds the search without naming anything (depth 3 and depth
  19 are very different games), and it gives the empty state a shape — the ladder
  the player is going to fill in.
- **Acceptance criteria:**
  - The number shown equals the answer's own depth below `Dinosauria` (3–19 for
    the measured pool).
  - It is present on a fresh puzzle with zero guesses.
  - The empty rungs carry no taxon name, id, or silhouette.
- **Verification method:** automated test (rendered screen).
- **Evidence location:** `test/ui/spec019-daily-screen.test.tsx`

### REQ-006: The progressive revealed tree

- **Statement:** The game's primary surface is a tree, rooted at `Dinosauria`,
  that accumulates across guesses. It must show, at all times: every node on the
  path from `Dinosauria` to the **deepest shared clade reached so far**, marked as
  a confirmed ancestor of the answer; for each guess, the **child branch of its
  shared clade that contains the guess**, marked as ruled out and labelled with
  the guessed genus; and the unresolved gap between the deepest confirmed
  ancestor and the answer. No node may be marked confirmed unless it is an
  ancestor of the answer, and no node below the deepest shared clade reached may
  appear at all except as a ruled-out branch.
- **Rationale:** This is the mechanic — the reveal that replaces Wordle's
  letters. The ruled-out branch is what makes the commonest feedback
  (`Dinosauria`, 64.6%) worth something: it eliminates an entire division.
- **Acceptance criteria:**
  - After a guess whose shared clade is `Dinosauria`, exactly one child of
    `Dinosauria` is marked ruled out, and it is the one containing the guess.
  - After a guess with a deeper shared clade, every node from `Dinosauria` down
    to that clade is marked confirmed.
  - A later, shallower guess never retracts a confirmed node.
  - Ruled-out branches accumulate; guessing two genera in the same ruled-out
    branch does not add a second elimination marker for that branch.
  - The tree is rendered from the loaded snapshot only — no network request is
    issued when it updates.
- **Verification method:** automated test (pure reducer + rendered screen).
- **Evidence location:** `test/spec019-revealed-tree.test.ts`

### REQ-007: Secondary clue rows — time and diet

- **Statement:** Each guess must additionally compare, against the answer: its
  **time span** (`timeSpan.minMa`/`maxMa`) — reporting whether the answer is
  older, younger, or overlapping, and the answer's geological period once any
  guess overlaps it — and its **diet** (the `Diet` attribute) — reporting match or
  no match. Where either field is absent for the guess or the answer, the row
  must read as an explicit "Not available", never as a blank, a dash, or a
  negative result.
- **Rationale:** With the tree signal coarse two guesses in three, these two rows
  carry the early game. They are the only two comparable fields with near-total
  coverage (99.9% and 93.7%); the explicit-missing rule is the charter's
  first-class-uncertainty rule (FONC-490, FONC-1120) applied to a game.
- **Acceptance criteria:**
  - Older/younger is decided by the two spans and reported as overlapping when
    they intersect.
  - The answer's period is disclosed only after a guess whose span overlaps it,
    and never before.
  - A guess with no `Diet` attribute shows "Not available" on the diet row and no
    match/no-match verdict.
  - No clue row invents a value the snapshot does not carry.
- **Verification method:** automated test (pure function + rendered screen).
- **Evidence location:** `test/spec019-clue-rows.test.ts`

### REQ-008: Termination, reveal, and handoff to the atlas

- **Statement:** A puzzle ends when the answer is guessed or after **eight**
  unsuccessful guesses. On either ending the game must reveal the answer's
  scientific name, silhouette, full descent from `Dinosauria`, time span, and the
  reference its accepted name rests on (`acceptedPer`), and must offer a control
  that opens that genus's taxon page in the atlas.
- **Rationale:** Eight is sized against the measured tree: the first guess
  eliminates one of a handful of divisions, depth (REQ-005) bounds the target, and
  the two clue rows narrow period and diet — a loss should feel like a near miss,
  not a lottery. The handoff is the point of building the game inside the atlas:
  the puzzle ends where the product's real content begins.
- **Acceptance criteria:**
  - A correct guess at any position ends the puzzle as a win, and a ninth guess
    is never accepted.
  - Both endings show the same reveal block.
  - The handoff control opens the taxon page for exactly the answer's `taxonId`.
  - The reveal names the source of the accepted name; it is not presented as an
    unsourced fact.
- **Verification method:** automated test (rendered screen) + manual check.
- **Evidence location:** `test/ui/spec019-daily-screen.test.tsx`

### REQ-009: Optional silhouette hint

- **Statement:** From the fifth unsuccessful guess onward the player may reveal
  the answer's silhouette. Taking the hint must be recorded in the puzzle state
  and marked in the shared summary (REQ-010). It must not consume a guess.
- **Rationale:** Every genus in the snapshot has a silhouette (100% coverage), and
  it is the most on-brand hint the data can offer. Gating it to the fifth guess
  keeps it a rescue rather than a shortcut; marking it keeps a shared result
  honest.
- **Acceptance criteria:**
  - The control is unavailable before the fifth unsuccessful guess and available
    after it.
  - Revealing the silhouette does not change the guess count or end the puzzle.
  - A puzzle finished with a hint is distinguishable from one finished without,
    in both the stored state and the shared summary.
- **Verification method:** automated test (rendered screen).
- **Evidence location:** `test/ui/spec019-daily-screen.test.tsx`

### REQ-010: Local persistence and the shared summary

- **Statement:** Today's puzzle state (the answer's `taxonId`, the guesses in
  order, whether the hint was used, and the outcome) and a running record (games
  played, wins, current and best streak, distribution of winning guess counts)
  must persist in browser local storage, keyed by the calendar date, so that
  reloading resumes the same puzzle in the same state. The game must also produce
  a **spoiler-free** text summary — puzzle number, guess count out of eight,
  hint marker, and one line per guess showing that guess's remaining distance —
  containing **no taxon name**, and copy it to the clipboard on request.
- **Rationale:** A puzzle that resets on reload is not a daily puzzle. The
  spoiler-free rule is what makes a result shareable at all; the per-guess
  distance line is this game's equivalent of Wordle's coloured squares and comes
  from data the player already has.
- **Acceptance criteria:**
  - Reloading mid-puzzle restores the exact guess list, revealed tree, hint
    state, and outcome.
  - Stored state for a previous date does not resume as today's puzzle.
  - The summary text contains no scientific name, taxon id, rank, or clade name.
  - With local storage unavailable or full, the game remains fully playable for
    the session and says plainly that progress will not be kept (see UX-002).
  - With the clipboard unavailable, the summary is still shown as selectable
    text.
- **Verification method:** automated test (rendered screen with a stubbed
  storage) + manual check.
- **Evidence location:** `test/ui/spec019-persistence.test.tsx`

### REQ-011: Entry point and addressability

- **Statement:** The game is a screen in the existing app shell, reached from the
  context bar alongside the taxonomy screen, and addressable by the URL fragment
  `#daily` — loading the app with that fragment opens the game, entering and
  leaving the game updates the fragment, and the browser back control returns to
  the previous screen.
- **Rationale:** The app has no router (SPEC-003 shell, SPEC-017 screen pattern);
  a fragment gives the puzzle a linkable, bookmarkable address without
  introducing routing as a dependency of this spec.
- **Acceptance criteria:**
  - Booting with `#daily` lands on the game screen.
  - Opening the game from the context bar sets the fragment; leaving clears it.
  - Back from the game returns to the screen the player came from.
  - No route library is added to `package.json`.
- **Verification method:** automated test (rendered shell) + manual check.
- **Evidence location:** `test/ui/spec019-entry-point.test.tsx`

### REQ-012: Date rollover

- **Statement:** If the local calendar date changes while the game is open, the
  game must not silently swap the answer under the player. It must finish the
  open puzzle if one is in progress, and offer an explicit control to start the
  new day's puzzle.
- **Rationale:** A puzzle that mutates mid-round at local midnight destroys the
  round and the streak record with it.
- **Acceptance criteria:**
  - With a puzzle in progress across a simulated date change, the answer,
    guesses, and revealed tree are unchanged.
  - The new day's puzzle starts only after the explicit control is used.
  - The completed previous day's result is still recorded against its own date.
- **Verification method:** automated test (rendered screen with a controlled
  date).
- **Evidence location:** `test/ui/spec019-rollover.test.tsx`

### REQ-013: Scope boundary at `Dinosauria`

- **Statement:** No surface in this spec may render, traverse to, or link to a
  taxon outside the `Dinosauria` subtree. Any traversal that would leave the
  subtree terminates at `Dinosauria` and presents it as the root.
- **Rationale:** Consistency with SPEC-017 REQ-001 (owner decision, 2026-08-05).
  A shared ancestor of `Archosauria` would also be a spoiler-free way of saying
  "nothing in common", which is what `Dinosauria` already says.
- **Acceptance criteria:**
  - Every rendered ancestor chain begins at `Dinosauria`.
  - No node outside the subtree appears in the tree, the clue rows, the reveal,
    or the guess autocomplete.
- **Verification method:** automated test.
- **Evidence location:** `test/spec019-revealed-tree.test.ts`

## Non-functional requirements

### NFR-001: No runtime network access, and no occurrence fetches

- **Statement:** The game screen must issue no network request of any kind — in
  particular it must not trigger the per-stage occurrence fetches the map screen
  uses. It runs entirely on `reference.json`, which the app already loads at boot.
- **Rationale:** SPEC-001 DATA-005. The stage files total roughly 40 MB; a puzzle
  that pulled them would cost more to load than the whole game is worth.
- **Acceptance criteria:**
  - With `fetch` stubbed to throw, a full round (open, guess, win, share)
    completes.
  - Opening the game screen from a cold boot performs zero stage fetches.
- **Verification method:** automated test (network-stubbed render), extending the
  existing `test/data-005-no-runtime-egress.test.ts` pattern.
- **Evidence location:** `test/ui/spec019-no-egress.test.tsx`

### NFR-002: Evaluation cost

- **Statement:** Guess evaluation (shared clade, distance, tree update, clue
  rows) must be O(depth) per guess using pre-built id→taxon and id→profile
  indexes, not repeated linear scans of the 2,555-taxon array, and must complete
  within 50 ms on the reference phone profile used by SPEC-017.
- **Rationale:** `src/read/api.ts` resolves taxa with `Array.prototype.find`
  (O(n)); SPEC-017 NFR-002 already required indexes for the same reason. Depth is
  at most 19.
- **Acceptance criteria:**
  - No code path in the game calls a linear taxon lookup per guess.
  - A measured evaluation of a worst-case (depth-19) guess stays under 50 ms.
- **Verification method:** automated test + inspection.
- **Evidence location:** `test/spec019-guess-evaluation.test.ts`

### NFR-003: No new data artifact beyond the editorial pool

- **Statement:** The only new shipped data is the editorial pool file (REQ-002),
  which must stay under 16 KB; no change to `reference.json`, the stage files, or
  the basemap; no new build step; no new runtime dependency.
- **Rationale:** SPEC-017 set the precedent that a feature built on data that
  already ships costs nothing to load. The budget check
  (`pnpm run check:budget`) must not regress.
- **Acceptance criteria:**
  - `git status` after implementation shows no change to any file under
    `public/data/` other than the new pool file.
  - `pnpm run check:budget` passes unchanged.
  - `package.json` gains no dependency.
- **Verification method:** script + inspection.
- **Evidence location:** `pnpm run check:budget` output in the PR.

### NFR-004: Deterministic and clock-independent tests

- **Statement:** Every behaviour in this spec that depends on the date must be
  testable by injecting the date; no test may depend on the wall clock, and no
  test may be time-of-day flaky.
- **Rationale:** A daily game is otherwise untestable in CI.
- **Acceptance criteria:**
  - Date enters the game through a single injected value, defaulted at the app
    boundary.
  - The suite passes with the system clock set to any date.
- **Verification method:** automated test + inspection.
- **Evidence location:** `test/spec019-daily-selection.test.ts`

## Security and privacy considerations

### SEC-001: The answer is client-side and is not treated as a secret

- **Statement:** The daily answer is computed in the browser from shipped data
  and is therefore discoverable by anyone reading the bundle or the console. The
  product must not claim otherwise, must not attempt obfuscation or
  anti-tamper measures, and must not add a backend to hide it.
- **Rationale:** SPEC-001 DATA-005 rules out a server. Pretending a client-side
  value is secret is the kind of dishonesty this product's charter exists to
  avoid; the stake is a puzzle, not an asset.
- **Acceptance criteria:**
  - No obfuscation, encryption, or integrity check of the answer is implemented.
  - No requirement in this spec depends on the answer being unknowable.
- **Verification method:** inspection.
- **Evidence location:** PR review notes.

### SEC-002: Local storage holds no personal data

- **Statement:** Stored state is limited to the fields listed in REQ-010 — taxon
  ids, guess names, counts, dates, and outcomes. No identifier, no free text, no
  telemetry, and nothing transmitted anywhere. Clearing site data must fully
  reset the game with no error.
- **Rationale:** The product collects nothing today; a game is not a reason to
  start.
- **Acceptance criteria:**
  - The stored payload matches a documented schema and contains no other field.
  - Clearing storage mid-puzzle leaves the app functional.
- **Verification method:** automated test + inspection.
- **Evidence location:** `test/ui/spec019-persistence.test.tsx`

## Data model impact

### DATA-001: The editorial answer pool (L3)

- **Statement:** A new L3 editorial artifact lists the pool's inclusions and
  exclusions by `taxonId` **and** scientific name, each exclusion carrying a
  one-line reason (e.g. "ichnotaxon", "avian"). It is hand-authored, versioned in
  git, and attributed as *Editorial* — it asserts nothing about paleobiology,
  only about which genera make a fair puzzle.
- **Rationale:** SPEC-001 §3 reserves L3 for hand-authored, attributed curation;
  "well known enough to guess" is exactly that kind of judgement and must not be
  smuggled into the derived L2 layer.
- **Acceptance criteria:**
  - Every entry carries both id and name, and ids resolve in the snapshot.
  - Every exclusion carries a reason.
  - The file is marked Editorial and introduces no scientific claim.
- **Verification method:** automated test.
- **Evidence location:** `test/spec019-answer-pool.test.ts`

### DATA-002: In-browser game index

- **Statement:** The game derives its working structures — id→taxon, id→profile,
  parent→children, and the ancestor path per genus — in the browser from the
  loaded read model, at screen open. Nothing is precomputed at build time and
  nothing is written back to the read model.
- **Rationale:** Keeps NFR-003 true (no new artifact) while satisfying NFR-002.
- **Acceptance criteria:**
  - The index builds from `ReadModel` alone.
  - The read model is not mutated.
- **Verification method:** automated test.
- **Evidence location:** `test/spec019-guess-evaluation.test.ts`

## API impact

### API-001: Read API additions

- **Statement:** Any lookup the game needs beyond today's `ReadApi` (indexed
  taxon/profile access, children of a node, ancestor path) is added to the read
  layer as pure, side-effect-free methods. No existing method changes signature
  or behaviour.
- **Rationale:** SPEC-017 introduced the same need; this spec must not fork a
  second taxonomy traversal helper alongside
  `src/app/components/lineage.ts`.
- **Acceptance criteria:**
  - Existing read-API tests pass unchanged.
  - The game contains no second implementation of ancestor-path traversal.
- **Verification method:** automated test + inspection.
- **Evidence location:** `test/data-010-rank-map.test.ts` (unchanged) and PR diff.

## UI or UX impact

### UX-001: Charter compliance

- **Statement:** The screen follows `docs/mockups/design-guidelines.md`: domain
  language only (taxa, clades, Ma, periods — never "score", "level", "points",
  "streak" is permitted only as the plain word for consecutive days); the teal
  accent used only for the data and interaction layer; ICS period hues and clade
  tints used for meaning only; the light cartographic neutrals; restraint over
  decoration. Scientific names are italic (CONS-350).
- **Rationale:** A game is the easiest place to drift into generic product-speak
  and decorative colour, and the charter is binding on all UI in this repository.
- **Acceptance criteria:**
  - No banned vocabulary (charter §3) appears in the screen's copy.
  - The only accent is teal; clade tints appear only on clade nodes; period hues
    only on period statements.
  - Every colour used to convey a verdict is paired with a shape or a word.
- **Verification method:** inspection against the guidelines + automated copy
  check.
- **Evidence location:** `test/ui/spec019-daily-screen.test.tsx`

### UX-002: Every state is designed

- **Statement:** These states must all be designed and implemented, not just the
  win: fresh puzzle (zero guesses); in progress; won; lost; already completed
  today; invalid guess (each of the three reasons in REQ-003); repeated guess;
  hint taken; storage unavailable; clipboard unavailable; snapshot loaded but the
  pool empty or unresolvable (an error state with a retry, matching the shell's
  existing error pattern).
- **Rationale:** Charter §2 and the repo's `empty-error-states` convention: real
  states are designed, never left to fall out of the happy path.
- **Acceptance criteria:**
  - Each listed state renders a distinct, labelled surface.
  - No state renders a blank region or a silent default.
- **Verification method:** automated test (rendered screen per state).
- **Evidence location:** `test/ui/spec019-states.test.tsx`

### UX-003: Accessibility

- **Statement:** The screen is fully keyboard operable (guess input, submit,
  hint, share, handoff, tree navigation); guess results are announced through a
  live region; colour is never the sole carrier of a verdict; contrast meets WCAG
  2 AA; the tree carries accessible names describing each node's state
  (confirmed ancestor / ruled out / unresolved).
- **Rationale:** The repository already gates on axe (`test/e2e/a11y.e2e.ts`), and
  SPEC-003 AMEND-002 established that accessibility wins over the aesthetic hex.
- **Acceptance criteria:**
  - The axe gate passes on the game screen with no new violations.
  - A round can be completed with the keyboard alone.
  - Each guess result is announced once, and only once.
- **Verification method:** automated test (Playwright + axe) + manual check.
- **Evidence location:** `test/e2e/a11y.e2e.ts`, `test/e2e/spec019-daily.e2e.ts`

### UX-004: The snapshot's classification is presented as sourced, not settled

- **Statement:** The screen must state that the classification being played on is
  the shipped PBDB snapshot at its `retrievedOn` date, and the answer reveal must
  name the reference the accepted name rests on (`acceptedPer`). The game must
  never imply that a placement is a settled fact or that a player's disagreement
  with the tree is an error.
- **Rationale:** The product's credibility rests on never presenting an assertion
  as an intrinsic fact (charter §2, SPEC-001 §4). A quiz format makes that risk
  sharper, not weaker: being told "wrong" by a classification is exactly where a
  user needs to see whose classification it is.
- **Acceptance criteria:**
  - The snapshot date is visible on the screen without a hover or a second click.
  - The reveal shows `acceptedPer` for the answer.
  - No copy asserts a placement without its source.
- **Verification method:** automated test (rendered screen) + inspection.
- **Evidence location:** `test/ui/spec019-daily-screen.test.tsx`

## Configuration impact

- No environment variables, no feature flags, no build configuration. The pool
  file path is a constant in the app data layer.
- The maximum guess count (8) and the hint threshold (5) are named constants in
  one module so a change is a one-line, testable edit under an amendment.

## Error handling

| Condition | Response |
| --- | --- |
| Snapshot loaded but the pool resolves to fewer than 120 usable genera | Error state with the shell's existing retry; the game does not start with a degraded pool (REQ-002) |
| A pool entry's `taxonId` is absent from the snapshot | That entry is skipped, the skip is surfaced in the pool test as a failure, and selection continues over the remaining pool |
| Local storage read fails or holds malformed JSON | Treated as "no stored state"; the puzzle starts fresh and the storage-unavailable notice is shown (UX-002) |
| Stored state names a `taxonId` that is not today's answer | Stored state for that date is discarded, not migrated |
| Clipboard write rejected | The summary is rendered as selectable text with an explanation |
| Guess submitted after the puzzle ended | Rejected; the ended state is unchanged |

## Edge cases

- **The answer is the shallowest possible genus** (depth 3 below `Dinosauria`):
  REQ-005's ladder is three rungs and one good guess can end it. Acceptable.
- **The answer is the deepest** (depth 19): eight guesses may not be enough; the
  loss path (REQ-008) must still read as a near miss, showing the deepest
  confirmed ancestor reached.
- **A guess is the answer's direct parent's other child** — the shared clade sits
  one step above the answer and the distance is 1; the tree must not thereby name
  the answer.
- **Two guesses in the same ruled-out branch** — one elimination marker, not two
  (REQ-006).
- **A guess whose profile has no `timeSpan`** (1 genus in the snapshot) — the time
  row reads "Not available" and the tree feedback is unaffected.
- **A player's clock is set to a past or future date** — they get that date's
  puzzle; nothing breaks, and the result is stored against that date.
- **The pool changes in a later snapshot** — the daily sequence changes from that
  release onward. Already-stored results keep their own `taxonId` and remain
  readable. Past puzzles are not reproducible across pool changes, and this spec
  does not promise they are.
- **A first-time visitor lands on `#daily`** — the shell still performs its normal
  boot (reference load), and the game must render its own loading state rather
  than a blank screen.

## Acceptance criteria

This spec is satisfied when all of the following hold:

1. Opening the app at `#daily`, or from the context bar, presents a puzzle whose
   answer is the same for a given calendar date on every device, computed with no
   network access.
2. Each accepted guess reports the deepest shared clade, the remaining distance,
   the time and diet comparisons, and updates a growing tree that marks confirmed
   ancestors and ruled-out branches — and reveals nothing below the deepest
   shared clade.
3. A round ends in a win or after eight guesses, reveals the answer with its
   descent, silhouette, time span and `acceptedPer`, and offers a route to that
   genus's taxon page.
4. Progress and the running record survive a reload, and the shared summary
   contains no taxon name.
5. Every state in UX-002 is implemented and labelled; the axe gate passes; a round
   is completable by keyboard alone.
6. `pnpm run typecheck`, `pnpm test`, `pnpm run lint`, `pnpm run format`,
   `pnpm e2e`, `pnpm run check:budget`, and the three governance scripts all pass,
   and no file under `public/data/` changes except the new pool file.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Same date + pool → same genus; full cycle before repeat | automated test | `pnpm test spec019-daily-selection` | `test/spec019-daily-selection.test.ts` | |
| REQ-002 | Every pool entry passes the quality gate; pool ≥ 120 | automated test | `pnpm test spec019-answer-pool` | `test/spec019-answer-pool.test.ts` | |
| REQ-003 | 1,492 genera guessable; three rejection reasons; no guess consumed | automated test | `pnpm test spec019-guess-input` | `test/ui/spec019-guess-input.test.tsx` | |
| REQ-004 | Shared clade + distance correct; nothing below it revealed | automated test | `pnpm test spec019-guess-evaluation` | `test/spec019-guess-evaluation.test.ts` | |
| REQ-005 | Depth shown before the first guess; rungs unnamed | automated test | `pnpm test spec019-daily-screen` | `test/ui/spec019-daily-screen.test.tsx` | |
| REQ-006 | Confirmed path and ruled-out branches accumulate correctly | automated test | `pnpm test spec019-revealed-tree` | `test/spec019-revealed-tree.test.ts` | |
| REQ-007 | Older/younger/overlap and diet rows; explicit "Not available" | automated test | `pnpm test spec019-clue-rows` | `test/spec019-clue-rows.test.ts` | |
| REQ-008 | Win/loss at 8; reveal block; taxon-page handoff | automated test + manual | `pnpm test spec019-daily-screen` | `test/ui/spec019-daily-screen.test.tsx` | |
| REQ-009 | Hint gated at guess 5; recorded; consumes no guess | automated test | `pnpm test spec019-daily-screen` | `test/ui/spec019-daily-screen.test.tsx` | |
| REQ-010 | Reload resumes; summary is spoiler-free | automated test + manual | `pnpm test spec019-persistence` | `test/ui/spec019-persistence.test.tsx` | |
| REQ-011 | `#daily` boots the game; fragment kept in sync; no router added | automated test + manual | `pnpm test spec019-entry-point` | `test/ui/spec019-entry-point.test.tsx` | |
| REQ-012 | Date change mid-round does not swap the answer | automated test | `pnpm test spec019-rollover` | `test/ui/spec019-rollover.test.tsx` | |
| REQ-013 | Nothing outside the `Dinosauria` subtree is rendered | automated test | `pnpm test spec019-revealed-tree` | `test/spec019-revealed-tree.test.ts` | |
| NFR-001 | Full round with `fetch` stubbed to throw; zero stage fetches | automated test | `pnpm test spec019-no-egress` | `test/ui/spec019-no-egress.test.tsx` | |
| NFR-002 | Indexed lookups; depth-19 evaluation under 50 ms | automated test + inspection | `pnpm test spec019-guess-evaluation` | `test/spec019-guess-evaluation.test.ts` | |
| NFR-003 | No `public/data/` change but the pool file; budget unchanged | script + inspection | `pnpm run check:budget`, `git status` | PR diff | |
| NFR-004 | Date injected; suite clock-independent | automated test + inspection | `pnpm test` with a shifted system clock | `test/spec019-daily-selection.test.ts` | |
| SEC-001 | No obfuscation implemented or implied | inspection | PR review | PR review notes | |
| SEC-002 | Stored payload matches the documented schema only | automated test | `pnpm test spec019-persistence` | `test/ui/spec019-persistence.test.tsx` | |
| DATA-001 | Ids and names resolve; every exclusion has a reason | automated test | `pnpm test spec019-answer-pool` | `test/spec019-answer-pool.test.ts` | |
| DATA-002 | Index built from `ReadModel`; model not mutated | automated test | `pnpm test spec019-guess-evaluation` | `test/spec019-guess-evaluation.test.ts` | |
| API-001 | Existing read-API behaviour unchanged; no duplicate traversal | automated test + inspection | `pnpm test` | PR diff | |
| UX-001 | Charter vocabulary and colour rules honoured | inspection + automated copy check | `pnpm test spec019-daily-screen` | `test/ui/spec019-daily-screen.test.tsx` | |
| UX-002 | Each listed state renders a distinct labelled surface | automated test | `pnpm test spec019-states` | `test/ui/spec019-states.test.tsx` | |
| UX-003 | Axe passes; keyboard-only round; single announcement | automated test + manual | `pnpm e2e` | `test/e2e/spec019-daily.e2e.ts`, `test/e2e/a11y.e2e.ts` | |
| UX-004 | Snapshot date visible; `acceptedPer` shown on reveal | automated test + inspection | `pnpm test spec019-daily-screen` | `test/ui/spec019-daily-screen.test.tsx` | |

## Test plan

**Unit (Vitest, no DOM).** The pure core — daily selection over an injected date
and pool (REQ-001), guess evaluation and shared-clade distance (REQ-004), the
revealed-tree reducer (REQ-006, REQ-013), the clue-row comparisons (REQ-007) —
tested against small hand-built fixture trees for the logic, and against the
shipped `reference.json` for the real-data assertions (*Tyrannosaurus* /
*Velociraptor* / *Triceratops* are the worked examples in the Context and make
good fixtures).

**Data (Vitest, shipped artifact).** The answer pool gate (REQ-002, DATA-001):
every entry resolves, qualifies, and is non-avian and non-ichnotaxon; the pool is
at least 120; all 77 enriched genera are present.

**Component (Vitest + Testing Library).** The screen across every state in
UX-002, persistence with a stubbed storage, rollover with a controlled date,
`#daily` entry, and the no-egress check with `fetch` stubbed to throw.

**End-to-end (Playwright).** One full round in a real browser — open at `#daily`,
guess, lose, reveal, hand off to the taxon page — plus the axe gate on the game
screen, and a keyboard-only round.

**Fixtures.** No new data fixtures beyond the pool file and small in-test trees;
the shipped snapshot is the fixture for the real-data assertions.

**Before implementation.** Per repo convention (`docs/mockups/screens-index.md`),
a mockup for this screen — including the UX-002 states — should exist and be
listed in the screens index before the screen is built.

## Rollback plan

The game is additive: one new screen, one new entry point, one new editorial data
file, and pure modules under `src/app`. Rollback is reverting the PR — no
snapshot rebuild, no data migration, no change to any existing artifact. If only
the entry point is at fault, removing the context-bar control and the `#daily`
handler disables the surface while leaving the modules dormant and harmless.
Local storage left behind by the feature is inert and self-clearing on the next
date change; nothing reads it outside the game.

## Open questions

- [ ] **Geography clue.** Deriving a per-genus continent set at build time (from
      the per-stage occurrences plus a country→continent table) would add the
      single most atlas-native clue — "known from South America". Deferred here as
      pipeline work. Should it be a follow-up spec?
- [ ] **Answer-pool curation depth.** The derived gate admits genera that are well
      evidenced but little known (`Owenodon`, `Komlosaurus`). Is the editorial
      exclusion list expected to prune those, or is an obscure answer acceptable
      on some days?
- [ ] **Junior synonyms as guesses.** The snapshot marks 392 genera non-`Valid`
      but does not carry an explicit senior-synonym pointer. Should a guess of a
      synonym resolve to its accepted genus (deriving the link from the parent
      relation, which is unverified) or stay rejected with its status, as REQ-003
      specifies?
- [ ] **Guess budget.** Eight is reasoned from the measured tree, not playtested.
      Confirm after the first playable build.
- [ ] **Puzzle numbering epoch.** The date used as puzzle #1 must be fixed before
      the first release, because it is baked into every shared result.

## Human decisions required

- [ ] **Approve the concept and the mechanic** (classification as the reveal
      channel) before any implementation. Answer: ______
- [ ] **Answer pool composition** (REQ-002): derived-plus-editorial as specified,
      or a fully hand-authored list of famous genera? Answer: ______
- [ ] **Keep or cut the silhouette hint** (REQ-009). Answer: ______
- [ ] **Local calendar date vs UTC** for "today" (assumption below). Answer: ______
- [ ] **Puzzle numbering epoch** (Open questions). Answer: ______

## Assumptions

Recorded per `CLAUDE.md` rather than decided silently. Each is a candidate for
the owner to overturn at approval.

1. **"Today" is the player's local calendar date**, following the convention of
   comparable daily puzzles, at the cost of players in different time zones
   changing puzzles at different moments. UTC is the alternative.
2. **The guessable set is the 1,492 valid non-avian genera**, not all 1,731 valid
   genera — avian taxa are excluded from guessing for the same reason they are
   excluded from answers (SPEC-017 REQ-006, CONS-020/030).
3. **Eight guesses, hint from the fifth**, sized against the measured tree, not
   playtested.
4. **The remaining-distance number is shown** (REQ-004). It is the strongest
   single lever against the 64.6% "Dinosauria" problem; hiding it would make the
   early game feel inert.
5. **The game is a screen with a `#daily` fragment, not a routed page** — no
   router exists in the app and this spec does not introduce one.
6. **No archive or practice mode**, so the game cannot be binged and each day's
   puzzle stays a shared event.

## Conflict check

No conflicts found.

- **SPEC-017 (taxonomy infographics)** — closest overlap. Both render the
  classification tree rooted at `Dinosauria`. This spec deliberately reuses
  SPEC-017's scope boundary (REQ-013), its lineage traversal, and its clade tints
  rather than forking them (API-001). The surfaces are distinct: SPEC-017 explains
  a tree the user can see; this spec hides one and reveals it by deduction.
  Requirement IDs are namespaced per spec, so no ID collides.
- **SPEC-001 (data architecture)** — DATA-005 (no runtime egress) is restated as
  NFR-001, not weakened. The pool file is an L3 editorial artifact, which §3 of
  the design already provides for.
- **SPEC-013 (taxon search)** — the guess input reuses its autocomplete behaviour
  over a narrower set; no change to search itself.
- **SPEC-003 / SPEC-006 (shell and loading)** — the game adds a screen to the
  existing reducer and reuses the shell's error/retry pattern; the boot sequence
  is unchanged.
- **Functional specification** — the game is a new product surface, not covered by
  any existing `FONC-`/`CONS-` requirement. It introduces no requirement that
  contradicts one; the charter rules it must honour are carried here as UX-001 and
  UX-004. Whether the functional specification should gain a section for it is a
  question for the owner at approval.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | daily selection | | `test/spec019-daily-selection.test.ts` | Not started |
| REQ-002 | answer pool | | `test/spec019-answer-pool.test.ts` | Not started |
| REQ-003 | guess input | | `test/ui/spec019-guess-input.test.tsx` | Not started |
| REQ-004 | guess evaluation | | `test/spec019-guess-evaluation.test.ts` | Not started |
| REQ-005 | daily screen | | `test/ui/spec019-daily-screen.test.tsx` | Not started |
| REQ-006 | revealed tree | | `test/spec019-revealed-tree.test.ts` | Not started |
| REQ-007 | clue rows | | `test/spec019-clue-rows.test.ts` | Not started |
| REQ-008 | daily screen | | `test/ui/spec019-daily-screen.test.tsx` | Not started |
| REQ-009 | daily screen | | `test/ui/spec019-daily-screen.test.tsx` | Not started |
| REQ-010 | persistence | | `test/ui/spec019-persistence.test.tsx` | Not started |
| REQ-011 | app shell | | `test/ui/spec019-entry-point.test.tsx` | Not started |
| REQ-012 | daily screen | | `test/ui/spec019-rollover.test.tsx` | Not started |
| REQ-013 | revealed tree | | `test/spec019-revealed-tree.test.ts` | Not started |
| NFR-001 | daily screen | | `test/ui/spec019-no-egress.test.tsx` | Not started |
| NFR-002 | game index | | `test/spec019-guess-evaluation.test.ts` | Not started |
| NFR-003 | build budget | | `pnpm run check:budget` | Not started |
| NFR-004 | date injection | | `test/spec019-daily-selection.test.ts` | Not started |
| SEC-001 | — | | inspection | Not started |
| SEC-002 | persistence | | `test/ui/spec019-persistence.test.tsx` | Not started |
| DATA-001 | editorial pool | | `test/spec019-answer-pool.test.ts` | Not started |
| DATA-002 | game index | | `test/spec019-guess-evaluation.test.ts` | Not started |
| API-001 | read API | | `pnpm test` | Not started |
| UX-001 | daily screen | | `test/ui/spec019-daily-screen.test.tsx` | Not started |
| UX-002 | daily screen states | | `test/ui/spec019-states.test.tsx` | Not started |
| UX-003 | daily screen | | `test/e2e/spec019-daily.e2e.ts` | Not started |
| UX-004 | daily screen | | `test/ui/spec019-daily-screen.test.tsx` | Not started |

## Implementation notes

To be filled during implementation. Expected shape, for review at approval time:
a pure core (`selectDailyGenus`, `evaluateGuess`, the revealed-tree reducer, the
clue comparisons) with no React and no storage, a thin screen over it in
`src/app/components`, a storage adapter isolated behind one module so SEC-002 is
checkable in one place, and the editorial pool as data — no logic in the pool
file.

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
- [ ] Open questions are resolved or explicitly deferred.
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed.
- [ ] Human approval recorded before status set to Approved.
