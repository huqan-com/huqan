# REFACTOR-4A - Surface Parity Inventory

## Purpose

This docs-only gate records the public and production-adjacent HUQAN surfaces
that can observe, decide, or mutate state. It freezes the source reality that
subsequent REFACTOR-4 gates must test and, where justified, converge.

This document does not change runtime behavior and does not authorize Policy
Auditor, Policy Compiler, Action Integrity, productization, V5, or V6 work.

## Canonical Base

- Repository: `ali-ulu/huqan`
- Required branch: `main`
- Required base: `c0432188b3562b4dc0cde309923a63946c78706f`
- Previous checkpoint: `REFACTOR-3_CLOSEOUT_AUDIT_GREEN_CONFIRMED`
- Current gate: `REFACTOR-4A_SURFACE_PARITY_INVENTORY`
- Authorized successor after separate review, merge, and closeout:
  `REFACTOR-4B_SURFACE_CONTRACT_CONVERGENCE`

Every successor must start from a separately verified canonical `main` SHA.
Current source and executable contracts win over older roadmaps or reports.

## Disposition Vocabulary

Only these dispositions are used below:

- `EXACT_EXISTING_METHOD`
- `BOUNDED_INTENT_SPECIFIC_SEAM`
- `DELIBERATE_COMPATIBILITY_RETENTION`
- `REMOVE_DEAD_PATH`
- `NOT_APPLICABLE`

`BOUNDED_INTENT_SPECIFIC_SEAM` is not permission to add a generic executor,
repository, mutable collection alias, Graph snapshot, or service locator.

## Surface Owners

| Surface | Bootstrap and public entry | Current semantic owner | Direct dependencies and leakage | Error and lifecycle shape | Disposition |
| --- | --- | --- | --- | --- | --- |
| Kernel v1 | `require('huqan')`; `new Kernel(opts)` in `kernel.js` | `Kernel`, `VerifyService`, `runLearnUseCase`, Graph and MemoryStore | Public compatibility exposes `graph` and `memory`; Kernel owns PluginManager | Synchronous core methods return envelopes or bounded objects; constructor may load persistence; `memory.close()` is separate | `DELIBERATE_COMPATIBILITY_RETENTION` |
| KernelV2 | `require('./kernel.v2')`; wraps an existing/new Kernel v1 | Wrapped Kernel v1 except V2 risk/temporal decoration | Exposes wrapped `plugins` and `graph`; delegates lifecycle and capability calls | Mostly synchronous delegation; preserves wrapped result/error identity where delegated | `DELIBERATE_COMPATIBILITY_RETENTION` |
| CLI | `cli.js`; `createKernel(opts)` and `CLI.execute()` | Kernel v1 or explicit V2; CLI mutation gate and audit intent mapping | Uses Kernel facade for lifecycle/audit; invokes capabilities through Kernel | Human-readable strings; command errors are printed/returned; interactive close persists then closes resources | `EXACT_EXISTING_METHOD` |
| MCP | `mcpServer.js`; `createServer()` | `evaluateMcpGate`, Kernel, persistent approval store | Transport owns schemas and approval orchestration; no direct Graph collection access | JSON-RPC tool envelopes; unknown/malformed tools block; approval execution supports `axiom.learn` only | `EXACT_EXISTING_METHOD` |
| REST/server | `server.js`; HTTP server and `startServer()` | Kernel/CLI, trust-query helpers, ingest capability | Directly passes Graph to receipt/provenance queries and graph-view projection; HTTP and filesystem concerns co-reside | HTTP status plus legacy/current JSON shapes; API-key authorization is route-specific; `closeAxiom()` owns shutdown | `BOUNDED_INTENT_SPECIFIC_SEAM` |
| SDK | `lib/sdk.js`; `createAxiomClient`, command/tool wrappers | Kernel for verify/reason; shield and PluginManager capability paths | `invokeCapability` falls back from `kernel.runCapability` to `kernel.plugins.runCapability` | Mixed: client verify/reason are synchronous; command/capability wrappers return promises; unknown command throws | `BOUNDED_INTENT_SPECIFIC_SEAM` |
| Workbench-like inspectors | `lib/workbench/*-inspector.js` | Receipt read index and supplied memory query | Read-only caller-supplied source; no Kernel facade | Returned `found`, `not_found`, `invalid_request`, or `read_error` records | `EXACT_EXISTING_METHOD` |
| Obsidian | `obsidian-plugin/src/main.ts` | Local `buildMockReceipt` only | Obsidian editor/UI APIs; no Kernel, HTTP, filesystem, or canonical mutation | Local mock modal; explicitly says verification is not connected | `DELIBERATE_COMPATIBILITY_RETENTION` |
| Workflow tools/runtime | `workflow-tools.js`, `workflow-runtime.js` | Kernel capability runner and workflow contracts | Capability invocation; no package-level public Kernel extension | Promise-based bounded workflow results; current tests own failure isolation | `EXACT_EXISTING_METHOD` |
| Production plugins | `plugins/*.js` loaded by `plugin.js` | PluginManager verification/capability registry; Kernel/application remains intended mutation owner | Several plugins read `kernel.graph._nodes`; `llm-memory-plugin` calls `graph.save()`; repo-memory has explicit GitHub adapter/env token | Promise/synchronous plugin-specific results; production manifest hash/signature verification enforced | `BOUNDED_INTENT_SPECIFIC_SEAM` |

