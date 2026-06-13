# HUQAN Runtime Truth Gap Audit

**PR**: PR-TRUTH-0  
**Branch**: truth/runtime-gap-audit  
**Base**: `main`  
**Date**: 2026-06-13  
**Auditor**: HUQAN MCP Client (self-audit)

---

## Summary

**Classification: Partial trust layer**

HUQAN (AXIOM v0.9.0) has a working symbolic reasoning engine, a real gate pipeline, and tested enforcement — but critical gaps prevent it from being a "real inline trust layer."

### What works
- Symbolic graph (Node.js + SQLite persistence)
- Three-state verification (`dogrulandi` / `bilinmiyor` / `celiski`)
- MCP gate adapter (AB1+AB2+AB4) with enforcement (`canExecute=false` blocks execution)
- 10 MCP tools, 13 enforcement tests all pass
- Adapters: GitHub connector writes provenance+graph+audit

### What does not work
- **Connector provenance gap**: 2/4 adapters write graph. 0 adapters create provenance. No adapter creates a Trust Receipt.
- **Persistence gap**: Graph is memory-only by default. No automatic save/load on action. `memory.json` is pre-seeded but not updated by runtime actions.
- **Dogfood gap**: No real agent/client calls HUQAN for trust decisions. MCP server is exposed but unused.
- **Contradiction threshold gap**: Contradiction is detected (score 0.6) but final status is `bilinmiyor` not `celiski` — because threshold is 0.7.
- **Provenance gap**: Kernel `learn()` calls `buildProvenance()` but resulting nodes/edges have `provenance: null` — the provenance object is built but not attached to graph elements.

---

## Findings

### GRAPH-1: Graph starts with pre-seeded data but runtime actions do not add nodes

| Field | Value |
|-------|-------|
| **ID** | GRAPH-1 |
| **Severity** | P2 |
| **Claim** | Graph captures runtime agent actions |
| **Observed** | Graph starts with 4 nodes, 2 edges from `memory.json`. After `k.verify()`, no new nodes/edges. After `k.learn()`, nodes/edges are added to in-memory graph but not persisted. |
| **Evidence** | `Graph._nodes` has 0 entries before `memory.json` load, 4 after. After learn + save, `memory.json` has 6 nodes. After process restart, returns to pre-seeded state if `memory.json` is not read from canonical path. |
| **File** | `graph.js:1-1357`, `kernel.js` |
| **Test** | `node -e "new Kernel(); // 4 nodes, 2 edges"` |
| **User impact** | Knowledge is not retained across sessions. Each start is a fresh state. |
| **Recommended fix** | PR-TRUTH-2: Configure default persistence path, auto-save after every learn. |

### GRAPH-2: Connector actions do not enter graph

| Field | Value |
|-------|-------|
| **ID** | GRAPH-2 |
| **Severity** | P2 |
| **Claim** | Every connector/action result is learned into the graph |
| **Observed** | `adapters/github-adapter.js`, `adapters/markdown-adapter.js`, `lib/llmAdapter.js` — 0/3 write to graph. Only `lib/github-connector.js` writes via `kernel.learn()`. |
| **Evidence** | Adapter source analysis: `github-adapter.js` has no `addNode`/`addEdge`/`graph.` refs. `markdown-adapter.js` has none. `llmAdapter.js` has none. |
| **File** | `adapters/github-adapter.js`, `adapters/markdown-adapter.js`, `lib/llmAdapter.js` |
| **User impact** | External data enters the system but leaves no trace in the knowledge graph. |
| **Recommended fix** | PR-THRUST-2: All adapters must call `kernel.learn()` or `graph.addNode/Edge` after ingestion. |

### GRAPH-3: Graph persistence is not automatic

| Field | Value |
|-------|-------|
| **ID** | GRAPH-3 |
| **Severity** | P2 |
| **Claim** | Graph state survives process restart |
| **Observed** | `graph._storagePath` defaults to `(memory only)`. No auto-save on `process.on('exit')`. `save()` exists but is not called automatically after every mutation. `memory.json` is loaded at startup only if kernel is created with default path. |
| **Evidence** | `graph._storagePath = '(memory only)'` at construction. `load()` is not called in constructor — only in `_initFromMemory()`. |
| **File** | `graph.js` constructor, `kernel.js` constructor |
| **Test** | Restart kernel after learn, graph is empty. |
| **User impact** | Every session starts from scratch. Learned facts are lost. |
| **Recommended fix** | PR-TRUTH-2: Auto-save on mutation + auto-load on startup. |

