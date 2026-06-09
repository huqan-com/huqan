# HUQAN / AXIOM Roadmap

> Models generate. Agents act. Memory stores. HUQAN judges.

## Current Phase — Post-V2.6 / Real User Smoke

Current status:

* V2.5 Agent Brake Layer sealed
* V2.6 MCP Runtime Integration complete
* AB0 → AB6 complete
* AB2 hardening complete: network mutation gate
* AB6 hardening complete: temp artifact isolation
* metadata cleanup complete
* final MCP private alpha smoke passed
* Show HN package ready

Current focus:

* fresh install smoke
* npm ci
* npm test
* server smoke
* MCP private alpha smoke
* real user scenarios
* memory / verify / gate behavior checks
* user value validation: can a user see value in 10 minutes?

Required MCP smoke behavior:

* axiom.ask → allow
* axiom.verify → allow
* axiom.learn → review
* axiom.agent → dry_run_only
* unknown tool → block

Rules for current phase:

* No V3 implementation before smoke
* No Dream
* No Self-Healer
* No plugin expansion
* No UI rewrite
* No TypeScript migration
* No Rust rewrite
* No broad refactor
* No dirty root
* Do not stage agent.memory.json

## Pre-V3 Security & Release Hygiene Gate

Before V3 implementation starts, HUQAN / AXIOM must pass a focused security and release hygiene gate.

This gate is not a feature sprint.
It must not introduce new product scope.
It exists only to make sure the current Post-V2.6 system is safe enough to continue.

Required checks:

* clean clone works
* npm ci works
* npm test passes
* MCP private alpha smoke passes
* server smoke passes
* package-lock drift is inspected before commit
* agent.memory.json remains untracked and unstaged
* no dirty root is used
* no broad git add
* gitleaks or trufflehog secret scan runs at least once before public/enterprise push
* CodeQL or Semgrep security workflow exists or is explicitly planned
* npm audit / audit signatures are checked where supported
* REST/API smoke confirms unsafe public commands are blocked
* REST/API smoke confirms mutating routes are not public by default
* CORS is not wildcard in production/public mode
* sandbox smoke confirms path traversal is blocked
* sandbox smoke confirms temp artifacts stay inside sandbox
* sandbox smoke confirms network mutation is review/block, not silent allow

Required governance files:

* SECURITY.md
* THREAT_MODEL.md
* CODEOWNERS if the repo is ready for protected review paths
* .github/workflows/security.yml for scheduled security checks

Not allowed in this gate:

* full TypeScript migration
* Rust rewrite
* storage rewrite
* frontend rewrite
* plugin expansion
* new API surface
* new V3 runtime implementation
* new marketplace work
* new connector work

Principle:

Secure the existing behavior.
Do not rewrite the product before validating it.

## V3 — Approval Runtime + Memory Admission Gate

V3 starts only after:

1. Post-V2.6 Real User Smoke passes
2. Pre-V3 Security & Release Hygiene Gate passes
3. V3-PR0 blueprint is written and accepted

V3 purpose:

Turn "review required" into a real governed workflow.

Main question:

What happens when an action requires review?

V3 capabilities:

* approval request schema
* pending approval queue
* approve / reject flow
* reviewed action receipts
* blocked action receipts
* memory admission gate
* provenance for approved memory writes
* MCP approval status tools
* local-first audit of review decisions
* deterministic status transitions

V3 does not include:

* UI rewrite
* plugin marketplace
* cloud dashboard
* enterprise RBAC
* Self-Healer
* GitHub App
* L-ASIC
* Dream expansion
* full TypeScript migration
* Rust rewrite

V3 plain language:

V3 gives the brake pedal a dashboard.
It records who stopped what, why it stopped, and what happened after review.

## Strategic Horizon

Keep these as vision/backlog only, not immediate implementation:

* Shared Trust Memory
* Huqan Trust Runtime
* Dataset Trust Scanner / Anti-Model Collapse
* Logical Supply Chain
* A2A Judicial Layer
* Causal Digital Twins
* L-ASIC / Logic Hardware

Safe positioning:

HUQAN is the shared trust memory and action judgment layer for AI tools, models, and agents.

Do not claim:

* zero hallucinations
* perfect truth
* hack-proof intelligence
* zero-risk simulation
* end of cybersecurity
* 100% predictive certainty

Validation:

Run:

npm test

If tests fail because this is docs-only and known unrelated local drift exists, report exact failing files and do not fix unrelated failures.

Stage only roadmap/docs files changed for this PR.

Expected report format:

Path:
Branch:
Dirty root touched:
agent.memory.json:
Changed files:
Tests:
Blocker:
Recommended next step:

Expected commit message:

docs: update roadmap with pre-v3 security gate

Kısa özet: bu talimat roadmap'i günceller, **V3'ü başlatmaz**. Bundan sonra sıra net olur:

```txt
1. Roadmap docs patch
2. Final smoke
3. Pre-V3 Security & Release Hygiene Gate
4. Real user smoke
5. V3-PR0 blueprint
6. V3 küçük implementation PR'ları
```