## A. Surface Parity Matrix

Legend: `-` means the operation is not exposed by that surface at this base.
Transport wrappers may differ; rows do not assert semantic parity until the
listed REFACTOR-4 gate supplies executable evidence.

| Operation | Kernel v1 | KernelV2 | CLI | MCP | REST/server | SDK | Workbench | Obsidian | Current disposition / test owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Constructor/bootstrap | `new Kernel(opts)`; optional load/plugins | wraps Kernel v1 | v1 default, exact `v2` opt-in | env-selected Kernel, plugins disabled initially | singleton CLI/Kernel plus HTTP server | caller supplies Kernel | caller supplies source/query | Obsidian `Plugin.onload()` | `EXACT_EXISTING_METHOD`; facade/constructor/server/MCP tests |
| Verify | `verify(statement, opts)` envelope; `dogrulandi/celiski/bilinmiyor` | risk-decorated V2 envelope | `dogrula` calls Kernel | `axiom.verify`, read gate | `/v2/verify`, `/verify`, `/dogrula`, `/llm-sor` wrappers | client/command delegates to Kernel | - | mock heuristic only, not HUQAN verify | `BOUNDED_INTENT_SPECIFIC_SEAM`; 4B parity tests |
| Learn | `learn(text, opts)` via `runLearnUseCase` | delegates then temporal metadata | `ogren` calls Kernel with no bypass fields | `axiom.learn` is review; approved request executes Kernel | upload uses `learnDocument`; ingest uses capability | no learn method | - | - | `BOUNDED_INTENT_SPECIFIC_SEAM`; 4B admission/bypass tests |
| Learn document | `learnDocument`, repeated `learn` | direct delegation | import command calls `learnDocument` | - | `/upload`/`/yukle`, approval required by default | - | - | - | `EXACT_EXISTING_METHOD`; REST/CLI parity characterization |
| Learn from LLM | `learnFromLLM`; forces admission and approval required | risk-aware V2 implementation | indirect shield/capability paths | - | `/llm-sor` shield auto-learn opt-in | shield middleware can set `autoLearn:true` | - | - | `BOUNDED_INTENT_SPECIFIC_SEAM`; no silent bypass claim |
| Action/tool gate | Kernel capability checks are not transport authorization | delegates capability methods | CLI mutation gate for mutation commands | AB1/AB2/AB4 adapter; unknown/malformed block | API key protects selected routes; ingest capability owns its own behavior | direct capability call; no MCP gate | - | - | `BOUNDED_INTENT_SPECIFIC_SEAM`; 4B four-control matrix |
| Approval request | no general public approval queue method | - | review decision is reported, not queued as MCP approval | review creates persistent approval record | upload accepts caller approval metadata; no REST approval-create endpoint | - | - | - | `DELIBERATE_COMPATIBILITY_RETENTION`; do not invent API |
| Approval status/list | no public method | - | - | `axiom.approvals` lists persistent pending requests | - | - | memory inspector can display supplied status | - | `EXACT_EXISTING_METHOD`; MCP contracts |
| Approval execute | admission consumes approved metadata; no generic execute API | - | no approval execute command | `axiom.approve`; only approved `axiom.learn` executes and currently forces workspace `default` | - | - | - | - | `DELIBERATE_COMPATIBILITY_RETENTION`; workspace parity and atomicity not claimed |
| Memory admission | `_evaluateLearnAdmission` then `runLearnUseCase` | delegates to Kernel v1 | default learn path does not add bypass | approved learn builds explicit approval context | upload defaults approval-required; caller metadata is sanitized | no direct learn | inspector is read-only | - | `EXACT_EXISTING_METHOD`; 4B negative tests |
| Receipt query | no bounded public receipt-read method | - | - | tool verdict/admission responses carry references, no generic receipt tool | `/api/trust-receipt/:id` passes Graph to read index | - | trust-receipt inspector | mock receipt is not canonical | `BOUNDED_INTENT_SPECIFIC_SEAM`; 4B/4E |
| Audit query | no bounded public query method; CLI audit write seam exists | audit-write delegation | write via `recordCliMutationAudit` | gate findings in tool response | `/api/audit` passes Graph to query helper | - | receipt inspector can show associated audit event | - | `BOUNDED_INTENT_SPECIFIC_SEAM`; 4E server boundary |
| Persist/reload/close | `persist`, `reload`, `optimize`; `memory.close` compatibility | delegates lifecycle except close remains wrapped compatibility | uses Kernel lifecycle seams | server transport lifecycle; approval store derives from Kernel | `closeAxiom` closes server/CLI resources | caller owns supplied Kernel | - | Obsidian lifecycle only | `EXACT_EXISTING_METHOD`; existing lifecycle contracts |
| Error mapping | Kernel envelopes plus thrown programmer/config errors | wrapped/augmented Kernel behavior | strings/console plus isolated audit failure | JSON-RPC errors and bounded gate decision | HTTP status plus legacy/current JSON | throws unknown/unavailable capability errors | returned status records | local notices | `DELIBERATE_COMPATIBILITY_RETENTION`; 4B tests semantics, not wrapper identity |
| Version metadata | `CONTRACT_VERSION`, package version | wrapped contract version | Kernel-selected version behavior | adapter/schema contract metadata | `/v2-status` and package/runtime data | none exported by SDK | - | manifest version | `BOUNDED_INTENT_SPECIFIC_SEAM`; 4B/4C |

