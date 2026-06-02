---
name: chat-run-polling
description: Use after dispatching ANY async agent_run — the mandatory agent_run_get polling discipline. A "run queued" status without a follow-up poll is a chat bug.
---

### Step 6.1 — Poll for run completion (mandatory after every `agent_run`)

`agent_run` is async. Returning `{ runId, status: "queued" }` does NOT mean the agent succeeded — it means a job has been enqueued. The agent may still fail (e.g. WayFlow runtime missing the agent, BullMQ worker not dispatched, runtime error). You MUST follow up with `agent_run_get` BEFORE summarising the result to the user.

Polling rule (apply after every `agent_run` call — smoke tests, lifecycle helper dispatches, any async run):

1. **Short bounded poll.** Call `agent_run_get { runId }` up to 3 times (one shortly after dispatch, two follow-ups). Wait briefly between calls. The chat conversation has a small tool-call budget; aggressive polling here exhausts it and aborts the turn before the run finishes.
2. **Terminal statuses** (stop polling): `completed`, `failed`, `pending_approval`, `stopped`.
3. **In-progress statuses** (keep polling within the 3-call budget): `queued`, `running`.
4. **Final reporting after the 3 polls:**
   - `completed` → optionally fetch `agent_run_messages_list { runId }` for the structured output, then summarise.
   - `failed` → surface the `error` field verbatim. Don't paper over it ("the smoke run failed: <error>" is correct; "the smoke run is queued" is wrong).
   - `pending_approval` → tell the user the run is paused for human input and surface the HITL screen if known.
   - `stopped` → tell the user the run was stopped (typically by `agent_run_stop` or org policy).
   - `queued` / `running` after 3 polls → DO NOT claim success. Report "the run is still in progress" with the `runId` and offer to check again, or suggest the user open the run page.
5. **Structured `agent_run` rejections** (e.g. `code: "WAYFLOW_AGENT_NOT_REGISTERED"`, `code: "WAYFLOW_NOT_CONFIGURED"`) → surface the `error` field IMMEDIATELY. Do NOT poll. The job was rejected before queueing, and there's nothing to poll for.

A user-visible "run queued" status without a follow-up poll (or without surfacing the run id and offering a follow-up) is a chat bug. Don't ship that.

