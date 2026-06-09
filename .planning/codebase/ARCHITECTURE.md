<!-- refreshed: 2026-06-09 -->
# Architecture

**Analysis Date:** 2026-06-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    Cinatra Chat Assistant                            │
│          (system prompt composed from skills at runtime)            │
├──────────────┬──────────────────┬──────────────────────────────────┤
│  Always-on   │  On-demand       │  Internal/System                  │
│  Baseline    │  Task Skills     │  Skills                           │
│  `skills/    │  `skills/        │  `skills/                         │
│  chat-       │  chat-*`         │  chat-hitl-prompt-drive`          │
│  assistant-  │                  │                                   │
│  core`       │                  │                                   │
└──────┬───────┴────────┬─────────┴────────────────┬─────────────────┘
       │                │                           │
       ▼                ▼                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│               Cinatra MCP Tool Surface                               │
│  agent_run, agent_run_get, agent_list, agent_source_*, artifact_*,  │
│  workflow_*, calendar__appointments__add, email_outreach.*, etc.    │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│     WayFlow Runtime / BullMQ / Cinatra Platform Backend             │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| chat-assistant-core | Always-loaded baseline: personality, formatting, tool doctrine, routing rules, credential safety, linking rules | `skills/chat-assistant-core/SKILL.md` |
| chat-agent-dispatch | Canonical `agent_list` + `agent_run` dispatch path for running existing agents | `skills/chat-agent-dispatch/SKILL.md` |
| chat-agent-authoring | OAS Flow 26.1.0 scaffold → validate → compile → publish pipeline for creating new agents | `skills/chat-agent-authoring/SKILL.md` |
| chat-run-polling | Mandatory `agent_run_get` polling discipline after every async `agent_run` | `skills/chat-run-polling/SKILL.md` |
| chat-campaign-creation | Email outreach campaign dispatch via `@cinatra-ai/email-outreach-agent` | `skills/chat-campaign-creation/SKILL.md` |
| chat-workflow-authoring | Proposal-only workflow authoring: discover templates, create/preview drafts, hand off to Gantt | `skills/chat-workflow-authoring/SKILL.md` |
| chat-create-artifact | Semantic artifact creation (ICP, brand voice, blog post, etc.) via `artifact_authoring_emit` | `skills/chat-create-artifact/SKILL.md` |
| chat-appointment-schedules | Persist booking page URLs as campaign CTAs via `calendar__appointments__add` | `skills/chat-appointment-schedules/SKILL.md` |
| chat-hitl-prompt-drive | Internal extraction function: maps a user's chat message to open HITL gate field values | `skills/chat-hitl-prompt-drive/SKILL.md` |
| company-research | Company lookup, enrichment, decision-maker identification, ICP scoring | `skills/company-research/SKILL.md` |
| create-campaign | Legacy step-by-step campaign creation using `email_outreach.campaign.create` | `skills/create-campaign/SKILL.md` |
| create-trigger | Scheduled trigger setup: gather schedule details, build trigger config | `skills/create-trigger/SKILL.md` |
| blog-content | Blog Content surface guidance: projects-pane → ideas-pane → posts-pane → draft-editor selection chain | `skills/blog-content/SKILL.md` |

## Pattern Overview

**Overall:** Skill-based system prompt composition — a modular behavioral specification pattern where a baseline skill is always loaded and task-specific skills are loaded on demand by the assistant itself using `skills_installed_get` or equivalent. There is no runtime code in this repository; the repo is a **pure content package** (SKILL.md files) published to the Cinatra skill registry.

**Key Characteristics:**
- Every skill is a SKILL.md file with YAML frontmatter (`name`, `description`) plus markdown behavioral instructions
- `chat-assistant-core` is the always-loaded baseline; all other skills are loaded on demand
- The assistant reads skill names and descriptions to decide which skill to load for a given user request
- No TypeScript source files exist; the repo is a content-only extension package
- Published as `@cinatra-ai/assistant-skills` to the Cinatra Verdaccio registry and catalogued at workspace level

## Layers

**Baseline Layer:**
- Purpose: Invariant assistant behavior — personality, formatting, tool doctrine, routing, credential safety
- Location: `skills/chat-assistant-core/`
- Contains: Core behavioral rules, response formatting, chart syntax, CMS editing, linking rules, @mention routing, implementation bridging, tool usage doctrine
- Depends on: Nothing (always loaded)
- Used by: Every chat turn

**Task Dispatch Layer:**
- Purpose: Domain-specific routing and tool invocation for each task type
- Location: `skills/chat-agent-dispatch/`, `skills/chat-campaign-creation/`, `skills/chat-workflow-authoring/`, `skills/chat-create-artifact/`, `skills/chat-appointment-schedules/`
- Contains: Tool call sequences, dispatch rules, few-shot examples, error handling
- Depends on: `chat-run-polling` (after any `agent_run`)
- Used by: Loaded on demand when the user's request matches the skill's description

