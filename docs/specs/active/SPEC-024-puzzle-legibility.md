---
doc_type: spec
spec_id: SPEC-024
title: Dinordle — legible track choice and a readable Ma column
status: Draft
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, styling]
affected_interfaces: []
supersedes: []
superseded_by:
depends_on: [SPEC-019, SPEC-020]
conflicts_with: []
last_verified_at:
---

# SPEC-024: Dinordle — legible track choice and a readable Ma column

## Summary

Two parts of the daily puzzle screen do not read. The puzzle chooser is a wordy
labelled fieldset with a legend, two scope notes and a caveat paragraph — four
blocks of text for a two-way choice; it becomes two named controls in the
header, with the pool sizes moved to a detail you can reach by hover, by
keyboard focus or by touch. The caveat about what "well-known" means does
**not** move: it is a provenance statement, and the charter forbids hiding
those behind a hover. The Ma column is the second part: today every guess draws
the same teal bar and the answer's geological period "lights up" a band once a
guess overlaps it, which no one understands. Each guess instead becomes one bar
that is **teal and solid when its time span overlaps the answer's, neutral and
hollow when it misses**, positioned at its true age, with a mark showing which
way the answer lies. The band-lighting mechanic and the answer's period
disclosure are retired. Nothing about the puzzle itself changes: same answers,
same guesses, same storage, same shared result.

## Context

`src/app/components/DailyGenusScreen.tsx` is the single screen for the daily
puzzle (SPEC-019) and its second track (SPEC-020). Two regions of it are the
subject here.

**The track selector** (`DailyGenusScreen.tsx:456-485`, `.tracks` /
`.tracksLegend` / `.trackChoice` / `.trackName` / `.trackNote` / `.trackAbout`
in `dailyGenus.module.css:109-156`) renders, only when
`trackAvailable(data, "wellKnown")` is true:

| Element | Current text | Kind of statement |
| --- | --- | --- |
| `<legend>` | "Which puzzle" | Control label |
| `.trackName` ×2 | "Every genus" · "Well-known" | The choice itself |
| `.trackNote` ×2 | "all 985 in the snapshot" · "the 250 most read about" | Plain description of pool size |
| `.trackAbout` | "'Well-known' ranks genera by how often people read their article on English Wikipedia over <window> — a measure of attention, not of scientific importance." | **Provenance and caveat** |

That last line is not decoration: SPEC-020 UX-001 requires the ranking to be
described as attention and never as scientific importance, and UX-002 requires
English Wikipedia to be named. Both are asserted in
`test/ui/spec020-track-option.test.tsx:199,204` and in
`test/e2e/spec019-daily.e2e.ts:79-83`.

The track choice persists through `src/app/state/dailyGenusStorage.ts`
(`loadTrack`/`saveTrack`), is addressable by fragment (SPEC-020 REQ-007), and
switching is deliberately **non-destructive** — each track keeps its own daily
round under its own storage key, so leaving a round and coming back resumes it
(`DailyGenusScreen.tsx:255-259, 260-287`).

**The Ma column** (`DailyGenusScreen.tsx:598-679`, `.ticks` / `.bands` /
`.bandLit` / `.periodNames` / `.bars` / `.barSlot` / `.bar` / `.periodNote` in
`dailyGenus.module.css:328-425`) draws the Mesozoic as an axis: Ma ticks, three
ICS period bands, period names, and one 8 px slot per guess in which the guess's
`timeSpan` is plotted. Today:

- Every bar is the same teal at 0.5 opacity, whatever the verdict.
- `answerPeriod` / `periodDisclosedBy` / `periodDisclosed` decide whether the
  answer's period band is drawn at 0.62 opacity instead of 0.22 (`.bandLit`),
  and `.periodNote` reads either "The answer's period appears once a guess
  overlaps it." or "Cretaceous — the answer's period".
- The verdict itself — `TimeVerdict` = `older | younger | overlaps |
  unavailable`, from `timeVerdict()` in `src/app/state/dailyGenus.ts:444-461` —
  appears **only** in the `visuallyHidden` `TIME_WORDS` sentence
  (`DailyGenusScreen.tsx:667-669`). A sighted player is told nothing per guess.
- A guess whose span is absent (`unavailable`) renders **no bar at all**: an
  empty slot, which is the blank the charter forbids (§2, FONC-490/1120), even
  though the assistive-technology sentence is correct.

**Owner feedback, 2026-08-14.** On the chooser: *"Which puzzle selection is
awkward and too wordy. It would work better with buttons in the header (Normal -
Hard modes) with texts when you hover to know more about the details."* On the
column: *"I don't understand how the Ma reveal work in the puzzle. I'd say it
should be only a single line that overlap in red or grey when it doesn't overlap
with the period of the answer or green when it does."*

**Owner decisions taken in the same session, and carried into requirements
here.**

1. The controls keep the **domain names** — "Well-known" and "Every genus", not
   "Normal"/"Hard". The charter mandates domain language (§3) and the difficulty
   framing is a judgement the pageview signal does not support (SPEC-020
   UX-001).
2. One bar per guess on the shared Ma axis: **green on overlap, grey on a
   miss**; vertical position keeps carrying older/younger; the band-lighting
   mechanic is retired.
3. **Grey, not red**, for a miss — a bare red/green pair fails colourblind
   legibility, and this repository already holds that no colour-only signal may
   be introduced (SPEC-010 REQ-002).

**Prior art in-repo.** The revealed tree already carries three states in three
marks and three words (`.key`, "established · ruled out · unresolved"), which is
the pattern the column's key follows. The anti-slop checklist's worked example
for this very screen calls out "turn a scalar into an axis" and "carry state
with shape and word first, colour third".

## Problem statement

Two things on the puzzle screen fail at the only job they have.

The chooser costs four blocks of copy to offer two options, and reads as a form
in the middle of a diagram. The owner cannot skim it.

The Ma column shows the player eight identical teal bars and a sentence about a
period that may light up later. It never says, per guess, the one thing the
clue is for — does this guess's time overlap the hidden genus or not. The answer
exists in the code (`TimeVerdict`), is announced to screen-reader users, and is
withheld from everyone else. A guess with no recorded span disappears entirely.

## Goals

- Make the puzzle choice a two-control choice that reads at a glance, in the
  header, without losing what "well-known" is built from.
- Make each guess's time verdict readable off the axis itself — overlap or miss,
  and which way the answer lies — without colour being the only carrier.
- Make a guess with no recorded time span visible and explicitly labelled.
- Retire the period-band mechanic that no one reads, and say plainly what the
  game therefore stops disclosing.
- Change nothing about which genus is the answer, how guesses are evaluated,
  what is stored, or what a shared result says.

## Non-goals

- **No rename of the "Established classification" heading** — SPEC-021 owns it.
- **No redraw of the tree as a horizontal cladogram** — SPEC-025 owns it.
- **No rename of the feature to "Dinordle"** — SPEC-022 owns it. This spec uses
  the name in prose and specifies no rename of its own; no requirement here
  depends on which name ships.
- **No change to `timeVerdict()`, `evaluateGuess()`, `selectDailyGenus()`, the
  revealed-tree reducer, or any storage schema.** This spec is presentation.
- **No new clue.** No diet, size or geography (SPEC-019 Non-goals stand).
- **No plotting of the answer's own span** on the column, during the round or
  after it. The reveal keeps stating the answer's time span in text
  (SPEC-019 REQ-007); drawing it would be a new disclosure, not a legibility fix.
- **No difficulty vocabulary.** "Normal", "Hard", "Easy", "Expert", "mode" and
  "level" are out (charter §3, SPEC-019 UX-001).
- **No per-taxon view count anywhere**, in the detail or elsewhere (SPEC-020
  UX-001).
