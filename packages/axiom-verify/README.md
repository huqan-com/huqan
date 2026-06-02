# axiom-verify

`axiom-verify` is the minimal package boundary for the AXIOM Verify Protocol work in v0.8.

This package skeleton exists to define a stable verification-facing entrypoint without changing the core runtime.

## Current surface

- ATP / AVP object validation helpers
- Trust Receipt construction helpers
- provenance, audit, candidate, and trust graph query helpers

## Status

- version: `0.1.0`
- maturity: skeleton
- scope: no mutation endpoints, no auth layer, no transport layer

## Intent

The package will eventually become the publishable verify-side entrypoint for ATP/AVP-compatible systems.

For now it is a thin boundary over the current local verification helpers.

## What it is not

- not a standalone server
- not a mutation API
- not a replacement for the Trust Kernel
- not a release artifact for v0.8 yet
