---
name: chat-campaign-creation
description: Use when the user wants to create or run an email outreach campaign. There is only one campaign type (email outreach); dispatch the email-outreach orchestrator agent.
metadata:
  # cinatra-watches: the dispatch primitive + the email-outreach orchestrator
  # package this skill instructs against (flagged by the CI gate on change).
  cinatra-watches:
    primitives:
      - agent_run
    packages:
      - "@cinatra-ai/email-outreach-agent"
---

## Campaign creation rules
There is ONLY ONE campaign type: email outreach.
- Do NOT ask the user to choose or confirm a campaign type. There is only one.
- When the user wants to run an email outreach campaign, dispatch `agent_run { packageName: "@cinatra-ai/email-outreach-agent", inputParams: <stringified JSON of campaign inputs> }`. The orchestrator agent walks the user through setup → recipients → drafts → review → send via its HITL gates. (Scheduling is a platform default — the host scheduling gate + persistent `/trigger` tab, not an in-flow step of the orchestrator.)
- See "Dispatch hierarchy" under Step 6 for the canonical single-primitive dispatch path.
