# V5-VERIFICATION-25B0 - Signed-Content Binding Scope Definition

**Mode:** docs-only security contract definition
**Current checkpoint:** `V5-VERIFICATION-25A6_CLOSEOUT_AUDIT_GREEN`
**Canonical branch:** `main`
**Required base:** `main @ b403bd2ac3d9cda96f4d93d2da7a8c70c3a92d37`

## Purpose

`V5-VERIFICATION-25B0` defines the signed-content binding contract that must
exist before any signed-content composition, digest helper, canonical bytes
helper, or cryptographic verification composition work starts.

This document answers the core question:

```txt
Which exact canonical byte sequence is a signature verification claim bound to?
```

This gate does not implement signed-content binding. It defines the contract
that later fixtures, tests, helpers, and composition gates must prove.

## Evidence Tags

Every normative statement in this document uses one of these labels:

- `OBSERVED`: present in the current repository.
- `DERIVED`: follows from current repository contracts.
- `PROPOSED`: selected by this scope definition for future gates.
- `HUMAN_DECISION_REQUIRED`: selected as a recommendation, but still requires
  explicit approval before implementation.
- `OUT_OF_SCOPE`: deliberately not included in this gate.

## Current Repository Evidence

`OBSERVED` The existing cryptographic profile contract in
`lib/v5/cryptographic-profile-contract.js` defines:

- profile identifier: `ed25519-v1`
- signed-content mode: `canonical-message-bytes`
- canonicalization: `json-stable-v1`
- text encoding: `utf-8`
- future runtime primitive: `node:crypto`
- adapter input keys: `algorithm`, `messageBytes`, `publicKeySpkiDer`,
  `signatureBytes`
- message byte bound: 1 through 1,048,576 bytes
- public key material: 44-byte Ed25519 SPKI DER bytes
- signature material: 64-byte raw Ed25519 signature bytes

`OBSERVED` `encodeJsonStableV1(value)` serializes only bounded JSON-like
values, sorts object keys lexically by JavaScript string order, encodes UTF-8
bytes, rejects non-finite numbers, serializes negative zero as `0`, rejects
sparse arrays, rejects accessors, rejects inherited enumerable state, rejects
custom `toJSON`, rejects symbols, rejects cycles, and rejects byte output larger
than 1,048,576 bytes.

`OBSERVED` `V5-VERIFICATION-25A` and later resolver-binding gates define that
the trusted-key resolver is the sole owner of selected public verification key
bytes for a `keyReference`. The adapter must not receive independent caller
key material that bypasses resolver selection.

`OBSERVED` Verification status remains bounded to:

```txt
verified
not_verified
```

`OBSERVED` Existing verification reason categories include:

```txt
signature_valid
missing_signature_evidence
malformed_signature_evidence
payload_digest_mismatch
unsupported_algorithm
unknown_key
revoked_key
expired_key_metadata
key_lookup_unavailable
malformed_trusted_key_record
payload_identity_mismatch
forbidden_trust_claim
forbidden_authorization_claim
forbidden_exchange_claim
```

`DERIVED` The missing V25B contract is not key selection and not raw signature
verification. The missing contract is the exact message and context binding
that produces the `messageBytes` later supplied to the cryptographic adapter.

## Object Separation

`PROPOSED` Future signed-content evaluation must distinguish these objects:

1. Caller-provided semantic payload.
2. Canonical signed-content envelope.
3. Digest and signature verification inputs.

`PROPOSED` A caller must never be allowed to supply these three objects as
independent, mutually inconsistent claims. Later composition must derive
canonical bytes and digest inputs from one bounded signed-content envelope.

## Canonical Signed Bytes

`PROPOSED` The canonical byte sequence is:

```txt
canonicalSignedBytes =
  encodeJsonStableV1(signedContentEnvelopeV1)
```

`PROPOSED` The signed content envelope is a bounded plain JSON object with
exactly these logical fields:

| Field | Decision | Rationale |
| --- | --- | --- |
| `domainLabel` | included | prevents cross-protocol replay |
| `canonicalization` | included | binds the serialization contract |
| `contentType` | included | prevents binary/text and semantic-type confusion |
| `contentVersion` | included | prevents version downgrade or cross-version replay |
| `payloadEncoding` | included | binds the representation of payload bytes or JSON payload |
| `payload` | included for V1 | V1 keeps payload attached to avoid detached ambiguity |
| `payloadDigest` | derived and included | binds digest to canonical payload bytes |
| `digestAlgorithm` | included | prevents digest algorithm substitution |
| `keyReference` | included | binds the signature claim to the intended key reference |
| `receiptId` | included when present in the trust object | prevents cross-receipt replay |
| `packageId` | included when present in the trust object | prevents cross-package replay |
| `workspaceId` | included when present in the trust object | prevents cross-workspace replay |
| `agentId` | included when present in the trust object | prevents cross-agent replay |
| `issuedAt` | included | binds the claim issuance instant |
| `routeReceiptId` | included when present | binds route handoff context |
| `reasoningMetadataDigest` | derived and included when reasoning metadata is present | avoids signing mutable free-form metadata |
| caller-supplied `messageBytes` | forbidden caller control | message bytes are derived only |
| caller-supplied independent `payloadDigest` | forbidden caller control for V1 | digest is recomputed by the binding layer |
| unsigned security-relevant extra fields | forbidden caller control | prevents ambiguous unsigned claims |

`PROPOSED` The exact future helper may choose a stricter subset if repository
fixtures prove a narrower V1 surface. It may not omit fields that are present
and security-relevant to package, receipt, workspace, agent, key, canonical
format, digest, or domain binding.

## Canonicalization

`OBSERVED` The current repository already defines `json-stable-v1` through
`encodeJsonStableV1`.

`PROPOSED` The signed-content binding label for future V25B fixtures is:

```txt
huqan-signed-content-json-v1
```

`PROPOSED` This label maps to the existing `json-stable-v1` byte encoder and
adds the signed-content envelope rules in this document.

`PROPOSED` Canonicalization rules:

| Question | Decision |
| --- | --- |
| Object key ordering | existing `json-stable-v1` sorted own enumerable string keys |
| Unicode normalization | no silent normalization; byte-distinct strings remain distinct |
| Whitespace | no insignificant whitespace outside JSON string escaping |
| Number serialization | existing finite JSON number serialization |
| Negative zero | encoded as `0` by existing encoder |
| `NaN` and `Infinity` | rejected |
| Duplicate JSON keys | rejected before object materialization by future parser/fixture gates |
| `undefined`, `BigInt`, function, symbol | rejected |
| Binary payload | encoded as explicit representation, not implicit Buffer serialization |
| Line endings | no normalization; payload bytes or strings remain explicitly represented |
| Accessors and inherited enumerable state | rejected by existing encoder |

`HUMAN_DECISION_REQUIRED` Unicode normalization policy must be approved before
implementation. This document recommends no normalization for V1 because it
avoids silently collapsing byte-distinct user content into one signed claim.

## Digest Algorithm

`HUMAN_DECISION_REQUIRED` Recommended V1 digest algorithm:

```txt
SHA-256
```

Security rationale:

- broadly interoperable;
- sufficient for the current signed-content digest binding role;
- smaller output than SHA-384 or SHA-512 for fixtures and package fields;
- already familiar to the ecosystem.

`PROPOSED` Algorithm agility must be allowlist-only:

```txt
sha-256
```

Unknown digest algorithms fail closed. Callers cannot select arbitrary
algorithms, aliases, casing variants, or fallback modes.

`HUMAN_DECISION_REQUIRED` SHA-384 and SHA-512 remain future options only after a
separate compatibility and migration decision.

## Payload And Digest Relation

`PROPOSED` The invariant is:

```txt
payloadDigest == HASH(canonicalPayloadBytes)
```

`PROPOSED` For V1, `payloadDigest` is derived by the signed-content binding
layer and included in the signed envelope. A caller-provided independent digest
is not accepted as authoritative input.