- **No new colour token and no second accent.** The palette is the shipped one.
- **No tooltip library, no popover dependency, no animation library.**
- **No change to the tree, the guess input, the reveal, the record, the
  countdown, practice mode, or the fragments.**

## Users or actors

- **The Explorer** (charter §1) playing the puzzle, on a phone as often as a
  desktop — so the "hover" affordance has to work with no hover at all.
- **A keyboard or screen-reader user**, who today gets *more* of the time
  verdict than a sighted mouse user does, and must not get less after this
  change.
- **A colourblind player**, for whom the green/grey pair must be redundant.

## Functional requirements

### REQ-001: The track choice is two named controls in the screen header

- **Statement:** When the well-known track is available
  (`trackAvailable(data, "wellKnown")`), the track choice renders in the screen
  header as exactly two controls labelled **"Every genus"** and
  **"Well-known"** — the domain names, unchanged from SPEC-020's owner decision.
  The `<legend>`-plus-stacked-labels fieldset block below the header is removed
  from the always-visible surface. The controls form a single-choice group of
  exactly two options, exposed to assistive technology as such, carrying the
  accessible group name **"Which puzzle"**; the selected control is marked by a
  non-colour cue (weight plus a rule) as well as by its selected state. The
  header states the chosen track **exactly once**: the `· well-known` suffix on
  the puzzle-identity line is removed, because the selected control now carries
  it.
- **Rationale:** The owner's complaint is wordiness and awkwardness, and four
  text blocks for a two-way choice is the cause. Domain names are charter §3 and
  were already decided in SPEC-020 ("Well-known", not a difficulty word). The
  group name is kept verbatim so the control keeps a real accessible name and so
  the existing role-and-name queries in the suite keep meaning what they meant.
  Stating the track twice in one header is the same wordiness in miniature.
- **Acceptance criteria:**
  - Both controls are visible in the header without hover, scrolling past the
    fold, or a second click.
  - Their accessible names are exactly "Every genus" and "Well-known"; no copy
    on the screen calls either a difficulty, a mode, or a level.
  - The group has the accessible name "Which puzzle" and exposes exactly two
    single-choice options; activating one selects it and deselects the other.
  - The selected control is distinguishable with colour removed (rendered in
    greyscale, the selection is still identifiable).
  - The track name appears once in the header, not twice.
  - When the well-known track is unavailable (SPEC-020 REQ-008) no control, no
    group and no detail renders, and the full track plays unchanged.
- **Verification method:** automated test (rendered screen) + inspection.
- **Evidence location:** `test/ui/spec020-track-option.test.tsx`

### REQ-002: What may move to the detail, and what must stay visible

- **Statement:** Only the **pool sizes** may move off the always-visible
  surface: "all N genera in the snapshot" for the full track and "the N most
  read about" for the well-known track. The statement of what the well-known
  ranking is built from and is not — that it ranks genera by how often people
  read their article on **English Wikipedia** over the stated **window**, and
  that this is **a measure of attention, not of scientific importance** — must
  remain rendered and visible whenever the control is rendered, in every state,
  for both track selections, and must never be placed behind a hover, a
  tooltip, a `title` attribute, an accordion, or any other on-demand
  disclosure. No per-taxon view count is displayed anywhere, in the detail or
  out of it.
- **Rationale:** This is the charter's north star applied literally: "the
  interface must make provenance and uncertainty legible at a glance, never
  buried behind a hover or a secondary click" (§2, CONS-490). The pool sizes are
  plainly descriptive magnitudes — how many genera are in each pool — and carry
  no claim about certainty or source, so hiding them costs the reader nothing
  they need to judge the puzzle. The attention caveat is the opposite: it is the
  one sentence that stops "well-known" reading as "important", it is required by
  SPEC-020 UX-001 and UX-002, and moving it into a hover would both violate the
  charter and break those requirements. Keeping it visible is what lets this
  spec amend SPEC-020 REQ-004 alone and leave UX-001 and UX-002 untouched.
- **Acceptance criteria:**
  - With no pointer interaction and no focus anywhere, the rendered screen
    contains the caveat text naming English Wikipedia, the window, how often
    people read the article, and "attention, not of scientific importance".
  - The caveat is present with either track selected, and in practice mode.
  - The caveat is not inside any element that is hidden, collapsed, zero-sized
    or `aria-hidden` in the default state, and is not a `title` attribute.
  - No pool size, and no other text, is the sole visible carrier of a
    provenance, uncertainty or sourcing statement.
  - The screen contains no per-taxon view count and no "pageviews" figure.
- **Verification method:** automated test (rendered screen, no interaction) +
  inspection against `docs/mockups/design-guidelines.md` §2.
- **Evidence location:** `test/ui/spec020-track-option.test.tsx`,
  `test/e2e/spec019-daily.e2e.ts`

### REQ-003: The detail is reachable by pointer, keyboard and touch

- **Statement:** The pool-size detail for a track is revealed on pointer hover
  **and** on keyboard focus of that track's control, and is reachable on a touch
  device with no hover. It is carried by a real element in the document that the
  control references as its accessible description (`aria-describedby`), never
  by a bare `title` attribute. The detail for the **currently selected** track is
  rendered visibly at all times in a fixed slot beneath the controls; hovering or
  focusing the other control previews that track's detail in the same slot, and
  releasing hover or focus restores the selected track's. The slot never changes
  the height of the header region as its content changes, is not a live region,
  and is not announced on every hover.
- **Rationale:** Hover does not exist on touch and is not reachable by keyboard,
  so "hover for the detail" alone would make the detail unavailable to a large
  share of players and to every assistive-technology user — the failure the
  owner's phrasing invites and this requirement forecloses. A fixed slot showing
  the selected track's detail means the information is never behind an
  interaction at all: a touch user always sees the detail for what they are
  playing, and sees the other one the moment they switch. `aria-describedby` on
  a real element is what makes the same text available without any pointer;
  `title` is not reliably exposed and is unreachable by keyboard. Not announcing
  on hover follows SPEC-019 UX-003's rule that the screen must not spam
  assistive technology.
- **Acceptance criteria:**
  - Each control's accessible description resolves to the text of its own pool
    size, with no interaction performed.
  - Focusing the unselected control with the keyboard shows its detail; blurring
    restores the selected track's detail.
  - With hover unavailable (touch emulation, or no pointer events fired) the
    selected track's detail is still visible, and switching track updates it.
  - The detail is not implemented as a `title` attribute.
  - The detail slot is not a live region, and switching hover between the two
    controls triggers no announcement.
  - The header region's height does not change between the two detail strings.
- **Verification method:** automated test (rendered screen, keyboard-only and
  no-pointer paths) + manual check on a touch device.
- **Evidence location:** `test/ui/spec020-track-option.test.tsx`

### REQ-004: Switching, persistence and addressability are unchanged

- **Statement:** Changing the control's presentation must not change any
  behaviour of the track choice. Switching tracks stays **non-destructive**:
  each track's daily round remains stored under its own key and is restored on
  return, with its guesses, hint state and outcome (SPEC-020 REQ-004, the
  contract documented at `DailyGenusScreen.tsx:255-259`). The choice still
  persists via `loadTrack`/`saveTrack`, still applies to practice as well as the
  daily, still defaults to the full track, still reports to the shell through
  `onTrackChange`, and the four track/mode fragments still open their
  combinations (SPEC-020 REQ-007).
- **Rationale:** This is a legibility change. The one thing that would make it a
  regression is quietly breaking the round a player has open on the other track,
  which is the exact behaviour SPEC-020 REQ-004 exists to guarantee and which the
  code comments call out as deliberate.
