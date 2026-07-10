---
doc_type: spec
spec_id: SPEC-002
title: Technology stack
status: Approved
owner: nelsonjeanrenaud@gmail.com
related_issue:
related_prs: []
affected_components: [app-frontend, map-rendering, styling, data-delivery, ingestion-pipeline, ci-cd, hosting]
affected_interfaces: [static-data-artifacts, cdn-hosting]
supersedes: []
superseded_by:
depends_on: [SPEC-001]
conflicts_with: []
last_verified_at: 2026-07-10
---

# SPEC-002: Technology stack

## Summary

Selects and governs the technologies the atlas is built with: a **static,
client-rendered single-page app** (no runtime backend) written in **TypeScript**
with **React + Vite**, rendering the paleogeographic map with **MapLibre GL JS**,
styled with **CSS Modules + design tokens**, reading **prebuilt, partitioned static
JSON** produced by a **TypeScript/Node ingestion pipeline**, tested with
**Vitest + Playwright + axe**, built in **GitHub Actions**, and served from a
**static CDN (Cloudflare Pages)**. These choices follow directly from
[SPEC-001](SPEC-001-data-architecture.md)'s dated-snapshot / no-live-calls data
architecture. The full comparison analysis, with colour-coded (green/orange/red)
matrices for the difficult choices, lives in
[`../../design/tech-stack.md`](../../design/tech-stack.md); this spec is the
governed, verifiable record of the decisions.

## Context

The repository has an approved product specification, an approved data
architecture (SPEC-001), a binding UI design charter, and no application code yet.
Before implementation can begin, the build stack must be chosen and validated
against the existing constraints: the snapshot data model (SPEC-001 DATA-005), the
performance budgets (PERF-010…060), the map-density/clustering rules
(PERF-090/100/120), the accessibility requirements (PERF-220…270), and the design
charter (single light theme, design tokens, meaning-only status colours). This
spec records those decisions; the design doc records the analysis behind them. No
new product requirements are introduced — requirements live only in the
[functional specification](../../product/functional-specification.md).

## Problem statement

Which concrete languages, frameworks, libraries, tooling, and hosting should the
atlas be built with, such that every choice provably satisfies the already-fixed
product, data, performance, accessibility, and design constraints — without
adding a runtime backend the data architecture does not require?

## Goals

- Choose a build stack that satisfies SPEC-001, the PERF budgets, the accessibility
  requirements, and the design charter, verifiably.
- Prefer **one language (TypeScript)** across app and pipeline so the SPEC-001
  domain model is expressed once.
- Keep the runtime a **static client with no backend**, matching the snapshot data
  model (SPEC-001 DATA-005).
- Make each difficult choice against a documented, colour-coded comparison where
  **red is disqualifying**.
- Use **permissively licensed OSS** only, with no runtime secrets or telemetry.

## Non-goals

- Re-deciding the data architecture or sources (owned by SPEC-001).
- Introducing product/UI requirements (owned by the functional specification) or
  design rules (owned by the design charter).
- Building any application code — this spec only selects and governs the stack.
- Choosing a runtime application server or database (explicitly rejected: the data
  is a prebuilt snapshot).
- Committing to a state-management library, a snapshot storage medium, or a
  paleocoastline vector source — these are recorded as deferred open questions.

## Users or actors

The solo developer/agent building and maintaining the atlas; the CI system
(GitHub Actions) that builds, lints, and tests it; and — indirectly — end users,
who receive a fast static client. No end user interacts with the stack directly.

## Functional requirements

> Each requirement governs one stack decision. The rationale and alternatives are
> in [`../../design/tech-stack.md`](../../design/tech-stack.md); the section
> reference points to the analysis. "Chosen" options are normative; named
> fallbacks are permitted only via a recorded amendment.

### REQ-001: Static client, no runtime backend

- **Statement:** The application must be delivered as a static, client-rendered
  single-page app that loads prebuilt data artifacts; it must not require an
  application server or database at runtime, and must make no runtime calls to
  PBDB/Wikipedia (per SPEC-001 DATA-005).