`PROPOSED` If a future gate allows caller-provided `payloadDigest`, that gate
must recompute the digest from canonical payload bytes and require exact match
before any signature evidence is evaluated.

`DERIVED` This prevents:

```txt
payload A
+ digest for payload B
+ signature over unrelated bytes
```

from becoming a coherent verification claim.

## Detached Payload

`HUMAN_DECISION_REQUIRED` Recommended V1 policy:

```txt
V1 scope does not support detached payloads.
```

Security rationale:

- the current repository has no detached payload availability contract;
- no locator trust model exists;
- no content-length binding contract exists;
- allowing digest-only payloads would move critical availability and
  substitution decisions into an unimplemented surface.

`OUT_OF_SCOPE` Detached payload support is a future separate contract. If later
approved, it must bind content length, content type, digest algorithm, external
locator semantics, locator integrity, and availability failure behavior.

## Receipt And Package Binding

`PROPOSED` A signature over content alone is insufficient for HUQAN V5 package
flows. The signed envelope must bind available trust-object context:

```txt
packageId
receiptId
keyReference
workspaceId
agentId
routeReceiptId
policyVersion or policy digest when present
reasoningMetadataDigest when reasoning metadata is present
```

`PROPOSED` Required replay invariant:

```txt
same valid signature
+ same payload bytes
+ different receipt or package context
-> must not silently verify as the same claim
```

`HUMAN_DECISION_REQUIRED` Exact mandatory context fields depend on the future
package/receipt fixture corpus. This document recommends at least `packageId`,
`receiptId`, `keyReference`, `domainLabel`, `canonicalization`, and
`digestAlgorithm` for every signed-content claim that participates in a trust
package or receipt.

## Signature Input Structure

`PROPOSED` Future signature input must be domain-separated, versioned,
length-bounded, and canonicalized. Raw concatenation is forbidden.

Forbidden structure:

```txt
payload || receiptId || keyReference
```

Recommended logical structure:

```txt
{
  "domainLabel": "HUQAN/V5/SIGNED-CONTENT/v1",
  "canonicalization": "huqan-signed-content-json-v1",
  "digestAlgorithm": "sha-256",
  "contentType": "...",
  "contentVersion": "...",
  "payloadEncoding": "...",
  "payload": ...,
  "payloadDigest": "...",
  "keyReference": "...",
  "contextBinding": {
    "packageId": "...",
    "receiptId": "...",
    "workspaceId": "...",
    "agentId": "...",
    "routeReceiptId": "..."
  },
  "issuedAt": "..."
}
```

`PROPOSED` The future helper may flatten this structure if fixtures prove a
simpler canonical envelope. It must preserve domain separation, version labels,
digest binding, key binding, and context binding.

## Domain Separation

`PROPOSED` The V1 domain label is:

```txt
HUQAN/V5/SIGNED-CONTENT/v1
```

`PROPOSED` `domainLabel` is part of the canonical signed bytes. A valid
signature for another HUQAN claim type, another version, another protocol, or
another application must not verify as V5 signed content.

## Ambiguity Rejection

`PROPOSED` Future signed-content binding must fail closed for:

- duplicate keys before object materialization;
- ambiguous Unicode forms when the policy requires exact byte identity;
- unsupported numeric values;
- mixed binary/text encoding;
- unknown canonicalization label;
- unknown content version;
- unknown digest algorithm;
- extra unsigned security-relevant fields;
- missing required fields;
- multiple equivalent encodings;
- caller-provided bytes that disagree with derived bytes;
- caller-provided digest that disagrees with recomputed digest if a later gate
  ever allows caller-provided digest input.

## Provisional Error Taxonomy

`PROPOSED` Future fixture gates may use these docs-level categories:

```txt
unsupported_canonicalization
unsupported_digest_algorithm
malformed_signed_content
payload_digest_mismatch
content_binding_mismatch
detached_payload_not_supported
signature_input_ambiguous
```

`PROPOSED` These are provisional signed-content binding categories. They are
not yet runtime API values and do not expand the current verification-core
reason vocabulary.

