# Contributing

This is a solo personal project using a **specification-first, AI-agent-led**
workflow. Contributions (human or agent) follow the same lightweight process.

## The process in short

1. **Intent** — describe what you want (issue, PR comment, or chat).
2. **Spec** — an agent writes a verifiable spec from
   [`docs/specs/SPEC_TEMPLATE.md`](docs/specs/SPEC_TEMPLATE.md) into
   `docs/specs/active/`.
3. **Approval** — you review and approve. Implementation does not start before
   approval (see [Definition of Ready](docs/workflow/DEFINITION_OF_READY.md)).
4. **Implement** — the agent implements only the approved scope.
5. **Verify** — governance scripts and tests run; evidence is recorded.
6. **PR** — opened with the [PR template](.github/PULL_REQUEST_TEMPLATE.md),
   linking the spec and requirement IDs (see
   [Definition of Done](docs/workflow/DEFINITION_OF_DONE.md)).

## Rules that matter

- Requirements live **only** in specs — never in READMEs, reports, or code
  comments. See [Documentation Authority](docs/workflow/DOCUMENTATION_AUTHORITY.md).
- Keep changes minimal and scoped. No opportunistic refactors.
- Do not suppress failing tests or hide failed commands.
- Approved specs need a **Spec Amendments** entry for any behavioral change.
- If two authoritative documents conflict, stop and ask — do not guess.

## Running the governance checks locally

```
python scripts/validate_governance.py
python scripts/validate_specs.py
python scripts/validate_drift.py
```

These are standard-library Python (3.x), no dependencies.

## Build and test commands

The data layer (SPEC-001) is TypeScript on Node ≥20, managed with pnpm and
tested with Vitest. CI runs these in `.github/workflows/ci.yml` (separate from
the governance workflow):

```
pnpm install         # install dev dependencies (committed lockfile)
pnpm run typecheck   # tsc --noEmit (strict)
pnpm test            # vitest run — the SPEC-001 verification suite
pnpm run snapshot    # build the dated snapshot artifact from the fixture subset
```

The UI stack (React + Vite + MapLibre, SPEC-002) is not built yet; its commands
will be added here when that increment lands.
