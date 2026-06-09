# Codebase Concerns

**Analysis Date:** 2026-06-09

## Tech Debt

**Hero-image regeneration stub in blog-content skill:**
- Issue: The `hero-image` portlet only previews the current `imageArtifactId` — regeneration is explicitly deferred to a future phase with no implementation date.
- Files: `skills/blog-content/SKILL.md` (line 24)
- Impact: Users who ask the assistant to regenerate a blog post hero image will hit a dead end with no supported path.
- Fix approach: Implement the hero-image regen tool/primitive and update the SKILL.md to describe the invocation path once the platform phase ships.

**Hard-coded stale URL in create-campaign skill:**
- Issue: The canonical email outreach agent path is hardcoded as `/agents/cinatra-agents/email-outreach/new` (note: `cinatra-agents` scope, not `cinatra-ai`). The rest of the codebase uses `@cinatra-ai/<slug>` and `/agents/cinatra-ai/<slug>/new` as canonical. If the routing convention migrates (as the retired `/campaigns/*` paths did), this string becomes stale silently.
- Files: `skills/create-campaign/SKILL.md` (lines 33, 41)
- Impact: The embedded interactive panel URL sent to the user would 404 after any route rename.
- Fix approach: Confirm the correct scope segment and align with the authoritative path format used elsewhere (`/agents/cinatra-ai/email-outreach-agent/new`). Add a comment or test anchoring the value.

**Legacy `cinatra_<slug>` function-tool naming retained in lifecycle helpers table:**
- Issue: `skills/chat-agent-authoring/SKILL.md` (lines 320–328) still documents lifecycle helpers using the `cinatra_<slug>` naming convention (e.g. `cinatra_skill-recommender-agent`, `cinatra_reviewer-agent`, `cinatra_trigger-agent`, `cinatra_auditor-agent`) despite the canonical dispatch now using `agent_run { packageName: "@cinatra-ai/<slug>" }` and the `cinatra_<slug>` function tools being explicitly marked retired in both `chat-agent-authoring` and `chat-agent-dispatch`.
- Files: `skills/chat-agent-authoring/SKILL.md` (lines 320–328)
- Impact: An LLM reading Step 8 may attempt to call the retired per-agent function tools rather than `agent_run`, resulting in dispatch failures that require re-routing.
- Fix approach: Replace all `cinatra_<slug>` references in the helpers table with `@cinatra-ai/<slug>` package names and make clear these are dispatched via `agent_run`.

**`package.json` declares no dependencies or peerDependencies:**
- Issue: `package.json` has `"cinatra": { "dependencies": [] }` but no `peerDependencies` block. CI enforces that first-party `@cinatra-ai/*` packages MUST be optional peerDependencies — but this repo declares none. CI classifies it as a "standalone repo" and runs full install + typecheck + test, but `tsconfig.json` targets a non-existent `src/` directory. If any `*.ts` files are ever added without first declaring the correct peer shape, CI gates will produce confusing TS18003 "No inputs found" errors.
- Files: `package.json`, `tsconfig.json`, `.github/workflows/ci.yml`
- Impact: Moderate confusion for contributors adding TypeScript code — the tsconfig is set up for a `src/` tree that doesn't exist.
- Fix approach: Either remove the `tsconfig.json` (content-only extension) or add a `src/` stub; document that this is a content-only skill package.

## Known Bugs

**OAS agent silently drops inputs not listed in `required` or `hidden`:**
- Symptoms: An agent dispatched from chat never prompts the user for an input that has a JSON Schema `default` — the setup loop stalls indefinitely.
- Files: `skills/chat-agent-authoring/SKILL.md` (error table, last entry, lines 415–416)
- Trigger: Any StartNode input that is flow-critical but absent from both `metadata.cinatra.required` and `metadata.cinatra.hidden` when the agent is dispatched with empty `inputParams`.
- Workaround: Every flow-critical input must be explicitly in `cinatra.required` or `cinatra.hidden`. The assistant skill documents this but the runtime does not surface a clear diagnostic — the run just hangs at the setup gate.

**Agent silently unmounts when OAS edited on disk without republishing:**
- Symptoms: `agent_run` returns "agent not found" immediately after a hand-edit of `cinatra/oas.json`.
- Files: `skills/chat-agent-authoring/SKILL.md` (error table, lines 413–414)
- Trigger: Editing the OAS file on disk causes the `.cinatra-published.json` `oasSha256` to drift; WayFlow treats the dir as draft and skips it.
- Workaround: Always republish through `agent_source_publish` (with a version bump). The `backfillPublishedMarkers` routine runs at Cinatra boot but requires a container restart if WayFlow already booted against stale markers.

