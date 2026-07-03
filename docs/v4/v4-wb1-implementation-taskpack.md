# HUQAN / AXIOM V4-WB1 Implementation Task-Pack - Trust Receipt / Verdict Inspector

## Current checkpoint

```txt
V4_WB1_MERGED_POST_MERGE_SMOKE_GREEN
Canonical HEAD: 9d2c79e343a5470d0378b8d28bd14b7c4eee2c27
```

This task-pack defines the exact implementation boundary for V4-WB1. It does
not implement WB1.

## Purpose

WB1 implementation will create the first read-only inspector surface for real
Trust Receipt and verdict data.

It must only read existing runtime outputs. It must not create, mutate,
reconstruct, or fake receipts. It must not execute tools or approve actions.

This task-pack exists so the later implementation PR can stay narrow,
testable, and no-mock.

## Product boundary

WB1 is defined as:

```txt
A read-only Trust Receipt / Verdict Inspector connected to real HUQAN runtime evidence.
```

It may display real fields when present:

- receipt id
- verdict
- reason
- actor if present
- workspace id if present
- tool/action/claim if present
- timestamp if present
- trace id if present
- source/read path
- receipt materialization state
- missing-data reason

It must not:

- create receipt
- mutate receipt
- synthesize receipt
- approve/reject
- mutate memory
- execute tools
- write graph state
- claim complete Workbench

## Existing source surfaces

Allowed future implementation sources:

```txt
- PR2 verdict reconciliation
- PR2.5 Trust Receipt primitive
- PR2.6 receipt read-index
- PR3 Trust Receipt read API
- PR4 MCP toolVerdict, when applicable
```

The implementation must use real source surfaces only. If a source cannot
provide real data, WB1 must report that state explicitly instead of filling the
gap with mock data.

## Exact implementation candidates

The future implementation PR may choose only one minimal path, selected by repo
reality.

Option A - server/read API helper path:

```txt
lib/workbench/trust-receipt-inspector.js
test/v4-wb1-trust-receipt-inspector.test.js
```

Option B - public static inspector path, only if no runtime mutation and no fake
data:

```txt
public/workbench/trust-receipt-inspector.html
test/v4-wb1-trust-receipt-inspector.test.js
```

Option C - CLI/read-only utility path, only if UI is deferred:

```txt
scripts/v4-wb1-inspect-receipt.js
test/v4-wb1-trust-receipt-inspector.test.js
```

The future implementation PR must choose one path only. Do not combine API
helper, UI, and CLI in one PR.

## Preferred implementation path

Preferred WB1 implementation:

```txt
read-only server/helper + targeted test first.
```

Reason:

```txt
This proves real receipt/verdict inspection before any UI surface exists.
UI can come later after read contract is proven.
```

## Read-only invariant

```txt
WB1_READ_ONLY_INVARIANT:
For the same input state, WB1 inspection must not change:
- receipts
- memory
- graph
- approval queue
- MCP tool state
- package/version files
- runtime artifacts
```

The implementation PR must prove this with tests or explicit state snapshots.

## Fail-closed behavior

Future implementation behavior:

```txt
If receiptId is missing:
return explicit not_found / invalid_request, not fake data.

If receipt does not exist:
return not_found, not synthetic receipt.

If receipt exists but fields are missing:
return partial receipt with missingFields list.

If receipt read API fails:
return read_error with reason.

If workspace mismatch is detected:
return forbidden_or_not_found, never cross-workspace leakage.
```

WB1 must never silently convert missing, partial, invalid, or unavailable data
into a verified receipt.

## No-mock rule

```txt
No fake receipt ids.
No fake verdicts.
No hardcoded demo receipts.
No synthetic receipt reconstruction.
No mock data in production/pitch/release/readiness claims.
```

Mock/demo fixtures may only appear in tests or explicitly labeled demos. They
must not be presented as product evidence.

## Required future tests

Future WB1 implementation tests:

```txt
1. reads a real materialized receipt by receiptId
2. exposes verdict/reason fields without mutation
3. returns not_found for unknown receiptId
4. does not synthesize receipt data
5. does not create new receipts during inspection
6. does not mutate memory or graph during inspection
7. respects workspace boundary
8. surfaces partial/missing fields explicitly
9. preserves PR3 Trust Receipt read API behavior
10. preserves PR4 MCP toolVerdict behavior
```

The tests must cover both successful real-data reads and fail-closed paths.

## Future validation commands

Future implementation validation:

```bash
npm ci
node --test test/v4-wb1-trust-receipt-inspector.test.js
node --test test/v4-trust-receipt-read-api.test.js
node --test test/v4-mcp-tool-verdict-surface.test.js
node --test test/v4-receipt-materialization-read-index.test.js
npm test
git diff --name-only <base>..HEAD
git status --short
```

Expected implementation result:

- targeted WB1 tests pass
- PR3 receipt API regression passes
- PR4 toolVerdict regression passes
- full `npm test` passes
- no runtime artifacts staged
- no unrelated scope drift

## Non-claims

This task-pack does not claim:

- WB1 is implemented
- Workbench UI exists
- production enterprise control plane is ready
- all connector/client paths are covered
- all unsafe actions are prevented
- HUQAN guarantees truth
- HUQAN eliminates hallucinations
- PR6 has started
- V5 is ready
- marketplace/badge/conformance is ready

## Future PR exit gate

Future implementation exit gate:

```txt
V4_WB1_IMPLEMENTATION_READY_FOR_READ_ONLY_REVIEW
```

Required evidence:

- exact files changed
- targeted WB1 inspector test pass
- PR3 receipt API regression pass
- PR4 toolVerdict regression pass
- full npm test pass
- no memory/graph/approval mutation during inspection
- no fake receipt/verdict data
- worktree clean

## Validation commands for this docs-only PR

```bash
npm ci
npm test
git diff --name-only 9d2c79e343a5470d0378b8d28bd14b7c4eee2c27..HEAD
git status --short
```

Expected:

- `npm ci` pass
- `npm test` pass
- changed files remain docs-only
- no runtime/test/package/UI files changed
- `git status --short` clean after commit

## Final statement

This PR defines the WB1 implementation task-pack only.

It does not implement the Trust Receipt / Verdict Inspector, Workbench UI,
approval mutation, memory mutation, graph writes, PR6 demo pack, V5 readiness,
marketplace, badges, conformance, or public release claims.
