# Triggers, lifecycle helpers, speed, and marketplace — chat-agent-authoring

Read `../SKILL.md` first. This covers the post-core authoring steps: trigger setup,
lifecycle-helper composition, the speed-optimization checklist, and the marketplace
post-publish share step.

## Step 7 — Trigger setup (if the user wants scheduling)

When the user mentions "every Monday", "tonight at 6", "once a week", "after the demo", etc., you need to configure a trigger. Two paths:

- **Quick path:** call `agent_run_trigger_set` directly with the runId from `agent_run` and a trigger config: `{ type: "scheduled", scheduledAt: "<ISO>", timezone: "<IANA>" }` or `{ type: "recurring", cronExpression: "0 9 * * MON", timezone: "America/Chicago" }`.
- **Interactive path:** wire `cinatra_trigger-agent` as the FIRST node of the workflow. It pauses on a HITL surface that lets the user pick the trigger type, then persists it via `agent_run_trigger_set` automatically.

Use the interactive path whenever the user is unsure or wants to choose; quick path when the schedule is unambiguous in the request.

## Step 8 — Lifecycle helper agents (compose, don't reinvent)

Cinatra ships four reusable lifecycle helper agents. ALWAYS prefer composing one of these over inlining the same behaviour into a new agent:

| Helper | When to compose it |
|--------|---------------------|
| `cinatra_skill-recommender-agent` | Before an LLM-heavy step (drafting, generation), if the parent agent should let the user toggle which installed skills apply. |
| `cinatra_reviewer-agent` | Whenever generated content (drafts, plans, summaries) should be human-approved before downstream use. |
| `cinatra_trigger-agent` | When the agent should fire on a schedule the user picks interactively. |
| `cinatra_auditor-agent` | When you need to apply installed skills to existing data and let a human accept/reject each suggestion. |

Add the helper to `metadata.cinatra.agentDependencies` in `package.json`, list its renderer ID in the orchestrator's `metadata.cinatra.hitlScreens`, and reference it as a sub-agent inside `$referenced_components`.

## Step 8.5 — Speed-optimization checklist

Before publishing, audit the OAS for these patterns. Each is a latency/cost tax with a known fix:

**A. Deterministic-dispatch wrapped in `/api/llm-bridge` is the #1 latency killer.**

Any ApiNode whose `data.system` reads like *"You are the X agent. CRITICAL: Your first and only action is to parse <input> and call <one MCP tool> EXACTLY ONCE"* is paying a ~15k token LLM round-trip (full MCP tool catalog injected on every dispatch) for a task with zero reasoning. Trigger-agent's `persist` node was the canonical example before the passthrough route existed: `gpt-5.5, 15,526 input tokens, 5-30s tail, $0.015/call` for what is structurally `trigger_config_set(args)`.

**Fix:** route the ApiNode at `{{CINATRA_BASE_URL}}/api/agents/passthrough` instead of `/api/llm-bridge`. The passthrough route accepts `{ tool, input, agent_run_id }`, resolves the actor via the run row, and dispatches directly to the cinatra MCP primitive handler in-process. Bypass: zero LLM cost, sub-second latency.

Allowlisted tools today: `trigger_config_set`, `objects_save`, `objects_classify`, `objects_update`. Extend `ALLOWED_TOOLS` in `src/app/api/agents/passthrough/route.ts` to add more deterministic dispatchers.

If the LLM step has REAL reasoning work (drafting, planning, classification, generation), keep `/api/llm-bridge`. The smell: if you could write the system prompt as "parse and dispatch" without any meaningful judgment text, it's deterministic.

**B. HITL renderer mount-fetches block the panel from rendering.**

Custom renderers that `useEffect`-fetch data on mount delay the HITL surface from being interactive. The user sees a spinner where they'd see actionable content. Patterns to fix:

- **Sequential awaits.** Don't `await A()` then `await B()` if neither depends on the other. Wrap in `Promise.all([A(), B()])`. Reference fix: `getSkillsForAgentAction` in `packages/agents/src/server-actions.ts`.
- **Fetch-all-then-filter-client-side.** Push filters to the primitive boundary. If the existing primitive only supports exact-equality filters and you need OR-set semantics, extend the primitive's input schema rather than over-fetching.
- **N+1 in server actions.** A single `JOIN` query beats N round-trips. Look at `WHERE id IN ($ids)` shape.

**C. ApiNode `data.cinatra_llm` is required on every llm-bridge node.**

Every ApiNode whose URL contains `/api/llm-bridge` MUST declare `data.cinatra_llm` (e.g. `{preferredProvider: "openai", preferredModel: "gpt-5"}`) in the source OAS. Without it WayFlow runtime fails with `424 Failed Dependency`. The `tunnel-wiring.spec.ts` test catches violations in CI; do NOT rely on compile-time injection alone.

**D. Use the smallest WayFlow output shape that downstream nodes need.**

Don't over-declare outputs the EndNode won't consume — extra `outputs[]` entries add to the LLM's response-shape pressure. Trim to what the next node + EndNode actually reads.

**E. Composability before authoring.**

Re-using lifecycle helpers (`@cinatra-ai/auditor-agent`, `@cinatra-ai/reviewer-agent`, `@cinatra-ai/skill-recommender-agent`, `@cinatra-ai/trigger-agent`) via A2A is cheaper than re-implementing in a new agent — the helpers' performance fixes propagate automatically.

## Step 10 — Offer to share on the marketplace (only after authoring a NEW agent)

Skip this step entirely when the user's request was satisfied by an existing agent — there's nothing new to share.

After successfully publishing a NEW agent, check whether a very similar agent already lives on the public marketplace:

1. Run a **fresh** `extensions_search { query: "<keywords that describe the agent you just published — not your original request>" }`. This is a SEPARATE call from the Tier 2 search you did during discovery: your initial query reflected what the user asked for; the post-publish query should reflect what you actually built (which may use different terminology). Do NOT skip this and reuse the earlier result — the keywords have shifted, and Step 1 might have been done with a different query before you settled on the final agent's vocabulary. If the search returns a clear near-duplicate (same purpose, similar inputs/outputs), surface it briefly: "I noticed `@<owner>/<slug>` on the marketplace does something similar — heads up." Do **not** auto-publish in that case.
2. If no near-duplicate exists, ask the user:

   > Want to share this agent on the public marketplace at `registry.cinatra.ai`? Publishing **publicly** uploads it to the marketplace so anyone running Cinatra can discover and install it. The default is **private** — the agent stays on this instance only (it isn't sent to the marketplace at all).

3. If the user wants to publish publicly, call `agent_source_publish` with `destination: "public"`. (`agent_source_publish destination: "private"` is the default and just keeps the package on this instance — it does NOT upload to the marketplace.) Bump `packageVersion` in both oas.json and package.json first if you've already shipped the same version, since the registry refuses to overwrite an existing version. Never publish without explicit user confirmation. Do not promise per-recipient invite lists — the registry has no invite mechanism today.

4. If the user declines public sharing, that's fine — the agent stays on this instance. Don't ask again later in the same conversation.

Do NOT run this step for instance-private agents that reference local-only resources (a specific WordPress instance the user has connected, a contact list, etc.) — those can't be meaningfully reused by others. Just confirm + link as in Step 9 and stop.
