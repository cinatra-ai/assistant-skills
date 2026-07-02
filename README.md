# Cinatra Assistant Skills

The conversational skill bundle that powers the Cinatra chat assistant. It shapes how the assistant talks, recognizes what you are trying to do, and routes your message to the right place — answering directly, dispatching an agent, opening an authoring flow, or guiding you through a multi-step setup.

No credentials are required. Register the bundle from admin → Settings → Skills. WordPress and Drupal connectors are configured separately per instance.

**Example:** Ask "Research ACME Corp and find the VP of Engineering." The skill enriches contacts and returns a decision-maker table with ICP-fit scores. Missing agents are named with a marketplace link; credential errors surface as a named reason, not a silent empty result.

**Development:** `skills/<slug>/SKILL.md` is enough here. The host derives `@cinatra-ai/chat:<slug>` from the directory; no `cinatra.capabilities` map to edit. Validate with `node extension-kind-gate.mjs` before publishing.

**Troubleshooting:** If the assistant ignores a skill, confirm the bundle is installed and `skills/<slug>/SKILL.md` exists. Its ID is `@cinatra-ai/chat:<slug>`; no capabilities map to check. For stalled runs, check the run ID with `agent_run_get`.

## Works with

- Cinatra chat assistant (workspace-level skill registration)
- Cinatra agent runtime (`agent_run`, `agent_list`, `agent_run_get`)
- Cinatra workflow engine (draft, validate, instantiate, Gantt handoff)
- Cinatra artifact system (`artifact_authoring_emit`, extension search)
- WordPress and Drupal connectors (CMS content editing via `agent_run`)

## Capabilities

- Maintain consistent tone, formatting, and personality across every chat reply
- Recognize and route campaign, research, trigger, agent, workflow, and artifact requests
- Run, dispatch, or invoke an existing Cinatra agent from a plain-language request
- Guide you through authoring and publishing a new agent end to end
- Draft and revise calendar-driven workflow proposals for Gantt review
- Create semantic artifacts such as an ICP, brand voice doc, or blog post
- Research a company and surface decision makers in a structured table
- Launch a new email outreach campaign in one assistant turn
- Set up a scheduled trigger that runs on a recurring cadence
- Capture a booking page URL as the call-to-action for a campaign
- Poll and report on async agent runs without declaring success too early
- Drive a paused human-in-the-loop gate from the chat prompt window
