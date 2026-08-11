---
doc_type: spec
spec_id: SPEC-020
title: Daily Genus — a parallel well-known track, ranked by encyclopedic attention
status: Implemented
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: [23]
affected_components: [app-frontend, pipeline, read-model, domain, scripts]
affected_interfaces: [ReadProfile, popularity-cache, local-storage, url-fragments]
supersedes: []
superseded_by:
depends_on: [SPEC-001, SPEC-014, SPEC-019]
conflicts_with: []
last_verified_at: 2026-08-11
---

# SPEC-020: Daily Genus — a parallel well-known track

## Summary

SPEC-019 ships one daily puzzle drawn from all 985 eligible genera, which means
some days the answer is an eggshell genus nobody could name. This spec adds a
**second daily puzzle running in parallel** — same mechanic, same tree, drawn
only from the genera people actually look up — and an option that chooses which
track you play, honoured by both the daily and practice. Both tracks stay
deterministic and worldwide, so a shared result still means something. The
ranking comes from English Wikipedia pageviews fetched at build time into a
committed cache; the runtime stays entirely offline.

## Context

**Why a second track rather than a filter.** SPEC-019 REQ-001 guarantees the
daily answer is the same genus for every player. A per-player "only popular
genera" filter would break that quietly: two people would play different
puzzles under one puzzle number, and a shared result would no longer be
comparable. Two parallel tracks, each deterministic over its own pool, keeps the
guarantee intact for both. *(Owner decision, 2026-08-11: option A, and the
option applies to practice as well.)*

**The snapshot carries no signal for how well known a genus is.** SPEC-019
recorded this and answered it by not curating at all (owner decision,
2026-08-08). The measured consequence is on record there: the pool admits
trace-fossil and eggshell genera, roughly one puzzle in a hundred.

**Two candidate signals were measured on 2026-08-11**, not assumed:

| Genus | Article bytes | Views / year |
| --- | --- | --- |
| *Tyrannosaurus* | 246 k | 1,137,495 |
| *Velociraptor* | 80 k | 467,342 |
| *Triceratops* | 113 k | 410,108 |
| *Carnotaurus* | 72 k | 238,455 |
| *Argentinosaurus* | 63 k | 225,817 |
| *Herrerasaurus* | — | 113,025 |
| *Galeamopus* | 10 k | 5,667 |
| **Owenodon** | **36 k** | **3,645** |
| *Deltapodus* (footprints) | 7 k | 2,286 |
| *Wintonopus* (footprints) | 2 k | 869 |

Article length separates the famous from the obscure, but *Owenodon* exposes it:
a 36 kB article almost nobody reads. **Pageviews are the better signal** — they
measure the thing the track is actually for.

