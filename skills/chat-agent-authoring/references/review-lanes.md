# agent_creation_review — the four review lanes — chat-agent-authoring

Read `../SKILL.md` first (it covers the call signature, the return shape, how to use the
result, and the mandatory-before-publish rule). This reference is the deeper breakdown of
what the primitive runs and what NOT to do with it.

## What it does

The primitive runs four review lanes:

1. **`agent-lint-policy`** — every deterministic scanner (literal credentials, untrusted URLs, /api/llm-bridge wiring, and the runtime-invariant checks in the OAS-RUNTIME family). THE ONLY lane authorized to emit `severity: "blocker"`. Lint blockers SHORT-CIRCUIT the LLM lanes (no point spending tokens on an OAS that's structurally unfit).
2. **`agent-security-reviewer`** — advisory LLM security review using the system prompt from `extensions/cinatra-ai/security-reviewer-agent/cinatra/oas.json`.
3. **`agent-code-reviewer`** — advisory LLM code-quality review using the system prompt from `extensions/cinatra-ai/code-reviewer-agent/cinatra/oas.json`.
4. **`agent-planner`** — advisory LLM design review (only runs for non-trivial OAS — skipped when the OAS has only a Start→End with at most one executable step).

`normalizeReviewFindings` downgrades any non-policy `blocker` claim to `warning` (the lint lane is the sole authority for blockers; the LLM lanes can suggest issues but can't gate publish).

Lane source identity is re-stamped by the primitive — the LLMs cannot spoof `source: "agent-lint-policy"` to forge blocker authority.

## What NOT to do

- **Do NOT call** the reviewer agents (`@cinatra-ai/lint-policy-agent`, `@cinatra-ai/security-reviewer-agent`, `@cinatra-ai/code-reviewer-agent`, `@cinatra-ai/planner-agent`) individually via `agent_run` for creation-flow reviews. They run independently as agents, but calling them directly bypasses the primitive's source-identity stamping and the shared merge step's blocker-authority enforcement.
- **Do NOT decide blocker authority client-side.** The primitive is the trust boundary. If a finding has `severity: "blocker"` after normalization, it IS a blocker.
- **Do NOT flag the trigger target-run-id divergence.** A standalone `@cinatra-ai/trigger-agent` keys its persist by its OWN run (`cinatra_run_id` → `agent_run_id`); an embedded `trigger-subflow` inside an orchestrator (e.g. `@cinatra-ai/email-outreach-agent`, or any scheduled-watcher orchestrator) targets the **parent/orchestrator** run (the binding field varies — a dedicated `parentRunId` field in some orchestrators, a `cinatra_run_id`→`agent_run_id` mapping in email-outreach). This is the INTENTIONAL contract (a scheduled watcher must re-fire the whole orchestrator, not just its trigger subflow), not an inconsistency. The two copies are deliberately maintained separately because the run-id binding is the one thing that legitimately differs. See `docs/developer/agent-development.md` Rule 15.
