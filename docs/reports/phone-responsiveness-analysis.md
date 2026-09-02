---
doc_type: report
title: Phone responsiveness — what breaks today, and what to do about it
status: For review (pre-spec)
owner: nelsonjeanrenaud@gmail.com
author: agent
date: 2026-09-02
---

# Phone responsiveness — current state

> Analysis report, not a spec. It records what the shipped app does on a
> vertical phone, why, and a proposed order of work. It introduces **no**
> requirements: everything below is a finding or a proposal. Requirements live
> only in specs (`CLAUDE.md`), so nothing here should be implemented until a
> spec covering it is approved.

## The short version

The app is **not usable on a phone in portrait today.** It is a desktop layout
that has never been given a narrow-viewport treatment, and it degrades by
squeezing rather than by re-arranging.

Three numbers carry the whole story, measured at 390×664 (iPhone 13 portrait):

- The page is **607 px wide in a 390 px window** — the whole document scrolls
  sideways, and "Reset view" sits off-screen at x = 571.
- Fixed chrome takes **343 px of 664** (52%) before any content, leaving the map
  and the list **321 px** to share.
- That 321 px is split into a **226 px map** and a **164 px sidebar**, and the
  map's own overlays then collide with each other inside it.

Two screens are already partly adapted and can be left mostly alone: the
**taxon profile** (clean, no overflow) and **Dinordle** (has a 40rem
breakpoint). The **map screen** and the **taxonomy screen** are the work.