### Per-row contract fields

The matrix above is normative shorthand for these fields:

- input/output and verdict meaning are owned by the referenced Kernel/use-case
  unless the row names a transport-owned wrapper;
- workspace is explicit in Kernel options, MCP args, REST query/body, receipt
  filters, or defaults to `default` in the underlying owner;
- Kernel learn/verify/read/lifecycle methods listed here are synchronous;
  `Kernel.runCapability()` and plugin/workflow capability execution are
  asynchronous even though that Kernel method is not named `Async`; SDK client
  `verify()` and `reason()` are synchronous direct delegations, while
  `runAxiomSdkCommand()`, LangChain/Vercel wrappers, MCP, and HTTP handling are
  asynchronous;
- unknown MCP tools and malformed MCP input are fail-closed; unknown SDK
  commands throw; unknown CLI commands return the existing unknown-command
  text; no cross-surface unification is claimed yet;
- receipt references are produced by admission/gate owners and transported by
  response builders; approval execution durability is not atomic or replay-safe
  merely because a receipt reference exists.

## B. Mutation Entrypoint Inventory

| Entrypoint | Mutation owner and path | Gate / approval reality | Receipt or audit | Direct internal leakage | Disposition / next gate |
| --- | --- | --- | --- | --- | --- |
| `Kernel.learn` | `runLearnUseCase` -> admission-owned Graph writes | admission defaults on; explicit compatibility bypass remains | admission receipt/audit where evaluated | public in-process caller can request bypass | `DELIBERATE_COMPATIBILITY_RETENTION`; 4B coverage, RTG-002 stays open |
| `Kernel.learnDocument` | repeated `Kernel.learn` | forwards options to every line | admission list only with `returnDetails` | none beyond Kernel owner | `EXACT_EXISTING_METHOD`; 4B |
| `Kernel.learnFromLLM` | verify then forced-admission `Kernel.learn` | sets `admissionRequired:true`, approval required by default | per-learn admission behavior | none | `EXACT_EXISTING_METHOD`; parity characterization |
| Kernel background dream/evolve writes | `_commitBackgroundEdge` | background admission; default review | background audit and receipt details | internal Kernel/Graph use | `DELIBERATE_COMPATIBILITY_RETENTION` |
| CLI `ogren` / document import | Kernel learn methods | CLI does not inject bypass fields; mutation commands have CLI-specific gate/audit coverage | CLI audit applies to classified commands, not a universal transaction | no current `_nodes/_edges` CLI access | `EXACT_EXISTING_METHOD`; 4B negative tests |
| MCP `axiom.learn` | gate -> persistent approval -> Kernel.learn on approval | initial decision review; unknown/malformed block | tool verdict plus approval/admission references | no Graph collection access | `EXACT_EXISTING_METHOD`; 4B approval parity |
| REST upload | `Kernel.learnDocument` | `approvalRequired` defaults true; caller-supplied `approvalStatus` and `approvalId` are forwarded, while admission bypass fields are not | first admission returned | no direct mutation, but transport owns authorization metadata mapping | `BOUNDED_INTENT_SPECIFIC_SEAM`; 4B blocker-level contract input |
| REST ingest | `handleIngest` -> Kernel capability | capability-specific behavior | capability-specific | adapter/plugin boundary | `BOUNDED_INTENT_SPECIFIC_SEAM`; 4B/4D |
| SDK capability execution | Kernel method preferred; direct PluginManager fallback | no MCP invocation gate | capability-specific | direct PluginManager fallback | `BOUNDED_INTENT_SPECIFIC_SEAM`; 4B |
| Production plugin candidate paths | `proposeNode`/`proposeEdge` or returned evidence | capability/manifest controls | provenance plugin-specific | direct known-node reads remain | `BOUNDED_INTENT_SPECIFIC_SEAM`; 4D |
| `llm-memory-plugin` | `Kernel.learnFromLLM` then direct `kernel.graph.save()` | Kernel admission applies to learn; direct persistence call is plugin-owned | Kernel result only | direct persistence mutation | `BOUNDED_INTENT_SPECIFIC_SEAM`; 4D contract then migration |
| Operational demo/seed/train | direct Graph or Kernel setup operations | operator-controlled, not product transport | none/fixture-specific | direct reads/writes intentional | `DELIBERATE_COMPATIBILITY_RETENTION`; release-smoke only |