**The pool's own distribution**, from a 160-genus deterministic spread across the
answer pool (142 resolved, 18 unresolved — see REQ-001's null handling):

| p10 | p25 | p50 | p75 | p90 | p95 |
| --- | --- | --- | --- | --- | --- |
| 2,623 | 4,020 | 7,236 | 16,886 | 44,251 | 79,541 |

| Cut | Share of sample | Implied pool size |
| --- | --- | --- |
| ≥ 5,000 /yr | 64.8% | ~638 |
| ≥ 10,000 /yr | 39.4% | ~388 |
| ≥ 20,000 /yr | 20.4% | ~201 |
| ≥ 50,000 /yr | 9.2% | ~90 |

All 985 pool genera have a resolved Wikipedia article, so the signal is
available for the whole pool in principle. The least-viewed of the sample were
*Cairanoolithus* (811), *Elongatoolithus* (1,157) and *Parabrontopodus* (1,336)
— **eggshell and footprint genera sink on their own**, so this track also
retires SPEC-019's trace-fossil edge case without a hand-written exclusion list.

**Prior art in-repo.** SPEC-014 established exactly the pattern this needs: a
build-time Wikipedia fetch into a committed cache whose envelope carries the
source and the retrieval date, with the runtime reading only the baked result.
SPEC-019's `selectDailyGenus(dateKey, pool)` already takes the pool as an
argument, so a second track needs no new selection algorithm.

## Problem statement

The daily puzzle is sometimes unwinnable-by-design: an eggshell or footprint
genus, or a taxon known from three vertebrae, is a fair member of the answer
pool but not something a player can deduce and then recognise. There is no way
to ask for a rounder game without either curating the pool by hand — a second
source of truth about the popular canon, rejected in SPEC-019 — or breaking the
one-genus-worldwide guarantee that makes a shared result mean anything.

## Goals

- A second daily puzzle, drawn only from genera people actually look up, running
  in parallel with the existing one and equally deterministic worldwide.
- One option that chooses the track, honoured by the daily **and** practice.
- A popularity signal that is measured, not hand-curated, and that refreshes with
  the snapshot.
- No change whatsoever to the existing track's behaviour or its answer sequence.
- No runtime network access, still.

## Non-goals

- **No per-player filter on a shared daily.** The track is a separate puzzle, not
  a setting that changes today's answer under one puzzle number (Context).
- **No weighting inside a track.** Within a track, selection stays the uniform
  permutation of SPEC-019 REQ-001 — every genus once before any repeat. A track
  is a different pool, never a different algorithm.
- **No difficulty slider, no per-player thresholds, no custom pools.**
- **No cross-track comparison** — no combined streak, no leaderboard, no "harder
  than" claim between tracks.
- **No non-English pageviews in this spec** (see Open questions), and no attempt
  to correct the anglophone bias that follows from that.
- **No use of popularity anywhere outside track selection.** It must not order
  search results, weight the map, or appear on the taxon page.
- **No change to the mechanic**: same tree, same guesses, same clue, same eight.
- **No runtime fetch of pageviews.** Build time only, cached and committed.

## Users or actors

- **The Explorer** (charter §1) — the player choosing a track.
- **The maintainer** running the snapshot build, who must be able to refresh the
  popularity cache without the build becoming dependent on a live API.

## Functional requirements

### REQ-001: The popularity signal

- **Statement:** A build-time script fetches, for every genus in the answer pool
  with a resolved Wikipedia article, the total English Wikipedia pageviews over a
  fixed 12-month window, and writes them to a committed cache whose envelope
  records the source, the window, and the retrieval date. A genus whose article
  does not resolve, or whose fetch fails, is recorded with a **null** popularity
  — never a zero and never an estimate. The snapshot build folds the cache into
  the read model; the runtime reads only the baked value.
- **Rationale:** Mirrors SPEC-014's enrichment cache, which is the established
  way this repository consumes Wikipedia without making the app depend on it.
  Null-not-zero matters because 18 of 160 sampled articles did not resolve on the
  first pass: a zero would silently rank a real genus as unknown, whereas null
  states that we do not know.
- **Acceptance criteria:**
  - The cache envelope carries the source, the 12-month window and `retrievedOn`.
  - A failed or unresolved fetch yields `null`, and no entry is ever inferred.
  - Re-running the script without network access leaves the cache intact and the
    build succeeding on the committed values.
  - The value in the read model equals the value in the cache — no runtime
    recomputation.
- **Verification method:** automated test + inspection.
- **Evidence location:** `test/spec020-popularity-cache.test.ts`

### REQ-002: The well-known pool

- **Statement:** The well-known pool is the answer pool of SPEC-019 REQ-002,
  restricted to genera with a non-null popularity, ranked by views descending,
  cut at the **top 250**. Ties are broken by scientific name so the cut is
  deterministic. The pool must contain at least **180** entries or the track is
  unavailable rather than degraded.
- **Rationale:** A **rank** cut, not a view threshold: absolute counts drift with
  the window and with public attention, so `views >= 20000` could yield 200
  genera one snapshot and 400 the next, silently changing how well known the
  track feels. Top 250 is stable in size and lands near the measured ≥15–20 k
  mark (the sample's p75 is 16,886), giving **eight months before a repeat**. The
  180 floor is the point below which the track is too small to be a daily.
- **Acceptance criteria:**
  - Every entry is in the SPEC-019 pool and has a non-null popularity.
  - The pool is exactly the top 250 by views, ties broken by name, or fewer when
    fewer qualify.
  - Below 180 entries the track is not offered at all (REQ-008's unavailable
    state), and the default track is unaffected.
  - Re-deriving from the same snapshot yields the same pool in the same order.
- **Verification method:** automated test against the shipped artifact.
- **Evidence location:** `test/spec020-well-known-pool.test.ts`

### REQ-003: Two parallel daily tracks

- **Statement:** Two daily puzzles run in parallel: the **full** track over the
  SPEC-019 pool, and the **well-known** track over REQ-002's pool. Each selects
  its answer with the existing `selectDailyGenus(dateKey, pool)` — the same pure
  function, a different pool — so each is a pure function of the UTC date, the
  same for every player worldwide, and uses every genus once before any repeat.
- **Rationale:** Preserves SPEC-019 REQ-001 for both tracks, and needs no new
  selection algorithm — the payoff from having kept that function pure.
- **Acceptance criteria:**
  - Both tracks are deterministic: same UTC date + same pool → same genus.
  - The two tracks may present the same genus on the same day; neither is
    suppressed because of the other.
  - Each track cycles its whole pool before repeating.
  - No weighting, sampling or randomness is introduced inside either track.
- **Verification method:** automated test (pure function).
- **Evidence location:** `test/spec020-tracks.test.ts`

### REQ-004: The track option, for the daily and for practice

- **Statement:** The player chooses the track from an option on the puzzle
  screen. The choice applies to **both** the daily round and practice rounds,
  persists across reloads, and defaults to the full track for a player who has
  never chosen. Switching tracks must not destroy an open round: each track's
  daily round is kept separately, so returning to a track resumes it.
- **Rationale:** Owner decision, 2026-08-11: the option covers practice too. The
  separate-round rule follows SPEC-019 REQ-010's existing separation of practice
  from daily — a player experimenting with the other track must not lose the
  round they are mid-way through.
- **Acceptance criteria:**
  - The option is visible on the screen and is not hidden behind a hover.
  - The choice survives a reload and applies to practice as well as the daily.
  - Switching away from a round in progress and back restores that round with its
    guesses, hint state and outcome.
  - A player with no stored choice gets the full track.
- **Verification method:** automated test (rendered screen).
- **Evidence location:** `test/ui/spec020-track-option.test.tsx`

### REQ-005: Per-track numbering, record and streaks

- **Statement:** Each track carries its own puzzle numbering, its own stored
  round, and its own record (games, wins, current and best streak, distribution).
  No combined figure across tracks is computed, stored or displayed.
- **Rationale:** A streak means "consecutive days on this puzzle". Merging two
  puzzles into one streak would make the number meaningless and would let a
  player pad it by switching tracks. No cross-track comparison is a Non-goal for
  the same reason.
- **Acceptance criteria:**
  - Playing one track leaves the other's record untouched.
  - Each track's stored state is keyed by track and by UTC date.
  - No total-across-tracks figure appears anywhere.
- **Verification method:** automated test.
- **Evidence location:** `test/ui/spec020-track-record.test.tsx`

### REQ-006: The shared summary names its track

- **Statement:** The spoiler-free summary of SPEC-019 REQ-011 must identify which
  track it came from, while remaining free of any taxon name, rank, clade name,
  depth or distance.
- **Rationale:** Two people comparing "4/8" across different tracks would be
  comparing different puzzles. Naming the track is the minimum that keeps a
  shared result honest.
- **Acceptance criteria:**
  - The summary states the track and the track's own puzzle number.
  - It still contains no scientific name, rank, clade name, or numeric distance.
- **Verification method:** automated test.
- **Evidence location:** `test/spec020-share-track.test.ts`

### REQ-007: Addressability

- **Statement:** The well-known track is addressable by URL fragment alongside
  the existing ones: the daily and the practice round each get their own
  fragment, following SPEC-019 REQ-012's scheme, with no routing library added.
  Opening a track's fragment selects that track.
- **Rationale:** Consistency with the existing entry points; a linkable track is
  how a player shares which puzzle they mean.
- **Acceptance criteria:**
  - Each of the four combinations (full/well-known × daily/practice) has a
    fragment that opens it.
  - Entering and leaving keep the fragment in step; back returns to the previous
    screen.
  - `package.json` gains no routing dependency.
- **Verification method:** automated test.
- **Evidence location:** `test/ui/spec020-track-fragments.test.tsx`

### REQ-008: The existing track is unchanged, and degradation is explicit

- **Statement:** The full track's answer sequence, mechanic, storage and share
  format must be byte-for-byte unchanged by this spec, except for the track name
  added to the summary (REQ-006). Where the popularity cache is missing, stale
  beyond the snapshot, or yields fewer than 180 qualifying genera, the
  well-known track is **not offered**, with a plain statement of why — and the
  full track continues to work exactly as before.
- **Rationale:** SPEC-019 is implemented and merged; a player's streak and
  history on it must survive this change. A half-populated popularity cache must
  degrade to "one track" rather than to a subtly different game.
- **Acceptance criteria:**
  - For any UTC date, the full track's answer is identical before and after this
    spec.
  - With the popularity cache absent, the app runs, the full track plays, and the
    well-known option is absent with a stated reason.
  - Stored full-track rounds and records from SPEC-019 still load.
- **Verification method:** automated test.
- **Evidence location:** `test/spec020-tracks.test.ts`, `test/ui/spec020-track-option.test.tsx`

## Non-functional requirements

### NFR-001: The runtime stays offline

- **Statement:** No pageview request, and no request of any kind, may be issued
  at runtime. SPEC-019 NFR-001 and SPEC-001 DATA-005 continue to hold unchanged.
- **Rationale:** The whole point of the build-time cache.
- **Acceptance criteria:** a full round on either track completes with `fetch`,
  `XMLHttpRequest`, `WebSocket` and `sendBeacon` stubbed to throw.
- **Verification method:** automated test.
- **Evidence location:** `test/ui/spec020-no-egress.test.tsx`

### NFR-002: The build tolerates a hostile or absent API

- **Statement:** The popularity script must be polite (a descriptive user agent,
  bounded concurrency, a delay between batches), resumable (an existing cache is
  updated, not discarded), and non-blocking: a failed or skipped run must leave
  the previous cache and a working build, never a half-written file.
- **Rationale:** ~985 requests against a public Wikimedia API. A snapshot build
  that fails because a third party rate-limited us is not acceptable, and a
  partially-written cache would silently reshape the track.
- **Acceptance criteria:**
  - The cache is written atomically; an interrupted run leaves the old one.
  - A run with the network unavailable exits non-zero without modifying the cache.
  - Concurrency and delay are bounded constants, not unlimited.
- **Verification method:** automated test + inspection.
- **Evidence location:** `test/spec020-popularity-cache.test.ts`

### NFR-003: Data budget

- **Statement:** The popularity data adds at most 40 KB to the shipped reference
  artifact, and `pnpm run check:budget` must pass unchanged.
- **Rationale:** One integer plus provenance per genus over ~985 genera is small;
  the budget check is the guard that it stays so.
- **Acceptance criteria:** `pnpm run check:budget` passes; the reference artifact
  grows by no more than 40 KB.
- **Verification method:** script.
- **Evidence location:** `pnpm run check:budget` output in the PR.

### NFR-004: Determinism

- **Statement:** Both tracks' pools and both tracks' daily sequences are pure
  functions of the shipped snapshot and the UTC date, re-derivable byte-for-byte,
  with no clock or randomness in any test.
- **Rationale:** SPEC-001 NFR-001 and SPEC-019 NFR-004, extended to the new pool.
- **Acceptance criteria:** re-deriving the well-known pool twice from one model
  gives an identical ordered list; the suite passes at any system clock or TZ.
- **Verification method:** automated test.
- **Evidence location:** `test/spec020-well-known-pool.test.ts`

## Security and privacy considerations

### SEC-001: The popularity data is aggregate and public

- **Statement:** The only data introduced is Wikimedia's public, aggregate
  per-article pageview totals. No per-user data is fetched, derived or stored,
  and the track choice is stored locally alongside the existing round state under
  SPEC-019 SEC-002's schema rules.
- **Rationale:** The product collects nothing about its users and this must not
  become the exception.
- **Acceptance criteria:**
  - The cache contains article titles, integers and dates only.
  - The stored track choice adds one enumerated field and nothing else.
- **Verification method:** automated test + inspection.
- **Evidence location:** `test/spec020-popularity-cache.test.ts`

## Data model impact

### DATA-001: Popularity on the profile

- **Statement:** `ReadProfile` gains `popularity: { views: number; window: string;
  retrievedOn: string; sourceId: string } | null`. It is an **assertion about
  human attention**, sourced to Wikimedia and dated — not a property of the
  animal — and is modelled and labelled as such wherever it is surfaced.
- **Rationale:** SPEC-001 §4's assertion pattern exists precisely for values like
  this. Modelling it as a bare number on the taxon would state that a dinosaur
  *is* popular; modelling it as a dated, sourced claim states that people looked
  it up that often in that window, which is all we know.
- **Acceptance criteria:**
  - The field is nullable and null when unresolved.
  - It carries a source id resolving to a `Source`, and a retrieval date.
  - No code path treats a null as a zero.
- **Verification method:** automated test.
- **Evidence location:** `test/spec020-popularity-cache.test.ts`

## API impact

### API-001: Selection takes a pool, unchanged

- **Statement:** No change to `selectDailyGenus`, `evaluateGuess`, the tree
  reducer or the time clue. The well-known track is a different `pool` argument
  and a different storage key, nothing more.
- **Rationale:** The pure core was built to make exactly this cheap; changing it
  would risk the merged track's behaviour (REQ-008).
- **Acceptance criteria:** SPEC-019's test suite passes unmodified.
- **Verification method:** automated test.
- **Evidence location:** `pnpm test`

## UI or UX impact

### UX-001: Popularity is presented as attention, never as science

- **Statement:** Wherever the track is explained, the wording must make clear the
  ranking comes from how often people read the English Wikipedia article in a
  stated window — not from scientific importance, completeness of the fossil
  record, or how well studied the animal is. The view count must never be
  rendered as a fact about the animal, on this screen or any other.
- **Rationale:** The product's charter rests on never presenting an assertion as
  an intrinsic property. "Popular" is the most tempting number in this repository
  to misread as "important", and a dinosaur atlas that implied *Wintonopus*
  matters less scientifically than *Velociraptor* would be making a claim it
  cannot source.
- **Acceptance criteria:**
  - The track's description names Wikipedia, the window, and "how often people
    look it up".
  - No screen displays a per-taxon view count.
  - No copy calls a genus important, significant or major on this basis.
- **Verification method:** inspection + automated copy check.
- **Evidence location:** `test/ui/spec020-track-option.test.tsx`

### UX-002: The anglophone bias is stated, not hidden

- **Statement:** The track's description must say that the ranking reflects
  English Wikipedia specifically.
- **Rationale:** A "well-known" list built from one language's readership is
  well known *to that readership*. Saying so costs one clause and is the same
  honesty rule the rest of the product follows.
- **Acceptance criteria:** the wording names English Wikipedia.
- **Verification method:** automated test.
- **Evidence location:** `test/ui/spec020-track-option.test.tsx`

### UX-003: Every state is designed

- **Statement:** Designed and implemented: track option in each position; a round
  in progress on each track; switching mid-round and back; the well-known track
  unavailable (cache absent or pool below the floor), with its reason; and a
  track whose round is finished while the other is not.
- **Rationale:** Charter §2 and SPEC-019 UX-002 — real states are designed.
- **Acceptance criteria:** each state renders a distinct, labelled surface, and
  none is blank.
- **Verification method:** automated test.
- **Evidence location:** `test/ui/spec020-track-option.test.tsx`

### UX-004: Accessibility

- **Statement:** The track option is keyboard operable, labelled, and announces
  the change; the option's state is not conveyed by colour alone; the axe gate
  passes on both tracks.
- **Rationale:** SPEC-019 UX-003 and the repository's standing axe gate.
- **Acceptance criteria:** axe passes with no new violations; the option is
  reachable and operable by keyboard.
- **Verification method:** automated test (Playwright + axe).
- **Evidence location:** `test/e2e/a11y.e2e.ts`

## Configuration impact

- The pool cut (`WELL_KNOWN_POOL_SIZE = 250`) and the floor (`180`) are named
  constants in one module, so changing either is a one-line, testable edit under
  an amendment.
- The pageview window is a constant in the fetch script, recorded in the cache
  envelope so a stored value is always interpretable.
- A new package script (`pnpm run fetch:popularity`) alongside the existing
  `enrich:fetch`. It is never part of `pnpm run build`.

## Error handling

| Condition | Response |
| --- | --- |
| Popularity cache absent | The well-known track is not offered; the full track is unaffected; the reason is stated (REQ-008) |
| Fewer than 180 qualifying genera | Same as above — the track is withheld, never shipped degraded |
| A genus's article does not resolve | `popularity: null`; excluded from the well-known pool; never counted as zero |
| Fetch script run with no network | Exits non-zero, leaves the existing cache untouched |
| Stored track choice names an unknown track | Falls back to the full track |
| Stored round exists for a track that is no longer offered | Kept, not deleted; ignored until the track returns |

## Edge cases

- **Both tracks pick the same genus on the same day.** Allowed and unremarkable
  (REQ-003); suppressing it would break either track's determinism.
- **A player switches track mid-round on both.** Two rounds in progress, each
  resumable, neither disturbed (REQ-004).
- **A snapshot refresh reorders the top 250.** The well-known track's future
  sequence changes from that release, exactly as SPEC-019 records for the full
  pool. Stored results keep their own `taxonId`.
- **A genus leaves the top 250 between snapshots** while a stored round names it:
  the stored round still resolves, because it stores the taxon id and the answer
  is still in the full pool.
- **Pageviews spike from an unrelated event** (a film release, a news story). The
  ranking follows attention by design; the 12-month window damps a single spike.
- **A player has a long full-track streak and starts the well-known track.** The
  streaks are independent (REQ-005); neither resets the other.

## Acceptance criteria

1. Two daily puzzles run in parallel, each deterministic and identical worldwide,
   each cycling its own pool before repeating.
2. The well-known pool is the measured top 250 by English Wikipedia pageviews,
   derived not curated, and re-derivable byte-for-byte.
3. One option chooses the track and applies to the daily and to practice; each
   track keeps its own round, record and streak.
4. The shared summary names its track and still leaks no taxon.
5. The full track's answers, storage and behaviour are unchanged from SPEC-019.
6. The runtime issues no network request; the popularity data is fetched at build
   time into a committed cache with its source, window and date.
7. Wherever the track is explained, the ranking is described as English Wikipedia
   attention in a stated window, never as scientific importance.
8. `pnpm run typecheck`, `pnpm test`, `pnpm run lint`, `pnpm run format`,
   `pnpm e2e`, `pnpm run check:budget` and the three governance scripts pass.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Cache carries source/window/date; failures are null | automated test | `pnpm test spec020-popularity-cache` | `test/spec020-popularity-cache.test.ts` | |
| REQ-002 | Top 250 by views, ties by name, floor of 180 | automated test | `pnpm test spec020-well-known-pool` | `test/spec020-well-known-pool.test.ts` | |
| REQ-003 | Both tracks deterministic; full cycle before repeat | automated test | `pnpm test spec020-tracks` | `test/spec020-tracks.test.ts` | |
| REQ-004 | Option covers daily + practice; rounds survive a switch | automated test | `pnpm test spec020-track-option` | `test/ui/spec020-track-option.test.tsx` | |
| REQ-005 | Records and streaks stay separate per track | automated test | `pnpm test spec020-track-record` | `test/ui/spec020-track-record.test.tsx` | |
| REQ-006 | Summary names the track and leaks no taxon | automated test | `pnpm test spec020-share-track` | `test/spec020-share-track.test.ts` | |
| REQ-007 | Four fragments open four combinations; no router | automated test | `pnpm test spec020-track-fragments` | `test/ui/spec020-track-fragments.test.tsx` | |
| REQ-008 | Full-track answers identical before/after; degrades cleanly | automated test | `pnpm test spec020-tracks` | `test/spec020-tracks.test.ts` | |
| NFR-001 | Round completes with every network API throwing | automated test | `pnpm test spec020-no-egress` | `test/ui/spec020-no-egress.test.tsx` | |
| NFR-002 | Atomic write; no-network run leaves the cache intact | automated test + inspection | `pnpm test spec020-popularity-cache` | `test/spec020-popularity-cache.test.ts` | |
| NFR-003 | Reference grows ≤ 40 KB; budget passes | script | `pnpm run check:budget` | PR output | |
| NFR-004 | Pool re-derives identically; clock/TZ independent | automated test | `pnpm test spec020-well-known-pool` | `test/spec020-well-known-pool.test.ts` | |
| SEC-001 | Cache holds titles, integers, dates only | automated test | `pnpm test spec020-popularity-cache` | `test/spec020-popularity-cache.test.ts` | |
| DATA-001 | Nullable, sourced, dated; null never read as zero | automated test | `pnpm test spec020-popularity-cache` | `test/spec020-popularity-cache.test.ts` | |
| API-001 | SPEC-019's suite passes unmodified | automated test | `pnpm test` | PR diff | |
| UX-001 | Wording names Wikipedia + window; no view count shown | inspection + automated check | `pnpm test spec020-track-option` | `test/ui/spec020-track-option.test.tsx` | |
| UX-002 | Wording names English Wikipedia | automated test | `pnpm test spec020-track-option` | `test/ui/spec020-track-option.test.tsx` | |
| UX-003 | Every listed state renders distinctly | automated test | `pnpm test spec020-track-option` | `test/ui/spec020-track-option.test.tsx` | |
| UX-004 | Axe passes on both tracks; option keyboard operable | automated test | `pnpm e2e` | `test/e2e/a11y.e2e.ts` | |

## Test plan

**Unit (Vitest, no DOM).** Pool derivation and the rank cut against the shipped
artifact; both tracks' determinism and cycle properties; the share summary's
track naming and continued spoiler-freedom; the full track's sequence asserted
**against the pre-change answers** so REQ-008's no-regression claim is
mechanically checked rather than asserted.

**Cache (Vitest).** Envelope shape, null handling, atomic write, and the
no-network path — with the fetch stubbed, never hitting the real API in CI.

**Component (Vitest + Testing Library).** The option in each position, switching
tracks with a round open on each, the unavailable state, per-track records, the
four fragments, and the no-egress check.

**End-to-end (Playwright).** A round on the well-known track, and the axe gate
extended to it.

**Fixtures.** The existing SPEC-019 fixture plus synthetic popularity values; the
shipped snapshot for the real-data assertions. **No test may call the Wikimedia
API.**

**Before implementation.** Per repo convention, the track option needs a mockup
addition to `docs/mockups/daily-genus.md` and its state sheet, checked against
`docs/mockups/anti-slop-checklist.md` — in particular, a two-way track choice is
the classic place a pill-chip toggle appears, and it should not.

## Rollback plan

Additive and separable. Reverting the PR removes the option, the second track
and the popularity field; the full track is untouched by construction (REQ-008),
so a player's existing streak and stored rounds survive the revert. If only the
data is suspect, deleting the popularity cache withholds the well-known track
via its own unavailable state with no code change. The committed cache is a
build-time input, so no runtime migration exists to undo.

## Open questions

- [ ] **Pool size, checked against the full fetch.** 250 is set (REQ-002) from a
      160-genus sample where p75 ≈ 16.9 k views. Once the whole pool is fetched,
      report where the 250th genus actually falls; if it reaches into taxa a
      player would not recognise, 200 is the fallback. This is an
      implementation-time measurement, not a blocker.
- [ ] **Non-English wikis.** Summing views across several language editions would
      soften the anglophone bias at the cost of a larger fetch. **Explicitly
      deferred** to a possible follow-up spec; UX-002 states the bias meanwhile.

Both remaining questions are deferred by intent, not unresolved: neither changes
what gets built, and the first is a number to confirm during implementation.

## Human decisions required

- [x] **Approve the two-track design** as specified (option A, with the option
      applying to practice as well).
      Answer: **Approved by the owner, 2026-08-11** ("I approve the specs").
- [x] **Track name** shown in the UI and in shared results.
      Answer: **"Well-known"** — set as the default rather than asked again. It
      is plain domain language (charter §3), it says what the filter actually is,
      and "Classic" and "Famous" both imply a judgement the pageview signal does
      not support. One named constant; changing it is a one-line edit.
- [x] **Pool size.** Answer: **250**, per REQ-002's rationale — a rank cut for
      stability across snapshots, landing near the measured p75 and giving about
      eight months before a repeat. Confirmed against the full fetch during
      implementation (Open questions).
- [x] **Refresh cadence** for the popularity cache.
      Answer: **Pinned, refreshed deliberately** via `pnpm run fetch:popularity`
      — never automatically on a snapshot build. Two reasons: NFR-002 requires
      the build not to depend on a third-party API, and an automatic refetch
      would silently reorder the top 250 and change future puzzles with no one
      deciding to. This matches how SPEC-014's enrichment cache already works.

## Assumptions

Recorded per `CLAUDE.md` rather than decided silently.

1. **Owner decisions of 2026-08-11, carried into requirements:** two parallel
   tracks rather than a filter on one daily (REQ-003), and the option applies to
   practice as well as the daily (REQ-004).
2. **Pageviews are accepted as a good-enough proxy**, explicitly not a scientific
   measure — the owner said so, and UX-001/UX-002 carry that caveat into the
   product's own wording rather than leaving it in a conversation.
3. **A 12-month window**, which damps a single news spike while still tracking
   real shifts in attention.
4. **A rank cut rather than a view threshold**, so the track's size is stable
   across snapshots (REQ-002 rationale).
5. **English Wikipedia only** for this spec, with the bias stated in the UI.
6. **The track choice is stored locally**, like every other preference in this
   product, and syncs nowhere.

## Conflict check

No conflicts found.

- **SPEC-019 (Daily Genus)** — the direct dependency. This spec adds a track and
  an option; REQ-008 makes the no-regression guarantee explicit and testable, and
  API-001 keeps the pure core untouched. SPEC-019 REQ-001's "same genus
  worldwide" is preserved *per track*, which is why a per-player filter was
  rejected (Context). No SPEC-019 requirement is amended; if implementation shows
  one must change, that requires a Spec Amendments entry there, not a silent
  edit here.
- **SPEC-014 (Wikipedia enrichment)** — reuses its build-time-cache pattern and
  its resolved article titles. No change to enrichment itself.
- **SPEC-001 (data architecture)** — DATA-005 (no runtime egress) is restated as
  NFR-001. The popularity value is an L1-sourced, L2-derived assertion in the
  existing provenance model (DATA-001), so the tiers are unchanged.
- **Functional specification** — introduces no `FONC-`/`CONS-` requirement;
  `DOCUMENTATION_AUTHORITY.md` rule 1 makes this spec the requirement source, as
  it did for SPEC-019.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | popularity cache | `scripts/fetch_popularity.ts`; `src/pipeline/popularity.ts` | `test/spec020-popularity-cache.test.ts` | Implemented |
| REQ-002 | well-known pool | `state/dailyGenus.ts` · `deriveWellKnownPool` | `test/spec020-well-known-pool.test.ts` | Implemented |
| REQ-003 | track selection | `selectDailyGenus` + `saltForTrack` (AMEND-002) | `test/spec020-well-known-pool.test.ts` | Implemented |
| REQ-004 | track option | `DailyGenusScreen` · `chooseTrack` | `test/ui/spec020-track-option.test.tsx` | Implemented |
| REQ-005 | per-track record | `state/dailyGenusStorage.ts` · `stateKey`/`recordKey` | `test/ui/spec020-track-option.test.tsx` | Implemented |
| REQ-006 | share summary | `dailyGenusStorage.ts` · `shareSummary` | `test/spec020-share-track.test.ts` | Implemented |
| REQ-007 | fragments | `state/screenFragment.ts`; `ExplorationView` | `test/ui/spec020-track-fragments.test.tsx` | Implemented |
| REQ-008 | no-regression | full track keeps its salt and its pool | `test/spec020-well-known-pool.test.ts`, SPEC-019 suite | Implemented |
| NFR-001 | no egress | figures read from the loaded snapshot | `test/ui/spec020-no-egress.test.tsx` | Implemented |
| NFR-002 | fetch script | concurrency 3, backoff, straggler sweep, atomic write | `test/spec020-popularity-cache.test.ts` | Implemented |
| NFR-003 | build budget | bare figure + shared provenance (AMEND-001) | `pnpm run check:budget` (+17.2 KB) | Implemented |
| NFR-004 | determinism | pure derivation from the snapshot | `test/spec020-well-known-pool.test.ts` | Implemented |
| SEC-001 | popularity cache | ids, integers and dates only | `test/spec020-popularity-cache.test.ts` | Implemented |
| DATA-001 | read model | `ReadProfile.popularity`, `SnapshotMetadata.popularity` | `test/spec020-popularity-cache.test.ts` | Implemented |
| API-001 | pure core | signature extended by an optional salt only | `pnpm test` (SPEC-019 suite unmodified) | Implemented |
| UX-001 | track option copy | `DailyGenusScreen` track fieldset | `test/ui/spec020-track-option.test.tsx` | Implemented |
| UX-002 | track option copy | names English Wikipedia and the window | `test/ui/spec020-track-option.test.tsx` | Implemented |
| UX-003 | track option states | option absent when the track is unavailable | `test/ui/spec020-track-option.test.tsx` | Implemented |
| UX-004 | accessibility | labelled radio group in a named fieldset | `test/ui/spec020-track-option.test.tsx`, `test/e2e/a11y.e2e.ts` | Implemented |

## Implementation notes

Implemented 2026-08-11. Two amendments were needed (see below), both discovered
by measuring rather than by reasoning; everything else landed as specified.

**The fetch policy had to be rewritten after the first run.** At 6 concurrent
requests with a 150 ms pause and two 0.5 s retries, **373 of 985 articles came
back unresolved** — and every one of them returned HTTP 200 when fetched alone
afterwards. They had been throttled, not missed. Because a null excludes a genus
from the track, that did not merely lose data, it reshaped the pool: the 250th
genus was *Segisaurus* at 9,110 views. After dropping to 3 concurrent with a
300 ms pause, exponential backoff honouring `Retry-After`, and a slow
one-at-a-time sweep over the run's own nulls, **953 of 985 resolved** and the
250th genus became *Zupaysaurus* at **14,734 views/yr** — where the pre-spec
sample predicted it would land.

**The pool size of 250 is confirmed** (Open questions): #50 is at 79 k views,
#100 at 40 k, #200 at 19 k, #250 at 14.7 k. The tail is recognisable
(*Skorpiovenator*, *Haplocanthosaurus*, *Barapasaurus*, *Chaoyangsaurus*), so
the cut does not reach into obscurity.

**The trace-fossil win is real**: no ichnotaxon or ootaxon survives into the
well-known track — not by an exclusion list, but because nobody reads about
them. `test/spec020-well-known-pool.test.ts` asserts it.

**Applying the cache is authoritative, not additive.** A test caught that
re-applying a cache which no longer knows a taxon left the old figure in place,
contradicting REQ-001's "the value in the read model equals the value in the
cache". `applyPopularity` now clears a figure the cache does not carry.

**`scripts/apply_popularity.ts`** exists so refreshing popularity does not force
a full live re-ingest from PBDB. `gen_web_data.ts` folds the cache in as well, so
a full rebuild produces the same artifact; the script reuses the same
`applyPopularity` and serializer.

**Known limitations.** The ranking is English-language attention in one window
and nothing more (UX-001/UX-002 carry that into the product's wording). Recently
named genera can rank high on novelty — *Qianlong* and *Tiamat* sit in the top
ten — which the 12-month window damps but does not remove. 32 pool genera still
have no figure and are therefore outside the track; re-running the fetch later
will fill most of them in.

## Spec amendments

> Required for any behavioral change after the spec is Approved.

### AMEND-001 — popularity is stored as a bare figure with shared provenance

- **Date:** 2026-08-11
- **Reason:** DATA-001 specified `popularity: { views; window; retrievedOn;
  sourceId } | null` **per profile**. Implemented literally, that repeats the
  same three strings on every profile: measured at **+45 KB** on the shipped
  reference, against a **40 KB** budget in NFR-003 — and 26 KB of that was the
  word `null` on the 1,570 profiles that are not in the answer pool.
- **Changed requirements:** DATA-001. The profile now carries
  `popularity?: number` — the figure alone, present only when established — and
  the window, retrieval date and source id are recorded **once** on
  `SnapshotMetadata.popularity`.
- **Behavioral impact:** None visible. The value is still sourced and dated, it
  is still never a zero when unknown, and it is still never rendered as a fact
  about the animal. Measured cost after the change: **+17.2 KB**, inside budget.
- **Test impact:** `test/spec020-popularity-cache.test.ts` asserts the
  provenance lands on the metadata, that an absent figure is never read as zero,
  and that applying an empty cache clears both.
- **Human approval reference:** **Approved by the owner, 2026-08-11** ("I
  validate everything"), on the implementation report of the same day. The
  alternative offered — raising NFR-003's budget to 50 KB and keeping the
  per-profile shape — was not taken.

### AMEND-002 — each track gets its own permutation salt

- **Date:** 2026-08-11
- **Reason:** REQ-003 has both tracks select with `selectDailyGenus(dateKey,
  pool)`. Because the well-known pool is a *subset* of the full pool, a shared
  permutation makes the well-known order the full order with non-members removed
  — so both tracks open on the same genus and stay in step until the first
  non-member appears. Measured on the shipped snapshot: **identical on 4 of the
  first 14 days, including the first four in a row.** A player switching tracks
  on launch day would have seen the option do nothing.
- **Changed requirements:** REQ-003. `selectDailyGenus` takes an optional
  third argument, the permutation salt, supplied per track by `saltForTrack`.
- **Behavioral impact:** The full track keeps the original salt as the default,
  so its sequence is byte-identical to SPEC-019's — REQ-008 holds, and the
  SPEC-019 suite passes unmodified. The well-known track now has an independent
  order: the two coincide on fewer than 6 days in 30.
- **Test impact:** `test/spec020-well-known-pool.test.ts` asserts both the
  independence and the unchanged full-track sequence.
- **Human approval reference:** **Approved by the owner, 2026-08-11** ("I
  validate everything"), on the implementation report of the same day.

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [x] Open questions are resolved or explicitly deferred.
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed.
- [x] Human approval recorded before status set to Approved (owner, 2026-08-11).
