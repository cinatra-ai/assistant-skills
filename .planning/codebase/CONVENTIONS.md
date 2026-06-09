# Coding Conventions

**Analysis Date:** 2026-06-09

## Repository Nature

This is a **content-only Cinatra skill extension**. There are no TypeScript source files in `src/` — the package ships exclusively system-prompt skill definitions as SKILL.md files. Conventions therefore apply to SKILL.md authoring, package manifest shape, and CI scripting.

## Skill File (SKILL.md) Conventions

**Front-matter header (required):**
Every `skills/*/SKILL.md` opens with a YAML front-matter block:
```yaml
---
name: <skill-slug>
description: <one-sentence summary of when the skill is loaded>
---
```

- The `name` field matches the directory name exactly (e.g., directory `skills/chat-agent-dispatch/` → `name: chat-agent-dispatch`).
- The `description` field uses imperative "Use when …" phrasing or a gerund list of capabilities.

**Section headings:**
- H2 (`##`) for top-level sections: `## Authorization`, `## Tool usage`, `## Critical rules`.
- H3 (`###`) for sub-sections within a skill: `### Step 1 — …`, `### Case 1 — …`.
- Headings use title-case for the primary noun and sentence-case for the qualifying clause (e.g., `### Step 1 — Always discover first (three tiers)`).

**Directive style:**
- Directives are written in CAPS for emphasis: `NEVER`, `ALWAYS`, `DO NOT`, `MUST`.
- Conditional phrasing uses "would"/"can" before user confirmation; "will"/"am building" only after explicit confirmation.

**Tables:**
- Markdown tables are used for decision matrices (e.g., outcome → action lookup tables).
- Column headers are bold-free plain text; no trailing pipes are omitted.

**Code blocks:**
- Tool call signatures are shown as inline code: `` `agent_run` ``, `` `agent_source_write` ``.
- JSON payloads in examples use inline shorthand: `{ instanceId, postId, instructions }`.
- Chart schema examples are shown in fenced ` ```chart ``` ` blocks.

**Lists:**
- Numbered lists for sequential steps.
- Bullet lists for parallel options, rules, or capability summaries.
- Maximum 3–4 items per "options" list (enforced by the core skill rule: "keep the list short").

**Cross-skill references:**
- Other skills are referenced by display name in backticks followed by "SKILL.md": `` `chat-run-polling` skill ``.
- The core skill (`chat-assistant-core`) instructs the model to "read the matching SKILL.md" — skills are loaded on-demand, not pre-loaded.

## Package Manifest Conventions (`package.json`)

- `"type": "module"` — ESM-first.
- `"cinatra"` top-level key carries the extension manifest:
  ```json
  {
    "apiVersion": "cinatra.ai/v1",
    "kind": "skill",
    "dependencies": []
  }
  ```
- First-party `@cinatra-ai/*` and `@cinatra/*` packages MUST be declared as `peerDependencies` with `peerDependenciesMeta.<pkg>.optional = true`. They MUST NOT appear in `dependencies`, `devDependencies`, or `optionalDependencies`. CI enforces this with exit code 2 on violation.

## TypeScript Configuration (`tsconfig.json`)

The repo ships a standalone `tsconfig.json` (no monorepo `extends`) as a contract requirement for extracted extension repos:
- `target`: ES2023
- `module`: ESNext, `moduleResolution`: bundler
- `strict: true`, `noImplicitAny: false`
- `verbatimModuleSyntax: true`
- `isolatedModules: true`

No TypeScript source files currently exist (`src/` is absent); the config is present as a baseline for future additions.

## Naming Conventions

**Skill directories:**
- Pattern: `<domain>[-<qualifier>]` — kebab-case, always lowercase.
- Chat-scoped skills are prefixed `chat-`: `chat-agent-authoring`, `chat-run-polling`, `chat-workflow-authoring`.
- Domain-only skills have no prefix: `company-research`, `blog-content`, `create-campaign`.

**Files:**
- Skill content files: always `SKILL.md` (UPPERCASE, no variant names).
- CI workflows: `ci.yml`, `release.yml` — lowercase kebab in `.github/workflows/`.
- Package manifest: `package.json` (standard).

## Error Handling (Skill Authoring)

- Tool failures must surface as user-visible explanations — never silent success ("NEVER respond with 'Done.' without a successful tool call").
- If a tool call returns an error, the skill instructs the assistant to name the broken capability, the likely layer, and the smallest next fix.
- Credential errors redirect to `/settings/connections` without echoing the credential value.

## Logging (Skill Authoring)

- No server-side logging conventions (no runtime code).
- The skills instruct the assistant to show tool progress "naturally" and to synthesize results — "never dump raw JSON."

## Comments (CI Scripts)

- `.github/workflows/ci.yml` uses inline shell comments (`#`) to explain skip logic and contract rationale.
- The Node inline script (`node -e '...'`) uses `console.error` for machine-readable CI error messages.

## Security Conventions (Enforced in SKILL.md Rules)

- Credentials must never be placed in tool arguments, OAS header values, body fields, or query params.
- Acceptable placeholders: `{{TOKEN}}`, `${TOKEN}`, `<API_KEY>`.
- A deterministic scan (`scanOasForLiteralSecrets`) is the backstop gate; the skill rule is the first layer.

---

*Convention analysis: 2026-06-09*