- **Rationale:** The data is a dated snapshot; a runtime backend is redundant and
  adds cost, ops burden, and a failure mode (design §2).
- **Acceptance criteria:** A production build is a set of static assets + data
  files servable from a CDN with no server process; a network trace of normal use
  shows no runtime egress to upstream sources or a first-party API.
- **Verification method:** inspection of build output + automated network
  assertion in an E2E test.
- **Evidence location:** _to be filled at implementation._

### REQ-002: Language is TypeScript (strict)

- **Statement:** Application and pipeline code must be written in TypeScript with
  `strict` mode enabled; the SPEC-001 domain model must be expressed once and shared
  across app and pipeline.
- **Rationale:** Type-safe shared domain model; eliminates pipeline↔app drift
  (design §6).
- **Acceptance criteria:** `tsconfig` has `strict: true`; the domain types have a
  single definition imported by both app and pipeline; the type-check passes in CI.
- **Verification method:** config inspection + CI type-check job.
- **Evidence location:** _to be filled at implementation._

### REQ-003: UI framework is React + Vite (SPA)

- **Statement:** The UI must be built with React and bundled with Vite as a static
  SPA (no SSR/server runtime).
- **Rationale:** Deepest ecosystem for map/a11y/testing and best maintainability for
  a solo project; bundle cost is within the PERF budget and is dominated by the map
  engine (design §4).
- **Acceptance criteria:** `vite build` produces static assets; there is no server
  runtime; the app boots and renders the exploration view from the static bundle.
- **Verification method:** build inspection + smoke E2E.
- **Evidence location:** _to be filled at implementation._

### REQ-004: Map engine is MapLibre GL JS

- **Statement:** The paleogeographic map must be rendered with MapLibre GL JS,
  using a data-driven style for the bathymetric basemap and a clustered source for
  fossil occurrences.
- **Rationale:** Only candidate strong on clustering, GPU zoom/pan, and data-driven
  styling together, under a permissive (BSD-3) licence; PBDB pre-rotation removes
  the need for a heavier projection engine (design §3).
- **Acceptance criteria:** The map renders a custom (non-street-map) reconstructed
  basemap; occurrences cluster per PERF-090/100/120; zoom/pan feedback meets
  PERF-060 (≤100 ms); no proprietary map SDK or access token is used.
- **Verification method:** manual/inspection against the exploration-view mockup +
  performance check; dependency-licence check.
- **Evidence location:** `docs/assets/mockups/exploration-view.svg` (design reference).

### REQ-005: Styling is CSS Modules + design tokens

- **Statement:** Styling must use CSS Modules with the design charter's tokens
  expressed as CSS custom properties; no CSS-in-JS runtime styling engine may be
  used. Tokens are the single source of the charter's palette/typography values.
- **Rationale:** One-to-one mapping to the charter's token table with zero runtime
  cost; avoids a utility framework's opinions (design §7).
- **Acceptance criteria:** The token table from the design charter exists as CSS
  custom properties; components reference tokens, not hard-coded values; no runtime
  styling library is a dependency.
- **Verification method:** code inspection + dependency check.
- **Evidence location:** `docs/mockups/design-guidelines.md` (token source).

### REQ-006: Client data delivery is partitioned static JSON (with a defined scaling path)

- **Statement:** For the MVP, occurrence and profile data must be delivered as
  prebuilt static JSON partitioned by geological stage/period with precomputed
  clusters, filtered in-memory client-side; no client-side query engine (SQLite/
  DuckDB-wasm) may be shipped for the MVP. PMTiles (geometry) and SQLite-wasm
  (attribute queries) are the recorded scaling paths, adoptable without adding a
  runtime backend.
- **Rationale:** Smallest payload and no engine to ship at MVP data volume; meets
  PERF-030; keeps the static architecture (design §5).
- **Acceptance criteria:** Data loads as partitioned static files; an age/period/
  group filter updates visible occurrences within PERF-030 (≤1 s when data is
  loaded); no wasm query engine appears in the MVP bundle.
