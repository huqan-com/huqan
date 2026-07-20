# REFACTOR-2D2 - Verify Claim Ownership Alignment

Status: Ownership decision and closeout record.

Repository: `ali-ulu/huqan`

Canonical base: `main @ 634002cf5edc2080f7ab97cbff8398d865b6dedf`

Previous checkpoint: `REFACTOR-2D1_VERIFY_CLAIM_CONTRACT_TESTS_CLOSEOUT_AUDIT_GREEN`

Next gate after closeout: `REFACTOR-2D4_CAPABILITY_EXECUTION_SOURCE_REALITY`

## Decision

The existing `VerifyService` is accepted as the internal implementation of the
`VerifyClaimUseCase` ownership boundary defined by REFACTOR-2B and REFACTOR-2D.

No additional pass-through use-case class will be introduced. Adding a module
whose only behavior is forwarding to `VerifyService` would duplicate naming
without moving algorithm ownership or reducing Kernel responsibility.

## Evidence

- `Kernel._verifyInternal` delegates verification to `VerifyService.verify`.
- `Kernel.detectContradictions` delegates contradiction inspection to
  `VerifyService.detectContradictions`.
- `Kernel.verify` retains critical-section ownership around the service call.
- `Kernel.verifyAsync` retains the current async wrapper behavior.
- KernelV2 retains its current risk/detail behavior around wrapped Kernel v1.
- `test/kernel-verify-claim-use-case-contract.test.js` locks exact delegation,
  result identity, error identity, async behavior, and contradiction arguments.
- Existing semantic, adversarial, entity-resolution, reasoning-trace,
  concurrency, and KernelV2 suites remain the algorithm-behavior authority.

## Ownership After Closeout

| Responsibility | Owner |
| --- | --- |
| Public verify facade and critical section | `Kernel` |
| Verify and contradiction algorithm | `VerifyService` |
| KernelV2 risk/detail compatibility behavior | `KernelV2` |
| Semantic/adversarial verification evidence | existing integration tests |
| Delegation and identity contract | verify claim contract test |

## Preserved Contracts

- no public method, type, export, or arity change;
- no verdict, confidence, evidence, metadata, receipt, or envelope change;
- no sync/async conversion;
- no new graph, persistence, audit, receipt, network, or filesystem write;
- no private VerifyService helper promoted to public API;
- no capability/plugin behavior change.

## Closeout

`REFACTOR-2D_VERIFY_CLAIM_USE_CASE` is complete when this decision is merged
and the docs-only closeout checks pass. Completion means ownership is explicit
and contract-tested; it does not mean the verify algorithm was rewritten.

Capability execution remains separate because it is asynchronous, policy
gated, and plugin-backed. Its source-reality gate is next.

## Allowed Scope

Exactly this file.

## Forbidden Scope

- runtime, declaration, test, fixture, schema, package, dependency, workflow,
  Docker, MCP, server, Graph, Memory, Persistence, V5, or Policy Auditor work;
- renaming or exporting VerifyService;
- capability execution changes;
- verification algorithm changes.

## Validation

- changed file is exactly this record;
- `git diff --check` passes;
- Security Checks passes;
- Benchmark Regression passes.

## Non-Claims

- no new runtime use-case class was added;
- verify behavior was not changed;
- capability execution was not decomposed;
- REFACTOR-3 and REFACTOR-4 have not started;
- the refactor program is not complete.
