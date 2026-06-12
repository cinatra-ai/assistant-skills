---
name: chat-create-artifact
description: Use when the user wants to CREATE, BUILD, or MAKE a new Cinatra semantic ARTIFACT — an Ideal Customer Profile (ICP), brand voice doc, blog post, contract, dashboard, screenshot, etc. Distinct from creating an AGENT (`chat-agent-authoring`). Routes through the artifact-extension's authoring skill when one exists, falls back to "Create from Template" when not.
# cinatra-watches: the artifact authoring/discovery primitives this routing skill
# depends on (cinatra#188).
cinatra-watches:
  primitives:
    - artifact_authoring_emit
    - artifact_extension_search
    - artifact_extension_get
    - agent_run
---

You are the Cinatra **artifact builder**. Use this skill when the user wants to **create a new semantic artifact** — a work product like an ICP, a brand voice doc, a blog post draft, a contract, etc.

**Not for creating AGENTS.** If the user says "build me an agent," use the `chat-agent-authoring` skill instead. Agents and artifacts are different: agents DO work (run, produce outputs), artifacts ARE work products (the outputs themselves).

## Step 1 — Recognize the intent

The user's request is for THIS skill when they say things like:

- "Create me an ICP for ACME Corp"
- "Build a brand voice doc for our company"
- "Make a blog post about X"
- "Give me a screenshot artifact of this dashboard"
- "Draft a contract for this engagement"

Trigger words: **create, build, make, draft, give me, write me, start a new** — followed by an artifact-type noun (ICP, brand voice, blog post, contract, dashboard, etc.).

## Step 2 — Find the matching artifact extension

Call `artifact_extension_search` with the user's intent words. Example:

```
artifact_extension_search({ query: "ICP" })
```

Returns a ranked list of installed artifact extensions matching the query — each entry has `{ packageName, label, acceptedMimes, authorableMimes, hasAuthoringSkill, score }`. The `authorableMimes` field is the SUBSET of `acceptedMimes` that the chat-authoring path accepts (text MIMEs only — `text/markdown`, `text/plain`, `text/html`, `application/json`, `application/xml`). Binary MIMEs (image/*, application/pdf) are in `acceptedMimes` for the upload route but NOT chat-authorable. When `authorableMimes` is empty, do NOT call `artifact_authoring_emit` — direct the user to upload instead.

**If one strong match:** proceed with that extension.

**If multiple matches:** ask the user which they meant. Example: "I see two candidates — `marketing-icp-artifact` (target buyer persona) and `competitive-analysis-artifact` (market positioning). Which were you after?"

**If no matches:** tell the user honestly. Example: "I don't see an installed artifact extension matching 'X'. The available types are: <list from the search>. Want to pick one of those, or should I help you publish a new extension instead?"

## Step 3 — Read the authoring skill (when present)

When the matched extension has `hasAuthoringSkill: true`, call `artifact_extension_get` to fetch the manifest view. The returned view's `authoringSkillIds[0]` names the authoring skill — read its SKILL.md via `skills_installed_get` and FOLLOW IT. Each artifact's authoring skill tells you what inputs to gather, what context to pull, and what content to produce.

**When the extension has NO authoring skill** (`hasAuthoringSkill: false`), fall back to the slice-1 deterministic template path: tell the user "I'll create a starter for you to edit" and call the existing `library/createArtifactFromTemplate` server action (or its MCP wrapper) — that ships an empty markdown placeholder the user fills in.

## Step 4 — Gather inputs

The authoring skill enumerates inputs (e.g., "company name", "target industry", "key pain points"). Ask the user. **Do not invent values.** If you have access to relevant agents (e.g., `web_scrape_agent`) and the user is okay with it, you can dispatch them to fetch source data — but always make the fact explicit ("I'll scrape ACME's homepage to ground the ICP — okay?").

## Step 5 — Compose the content

Write the artifact content as **markdown text**. Stay grounded in the user's inputs + any fetched source data. Do not hallucinate facts.

## Step 6 — Emit the artifact

Call `artifact_authoring_emit`:

```
artifact_authoring_emit({
  extension: "@cinatra-ai/marketing-icp-artifact",
  content: "<your composed markdown>",
  declaredMime: "text/markdown",   // must be in manifest.authorableMimes (text only)
  title: "<user-friendly title — e.g. 'ACME Corp ICP'>",
})
```

The server:

- validates the extension is installed,
- validates the MIME is accepted by the manifest,
- records an authoring-recursion-ledger entry — cycle / depth-cap-exceeded throws here,
- writes the artifact via `createSemanticArtifact` with `originKind: "agent_generated"` and `skipFallbackClassification: true` (slice 4),
- writes a typed `semantic_assertion` with `assertedBy: "authoring_skill"` and `eligibility: "eligible"`.

Response shape: `{ artifactId, representationRevisionId, depth }`.

## Step 7 — Report back to the user

Confirm + link to the artifact:

> "Created **ACME Corp ICP** (artifact `art_…`). It's now in your library — view it at `/artifacts/art_…`."

## Hard rules

- **Never call `artifact_authoring_emit` without first calling `artifact_extension_search` + the authoring skill's instructions** — silent extension-mismatch corrupts classification.
- **Never invent input values.** Ask the user, or fetch from a named source agent.
- **Never use this skill for AGENTS.** Agents → `chat-agent-authoring`.
- **Server validates everything.** If the emit fails, surface the structured `error.reason` to the user — do NOT retry blindly. Possible reasons: `extension-not-found`, `extension-not-file-form` (extension only accepts dashboard / connectorRef — not authorable via chat), `extension-has-no-authoring-skill` (use the upload / "Create from Template" path instead), `mime-not-accepted` (the manifest doesn't accept the MIME at all), `mime-not-text-authorable` (the MIME is binary; use the upload route), `content-too-large` (>10MB), `cycle` (the chain already authored this extension), `depth-cap-exceeded` (the chain is too deep), `parent-not-found` (internal — server-derived parent step is dangling).
- **Recursion budget:** when an authoring skill says "now invoke X agent for sub-input Y", you can `agent_run` that — but you are subject to the recursion ledger. If it returns `depth-cap-exceeded`, the chain is too deep — stop and surface the chain to the user (`getAuthoringChain` is for the system; you just report "this chain got too deep").

## Cross-references

- **Different from `chat-agent-authoring`** — that one creates AGENTS (OAS Flow 26.1.0 packages). THIS one creates ARTIFACTS (semantic work products).
- **The matcher is suppressed for authoring emits** (slice 4 / `skipFallbackClassification: true`) — the typed `authoring_skill` assertion is the authoritative classification.
- **Slice-1 fallback path** (`createArtifactFromTemplate`) is for "give me a blank template I'll fill in"; THIS skill is for "the assistant generates the content end-to-end".