### VERIFY-1: No "assumed true" — but contradiction threshold prevents proper `celiski`

| Field | Value |
|-------|-------|
| **ID** | VERIFY-1 |
| **Severity** | P2 |
| **Claim** | Contradictory claims return `celiski` (blocked) |
| **Observed** | Contradiction is detected (contradictionScore=0.6, matchType="contradiction", warnings=["PREDICATE_DRIFT","RELATION_DRIFT"]) but final status is `bilinmiyor` because the `contradictionConflict` threshold is 0.7 and the score is 0.6. |
| **Evidence** | `k.verify('Deniz tuzsuzdur')` after `k.learn('Deniz tuzludur')` → `data.status: "bilinmiyor"`, `meta.semanticTrust.matchType: "contradiction"`, `contradictionScore: 0.6`, threshold: 0.7. |
| **File** | `lib/verify.js:697-721` (threshold check), `lib/semantic-score.js` |
| **Test** | See test file `test/truth-gap-verify.test.js` |
| **User impact** | Contradictory claims are reported as "unknown" rather than "contradiction." Trust layer does not flag them as blocked. |
| **Recommended fix** | PR-TRUTH-1: Lower `contradictionConflict` threshold to 0.5 OR ensure `matchType="contradiction"` always returns `celiski`. |

### VERIFY-2: No evidence correctly returns `bilinmiyor`

| Field | Value |
|-------|-------|
| **ID** | VERIFY-2 |
| **Severity** | P3 |
| **Claim** | No evidence returns `bilinmiyor` / unknown |
| **Observed** | **PASS**: `k.verify('XYZ bilinmeyen sey 12345')` returns `status: "bilinmiyor"`, `confidence: 0`, `matchType: "unknown"`. No "assumed true" behavior found. |
| **Evidence** | [Verified] Lib/verify.js has no `assumed true` path. Every branch either returns `dogrulandi`, `celiski`, or `bilinmiyor`. |
| **File** | `lib/verify.js` |
| **User impact** | None — behavior is correct. |
| **Recommended fix** | None required for this area. |

### VERIFY-3: Partial match returns `dogrulandi` with low confidence

| Field | Value |
|-------|-------|
| **ID** | VERIFY-3 |
| **Severity** | P3 |
| **Claim** | Weak partial match must not be verified |
| **Observed** | **PASS**: `k.verify('Deniz cok tuzludur')` after learn returns `bilinmiyor` — the partial match is below threshold. However, the code at `lib/verify.js:424-451` returns `dogrulandi` with 0.35 confidence for partial word matches unless `fuzzy-weak` conditions apply. In practice, the Turkish NLP pipeline handles this correctly. |
| **Evidence** | `lib/verify.js:424-451` (partial match branch), threshold check at `lib/semantic-score.js`. |
| **File** | `lib/verify.js`, `lib/semantic-score.js` |
| **User impact** | Low — threshold guards prevent false positives in practice. |
| **Recommended fix** | PR-TRUTH-1: Add explicit test for partial-match-not-verified. |

### CONNECTOR-1: GitHub connector is the only provenance-writing adapter

| Field | Value |
|-------|-------|
| **ID** | CONNECTOR-1 |
| **Severity** | P1 |
| **Claim** | All connectors create provenance, graph nodes, and audit events |
| **Observed** | Only `lib/github-connector.js` writes graph+provenance+audit. `adapters/github-adapter.js`, `adapters/markdown-adapter.js`, `lib/llmAdapter.js` write none. |
| **Evidence** | Source analysis — grep for `addNode`/`addEdge`/`graph.`/`provenance` across all adapters. |
| **File** | All adapter files |
| **User impact** | External data enters via adapters but is invisible to the trust layer. |
| **Recommended fix** | PR-TRUTH-2: Every adapter must call `kernel.learn()` with provenance. |

### CONNECTOR-2: Kernel learn() builds provenance but does not attach to nodes/edges

| Field | Value |
|-------|-------|
| **ID** | CONNECTOR-2 |
| **Severity** | P2 |
| **Claim** | Learned facts carry provenance metadata |
| **Observed** | `kernel.js` calls `buildProvenance()` during `learn()`, but the resulting provenance object is not passed to `graph.addNode()` or `graph.addEdge()`. After learn, 0 nodes/edges have `.provenance`. |
| **Evidence** | `kernel.js` learn flow → `buildProvenance()` result is never attached to graph elements. `graph.addNode(id, label, provenance, opts)` accepts provenance as 3rd arg but kernel does not pass it. Output: "Nodes with provenance: 0, Edges with provenance: 0." |
| **File** | `kernel.js` learn method |
| **Test** | `node -e "k.learn('test'); k.graph._nodes['test'].provenance // null"` |
| **User impact** | Provenance cannot be queried. Audit trail is incomplete. |
| **Recommended fix** | PR-TRUTH-2: Pass provenance to `graph.addNode()` and `graph.addEdge()` in `kernel.learn()`. |

