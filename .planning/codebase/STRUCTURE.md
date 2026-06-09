# Codebase Structure

**Analysis Date:** 2026-06-09

## Directory Layout

```
assistant-skills/               # Repo root — @cinatra-ai/assistant-skills
├── skills/                     # All skill behavioral specifications
│   ├── blog-content/
│   │   └── SKILL.md            # Blog Content dashboard surface (projects→ideas→posts chain)
│   ├── chat-agent-authoring/
│   │   └── SKILL.md            # OAS Flow 26.1.0 agent scaffold → validate → compile → publish
│   ├── chat-agent-dispatch/
│   │   └── SKILL.md            # Canonical agent_list + agent_run dispatch path
│   ├── chat-appointment-schedules/
│   │   └── SKILL.md            # Persist booking URLs as campaign CTAs
│   ├── chat-assistant-core/
│   │   └── SKILL.md            # Always-loaded baseline: personality, formatting, routing
│   ├── chat-campaign-creation/
│   │   └── SKILL.md            # Email outreach campaign dispatch
│   ├── chat-create-artifact/
│   │   └── SKILL.md            # Semantic artifact creation (ICP, brand voice, blog, etc.)
│   ├── chat-hitl-prompt-drive/
│   │   └── SKILL.md            # Internal: HITL gate field extraction from chat messages
│   ├── chat-run-polling/
│   │   └── SKILL.md            # Mandatory agent_run_get polling discipline
│   ├── chat-workflow-authoring/
│   │   └── SKILL.md            # Proposal-only workflow authoring + Gantt hand-off
│   ├── company-research/
│   │   └── SKILL.md            # Company lookup, enrichment, decision-maker identification
│   ├── create-campaign/
│   │   └── SKILL.md            # Step-by-step campaign creation via email_outreach.campaign.create
│   └── create-trigger/
│       └── SKILL.md            # Scheduled trigger setup workflow
├── .github/
│   └── workflows/
│       ├── ci.yml              # GitHub Actions CI: classify, install, typecheck, test, pack dry-run
│       └── release.yml         # Release pipeline
├── .planning/
│   └── codebase/               # GSD codebase map documents (this directory)
├── package.json                # npm manifest: name, version, cinatra.kind="skill", dependencies=[]
├── tsconfig.json               # TypeScript config (scaffold for extracted-repo template; no src/ exists)
├── .npmrc                      # npm/pnpm registry config (existence noted; contents not read)
├── LICENSE                     # Apache-2.0
└── README.md                   # Capability overview for the skill bundle
```

## Directory Purposes

**`skills/`:**
- Purpose: All behavioral skill specifications for the Cinatra chat assistant
- Contains: One subdirectory per skill, each containing exactly one `SKILL.md` file
- Key files: `skills/chat-assistant-core/SKILL.md` (always-loaded baseline)

**`skills/chat-assistant-core/`:**
- Purpose: The always-loaded baseline skill — shapes every chat turn
- Contains: Personality rules, response formatting, chart syntax, capabilities overview, CMS editing rules, critical rules, app-page linking (embed vs markdown link), conversational flow, implementation bridging, explicit agent dispatch, tool usage doctrine, @mention routing, credential safety, pointer to on-demand skills
- Key files: `skills/chat-assistant-core/SKILL.md`

**`skills/chat-agent-authoring/`:**
- Purpose: Full agent authoring pipeline — from "discover first" through publish and marketplace offer
- Contains: Authorization rules (admin vs non-admin proposal flow), three-tier discovery protocol, agent type decision table (`node`/`flow`/`leaf`/`orchestrator`), HITL gate declaration patterns, OAS scaffold templates, orchestrator/FlowNode pattern, cross-cutting OAS rules, validate/compile/publish/smoke-test sequence, `agent_creation_review` usage, error recovery table
- Key files: `skills/chat-agent-authoring/SKILL.md`

**`skills/chat-agent-dispatch/`:**
- Purpose: Dispatch existing agents via `agent_run` (not authoring)
- Contains: Mandatory dispatch trigger rules, few-shot examples, dispatch hierarchy, dispatch failure classification (flake B vs real defect A vs known deferral C)
- Key files: `skills/chat-agent-dispatch/SKILL.md`

**`skills/chat-run-polling/`:**
- Purpose: Enforces mandatory async poll discipline after every `agent_run`
- Contains: 3-call bounded poll rule, terminal status table, structured rejection handling
- Key files: `skills/chat-run-polling/SKILL.md`

**`skills/chat-workflow-authoring/`:**
- Purpose: Calendar-driven workflow proposal and read-only status Q&A
- Contains: Hard boundary (proposal-only), authoring flow (discover → gather → instantiate → validate → hand off), WorkflowSpec JSON shape, read-only status tools
- Key files: `skills/chat-workflow-authoring/SKILL.md`

**`skills/chat-create-artifact/`:**
- Purpose: End-to-end semantic artifact creation (chat authors the content)
- Contains: Intent recognition, `artifact_extension_search` usage, authoring skill loading, `artifact_authoring_emit` call, error reason surface
- Key files: `skills/chat-create-artifact/SKILL.md`

**`skills/chat-hitl-prompt-drive/`:**
- Purpose: Internal server-side extraction function (not user-facing)
- Contains: Strict extraction rules (never invent, conservative type-coerce, pasted JSON wins, approval-only → `{}`)
- Key files: `skills/chat-hitl-prompt-drive/SKILL.md`

**`skills/chat-campaign-creation/`:**
- Purpose: Email outreach campaign dispatch shortcut
- Contains: Single rule — one campaign type, dispatch `@cinatra-ai/email-outreach-agent`
- Key files: `skills/chat-campaign-creation/SKILL.md`