## Threat Model

| Attack | Violated invariant | Required rejection behavior | Future gate |
| --- | --- | --- | --- |
| payload substitution | one claim binds one canonical message | `content_binding_mismatch` | 25B1/25B3 |
| digest substitution | digest derives from canonical payload bytes | `payload_digest_mismatch` | 25B1/25B5 |
| message bytes separated from payload | caller cannot choose payload and bytes independently | `signature_input_ambiguous` | 25B3/25B4 |
| valid signature reused with different receipt | context must be signed | `content_binding_mismatch` | 25B1/25B3 |
| valid signature reused with different package | context must be signed | `content_binding_mismatch` | 25B1/25B3 |
| canonicalization downgrade | canonicalization label is signed and allowlisted | `unsupported_canonicalization` | 25B2 |
| algorithm downgrade | digest algorithm is signed and allowlisted | `unsupported_digest_algorithm` | 25B2/25B5 |
| duplicate-key ambiguity | one object has one representation | `signature_input_ambiguous` | 25B2 |
| Unicode ambiguity | equivalent-looking content must not silently collapse | `signature_input_ambiguous` | 25B2 |
| binary/text confusion | payload encoding is signed | `malformed_signed_content` | 25B1/25B2 |
| truncation | length-bounded canonical bytes and digest mismatch | `payload_digest_mismatch` | 25B5 |
| prefix/suffix concatenation ambiguity | raw concatenation forbidden | `signature_input_ambiguous` | 25B3 |
| cross-protocol replay | domain label is signed | `content_binding_mismatch` | 25B1/25B3 |
| cross-agent replay | agent context is signed when present | `content_binding_mismatch` | 25B1/25B3 |
| cross-workspace replay | workspace context is signed when present | `content_binding_mismatch` | 25B1/25B3 |

## Required Invariants

`PROPOSED` One semantic signed-content object has one canonical byte
representation.

`PROPOSED` One verification claim binds one key, one canonical message, one
signature, and one context.

`PROPOSED` Caller cannot independently choose payload, digest, and signed bytes.

`PROPOSED` Unknown canonicalization or digest algorithm fails closed.

`PROPOSED` Security-relevant context cannot remain unsigned.

`PROPOSED` Equivalent-looking but byte-distinct payloads do not silently
collapse.

`PROPOSED` The same signature cannot be replayed across receipt, package,
workspace, agent, or domain contexts.

## Future Gate Map

| Gate | Goal | Classification | Allowed files | Forbidden files | Dependencies | Acceptance evidence | Stop conditions |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `V5-VERIFICATION-25B0` | define signed-content binding scope | docs-only | this document | runtime, tests, fixtures, package files | V25A6 closeout | diff check, scope review, independent review | source conflict or unresolved human decision |
| `V5-VERIFICATION-25B1_CANONICAL_SIGNED_CONTENT_FIXTURES` | add signed-content fixture corpus | fixture-only | future `test/fixtures/v5/signed-content-binding/*.json` | runtime, schema, package, docs except fixture inventory if separately approved | 25B0 closeout | JSON parse, fixture count, threat coverage | fixture shape ambiguity |
| `V5-VERIFICATION-25B2_CANONICALIZATION_CONTRACT_TESTS` | lock canonicalization and ambiguity rules | test-only | future focused canonicalization test file | runtime helper, crypto, package files | 25B1 closeout | targeted tests, full suite | duplicate-key parser gap or unsupported input representation |
| `V5-VERIFICATION-25B3_CANONICAL_BYTES_HELPER_TESTS` | define executable canonical bytes contract | test-only | future canonical bytes helper test file | helper implementation | 25B2 closeout | failing tests expected only if implementation absent, or explicit task-pack decision | required helper surface exceeds scope |
| `V5-VERIFICATION-25B4_CANONICAL_BYTES_HELPER_IMPLEMENTATION` | implement bounded canonical bytes helper | implementation | one helper module and one direct test file | crypto adapter, resolver, verification core, package files | 25B3 and task-pack approval | targeted and full tests | new runtime vocabulary or crypto dependency required |
| `V5-VERIFICATION-25B5_DIGEST_BINDING_ADVERSARIAL_TESTS` | prove digest/message/context mismatch rejection | test-only | one adversarial test file | runtime changes | 25B4 closeout | adversarial tests, full suite | helper cannot express required mismatch |
| `V5-VERIFICATION-25B6_SIGNED_CONTENT_BINDING_CLOSEOUT_AUDIT` | close signed-content binding layer | read-only audit | none | all edits | 25B5 closeout | source/evidence/claim reconciliation | scope drift or claim overreach |

