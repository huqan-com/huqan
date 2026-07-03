# HUQAN / AXIOM V4-WB1 Trust Receipt / Verdict Inspector

## Current checkpoint

```txt
V4_WB0_MERGED_POST_MERGE_SMOKE_GREEN
Canonical HEAD: 7df9c2cf8a206b1034a56ccba4142e9bb0c46813
```

V4-WB1 is the first Workbench follow-up gate after WB0. It defines a read-only
Trust Receipt / Verdict Inspector task-pack. It does not implement a UI,
Workbench screen, API endpoint, CLI command, MCP tool, approval flow, PR6 demo
pack, V5 readiness audit, marketplace, or package change.

## Purpose

V4-WB1 defines the narrow contract for inspecting real Trust Receipt and verdict
runtime outputs.

The inspector must help an operator answer:

```txt
What decision happened?
Which receipt proves it?
Which runtime source produced it?
Is the receipt valid, invalid, missing, or unavailable?
```

This document is a planning gate. Runtime implementation requires a separate
approved task-pack.

## Source surfaces

WB1 may only read from already-closed V4 runtime surfaces:

- V4-PR2 verdict reconciliation
- V4-PR2.5 Trust Receipt primitive
- V4-PR2.6 receipt read-index
- V4-PR3 Trust Receipt read API
- V4-PR4 MCP `toolVerdict` when a real `receiptId` exists

WB1 must not invent a receipt when these sources cannot provide one.

## Inspector contract

The future inspector is read-only.

Allowed future behavior:

- fetch a real receipt by `receiptId`
- display canonical verdict fields
- display receipt identity and hash fields
- display chain status when available from real validation
- display source metadata when present
- display explicit `not_found`, `invalid`, `unavailable`, or `unsupported`
  states when data is absent

Forbidden behavior:

- create receipts
- mutate memory
- approve or reject actions
- execute tools
- call MCP tools to generate demo state
- fabricate receipt ids
- fabricate `allow`, `review`, `block`, `dry_run_only`, `quarantine`, or
  `disabled` verdicts
- mark unknown receipts as verified
- reconstruct synthetic receipts from request/query input
- treat mock/demo data as product evidence

## Required data model

The future WB1 surface may display these fields only when they come from real
runtime data:

- `receiptId`
- `receiptKind`
- `verdict`
- `decision`
- `status`
- `receiptHash`
- `previousReceiptHash`
- `chainStatus`
- `workspaceId`
- `admissionId`
- `provenanceId`
- `trustPolicyVersion`
- `createdAt`
- `tool`
- `reason`
- `traceId`

Missing optional fields may be omitted or shown as `null`. They must not be
filled with invented values.

## Fail-closed behavior

WB1 must fail closed when a requested receipt cannot be proven from real
runtime state.

Required future states:

```txt
valid receipt        -> show receipt and verdict
unknown receiptId    -> not_found
empty receiptId      -> invalid_request
tampered receipt     -> invalid
broken chain         -> invalid
missing source       -> unavailable
unsupported source   -> unsupported
```

No state may silently degrade into `verified`, `allow`, or `valid`.

## No-mock boundary

WB1 inherits the WB0 no-mock rule.

Mock/demo paths may exist only when explicitly labeled as mock/demo. They must
not be used in production, pitch, investor, release, readiness, or V5 claims.

Forbidden mock claims:

- fake receipt id proves a real action
- fake verdict represents a real gate decision
- fake chain status proves integrity
- demo receipt proves connector coverage
- screenshot-only output proves runtime behavior

If the future inspector cannot reach real runtime output, it must say so and
stop.

## Implementation gate for future PR

WB1 implementation may start only after a separate explicit approval.

The future implementation PR must define:

- exact files to edit
- exact route, CLI, or local view surface, if any
- real data source
- fail-closed states
- tests for real receipt, unknown receipt, invalid receipt, and no mutation
- no-mock evidence

Recommended implementation order:

```txt
1. API/read module consumption check
2. minimal read-only inspector surface
3. no mutation tests
4. no synthetic receipt tests
5. post-merge smoke
```

This document does not authorize implementation.

## Non-claims

This task-pack does not claim:

- Workbench is implemented
- UI exists
- WB1 inspector exists
- approval execution exists
- all connector/client paths are covered
- all unsafe actions are prevented
- all kernel writes are structurally impossible without admission
- HUQAN guarantees truth
- HUQAN eliminates hallucinations
- production enterprise control plane is ready
- PR6 demo pack is complete
- V5 is ready
- marketplace, badge, or conformance work is ready

## Validation evidence required for this docs PR

This docs-only task-pack should validate:

```bash
npm ci
npm test
git diff --name-only 7df9c2cf8a206b1034a56ccba4142e9bb0c46813..HEAD
git status --short
```

Expected:

- `npm ci` pass
- `npm test` pass
- changed files remain docs-only
- no runtime/test/package/UI files changed
- no Workbench implementation started
- no PR6 or V5 work started
- `git status --short` clean after commit

## Final WB1 statement

V4-WB1 authorizes only a read-only Trust Receipt / Verdict Inspector task-pack.

It does not authorize runtime implementation, UI, approval mutation, MCP tool
creation, PR6 demo work, V5 readiness, marketplace, badges, conformance, or
public release claims.
