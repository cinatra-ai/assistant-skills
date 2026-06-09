# Technology Stack

**Analysis Date:** 2026-06-09

## Languages

**Primary:**
- TypeScript — target ES2023, strict mode, ESNext modules. Config at `tsconfig.json`. Source expected under `src/` (compiled to `dist/`).

**Secondary:**
- Markdown — all skill definitions are authored as SKILL.md files under `skills/*/SKILL.md`.

## Runtime

**Environment:**
- Node.js 24 (pinned in CI via `.github/workflows/ci.yml` `node-version: "24"`)

**Package Manager:**
- npm with corepack enabled (CI runs `corepack enable` before any install)
- Lockfile: `.npmrc` present (contents not read). No `package-lock.json` observed at repo root — repo is a source mirror and standalone install is skipped when first-party peers are present.

## Frameworks

**Core:**
- No application framework. This repo is a **Cinatra skill bundle** — a collection of SKILL.md prompt files and TypeScript source (not yet materialized in this extracted mirror). Skills are consumed by the Cinatra chat runtime at workspace level.

**Testing:**
- Not detected in this repo (no `jest.config.*`, `vitest.config.*`, or test files found). Tests live in the Cinatra monorepo when the package is consumed there.

**Build/Dev:**
- TypeScript compiler (`tsc`) — `tsconfig.json` targets `dist/`, emits declarations and source maps.

## Key Dependencies

**Critical:**
- `@cinatra-ai/*` packages — first-party Cinatra SDK packages. Declared as **optional peerDependencies** only (never in `dependencies` or `devDependencies`). The monorepo provides them when this mirror is consumed. Enforced by CI lint step in `.github/workflows/ci.yml`.

**Infrastructure:**
- None declared in `package.json`. Zero external runtime dependencies in this extracted repo.

## Configuration

**Environment:**
- No `.env` files observed. Credentials are managed externally by Nango at `/settings/connections` on the Cinatra platform — not by this repo.
- No required environment variables for the skill bundle itself.

**Build:**
- `tsconfig.json` — standalone TypeScript config (does not extend monorepo config). Targets `ES2023`, module resolution `bundler`, JSX `react-jsx`, strict mode with `noImplicitAny: false`.

## Platform Requirements

**Development:**
- Node.js 24+, corepack
- Part of the Cinatra monorepo workspace for type-checking and testing (standalone install skipped when first-party peers are present)

**Production:**
- Deployed as a registered Cinatra skill bundle. Skills are loaded by the Cinatra chat runtime from the `skills/` directory. The `package.json` `cinatra` manifest declares `apiVersion: cinatra.ai/v1`, `kind: skill`, `dependencies: []`.
- Registry: `https://registry.cinatra.ai` (public Cinatra marketplace) for agent packages; skill bundles are installed at workspace level.

---

*Stack analysis: 2026-06-09*