- **Acceptance criteria:**
  - Playing guesses on one track, switching, playing on the other, and switching
    back restores the first round exactly.
  - The stored value under `paleo-map:daily-genus:track` is written on selection
    and honoured on the next visit.
  - `#daily`, `#practice` and the well-known fragments each open their
    combination, and the chosen track is reflected in the control.
  - Practice honours the chosen track.
  - No storage key, no stored field and no fragment string changes.
- **Verification method:** automated test (rendered screen + fragments).
- **Evidence location:** `test/ui/spec020-track-option.test.tsx`,
  `test/ui/spec020-track-fragments.test.tsx`

### REQ-005: One bar per guess — overlap or miss on the shared Ma axis

- **Statement:** Each accepted guess with a recorded `timeSpan` draws exactly one
  bar in its own slot on the shared Ma axis, positioned and sized by its true
  span (oldest at the top), as today. Its treatment carries the verdict from
  `TimeVerdict`:
  - `overlaps` → **solid fill in the teal accent**;
  - `older` or `younger` → **hollow: a hairline outline in a neutral token, no
    fill**.
  The bar's colour is never the only difference between the two: solid-versus-
  hollow is a shape difference legible with colour removed. No verdict chip,
  badge or pill is introduced, and no numeric distance in Ma is printed.
- **Rationale:** The owner's decision, expressed in the product's own palette.
  "Green" is the teal accent — it is already the accent for the data layer
  (charter §4), so overlap-is-teal introduces no second accent and no new hue;
  "grey" is the cool neutral family the rest of the column already uses. Fill
  versus outline is the anti-slop checklist's rule applied ("carry state with
  shape and word first, colour third") and is what makes the pair legible to a
  colourblind player, which is why grey was chosen over red in the first place.
  A distance in Ma would publish a closeness number, which SPEC-019 REQ-004
  forbids.
- **Acceptance criteria:**
  - A guess whose span intersects the answer's renders a solid bar; one that does
    not renders a hollow bar; the two are distinguishable in a greyscale
    rendering.
  - Bar position and height still derive from the guess's own `timeSpan` against
    the column's Ma scale, unchanged.
  - Exactly one bar exists per guess with a span, in guess order.
  - No rendered text in the column states a number of millions of years between
    the guess and the answer, a step count, or a percentage.
  - `timeVerdict()` and `evaluateGuess()` are unchanged (REQ-009).
- **Verification method:** automated test (rendered screen) + inspection.
- **Evidence location:** `test/ui/spec019-states.test.tsx`

### REQ-006: Older and younger stay legible, in position and in a visible mark

- **Statement:** A hollow (missing) bar additionally carries a visible direction
  mark at the end of the bar pointing along the axis toward where the answer
  lies — upward on the column when the answer is older, downward when the answer
  is younger. A solid (overlapping) bar carries no direction mark. Every bar
  treatment is named in words in a single key line beneath the column — one
  entry per treatment: overlaps, answer older, answer younger, no span recorded
  — following the tree's existing three-marks-three-words key. The
  `visuallyHidden` per-guess sentence built from `TIME_WORDS` is retained
  verbatim in meaning.
- **Rationale:** Today the older/younger verdict is announced to screen-reader
  users and shown to nobody else; a sighted player reading eight identical teal
  bars is the exact confusion the owner reported. Position alone cannot carry
  direction, because the player does not know where the answer sits — the mark
  is what makes "vertical position conveys older/younger" true rather than
  aspirational. It publishes no new fact: `older`/`younger` is already disclosed
  per guess under SPEC-019 REQ-006, and this only makes it legible without a
  screen reader. A key line rather than an explanatory paragraph is the
  precedent already set on this screen and endorsed in the anti-slop worked
  example ("three marks, three words"), and it avoids captioning the interface.
- **Acceptance criteria:**
  - For a guess whose answer verdict is `older`, the direction mark points
    toward the older end of the axis; for `younger`, toward the younger end.
  - An overlapping guess renders no direction mark.
  - The key line names all four treatments in words, is one line, and is not a
    paragraph explaining how to read the screen.
  - The per-guess `visuallyHidden` sentence still names the guess, its ordinal
    and its verdict, and is announced once per guess.
  - Removing colour from the rendering leaves every verdict distinguishable.
- **Verification method:** automated test (rendered screen) + inspection.
- **Evidence location:** `test/ui/spec019-states.test.tsx`,
  `test/ui/spec019-daily-screen.test.tsx`

### REQ-007: A guess with no recorded time span is explicit, never invisible

- **Statement:** A guess whose `timeSpan` is absent (`TimeVerdict` =
  `unavailable`) draws **no bar** — there is no extent to plot and none may be
  invented — but its slot remains present and is marked with an explicit
  missing-value mark outside the plotting area (at the foot of the slot, below
  the axis), and the screen renders a visible statement naming that guess and
  saying its time span is not recorded. The existing `visuallyHidden` sentence
  ("no time span recorded — not available") is retained. No fallback span, no
  full-height bar, no zero-height bar and no silent empty slot is permitted.
- **Rationale:** The charter's missing-data rule (§2, FONC-490/1120) and
  SPEC-019 REQ-006's own "never a blank, a dash, or a negative result" are
  violated today by an empty slot that looks like nothing happened. Drawing any
  bar would assert an extent the snapshot does not carry — a full-height bar
  would read as "spans the whole Mesozoic" — so the mark must sit outside the
  plot area where it cannot be read as data. The statement is rendered only when
  it applies: coverage is 1,730 of 1,731 valid genera, so this is rare but real.
- **Acceptance criteria:**
  - Guessing a genus with no `timeSpan` renders a visible mark in that guess's
    slot and a visible statement naming the guess, without a bar.
  - The mark sits outside the plotted area and cannot be read as a span.
  - The statement appears only when at least one guess lacks a span.
  - The round continues normally; the guess still counts, and the tree and the
    record are unaffected.
  - The `visuallyHidden` sentence for that guess is unchanged in meaning.
- **Verification method:** automated test (rendered screen with a span-less
  fixture, the pattern already used at
  `test/ui/spec019-states.test.tsx:130-136`).
- **Evidence location:** `test/ui/spec019-states.test.tsx`

### REQ-008: The period-band reveal is retired; the axis stays

- **Statement:** The mechanic that discloses the answer's geological period is
  removed in full, and with it every part that implements it:
  - `answerPeriod`, `periodDisclosedBy` and `periodDisclosed` in
    `DailyGenusScreen.tsx` are deleted, as is the local `periodOf()` helper if
    nothing else uses it;
  - the `.bandLit` class and its CSS rule are deleted, and every period band
    renders at its single unlit weight for the whole round;
  - the `.periodNote` sentence — both "The answer's period appears once a guess
    overlaps it." and "<Period> — the answer's period" — is deleted, and its
    place is taken by the key line of REQ-006.

  The game therefore **no longer names the answer's geological period during the
  round**. The ICS period bands, the Ma ticks and the period names **stay** as
  the axis's context, unchanged in weight and still `aria-hidden`, because they
  are what makes the column a reading rather than eight floating bars. The
  answer's time span continues to be stated in the reveal at the end of the round
  (SPEC-019 REQ-007), unchanged.
- **Rationale:** The owner does not understand the mechanic, and a mechanic
  whose whole expression is a 0.22→0.62 opacity change on a band is not a
  disclosure a player can be expected to notice. Retiring it removes a
  disclosure, so it is stated here rather than left to fall out of the
  implementation: what the player loses is one aggregate fact (the answer's
  period), and what they gain is a per-guess overlap verdict and a direction,
  both of which are strictly more specific and are now visible. The bands stay
  because the anti-slop checklist's own worked example for this screen is
  "turn a scalar into an axis" — removing the ICS context would turn the column
  back into decoration.
