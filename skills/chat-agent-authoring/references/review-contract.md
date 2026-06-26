# agent_creation_review — Full Contract

## How to dispatch

```
agent_creation_review {
  oasJson: <the OAS JSON string of the agent you just authored>,
  packageJson: <the sibling package.json JSON string>,           // optional
  packageSlug: <the slug>,                                       // optional, for labelling
  reviewContext: JSON.stringify({ /* arbitrary chat context */ }) // optional
}
```

Returns synchronously — NO polling, NO BullMQ queue. Runs the 4 review lanes in-process and returns a single bucketed JSON shape:

```ts
{
  ok: boolean,                   // shorthand for blockers.length === 0
  blockers: ReviewFinding[],     // policy blockers — must surface, must block publish
  warnings: ReviewFinding[],     // advisory + downgraded LLM "blockers"
  suggestions: ReviewFinding[],  // advisory suggestions
  findings: ReviewFinding[],     // canonical full list (lint, security, code, planner order)
  ranAdvisoryAgents: string[]    // which LLM lanes ran (planner skipped for trivial OAS)
}
```

Typical wall time: ~10-30s (LLM lanes run in parallel; lint is sub-millisecond).

## What the four lanes do

1. **`agent-lint-policy`** — every deterministic scanner (literal credentials, untrusted URLs, /api/llm-bridge wiring, runtime invariants `OAS-RUNTIME-001`…`OAS-RUNTIME-008`). THE ONLY lane authorized to emit `severity: "blocker"`. Lint blockers SHORT-CIRCUIT the LLM lanes.
2. **`agent-security-reviewer`** — advisory LLM security review using the system prompt from `extensions/cinatra-ai/security-reviewer-agent/cinatra/oas.json`.
3. **`agent-code-reviewer`** — advisory LLM code-quality review using the system prompt from `extensions/cinatra-ai/code-reviewer-agent/cinatra/oas.json`.
4. **`agent-planner`** — advisory LLM design review (only runs for non-trivial OAS — skipped when the OAS has only a Start→End with at most one executable step).

`normalizeReviewFindings` downgrades any non-policy `blocker` claim to `warning` (the lint lane is the sole authority for blockers). Lane source identity is re-stamped by the primitive — the LLMs cannot spoof `source: "agent-lint-policy"` to forge blocker authority.

## How to use the result

- **`ok === true`** (blockers.length === 0) → safe to call `agent_source_publish`. Surface any `warnings` or `suggestions` as advisory feedback.
- **`blockers.length > 0`** → STOP. Surface every blocker to the user with code + message + source. Do NOT call `agent_source_publish` until blockers are resolved.

## What NOT to do

- **Do NOT call** the reviewer agents (`@cinatra-ai/lint-policy-agent`, `@cinatra-ai/security-reviewer-agent`, `@cinatra-ai/code-reviewer-agent`, `@cinatra-ai/planner-agent`) individually via `agent_run` for creation-flow reviews. Calling them directly bypasses the primitive's source-identity stamping and the shared merge step's blocker-authority enforcement.
- **Do NOT decide blocker authority client-side.** The primitive is the trust boundary. If a finding has `severity: "blocker"` after normalization, it IS a blocker.
- **Do NOT flag the trigger target-run-id divergence.** A standalone `@cinatra-ai/trigger-agent` keys its persist by its OWN run; an embedded `trigger-subflow` inside an orchestrator targets the **parent/orchestrator** run. This is the INTENTIONAL contract — the two copies are deliberately maintained separately because the run-id binding is the one thing that legitimately differs. See `docs/developer/agent-development.md` Rule 15 in the cinatra monorepo.

## Architecture reference

Full review architecture, `ReviewFinding` contract, and blocker-authority enforcement: `docs/references/platform/chat-agent-authoring-review.md` in the cinatra docs repo.
