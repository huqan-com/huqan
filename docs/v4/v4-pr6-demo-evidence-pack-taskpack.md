# HUQAN / AXIOM V4-PR6 Task-Pack - Demo / Evidence Pack

## 1. Current Checkpoint

```txt
V4_WB2_IMPLEMENTATION_MERGED_POST_MERGE_SMOKE_GREEN
Canonical HEAD: 3d57c6017f16f7b1f8e98b60e8ee8113ed65c5d8
```

Closed gates:

- V4 Runtime Surface Closeout
- WB0 - No-Mock Workbench Blueprint
- WB1 - Trust Receipt / Verdict Inspector docs
- WB1 - Implementation Task-Pack
- WB1 - Read-only Trust Receipt Inspector helper
- WB2 - Memory Admission / Context Integrity Task-Pack
- WB2 - Read-only Memory/Context Inspector helper

## 2. Purpose

PR6 will define a future demo/evidence pack that proves HUQAN can show real runtime evidence through read-only inspection helpers.

The future pack must use real runtime outputs.
It must not use fake receipts, fake verdicts, fake memory admission records, fake context integrity signals, or hardcoded demo evidence.

This document is the task-pack only. It does not implement the demo/evidence pack.

## 3. Product Boundary

PR6 is a demo/evidence packaging gate, not a new runtime control feature.

It may package evidence from:

- real Trust Receipt / verdict outputs
- WB1 Trust Receipt Inspector helper
- real memory admission / context integrity outputs
- WB2 Memory/Context Inspector helper
- targeted regression test output
- full `npm test` output
- source file / commit / branch / PR metadata

It must not:

- create fake runtime evidence
- alter runtime behavior
- approve/reject actions
- mutate memory
- mutate graph state
- add public UI
- add external connector
- claim V5 readiness

## 4. Required Evidence Classes

The future PR6 evidence pack must include these evidence classes:

```txt
E1 - Receipt / Verdict Evidence
E2 - Memory Admission Evidence
E3 - Context Integrity Evidence
E4 - Read-only Invariant Evidence
E5 - Fail-closed Evidence
E6 - Regression Evidence
E7 - Non-claim / Boundary Evidence
```

## 5. WB1 Evidence Usage

Future PR6 implementation must use the WB1 helper:

```txt
lib/workbench/trust-receipt-inspector.js
```

Acceptable WB1 evidence:

- real `receiptId`
- real verdict if present
- real reason if present
- real workspace id if present
- real source metadata
- `source.readOnly: true`
- `not_found`, `invalid_request`, or `read_error` cases as fail-closed evidence

Forbidden:

- fake receipt id
- fake verdict
- synthetic receipt reconstruction
- hardcoded demo receipt
- replacing read errors with success-like output

## 6. WB2 Evidence Usage

Future PR6 implementation must use the WB2 helper:

```txt
lib/workbench/memory-context-inspector.js
```

Acceptable WB2 evidence:

- real memory admission status/decision/reason when present
- real context integrity status/flags when present
- real provenance when present
- real `receiptId` / `traceId` linkage when present
- `source.readOnly: true`
- `not_found`, `invalid_request`, or `read_error` cases as fail-closed evidence

Forbidden:

- fake memory admission record
- fake context integrity verdict
- fake provenance
- fake canonical mutation status
- synthetic context reconstruction
- hardcoded demo memory/context record

## 7. Claim Boundary

| Allowed claim | Evidence required | Forbidden wording |
| --- | --- | --- |
| HUQAN has read-only helpers for Trust Receipt / verdict inspection. | WB1 helper source path, real helper output, targeted WB1 test result. | production-ready enterprise control plane |
| HUQAN has read-only helpers for memory admission / context integrity inspection. | WB2 helper source path, real helper output, targeted WB2 test result. | all agents covered |
| The demo/evidence pack uses real runtime-derived evidence only. | Collected runtime output, exact commands, commit/PR metadata, no-mock declaration. | public release ready |
| The helpers are not UI/API/MCP inspector surfaces. | Changed-file list and explicit non-claim section. | all connectors covered |
| The evidence pack is a pre-V5 proof artifact. | PR6 checkpoint, post-merge smoke, V5 readiness audit reference. | V5 ready |

