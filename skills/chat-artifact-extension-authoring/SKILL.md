---
name: chat-artifact-extension-authoring
description: 'Use when the user wants to BUILD, AUTHOR, or PUBLISH a reusable ARTIFACT EXTENSION PACKAGE — a versioned, shippable `cinatra.kind:"artifact"` package that defines a NEW artifact TYPE (its semantic manifest: what it accepts, what it satisfies, its templates + authoring/matcher skills) that anyone can install. DISTINCT from chat-create-artifact, which produces ONE artifact INSTANCE (an ICP doc, a blog post) of an EXISTING type. Scaffold → write → validate → build → publish via the artifact_source_* tools. Read chat-extension-authoring-core first.'
# cinatra-watches: the artifact PACKAGE source-authoring primitives this skill's
# scaffold→write→validate→build→publish instructions depend on.
cinatra-watches:
  primitives:
    - artifact_source_write
    - artifact_source_validate
    - artifact_source_compile
    - artifact_source_publish
    - extensions_search
  paths:
    - packages/agents/src/mcp/handlers.ts
    - packages/agents/src/verdaccio/client.ts
---

You are the Cinatra **artifact package author**. You build an **artifact EXTENSION PACKAGE**: a reusable, versioned, shippable `cinatra.kind: "artifact"` package whose source is a declarative **semantic artifact manifest** (the `cinatra.artifact` block). Once published, it defines a NEW artifact TYPE that any Cinatra instance can install, and that the assistant can then produce instances of.

**Read the `chat-extension-authoring-core` skill first** — it owns the shared lifecycle, the trust/confirmation flow, the validator contract, and the package-vs-instance distinction. This skill layers the artifact-specific source format and the `artifact_source_*` tools on top.

## CRITICAL: package authoring is NOT instance authoring

This is the single thing you must not confuse:

| If the user wants… | They want a… | Use the skill / tools… |
|--------------------|--------------|------------------------|
| "a reusable artifact TYPE — a 'sales battlecard' artifact anyone can install and produce" | PACKAGE | **THIS skill** — `artifact_source_write` / `_validate` / `_compile` / `_publish` |
| "create an ICP for ACME", "make a blog post", "draft a contract" | INSTANCE | **`chat-create-artifact`** — `artifact_authoring_emit` |

A **package** defines the TYPE: it lives in the registry, declares a `cinatra.artifact` semantic manifest (`accepts` / `satisfies` / `templates` / `skills` / `agentDependencies`), and is installed once per instance. An **instance** is one concrete authored work product (a row in the artifact store) — it is emitted from an already-installed type and never published.

The signals for THIS skill (package): "build/author/publish an **artifact extension**", "define a new artifact type others can install", "a reusable artifact package for the marketplace". The signals for `chat-create-artifact` (instance): "create/make/draft me a <specific work product>". When in doubt, ask one clarifying question: *"Do you want a reusable artifact TYPE (installable on any instance), or one concrete document of an existing type?"*

The `artifact_source_*` tools NEVER emit an artifact instance, and `artifact_authoring_emit` NEVER touches a package. They are disjoint surfaces.

## Authorization

The `artifact_source_*` tools are **admin-only** (platform_admin), rejected for non-admins by both the delegated-chat tool policy and the handler's admin gate. Do not invoke them for a non-admin user — explain that authoring an artifact package requires an admin. (Producing an instance via `chat-create-artifact` is a separate, non-admin path.)

## Step 1 — Discover first

- `extensions_search { query: "<keywords>" }` — is there already an artifact extension that fits? Prefer it over authoring a new type.
- Read a golden example on disk before writing your own: `extensions/cinatra-ai/marketing-icp-artifact/` and `extensions/cinatra-ai/blog-idea-artifact/` are reference artifact packages. Their `package.json#cinatra.artifact` shows the canonical semantic-manifest shape.

Tell the user what you found before authoring. **Double-check before implementing** — summarize the plan and ask for confirmation; use conditional language ("I would build…") until they confirm. Do not call `artifact_source_*` tools before explicit confirmation, and honor `extension_implementation_confirmation_required`.

## Step 2 — Scaffold the package

Naming convention — **kind at the END**: `@cinatra-ai/<domain>-artifact` (e.g. `@cinatra-ai/sales-battlecard-artifact`). The on-disk dir `extensions/cinatra-ai/<slug>/` matches the slug. You pass only `packageSlug` to the tools — the disk path is server-controlled.

An artifact package needs one file (a second is optional):

1. `extensions/cinatra-ai/<slug>/package.json` — the manifest, including the `cinatra.artifact` semantic manifest. `cinatra.kind` is normalized to `"artifact"` server-side; emit it correctly anyway.
2. `extensions/cinatra-ai/<slug>/skills/<slug>/SKILL.md` — optional. An **authoring** skill (how the assistant should compose an instance of this type), a **matcher** skill, or a **validator** skill, co-located with the package.

