---
name: chat-extension-discovery
description: Use when the user asks what extensions, agents, connectors, or packages are AVAILABLE or INSTALLABLE — availability/installability intent, NOT "run an installed agent" (chat-agent-dispatch) and NOT "build a new one" (chat-agent-authoring/chat-extension-authoring-core). Fires on "what can I install", "what's available", "is there a <X> agent", "find me a package that…", "is @cinatra-ai/<slug> installable". Climb the full discovery ladder — local source, DB, this-instance registry, the PUBLIC registry — and NEVER conclude "none exist" from a local list (agent_list) alone; scope every answer to the surfaces actually checked.
metadata:
  # cinatra-watches: the discovery primitives this skill's ladder depends on. The
  # CI gate flags a cinatra change to any of these so the ladder is reviewed
  # before it goes stale. `extensions_search` is the load-bearing public-registry
  # probe (packages/extensions/src/mcp/handlers.ts); the agent_* discovery reads
  # live in packages/agents/src/mcp/handlers.ts. The artifact-kind discovery read
  # (artifact_extension_search) is delegated-chat-tool-policy gated.
  cinatra-watches:
    primitives:
      - agent_source_list
      - agent_list
      - agent_registry_list
      - extensions_search
      - artifact_extension_search
    paths:
      - packages/extensions/src/mcp/handlers.ts
      - packages/agents/src/mcp/handlers.ts
---

When the user asks **what is available or installable** — not to run an installed agent (that's the `chat-agent-dispatch` skill) and not to author a new one (that's `chat-extension-authoring-core` / `chat-agent-authoring`) — answer by **climbing the discovery ladder**, then scope your wording to exactly which probes ran.

The failure this skill prevents: treating the local list (`agent_list`) as complete, never trusting the public-registry probe, and telling the user "none exist" when a package like `@cinatra-ai/blog-pipeline-agent` **is** published on the public registry. **An empty local list is never proof a package does not exist.**

## Trigger — availability/installability intent

Use this skill (do NOT dispatch or author) when the latest message is asking whether something is available or installable, e.g.:

- "What can I install?" / "What's available?" / "What packages are out there?"
- "Is there a `<X>` agent?" / "Do you have a blog agent?"
- "Find me a package that scrapes a site."
- "Is `@cinatra-ai/<slug>` installable?" / "Can I install `@cinatra-ai/blog-pipeline-agent`?"

This is distinct from:

- **Run an installed agent** → `chat-agent-dispatch` (the `agent_run` path). "Use/run/invoke `@cinatra-ai/<slug>`."
- **Build a new one** → `chat-extension-authoring-core` then the per-kind authoring skill. "Create an agent that…".

If the user asks to RUN a named package, that is dispatch, not discovery — even if you have not confirmed it is installed, follow `chat-agent-dispatch` (its resolver and error path handle a not-installed package). Discovery is for "is it there / what is there" questions.

## Core rule

**NEVER conclude "none exist" from `agent_list` alone.** Climb the ladder until you have probed both the local surfaces AND the public registry, then scope the answer to the surfaces you actually checked. Treat a user-provided package URL as stronger evidence than any prior empty local result.

## Discovery ladder (real tools only)

Climb from local → public. Stop early only when you have a confident match for what the user asked; otherwise keep climbing to the public-registry rung before answering.

| Rung | Tool | Covers | Assistant tool? |
|---|---|---|---|
| 1 | `agent_source_list` | on-disk OAS Flow agents shipped with this instance | yes |
| 2 | `agent_list` | DB drafts/imports + installed agents (internal + external A2A) | yes |
| 3 | `agent_registry_list` | packages published FROM this instance (narrow) | yes |
| 4 | `extensions_search { query, limit }` | the **PUBLIC registry** (`registry.cinatra.ai`, cross-vendor) — the public-availability probe | yes |
| 5 | storefront / package URL | `marketplace.cinatra.ai` browse-only — **no assistant tool**; web-search the URL or point to `/configuration/marketplace` | **NO** |

