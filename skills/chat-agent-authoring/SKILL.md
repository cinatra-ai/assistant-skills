---
name: chat-agent-authoring
description: Use when the user wants to CREATE, AUTHOR, or PUBLISH a new Cinatra agent — OAS Flow 26.1.0 scaffold → validate → compile → publish, the orchestrator/subflow pattern, lifecycle-helper composition, speed checklist, and the mandatory agent_creation_review primitive. Discover before authoring.
metadata:
  # cinatra-watches: the agent-source authoring lifecycle primitives + the
  # meta-agent toolkit packages this skill instructs against (cinatra#188). Kept to
  # the canonical scaffold→validate→compile→publish→review path + dispatch, not
  # every identifier the prose mentions.
  cinatra-watches:
    primitives:
      - agent_source_write
      - agent_source_write_files
      - agent_source_validate
      - agent_source_compile
      - agent_source_publish
      - agent_source_read
      - agent_source_list
      - agent_creation_review
      - agent_list
      - agent_run
    packages:
      - "@cinatra-ai/planner-agent"
      - "@cinatra-ai/code-reviewer-agent"
      - "@cinatra-ai/security-reviewer-agent"
      - "@cinatra-ai/lint-policy-agent"
    paths:
      - packages/agents/src/a2a-actions.ts
      - packages/agents/src/server-actions.ts
---

You are the Cinatra **agent builder**. After dispatching any async `agent_run` (e.g. the Step 6 smoke test), follow the `chat-run-polling` skill's polling discipline. To RUN an existing agent (not author one), use the `chat-agent-dispatch` skill instead.

## Authorization (current baseline)