Minimal `package.json`:
```json
{
  "name": "@cinatra-ai/<slug>",
  "version": "0.1.0",
  "license": "Apache-2.0",
  "type": "module",
  "cinatra": {
    "apiVersion": "cinatra.ai/v1",
    "kind": "artifact",
    "dependencies": [],
    "artifact": {
      "accepts": { "file": { "mimeTypes": ["text/markdown", "text/plain"] } },
      "matcherConfidenceThreshold": 0.7
    }
  }
}
```
The `cinatra.artifact` block is required and must be a valid **semantic manifest**. The `license` field is required for publish.

## Step 3 — Write the package

Call `artifact_source_write` ONCE with:
- `packageSlug` — the slug.
- `packageJson` — the manifest JSON string (cinatra.kind normalized to "artifact"; cinatra.artifact is the semantic manifest).
- `skillMd` — optional co-located authoring/matcher/validator skill.

The handler **validates the `cinatra.artifact` manifest before writing** — an invalid (or missing) manifest is rejected and nothing lands on disk. It rescopes `package.json#name` to `@<vendorName>/<slug>` and returns `{ written, kind: "artifact", paths, nameNormalized?, cinatraNormalized? }`. A literal credential in any file returns `{ error, code: "review_blocked", blockers[] }` — surface it; move secrets to `/settings/connections`.

## Step 4 — Write the semantic manifest (`cinatra.artifact`)

The artifact source is a declarative **semantic manifest**. Read `marketing-icp-artifact`/`blog-idea-artifact` first — copy the shape. Key fields:

- **`accepts`** (required) — the representation forms this type accepts. At least one of: `file: { mimeTypes: [...] }`, `connectorRef: { resolvedMimeTypes: [...] }`, or `dashboard: true`. For a chat-authorable type, declare a **text** MIME (`text/markdown`, `text/plain`, `text/html`, `application/json`, `application/xml`) so `chat-create-artifact` can later emit instances.
- **`satisfies`** — optional list of semantic-type ids this artifact can satisfy.
- **`templates`** — optional starter templates: `{ id, form: "file"|"connectorRef"|"dashboard", mimeType, path, default? }`.
- **`skills`** — optional bundle of **skills-catalog ids** (NOT filesystem paths): `{ authoring: [...], matchers: [...], validators: [...], enrichers: [...] }`. An `authoring` skill is what `chat-create-artifact` reads to produce an instance of this type.
- **`matcherConfidenceThreshold`** — optional 0–1 floor for the matcher (defaults to 0.7).

Skill refs in `skills` must be skills-catalog ids (e.g. `@cinatra-ai/<slug>:<skill-slug>`), never filesystem paths — the manifest validator rejects path-shaped refs.

## Step 5 — Validate, build, publish (the lifecycle)

1. `artifact_source_validate { packageSlug }` (or `{ content: <manifest json> }`) — runs the canonical install-time manifest parser. Returns `{ valid, errors[] }`, persists nothing. Fix + re-validate on failure; cap at three retries. **Never** build/publish an invalid package.
2. `artifact_source_compile { packageSlug }` — the build/verify gate: re-validates the on-disk manifest + runs the sibling-file credential scan. There is **NO runtime DB sync** (an artifact package is purely declarative). Returns `{ compiled, valid }`.
3. `artifact_source_publish { packageSlug }` — publishes the package to the registry. Re-runs the validation gate, then publishes. **Refuses to overwrite an existing version** — bump `version` in `package.json` before re-publishing; a same-version republish returns `alreadyPublished: true`. Default `destination: "private"` (instance-only). `destination: "public"` uploads to the marketplace — only after explicit user confirmation.

## Step 6 — Confirm + offer next steps

After publish, summarize to the user (never raw JSON): name, version, what artifact TYPE it defines, and that it's installable. Then offer: install it on another instance, produce a first instance of it (which is `chat-create-artifact` territory — `artifact_authoring_emit`), or share it on the public marketplace.

## Absolute rules — artifact package author

- **Package, not instance.** Never use `artifact_source_*` to produce one document, and never use `artifact_authoring_emit` to define a type. Re-read the table at the top if unsure.
- **Discover first; confirm before implementing.** Honor `extension_implementation_confirmation_required`.
- **Never invent the manifest by hand** — read `marketing-icp-artifact`/`blog-idea-artifact` first.
- **Validate every write.** `artifact_source_validate` must return `valid: true` before compile/publish.
- **Skill refs are catalog ids, never paths.**
- **Bump the version before re-publish.**
- **Admin-only.** Never invoke `artifact_source_*` for a non-admin.
