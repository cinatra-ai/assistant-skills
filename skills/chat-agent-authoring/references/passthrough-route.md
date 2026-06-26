# Speed Optimization Checklist

Before publishing, audit the OAS for these latency/cost patterns.

## A. Deterministic-dispatch wrapped in `/api/llm-bridge` — the #1 latency killer

Any ApiNode whose `data.system` reads like *"You are the X agent. CRITICAL: Your first and only action is to parse <input> and call <one MCP tool> EXACTLY ONCE"* is paying a ~15k token LLM round-trip for a task with zero reasoning. Trigger-agent's `persist` node was the canonical example before the passthrough route existed: `gpt-5.5, 15,526 input tokens, 5-30s tail, $0.015/call`.

**Fix:** route the ApiNode at `{{CINATRA_BASE_URL}}/api/agents/passthrough` instead of `/api/llm-bridge`. The passthrough route accepts `{ tool, input, agent_run_id }`, resolves the actor via the run row, and dispatches directly to the cinatra MCP primitive handler in-process. Bypass: zero LLM cost, sub-second latency.

Allowlisted tools today: `trigger_config_set`, `objects_save`, `objects_classify`, `objects_update`. Extend `ALLOWED_TOOLS` in `src/app/api/agents/passthrough/route.ts` to add more.

If the LLM step has REAL reasoning work (drafting, planning, classification, generation), keep `/api/llm-bridge`. The smell: if you could write the system prompt as "parse and dispatch" without any meaningful judgment text, it's deterministic — use passthrough.

## B. HITL renderer mount-fetches block the panel

Custom renderers that `useEffect`-fetch data on mount delay the HITL surface. Fix patterns:

- **Sequential awaits.** Don't `await A()` then `await B()` if neither depends on the other. Use `Promise.all([A(), B()])`. Reference fix: `getSkillsForAgentAction` in `packages/agents/src/server-actions.ts`.
- **Fetch-all-then-filter-client-side.** Push filters to the primitive boundary. Extend the primitive's input schema if needed for OR-set semantics.
- **N+1 in server actions.** Use `WHERE id IN ($ids)` instead of N round-trips.

## C. `data.cinatra_llm` required on every llm-bridge node

Every ApiNode whose URL contains `/api/llm-bridge` MUST declare `data.cinatra_llm` (e.g. `{preferredProvider: "openai", preferredModel: "gpt-5"}`). Without it WayFlow runtime fails with `424 Failed Dependency`. The `tunnel-wiring.spec.ts` test catches violations in CI.

## D. Use the smallest WayFlow output shape downstream nodes need

Don't over-declare outputs the EndNode won't consume — extra `outputs[]` entries add to the LLM's response-shape pressure.

## E. Composability before authoring

Re-using lifecycle helpers (`@cinatra-ai/auditor-agent`, `@cinatra-ai/reviewer-agent`, `@cinatra-ai/skill-recommender-agent`, `@cinatra-ai/trigger-agent`) is cheaper than re-implementing — the helpers' performance fixes propagate automatically.