## C. Four Independent Control Surfaces

These controls must never be collapsed into one `gated` label.

| Surface | Tool visibility | Invocation authorization | Process/server startup authorization | Semantic mutation integrity | Evidence-safe status |
| --- | --- | --- | --- | --- | --- |
| Kernel v1/V2 | capabilities can be listed | capability enable/require checks; public methods remain callable | constructor options/env are not authorization | admission and intent-specific seams protect named mutations; explicit learn bypass remains | partial/open |
| CLI | command help/parser exposes commands | CLI mutation gate covers classified mutation commands | local process start has no independent policy gate | command-specific Kernel owners; no transaction-wide guarantee | partial/open |
| MCP | declared tool schemas define visibility | MCP gate blocks unknown/malformed and reviews writes | MCP process startup is separate from tool invocation | approved learn uses admission-aware Kernel path; replay/atomicity not proven | partial/open |
| REST/server | routes define visibility | API key applies to selected non-default routes | host/port startup is configuration, not action authorization | route-specific owners; upload admission defaults on; ingest differs | partial/open |
| SDK | exported methods/capabilities define visibility | caller with Kernel can invoke directly; PluginManager fallback exists | library import has no startup authorization | delegated owner only; no transport gate parity | partial/open |
| Workbench | inspector functions only | caller supplies source and filters | not applicable | read-only | bounded/read-only |
| Obsidian | two commands | Obsidian command availability only | plugin enablement only | mock local receipt, no HUQAN canonical mutation | not connected |
| Plugins/workflows | manifest/capability registration | PluginManager capability checks | production loading requires verified manifest; this is not invocation policy | candidate boundary incomplete; direct persistence/read leakage remains | partial/open |