**Authoring Layer:**
- Purpose: Create and publish new Cinatra extensions (agents)
- Location: `skills/chat-agent-authoring/`
- Contains: OAS Flow 26.1.0 schema rules, discovery protocol, scaffold templates, validate/compile/publish pipeline, `agent_creation_review` invocation, orchestrator pattern, speed checklist
- Depends on: `chat-run-polling` (after smoke test `agent_run`), `chat-agent-dispatch` (for running the published agent)
- Used by: Loaded when user says "build me an agent", "create an agent", etc.

**Polling Layer:**
- Purpose: Enforce mandatory poll discipline after every async `agent_run`
- Location: `skills/chat-run-polling/`
- Contains: `agent_run_get` polling rule (up to 3 calls), terminal-status handling, partial-completion reporting
- Depends on: Nothing
- Used by: `chat-agent-dispatch`, `chat-agent-authoring`, any skill that calls `agent_run`

**Internal/System Layer:**
- Purpose: Server-side extraction function for HITL prompt-window drive; not exposed as a user-facing skill
- Location: `skills/chat-hitl-prompt-drive/`
- Contains: Strict input extraction rules (never invent values, type-coerce conservatively, pasted JSON wins)
- Depends on: Nothing
- Used by: Cinatra platform's chat HITL pipeline (not user-invoked)

**Domain Content Skills:**
- Purpose: Domain-specific behavioral scripts for research, campaigns, triggers, and blog content
- Location: `skills/company-research/`, `skills/create-campaign/`, `skills/create-trigger/`, `skills/blog-content/`
- Contains: Step-by-step workflows, output formats, decision rules, app route references
- Depends on: Cinatra MCP tool surface
- Used by: Loaded on demand per task type

## Data Flow

### Primary Chat Turn (task dispatch)

1. User sends message → chat UI routes to Cinatra assistant
2. `chat-assistant-core` is always in the system prompt
3. Assistant reads skill descriptions in its context; if task is recognized, reads the matching SKILL.md
4. Skill instructs which MCP tool(s) to call (e.g., `agent_run { packageName, inputParams }`)
5. Tool call returns `{ runId, status: "queued" }` for async agent runs
6. `chat-run-polling` skill mandates follow-up `agent_run_get` polling (up to 3 calls)
7. Assistant summarizes terminal status to user in markdown; never dumps raw JSON

### Agent Authoring Flow

1. User says "build me an agent" → `chat-agent-authoring` skill loaded
2. Discovery: `agent_source_list` + `agent_list` (local), `extensions_search` (marketplace)
3. User confirms intent → assistant scaffolds three files:
   - `extensions/cinatra-ai/<slug>/cinatra/oas.json` (via `agent_source_write`)
   - `extensions/cinatra-ai/<slug>/package.json` + `skills/<slug>/SKILL.md` (via `agent_source_write_files`)
4. Validate: `agent_source_validate { content }` → must return `valid: true`
5. Review: `agent_creation_review { oasJson, packageJson, packageSlug }` → blockers must be zero before publish
6. Compile: `agent_source_compile { packageSlug }`
7. Publish: `agent_source_publish { packageSlug }` → returns `detailPath`
8. Optional smoke test: `agent_run { packageName }` → poll with `agent_run_get`
9. Confirm + link to `detailPath`; offer marketplace share if new

### HITL Gate Drive (inline chat)

1. Agent run pauses at a HITL gate; chat UI renders the gate inline
2. User types answer in chat prompt window instead of filling the form
3. `chat-hitl-prompt-drive` skill is invoked server-side to extract field values from the message
4. Extracted values are passed to `approveReviewTask` as `values.userResponse`
5. Agent run resumes

**State Management:**
- No client-side state in this repo. All persistent state lives in the Cinatra platform backend (agent runs via BullMQ, workflows, artifacts, campaigns, triggers, etc.). Skills are stateless behavioral documents.

## Key Abstractions

**SKILL.md:**
- Purpose: A behavioral specification document that shapes how the assistant behaves for a specific task
- Examples: `skills/chat-assistant-core/SKILL.md`, `skills/chat-agent-authoring/SKILL.md`
- Pattern: YAML frontmatter with `name` + `description`, followed by markdown instructions

**OAS Flow 26.1.0:**
- Purpose: The canonical agent definition format (Open Agent Specification) used by the Cinatra WayFlow runtime
- Examples: Referenced throughout `skills/chat-agent-authoring/SKILL.md`; actual OAS files live in the monorepo under `extensions/cinatra-ai/<slug>/cinatra/oas.json`
- Pattern: JSON with `agentspec_version`, `component_type: "Flow"`, `$referenced_components` map of StartNode/AgentNode/EndNode/FlowNode/Agent