Additional forbidden wording:

- guarantees truth
- eliminates hallucinations
- prevents all unsafe actions
- marketplace ready
- certified / badge / conformance ready

## 8. No-Mock / No-Fake Rule

```txt
PR6_NO_MOCK_EVIDENCE_RULE:
Evidence used for PR6 must come from real runtime outputs, real helper reads, real tests, or real commit/PR metadata.

Mock examples may be included only if explicitly labeled as non-production illustrative examples.
Mock examples must not be used as proof of readiness, pitch evidence, release evidence, or V5 readiness evidence.
```

## 9. Future Implementation Candidates

Future implementation files are defined here for planning only. This PR does not create them.

Preferred future path:

```txt
docs/v4/v4-pr6-demo-evidence-pack.md
evidence/v4-pr6/README.md
```

Optional only if repo convention supports it:

```txt
scripts/v4-pr6-collect-evidence.js
test/v4-pr6-demo-evidence-pack.test.js
```

The future implementation PR must choose one narrow path.

If a script is added later:

- it must only collect/read evidence
- it must not create fake evidence
- it must not mutate runtime state
- it must not require external services
- it must not alter package files unless separately approved

## 10. Required Future Validation Commands

Future PR6 implementation must define/run:

```bash
npm ci
node --test test/v4-wb1-trust-receipt-inspector.test.js
node --test test/v4-wb2-memory-context-inspector.test.js
node --test test/v4-trust-receipt-read-api.test.js
node --test test/v4-mcp-tool-verdict-surface.test.js
node --test test/v4-receipt-materialization-read-index.test.js
node --test test/v4-memory-admission-context-integrity-surface.test.js
npm test
git diff --name-only <base>..HEAD
git status --short
```

## 11. Required Future Evidence Pack Contents

The future PR6 evidence pack must include:

- Current checkpoint
- Canonical branch and HEAD
- PR list / merged gate list
- Exact helper files used
- Exact tests run
- Exact test results
- Example real receipt/verdict inspection output
- Example real memory/context inspection output
- Fail-closed examples
- Read-only invariant statement
- Non-claims section
- V5 readiness prerequisites

## 12. V5 Transition Gate

PR6 does not open V5 automatically.

V5 may only be considered after:

```txt
1. PR6 task-pack merged
2. PR6 evidence implementation merged
3. post-merge smoke green
4. V5-READINESS-0 audit opened as separate gate
5. V5-READINESS-0 confirms evidence sufficiency and non-claim compliance
```

## 13. Non-Claims

This PR6 task-pack does not claim:

- PR6 demo/evidence pack is implemented
- Workbench UI exists
- API endpoint exists
- MCP inspector tool exists
- external users can self-serve connect agents
- production enterprise control plane is ready
- all connector/client paths are covered
- all unsafe actions are prevented
- memory writes are structurally impossible
- all context corruption is prevented
- HUQAN guarantees truth
- HUQAN eliminates hallucinations
- V5 readiness is achieved
- marketplace/badge/conformance is ready
- public release readiness

## 14. Future Exit Gate

Future PR6 task-pack exit gate:

```txt
V4_PR6_TASKPACK_READY_FOR_READ_ONLY_REVIEW
```

Future PR6 implementation exit gate:

```txt
V4_PR6_DEMO_EVIDENCE_PACK_READY_FOR_READ_ONLY_REVIEW
```

## Final Boundary

This task-pack is intentionally narrow:

- no demo implementation
- no demo runner
- no UI
- no API endpoint
- no MCP tool
- no CLI command
- no connector integration
- no approval mutation
- no memory mutation
- no graph write
- no receipt creation logic
- no fake receipts
- no fake verdicts
- no fake memory/context records
- no V5 readiness audit
- no V5 ecosystem blueprint
- no marketplace/badge/conformance
- no package/version change