## Explicit Learn Admission Bypass

`Kernel._isLearnAdmissionBypass` accepts only the exact pair:

```text
admissionRequired: false
admissionBypassReason: non-empty string
```

At this base:

- public in-process Kernel and KernelV2 callers can supply that pair;
- `Kernel.learnDocument` forwards caller options, so an in-process caller can
  extend the bypass across document lines;
- `Kernel.learnFromLLM` overwrites `admissionRequired` with `true` before each
  canonical learn;
- CLI production calls do not inject the pair;
- MCP tool schemas/call mapping do not forward the pair; approved MCP learn
  constructs `approvalRequired:true` and `approvalStatus:'approved'`;
- REST upload does not forward the pair and defaults `approvalRequired:true`;
- REST upload does forward caller-controlled `approvalStatus` and `approvalId`.
  This is not the explicit bypass pair, but it is an authorization-boundary
  risk that 4B must characterize before any `TRANSPORT_BYPASS_CLOSED` claim;
- the SDK does not expose a learn method at this base;
- the Obsidian plugin is disconnected and local-only;
- `egitim.js` is the only non-test/non-benchmark repository caller found with
  the explicit pair, using `demo_seed_fixture` semantics.

Required 4B negative tests must prove that caller-controlled transport input
cannot silently arm either bypass field. Public in-process compatibility is
not removed by this inventory and `RTG-002` must not be marked closed.

## Refactor-3 Residual Graph Access

| Source family | Current access and semantic risk | Decision | Required evidence / owner |
| --- | --- | --- | --- |
| `dream.js` | Reads global/internal node order, labels, and embeddings for deterministic computation; also coordinates Graph-owned embedding mutation seam | `DELIBERATE_COMPATIBILITY_RETENTION` | 4E4 may replace it only if storage order, workspace behavior, embedding identity, failure isolation, and save timing are exact; no generic snapshot |
| `causalSimulator.js` | Reads `_nodes` for existence/labels without the access-touch side effect of `getNode()` | `DELIBERATE_COMPATIBILITY_RETENTION` | 4E4 may add a no-touch seam only after tests lock `lastAccessed`, label identity, and persistence behavior |
| `lib/provenance-query.js` | Uses Graph candidate APIs plus direct node/edge projection for cross-workspace trust views | `BOUNDED_INTENT_SPECIFIC_SEAM` | 4E4 query-specific projection; preserve sorting, workspace filters, canonical/candidate distinction |
| `server.js` graph view | REST projection directly observes Graph collections | `BOUNDED_INTENT_SPECIFIC_SEAM` | 4E3/4E4 bounded graph-view query; never return mutable collections |
| fact-extraction plugins | `company-brain`, `contradiction-alert`, `devil-advocate`, `discovery-engine`, and `idea-mri` pass `_nodes` as known-node input | `BOUNDED_INTENT_SPECIFIC_SEAM` | 4D/4E4 preserve exact known-node shape/order without granting mutation authority |
| production plugin query reads | company-mode plugins use Graph query methods and stats | `EXACT_EXISTING_METHOD` | Retain existing read methods; remove only collection leakage proven unnecessary |
| demo/seed/train | `demo-causal-autolearn.js`, `egitim.js`, and `scripts/seed-demo.js` perform operational setup/count/label work | `DELIBERATE_COMPATIBILITY_RETENTION` | Exclude from public-surface claims; cover only if package/release smoke is affected |