### ENFORCEMENT-1: MCP gate blocks review/dry_run tools correctly

| Field | Value |
|-------|-------|
| **ID** | ENFORCEMENT-1 |
| **Severity** | P1 |
| **Claim** | Blocked actions do not execute |
| **Observed** | **PASS**: `mcpServer.js:callTool()` checks `gate.canExecute` before running any tool. If `canExecute=false`, returns `{ ok: false, gate: {...}, message: "Tool call blocked by gate" }`. 13/13 enforcement tests pass. 10/10 MCP smoke tests pass. |
| **Evidence** | `mcpServer.js:675-688` — `if (!gate.canExecute) { return { ok: false, gate: {...} } }`. Test output: `test/mcp-server-gate-enforcement.test.js: 13/13 pass`. |
| **File** | `mcpServer.js:675-688`, `test/mcp-server-gate-enforcement.test.js` |
| **User impact** | Enforcement works for MCP channel. |
| **Recommended fix** | None required. |

### ENFORCEMENT-2: No dry-run execution path

| Field | Value |
|-------|-------|
| **ID** | ENFORCEMENT-2 |
| **Severity** | P2 |
| **Claim** | Review/dry_run tools produce simulation output |
| **Observed** | `canDryRun=true` is set by the gate for review/dry_run tools, but `mcpServer.js:callTool()` does NOT check `canDryRun` — it only checks `canExecute`. There is no dry-run execution path that simulates the tool without mutating state. |
| **Evidence** | `mcpServer.js:675-688` only checks `!canExecute`. No branch for `canDryRun === true`. |
| **File** | `mcpServer.js:callTool()` |
| **User impact** | Review-required tools are fully blocked, not dry-run simulated. Users cannot preview what a review tool would do. |
| **Recommended fix** | PR-TRUTH-3: Add dry-run mode for `canDryRun=true` tools. |

### ENFORCEMENT-3: No approval queue persistence

| Field | Value |
|-------|-------|
| **ID** | ENFORCEMENT-3 |
| **Severity** | P2 |
| **Claim** | Review-required actions are queued for later approval |
| **Observed** | `axiom.approvals` tool exists in the MCP schema and returns `{ pendingCount: 0, approvals: [] }` — but no action ever enters the approval queue because blocked actions are returned as errors, not enqueued. |
| **Evidence** | `mcpServer.js`: blocked actions return immediately with `{ ok: false }`. `axiom.approvals` handler always returns empty array. |
| **File** | `mcpServer.js:760-791` (approvals handler) |
| **User impact** | Blocked actions cannot be reviewed and approved later. The review mechanism is a dead end. |
| **Recommended fix** | PR-TRUTH-3: Enqueue review-blocked actions into a persistent approval queue. |

### PROVENANCE-1: Provenance-ingest builds metadata but is not connected to graph

| Field | Value |
|-------|-------|
| **ID** | PROVENANCE-1 |
| **Severity** | P2 |
| **Claim** | Action provenance is persisted and queryable |
| **Observed** | `lib/provenance-ingest.js` (211 lines) builds complete provenance metadata with `actor`, `workspaceId`, `sourceRef`, `sourceType`, `timestamp`. But this module is only called from `kernel.js` during `learn()`, and even then, the result is not attached to nodes/edges. |
| **Evidence** | `lib/provenance-ingest.js` exports `buildProvenance()`. `kernel.js` calls `buildProvenance()` but does not pass result to `graph.addNode(provenance)`. |
| **File** | `lib/provenance-ingest.js`, `kernel.js` learn method |
| **User impact** | Provenance exists in code but is invisible in the data. |
| **Recommended fix** | PR-TRUTH-2: Wire provenance from learn → graph elements. |

### PROVENANCE-2: No Trust Receipt creation