## Explicit Non-Scope

`OUT_OF_SCOPE` This gate does not authorize:

- signature verification implementation;
- crypto adapter change;
- private-key handling;
- signing runtime;
- Trust Package writer changes;
- Trust Package reader changes;
- A2A transport;
- connector enforcement;
- MCP enforcement;
- marketplace behavior;
- certificate chain validation;
- PKI or revocation infrastructure;
- remote key fetching;
- resolver changes;
- verification-core changes;
- package trust decisions;
- action authorization decisions;
- V5 completion claims.

## Human Decisions

| Decision | Options | Recommended option | Security rationale | Compatibility impact | Migration impact | Human approval required |
| --- | --- | --- | --- | --- | --- | --- |
| digest algorithm | SHA-256, SHA-384, SHA-512 | SHA-256 | balanced interoperability and security for digest binding | aligns with common tooling | future migration possible through allowlist versioning | yes |
| canonicalization format | existing `json-stable-v1`, new canonicalizer | `huqan-signed-content-json-v1` over existing `json-stable-v1` | reuses observed bounded encoder and adds signed-content envelope | minimal new behavior | future version label can migrate | yes |
| domain label | generic, HUQAN V5 specific | `HUQAN/V5/SIGNED-CONTENT/v1` | prevents cross-protocol replay | requires fixtures to include label | future versions need explicit label changes | yes |
| detached payload support | supported, unsupported | unsupported in V1 | avoids locator and availability ambiguity | attached payloads only | detached migration needs separate gates | yes |
| caller-provided digest policy | accept, recompute-match, derive-only | derive-only in V1 | prevents digest/message separation | callers stop supplying authoritative digest | later compatibility can add recompute-match | yes |
| receipt/package fields | payload only, package only, receipt and package, full context | receipt and package plus available workspace/agent context | prevents replay across trust objects | requires context-aware fixtures | package evolution must version context | yes |
| Unicode normalization | normalize, reject ambiguity, preserve exact | preserve exact with no silent normalization | avoids collapsing distinct claims | clients must canonicalize before submission if needed | future normalization needs new label | yes |
| binary payload representation | raw bytes, base64 field, hex field, unsupported | explicit representation field in envelope | prevents binary/text confusion | requires fixture decision | representation migration needs version bump | yes |
| timestamp inclusion | no timestamp, `issuedAt`, validity window | include `issuedAt` | binds issuance context without creating trust | requires deterministic fixtures | future validity windows need separate policy | yes |
| workspace/agent identity inclusion | exclude, optional, required when present | include when present in trust object | prevents cross-workspace and cross-agent replay | package contexts must expose stable IDs | missing legacy fields require migration policy | yes |

## Closeout Criteria

This docs-only gate may close only if:

- the only changed repository file is this document;
- `git diff --check` passes;
- no runtime, fixture, test, schema, package, MCP, writer, reader, resolver, or
  crypto adapter files change;
- the document does not claim signed-content binding exists;
- the document does not claim cryptographic verification is complete;
- the document does not claim V5 is complete;
- all human decisions are explicit and not hidden as unresolved prose.

## Recommended Next Gate

`V5-VERIFICATION-25B1_CANONICAL_SIGNED_CONTENT_FIXTURES`

That gate, if separately approved, must remain fixture-only and must not add a
canonical bytes helper, digest helper, crypto implementation, resolver
composition, or verification runtime change.
