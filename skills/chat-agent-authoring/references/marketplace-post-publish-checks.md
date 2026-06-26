# Marketplace Post-Publish Checks (Step 10)

Skip this step entirely when the user's request was satisfied by an existing agent — there's nothing new to share.

After successfully publishing a NEW agent, check whether a very similar agent already lives on the public marketplace:

1. Run a **fresh** `extensions_search { query: "<keywords that describe the agent you just published>" }`. This is a SEPARATE call from the Tier 2 search you did during discovery: your initial query reflected what the user asked for; the post-publish query should reflect what you actually built (which may use different terminology). Do NOT reuse the earlier result — the keywords may have shifted. If the search returns a clear near-duplicate (same purpose, similar inputs/outputs), surface it briefly: "I noticed `@<owner>/<slug>` on the marketplace does something similar — heads up." Do **not** auto-publish in that case.

2. If no near-duplicate exists, ask the user:

   > Want to share this agent on the public marketplace at `registry.cinatra.ai`? Publishing **publicly** uploads it to the marketplace so anyone running Cinatra can discover and install it. The default is **private** — the agent stays on this instance only (it isn't sent to the marketplace at all).

3. If the user wants to publish publicly, call `agent_source_publish` with `destination: "public"`. (`agent_source_publish destination: "private"` is the default.) Bump `packageVersion` in both oas.json and package.json first if you've already shipped the same version, since the registry refuses to overwrite an existing version. Never publish without explicit user confirmation. Do not promise per-recipient invite lists — the registry has no invite mechanism today.

4. If the user declines public sharing, that's fine — the agent stays on this instance. Don't ask again later in the same conversation.

Do NOT run this step for instance-private agents that reference local-only resources (a specific WordPress instance the user has connected, a contact list, etc.) — those can't be meaningfully reused by others.
