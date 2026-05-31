# SPEC - AXIOM v0.5 Agent OS

## Introduction

AXIOM v0.5 turns the current planner plus company-memory surface into an Agent OS.
The main change is not more product features; it is a stable tool contract that lets one workflow agent plan, choose tools, persist state, and expose the result through CLI, REST, and MCP in a consistent way.

`repo-memory` and `company-brain` stay as tools used by the Agent OS.
They are not separate product phases.

## Scope

The first v0.5 slice must cover:
1. `workflow-agent` contract
2. tool registry contract
3. `repo-memory` tool adapter
4. `company-brain` tool adapter
5. execution report fields
6. CLI / REST / MCP exposure
7. tests and regression around agent/tool wiring

New or primary files for this phase:
- `workflow-agent.js`
- `workflow-agent.test.js`
- `toolRegistry.js`
- `toolRegistry.test.js`
- `plugins/repo-memory.js`
- `plugins/company-brain.js`
- `cli.js`
- `server.js`
- `mcpServer.js`

The discovery engine is intentionally excluded from the first implementation slice.
Its inputs and outputs should be compatible with this contract, but it is not a v0.5 startup requirement.

## Requirement 1 - Workflow Agent Contract

### User Story
As an operator, I want a single workflow agent that can take a goal, select tools, run them in order, and return a structured report.

### Acceptance Criteria
1. `workflow-agent.js` exposes a stable agent entrypoint with `plan(goal, opts)` and `run(goal, opts)`.
2. The agent keeps a single report shape across CLI, REST, and MCP.
3. The report includes `report`, `nextAction`, `recommendations`, and `finalAnswer`.
4. The agent can persist and resume its run state without changing the legacy v2 contract.
5. The agent uses the shared tool registry instead of hardcoding tool calls.

## Requirement 2 - Tool Registry Contract

### User Story
As the agent, I want one registry that tells me which tools exist, what they do, and whether they are safe to run.

### Acceptance Criteria
1. The registry exposes `registerTool()`, `listTools()`, `getTool(name)`, and `runTool(name, input, context)`.
2. Tool routing consults the existing `toolPolicy.js` policy before execution.
3. Internal AXIOM tools are still auto-allowed; external or review-only tools keep their approval metadata.
4. The registry returns structured tool metadata so the agent can explain why a tool was selected, skipped, or blocked.

## Requirement 3 - Repo Memory Tool

### User Story
As the workflow agent, I want repo-memory to behave like a tool I can invoke during planning and analysis.

### Acceptance Criteria
1. `repo-memory` is registered as a tool in the registry.
2. The tool can ingest repo-derived knowledge and expose it back as searchable graph context.
3. The tool surfaces enough metadata for the agent report to mention the source of the data.
4. The tool remains a plugin-backed capability, not a separate product branch.

## Requirement 4 - Company Brain Tool

### User Story
As the workflow agent, I want company-brain to behave like a query-and-ingest tool for repo and decision context.

### Acceptance Criteria
1. `company-brain` is registered as a tool in the registry.
2. The tool supports query and ingest-oriented actions through a single tool contract.
3. The agent can ask company-brain for repo reasoning, decision history, and ingest status.
4. The tool remains part of the Agent OS toolset, not a standalone release phase.

## Requirement 5 - Surface Integration

### User Story
As a user, I want to reach the same agent behavior through CLI, REST, and MCP.

### Acceptance Criteria
1. CLI can route workflow-agent commands and show the report fields clearly.
2. REST can surface the same execution result structure.
3. MCP can expose the same agent/report fields without inventing a second contract.
4. Legacy commands and legacy surfaces keep working.

## Requirement 6 - Execution Report

### User Story
As a user, I want to understand what the agent did, what it will do next, and what it recommends.

### Acceptance Criteria
1. Report output includes `report`, `nextAction`, `recommendations`, and `finalAnswer`.
2. The report can include tool-selection reasoning and checkpoint context.
3. The report does not overwrite the legacy `ok/data/evidence/meta` envelope.
4. Report wording stays deterministic enough to test.

## Requirement 7 - Regression Guard

### User Story
As a maintainer, I want the new Agent OS contract without breaking the existing core.

### Acceptance Criteria
1. Existing Kernel, KernelV2, Agent, MCP, server, CLI, plugin, and benchmark tests stay green.
2. New tests cover tool registry selection, report fields, and tool wiring.
3. The v0.4 Company Brain behavior keeps working while the new agent contract is introduced.

## Design

### Runtime Shape

```
workflow-agent.js
  -> toolRegistry.js
    -> toolPolicy.js
    -> plugins/repo-memory.js
    -> plugins/company-brain.js
    -> existing AXIOM evidence and graph services
```

### Contract Notes

- `workflow-agent` owns the run loop and report shape.
- `toolRegistry` owns tool discovery, policy checks, and invocation routing.
- `repo-memory` and `company-brain` are tools, not phases.
- Discovery logic stays compatible with the contract but is not part of the first code slice.

## Milestones

### Milestone 1 - Contract Lock
Define the workflow-agent and tool-registry API surface, including the report fields and tool-policy handshake.

### Milestone 2 - Tool Wiring
Register `repo-memory` and `company-brain` in the tool registry and make them callable through the agent.

### Milestone 3 - Surface Exposure
Expose the same agent behavior through CLI, REST, and MCP.

### Milestone 4 - Regression Lock
Keep all existing tests green and add contract tests for the new agent/tool behavior.

## Out Of Scope

- Discovery engine implementation
- Obsidian polish
- Slack/Gmail/Jira/Linear/Notion connectors
- Multi-user permissions
- Governance layer expansion

## Assumptions

- `AXIOM_AGENT_VERSION=v3` remains opt-in and does not become the default.
- The v0.5 contract must be additive.
- The repo stays local-first and dependency-light.
- New tool behavior must explain itself through testable report fields.
