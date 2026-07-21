---
doc_type: spec
spec_id: SPEC-006
title: App loading experience — splash and progress
status: Draft
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, data-delivery, styling]
affected_interfaces: [static-data-artifacts]
supersedes: []
superseded_by:
depends_on: [SPEC-003]
conflicts_with: []
last_verified_at:
---

# SPEC-006: App loading experience — splash and progress

## Summary

When the app opens today the browser shows a **blank white page** for several
seconds while it parses the JS bundle, downloads the ~4.5 MB `snapshot.json`, and
initializes the map — the existing loading state only appears *after* React has
mounted, so it never covers the first (and longest) part of the wait. This spec
adds a **static splash screen rendered before any JavaScript runs** and a
**determinate progress indicator** that tracks the real phases of startup (data
download → map init → ready), so the user always sees that the app is working and
roughly how far along it is. It changes only the boot experience; it does not
change the data, the exploration loop, or the artifact size.

## Context

The app is a static React + Vite + MapLibre SPA (SPEC-002/003) that `fetch`es one
prebuilt snapshot artifact (SPEC-001 read model) with no runtime backend. SPEC-003
REQ-008 already specifies **loading / empty / error / minimal** data-state
surfaces and they exist (`src/app/components/states.tsx`, wired in `App.tsx`), but
they are React components: they can only render once the bundle has parsed and
React has mounted. The gap this spec closes is everything *before* that moment —
the empty `#root` in `index.html` and the large snapshot download — which the
owner observed as a long white page during local testing (2026-07-21). The
charter (`docs/mockups/design-guidelines.md`) requires every real state to be
designed, restraint over decoration, the pale deep-time palette, and one teal
accent; this splash is bound by it.

## Problem statement

A first-time or slow-connection user sees an unstyled blank page for seconds with
no signal that anything is loading, no branding, and no sense of progress. The
first useful paint must be **immediate** and must communicate progress through the
whole startup, not just the tail end after React mounts.

## Goals

- Paint a branded, charter-styled splash **immediately**, before the app bundle
  executes (inlined in the served HTML), eliminating the raw white page.
- Show **determinate progress** driven by the actual snapshot download (bytes
  received vs. total) plus discrete startup phases, with a graceful indeterminate
  fallback when the total size is unknown.
- Hand off cleanly to the mounted exploration view with no flash of unstyled or
  duplicated content, and integrate with the existing error/retry state
  (SPEC-003 REQ-008) so a failed load still degrades to a retryable error.
- Keep it accessible (announced, `role="progressbar"`, honors reduced motion) and
  add **no new runtime dependencies** and no measurable regression to the size
  budget.

## Non-goals

- **Reducing the artifact size / partitioning the snapshot** (SPEC-002 REQ-006
  scaling path) — a separate data-delivery concern; this spec makes the existing
  download legible, it does not shrink it.
- **Skeleton screens** that mimic the full exploration layout, or **progressive/
  streaming render** of partial occurrence data — the app still renders once the
  model is ready; only the pre-ready experience changes.
- **Route-level code-splitting / lazy chunking** of the bundle — a possible later
  performance lever, recorded as an open question, not built here.
- Any change to the exploration loop, the map, the data model, or the snapshot
  schema.

## Users or actors

The **Explorer** (charter §1) on first load or a slow/cold connection, including
the accessibility path (screen-reader and reduced-motion users). Secondarily the
**build system**, which must inline the splash into the served HTML at build time.

## Functional requirements

### UX-001: Immediate pre-JS splash

- **Statement:** The served `index.html` must paint a self-contained splash inside
  `#root` **before the app bundle executes** — product name/wordmark, a short
  "loading" affordance, and charter-styled background — using only inline CSS
  (and, if any, an inlined SVG/data-URI mark); no external stylesheet, font, or
  image request. The app must replace it on mount with no flash of unstyled or
  leftover splash content.
- **Rationale:** Removes the raw white page (the observed defect); charter §7
  ("all real states designed") and the "first useful content" load budgets
  (PERF-010/020).
- **Acceptance criteria:** With JS disabled or not yet executed, loading the page
  shows the styled splash (not a white page); after mount the splash is gone and
  the exploration view is shown; no network request other than the document, the
  bundle, and the app's own data/basemap artifacts occurs to render the splash.
- **Verification method:** automated (Playwright: assert splash node present in the
  initial HTML response / before app mount, absent after) + inspection.
- **Evidence location:** `index.html`, `test/e2e/*` (filled at implementation).

### UX-002: Determinate download progress

- **Statement:** While the snapshot is downloading, the app must display a
  **determinate** progress indicator derived from bytes received versus the total
  content length; when the total is not available it must fall back to a labeled
  **indeterminate** indicator. Progress must be conveyed with a text label, not by
  colour or animation alone.