- **Acceptance criteria:**
  - At no point during a round does any rendered text or DOM attribute name the
    answer's geological period.
  - No band renders at a different weight from the others, at any point,
    including after the round ends.
  - The Ma ticks, the three bands and the three period names still render.
  - `periodDisclosed`, `periodDisclosedBy`, `answerPeriod`, `.bandLit` and
    `.periodNote` no longer exist in the source.
  - The reveal still shows the answer's time span in Ma.
- **Verification method:** automated test (rendered screen) + inspection of the
  diff.
- **Evidence location:** `test/ui/spec019-states.test.tsx`,
  `test/ui/spec019-daily-screen.test.tsx`

### REQ-009: The pure core, the stored state and the shared summary are unchanged

- **Statement:** No module under `src/app/state/` changes behaviour.
  `TimeVerdict` keeps all four members and `timeVerdict()` keeps its rules
  (including "spans that touch at a bound overlap"); `evaluateGuess`,
  `applyGuess`, `revealedTree`, `selectDailyGenus`, `saltForTrack`,
  `poolForTrack` and every storage function are untouched. `shareSummary()` in
  `dailyGenusStorage.ts` **does not encode the time verdict** — its per-guess
  marks come from `sharedDepth` alone — so no mark in a shared result changes
  meaning, and the stored round schema (SPEC-019 SEC-002) gains and loses
  nothing.
- **Rationale:** Verified against the source rather than assumed: `shareSummary`
  reads `round.guesses[].sharedDepth`, the puzzle number, the outcome, the hint
  flag and the track. The time clue is nowhere in it. Saying so explicitly is
  what proves this spec changes no shipped, shareable behaviour — the one thing
  that would make a legibility change a breaking one.
- **Acceptance criteria:**
  - `test/spec019-clue-rows.test.ts` and `test/spec019-guess-evaluation.test.ts`
    pass **unmodified**.
  - `test/spec020-share-track.test.ts` passes unmodified, and the exact string
    `Daily Genus 1 · well-known · 2/8 · ▲▲` is still produced for its fixture.
  - `test/spec019-persistence.test.ts` passes unmodified.
  - The diff touches no file under `src/app/state/`.
- **Verification method:** automated test + inspection of the diff.
- **Evidence location:** `test/spec019-clue-rows.test.ts`,
  `test/spec020-share-track.test.ts`

## Non-functional requirements

### NFR-001: No new token, no new hue, no new dependency, no new data

- **Statement:** Every colour used comes from `src/app/styles/tokens.css` as
  shipped. No token is added or changed, no second accent is introduced, teal
  stays the only accent, and the ICS period hues keep their existing meaning. No
  package is added — no tooltip, popover or animation library — and no file
  under `public/data/` changes.
- **Rationale:** Charter §4 and anti-slop rule 10 ("don't invent tokens"). A
  verdict colour is exactly where a fourth hue creeps in; the point of choosing
  teal-for-overlap and neutral-for-miss is that both already exist and already
  mean what they are being used for.
- **Acceptance criteria:**
  - `git diff` shows no change to `tokens.css` and no change under
    `public/data/`.
  - `package.json` gains no dependency.
  - Every colour in `dailyGenus.module.css` after the change is a `var(--…)`
    reference to an existing token.
- **Verification method:** inspection + `pnpm run check:budget`.
- **Evidence location:** PR diff, `pnpm run check:budget` output.

### NFR-002: The screen still makes no network request

- **Statement:** SPEC-019 NFR-001, SPEC-020 NFR-001 and SPEC-001 DATA-005
  continue to hold: a full round on either track completes with `fetch`,
  `XMLHttpRequest`, `WebSocket` and `sendBeacon` stubbed to throw.
- **Rationale:** Restated, not weakened, because this spec touches the screen
  that carries those guarantees.
- **Acceptance criteria:** the existing no-egress suites pass unmodified in
  substance.
- **Verification method:** automated test.
- **Evidence location:** `test/ui/spec019-no-egress.test.tsx`,
  `test/ui/spec020-no-egress.test.tsx`

## Security and privacy considerations

### SEC-001: No new stored or transmitted data

- **Statement:** This spec introduces no new persisted field, no new storage
  key, no identifier and nothing transmitted. The track choice remains the one
  enumerated field of SPEC-020 SEC-001, written by `saveTrack`.
- **Rationale:** SPEC-019 SEC-002 and SPEC-020 SEC-001 stand; a presentation
  change is not a reason to store anything, and the hover/focus state must not
  be persisted.
- **Acceptance criteria:**
  - `test/spec019-persistence.test.ts` passes unmodified.
  - No new key is written to the store; the detail's hover/focus state is
    component state only.
- **Verification method:** automated test + inspection.
- **Evidence location:** `test/spec019-persistence.test.ts`

## Data model impact

None. No new or changed data structure, in the read model, in the snapshot, or
in local storage — see REQ-009 and SEC-001. No `DATA-` requirement is minted.

## API impact

### API-001: No change to any exported function or type

- **Statement:** No exported signature or type in `src/app/state/dailyGenus.ts`
  or `src/app/state/dailyGenusStorage.ts` changes. `TimeVerdict` keeps its four
  members; the screen maps them to bar treatments at the presentation layer.
  `DailyGenusScreenProps` is unchanged.
- **Rationale:** SPEC-020 API-001 established that this screen's pure core is
  worth protecting; mapping a verdict to a fill treatment is presentation and
  belongs in the component, not in the model. Keeping `unavailable` in the type
  is what forces the screen to render REQ-007's explicit state rather than
  falling through to nothing.
- **Acceptance criteria:**
  - `pnpm run typecheck` passes with no change to any state module.
  - The SPEC-019 pure-logic suites pass unmodified.
- **Verification method:** automated test + inspection.
- **Evidence location:** `pnpm test`, PR diff.

## UI or UX impact

### UX-001: Charter and anti-slop compliance of the header control

- **Statement:** The two track controls must not become a segmented control, a
  pair of pill toggles, a bordered box, or a chip row. They are two named
  controls sharing the header's baseline; the selected one is marked by weight
  and a teal rule, the other is plain text. No container, no border around the
  pair, no rounded filled background, no icon. The detail slot is a line of text,
  not a floating card, and casts no shadow. Domain language only.
- **Rationale:** `docs/mockups/daily-genus.md` warned that "a two-way track
  choice is the classic place a pill-chip toggle appears, and it should not", and
  the anti-slop checklist rules 2, 3 and 7 say why. Moving the control into the
  header is precisely the moment that chrome would arrive.
- **Acceptance criteria:**
  - The control adds no bordered container, no pill, no chip and no shadow.
  - The screen's bordered-container and pill counts (anti-slop self-check) do not
    increase.
  - No banned vocabulary (charter §3) appears; no difficulty word appears.
- **Verification method:** inspection against
  `docs/mockups/anti-slop-checklist.md` (including its self-check) + automated
  copy check.
- **Evidence location:** `test/ui/spec020-track-option.test.tsx`, PR review notes.

### UX-002: Colour is never the sole carrier, and contrast holds

- **Statement:** No state introduced or changed by this spec is carried by
  colour alone: the selected control, the overlapping bar, the missing bar and
  the no-span slot each carry a shape or a mark **and** a word. Every bar and
  mark meets WCAG 2 AA non-text contrast (≥ 3:1) against what sits behind it —
  including over a tinted period band — and every new text string meets 4.5:1.
- **Rationale:** Charter §2 and §4, SPEC-019 UX-003, and the precedent SPEC-010
  REQ-002 set that no colour-only signal is introduced. It is also the reason
  grey was chosen over red: the pair must survive being read by someone who
  cannot separate the hues.
- **Acceptance criteria:**
  - Rendered in greyscale, every verdict and the selection remain
    distinguishable.
  - Measured contrast of a hollow bar's outline and a solid bar against the
    column ground and against each period band is ≥ 3:1.
  - The axe gate passes on the puzzle screen on both tracks with no new
    violations.
