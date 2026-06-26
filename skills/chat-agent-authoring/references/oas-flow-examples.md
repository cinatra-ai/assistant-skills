# OAS Flow 26.1.0 Examples

## Minimal leaf (node-type) OAS

Smallest valid leaf — prompts user for one input pre-run:

```json
{
  "agentspec_version": "26.1.0",
  "component_type": "Flow",
  "id": "<slug>-flow",
  "name": "<Display Name>",
  "description": "<one-sentence purpose>",
  "metadata": {
    "cinatra": {
      "type": "node",
      "packageName": "@<vendor>/<slug>",
      "packageVersion": "0.1.0",
      "hitlScreens": []
    }
  },
  "inputs":  [{ "title": "<input>",  "type": "string" }],
  "outputs": [{ "title": "<output>", "type": "string" }],
  "start_node": { "$component_ref": "start" },
  "nodes": [
    { "$component_ref": "start" },
    { "$component_ref": "do_work" },
    { "$component_ref": "end" }
  ],
  "control_flow_connections": [
    { "component_type": "ControlFlowEdge", "name": "start_to_do_work", "from_node": { "$component_ref": "start" }, "to_node": { "$component_ref": "do_work" } },
    { "component_type": "ControlFlowEdge", "name": "do_work_to_end",   "from_node": { "$component_ref": "do_work" }, "to_node": { "$component_ref": "end" } }
  ],
  "data_flow_connections": [
    { "component_type": "DataFlowEdge", "name": "start_to_do_work_in",  "source_node": { "$component_ref": "start" },  "source_output": "<input>",  "destination_node": { "$component_ref": "do_work" }, "destination_input": "<input>" },
    { "component_type": "DataFlowEdge", "name": "do_work_to_end_out",   "source_node": { "$component_ref": "do_work" }, "source_output": "<output>", "destination_node": { "$component_ref": "end" },     "destination_input": "<output>" }
  ],
  "$referenced_components": {
    "start":  { "component_type": "StartNode",   "id": "start", "name": "Inputs", "metadata": { "cinatra": { "required": ["<input>"] } }, "inputs":  [{ "title": "<input>",  "type": "string" }] },
    "do_work":{ "component_type": "AgentNode",   "id": "do_work", "name": "Do work", "agent": { "$component_ref": "agent" } },
    "end":    { "component_type": "EndNode",     "id": "end", "name": "End", "outputs": [{ "title": "<output>", "type": "string" }] },
    "agent":  { "component_type": "Agent", "id": "agent", "name": "<agent name>", "system_prompt": "<concise prompt>", "metadata": { "cinatra": { "packageName": "@<vendor>/<slug>" } } }
  }
}
```

For a flow with a HITL gate, use `@cinatra-ai/skill-recommender-agent` as the template (call `agent_source_read packageSlug:"skill-recommender-agent"` first).

## Orchestrator pattern (multi-agent compositions)

Orchestrators do NOT inline sub-agents as `Agent` components. They use `FlowNode` + inline subflow `Flow` components. The pattern (lifted from `@cinatra-ai/email-outreach-agent`):

```json
"$referenced_components": {
  "start": { "component_type": "StartNode", "..." : "..." },
  "child_one_flow": {
    "component_type": "FlowNode",
    "id": "child_one_flow",
    "name": "Step 1 — child one",
    "flow": { "$component_ref": "child-one-subflow" },
    "metadata": {
      "cinatra": {
        "packageName": "@cinatra-ai/<child-one-slug>"
      }
    }
  },
  "child-one-subflow": {
    "agentspec_version": "26.1.0",
    "component_type": "Flow",
    "id": "child-one-subflow",
    "name": "Child One Agent",
    "inputs":  [{ "title": "agent_run_id", "type": "string", "default": "" }],
    "outputs": [{ "title": "<output-port>", "type": "string" }],
    "start_node": { "$component_ref": "<sub-start>" },
    "nodes":     [{ "$component_ref": "<sub-start>" }, { "$component_ref": "<sub-end>" }],
    "control_flow_connections": ["..."],
    "data_flow_connections": ["..."]
  },
  "end": { "component_type": "EndNode", "..." : "..." }
}
```