- **Rationale:** The artifact is large (~4.5 MB); PERF-050 requires a loading
  indicator for waits over the budget; charter §4 (meaning-only colour, never the
  sole signal) and PERF-250 (not colour-only).
- **Acceptance criteria:** On a load where the response exposes a content length,
  the indicator advances from 0 toward 100% as bytes arrive and shows a textual
  percentage or byte count; when no length is available, an indeterminate
  "Loading…" indicator with a text label is shown instead; the indicator is
  removed once the model is ready.
- **Verification method:** automated (unit test of the progress-from-bytes
  reducer; component/E2E test of both determinate and indeterminate paths).
- **Evidence location:** progress module + test (filled at implementation).

### UX-003: Phased startup and clean handoff

- **Statement:** The loading experience must represent the ordered startup phases
  — **downloading data → preparing the view (map init) → ready** — advancing the
  indicator/label through them, and on completion transition to the exploration
  view exactly once, preserving the existing error/retry behaviour if any phase
  fails (SPEC-003 REQ-008: error state with retry, filters preserved).
- **Rationale:** Map initialization is a real, visible part of the wait
  (SPEC-003/004); the user should see progress through it, and failures must still
  land on the existing retryable error state (FONC-1310/1330/1340).
- **Acceptance criteria:** The label/phase reflects the current startup stage;
  when all phases complete the exploration view renders once (no duplicate/flash);
  a forced snapshot-load failure shows the existing error state with a working
  retry; a map-init failure still yields the accessible occurrence list
  (SPEC-003 REQ-002/003 fallback).
- **Verification method:** automated (E2E happy path + forced-failure path) +
  inspection.
- **Evidence location:** `src/app/App.tsx`, `test/e2e/*` (filled at implementation).

## Non-functional requirements

### NFR-001: No new runtime dependency; within budget; token-styled

- **Statement:** The splash and progress indicator must add **no new runtime
  dependency**, must be styled via the charter tokens (CSS custom properties, one
  teal accent, single light theme), and must not push the built bundle/data past
  the existing size-budget gate (`scripts/check_budget.ts`).
- **Rationale:** SPEC-002 REQ-005/NFR-001, SPEC-003 NFR-002/AMEND-002 budget
  ceilings; keep the "static, self-contained" property intact.
- **Acceptance criteria:** `pnpm install` adds no new `dependencies`; the splash
  CSS references charter tokens (no stray hardcoded palette hexes); the size-budget
  CI gate still passes.
- **Verification method:** dependency + code inspection; the existing budget CI
  gate.
- **Evidence location:** `package.json`, `index.html`/tokens, CI budget job.

## Security and privacy considerations

### SEC-001: Self-contained splash, no external fetch or telemetry

- **Statement:** The splash must load no third-party asset, font, script, or
  analytics/telemetry, and must contain no secret or token, preserving SPEC-003
  SEC-001.
- **Rationale:** SPEC-002 SEC-001; charter (no third-party telemetry).
- **Acceptance criteria:** No external host is contacted to render the splash; no
  analytics call occurs; no key/secret appears in the served HTML or bundle.
- **Verification method:** network + code inspection.
- **Evidence location:** `index.html`, built output.

## Data model impact

None. This spec consumes the existing snapshot artifact and read model unchanged.
The only new consumption is reading the HTTP response's byte stream/content length
to compute progress; the parsed model is identical. No DATA IDs created.

## API impact

No runtime API. The static data-artifact contract (SPEC-001/003) is unchanged; the
loader reads the same `data/snapshot.json` via `fetch`, additionally consuming the
response body as a stream to measure progress. No interface IDs created.

## UI or UX impact

This spec is UI. It adds UX-001…003 above and is bound by the design charter
(`docs/mockups/design-guidelines.md`). It introduces no new product requirements —
the product's loading/error requirements remain the functional specification's
(FONC-1260…1340, PERF-010/020/050). A splash/loading visual should be added to the
mockups (`docs/mockups/`) or an existing state mockup extended, at implementation.

## Configuration impact

A build step must inline the splash markup/CSS into the served `index.html`
(static in the template, or a small Vite transform). No runtime environment
variables, secrets, or feature flags.

## Error handling

- **Snapshot download fails / non-OK** → transition to the existing error state
  with Retry, filters preserved (SPEC-003 REQ-008); do not leave the splash frozen.
- **Content length unavailable** → indeterminate indicator (UX-002 fallback), not
  a stalled 0%.
- **Map/WebGL init fails** → proceed to the accessible occurrence list path
  (SPEC-003 REQ-002/003); the loading experience must not block on the canvas.
- **Very fast load** → the splash must not flash distractingly; a minimal display
  floor may be applied so a sub-perceptual splash doesn't strobe (tunable, no false
  delay beyond a small threshold).

