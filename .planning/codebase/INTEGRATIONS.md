# External Integrations

**Analysis Date:** 2026-06-09

## APIs & External Services

**Cinatra MCP (Model Context Protocol) server:**
- The chat runtime injects a set of MCP tools into the assistant's tool context. All platform operations (agent dispatch, workflow management, email outreach, CMS editing) are performed via these tools — not via direct HTTP calls from this repo.
- Key tool namespaces surfaced in skill definitions:
  - `agent_run`, `agent_run_get`, `agent_run_stop`, `agent_run_messages_list` — async agent dispatch and polling (`skills/chat-run-polling/SKILL.md`, `skills/chat-agent-dispatch/SKILL.md`)
  - `agent_list`, `agent_source_list`, `agent_source_read`, `agent_source_write`, `agent_source_write_files`, `agent_source_compile`, `agent_source_publish`, `agent_source_validate`, `agent_source_review` — agent authoring pipeline (`skills/chat-agent-authoring/SKILL.md`)
  - `agent_registry_list`, `agent_registry_publish` — Cinatra public registry (`skills/chat-agent-authoring/SKILL.md`)
  - `extensions_search` — marketplace search against `https://registry.cinatra.ai` (`skills/chat-agent-authoring/SKILL.md`)
  - `workflow_template_list`, `workflow_template_instantiate`, `workflow_draft_create`, `workflow_draft_update`, `workflow_draft_get`, `workflow_draft_list`, `workflow_validate`, `workflow_preview`, `workflow_copy`, `workflow_save_as_template`, `workflow_status_get`, `workflow_status_list` — workflow authoring (`skills/chat-workflow-authoring/SKILL.md`)
  - `email_outreach.campaign.create` — campaign creation (`skills/create-campaign/SKILL.md`)
  - `agent_creation_request_propose`, `agent_creation_request_edit`, `agent_creation_request_list` — non-admin agent proposal flow (`skills/chat-agent-authoring/SKILL.md`)

**Cinatra Public Marketplace Registry:**
- URL: `https://registry.cinatra.ai`
- Purpose: Search and install agent packages; `extensions_search` queries this registry
- Auth: Instance-level connectivity; marketplace install is an admin operation at `/configuration/marketplace`

**Cinatra Documentation:**
- URL: `https://docs.cinatra.ai/references/platform/chat-agent-authoring-review/`
- Purpose: OAS security scan doctrine reference cited in `skills/chat-assistant-core/SKILL.md`

## Data Storage

**Databases:**
- Not applicable — this repo contains no database access code. The Cinatra platform backend (monorepo) owns all persistence. The assistant reads/writes objects (accounts, contacts, campaigns, workflows, agents) exclusively through MCP tools.

**File Storage:**
- Not applicable

**Caching:**
- Not applicable

## Authentication & Identity

**Auth Provider:**
- Nango — OAuth / token credential management for all third-party connections.
  - Surface: `/settings/connections` on the Cinatra platform UI.
  - The assistant explicitly refuses to accept credentials pasted into chat and redirects users to Nango (`skills/chat-assistant-core/SKILL.md`, Credential safety section).

**Platform-level access control:**
- Admin vs non-admin gate on agent source-authoring tools (`agent_source_write`, `agent_source_compile`, `agent_source_publish`). Non-admins are redirected to the `agent_creation_request_propose` flow. Enforced by the delegated-chat tool policy and handler admin gate (`skills/chat-agent-authoring/SKILL.md`).

## CMS Connectors

**WordPress:**
- Tools: `wordpress_instances_list`, `wordpress_posts_list`, `wordpress_content_editor_run`, `wordpress_draft`, `wordpress_admin`, `wordpress_start`
- Auth: Managed via Nango connections
- Usage: Edit posts and nodes via prose instructions; state changes (publish/draft) use direct primitives (`skills/chat-assistant-core/SKILL.md`)

**Drupal:**
- Tools: `drupal_instances_list`, `drupal_content_editor_run`, `drupal_node_publish`
- Auth: Managed via Nango connections
- Usage: Edit nodes via prose instructions; publish via direct primitive (`skills/chat-assistant-core/SKILL.md`)

## LLM Bridge

**LLM providers (OpenAI and others):**
- Referenced via the `cinatra_llm` OAS field (`preferredProvider`, `preferredModel`) on ApiNodes that target `/api/llm-bridge`.
- Example value cited: `{preferredProvider: "openai", preferredModel: "gpt-5"}` (`skills/chat-agent-authoring/SKILL.md`).
- The platform runtime resolves the actual API key — never the assistant or the OAS payload.
- OAS compile gate (`scanOasForLiteralSecrets`) rejects any literal API key baked into agent source.

## Monitoring & Observability

**Error Tracking:**
- Not detected in this repo.

**Logs:**
- Not applicable — skill bundle contains only prompt/instruction files and TypeScript source stubs.

## CI/CD & Deployment

**Hosting:**
- Cinatra platform (workspace-level skill registry). Skills in `skills/*/SKILL.md` are registered at workspace level and made available to all workspace members.

**CI Pipeline:**
- GitHub Actions — `.github/workflows/ci.yml`
  - Trigger: push and pull_request to `main`
  - Node 24 + corepack
  - Validates first-party dependency shape (no `@cinatra-ai/*` or `@cinatra/*` in direct deps — must be optional peerDependencies only)
  - Runs install, typecheck, and tests only for truly standalone repos (zero first-party peers); skips for source mirrors
  - Extension kind gate: runs `extension-kind-gate.mjs` for `workflow` and `agent` kind checks (zero-dependency plain Node script)

## Webhooks & Callbacks

**Incoming:**
- Not applicable — no HTTP server in this repo.

**Outgoing:**
- Not applicable directly. The Cinatra platform backend handles outgoing webhooks for agent run events, workflow state changes, etc. The assistant triggers these indirectly via MCP tools.

## Environment Configuration

**Required env vars:**
- None for this repo itself. All secrets (API keys, OAuth tokens, third-party service credentials) are stored in Nango via the Cinatra platform and injected into agent runs by the WayFlow runtime — not by this skill bundle.

**Secrets location:**
- `.npmrc` present (existence noted; contents not read — may contain registry auth token).
- All other credentials managed on-platform via Nango at `/settings/connections`.

---

*Integration audit: 2026-06-09*
