# axiom-verify

`axiom-verify` is the minimal AXIOM verification package skeleton for ATP / AVP objects.

## What it does

- verifies ATP objects with the root conformance helpers
- verifies Trust Receipts
- verifies AVP-style verification results
- validates `.axiom` package drafts through the package format helper
- exposes a small, portable verification surface for builders

## Supported protocols

- ATP v0.1
- AVP v0.1
- `.axiom` package format v0.1

## Core principle

Every serious answer should come with a receipt.

That means `axiom-verify` should help callers check provenance, trust policy, audit trail, conflict state, and package validity without claiming absolute truth.

## Example

```js
const axiomVerify = require('axiom-verify');
const receiptResult = axiomVerify.verifyTrustReceipt(receipt);

if (!receiptResult.ok) {
  console.error(receiptResult.errors);
}
```

## Package format support

`.axiom` packages are exchange artifacts, not runtime storage.

`axiom-verify` can validate a package object or a package file path using the package-format helper.

## What it is not

- not a runtime storage engine
- not a mutation API
- not a server route
- not a dashboard
- not a cryptographic signing layer
- not a proof of absolute truth