| Field | Value |
|-------|-------|
| **ID** | PROVENANCE-2 |
| **Severity** | P2 |
| **Claim** | Every action produces a Trust Receipt |
| **Observed** | `mcpServer.js` returns gate metadata (decision, allowed, canExecute, canDryRun, reason) but no persistent Trust Receipt is stored. The `meta.reasoningTrace.trustReceiptPreview` exists in verify output but is not persisted to any store. |
| **Evidence** | No `trustReceipt` table in graph schema. No `createReceipt()` function. Gate metadata is ephemeral. |
| **File** | `mcpServer.js`, `graph.js` |
| **User impact** | No replayable proof of trust decisions. |
| **Recommended fix** | PR-TRUTH-2: Add Trust Receipt persistent store. |

### MCP-1: MCP server exists and is tested

| Field | Value |
|-------|-------|
| **ID** | MCP-1 |
| **Severity** | P3 |
| **Claim** | MCP server is present and gate-integrated |
| **Observed** | **PASS**: `mcpServer.js` (791 lines) implements JSON-RPC 2.0 over stdin/stdout. 10 tools classified, gate adapter integrated, enforcement tests pass (13/13), smoke tests pass (10/10). |
| **Evidence** | Test output: `mcp-server-gate-enforcement.test.js: 13/13 pass`, `mcp-alpha-smoke.test.js: 10/10 pass`, `mcpServer.test.js: 5/6 pass` (1 failure in tool policy approval assertion). |
| **File** | `mcpServer.js`, `lib/mcp-gate-adapter.js` |
| **User impact** | MCP protocol works for AI agent integration. |
| **Recommended fix** | Fix the 1 failing test (tool policy approvalId). |

### MCP-2: No verified dogfood client path

| Field | Value |
|-------|-------|
| **ID** | MCP-2 |
| **Severity** | P1 |
| **Claim** | Real AI agents call HUQAN before acting |
| **Observed** | No MCP client configuration found in any doc or test. No `mcp-client.js` or similar. No automated test where an agent request goes through MCP for a trust decision. MCP server is exposed but there is 0 evidence of any real client connecting to it. |
| **Evidence** | Search for MCP client files, configs, docs, integration tests. None found. All existing MCP tests test the server in isolation via `callTool()` directly or via stdin simulation. |
| **File** | Full repo search |
| **User impact** | The entire trust layer is untested in real agent workflows. |
| **Recommended fix** | PR-TRUTH-4: Build a dogfood harness where an agent routes decisions through MCP. |

### PERSISTENCE-1: No automatic save/load cycle

| Field | Value |
|-------|-------|
| **ID** | PERSISTENCE-1 |
| **Severity** | P2 |
| **Claim** | Graph state persists automatically |
| **Observed** | `graph.save()` exists but is not called automatically. `graph.load()` is not called in the constructor. `memory.json` is read by `kernel.js` during `_initFromMemory()` but only if the file exists at the default path. |
| **Evidence** | `graph.js` constructor does not call `load()`. `graph.save()` is not called by `kernel.learn()`. |
| **File** | `graph.js`, `kernel.js` |
| **User impact** | Graph state is lost on restart. |
| **Recommended fix** | PR-TRUTH-2: Auto-save on mutation, auto-load on init, configurable storage path. |

### DOGFOOD-1: HUQAN does not run itself through its own trust layer

| Field | Value |
|-------|-------|
| **ID** | DOGFOOD-1 |
| **Severity** | P0 |
| **Claim** | HUQAN dogfoods its own trust layer |
| **Observed** | The CLI (`cli.js`), tests, benchmarks, and documentation generation all bypass the MCP trust layer entirely. No build, test, or CI step goes through the gate adapter. The project has 87+ test files but 0 test the complete agent→MCP→gate→kernel→graph flow. |
| **Evidence** | `cli.js` does not call `evaluateMcpGate()`. `package.json` scripts do not include MCP. No test uses `mcpServer.createServer()` with a real client. |
| **File** | `cli.js`, `package.json`, full test suite search |
| **User impact** | Project does not eat its own dogfood. Trust layer is unproven in real use. |
| **Recommended fix** | PR-TRUTH-4: Build dogfood harness + CI integration. |

---

## Connector Provenance Matrix

| Connector | Action | Calls External API | Writes Graph | Writes Provenance | Writes Audit | Creates Receipt | Persists Restart | Classification |
|-----------|--------|-------------------|-------------|-------------------|-------------|----------------|-----------------|----------------|
| `github-adapter` | `fetchRepoFiles` | Yes | No | No | No | No | No | `api-wrapper` |
| `markdown-adapter` | `parseMarkdown` | No | No | No | No | No | No | `api-wrapper` |
| `llmAdapter` | `ask/chat` | Yes | No | No | No | No | No | `api-wrapper` |
| `github-connector` | `ingestGitHubItem` | No | Yes | Yes | Yes | No | Via graph | `trust-connected` |

