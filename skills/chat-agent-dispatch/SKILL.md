---
name: chat-agent-dispatch
description: Use when the user wants to RUN or DISPATCH an existing Cinatra agent. The single canonical path is agent_list (discover) + agent_run (dispatch) — internal and external A2A agents both reachable through agent_run.
metadata:
  # cinatra-watches: the cinatra surfaces this skill's dispatch instructions depend
  # on. The CI gate flags a cinatra change to any of these so this skill is
  # reviewed before it goes stale. Strings are exact; `paths` are source-path globs
  # matched against the change's touched files (catches a param-shape change to
  # agent_run that leaves the primitive name unchanged).
  cinatra-watches:
    primitives:
      - agent_run
      - agent_list
      - agent_run_get
      - agent_source_list
    paths:
      - packages/agents/src/a2a-actions.ts
      - packages/agents/src/server-actions.ts
      - packages/agents/src/reserved-workspace-slugs.ts
---

When the user wants to RUN an existing agent (not author a new one — that's the `chat-agent-authoring` skill), use the single canonical dispatch path below. After every `agent_run`, follow the `chat-run-polling` skill's mandatory poll discipline.

## Mandatory dispatch trigger

If the latest user message explicitly asks to **use**, **run**, **invoke**, **call**, or **dispatch** an existing agent, OR names an agent package such as `@cinatra-ai/<slug>` **as the target of a run request**, your **first external action MUST be `agent_run`**. (A package name in an availability/installability question — "is `@cinatra-ai/<slug>` installable", "do you have `@cinatra-ai/<slug>`" — is NOT a run request: that is a discovery question; see the discovery carve-out below.)

Rules:
- If the prompt asks to run/use a package by an exact name like `@cinatra-ai/email-test-delivery-agent`, call `agent_run` with `packageName` immediately. Do NOT call `agent_list` first. (If the same name appears in an "is it installable / available" question, treat it as discovery, not dispatch — see below.)
- Do NOT explain what the agent does before dispatching. Do NOT ask for confirmation unless the user is only asking about the agent rather than asking to run it.
- Pass `inputParams` as a JSON string using values already present in the prompt. If no structured input is obvious, pass `"{}"` and let the agent setup/HITL flow collect missing values.
- After `agent_run` returns `{ runId, status: "queued" }`, call `agent_run_get` until the run reaches `completed`, `failed`, `pending_approval`, or `stopped` (see the `chat-run-polling` skill).
- Legacy prompt wording like `cinatra_trigger-agent tool` means the package `@cinatra-ai/trigger-agent`; dispatch with `agent_run`, NOT a retired per-agent function tool (those were removed).
- If the user asks to compare, list, describe, or find agents and does NOT ask to run one, do not dispatch. Use `agent_list` first.
- If the user asks what is AVAILABLE or INSTALLABLE (not which installed agent to run) — "what can I install", "is there a `<X>` agent", "find me a package that…", "is `@cinatra-ai/<slug>` installable" — this is a **discovery** question, not a dispatch one. Read `chat-extension-discovery` and climb the full ladder. Do NOT answer "no such agent exists" from `agent_list` alone: `agent_list` shows only installed/saved agents, not the public registry (`extensions_search`), so an empty `agent_list` is never proof a package does not exist.

Few-shot examples (covering the canonical prompt shapes):

- User: `Use the @cinatra-ai/email-test-delivery-agent agent to send a test email to me@example.com`
  First action: `agent_run({ "packageName": "@cinatra-ai/email-test-delivery-agent", "inputParams": "{\"recipient\":\"me@example.com\"}" })`

- User: `Run @cinatra-ai/skill-recommender-agent so I can confirm which installed skills apply to the next step`
  First action: `agent_run({ "packageName": "@cinatra-ai/skill-recommender-agent", "inputParams": "{}" })`

- User: `Invoke the cinatra_trigger-agent tool to configure an immediate trigger`
  First action: `agent_run({ "packageName": "@cinatra-ai/trigger-agent", "inputParams": "{\"triggerType\":\"immediate\"}" })`

- User: `Which agent can scrape a web page?`
  First action: `agent_list({ "query": "scrape" })` (this is asking ABOUT agents, not asking to run one)

- User: `Is there a blog agent I can install?` / `What can I install?`
  Action: this is an availability/installability question — read `chat-extension-discovery` and climb the discovery ladder (do not stop at `agent_list`; an empty local list is not proof the package does not exist on the public registry).

## Dispatch hierarchy (single canonical path)

- **Pass `packageName`, NOT `templateId`** unless a prior tool result explicitly returned a `templateId` UUID. `agent_run` requires exactly one of the two — passing both errors with `Pass exactly one of templateId or packageName to agent_run.`. Never construct or guess a UUID.
- When dispatching an existing agent (not your own freshly-published one), look up its `packageName` via `agent_source_list` or `agent_list { packageName }` — never derive it from the Verdaccio tarball name. If you only have a Verdaccio-rescoped name like `@<instance-namespace>/<slug>`, the resolver auto-aliases it to `@cinatra-ai/<slug>` for in-repo agents, but the canonical `@cinatra-ai` scope is authoritative.

- **Discover** with `agent_list` (filter by description / package text). Returns every installed agent — local (`sourceType: "internal"`) and remote A2A peers (`sourceType: "external"`) — including the agent-creation toolkit (`@cinatra-ai/planner-agent`, `@cinatra-ai/code-reviewer-agent`, `@cinatra-ai/security-reviewer-agent`, `@cinatra-ai/lint-policy-agent`).
- **Dispatch** with `agent_run { packageName, inputParams: <stringified JSON> }`. ONE primitive — internal vs external is handled server-side by the executor (`packages/agents/src/a2a-actions.ts:182-323`). Returns `{ runId, status: "queued" }`; poll with `agent_run_get` (see the `chat-run-polling` skill).
- When authoring/auditing/reviewing an agent: dispatch one of `@cinatra-ai/{planner-agent, code-reviewer-agent, security-reviewer-agent, lint-policy-agent}` via the same `agent_run` primitive — these meta-agents are user-runnable through the same path as any other agent.
- The retired surfaces (do NOT use): per-agent `cinatra_<slug>` function tools, the `_stage: true` wizard staging mechanic, the `a2a_agents_list` / `a2a_agent_dispatch` shims. All replaced by native MCP injection of the cinatra-mcp server + connected third-party MCP servers (WordPress, Drupal, Apify, etc.) — discoverable in one place.

## Dispatch failure modes — flake vs real

When a chat turn intended to dispatch an agent but the e2e/UAT reports "chat did not invoke an agent_run / cinatra_<slug> tool. Tool events: <empty>" (or you observe a turn that responded conversationally without any `agent_run` call), apply this classification BEFORE chasing it as a bug:

- **B — pre-existing chat-LLM-tool-selection flake (the documented routing-gap, NOT a bug):** Tool events are empty AND the agent IS present in the model-visible inventory with the correct canonical packageName AND no `agent_run` error / unknown-agent / package-not-found / registry-miss / scope-mismatch surfaced. This is the LLM non-deterministically deciding not to call a tool — inherent to model tool-selection, the reason the chat-mcp e2e suite is gated to manual/weekly runs. Do NOT debug agent code or rename scope; re-run the turn or accept as known flake.
- **A — real dispatch defect (FIX REQUIRED):** Any of these signatures means the dispatch path is broken: `agent_run` attempted with a wrong-scope packageName (e.g. `@cinatra/<slug>` against the canonical `@cinatra-ai/` registry), `agent_run` returned unknown-agent/404/package-not-found/registry-miss, `agent_list` advertised a stale packageName, the system prompt's injected agent list still references the old scope, or the dispatch reaches an agent but template/version lookup fails on persisted IDs.
- **C — known deferral:** Dispatch succeeded but the run failed in a documented domain — HITL drive, fixture timeout, agent-specific pre-existing fragility (see fixtures.ts NOTE blocks).

Cheapest decisive probe when triaging: confirm the model-visible `agent_list` returns the agent under the canonical `@cinatra-ai/<slug>` scope. If yes + empty events = B (flake). If the advertised name is stale = A (fix the upstream advertisement source, do NOT widen the dispatch resolver to accept stale names).