- **Verification method:** automated test (Playwright + axe) + measurement.
- **Evidence location:** `test/e2e/a11y.e2e.ts`,
  `test/ui/spec019-daily-screen.test.tsx`

### UX-003: Every state of the changed regions is designed

- **Statement:** Designed and implemented, none left to fall out of the happy
  path: no guesses yet (an empty column that still shows the axis and the key);
  one guess overlapping; one guess missing older; one guess missing younger; a
  guess with no recorded span; a full board of eight; the round finished (won
  and lost); the well-known track unavailable (no control, no detail, no group);
  each track selected; the other track hovered; the other track focused by
  keyboard; and practice mode with either track.
- **Rationale:** Charter §7 and SPEC-019 UX-002 — the states are the
  requirement, not the decoration.
- **Acceptance criteria:**
  - Each listed state renders a distinct, labelled surface; none renders a blank
    region or a silent default.
  - The empty column still shows ticks, bands, period names and the key.
- **Verification method:** automated test (rendered screen per state).
- **Evidence location:** `test/ui/spec019-states.test.tsx`,
  `test/ui/spec020-track-option.test.tsx`

### UX-004: Accessibility parity, and no new announcement noise

- **Statement:** After this change a keyboard or screen-reader user gets no less
  than before and a sighted user gets no less than a screen-reader user. The
  track controls are keyboard operable as a single-choice group with a visible
  focus indicator; the pool-size detail is exposed as an accessible description;
  the per-guess time sentence is still announced once per guess through the
  existing live region; and neither the detail slot nor the column becomes a live
  region.
- **Rationale:** SPEC-019 UX-003 and SPEC-020 UX-004. The specific hazard this
  change introduces is a hover-driven text swap that either announces on every
  hover or is unavailable without one — both are failures, in opposite
  directions.
- **Acceptance criteria:**
  - A round is completable by keyboard alone, including switching track.
  - Focus is visible on both controls.
  - Each guess result is announced once and only once.
  - No element added by this spec has `aria-live`, and no verdict is conveyed
    only through an announcement.
  - The axe gate passes on both tracks.
- **Verification method:** automated test (Playwright + axe, Testing Library
  keyboard paths) + manual check.
- **Evidence location:** `test/e2e/spec019-daily.e2e.ts`,
  `test/e2e/a11y.e2e.ts`, `test/ui/spec020-track-option.test.tsx`

## Configuration impact

None. No environment variable, no feature flag, no build configuration, no new
package script. The constants of SPEC-019 (`MAX_GUESSES`, `HINT_AFTER_GUESSES`)
and SPEC-020 (`WELL_KNOWN_POOL_SIZE`, the floor) are untouched.

## Error handling

| Condition | Response |
| --- | --- |
| The well-known track is unavailable (cache absent, pool below the floor) | No controls, no group, no detail slot, no caveat line; the full track plays unchanged (SPEC-020 REQ-008) |
| A guess has no recorded `timeSpan` | No bar; an explicit mark in its slot outside the plot area plus a visible statement naming the guess (REQ-007) |
| The answer has no recorded `timeSpan` | Every guess evaluates to `unavailable`; every slot renders REQ-007's explicit state, and the column shows the axis with no bars — never a blank column with no explanation |
| A guess's span falls outside the column's Ma bounds | It is clamped to the column and labelled as reaching beyond it; a bar is never drawn outside the plotted area or silently dropped |
| Pointer events unavailable (touch) | The selected track's detail is visible regardless; no information is hover-only (REQ-003) |
| Local storage unavailable | Unchanged from SPEC-019: the round plays, the notice shows, the track choice simply does not persist |

## Edge cases

- **Zero guesses.** The column shows the axis and the key with no bars; the key
  is not hidden until a guess exists, so the player can read the scheme before
  using it.
- **Eight bars in the column.** Eight 8 px slots with their gaps already fit the
  existing 20 rem column; adding a direction mark and a foot mark must not force
  a horizontal scroll or overlap the period names.
- **All eight guesses overlap.** Eight solid teal bars, no direction marks; the
  key still explains the absent treatments.
- **All eight guesses miss on the same side.** Eight hollow bars with marks
  pointing the same way — legible, and it must not read as a single block.
- **A very short span** (a single stage, ~2 Ma) renders a bar a few pixels
  high; it must remain visible and meet the contrast floor, and a hollow one must
  still read as hollow at that height.
- **A span crossing all three periods** renders a bar nearly the column's
  height; its direction mark, if any, must stay inside the plot area.
- **The same guess ordinal in the key and in the AT sentence** must agree —
  slot 3 is "Guess 3".
- **The narrow-viewport (phone) layout** stacks the tree and the column
  (`.board` wraps); the header control and its detail slot must survive the wrap
  without the detail becoming a second line that pushes the countdown off-screen.
- **A long window string** in the caveat (e.g. "2025-08/2026-08") must wrap
  rather than clip (charter §6).
- **Practice mode on the well-known track** shows the control, the detail and
  the caveat exactly as the daily does.

## Acceptance criteria

This spec is satisfied when all of the following hold:

1. The track choice is two named controls — "Every genus" and "Well-known" — in
   the screen header, keyboard operable, with the accessible group name "Which
   puzzle", and the track is named once in the header.
2. The pool sizes are the only copy that moved off the always-visible surface,
   and they are reachable by hover, by focus, by touch and as an accessible
   description; the English-Wikipedia/attention-not-importance caveat is visible
   at all times with no interaction.
3. Switching track is still non-destructive, still persists, still applies to
   practice, and the fragments still work.
4. Each guess draws one bar: solid teal when its span overlaps the answer's,
   hollow neutral when it does not, with a direction mark on a miss, a word for
   every treatment in a one-line key, and no verdict readable by colour alone.
5. A guess with no recorded time span renders an explicit visible mark and
   statement, never an empty slot.
6. No band lights, nothing names the answer's period during a round, and the Ma
   ticks, bands and period names remain.
7. Nothing under `src/app/state/` changes; the shared summary, the stored schema
   and both tracks' answer sequences are identical to before.
8. `docs/mockups/daily-genus.md` and the two mockup SVGs are updated to the
   shipped design (see Conflict check), so no documentation asserts the retired
   mechanic or the retired fieldset.