**`skills/chat-appointment-schedules/`:**
- Purpose: Persist booking page URLs for campaign CTAs
- Contains: `calendar__appointments__add` call sequence, CTA field format rules
- Key files: `skills/chat-appointment-schedules/SKILL.md`

**`skills/company-research/`:**
- Purpose: Company research workflow with structured output format
- Contains: 6-step enrichment workflow, decision-maker table format, ICP fit scoring
- Key files: `skills/company-research/SKILL.md`

**`skills/create-campaign/`:**
- Purpose: Step-by-step campaign creation using `email_outreach.campaign.create` primitive
- Contains: Name-then-create-then-handoff flow, `/agents/cinatra-agents/email-outreach/new` handoff
- Key files: `skills/create-campaign/SKILL.md`

**`skills/create-trigger/`:**
- Purpose: Scheduled trigger setup with confirmation before creation
- Contains: 5-step workflow, plan presentation format, "Shall I go ahead?" confirmation gate
- Key files: `skills/create-trigger/SKILL.md`

**`skills/blog-content/`:**
- Purpose: Blog Content dashboard surface guidance (portlet selection chain)
- Contains: 9-portlet selection chain (projects-pane → draft-editor), publish workflow via `workflow_template_instantiate`, blog-content-workflow BPMN
- Key files: `skills/blog-content/SKILL.md`

**`.github/workflows/`:**
- Purpose: CI/CD pipelines for the extracted extension repo
- Contains: `ci.yml` (classify first-party vs standalone → conditional install/typecheck/test → dry-run pack → kind-gates job), `release.yml`
- Key files: `.github/workflows/ci.yml`

## Key File Locations

**Entry Points:**
- `package.json`: npm manifest declaring `cinatra.kind = "skill"` and `cinatra.apiVersion = "cinatra.ai/v1"` — this is how the Cinatra registry identifies and catalogs the skill bundle
- `skills/chat-assistant-core/SKILL.md`: The always-loaded baseline that every chat turn receives

**Configuration:**
- `package.json`: Package metadata, `cinatra` manifest block (`apiVersion`, `kind`, `dependencies`)
- `tsconfig.json`: TypeScript compiler config (scaffold; no `src/` in this repo)
- `.npmrc`: Registry configuration (existence noted; not read)
- `.github/workflows/ci.yml`: CI pipeline logic including first-party peer detection and kind-gate extension point

**Core Logic (Behavioral Specs):**
- `skills/chat-assistant-core/SKILL.md`: Baseline personality, formatting, routing, credential safety
- `skills/chat-agent-authoring/SKILL.md`: Full OAS Flow 26.1.0 authoring pipeline (largest, most complex skill)
- `skills/chat-agent-dispatch/SKILL.md`: Canonical `agent_run` dispatch rules and few-shots
- `skills/chat-run-polling/SKILL.md`: Mandatory polling discipline

**Testing:**
- No test files in this repository. This is a content-only package; the Cinatra monorepo owns integration/e2e testing for skill behavior. CI runs `pnpm test --if-present` but there is no `test` script.

## Naming Conventions

**Files:**
- Skill files: always named exactly `SKILL.md` (uppercase, no variation)
- One `SKILL.md` per skill directory — no additional files inside skill subdirectories

**Directories:**
- Skill directories: kebab-case matching the `name` field in the SKILL.md frontmatter
- Chat-specific skills use the `chat-` prefix: `chat-agent-authoring`, `chat-agent-dispatch`, `chat-run-polling`, etc.
- Domain content skills use topic-first naming: `company-research`, `create-campaign`, `create-trigger`, `blog-content`

**Skill frontmatter:**
- `name`: kebab-case, matches the parent directory name exactly
- `description`: Single sentence used by the assistant to decide when to load the skill

**Package naming (as documented in `chat-agent-authoring`):**
- Extension packages: `@cinatra-ai/<domain>-<capability>-agent` (kind at the end)
- Skill packages: `@cinatra-ai/<domain>-skills`
- WRONG: `@cinatra-ai/agent-<x>` or `@cinatra-ai/skill-<x>` (type-prefix form)

## Where to Add New Code

**New skill (chat assistant behavior):**
- Create: `skills/<skill-name>/SKILL.md`
- Frontmatter: `name: <skill-name>` + `description: <one sentence routing trigger>`
- Register: Add a pointer in `skills/chat-assistant-core/SKILL.md` under "Concern-specific skills" so the baseline knows to load it on demand
- Pattern: Follow the `chat-*` prefix for chat-assistant behaviors; use topic-first naming for domain content skills

**New domain content skill:**
- Implementation: `skills/<topic>/SKILL.md`
- Structure: "When to use" section + "Workflow" section + "Output format" section
- Example reference: `skills/company-research/SKILL.md`

**New chat dispatch/routing skill:**
- Implementation: `skills/chat-<capability>/SKILL.md`
- Structure: Mandatory dispatch trigger + tool call sequence + few-shot examples + failure modes
- Example reference: `skills/chat-agent-dispatch/SKILL.md`

**Utilities:**
- Shared helpers: Not applicable — no source code. Cross-cutting patterns (e.g., polling discipline) are factored into dedicated skills (`chat-run-polling`) that other skills reference by name.

## Special Directories

**`.planning/codebase/`:**
- Purpose: GSD codebase map documents
- Generated: Yes (by `/gsd-map-codebase` command)
- Committed: Typically yes (planning artifacts committed with the repo)

**`.github/workflows/`:**
- Purpose: GitHub Actions CI/CD for the extracted extension repo
- Generated: No (manually maintained + extended by extraction script for kind-specific gates)
- Committed: Yes

---

*Structure analysis: 2026-06-09*
