# AXIOM Trust Protocol (ATP) v0.1

ATP is the portable trust layer for AXIOM.

It defines how claims, provenance, verification results, conflict routing, and exportable trust state should be represented without tying the model to one storage engine.

## What ATP Is

ATP is a protocol for:

- provenance-bound claims
- deterministic trust outcomes
- conflict routing
- append-only audit surfaces
- portable exchange between AXIOM-compatible tools

## ATP vs. AVP

- **ATP** is the broader trust protocol.
- **AVP** is the verification subset of ATP.

AVP covers verify-facing request/response semantics. ATP covers provenance, routing, audit, and exchange beyond verification.

## Design Principles

1. Provenance first.
2. Deterministic trust outcomes.
3. Append-only auditability.
4. Portable exchange over backend coupling.
5. Public evolution starting at `0.1`.

## Minimal Claim

```json
{
  "subject": "autoLearn true",
  "relation": "CAUSES",
  "object": "unsupported output can enter graph"
}
```

## Minimal Provenance Record

```json
{
  "provenanceId": "prov_001",
  "sourceRef": "docs/shield-policy.md#autolearn",
  "sourceTitle": "Shield Policy",
  "sourceType": "document",
  "actor": "system",
  "timestamp": "2026-06-02T00:00:00Z",
  "confidence": 0.92,
  "workspaceId": "default",
  "trustPolicyVersion": "trust-policy-v0"
}
```

## Minimal Claim Passport

```json
{
  "claimId": "claim_001",
  "subject": "autoLearn true",
  "relation": "CAUSES",
  "object": "unsupported output can enter graph",
  "polarity": true,
  "confidence": 0.92,
  "provenanceId": "prov_001",
  "workspaceId": "default",
  "createdAt": "2026-06-02T00:00:00Z",
  "updatedAt": "2026-06-02T00:00:00Z",
  "status": "canonical",
  "trustPolicyVersion": "trust-policy-v0"
}
```

## Minimal Verification Result

```json
{
  "label": "graph-backed",
  "status": "dogrulandi",
  "confidence": 0.92,
  "evidence": [
    {
      "kind": "direct_edge",
      "text": "autoLearn true --[CAUSES]--> unsupported output can enter graph",
      "confidence": 0.92
    }
  ],
  "workspaceId": "default",
  "trustPolicyVersion": "trust-policy-v0"
}
```

## Conflict Result

```json
{
  "routing": "flag",
  "conflictType": "contradiction",
  "existingClaimId": "claim_001",
  "reason": "new claim conflicts with canonical graph",
  "workspaceId": "default"
}
```

## Verification Labels

AVP-compatible verification labels remain:

- `graph-backed`
- `llm-assisted`
- `unsupported`
- `contradicted`

## Trust Receipt

A Trust Receipt is a compact proof that a claim was verified under a specific trust policy and workspace context.

```json
{
  "receiptId": "receipt_001",
  "claimId": "claim_001",
  "label": "graph-backed",
  "verifiedAt": "2026-06-02T00:00:00Z",
  "workspaceId": "default",
  "trustPolicyVersion": "trust-policy-v0"
}
```

## Claim Passport

A Claim Passport is the identity and trust envelope for a claim. In `0.1` it is documented as a portable record shape, not a required runtime class.

## `.axiom` Package Format

```json
{
  "format": "axiom",
  "version": "0.1",
  "workspaceId": "default",
  "exportedAt": "2026-06-02T00:00:00Z",
  "claims": [],
  "nodes": [],
  "edges": [],
  "provenance": [],
  "audit": [],
  "pendingClaims": [],
  "rejectedClaims": [],
  "signatures": []
}
```

## Storage Model

ATP is storage-agnostic.

- SQLite is the intended first canonical runtime store for v0.8.
- An adapter layer should isolate trust semantics from backend specifics.
- `.axiom` is an exchange package, not a live runtime mutation engine.

## Future Conformance Badge

The future **ATP Compatibility Badge** should indicate that a tool:

- preserves provenance fields
- exposes AVP-compatible verification labels
- supports conflict routing semantics
- passes an ATP conformance suite

No badge process is defined in `0.1`.

## What ATP Is Not

ATP is not:

- a full world model
- a full enterprise governance suite
- a probabilistic prediction engine
- a guarantee that every source is true
- a claim that `0.1` is final