**`agent_run` polling budget exhaustion silently drops run outcome:**
- Symptoms: If a run takes longer than 3 `agent_run_get` polls, the assistant reports "run still in progress" and the user must manually follow up. There is no push notification or webhook path described in the skills.
- Files: `skills/chat-run-polling/SKILL.md` (lines 11–22)
- Trigger: Any long-running agent (>3 poll cycles within a single chat turn's tool budget).
- Workaround: The skill instructs the assistant to surface the `runId` and offer to recheck, but this relies on the user re-prompting — the experience is fragmented for slow agents.

## Security Considerations

**Credential safety relies entirely on LLM instruction compliance:**
- Risk: The credential-safety rules (never echo a pasted API key, never bake secrets into OAS) are enforced only by the LLM system prompt in `skills/chat-assistant-core/SKILL.md`. The backstop (`scanOasForLiteralSecrets` at compile time) catches secrets baked into OAS — but does NOT prevent the model from echoing a credential pasted in chat before rejecting it.
- Files: `skills/chat-assistant-core/SKILL.md` (lines 174–185)
- Current mitigation: The compile/publish gate (`validateOasAgentJson` → `scanOasForLiteralSecrets`) blocks secrets from being persisted into agent definitions. The SKILL.md instructs the model never to repeat the value.
- Recommendations: Add a server-side redaction pass on chat turn output to catch any model-drift scenario where a secret pasted by the user is echoed back. This is explicitly acknowledged as a gap in the SKILL.md ("even if this rule fails — model drift, jailbreak, future model version").

**Admin-only authoring tools enforced only by delegated-chat tool policy:**
- Risk: The `agent_source_write*`, `agent_source_compile`, `agent_source_publish` tools are admin-only; non-admin access is supposed to be blocked by the delegated-chat tool policy AND the handler admin gate. The chat skill encodes the non-admin proposal flow (`agent_creation_request_propose`) but if either gate is misconfigured, a non-admin could author and publish agents.
- Files: `skills/chat-agent-authoring/SKILL.md` (lines 9–22)
- Current mitigation: Dual-layer enforcement (delegated-chat policy + handler gate). The SKILL.md instructs the LLM not to call these tools for non-admins.
- Recommendations: Audit that the handler admin gate is truly server-enforced and not bypassable by passing admin headers in the MCP request.

## Performance Bottlenecks

**LLM bridge used for deterministic dispatches (documented anti-pattern):**
- Problem: ApiNodes routing through `/api/llm-bridge` for single deterministic tool calls (e.g. trigger persist nodes) incur ~15k token round-trips and 5–30s tail latency at ~$0.015/call.
- Files: `skills/chat-agent-authoring/SKILL.md` (lines 334–342) — the skill explicitly documents the anti-pattern and its fix
- Cause: Historically, all agent API calls routed through the LLM bridge. The passthrough route (`/api/agents/passthrough`) was added later; older authored agents were not migrated.
- Improvement path: Route deterministic-dispatch ApiNodes at `{{CINATRA_BASE_URL}}/api/agents/passthrough`. The allowlist (`ALLOWED_TOOLS` in `src/app/api/agents/passthrough/route.ts` — monorepo path) needs extension for each new deterministic tool.

**Sequential HITL renderer data fetches block panel interactivity:**
- Problem: Custom HITL renderers that `useEffect`-fetch data sequentially delay the panel from becoming interactive.
- Files: `skills/chat-agent-authoring/SKILL.md` (lines 344–350)
- Cause: Sequential `await` chains and client-side over-fetching instead of server-side filtering.
- Improvement path: Use `Promise.all` for independent fetches; push filters to the primitive boundary; prefer batch `WHERE id IN ($ids)` queries over N+1 round-trips.

**`agent_creation_review` wall time 10–30s per authored agent:**
- Problem: The mandatory pre-publish review primitive runs 3 LLM advisory lanes in parallel (security, code, planner) which takes 10–30s even for trivial agents.
- Files: `skills/chat-agent-authoring/SKILL.md` (lines 450–451)
- Cause: LLM inference latency for 3 parallel advisory agents.
- Improvement path: The planner lane is already skipped for trivial OAS (Start→End with at most one step). Extend the skip heuristic to cover more clearly-simple patterns.

## Fragile Areas

**`chat-agent-authoring` SKILL.md is 480 lines — the largest file in the repo:**
- Files: `skills/chat-agent-authoring/SKILL.md`
- Why fragile: As the most complex skill document, any addition risks pushing it past effective LLM context window utilization within a single chat turn when it is loaded alongside the always-loaded `chat-assistant-core` skill. There is no enforcement of size limits.
- Safe modification: Add content to the existing structured sections rather than creating new top-level sections. Prefer linking to `docs/developer/` references rather than inlining full doc content.
- Test coverage: No automated test verifies that the combined skill token budget stays within model limits.

**OAS `$component_ref` resolution is silent on missing keys:**
- Files: `skills/chat-agent-authoring/SKILL.md` (lines 281–288)
- Why fragile: A typo in a `$component_ref` key (e.g. referencing a node not in `$referenced_components`) causes a silent data misroute or runtime failure rather than a compile-time error. The deterministic lint catches some of these but only after `agent_source_validate` is explicitly called.
- Safe modification: Always run `agent_source_validate` after every OAS write, not just before final publish. The skill mandates this but model drift can cause skips.
- Test coverage: The `tunnel-wiring.spec.ts` spec in the monorepo catches llm-bridge wiring issues but does not validate all `$component_ref` resolution paths.

**Release pipeline is dormant pending org infra:**
- Files: `.github/workflows/release.yml`
- Why fragile: The release workflow calls `cinatra-ai/.github/.github/workflows/reusable-extension-release.yml@main` which is documented as dormant until the `cinatra-ai/.github` reusable workflow and `CINATRA_MARKETPLACE_VENDOR_TOKEN` org secret exist. A GitHub Release tag on this repo today would trigger the workflow but fail silently or error on the missing reusable workflow reference.
- Safe modification: Do not create GitHub Releases until the org infra is confirmed live.
- Test coverage: No CI gate confirms the reusable workflow is reachable before release is triggered.

## Scaling Limits

**Skill document loading is unbounded:**
- Current capacity: The `chat-assistant-core` SKILL.md (198 lines) is always-loaded on every turn; additional skills are loaded on demand. With 13 skills in the bundle, a pathological multi-skill turn could load 1,127+ lines of skill content into the context window.
- Limit: No documented maximum. LLM context windows are finite; degraded instruction-following is expected as total loaded skill content grows.
- Scaling path: Introduce a token budget per skill document; enforce it in the manifest; surface a warning in CI when the total bundle exceeds a threshold.

## Dependencies at Risk

**No lockfile committed:**
- Risk: The repo ships no pnpm lockfile. CI installs with `--no-frozen-lockfile`, meaning dependency resolution is non-deterministic across runs.
- Impact: A transitive dependency bump could silently change behavior between CI runs with no diff in the repo.
- Migration plan: Commit a `pnpm-lock.yaml`. For a content-only skill bundle with no runtime deps today this is low-risk, but becomes important if TypeScript sources are added.

## Missing Critical Features

**No automated test for skill document correctness:**
- Problem: There are no tests in this repository. The CI pipeline skips test execution entirely (the repo has no `test` script and is classified as a first-party source mirror, so tests run in the monorepo). However, the monorepo test suite does not appear to validate SKILL.md content correctness (correct frontmatter, no broken tool references, no stale retired-API mentions).
- Blocks: Regressions in skill routing instructions (e.g. accidentally re-introducing a retired `cinatra_<slug>` tool name) are undetected until manual QA or user report.

**Hero-image regeneration capability absent from blog-content skill:**
- Problem: The `hero-image` portlet is display-only; there is no MCP tool or workflow step to regenerate/replace the hero image from the chat assistant.
- Blocks: Users cannot manage blog post hero images through the chat interface.

## Test Coverage Gaps

**No tests of any kind in this repository:**
- What's not tested: All skill routing decisions, frontmatter structure, tool name correctness, and output format rules across all 13 SKILL.md files.
- Files: All files under `skills/*/SKILL.md`
- Risk: Stale tool names, wrong route paths, or broken instructions reach production with no automated gate. The monorepo CI runs the integration tests but does not lint the extracted skill content.
- Priority: High — given that SKILL.md files are the primary behavioral contract consumed by the LLM at runtime, a schema-level lint (frontmatter required fields, no retired tool names, max line count) would catch the most common regressions cheaply.

**No validation that `create-campaign` hardcoded route is reachable:**
- What's not tested: The literal string `/agents/cinatra-agents/email-outreach/new` in `skills/create-campaign/SKILL.md` is never checked against the actual routing table.
- Files: `skills/create-campaign/SKILL.md` (lines 33, 41)
- Risk: Route renames (as happened with `/campaigns/*`) silently break the embedded link without any CI signal.
- Priority: Medium — a simple grep-based test in CI comparing hardcoded route strings against a known-good route manifest would catch this class of regression.

---

*Concerns audit: 2026-06-09*
