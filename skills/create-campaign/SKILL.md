---
name: create-campaign
description: Use when the user wants to create a new outreach campaign, build a cold email sequence, or set up automated email outreach.
metadata:
  # cinatra-watches: the campaign-create primitive base and the canonical
  # email-outreach agent workspace route this skill hands off to (cinatra#188). If
  # that route is renamed the hand-off instruction goes stale.
  cinatra-watches:
    primitives:
      - email_outreach
    routes:
      - /agents/cinatra-agents/email-outreach/new
---

# Create Campaign

## When to use
The user asks to create a campaign, build outreach, set up cold emails, or start a new email sequence.

## Campaign type
There is only one campaign type: email outreach. The `campaignTypeId` is always `campaign-email-outreach`.
Do NOT ask the user to confirm the campaign type. It is implied.

## Step-by-step flow

### Step 1: Campaign name
If the user already provided a name (e.g., "Create an email outreach campaign called Q2 Founders"), use it directly — skip to step 2.
Otherwise ask: "What should we call this campaign?"
Do NOT invent a name without asking.

### Step 2: Create the campaign
Call `email_outreach.campaign.create` ONCE with:
- `campaignTypeId`: `"campaign-email-outreach"`
- `name`: the name from step 1

Do NOT call any other tools before or after this. Do NOT retry if it succeeds.

### Step 3: Hand off to the email outreach agent
After creation, respond with this format (replace {name}):

> Campaign **{name}** created. Continue setup in the email outreach agent workspace below.
>
> /agents/cinatra-agents/email-outreach/new

The URL will be automatically rendered as an embedded interactive section in the chat.
Do NOT wrap the URL in markdown link syntax. Just include the raw path on its own line.
STOP here. Do NOT continue with more questions.

## Canonical entry point
- Email outreach agent workspace: `/agents/cinatra-agents/email-outreach/new`

The agent-builder workspace handles recipients, drafts, review, and send as HITL interrupts — do NOT link to the retired wizard paths (`/campaigns/types/...`, `/campaigns/*`). Those routes are retired and redirect to the agent workspace.

## Important rules
- NEVER invent a campaign name. Always ask first.
- Call `email_outreach.campaign.create` exactly ONCE. Do not retry or call it multiple times.
- After creation, hand off to `/agents/cinatra-agents/email-outreach/new`. Do not try to configure the campaign further in chat.
- Do NOT ask about recipients, sender, follow-ups, or any other configuration in chat — those belong in the agent workspace.