- **Verification method:** payload inspection + timed E2E filter interaction.
- **Evidence location:** _to be filled at implementation._

### REQ-007: Ingestion pipeline is TypeScript/Node

- **Statement:** The ingestion/build pipeline (SPEC-001 §9) must be implemented in
  TypeScript/Node, reusing the shared domain model, with clustering via
  `supercluster`.
- **Rationale:** Single language and single domain model across pipeline and app;
  the geo workload is light because PBDB pre-rotates (design §6).
- **Acceptance criteria:** The pipeline runs under Node, imports the shared domain
  types, and writes SPEC-001-shaped dated artifacts.
- **Verification method:** pipeline run over a small fixture + artifact-shape check.
- **Evidence location:** _to be filled at implementation._

### REQ-008: Testing stack is Vitest + Testing Library + Playwright + axe

- **Statement:** Unit/component tests must use Vitest with `@testing-library/react`;
  end-to-end tests must use Playwright and cover the MVP validation scenarios
  (PERF-340…370); automated accessibility checks must use axe
  (`@axe-core/playwright` and/or `jest-axe`).
- **Rationale:** Vite-native fast tests; Playwright drives the required scenarios;
  axe enforces the accessibility requirements (design §8).
- **Acceptance criteria:** CI runs unit/component, E2E, and a11y suites; the four
  PERF-340…370 scenarios exist as E2E tests; a11y checks run on key screens.
- **Verification method:** CI job inspection + test presence check.
- **Evidence location:** _to be filled at implementation._

### REQ-009: Tooling — pnpm, ESLint (+ jsx-a11y), Prettier

- **Statement:** The package manager must be pnpm; linting must use ESLint with
  `eslint-plugin-jsx-a11y`; formatting must use Prettier. A committed lockfile is
  required.
- **Rationale:** Fast, strict dependency management; a11y linting is required
  because keyboard/contrast/not-colour-only are hard requirements (design §8).
- **Acceptance criteria:** `pnpm-lock.yaml` is committed; lint (with jsx-a11y) and
  format checks pass in CI.
- **Verification method:** CI lint/format jobs + repo inspection.
- **Evidence location:** _to be filled at implementation._

### REQ-010: CI/CD is GitHub Actions

- **Statement:** Continuous integration must run in GitHub Actions and must, in
  addition to the existing governance workflow, run type-check, lint, unit/
  component tests, E2E tests, and a11y checks on pull requests.
- **Rationale:** The governance workflow already runs here; keep one CI system
  (design §8).
- **Acceptance criteria:** A workflow runs the above jobs on PRs and fails the PR on
  any failing job.
- **Verification method:** workflow inspection + a green required-checks run.
- **Evidence location:** `.github/workflows/` (to be added at implementation).

### REQ-011: Hosting is a static CDN (Cloudflare Pages)

- **Statement:** The app must be hosted as static assets on a CDN, targeting
  Cloudflare Pages (Netlify/Vercel/GitHub Pages are portable equivalents requiring
  no code change). No always-on server may be provisioned for the runtime.
- **Rationale:** Free-tier global edge, range-request support (useful for the
  PMTiles scaling path), matching the static architecture (design §8).
- **Acceptance criteria:** A deploy serves the app from a CDN with no server
  process; switching CDN provider requires no application code change.
- **Verification method:** deploy inspection.
- **Evidence location:** _to be filled at implementation._

## Non-functional requirements

### NFR-001: Performance budget compatibility

- **Statement:** The chosen stack must be capable of meeting the PERF response-time
  budgets (PERF-010 view ≤5 s, PERF-020 first content ≤3 s, PERF-030 occurrence
  update ≤1 s, PERF-060 map feedback ≤100 ms) with the MVP data volume, and the
  production JavaScript bundle must be measured against a documented budget in CI.
- **Rationale:** The stack must not, by itself, make the PERF budgets unreachable.
- **Acceptance criteria:** A CI bundle-size report exists with a defined budget;
  a performance smoke check demonstrates the budgets are met on the MVP build.