### Orchestrator rules

- **NEVER use `A2AAgent` for internal sub-agent composition** (calling another Cinatra agent in the same WayFlow process). A2A is the cross-instance / external protocol. Internal composition must use `FlowNode` + subflow `Flow`. Enforced as a blocker by `OAS-RUNTIME-008` — any `A2AAgent` pointing back at this instance will fail pre-publish review.
- **`FlowNode.flow.$component_ref` MUST point to a `Flow` component** — never to an `Agent`. Red flag: an `AgentNode` with an inline `Agent` ref inside an orchestrator.
- **The subflow `Flow` is a complete OAS Flow** — it has its own `agentspec_version`, `start_node`, `nodes`, `control_flow_connections`. Read the child agent's actual `oas.json` first via `agent_source_read`.
- **`metadata.cinatra.packageName`** on the FlowNode must match the child package's `packageName` exactly.
- **HITL gates inside an orchestrator** are owned by the FlowNode (`metadata.cinatra.gateSteps[]`) or the child sub-flow — never duplicate.

## Cross-cutting OAS Flow rules

Check in order — most common failure modes:

1. **Exactly one `StartNode` and one `EndNode`** at the flow level.
2. **Every `$component_ref` resolves** — every key referenced from `nodes`, `start_node`, connections, `FlowNode.flow`, `AgentNode.agent` MUST appear in `$referenced_components`.
3. **`AgentNode.agent.$component_ref` points to an `Agent` component (NOT a `Flow`).**
4. **Data-flow port titles match exactly** between source and destination. Typos silently misroute data.
5. **Flow-level `inputs[]` carry `default: ""` for any optional port** — child flows started from a parent aren't given inputs without defaults.
6. **`metadata.cinatra.hitlScreens`** is a flat array of renderer IDs — every renderer referenced by an AgentNode or FlowNode `gateSteps[].renderer` must be in this array.
7. **Don't use legacy `$component_ref` to global names** like `"shared-llm-config"` or `"cinatra-mcp-toolbox"` — these are aliases from an older OAS variant.
8. **InputMessageNode contract** (HITL flow with re-entrant input collection): exactly one string output, no nested objects. See `docs/developer/wayflow-input-message-node-contract.md` for the full contract.

## Chat dispatch and inline HITL contract

When dispatched from chat (not the `/agents/<v>/<s>/new` workspace surface):

1. **Input extraction is "never invent".** The chat pre-router uses a strict never-synthesize prompt. It pulls a URL, topic string, or boolean — but will NOT fabricate a JSON object, array, or nested schema the user didn't type.

2. **Structured StartNode inputs block unattended chat dispatch.** If a `metadata.cinatra.required` field is typed `object` / `array`, or is a JSON-string field (e.g. `oasJson`), the chat will surface a setup-loop HITL gate. When authoring a chat-runnable agent: give every required `object`/`array` input a sensible non-empty `default`, OR keep it `metadata.cinatra.hidden` and derive from a simpler extractable field.

3. **HITL gates render inline in chat AND are prompt-drivable.** The `xRenderer` MUST resolve in `fieldRendererRegistry`. The operator can fill the form OR type the answer into the chat prompt. For the prompt-window path to carry a value into a WayFlow gate, the resume contract requires `values.userResponse`.

4. **Avoid JSON-Schema `format` on chat-dispatched StartNode string inputs.** OpenAI's structured-output validator rejects `format` values it doesn't recognize — `format:"uri"` returns a 400 and extraction fails. The host strips `format` defensively, but keep StartNode string inputs as plain `{ "type": "string" }`. Reserve `format` for non-chat surfaces only.