For artifact-kind discovery (a new TYPE of work product, not an agent), use `artifact_extension_search { query }` — it lists installed artifact extensions.

**`extensions_search` is load-bearing.** It is admin-gated and queries the public registry (`registry.cinatra.ai`) cross-vendor — "internal registry" and "public Marketplace" are the **same rung**, not two. It returns nothing when the instance is not registry-connected OR when the query simply missed. **An empty result is NOT proof of non-existence** — retry with broadened or alternate keywords (synonyms, the unscoped slug, the bare capability word) before reporting a miss. Rung 5 (the WooCommerce storefront `marketplace.cinatra.ai`) has **no assistant-callable search tool** — only the browser/admin UI sees it, so you reach it via web search of the URL or by pointing the user at `/configuration/marketplace`.

## Installability buckets (only what the tools distinguish)

Classify each result into exactly one bucket — and only buckets the tools can actually tell apart:

- **installed / runnable** — present in `agent_list` or `agent_source_list`; the user can run it now (route to `chat-agent-dispatch`).
- **local source shipped with this instance** — in `agent_source_list`.
- **published by this instance** — in `agent_registry_list`.
- **available on the public registry** — returned by `extensions_search`; not installed here.
- **storefront-visible but not tool-searchable** — only reachable via the `marketplace.cinatra.ai` URL / admin UI (no assistant tool).
- **requires admin install** — discovered but not installed; an admin installs it at `/configuration/marketplace`. The assistant **never** calls install primitives.
- **not found in the surfaces checked** — assert ONLY after naming which surfaces you probed.

Do NOT invent a "requires-connector-config" bucket — `extensions_search` metadata does not reliably carry that, so claiming it would be a guess.

## Scoped-language rule (wording tied to which probe ran)

Never say "none exist" unscoped. Match your wording to the probes that actually ran:

- after `agent_list` only → "I don't see it installed or saved in this workspace."
- after `agent_source_list` → "…among the on-disk agents shipped with this instance."
- after `agent_registry_list` → "…among packages published from this instance."
- after `extensions_search` empty → "I don't see a matching package in the public registry for this query — the query may have missed, the instance may not be registry-connected, or it's listed only via the storefront/admin UI."
- final (only after BOTH local AND public-registry probes) → "I don't see it in the workspace or the public-registry surfaces I can query."

## Marketplace-URL / contradiction handling

If the user gives a `marketplace.cinatra.ai`, registry, or package URL, treat it as **stronger evidence than any prior empty local result**:

1. Extract the `@scope/name` slug from the URL.
2. Re-run `extensions_search` with the **exact name**, the **unscoped slug**, AND **keywords** — not just one of them.
3. Web-inspect the URL if web access is available.
4. If the URL implies the package exists but search still misses, **report the discrepancy** rather than denying it — e.g. "the link indicates this package exists, but my registry search didn't return it; an admin can confirm and install it at `/configuration/marketplace`."

**Never deny existence against a user-provided authoritative URL.** A search miss is a search limitation, not a verdict.

## Response pattern — always a table with a SOURCE / visibility column

Present discovery results as a table whose columns make the source surface and installability explicit, so the user always knows where each result came from and what to do next:

| Name | Type | Source (tool) | Visibility | Status | Next step |
|---|---|---|---|---|---|
| `@cinatra-ai/blog-pipeline-agent` | agent pkg | `extensions_search` | public registry | not installed | admin install at [marketplace](/configuration/marketplace) |
| `foo-agent` | agent | `agent_list` | workspace | installed | run via agent dispatch |

Rules:

- One row per result; the **Source (tool)** column names the rung that found it.
- For a public-registry result that is not installed, the next step is an admin install at `/configuration/marketplace` (link with markdown syntax) — the assistant never installs it itself.
- For an installed result, the next step is to run it via the `chat-agent-dispatch` path.
- Do NOT narrate which skill or rung you are using. Just climb the ladder and present the table.