9. `pnpm run typecheck`, `pnpm test`, `pnpm run lint`, `pnpm run format`,
   `pnpm e2e`, `pnpm run check:budget` and the three governance scripts all
   pass, and no file under `public/data/` changes.

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Two named header controls, group named "Which puzzle", track stated once | automated test + inspection | `pnpm test spec020-track-option` | `test/ui/spec020-track-option.test.tsx` | |
| REQ-002 | Caveat visible with no interaction; only pool sizes moved; no view count | automated test + inspection | `pnpm test spec020-track-option`, `pnpm e2e` | `test/ui/spec020-track-option.test.tsx`, `test/e2e/spec019-daily.e2e.ts` | |
| REQ-003 | Detail on hover, on focus, and on touch; `aria-describedby`, not `title` | automated test + manual | `pnpm test spec020-track-option`; manual touch check | `test/ui/spec020-track-option.test.tsx` | |
| REQ-004 | Switching non-destructive; choice persists; fragments unchanged | automated test | `pnpm test spec020-track-option spec020-track-fragments` | `test/ui/spec020-track-option.test.tsx`, `test/ui/spec020-track-fragments.test.tsx` | |
| REQ-005 | Solid bar on overlap, hollow on miss, distinguishable in greyscale | automated test | `pnpm test spec019-states` | `test/ui/spec019-states.test.tsx` | |
| REQ-006 | Direction mark on a miss; four treatments named in a one-line key | automated test | `pnpm test spec019-states spec019-daily-screen` | `test/ui/spec019-states.test.tsx`, `test/ui/spec019-daily-screen.test.tsx` | |
| REQ-007 | No-span guess renders an explicit mark and statement, never blank | automated test | `pnpm test spec019-states` | `test/ui/spec019-states.test.tsx` | |
| REQ-008 | No band lights; no period named in-round; ticks/bands/names remain | automated test + inspection | `pnpm test spec019-states spec019-daily-screen` | `test/ui/spec019-states.test.tsx` | |
| REQ-009 | Pure core, storage and share summary byte-identical | automated test + inspection | `pnpm test spec019-clue-rows spec019-guess-evaluation spec020-share-track spec019-persistence` | `test/spec019-clue-rows.test.ts`, `test/spec020-share-track.test.ts` | |
| NFR-001 | No token, hue, dependency or data-file change | inspection + script | `git diff`, `pnpm run check:budget` | PR diff | |
| NFR-002 | Full round on both tracks with every network API throwing | automated test | `pnpm test spec019-no-egress spec020-no-egress` | `test/ui/spec019-no-egress.test.tsx`, `test/ui/spec020-no-egress.test.tsx` | |
| SEC-001 | No new stored field or key; hover state not persisted | automated test + inspection | `pnpm test spec019-persistence` | `test/spec019-persistence.test.ts` | |
| API-001 | No exported signature or type changes | automated test + inspection | `pnpm run typecheck`, `pnpm test` | PR diff | |
| UX-001 | No pill, chip, segmented control or bordered container added | inspection + automated copy check | anti-slop self-check; `pnpm test spec020-track-option` | `test/ui/spec020-track-option.test.tsx`, PR review notes | |
| UX-002 | Greyscale legibility; ≥ 3:1 non-text contrast; axe clean | automated test + measurement | `pnpm e2e`, contrast measurement | `test/e2e/a11y.e2e.ts` | |
| UX-003 | Every listed state renders a distinct labelled surface | automated test | `pnpm test spec019-states spec020-track-option` | `test/ui/spec019-states.test.tsx` | |
| UX-004 | Keyboard round incl. track switch; one announcement per guess; no new live region | automated test + manual | `pnpm e2e`, `pnpm test spec020-track-option` | `test/e2e/spec019-daily.e2e.ts`, `test/e2e/a11y.e2e.ts` | |

## Test plan

**No test is skipped or deleted.** Every test below is updated in place, and the
suites that must pass *unmodified* are named as the regression evidence for
REQ-009.

**Updated — track control (REQ-001…REQ-004, UX-001, UX-003, UX-004)**

- `test/ui/spec020-track-option.test.tsx` — the largest change. If the
  implementation keeps native radio inputs inside a fieldset whose legend is
  visually hidden (recommended), the `getByRole("radio", …)` and
  `getByRole("group", { name: /which puzzle/i })` queries keep working and only
  these expectations change: the `· well-known` suffix assertion at line 107
  (the header now names the track once, on the control), and the two
  `.trackNote` strings, which move into the detail. New tests: the caveat is
  present with no interaction and with either track selected; each control's
  accessible description resolves to its pool size; keyboard focus on the
  unselected control previews its detail and blur restores; the detail is not a
  `title` attribute; no pool size is the sole carrier of a provenance
  statement. If the implementation instead uses ARIA `radiogroup`/`radio`
  elements, the role queries stay and only the `HTMLInputElement.checked`
  assertions become `aria-checked` assertions — recorded here so the choice is
  made deliberately, not discovered.
- `test/ui/spec020-track-fragments.test.tsx` and
  `test/ui/spec020-no-egress.test.tsx` — both select the track by role and name;
  they change only if the element type changes.
- `test/e2e/spec019-daily.e2e.ts` — `getByRole("group", { name: /which
  puzzle/i })`, `getByRole("radio", …).check()` and the two caveat assertions.
  `.check()` requires a real input, so it is rewritten as a click if native
  inputs are dropped.
- `test/e2e/a11y.e2e.ts` — no code change expected; it is the gate for UX-002 and
  UX-004 and must stay green on both tracks.

**Updated — Ma column (REQ-005…REQ-008, UX-002, UX-003)**