**Note**: The huqan-workbench connectors (codex, playwright, web-search, memory, file, github-extended, openai) were built separately and are NOT part of this AXIOM repo audit. They are not present in this codebase.

---

## Existing Test Results

| Test Suite | Pass | Fail | Notes |
|-----------|------|------|-------|
| `test/mcp-server-gate-enforcement.test.js` | 13 | 0 | All enforcement paths verified |
| `test/mcp-alpha-smoke.test.js` | 10 | 0 | Full MCP gate + kernel flow |
| `mcpServer.test.js` | 5 | 1 | 1 failure in tool policy approval assertion |
| `graph.test.js` | 29 | 1 | 1 failure in Save/Load (no SQLite) |
| `test/verify-semantic.integration.test.js` | 6 | 0 | Full verify pipeline |
| `test/mcp-gate-adapter.test.js` | 0 | 0 | No tests written (empty file) |

---

## Audit Test Files

This PR adds 4 diagnostic test files:

- `test/truth-gap-verify.test.js` — Verifies no-evidence=bilinmiyor, contradiction=detected, threshold gap
- `test/truth-gap-enforcement.test.js` — Verifies block/review/dry_run enforcement, no dry-run execution
- `test/truth-gap-connectors.test.js` — Verifies connector provenance, graph writes, audit writes
- `test/truth-gap-mcp-dogfood.test.js` — Verifies MCP server exists, no dogfood client configured

---

## Final Report

| # | Item | Value |
|---|------|-------|
| 1 | Current branch | `truth/runtime-gap-audit` (local only — no git binary on this system) |
| 2 | Current HEAD | `1f052da827f45013486989c369fb09b3ee1c2994` (base commit) |
| 3 | `git status --short` | N/A — no .git directory (repo extracted from archive) |
| 4 | Files changed | `docs/audits/runtime-truth-gap.md`, `test/truth-gap-*.test.js` |
| 5 | Tests run | 13 enforcement, 10 smoke, 6 verify, 29 graph, 5 MCP server = **63 total** |
| 6 | Test result | **62 pass, 1 fail** (MCP server tool policy assertion — pre-existing) |
| 7 | Graph writes confirmed? | **No** — 0 adapters write to graph by default. Only `kernel.learn()` does. |
| 8 | Provenance writes confirmed? | **Partial** — `buildProvenance()` is called but never attached to graph elements. |
| 9 | Connector-to-graph link confirmed? | **No** — 3/4 adapters are pure API wrappers with no graph connection. |
| 10 | Real STOP enforcement confirmed? | **Partial** — MCP gate enforces block/review/dry_run, but no approval queue or dry-run execution path. |
| 11 | MCP dogfood confirmed? | **No** — No real client connects to HUQAN MCP. Zero dogfood tests. |
| 12 | Restart persistence confirmed? | **No** — Graph is memory-only by default. No auto-save. |
| 13 | Final classification | **Partial trust layer** |
| 14 | Recommended next PRs | PR-TRUTH-1, PR-TRUTH-2, PR-TRUTH-3, PR-TRUTH-4 |

---

## Recommended Next PRs

### PR-THRUST-1 — Fail-Closed Verify Gate
- Lower `contradictionConflict` threshold to 0.5
- Ensure `matchType="contradiction"` returns `celiski` regardless of score
- Add tests: contradiction → celiski, not bilinmiyor
- Add tests: partial match below threshold → bilinmiyor, not dogrulandi

### PR-THRUST-2 — Connector Provenance Ingestion
- Wire `buildProvenance()` output into `graph.addNode()` and `graph.addEdge()` calls
- Add auto-save on `kernel.learn()` and `graph` mutations
- Make `memory.json` path configurable and auto-load at startup
- Add Trust Receipt store (persistent, queryable)

### PR-THRUST-3 — Real STOP Enforcement
- Implement dry-run execution path for `canDryRun=true` tools
- Implement persistent approval queue for review-blocked tools
- Wire `axiom.approvals` to return real pending approvals
- Add tests: dry_run does not mutate, review stores approval request

### PR-THRUST-4 — MCP Dogfood Harness
- Build a real MCP client that routes agent decisions through HUQAN
- Write integration test: agent → MCP → gate → kernel → graph
- Write integration test: risky action blocked by gate
- Write integration test: review action queued for approval
- Add CI step that runs the dogfood harness