- **Verification method:** CI bundle-size report + performance smoke test.
- **Evidence location:** _to be filled at implementation._

### NFR-002: Accessibility tooling gate

- **Statement:** The stack must include automated accessibility gates (ESLint
  jsx-a11y at lint time, axe at test time) wired into CI so accessibility
  regressions fail the build.
- **Rationale:** Accessibility (PERF-220…270) is a hard MVP requirement and must be
  enforced by tooling, not left to manual review.
- **Acceptance criteria:** Lint fails on jsx-a11y violations; the a11y test suite
  fails the build on axe violations on covered screens.
- **Verification method:** CI job inspection; deliberate-violation smoke test.
- **Evidence location:** _to be filled at implementation._

## Security and privacy considerations

### SEC-001: Permissive-OSS and supply-chain policy

- **Statement:** All runtime dependencies must be permissively licensed OSS
  (MIT/BSD/ISC/Apache-2.0 or compatible); no proprietary map SDK or token-gated
  service may be used at runtime. Dependencies must be pinned via a committed
  lockfile, and CI must run a dependency audit. No secrets or API keys may be
  embedded in the client, and no third-party telemetry/analytics may be shipped at
  MVP.
- **Rationale:** Legal clarity, reproducibility, privacy, and the no-runtime-egress
  guarantee (design §8, §10); the charter forbids fake metrics.
- **Acceptance criteria:** A licence check passes (no copyleft/proprietary runtime
  dep); no secret appears in the client bundle; no analytics/telemetry network
  calls occur at runtime.
- **Verification method:** automated licence + secret scan + network assertion.
- **Evidence location:** _to be filled at implementation._

## Data model impact

None. This spec introduces no new data structures; it selects the technologies
that implement the SPEC-001 data model. The client data-delivery **format**
(partitioned static JSON, REQ-006) is a serialization of the SPEC-001 L2+L3 read
model, not a new model. Artifacts carry the SPEC-001 `retrievedOn` date.

## API impact

No runtime API is introduced (REQ-001). The only interface is the **static data
artifact contract**: prebuilt JSON files, partitioned by geological stage/period,
whose shape derives from the SPEC-001 domain model. Its schema is owned by SPEC-001;
this spec fixes only that it is delivered as static files (REQ-006).

## UI or UX impact