- `test/ui/spec019-states.test.tsx` — the REQ-006 period test at lines 101-126
  is **rewritten, not removed**: it currently asserts the retired disclosure
  ("The answer's period appears once a guess overlaps it", "Cretaceous — the
  answer's period"). It becomes the assertions of REQ-005/REQ-006/REQ-008: an
  overlapping guess renders a solid bar, a missing guess a hollow bar with a
  direction mark, no band changes weight, and no rendered text names the
  answer's period during the round. The existing no-span test at lines 130-136
  is extended with REQ-007's visible mark and statement, keeping its
  `visuallyHidden` assertion.
- `test/ui/spec019-daily-screen.test.tsx` — the "no depth, distance or
  percentage" copy check (lines 84-92) is extended over the new key line, and a
  greyscale/attribute-level assertion is added that each bar's verdict is
  carried by a non-colour attribute as well as its fill.

**Unmodified, as regression evidence (REQ-009, API-001, SEC-001)**

- `test/spec019-clue-rows.test.ts` — `timeVerdict` semantics, including the
  touching-bounds rule and all three `unavailable` cases.
- `test/spec019-guess-evaluation.test.ts`, `test/spec019-revealed-tree.test.ts`,
  `test/spec019-answer-pool.test.ts`, `test/spec019-daily-selection.test.ts`.
- `test/spec019-persistence.test.ts`, `test/spec020-share-track.test.ts`,
  `test/spec020-well-known-pool.test.ts`, `test/spec020-tracks.test.ts`,
  `test/spec020-popularity-cache.test.ts`.
- `test/ui/spec019-practice.test.tsx`, `test/ui/spec019-rollover.test.tsx`,
  `test/ui/spec019-entry-point.test.tsx`, `test/ui/spec019-guess-input.test.tsx`,
  `test/ui/spec019-no-egress.test.tsx`.

**Fixtures.** None new. `test/spec019-fixture.ts` already supports a span-less
taxon (`{ noSpan: ["t:veloci"] }`), which is what REQ-007 needs.

**Manual.** One touch-device pass for REQ-003 (the detail with no hover), and a
greyscale pass over the column for UX-002.

## Rollback plan

Presentation only, and confined to two files: `DailyGenusScreen.tsx` and
`dailyGenus.module.css`. Reverting the PR restores the fieldset and the
period-band mechanic exactly, because no state module, no storage key, no data
artifact and no fragment changes — a player's rounds, records and streaks are
untouched by construction (REQ-009), on both tracks, in either direction. The
two halves are separable: the track control and the Ma column can be reverted
independently, since they share no code. If only the amended disclosure proves
wrong, restoring the answer's period reveal is a re-amendment of SPEC-019
REQ-006, not a rebuild.

## Open questions

- [ ] **Does the header have room on a phone?** The header already carries the
      puzzle identity, the countdown and the back control, and `.board` wraps at
      narrow widths. Whether the two controls sit on the header's own row or
      wrap to a second line under it is a layout decision to settle against the
      real viewport during implementation; either satisfies REQ-001 as long as
      both controls and the caveat stay visible without interaction.
      **Deferred to implementation, not blocking.**
- [ ] **The exact glyphs** for the direction mark, the no-span mark and the key
      entries. REQ-006 and REQ-007 fix the meanings and the requirement that
      each is named in words; the characters are an implementation choice made
      against the shipped monospace, and must not become an icon set (UX-001).
      **Deferred to implementation, not blocking.**

Both are deferred by intent: neither changes what is built, and neither can be
answered better on paper than in the browser.

## Human decisions required

- [ ] **Approve this spec** (status → Approved), including the two decisions
      below, which are recorded here rather than taken silently.
      Answer:
- [ ] **The answer's geological period is no longer disclosed during a round**
      (REQ-008, amending SPEC-019 REQ-006). Retiring the band-lighting mechanic
      retires the only thing it disclosed. Recommended, because the per-guess
      overlap verdict and direction mark that replace it are more specific and
      actually legible, and because the reveal still states the answer's span.
      The alternative — keeping a sentence that names the answer's period once a
      guess overlaps it, with no band lighting — is available at the cost of one
      more line of copy on a screen the owner has just called too wordy.
      Answer:
- [ ] **"Green" is realised as the product's teal accent, not a new green
      token** (REQ-005, NFR-001). Teal is already the accent for the data layer,
      so no second hue enters the palette. A literal green would need a new
      token and a change to charter §4, which this spec does not propose.
      Answer:

## Assumptions

Recorded per `CLAUDE.md` rather than decided silently.

1. **Owner decisions of 2026-08-14, carried into requirements:** header controls
   for the track choice with the detail on hover (REQ-001, REQ-003); domain
   names kept, no difficulty vocabulary (REQ-001); one bar per guess, green on
   overlap and grey on a miss, position carrying older/younger, the period-band
   mechanic retired (REQ-005, REQ-006, REQ-008); grey rather than red, for
   colourblind legibility (REQ-005, UX-002).
2. **"Buttons" is a presentation instruction, not a semantics instruction.** The
   control is specified as a two-option single-choice group however it is built,
   because that is what it is and what assistive technology must be told. Keeping
   the native radio inputs and restyling their labels is the recommended
   implementation: it preserves the accessible group name, the keyboard pattern
   and most existing test queries.
3. **The pool sizes are descriptive, not provenance.** "All 985 in the snapshot"
   states a magnitude; it makes no claim about sourcing or certainty, which is
   why REQ-002 lets it move and holds the caveat back. If a reviewer disagrees,
   the fix is to leave the sizes visible too — the requirement is written so that
   nothing breaks if they do.
4. **A fixed detail slot beats a tooltip.** Specified in REQ-003 because it makes
   the detail reachable with no interaction at all on touch, which no hover
   tooltip can be.
5. **The direction mark publishes nothing new.** `older`/`younger` is already
   disclosed per guess by SPEC-019 REQ-006 and already announced to assistive
   technology; REQ-006 only makes it visible.
6. **The bands stay.** Retiring the *lighting* is not retiring the *axis*; the
   ICS context is what makes the column a reading rather than eight floating
   bars (anti-slop checklist, "turn a scalar into an axis").

## Conflict check

No blocking conflict. Three documentation conflicts are created by this change
and must be resolved as part of implementation; this spec cannot resolve them
itself, because it may write only its own file.

- **SPEC-019 (Daily Genus)** — REQ-006 governs the time clue and explicitly
  requires the answer's period to be disclosed on overlap. REQ-005…REQ-008 here
  change that, so an amendment to SPEC-019 REQ-006 is required and is drafted
  below. No other SPEC-019 requirement is touched: REQ-004 (no depth or
  distance) is honoured, REQ-007's reveal is unchanged, REQ-011's summary is
  unchanged, UX-002's state list is extended rather than reduced, and UX-003's
  accessibility rules are strengthened.
- **SPEC-020 (well-known track)** — REQ-004 governs the track option's presence
  and behaviour; the control's shape and the placement of the per-track notes
  change, so an amendment to REQ-004 is required and is drafted below. **UX-001
  and UX-002 are deliberately *not* amended**: the caveat they require stays
  visible (REQ-002), which is the whole point of the disclosure split. REQ-005
  (per-track records), REQ-006 (the summary names its track), REQ-007
  (fragments) and REQ-008 (degradation) are unaffected.
- **`docs/mockups/daily-genus.md`** — two passages become wrong: the states
  table and expected-contents line "the answer's period lit only once a guess
  overlaps it (REQ-006)" (line 61) plus the visual-system note "the disclosed
  period is simply the band that is lit" (line 130); and the whole "The track
  choice (SPEC-020)" section (lines 99-120), which describes the fieldset, the
  legend, its position "directly under the header, above the tree", and the
  paragraph under the choices. Both must be rewritten at implementation, and the
  two SVGs (`docs/assets/mockups/daily-genus.svg`,
  `daily-genus-states.svg`) redrawn for the changed regions. Recorded as
  spec-level acceptance criterion 8. The mockup page introduces no requirements,
  so this is drift to repair, not a requirement conflict.
- **SPEC-021, SPEC-022, SPEC-025** — adjacent work on the same screen (heading
  rename, product rename, cladogram redraw). No requirement here depends on any
  of them, and none of their subjects is touched: the heading text, the product
  name and the tree's geometry are all out of scope. If they land first, this
  spec's diff is confined to the header, the track control and the Ma column and
  should not collide.
- **SPEC-010 REQ-002** — "no colour-only signal is introduced" is the precedent
  UX-002 restates for the new bar treatments. Not weakened.
- **SPEC-001 DATA-005** — restated as NFR-002. Untouched.

## Required amendments to existing specs

> Ready to transplant. Do **not** apply these until this spec is approved; then
> paste each block into the target spec's `## Spec amendments` section, verbatim.

### For SPEC-019 (`docs/specs/implemented/SPEC-019-daily-genus-puzzle.md`)

SPEC-019's amendments section currently holds only the empty template stub
numbered `AMEND-001`; this block replaces that stub.

#### AMEND-001 — the time clue becomes a per-guess overlap verdict; the answer's period is no longer disclosed

- **Date:** 2026-08-14
- **Reason:** The owner reported that the Ma column is not understood in play
  ("I don't understand how the Ma reveal work in the puzzle", 2026-08-14). As
  built, every guess draws an identical teal bar and the only per-guess verdict —
  older / younger / overlaps — exists solely in `visuallyHidden` text, so a
  sighted player is told nothing per guess; the answer's period is disclosed by
  raising one ICS band's opacity from 0.22 to 0.62, a change few players notice
  and none can be expected to interpret. SPEC-024 replaces the mechanic with one
  that is legible on the axis itself.
- **Changed requirements:** REQ-006 (the time clue). The statement drops "and
  disclosing the answer's geological period once a guess's span overlaps it" and
  gains: each guess's span is drawn as one bar on the shared Ma axis, rendered
  solid in the teal accent when it overlaps the answer's span and hollow in a
  neutral token when it does not, with a visible direction mark on a miss showing
  whether the answer is older or younger, every treatment named in words in a
  key, and a guess with no recorded span rendering an explicit visible
  missing-value mark and statement in place of a bar. The acceptance criterion
  "The answer's period is disclosed only after a guess whose span overlaps it,
  and never before" is **deleted** and replaced by "The answer's geological
  period is never named during a round; the answer's time span continues to be
  stated in the reveal (REQ-007)." The remaining criteria — the older / younger /
  overlapping decision, the explicit "Not available", and inventing no value —
  are unchanged. `timeVerdict()` and its four-member `TimeVerdict` type are
  unchanged.
- **Behavioral impact:** The game stops disclosing one aggregate fact (the
  answer's geological period) mid-round, and starts showing two per-guess facts
  that were previously invisible to sighted players (overlap-or-miss, and the
  direction of the miss). No band changes weight at any point. The reveal at the
  end of the round is unchanged and still states the answer's time span in Ma.
  Answers, guess evaluation, the revealed tree, the eight-guess budget, the
  stored round schema and the shared summary are all unchanged — `shareSummary`
  never encoded the time verdict, so no shared result changes meaning. A guess
  with no recorded time span stops being invisible.
- **Test impact:** `test/ui/spec019-states.test.tsx` — the REQ-006 period test
  (lines 101-126) is rewritten in place to assert the new bar treatments and that
  no rendered text names the answer's period during a round; the no-span test
  (lines 130-136) is extended with the visible mark and statement. Its
  `visuallyHidden` assertions are kept.
  `test/ui/spec019-daily-screen.test.tsx` gains an assertion that each bar's
  verdict is carried by a non-colour attribute as well as its fill.
  `test/spec019-clue-rows.test.ts` passes **unmodified** (the pure verdict logic
  is untouched), as do `test/spec019-guess-evaluation.test.ts`,
  `test/spec019-persistence.test.ts` and `test/spec020-share-track.test.ts`. No
  test is skipped or deleted. `docs/mockups/daily-genus.md` and the two mockup
  SVGs are updated in the same PR.
- **Human approval reference:** Owner approval in session, 2026-08-14.

### For SPEC-020 (`docs/specs/implemented/SPEC-020-daily-genus-well-known-track.md`)

AMEND-001 and AMEND-002 are taken; this block is `AMEND-003`.

#### AMEND-003 — the track option becomes two named controls in the header, with the pool sizes on demand and the caveat still always visible

- **Date:** 2026-08-14
- **Reason:** The owner reported the option as "awkward and too wordy" and asked
  for controls in the header with the detail on hover (2026-08-14). As built it
  is a fieldset with the legend "Which puzzle", two labels each carrying a name
  and a scope note, and a caveat paragraph — four blocks of copy for a two-way
  choice, sitting between the header and the tree on a screen whose subject is
  the tree.
- **Changed requirements:** REQ-004 (the track option). The statement gains: the
  choice is presented as exactly two controls in the screen header, labelled with
  the domain names "Every genus" and "Well-known" — never a difficulty word — and
  exposed as a single-choice group of two options with the accessible group name
  "Which puzzle". Each track's **pool size** may be carried in an on-demand
  detail, provided that detail is revealed on pointer hover **and** on keyboard
  focus, is reachable on a touch device with no hover, and is exposed as the
  control's accessible description through a real element rather than a `title`
  attribute. The **ranking caveat required by UX-001 and UX-002** — English
  Wikipedia, the stated window, how often people read the article, and "a
  measure of attention, not of scientific importance" — must remain rendered and
  visible whenever the control is rendered and must never move behind a hover or
  any other on-demand disclosure. The header names the chosen track exactly once.
  Existing acceptance criteria are retained, including "the option is visible on
  the screen and is not hidden behind a hover", and one is added: the pool sizes
  are reachable without a pointer. **UX-001 and UX-002 are not amended** — they
  are satisfied unchanged, because the caveat stays visible.
- **Behavioral impact:** None to which puzzle is played, to the answer sequences,
  to per-track records and streaks, to the non-destructive switch that preserves
  each track's open round, to persistence, to practice, or to the four fragments.
  The visible surface loses the legend and the two scope notes (the sizes move to
  the detail) and loses the duplicate `· well-known` suffix on the puzzle-identity
  line, which the selected control now carries. Nothing about provenance becomes
  less legible: the caveat is in the same always-visible class it was before.
- **Test impact:** `test/ui/spec020-track-option.test.tsx` — the header-suffix
  assertion (line 107) and the two scope-note strings are updated; new tests
  cover the caveat's presence with no interaction, the accessible description
  resolving to the pool size, the keyboard-focus preview, and the absence of a
  `title`-attribute implementation. Keeping the native radio inputs inside a
  fieldset with a visually hidden legend leaves the `getByRole("radio", …)` and
  `getByRole("group", { name: /which puzzle/i })` queries working;
  `test/ui/spec020-track-fragments.test.tsx` and
  `test/ui/spec020-no-egress.test.tsx` then need no change, and
  `test/e2e/spec019-daily.e2e.ts` keeps its `.check()` call. If the
  implementation instead uses ARIA radios, those four files are updated to
  `aria-checked` and `click()`. `test/e2e/a11y.e2e.ts` is the gate and must stay
  green on both tracks. `test/spec020-share-track.test.ts` and
  `test/spec020-well-known-pool.test.ts` pass unmodified. No test is skipped or
  deleted. The "The track choice (SPEC-020)" section of
  `docs/mockups/daily-genus.md` and the mockup SVGs are updated in the same PR.
- **Human approval reference:** Owner approval in session, 2026-08-14.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | header track control | `components/DailyGenusScreen.tsx` header; `dailyGenus.module.css` `.tracks*` | `test/ui/spec020-track-option.test.tsx` | Not started |
| REQ-002 | disclosure split | `DailyGenusScreen.tsx` caveat line + detail slot | `test/ui/spec020-track-option.test.tsx`, `test/e2e/spec019-daily.e2e.ts` | Not started |
| REQ-003 | detail slot | `DailyGenusScreen.tsx` hover/focus state + `aria-describedby` | `test/ui/spec020-track-option.test.tsx` | Not started |
| REQ-004 | track switching | `DailyGenusScreen.tsx` · `chooseTrack` (unchanged) | `test/ui/spec020-track-option.test.tsx`, `test/ui/spec020-track-fragments.test.tsx` | Not started |
| REQ-005 | Ma column bars | `DailyGenusScreen.tsx` `.bars`; `dailyGenus.module.css` `.bar` | `test/ui/spec019-states.test.tsx` | Not started |
| REQ-006 | direction mark + key | `DailyGenusScreen.tsx` column key | `test/ui/spec019-states.test.tsx`, `test/ui/spec019-daily-screen.test.tsx` | Not started |
| REQ-007 | missing-span state | `DailyGenusScreen.tsx` bar slot | `test/ui/spec019-states.test.tsx` | Not started |
| REQ-008 | retirement | removal of `answerPeriod`/`periodDisclosed*`/`periodOf`/`.bandLit`/`.periodNote` | `test/ui/spec019-states.test.tsx` | Not started |
| REQ-009 | pure core untouched | no change under `src/app/state/` | `test/spec019-clue-rows.test.ts`, `test/spec020-share-track.test.ts` | Not started |
| NFR-001 | tokens | `dailyGenus.module.css` (existing tokens only) | PR diff, `pnpm run check:budget` | Not started |
| NFR-002 | no egress | screen reads the loaded snapshot only | `test/ui/spec019-no-egress.test.tsx`, `test/ui/spec020-no-egress.test.tsx` | Not started |
| SEC-001 | storage | `state/dailyGenusStorage.ts` (unchanged) | `test/spec019-persistence.test.ts` | Not started |
| API-001 | pure core | `state/dailyGenus.ts` (unchanged) | `pnpm test`, `pnpm run typecheck` | Not started |
| UX-001 | header control styling | `dailyGenus.module.css` | `test/ui/spec020-track-option.test.tsx`, PR review | Not started |
| UX-002 | contrast + greyscale | `dailyGenus.module.css` bar tokens | `test/e2e/a11y.e2e.ts` | Not started |
| UX-003 | states | `DailyGenusScreen.tsx` branches | `test/ui/spec019-states.test.tsx`, `test/ui/spec020-track-option.test.tsx` | Not started |
| UX-004 | accessibility | group semantics, `aria-describedby`, existing live region | `test/e2e/spec019-daily.e2e.ts`, `test/e2e/a11y.e2e.ts` | Not started |

## Implementation notes

To be filled during implementation. Any deviation must trace to an assumption
above or to a new amendment here.

## Spec amendments

> Required for any behavioral change after this spec is Approved. None yet — the
> amendments this spec *requires of other specs* are in "Required amendments to
> existing specs" above, not here.

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [x] Open questions are resolved or explicitly deferred.
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed.
- [ ] Human approval recorded before status set to Approved.