## Edge cases

- Cached/instant load (data already in HTTP cache) — splash appears and clears
  cleanly without a stuck bar.
- Reduced-motion preference — any animation is disabled/replaced with a static
  determinate indicator (`prefers-reduced-motion`).
- Slow 3G / large download — determinate bar advances smoothly; label remains
  legible; no timeout that aborts a still-progressing download.
- Screen reader — progress is announced (`role="progressbar"` with value, or an
  `aria-live` label); the splash is not an unlabeled decorative blocker.

## Acceptance criteria

The spec is satisfied when: loading the app shows a charter-styled splash
immediately with no raw white page (UX-001); a determinate progress indicator
tracks the snapshot download with an indeterminate fallback (UX-002); the
experience advances through download → map-init → ready and hands off to the
exploration view exactly once, preserving the existing retryable error path
(UX-003); and it adds no runtime dependency, stays token-styled, self-contained,
and within the size budget (NFR-001, SEC-001).

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| UX-001 | Pre-JS splash, no white page, clean removal | automated + inspection | Playwright splash-before-mount | `index.html`, `test/e2e/*` | — |
| UX-002 | Determinate bar from bytes; indeterminate fallback; text label | automated | unit reducer + component/E2E | progress module + test | — |
| UX-003 | Phased startup; single handoff; error/retry preserved | automated + inspection | E2E happy + forced-failure | `src/app/App.tsx`, `test/e2e/*` | — |
| NFR-001 | No new dep; token-styled; within budget | inspection + CI | dep check + budget gate | `package.json`, tokens, CI | — |
| SEC-001 | Self-contained, no external/telemetry | inspection | network + code inspection | `index.html`, build output | — |

## Test plan

- **Unit:** the progress-from-bytes reducer (received/total → clamped percentage;
  unknown total → indeterminate).
- **Component/E2E (Playwright):** splash present in the initial document before app
  mount and absent after; determinate path advances and clears; indeterminate
  fallback path; forced snapshot-load failure lands on the retryable error state;
  reduced-motion path renders a static indicator.
- **Budget/deps:** the existing size-budget CI gate; a check that no new runtime
  dependency was added.
- **Fixtures:** existing snapshot artifact; a mocked `fetch`/response stream for
  the determinate/indeterminate and failure paths.

## Rollback plan

Additive and isolated: the splash lives in `index.html` + a small progress module
and a mount handoff in `App.tsx`. Reverting the PR restores the prior behaviour
(React-only loading state); the data layer, exploration loop, and artifact are
untouched.

## Open questions

- [ ] Should the snapshot loader move to a streaming `fetch` reader for byte
  progress, or is a lighter content-length + coarse phase indicator enough for the
  MVP? (Determines whether UX-002 is byte-accurate or phase-coarse.)
- [ ] Is route/vendor **code-splitting** of the bundle wanted as a follow-up to cut
  the pre-data parse time? (Out of scope here; recorded for a future perf spec.)
- [ ] Where should the loading visual live in the mockups — a new
  `docs/mockups/loading.md`, or extend `empty-error-states.md`?

## Human decisions required

- [x] Authorize building an app loading experience (splash + progress) — requested
  by the owner (nelsonjeanrenaud@gmail.com) on 2026-07-21 ("we need a loading
  screen … with a bar and a nice splash screen").
- [ ] Confirm scope **excludes** shrinking/partitioning the snapshot and skeleton/
  streaming render (this spec makes the existing wait legible only).
- [ ] Approve the byte-accurate vs. phase-coarse progress choice (open question 1).

## Conflict check

Depends on and refines SPEC-003 (it wraps the existing boot/loading flow) and is
bound by the design charter. It changes no other spec's requirements: SPEC-001
(data) and SPEC-004 (basemap) are consumed unchanged, and it does not alter
SPEC-003 REQ-008's data-state surfaces — it precedes and hands off to them. No
overlap or contradiction; `depends_on: [SPEC-003]` recorded in frontmatter.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| UX-001 | Pre-JS splash | `index.html` | E2E | Draft |
| UX-002 | Progress indicator | progress module, `src/app/data/snapshot.ts` | unit + E2E | Draft |
| UX-003 | Boot orchestration | `src/app/App.tsx` | E2E | Draft |
| NFR-001 | Tokens / budget | `index.html`, `src/app/styles/tokens.css` | inspection + CI | Draft |
| SEC-001 | Self-contained splash | `index.html` | inspection | Draft |

## Implementation notes

_(Filled at implementation.)_

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
- [ ] Open questions are resolved or explicitly deferred (3 open; listed).
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed (`depends_on: SPEC-003`).
- [ ] Human approval recorded before status set to Approved (owner authorized the
      work 2026-07-21; scope/scope-exclusion confirmations still open).