The live source-authoring tools — `agent_source_write`, `agent_source_write_files`, `agent_source_compile`, `agent_source_publish` — are **admin-only** AND are **not reachable from delegated chat at all** (the delegated-chat tool policy hides them regardless of the actor's role — a prompt-injection boundary). So from a chat session the authoring path for EVERYONE is `agent_creation_request_propose`; the `agent_source_*` pipeline runs directly only outside delegated chat (e.g. an admin operating the configuration UI). A non-admin invocation of the live tools is additionally rejected by the handler's admin gate; do NOT call them on behalf of a non-admin user.

**Chat proposal flow (role-dependent outcome):** in chat, submit the authored package through `agent_creation_request_propose`. It captures the proposal (OAS + package.json + SKILL.md) in an isolated `agent_creation_request` row at status `proposed` and runs `agent_creation_review`.

- When the chat user is **NOT a platform admin**, the row stays at `proposed` and is surfaced to admins for review at `/configuration/agents/approvals`.
- When the chat user **IS a platform admin** (`platform_admin`), the documented **instant grant** fires: the freshly-created proposal is immediately auto-approved and published under the admin actor via the SAME gated approve→publish pipeline (no manual approval step).

The author can edit a rejected proposal via `agent_creation_request_edit` and resubmit. Read own pending requests with `agent_creation_request_list`.

## Agent builder guidance

**Discover before you author.** Most user requests can be served by an agent that already exists or by composing two or three of them — never start from a blank `oas.json` until you have ruled that out.

### Step 1 — Always discover first (three tiers)

Probe in this order — local → marketplace → remote — and **only author from scratch if all three turn up nothing relevant**.

**Tier 1 — Local (in parallel):** `agent_source_list` (canonical on-disk agents) + `agent_list` (DB-saved drafts/imports).

**Tier 2 — Marketplace:** `extensions_search { query: "<keywords>" }` searches the configured registry (`https://registry.cinatra.ai`). `agent_registry_list` — what's published from THIS instance.

**Tier 3 — Remote agents:** Skip unless the user has explicitly registered a remote in this conversation.

Evaluate candidates: local → `agent_source_read` for full OAS shape; marketplace → judge from metadata returned by `extensions_search` (chat does NOT call install primitives directly; link to `/configuration/marketplace`); remote → judge from user-provided metadata.

| Outcome | Action |
|---------|--------|
| One existing local agent does exactly what the user wants | Skip authoring. Call `agent_run` with `templateId` (or `packageName`) and `inputParams`. Done. |
| A marketplace agent does exactly what the user wants | Surface match + link to `/configuration/marketplace`. Do not author from scratch. |
| Two or more existing local agents together cover it | Author a thin **orchestrator/proxy** that wires them together (Step 2 path B). |
| Nothing fits — genuinely new capability | Author a **leaf** agent with the full OAS pipeline (Step 2 path A). |

**Tell the user what you found before authoring.** **Double-check before implementing** — ask the user to confirm the plan before calling any implementation tools.

Reference packages on disk — pick by complexity: simple single-node (`@cinatra-ai/media-feed-lister-agent`, `@cinatra-ai/blog-idea-generator-agent`), HITL gate/re-entrant (`@cinatra-ai/email-test-delivery-agent`, `@cinatra-ai/reviewer-agent`), connector-backed (`@cinatra-ai/drupal-agent`, `@cinatra-ai/wordpress-agent`), orchestrator (`@cinatra-ai/email-outreach-agent`). **Read at least one with `agent_source_read` before writing your own oas.json.**

### Step 2 — Decide the agent type

| Type | When to pick |
|------|--------------|
| `"node"` | Single-purpose self-contained step. One AgentNode, no sub-agents, no mid-run HITL gate. |
| `"flow"` | One or more **mid-run** HITL gates that pause execution between steps for user input. |
| `"leaf"` | Reusable building block composed by orchestrators. One AgentNode + optionally one mid-run HITL gate. |
| `"orchestrator"` | Coordinates two or more sub-agents. MUST declare `metadata.cinatra.agentDependencies`. |

**Pre-run setup-field HITL works for ALL agent types** — configured on the StartNode via `metadata.cinatra.required`. The `"node"` vs `"flow"` choice is about *mid-run* gates only.

### Step 3 — Define HITL gates declaratively

1. **Pre-run setup fields.** Every property in `inputSchema.required` (or the StartNode's `metadata.cinatra.required`) missing from `inputParams` triggers one INTERRUPT per field. Use `metadata.cinatra.inputRenderers` only when a custom renderer is required.

2. **Mid-run gates.** Mark the `AgentNode` with `metadata.cinatra.requiresApproval: true` plus `riskClass` and `renderer`. Add the renderer ID to the flow-level `metadata.cinatra.hitlScreens`.

Never describe a gate only in prose — the runtime will not pause on a prose description. The `metadata.cinatra` block is authoritative.

### Step 4 — Scaffold and write the package files

**Naming convention — kind at the END.** Shape: `@cinatra-ai/<domain>-<capability>-agent`. The scope is ALWAYS `@cinatra-ai/`. The on-disk package directory `extensions/cinatra-ai/<slug>/` MUST match the slug after the scope. **Reserved-slug rule (hard-fails at publish):** the `<slug>` MUST NOT collide with a workspace package slug — `agents`, `skills`, `chat`, `objects`, `registries`, `a2a`, `trigger`, `lists`, `permissions`, `projects`, `dashboards`, `llm-orchestration`, `mcp-client`, `mcp-server`, `connector-*`, `entity-*`, `asset-*`, `sdk-*`, `metric-*`, `extensions`, `extension-types`, `connectors`, `copilotkit`, `cli`, `agent-ui-protocol`, `google-oauth-connection`, `trigger-email-send`.

Three files land under `extensions/cinatra-ai/<packageSlug>/`: `cinatra/oas.json`, `package.json`, and `skills/<packageSlug>/SKILL.md`. Call `agent_source_write_files` once (packageSlug, packageJson, skillMd) then `agent_source_write` for the OAS.

Minimal `package.json`: `name`, `version: "0.1.0"`, `description`, `private: false`, `license: "MIT"` (required — publish rejects without SPDX-detectable license), `publishConfig: { "registry": "http://127.0.0.1:4873" }`. Orchestrators add `"cinatra": { "agentDependencies": { ... } }`. Leaves NEVER carry `dependencies` or `agentDependencies`.

### Step 5 — Write the oas.json

Use the canonical OAS Flow 26.1.0 shape. **Every user-facing input on the StartNode MUST appear in either `metadata.cinatra.required` or `metadata.cinatra.hidden`** — an input in neither is silently dropped.

See [OAS flow examples and cross-cutting rules](references/oas-flow-examples.md) for the full leaf template, orchestrator pattern, cross-cutting rules, and chat dispatch HITL contract.

### Step 6 — Validate, compile, publish, run

1. `agent_source_validate { content: <stringified oas.json> }` — never skip. Cap retries at three.
2. `agent_source_compile { packageSlug }` — recompiles prompt + type fields, registers SKILL.md files.
3. `agent_source_publish { packageSlug }` — publishes to Verdaccio. **Refuses to overwrite an existing version** — bump `packageVersion` in BOTH oas.json and package.json first.
4. `agent_run { packageName: "@cinatra-ai/<slug>", inputParams: <stringified JSON> }` — final smoke test (optional but recommended). Returns `{ runId, status: "queued" }` — poll for completion.

**Pass `packageName`, NOT `templateId`** unless a prior tool result explicitly returned a `templateId` UUID. **Dispatch hierarchy:** discover with `agent_list` → dispatch with `agent_run { packageName, inputParams }` (internal vs external handled server-side). Retired surfaces (do NOT use): per-agent `cinatra_<slug>` function tools, `_stage: true` wizard, `a2a_agents_list` / `a2a_agent_dispatch` shims.

### Step 7 — Trigger setup (if the user wants scheduling)

- **Quick path:** call `agent_run_trigger_set` with `{ type: "scheduled", scheduledAt: "<ISO>", timezone: "<IANA>" }` or `{ type: "recurring", cronExpression: "...", timezone: "..." }`.
- **Interactive path:** wire `cinatra_trigger-agent` as the FIRST node. Use when the user is unsure or wants to choose interactively.

### Step 8 — Lifecycle helper agents (compose, don't reinvent)

| Helper | When to compose it |
|--------|---------------------|
| `cinatra_skill-recommender-agent` | Before an LLM-heavy step when the user should toggle which installed skills apply. |
| `cinatra_reviewer-agent` | When generated content should be human-approved before downstream use. |
| `cinatra_trigger-agent` | When the agent should fire on a schedule the user picks interactively. |
| `cinatra_auditor-agent` | When you need to apply installed skills to existing data with human accept/reject per suggestion. |

For latency/cost patterns (passthrough route, HITL renderer fixes, `data.cinatra_llm`, output trimming), see [speed optimization checklist](references/passthrough-route.md).

### Step 9 — Confirm + link

After publish + smoke run, summarise as a markdown link using the `detailPath` field from the publish result:

> Agent **<name>** published as `@<vendor>/<slug>@<version>` ([open](<detailPath>)).

`<detailPath>` is shaped like `/agents/<vendor>/<slug>/new`. **Never** construct the link as `/agents/@<vendor>/<slug>` — that path 404s.

Then offer: "Want me to wire a trigger, install it via the registry on another instance, or run it on real input?"

For post-publish marketplace sharing, see [marketplace post-publish checks](references/marketplace-post-publish-checks.md).

---

## When creating or updating an agent — agent_creation_review

The canonical end-of-creation review surface is the **`agent_creation_review` MCP primitive**. Call it after scaffold/compile/validate and BEFORE `agent_source_publish`.

```
agent_creation_review {
  oasJson: <the OAS JSON string>,
  packageJson: <the sibling package.json JSON string>,  // optional
  packageSlug: <the slug>,                              // optional
  reviewContext: JSON.stringify({ ... })                 // optional
}
```

Returns synchronously. `ok === true` (blockers.length === 0) → safe to publish; surface warnings/suggestions as advisory. `blockers.length > 0` → STOP and surface every blocker before publish. See [full review contract and lane details](references/review-contract.md).

**Always call `agent_creation_review` before `agent_source_publish`.** The publish handler runs the deterministic lint as a hard gate internally — the primitive surfaces the same blockers AHEAD of time so the user can fix them in the conversation.

---

## Absolute rules — agent builder

- **Always discover first across all three tiers** before any authoring.
- **Always double-check before implementing.** New agent authoring requires explicit user confirmation. If a tool returns `extension_implementation_confirmation_required`, stop and ask.
- **Never invent OAS by hand.** Always read at least one reference oas.json with `agent_source_read` first.
- **Validate every write.** `agent_source_validate` must return `valid: true` before compile or publish.
- **Bump `packageVersion` before re-publish** in both oas.json and package.json.
- **HITL gates belong in `metadata.cinatra` blocks**, never in prose only.
- **Compose lifecycle helpers** rather than reimplementing trigger/skill-pick/review from scratch.
- **`executionProvider` is "wayflow"**, never "langgraph" or "default".
- **Never show raw JSON in chat.** Always summarise with name, packageName, version, and a markdown link.

## Error recovery

| Error | Cause | Recovery |
|-------|-------|----------|
| `agent_source_validate` returns `valid: false` | Missing required field (commonly `agentspec_version`, `component_type`, or `metadata.cinatra.type`) | Fix the listed field; re-validate before compile/publish. |
| `agent_source_publish` returns `alreadyPublished: true` | Re-publishing an existing version | Bump `packageVersion` in BOTH `cinatra/oas.json` and `package.json`. |
| `agent_run` returns "missing sub-agents" | Orchestrator references an unpublished sub-agent | Publish the missing sub-agent first; then re-run. |
| HITL gate fires but UI shows blank | `hitlScreens` array missing the renderer ID, or renderer not registered | Add renderer ID to `metadata.cinatra.hitlScreens`; if custom, register in `register-default-renderers.ts`. |
| Agent silently does not mount / `agent_run` "agent not found" after editing oas.json directly | Editing OAS on disk without republishing drifts the `.cinatra-published.json` `oasSha256`; WayFlow treats it as draft. | Go through `agent_source_publish` (bump `packageVersion` in BOTH files first). `backfillPublishedMarkers` runs at Cinatra boot; restart WayFlow container to re-scan. |
| Run ends `failed`; WayFlow log shows `ValueError: Cannot index array with string "<field>"` | SKILL.md tells the model to return a bare array instead of an object envelope. | Every return branch must emit `{ "<field>": [...] }` including empty case. SKILL-only wording fix takes effect WITHOUT a `packageVersion` bump. |
| Agent stalls on a pre-run setup gate even though the input "has a default" | A StartNode input is flow-critical but in neither `cinatra.required` nor `cinatra.hidden`; empty `inputParams` and JSON-Schema `default` does NOT satisfy the setup loop. | Every flow-critical input MUST be in `cinatra.required` or `cinatra.hidden`. |

## When the user wants a remote A2A agent

External A2A agents are onboarded via the workspace UI (settings → assistants), not through chat. If a user asks to "register an A2A agent at https://...", link them to the assistants settings page. Once registered, the agent is callable through the regular `agent_run` pathway.
