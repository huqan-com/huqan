# AXIOM Release Map

## Current Stable Release

```text
v0.7.0 - Causal Reasoning Layer
```

Status:

- GitHub Release published
- tag: `v0.7.0`
- target: `main`
- expected tests: `392/392`

## Release History

### v0.3 - Personal Thought Judge

Focus:

- graph reliability
- plugin contract
- evidence ranking
- personal reasoning plugins

### v0.4 - Company Brain

Focus:

- repository memory
- company context
- GitHub, markdown, manual notes, and decision ingest

### v0.5 - Agent OS + Discovery Engine

Focus:

- workflow runtime
- workflow tools
- deterministic agent execution
- discovery skeleton

### v0.6.0 - Productization & Shield

Focus:

- product UI
- AXIOM Shield
- `autoLearn=false`
- ingest helper extraction
- SDK wrappers
- deterministic finalizer
- demo smoke

### v0.7.0 - Causal Reasoning Layer

Focus:

- causal relation schema
- deterministic causal traversal
- what-if simulator
- causal finalizer summary
- `autoLearn true` safety demo

Product sentence:

```text
What breaks if you do this?
```

## Recommended v0.8 Direction

```text
v0.8 - Provenance & Governance
```

Recommended focus:

- source binding
- audit log
- workspace and permission boundaries
- connector contracts
- conflict detection across graph, agent, and ingest surfaces

Reasoning:

v0.6 made AXIOM usable.
v0.7 made AXIOM causal.
v0.8 should make AXIOM trustworthy at team and company scale.

## v0.8 Non-goals

- new causal behavior
- broad connector suite
- full enterprise governance
- autonomous source discovery
- probabilistic prediction layer

## Release Rule

Do not tag a final release until these pass on `main`:

```bash
npm test
node demo-causal-autolearn.js
```

Required HTTP smoke:

```text
GET /
GET /health
GET /v2-status
GET /graph-data
```