**agent_run / agent_run_get:**
- Purpose: Single canonical dispatch primitive for all agents (internal and external A2A); async by default
- Examples: Documented in `skills/chat-agent-dispatch/SKILL.md`, `skills/chat-run-polling/SKILL.md`
- Pattern: `agent_run { packageName, inputParams }` → `{ runId, status: "queued" }` → poll `agent_run_get { runId }` until terminal

## Entry Points

**Skill catalog registration:**
- Location: `package.json` (`cinatra.apiVersion: "cinatra.ai/v1"`, `cinatra.kind: "skill"`)
- Triggers: Published via Verdaccio to the Cinatra skill registry; installed at workspace level
- Responsibilities: Makes all skills in `skills/` discoverable by the Cinatra platform

**`chat-assistant-core` (baseline):**
- Location: `skills/chat-assistant-core/SKILL.md`
- Triggers: Every chat turn — this is the always-loaded baseline
- Responsibilities: Personality, formatting, tool doctrine, routing to on-demand skills, credential safety, CMS editing, app page linking

## Architectural Constraints

- **No TypeScript source:** This is a content-only extension. No `src/` directory. All behavior is defined in SKILL.md markdown files. `tsconfig.json` exists as a CI scaffold for the extracted-repo template but there is no `src/` to compile.
- **No runtime code:** The skills are pure text instructions consumed by the Cinatra platform's LLM orchestration layer. No JavaScript/TypeScript executes from this repo at agent run time.
- **Global state:** None in this repo. All mutable state (runs, drafts, artifacts, campaigns) is managed by the Cinatra backend and accessed via MCP tools.
- **Circular imports:** Not applicable (no source files).
- **Skill loading is lazy:** `chat-assistant-core` instructs the assistant to read matching SKILL.md files only when needed ("Do not narrate which skill you are reading. Just read it and act.").
- **Admin-only authoring tools:** `agent_source_write`, `agent_source_compile`, `agent_source_publish` are admin-only. Non-admin users go through `agent_creation_request_propose`.
- **Credential safety enforcement:** Two layers — behavioral (SKILL.md rules) and deterministic (`scanOasForLiteralSecrets` in `agent_source_compile`).

## Anti-Patterns

### Calling retired per-agent function tools

**What happens:** Using `cinatra_<slug>` function tools (e.g., `cinatra_trigger-agent`) instead of `agent_run { packageName: "@cinatra-ai/<slug>" }`.
**Why it's wrong:** Those per-agent function tools are removed. The canonical dispatch surface is `agent_run` for all agents, internal and external.
**Do this instead:** `agent_run { packageName: "@cinatra-ai/trigger-agent", inputParams: "{}" }` (documented in `skills/chat-agent-dispatch/SKILL.md`)

### Not polling after agent_run

**What happens:** Treating `{ runId, status: "queued" }` as a success and reporting to the user.
**Why it's wrong:** The agent may still fail (WayFlow runtime missing, BullMQ worker not dispatched, runtime error). The run is only enqueued, not complete.
**Do this instead:** Follow the polling discipline in `skills/chat-run-polling/SKILL.md` — call `agent_run_get` up to 3 times before reporting.

### Using A2AAgent for internal sub-agent composition

**What happens:** Using `A2AAgent` component in `oas.json` to call another agent on the same Cinatra instance.
**Why it's wrong:** Enforced as a blocker by `OAS-RUNTIME-008`. WayFlow's `AgentExecutionStep` rejects typed outputs on `AgentNode`s wrapping `A2AAgent`, breaking data return.
**Do this instead:** Use `FlowNode` + inline subflow `Flow` pattern (documented in `skills/chat-agent-authoring/SKILL.md` under "Orchestrator pattern").

## Error Handling

**Strategy:** Surface errors verbatim to the user; never paper over failures.

**Patterns:**
- `agent_run` structured rejections (e.g., `WAYFLOW_AGENT_NOT_REGISTERED`) → surface `error` field immediately, do NOT poll
- `agent_run_get` returning `failed` → surface `error` field verbatim ("the smoke run failed: <error>")
- `agent_source_validate` returning `valid: false` → fix and re-validate; never proceed to compile/publish
- `agent_creation_review` returning blockers → stop, surface every blocker with code + message + source; do NOT publish until resolved
- `agent_source_publish` returning `alreadyPublished: true` → bump `packageVersion` in both `oas.json` and `package.json` and republish

## Cross-Cutting Concerns

**Logging:** Not applicable — no runtime code.
**Validation:** Two-layer: behavioral (SKILL.md rules against bad patterns) + deterministic (`agent_source_validate` for OAS schema, `agent_creation_review` lint lanes for policy blockers, `scanOasForLiteralSecrets` for credentials).
**Authentication:** Credential safety enforced by `chat-assistant-core` behavioral rules + `scanOasForLiteralSecrets`/`scanOasForUntrustedUrls`/`scanOasForLlmBridgeWiring` in the compile gate. Credentials managed via Nango at `/settings/connections` only.

---

*Architecture analysis: 2026-06-09*