No user-facing behaviour is defined here (that is the functional specification's
and the design charter's role). The stack **enables** the charter: CSS Modules +
tokens (REQ-005) encode the charter's palette/typography; MapLibre (REQ-004)
realizes the exploration-view mockup; the a11y gates (NFR-002) enforce
PERF-220…270. No UX requirement IDs are created.

## Configuration impact

Introduces (at implementation): `tsconfig.json` (strict), `vite` config, ESLint +
Prettier config, `pnpm-lock.yaml`, Vitest/Playwright config, CI workflow additions,
and CDN deploy configuration. A bundle-size budget is recorded in config for NFR-001.
No runtime environment variables or secrets are required by the client.

## Error handling

Stack-level failure modes and responses: a failed CI job (type-check/lint/test/
a11y/licence/bundle-budget) must fail the pull request (REQ-010, NFR-001, NFR-002,
SEC-001). At runtime, load failures of the map or data artifacts surface the
error/retry states already required by the functional specification (FONC-1310…1340,
PERF-280…310); the static architecture ensures no upstream dependency can cause them.

## Edge cases

- **Data volume grows (V1 secondary groups):** in-memory JSON filtering is replaced
  by the recorded scaling path (PMTiles geometry, SQLite-wasm attribute queries)
  with no runtime backend added (REQ-006) — this requires a spec amendment.
- **MapLibre bundle/GPU cost regresses the budget:** Leaflet + markercluster is the
  documented fallback (design §3, §11) — adoptable only via an amendment.
- **Canvas-map accessibility:** an accessible list/panel path to every occurrence
  is required regardless of engine (design §11), keeping keyboard reachability
  (PERF-230/270) independent of the map canvas.

## Acceptance criteria

The spec is satisfied when: the app is a static client with no runtime backend or
upstream egress (REQ-001, SEC-001); it is TypeScript-strict with a single shared
domain model (REQ-002); built with React + Vite (REQ-003); the map is MapLibre GL
JS meeting the clustering and feedback rules (REQ-004); styling is CSS Modules +
tokens with no runtime styling engine (REQ-005); data is partitioned static JSON
meeting PERF-030 (REQ-006); the pipeline is TypeScript/Node (REQ-007); the test,
tooling, CI, and hosting choices are in place with accessibility and performance
gates enforced in CI (REQ-008…011, NFR-001, NFR-002); and all runtime dependencies
are permissive OSS with no client secrets or telemetry (SEC-001).

## Verification matrix

| Requirement ID | Acceptance criterion | Verification method | Test / command / manual check | Evidence location | PR reference |
| -------------- | -------------------- | ------------------- | ----------------------------- | ----------------- | ------------ |
| REQ-001 | Static assets, no runtime egress | automated | build inspection + network assertion (E2E) | _TBD_ | _TBD_ |
| REQ-002 | strict TS, one shared model | automated | type-check job + config check | _TBD_ | _TBD_ |
| REQ-003 | Static SPA boots from bundle | automated | `vite build` + smoke E2E | _TBD_ | _TBD_ |
| REQ-004 | Custom basemap, clustering, ≤100 ms | manual + automated | mockup check + perf check + licence check | exploration-view.svg | _TBD_ |
| REQ-005 | Tokens as CSS vars, no CSS-in-JS | inspection | code + dependency check | design-guidelines.md | _TBD_ |
| REQ-006 | Partitioned JSON, filter ≤1 s, no wasm engine | automated | timed E2E filter + payload check | _TBD_ | _TBD_ |
| REQ-007 | TS pipeline, SPEC-001 artifacts | automated | pipeline run over fixture | _TBD_ | _TBD_ |
| REQ-008 | Unit/E2E/a11y suites; PERF-340…370 | inspection | CI job + test presence | _TBD_ | _TBD_ |
| REQ-009 | pnpm lockfile; lint+format pass | automated | CI lint/format jobs | _TBD_ | _TBD_ |
| REQ-010 | CI runs type/lint/test/e2e/a11y | inspection | workflow inspection + green run | `.github/workflows/` | _TBD_ |
| REQ-011 | CDN static deploy, portable | inspection | deploy inspection | _TBD_ | _TBD_ |
| NFR-001 | Bundle budget + PERF budgets met | automated | CI bundle report + perf smoke | _TBD_ | _TBD_ |
| NFR-002 | a11y gates fail the build | automated | jsx-a11y + axe smoke | _TBD_ | _TBD_ |
| SEC-001 | Permissive OSS, no secrets/telemetry | automated | licence + secret scan + network assertion | _TBD_ | _TBD_ |

## Test plan

At implementation: a type-check and lint/format job (REQ-002, REQ-009); a `vite
build` producing static assets, asserted server-free (REQ-001, REQ-003, REQ-011);
Vitest component tests for the required UI states; Playwright E2E tests for the four
MVP scenarios (PERF-340…370, REQ-008); an E2E network assertion proving no runtime
egress (REQ-001, SEC-001); a timed filter interaction proving PERF-030 (REQ-006); a
pipeline run over a small fixture asserting SPEC-001 artifact shape (REQ-007); axe
a11y checks on key screens (NFR-002); and CI checks for bundle budget (NFR-001) and
dependency licences/secrets (SEC-001). Until application code exists, verification
is by inspection of this spec and the design analysis.

## Rollback plan

No product code is introduced by approving this spec, so there is nothing to roll
back at the code level. If a chosen technology proves unworkable during
implementation, revert via a **Spec Amendment** selecting the documented fallback
(e.g. Leaflet for the map engine, SQLite-wasm for data queries, Netlify/Vercel for
hosting), since the analysis in the design doc already records those paths. The
static-artifact contract (SPEC-001) is unchanged by any such swap.

## Open questions

- [ ] Snapshot storage medium for the dated artifacts (git-LFS vs object storage
  such as Cloudflare R2) — both satisfy SPEC-001 DATA-005/NFR-001. Deferred to
  pipeline build.
- [ ] State-management approach (URL state + React context vs a small store such as
  Zustand/nanostores) — deferred until the component tree exists.
- [ ] Whether/when to adopt Vanilla-Extract for typed tokens (REQ-005 keeps the same
  token model).
- [ ] Paleocoastline vector source for the basemap outlines (ties to SPEC-001's
  open plate-rotation-model question).

## Human decisions required

Approved by the owner (nelsonjeanrenaud@gmail.com) on **2026-07-10** — all
recommended choices confirmed.

- [x] Confirm **static client, no runtime backend** (REQ-001) — approved.
- [x] Confirm **React + Vite** over the SvelteKit runner-up (REQ-003) — approved.
- [x] Confirm **MapLibre GL JS** over the Leaflet fallback (REQ-004) — approved.
- [x] Confirm **TypeScript/Node pipeline** over Python (REQ-007) — approved.
- [x] Confirm **Cloudflare Pages** as the initial hosting target (REQ-011) —
  approved; any static CDN is acceptable.
- [x] Approve overall — SPEC-002 moved from `In Review` to `Approved`.

## Conflict check

Depends on and refines SPEC-001 (data architecture): it selects the technologies
that realize SPEC-001's snapshot model and does not change any SPEC-001 decision.
It introduces no product requirements (those remain in the functional
specification) and no design rules (those remain in the design charter). No overlap
or contradiction with any existing spec; `depends_on: [SPEC-001]` is recorded in
frontmatter.

## Traceability table

| Requirement ID | Design / component | Implementation (file/function) | Test | Status |
| -------------- | ------------------ | ------------------------------ | ---- | ------ |
| REQ-001 | Architecture (design §2) | _TBD_ | _TBD_ | Approved |
| REQ-002 | Language (design §8) | _TBD_ | _TBD_ | Approved |
| REQ-003 | Framework (design §4) | _TBD_ | _TBD_ | Approved |
| REQ-004 | Map engine (design §3) | _TBD_ | _TBD_ | Approved |
| REQ-005 | Styling (design §7) | _TBD_ | _TBD_ | Approved |
| REQ-006 | Data delivery (design §5) | _TBD_ | _TBD_ | Approved |
| REQ-007 | Pipeline (design §6) | _TBD_ | _TBD_ | Approved |
| REQ-008 | Testing (design §8) | _TBD_ | _TBD_ | Approved |
| REQ-009 | Tooling (design §8) | _TBD_ | _TBD_ | Approved |
| REQ-010 | CI/CD (design §8) | _TBD_ | _TBD_ | Approved |
| REQ-011 | Hosting (design §8) | _TBD_ | _TBD_ | Approved |
| NFR-001 | Perf budget (design §1, §10) | _TBD_ | _TBD_ | Approved |
| NFR-002 | A11y gate (design §8) | _TBD_ | _TBD_ | Approved |
| SEC-001 | Supply chain (design §8, §10) | _TBD_ | _TBD_ | Approved |

## Implementation notes

_None yet — no application code exists. The spec is now Approved and meets the
Definition of Ready; implementation may begin against the approved scope._

## Spec amendments

> Required for any behavioral change after approval — including swapping a chosen
> technology for its documented fallback.

_None._

## Review checklist

- [x] spec_id is unique and follows the SPEC-XXX format.
- [x] Every requirement has an ID, statement, rationale, acceptance criteria,
      verification method, and evidence location.
- [x] Non-goals are listed.
- [x] Open questions resolved or explicitly deferred (deferred; listed).
- [x] Verification matrix covers every requirement.
- [x] Conflict check completed (`depends_on: SPEC-001`).
- [x] Human approval recorded before status set to Approved (owner, 2026-07-10).