## Plugin and Adapter Source Reality

- `plugin.js` verifies production manifest SHA-256 and optional HMAC signature
  before registration. REFACTOR-4 must preserve this enforcement.
- The production set at this base is `company-brain`, `contradiction-alert`,
  `devil-advocate`, `discovery-engine`, `experiment-planner`, `idea-mri`,
  `llm-memory-plugin`, `replication-checker`, `repo-memory`, and
  `result-analyzer`, each with a neighboring manifest.
- Most plugins return analysis/candidate-like results or call existing
  `proposeNode`/`proposeEdge` paths. They are not thereby proven candidate-only;
  4D must inventory each production manifest and negative mutation behavior.
- `llm-memory-plugin` directly persists through Graph after a Kernel learn path;
  this is a source-proven 4D contract/migration candidate.
- `repo-memory` reads a GitHub token and uses explicit repository adapters; its
  network behavior must be classified as adapter behavior, not hidden core
  authority.
- `adapters/github-adapter.js` performs explicit network reads and then calls
  Kernel learn; `adapters/markdown-adapter.js` performs bounded filesystem
  reads and then calls Kernel learn. `llmAdapter.js` has explicit Ollama/OpenAI
  fetch paths, while `rustGraph.js` owns the optional process boundary.
- `server.js` owns HTTP/auth concerns but also passes Graph into trust-query
  helpers. This is an adapter-boundary gap, not permission to add a generic
  Graph repository.
- MCP approved learn currently normalizes execution to workspace `default`
  rather than preserving an arbitrary originating workspace. This is a parity
  observation, not authorization to change workspace behavior without tests.
- JSON/SQLite, Rust, filesystem, signing/key resolver, backup, and MCP provider
  boundaries require 4E direction/error/ownership inventory before changes.

## Known Runtime / Declaration Difference

KernelV2 runtime exposes `graph`, `plugins`, `getPersistenceDescriptor`,
`reload`, `persist`, and `optimize`. `kernel.v2.d.ts` declares the wrapped
`kernel`, capability methods, learn/verify/reason/compare/dream, and the audit
seam, but not those runtime getters/lifecycle methods. Existing contracts also
intentionally avoid declaring `plugins` as stable public API. REFACTOR-4C must
classify each difference as intended compatibility or a declaration gap; this
inventory does not resolve it by exposing internals or inventing runtime APIs.

## Competitive Register Assessment

| Row | Decision at 4A | Source evidence | Current status after 4A |
| --- | --- | --- | --- |
| `CE-001` | `ADAPT` | Kernel/use-case ownership exists, but transport, SDK fallback, plugin, and server query paths are not fully converged | OPEN; input to 4B/4D/4E |
| `CE-004` | `ADOPT` | Visibility, invocation, startup, and semantic mutation controls are demonstrably separate | OPEN; four-control matrix required through 4H |
| `RTG-002` | known blocker | public Kernel learn bypass remains; production transports do not currently inject it by default | `COVERAGE_AUDITED_COMPATIBILITY_OPEN`; Compiler Runtime may still be required |
| `RTG-006` | required coverage audit | CLI, MCP, REST, SDK, plugin, startup, and mutation coverage differ by surface | OBSERVED / OPEN; 4B and final 4H evidence required |

This gate closes no competitive-register row.

## Implementation Chain and File Families

The source-derived order is binding unless a later exact-source conflict is
reported:

1. `REFACTOR-4B1` parity/negative contract tests: new focused tests plus
   existing CLI/MCP/server/SDK/workbench tests only.