![The map screen at 390×664. The context row runs off the right edge, the
timeline's stage steps are sub-pixel, and the "Show taxa without a Wikipedia
article" toggle is painted on top of the clade key.](../assets/phone-map-390.png)

---

## How I measured

Built the app (`pnpm run build`) and drove the real preview build in headless
Chromium via Playwright, at five viewports — 320×568, 360×640, 390×664
(`devices['iPhone 13']`), 430×730 and 844×390 (landscape) — with `isMobile` and
`hasTouch` set. For each screen I recorded `document.scrollWidth` against
`clientWidth`, every element whose right edge escapes the viewport, every
interactive element under 44 px in either dimension, and the box of each layout
region. Screens visited: map, taxonomy, Dinordle, taxon profile.

Everything numeric below is from those runs. Nothing is estimated.

### Measurements across viewports (map screen)

| Viewport | doc scrollWidth | header | timeline | map pane | sidebar | narrowest stage step |
| --- | --- | --- | --- | --- | --- | --- |
| 320×568 | **607** | 320×232 | 320×111 | 186×225 | 134×225 | **0.0 px** |
| 360×640 | **608** | 360×232 | 360×111 | 209×297 | 151×297 | **0.0 px** |
| 390×664 | **607** | 390×232 | 390×111 | 226×321 | 164×321 | **0.0 px** |
| 430×730 | **607** | 430×232 | 430×111 | 249×387 | 181×387 | **0.0 px** |
| 844×390 (landscape) | 844 | 844×171 | 844×111 | 490×**108** | 354×108 | 1.5 px |

Note that the header is **232 px tall at every portrait width** — it does not
adapt at all — and that landscape leaves a **108 px-tall map**.

---

## Findings

Severity: **S1** blocks the task on a phone · **S2** makes it painful ·
**S3** polish.

### Shell and global

**P-01 · S1 · The whole document scrolls horizontally.**
`scrollWidth` is 607–608 px at every portrait width tested. The cause is
`.context` in `src/app/components/exploration.module.css:90` — the context row's
inner group is `display: flex` with **no `flex-wrap`**, so its four stats plus
the frame radio group lay out on one 591 px line. `.header` above it
(`exploration.module.css:70`) does wrap, but the overflow is one level down. The
"Reset view" control and the "Present day" frame option are both off-screen.

**P-02 · S1 · The shell has no breakpoints at all.**
The entire codebase contains **two** width media queries: `.heroGrid` at
`max-width: 640px` (`exploration.module.css:1979`) and the Dinordle board at
`max-width: 40rem` (`dailyGenus.module.css:813`). There is no narrow-viewport
rule for the app bar, the context row, the timeline, the body split, the
sidebar, the map rails or the taxonomy screen.

**P-03 · S2 · `100vh` instead of `100dvh`.**
`.app { min-height: 100vh }` (`exploration.module.css:4–9`). On iOS Safari and
Chrome Android the `vh` unit is sized to the *largest* viewport, so the bottom
of the map — where the clade key and the attribution ⓘ live — sits under the
browser toolbar until the user scrolls, and the layout jumps as the toolbar
collapses.

**P-04 · S3 · No `viewport-fit=cover`, no safe-area insets.**
`index.html:5` is `width=device-width, initial-scale=1.0`. Fine today because
nothing is edge-to-edge; it becomes a notch/home-indicator problem the moment
the map goes full-bleed, which is the obvious phone layout.

**P-05 · S1 · Permanent chrome eats half the screen.**
At 390×664: app bar 98 px (the wordmark wraps onto its own line above the three
nav links) + context row 134 px + timeline 111 px = **343 px**, 52% of the
viewport, before a single occurrence is shown. At 320×568 the map and list share
**225 px**.

**P-06 · S2 · The touch-target floor is 24 px.**
`--target-min: 24px` (`tokens.css`) is the project's own minimum and is honoured
throughout, but it is roughly half the 44 px (iOS) / 48 px (Android) platform
minimum. Measured on the map screen: nav links 25×34 and 67×34, "Reset view"
36 px wide, frame options 24 px tall, period bands 24 px tall, and stage steps
1–21 px wide.

**P-07 · S2 · The taxon search input triggers iOS auto-zoom.**
`.searchInput { font-size: 14px }` (`exploration.module.css:102`). Safari zooms
the page in when a focused input is under 16 px and does not zoom back out, so
tapping search leaves the user in a magnified, sideways-scrolling page.
Dinordle's `.entryInput` is `1rem` and is correct — the fix is to match it.

**P-08 · S2 · Hover-only affordances have no touch equivalent.**
Three, in descending order of how much they matter:
1. The map hover card (SPEC-015 REQ-003) is the "identity before click"
   mechanism. On touch there is no hover, so that guarantee is silently absent.
2. `.leadFrame:hover .credReveal` (`exploration.module.css`, taxon profile
   gallery) hides the **image credit** behind hover. The charter says provenance
   is never behind a hover; on a phone it is behind nothing at all — it is
   unreachable.
3. `.fanListItem:hover { text-decoration: underline }` is the only cue that fan
   rows are tappable.

### Map screen

**P-09 · S1 · The two-column body starves both columns.**
`.body { display: flex }` with `.mapPane { flex: 1 }` and
`.sidebar { width: 360px; max-width: 42vw }`
(`exploration.module.css:488–503`, `972–980`). There is no stacking rule, so at
390 px the split is a **226 px map** beside a **164 px list**. Row text wraps to
one or two words per line; the unit selector wraps to four lines and is 133 px
tall inside a 164 px-wide column (P-13).

**P-10 · S1 · The map's corner rails overlap each other.**
`.mapRail { max-width: calc(50% - var(--space-3)) }`
(`exploration.module.css:599–611`) is 101 px on a 226 px map. The Wikipedia-gate
toggle's label wraps to six lines and grows *sideways* past its rail: measured,
the bottom-left rail occupies x 12–113 and the gate occupies x 95–214 — an
**18 px overlap**, visible in the screenshot as the toggle text painted across
the clade key. This violates SPEC-023's own non-overlap invariant.

**P-11 · S1 · The gate that should have caught P-10 stops at 820 px.**
`test/e2e/map-overlays.e2e.ts:22–28` runs the non-overlap assertion at 1440,
1280, 1024, 900 and 820 px wide. The comment even says the last two "give a
genuinely narrow map pane". They do not — narrow is 390.

**P-12 · S1 · The timeline is unaimable.**
`.timelineLabel { min-width: 128px }` (`exploration.module.css:259`) takes a
fixed 128 px, leaving the stage track **214 px at 390 px wide and 144 px at
320 px** for the ~30 Mesozoic stages, laid out to scale. The narrowest stage step
measures **0.0 px** at every portrait width. The period bands clip their own
labels — the screenshot reads "Triass", "Jurassi". Stepping the age is the
central verb of the map loop, and on a phone it cannot be aimed.

**P-13 · S2 · The unit selector consumes 40% of the sidebar's height.**
`.unitGroup` wraps its five options (`exploration.module.css:1062–1066`) to four
lines: measured 163×133 px inside a 164×321 px sidebar.

**P-14 · S2 · The map carries more chrome than map.**
On a 226 px canvas: MapLibre's zoom controls (top-right), the clade key, the
attribution ⓘ (bottom-left) and the Wikipedia-gate toggle (bottom-right) are all
permanently drawn. Together they cover most of the visible ocean.

**P-15 · S3 · `touch-action: none` on a full-width band.**
`.stageTrack` (`exploration.module.css:352–362`) correctly disables scrolling so
a drag scrubs — but the track spans the full row, so a vertical swipe started
anywhere on it does nothing. Acceptable once the track is aimable (P-12);
worth re-checking after.

### Taxonomy screen

**P-16 · S2 · One 8,064 px column.**
At 390×664 the taxonomy screen's `scrollHeight` is **8,064 px** — roughly twelve
screenfuls — with no phone treatment and no way to skip between its sections.

**P-17 · S2 · The clade fan overflows the right edge.**
Ten elements measured outside the viewport, the worst reaching x = 415 in a
390 px window. `.fanListItem` (`exploration.module.css:2495–2507`) is a
`display: flex` row with `align-items: baseline`, no `min-width: 0` and no
wrapping, and it is indented by its depth in the tree — so a long name plus its
count pushes straight out of the container.

### Screens that are already fine

**P-18 · The taxon profile is clean.** 390 px wide, 720 px tall, zero
overflowing elements. `.profile { max-width: 720px; width: 100% }` plus the
`heroGrid` 640 px breakpoint do the job. This is the pattern the other screens
should follow.

**P-19 · S3 · Dinordle is close.** No width overflow — the `40rem` breakpoint
stacks the board correctly. Remaining issues are only touch-target sizes: track
buttons 29 px tall, the ⓘ toggle 24×24, "↵ guess" 24 px tall.

### Process

**P-20 · S1 · The design charter is silent on viewport and touch.**
`docs/mockups/design-guidelines.md` and `docs/mockups/anti-slop-checklist.md`
contain **zero** occurrences of mobile, phone, touch, responsive, breakpoint or
viewport. The charter is binding on all UI work, so today there is no convention
to build against: no breakpoint vocabulary, no touch-target rule, no statement of
which surfaces may collapse on a small screen. This has to be settled before, not
during, implementation.

**P-21 · S1 · Nothing is tested below 820 px.**
No Vitest UI test asserts a narrow layout, and the e2e matrix bottoms out at
820 px (P-11). Any phone fix will regress silently without a gate.

---

## Proposed actions

Ordered so that each step is independently shippable and the earliest ones
unblock manual testing on a real device. Effort is a rough read.

| # | Action | Addresses | Effort |
| --- | --- | --- | --- |
| A-01 | **Write the spec first.** A phone-responsiveness spec (SPEC-030 by number) from `docs/specs/SPEC_TEMPLATE.md`, covering the breakpoint set, the phone layout of each screen, and the touch-target rule. Nothing below starts until it is approved. | all | M |
| A-02 | **Amend the charter** with a viewport & touch section: named breakpoints, the coarse-pointer target minimum, and which chrome is allowed to collapse. Charter conventions, not requirements. | P-20 | S |
| A-03 | **Stop the horizontal scroll.** Let `.context` wrap; verify `scrollWidth === clientWidth` at 320/360/390/430. Smallest change with the largest effect and worth doing on its own. | P-01 | S |
| A-04 | **Stack the map screen below the breakpoint.** `.body` becomes a column; the map takes a fixed share of the viewport and the list takes the rest, or the list becomes a bottom sheet over the map. Which of those two is a design decision for the spec, not for me. | P-09, P-13 | L |
| A-05 | **Condense the chrome.** Put the wordmark on the nav row, and let the context row collapse its four stats to the age readout plus a disclosure. Target: header under ~120 px. | P-05 | M |
| A-06 | **Rework the timeline for narrow widths.** Drop the 128 px fixed label to full width above the track, and give the track a coarse-pointer mode where the step target is at least 44 px — period bands plus prev/next stepping, with the to-scale track kept as the readout. This is the single hardest item and deserves its own mockup. | P-12, P-15 | L |
| A-07 | **Fix the rails on a narrow map.** Below the breakpoint, either give the bottom rails the full map width in a single stacked column, or move the gate toggle out of the map and into the list column. Then re-assert non-overlap. | P-10, P-14 | M |
| A-08 | **Touch targets and inputs.** Raise the minimum to 44 px under `@media (pointer: coarse)` — a new token rather than changing `--target-min`, so the desktop layout is untouched — and lift `.searchInput` to 16 px. | P-06, P-07, P-19 | S |
| A-09 | **Give every hover affordance a tap equivalent.** Tap-to-preview on map markers, the image credit visible (not hover-revealed) on coarse pointers, and a non-hover cue that fan rows are tappable. The credit one is a charter obligation, not a nicety. | P-08 | M |
| A-10 | **`100dvh` + `viewport-fit=cover` + safe-area padding** on the rails and any bottom sheet. | P-03, P-04 | S |
| A-11 | **Taxonomy phone pass.** `min-width: 0` and wrapping on `.fanListItem`, and section-level collapsing so the screen is not twelve screenfuls. | P-16, P-17 | M |
| A-12 | **Add the regression gate.** Extend `test/e2e/map-overlays.e2e.ts`'s viewport matrix with 390×664 and 360×640, and add a phone e2e that asserts no horizontal document overflow and a minimum target size on each of the four screens. Ideally landed with A-03 so the rest of the work is guarded from the start. | P-11, P-21 | S |

## Open questions for the owner

These change the shape of the work and I have not decided them:

1. **Breakpoint.** One phone breakpoint (~640 px) or phone + tablet? Dinordle
   already uses `40rem`; reusing it keeps one number in the system.
2. **Map screen layout.** Stacked map-over-list, or a bottom sheet over a
   full-bleed map? The sheet is better on a phone and a larger change.
3. **Landscape.** A 108 px-tall map (844×390) cannot be fixed by stacking. Is
   phone landscape in scope, out of scope, or handled by a "rotate for the map"
   notice?
4. **Touch minimum.** 44 px under `pointer: coarse` only, or raised everywhere?
   The latter is simpler and visibly changes the desktop layout.
5. **What may collapse.** The charter's "uncertainty and provenance are always
   legible, never behind a hover or a secondary click" rules out the usual phone
   move of hiding provenance behind a disclosure. Does that hold as-is on a
   phone, or does the charter need a phone-specific reading?

## What I did not do

- No code changed. This is analysis only, per the request and per `CLAUDE.md`'s
  rule against implementing behaviour without an approved spec.
- I did not write the spec. A-01 is the next step and needs the answers above.
- I did not test on real hardware — everything is headless Chromium with
  `isMobile`/`hasTouch`. The iOS Safari-specific items (P-03 toolbar behaviour,
  P-07 auto-zoom) are inferred from known engine behaviour and should be
  confirmed on a device.
