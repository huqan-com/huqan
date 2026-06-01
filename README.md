# AXIOM

[![Tests](https://img.shields.io/badge/Tests-392%2F392-green)]()
[![Node](https://img.shields.io/badge/node-%3E%3D18-blue)]()
[![Release](https://img.shields.io/badge/release-v0.7.0-blue)]()

AXIOM is a local-first reasoning layer for memory, models, tools, agents, and decisions.

It does not try to be another chatbot. AXIOM judges claims against graph memory, separates known facts from unknowns, blocks unsupported learning, explains contradictions, and simulates what may break when a decision changes.

## The Core Idea

LLMs answer. AXIOM judges.

Most AI systems optimize for fluent responses. AXIOM optimizes for inspectable reasoning:

- What does the system actually know?
- Which answer is backed by memory?
- Which answer is only LLM-assisted?
- Which claim contradicts the graph?
- Which evidence supports the conclusion?
- What happens if this decision changes?
- What should be asked next?

The rule that shapes the project:

> Unsupported knowledge must not become trusted memory.

## What AXIOM Is

AXIOM is a small symbolic reasoning engine with product surfaces around it:

- graph memory for local facts and relations
- verification for graph-backed claims
- contradiction detection
- deterministic final summaries
- AXIOM Shield for LLM output control
- Company Brain for project and decision memory
- Workflow Agent OS for tool orchestration
- causal reasoning for decision simulation
- SDK wrappers for external AI systems

The engine is local-first and dependency-light. It can run without external LLMs, GPUs, or cloud services.

## Why It Matters

Modern AI stacks often have the same failure mode:

```text
LLM output sounds plausible
-> system stores it as memory
-> future answers trust polluted memory
-> product behavior drifts
```

AXIOM attacks that failure mode directly.

It classifies output before trust:

- `graph-backed` means the graph supports it
- `llm-assisted` means the model helped but graph support is partial
- `unsupported` means the graph does not know
- `contradicted` means the graph disagrees

That makes AXIOM useful as a judgment layer around LLM apps, internal tools, agent systems, and founder decision workflows.

## What It Can Do Today

### Graph Memory

AXIOM learns local facts into a graph and can answer from that graph.

Example:

```text
ogret: kedi hayvandir
sor: kedi nedir
```

The point is not just storage. The point is that answers can be checked against structured memory.

### Verification

AXIOM can verify claims and return evidence.

It distinguishes:

- known
- unknown
- contradicted
- weakly supported

This is the base layer under Shield, finalizer, and causal reasoning.

### AXIOM Shield

Shield wraps LLM-assisted answers with a trust policy.

Safety rules:

- `autoLearn` defaults to `false`
- unsupported output is not learned
- contradicted output is not learned
- LLM-assisted output must be explicitly accepted

This is the project's safety foundation:

```text
Do not trust the model.
Pass it through AXIOM.
```

### Finalizer

The finalizer turns tool results into a judgment report.

It produces:

- known facts
- unknowns
- evidence
- conclusion
- next questions
- causal risk and recommendation

This is what turns raw tool execution into an answer a human can inspect.

### Company Brain

Company Brain lets AXIOM ingest and query project context:

- GitHub repository content
- markdown folders
- manual notes
- decision logs

It is the company-memory layer, not a separate product bolted on later.

### Workflow Agent OS

The workflow runtime gives AXIOM deterministic tool orchestration.

It exposes tools such as:

- `verifyClaim`
- `findContradictions`
- `rankEvidence`
- `repoMemory`
- `companyBrain`
- `discoveryEngine`
- `experimentPlanner`
- `resultAnalyzer`
- `replicationChecker`

This makes AXIOM usable as an agent runtime without making the LLM the source of truth.

### Causal Reasoning

v0.7 adds causal simulation.

Supported causal relations:

- `CAUSES`
- `PREVENTS`
- `ENABLES`
- `DEPENDS_ON`
- `LEADS_TO`

This lets AXIOM answer:

```text
What breaks if you do this?
```

Reference demo:

```bash
node demo-causal-autolearn.js
```

Demo question:

```text
What breaks if autoLearn defaults to true?
```

Expected judgment:

```text
Risk level: critical
Recommendation: Change is not recommended.
LLM: not used
Output: deterministic
```

Causal chain:

```text
autoLearn true
-> unsupported LLM output can enter graph
-> graph trust degradation
-> Shield claim weakens
-> AXIOM reliability promise is damaged
```

### SDK Wrappers

AXIOM exposes dependency-free wrappers for external AI systems:

- `createAxiomClient`
- `toLangChainTool`
- `toVercelAiMiddleware`

This is the integration surface for builders who want AXIOM as a verification and reasoning layer around their own AI stack.

## Product Evolution

AXIOM has grown in layers:

```text
v0.3 - Personal Thought Judge
v0.4 - Company Brain
v0.5 - Agent OS + Discovery Engine
v0.6 - Productization & Shield
v0.7 - Causal Reasoning Layer
```

The throughline is consistent:

```text
memory -> verification -> agent tools -> shield -> causal judgment
```

## Who It Is For

AXIOM is currently best suited for:

- solo founders
- technical founders
- AI product builders
- small-team CTOs
- open-source maintainers
- developers building LLM agents or tool systems

The current wedge is builder decision simulation. The longer-term direction is company-wide agent governance.

## What It Is Not

AXIOM v0.7 is not:

- a full world model
- a probabilistic oracle
- an autonomous research scientist
- an enterprise governance suite
- a replacement for human judgment

It is a deterministic reasoning layer that makes claims, memory, and decisions easier to inspect.

## Quick Start

```bash
npm install
npm test
npm run server
```

CLI:

```bash
npm start
```

Causal demo:

```bash
node demo-causal-autolearn.js
```

MCP server:

```bash
npm run mcp
```

Product UI:

```text
http://localhost:3000
```

## CLI Commands

General:

- `ogret: kedi hayvandir`
- `sor: kedi nedir`
- `plan: hedef`
- `ajan: hedef`
- `durum`
- `backup`
- `restore`

Agent OS:

- `mri: AXIOM company brain olmali`
- `tartis: AXIOM company brain olmali`
- `celiski: AXIOM motor degil ana urun olmali`

Company ingest/query:

- `ogren --kaynak manuel --yazar sonfi "kedi hayvandir"`
- `ogren --kaynak karar --baslik "X" --gerekce "Y"`
- `sirket-sor: Bu karar neden alindi?`
- `ingest-durum`

## REST Endpoints

Verification:

- `GET /v2/verify?statement=...`
- `POST /v2/verify`
- Legacy: `GET/POST /dogrula`

LLM Shield:

- `POST /llm-sor`

Ingest:

- `POST /api/ingest`
- `GET /api/ingest/status`

System:

- `GET /health`
- `GET /v2-status`
- `GET /graph-data`

## Runtime Modes

Default runtime:

```text
classic agent path
```

Workflow Agent OS:

```bash
set AXIOM_AGENT_RUNTIME=workflow
```

Checkpoint/resume v3 agent:

```bash
set AXIOM_AGENT_VERSION=v3
```

## Persistence

- `memory.db` - SQLite primary storage
- `memory.json` - JSON fallback
- `memory.embeddings.json` - embedding store

## Docs

- `docs/product-positioning.md` - product audience, promise, and boundaries
- `docs/architecture.md` - core modules and source-of-truth map
- `docs/release-map.md` - release history and next direction
- `docs/v0.7-release-notes.md` - v0.7 release notes
- `docs/demo-causal-v0.7.md` - causal demo guide
- `docs/ADR-001-causal-engine.md` - causal engine decision record
- `docs/demo-v0.6.md` - v0.6 product smoke flow
- `docs/finalizer-spec.md` - deterministic finalizer contract
- `docs/sdk-v0.6.md` - SDK wrapper contract

## Repository Layout

```text
kernel.js
kernel.v2.js
graph.js
causalSimulator.js
finalizer.js
plugin.js
agent.js
agent.v3.js
workflow-agent.js
workflow-tools.js
workflow-runtime.js
server.js
cli.js
mcpServer.js
lib/
adapters/
plugins/
benchmarks/
specs/
docs/
```

## Verification

Current release:

```text
v0.7.0
```

Expected test status:

```text
npm test -> 392/392 passing
```

Expected status endpoint:

```text
GET /v2-status -> version=0.7.0, testStatus=392/392
```

## License

MIT
