# Testing Patterns

**Analysis Date:** 2026-06-09

## Repository Nature

This is a **content-only Cinatra skill extension**. The package ships no TypeScript source files and therefore has no unit, integration, or E2E test suite of its own. All runtime testing of the skills is performed inside the Cinatra monorepo, which imports this package as a workspace dependency.

## Test Framework

**Runner:** Not applicable — no standalone test runner is configured.

**Config:** No `jest.config.*`, `vitest.config.*`, or equivalent file is present.

**Run Commands:**
```bash
# CI invokes this, but the step is skipped for this repo (first-party peer detected)
corepack pnpm test --if-present
```

The CI `Test` step (`ci.yml` line 114–123) short-circuits with exit 0 when `first_party=1` (i.e., any `@cinatra-ai/*` optional peer is declared), logging:
> "Skipping standalone tests (host-internal @cinatra-ai/* peers — the cinatra monorepo runs these)."

## Test File Organization

**Location:** No test files exist in this repository.

**Naming:** Not applicable.

## Test Structure

Not applicable. No test suites, describe blocks, or assertion patterns exist in this repo.

## Mocking

Not applicable.

## Fixtures and Factories

Not applicable.

## Coverage

**Requirements:** None enforced standalone — coverage is owned by the Cinatra monorepo.

## Test Types

**Unit Tests:** Not present — skill content (SKILL.md) is prose/YAML; no logic to unit-test.

**Integration Tests:** Handled by the monorepo when it resolves and loads this package.

**E2E Tests:** Not applicable to this repo directly.

## CI Validation Gates (Substitute Quality Checks)

While there are no tests, the CI pipeline (`ci.yml`) enforces several structural quality gates:

**Dependency shape gate** (`.github/workflows/ci.yml` lines 34–69):
- Rejects any `@cinatra-ai/*` or `@cinatra/*` package found in `dependencies`, `devDependencies`, or `optionalDependencies` (exit 2 = hard failure).
- Rejects first-party peers missing `peerDependenciesMeta.<pkg>.optional = true`.

**Pack dry-run** (`ci.yml` line 125–127):
```bash
npm pack --dry-run
```
Validates publish payload shape — checks that all declared files exist and the package is well-formed before any release.

**Typecheck** (`ci.yml` lines 83–112):
- Skipped for this repo (first-party peer detected).
- When active on standalone repos: runs `tsc --noEmit` using project `tsconfig.json`.

**Kind-specific gate** (`ci.yml` lines 129–140, `release.yml`):
- For `kind: skill`, no extra gate is run today (`echo "No kind-specific gate for this extension kind."`).
- Workflow/agent kinds run `extension-kind-gate.mjs` (not applicable here).

## Adding Tests in the Future

If TypeScript sources are added under `src/`, the CI `Test` step will run `pnpm test --if-present` only when there are no first-party `@cinatra-ai/*` peers. Steps to enable testing:

1. Add a test runner (e.g., `vitest`) to `devDependencies` in `package.json`.
2. Add a `"test": "vitest run"` script to `package.json`.
3. Place test files co-located with source files or in a `__tests__/` directory.
4. Remove or reclassify the `@cinatra-ai/*` peer dependency if standalone testing is required.

---

*Testing analysis: 2026-06-09*
