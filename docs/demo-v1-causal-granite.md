# V1 Causal Granite Demo

This document shows the sealed V1 causal flow end to end:

1. causal edge schema
2. deterministic traversal
3. causal verdict and trace
4. Trust Receipt additive causal block

The causal layer is a signal layer. `causal.supports` is not the same thing as `verify.status = dogrulandi`.
Final trust admission still belongs to the higher semantic and trust gates.

## What V1 Causal Granite does

V1 gives AXIOM a deterministic causal layer that can:

- represent causal edges with frozen schema contracts
- traverse the graph in a stable order
- distinguish `MAX_DEPTH_EXCEEDED` from `CYCLE_DETECTED`
- produce a causal verdict and trace
- attach an additive causal block to a Trust Receipt

V1 does not implement simulation, world-model projection, or verifier rewrite.

## Causal edge schema

The V1 edge contract keeps the current relation set and reserves future fields as `null` doors:

- `temporal`
- `probability`
- `formalProof`
- `worldModel`
- `causalProjection`
- `counterfactualTrace`
- `simulationReceipt`

## Traversal example

Scenario:

- `A CAUSES B`
- `B ENABLES C`
- `C PREVENTS D`

Traversal summary:

- start: `A`
- stop reason: `terminus`
- visited edges: `3`
- visited nodes: `4`
- max depth reached: `3`
- blocked branches: `0`

The traversal is deterministic because the edge order is stable and the same graph snapshot always produces the same path order.

## Traversal semantics

`MAX_DEPTH_EXCEEDED` and `CYCLE_DETECTED` are separate outcomes.

- `MAX_DEPTH_EXCEEDED` means partial traversal and a warning.
- `CYCLE_DETECTED` means the branch is hard-stopped because the path loops back into itself.

This distinction matters because the same graph can be incomplete without being cyclic.

## Causal verdict example

From the traversal above, the causal verdict can be:

- status: `supports`
- confidence: deterministic numeric score in `[0, 1]`
- warnings: may include `PREVENTS_SIGNAL`
- risk flags: may include `prevents_signal`
- trace: the traversal summary and branch notes

Again: `supports` is a causal-layer signal, not a verified truth label.

## Trust Receipt causal block example

When a causal verdict is provided to `buildTrustReceipt(...)`, the receipt gets an additive `causal` block:

```js
{
  status: "supports",
  confidence: 0.72,
  bridge: "pass",
  warnings: ["PREVENTS_SIGNAL"],
  riskFlags: ["prevents_signal"],
  trace: {
    startId: "A",
    stopReason: "terminus",
    traversalSummary: { ... }
  },
  source: "causal-verdict",
  version: "1.0.0"
}
```

Bridge values:

- `supports` -> `pass`
- `contradicts` -> `fail`
- `cycle_blocked` -> `blocked`
- `depth_incomplete` -> `incomplete`
- `inconclusive` -> `not_applicable`

`bridge: pass` only means the causal layer did not block the receipt. It does not mean verified truth.

## Output summary

For the example above:

- traversal output: stable path `A -> B -> C -> D`
- verdict output: `supports`
- receipt output: canonical receipt plus additive causal block

The causal layer is deterministic by design. If the input graph snapshot, claim, and config do not change, the traversal, verdict, and receipt bridge should remain stable.
