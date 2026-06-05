# V1 Causal Granite Readiness

Status: ready for sealing once the final multiverse determinism pack and docs are merged.

## Completed PRs

- V1-PR0: Causal Granite ADR and requirements
- V1-PR1: Causal edge schema and validators
- V1-PR2: Deterministic causal traversal
- V1-PR2.1: Core trust guard and numeric clamp
- V1-PR3: Causal verdict and trace output
- V1-PR4: Causal verdict to Trust Receipt bridge

## What is in V1

- frozen causal edge schema
- deterministic traversal with explicit stop reasons
- causal verdict and trace output
- additive causal block in Trust Receipt output
- numeric guardrails on graph trust inputs
- deterministic test coverage for the causal layer

## What is explicitly not in V1

- H-score or Hazard/Hallucination scoring
- high-risk domain admission gates
- medical, legal, finance, or security-specific policy gates
- exclusive relation ontology or semantic ontology rewrite
- plugin capability isolation or sandbox overhaul
- graph/storage/index performance refactor
- semantic negation/transitive trust hardening
- simulator or world-model runtime
- new server endpoints
- new UI surface
- package version bump or release tag

## Known backlog from Stress Lab

- Memory H-score / ranking
- Huqan H-score / hazard-hallucination score
- high-risk domain admission gate
- exclusive relation ontology
- plugin capability isolation
- graph/storage/index performance
- semantic negation/transitive trust hardening

These are real backlog tracks, but they are not shipped as part of V1.

## Current invariants

- deterministic causal traversal
- causal verdict trace is stable
- Trust Receipt bridge is additive
- `verify.status` is unchanged
- no audit write occurs in the causal bridge

## Final readiness checklist

- targeted causal tests pass
- full `npm test` passes
- no package drift
- no server/UI changes
- no stress-lab files staged

## Notes

V1 is a causal reasoning seal, not a claim that hallucinations are impossible.
It makes causal failure modes visible, deterministic, and reviewable before they can be treated as canonical.
