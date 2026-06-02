# ATP v0.1 Conformance

This directory holds the lightweight conformance reference for AXIOM Trust Protocol v0.1.

## What it checks

- required fields
- enum values
- confidence ranges
- timestamp parseability
- provenance / trust receipt integrity
- AVP and ATP object shape compatibility
- causal chain and simulation payload sanity

## How to run

```bash
node --test lib/atp-conformance.test.js
```

The helper implementation lives in `lib/atp-conformance.js`.