2. `REFACTOR-4B2` CLI/MCP convergence: `cli.js`, `mcpServer.js`, narrow MCP
   response/gate helpers, and their tests only if 4B1 proves a gap.
3. `REFACTOR-4B3` REST/SDK/workbench convergence: `server.js`, `lib/sdk.js`,
   `lib/workbench/**`, narrow response/query helpers, and tests only.
4. `REFACTOR-4B4` bypass-negative and closeout evidence; no public Kernel
   compatibility removal without a new decision.
5. `REFACTOR-4C` package/type surface: `package.json`, declarations, package
   contract tests, and npm-pack evidence; no runtime method invented for types.
6. `REFACTOR-4D` plugin inventory/contracts, then only source-proven plugin
   migration files, manifests, and plugin tests.
7. `REFACTOR-4E1` filesystem/JSON/SQLite/persistence direction.
8. `REFACTOR-4E2` Rust/signing/key resolver isolation.
9. `REFACTOR-4E3` MCP/server adapter isolation.
10. `REFACTOR-4E4` residual Graph read boundaries in Dream, causal simulator,
    provenance query, server projection, and fact-extraction known-node input.
11. `REFACTOR-4E5` adapter closeout evidence.
12. `REFACTOR-4F` release-smoke workflow/tests only where current CI lacks
    Linux/Windows/macOS and clean-package evidence.
13. `REFACTOR-4G` source-first architecture documentation reconciliation.
14. `REFACTOR-4H` independent read-only program closeout.

YAGNI applies at every step: if contract tests show no source gap, record a
no-op closeout rather than adding an abstraction.

## Required Contract Gaps

The following are required evidence gaps, not pre-approved implementations:

- cross-surface semantic parity for verify and learn/admission;
- transport bypass-negative coverage;
- caller-controlled REST approval metadata and MCP approval workspace
  preservation/normalization;
- unknown/malformed fail-closed parity;
- approval create/list/execute and receipt-reference parity where applicable;
- SDK direct PluginManager fallback classification;
- REST direct Graph query/projection boundary;
- plugin malformed-output no-mutation and failure isolation;
- production plugin direct persistence and known-node collection reads;
- package runtime/declaration/export/tarball parity;
- supported-platform clean install, startup, shutdown, and package smoke.

## Acceptance Criteria

1. Kernel v1/V2, CLI, MCP, REST/server, SDK, workbench-like inspectors,
   Obsidian, workflows, adapters, and production plugins are represented.
2. All required operation rows are mapped or explicitly `NOT_APPLICABLE`.
3. Mutation entrypoints and the four independent control surfaces are recorded.
4. Admission bypass callers and transport non-forwarding boundaries are
   source-traced without a closure overclaim.
5. Refactor-3 residual reads have one allowed disposition and a test owner.
6. `CE-001`, `CE-004`, `RTG-002`, and `RTG-006` remain evidence-bound.
7. Successor order and allowed file families are explicit.
8. `git diff --check` passes; only this task-pack changes.
9. Security Checks and Benchmark Regression pass on the exact reviewed head.

## Stop Conditions

Stop instead of inventing behavior if a successor requires:

- a new public generic API, schema/version change, or dependency;
- verdict, receipt, envelope, workspace, sync/async, persistence, or error
  semantic changes;
- removing the public Kernel learn bypass without an explicit product decision;
- approval execution atomicity, replay safety, or rollback guarantees;
- a generic Graph snapshot/repository/executor or mutable collection alias;
- weakening plugin manifest/signature enforcement;
- mixing Policy Auditor or post-refactor product work into REFACTOR-4.

## Non-Claims

This inventory does not claim that:

- surface parity is complete;
- every mutation entrypoint is bypass-proof;
- `RTG-002` or `RTG-006` is closed;
- approval execution is atomic or exactly once;
- audit and mutation share a durability boundary;
- every Graph internal access is removed;
- plugins are already candidate-only;
- V5 is wired into the main runtime authority;
- HUQAN is enterprise- or production-ready;
- Policy Auditor or any post-refactor gate is authorized.
