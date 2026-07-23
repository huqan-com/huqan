# REFACTOR-4C0 - Package and Type Surface Source Reality

## Gate identity

- Repository: `ali-ulu/huqan`
- Canonical base: `da6273425ff87313c0b9538034931b7524943cf8`
- Previous checkpoint: `REFACTOR-4B_SURFACE_CONTRACT_CONVERGENCE_CLOSEOUT_GREEN`
- Gate: `REFACTOR-4C0_PACKAGE_TYPE_SURFACE_SOURCE_REALITY`
- Mode: docs/task-pack only

This gate records the package, tarball, and type-surface source reality for the
next implementation gate. It does not change runtime behavior, package metadata,
types, tests, dependencies, version, or exports.

## Product decision

The selected REFACTOR-4C decision is Option 1:

- do not add a package `exports` map;
- preserve existing Node deep-import compatibility;
- align only proven runtime/type mismatches;
- narrow the tarball with a `files` allowlist;
- keep all currently supported import and executable paths working;
- defer breaking package-surface and version decisions.

Adding an `exports` map is forbidden in REFACTOR-4C1. It is a separate public
package compatibility and versioning decision.

## Observed package reality

`package.json` currently declares:

- `main`: `kernel.js`;
- `types`: `kernel.d.ts`;
- `bin.huqan`: `./cli.js`;
- no `exports`;
- no `files`;
- no `.npmignore`;
- no `private: true`.

At canonical base `da6273425ff87313c0b9538034931b7524943cf8`,
`npm pack --dry-run --json --ignore-scripts` reported:

- `797` package entries;
- `2470956` packed bytes;
- `6948108` unpacked bytes;
- `319` test entries;
- `207` docs entries;
- `3` GitHub workflow entries;
- `16` benchmark entries;
- `10` demo entries;
- `11` Obsidian plugin entries;
- `0` runtime state entries matching memory, SQLite, `.env`, or backups.

The wide tarball is a package-boundary problem, not a confirmed secret or state
leak.

## Supported and retained import surfaces

The following paths must remain loadable after REFACTOR-4C1 because they are
package metadata, executable entrypoints, documented runtime surfaces, or
compatibility-retained paths under the no-exports decision:

- `huqan`;
- `huqan/kernel`;
- `huqan/kernel.js`;
- `huqan/kernel.v2`;
- `huqan/kernel.v2.js`;
- `huqan/cli`;
- `huqan/cli.js`;
- `huqan/lib/sdk`;
- `huqan/lib/sdk.js`;
- `huqan/mcpServer`;
- `huqan/mcpServer.js`;
- `huqan/server`;
- `huqan/server.js`.

Executable paths that must remain present:

- `huqan` bin through `cli.js`;
- `npm run backup` through `scripts/backup.js`;
- `npm run restore` through `scripts/restore.js`;
- `npm run bench` through `benchmarks/bench.js`;
- `npm run bench:verify` through `benchmarks/verifBench.js`;
- `npm run train` through `egitim.js`.

These compatibility paths are retained. They are not promoted into a new
formal package `exports` contract.

## Runtime closure that must be preserved

The REFACTOR-4C1 `files` allowlist must include the runtime closure required by
the retained import and executable paths. The minimum candidate set is:

- exact root runtime JavaScript files required by the retained entrypoints,
  explicitly excluding root `*.test.js` files;
- exact root declaration files required by the retained entrypoints;
- package metadata and notices: `package.json`, `README.md`, `LICENSE`,
  `NOTICE`;
- `lib/`;
- `nlp/`;
- `adapters/`;
- `plugins/`;
- `config/trust-policy.default.json`;
- `public/index.html`;
- `scripts/backup.js`;
- `scripts/restore.js`;
- `benchmarks/bench.js`;
- `benchmarks/verifBench.js`;
- `benchmarks/fixtures/`;
- `docs/seed/axiom-identity.seed.json`;
- `packages/axiom-verify/`.

The root JavaScript/declaration entries must be explicit file names, not a
broad `*.js` wildcard. A broad root wildcard would include root test files and
violate the tarball exclusion contract.

`schemas/` is not loaded by the current main, CLI, server, or MCP runtime.
It must not be included unless REFACTOR-4C1 proves a retained package subpath or
runtime dependency requires it.

## Tarball exclusions

REFACTOR-4C1 must prove that the tarball excludes broad non-runtime material:

- `test/`;
- `.github/`;
- `docs/`, except `docs/seed/axiom-identity.seed.json`;
- `evidence/`;
- `demo/`;
- `fixtures/`, except benchmark fixtures if required by benchmark scripts;
- `obsidian-plugin/`;
- `axiom-core/` source and build artifacts unless a tracked runtime binary is
  explicitly required;
- runtime state: `memory.json`, `memory.db`, `memory.db-shm`, `memory.db-wal`,
  `agent.memory.json`, `*.agent.json`, `.env`, `backups/`, logs, and generated
  benchmark output.

## Type-surface source reality

The root package runtime exports `Kernel` and the static members:

- `AXIOM_ERROR`;
- `CONTRACT_VERSION`;
- `ProvenanceError`.

`kernel.d.ts` currently declares `AXIOM_ERROR` and `CONTRACT_VERSION`, but not
`ProvenanceError`. `strictProvenance` is a runtime option used with this error
path and must be considered with the same compatibility correction.

`kernel.v2.js` currently exposes proven compatibility members that are absent
from `kernel.v2.d.ts`. REFACTOR-4C1 may declare only these confirmed members:

- readonly `graph`;
- readonly `contractVersion`;
- `getPersistenceDescriptor`;
- `reload`;
- `persist`;
- `optimize`;
- `usePlugin`;
- `entropy`;
- `detectGaps`;
- `detectContradictions`;
- `startAutoThink`;
- `stopAutoThink`.

REFACTOR-4C1 must not declare:

- `plugins`;
- `getStats`;
- any `_...` implementation helper;
- a generic index signature;
- new package root exports;
- newly invented SDK, MCP, or server declaration surfaces unless an existing
  runtime/declaration mismatch is proven and explicitly scoped.

No TypeScript dependency is authorized. Type checks for REFACTOR-4C1 must use
runtime assertions and declaration-text contract tests unless a separate tooling
gate is opened.

## Required REFACTOR-4C1 implementation scope

Allowed files:

- `package.json`;
- `kernel.d.ts`;
- `kernel.v2.d.ts`;
- a single focused package/type contract test file.

Optional only if the test already exists and is the better local owner:

- an existing package/type/facade contract test file.

Forbidden files and changes:

- `exports` map;
- version bump;
- dependency or lockfile change;
- runtime behavior change;
- `kernel.js`;
- `kernel.v2.js`;
- `cli.js`;
- `server.js`;
- `mcpServer.js`;
- workflow, Docker, V5, Policy Auditor, productization, or public API expansion;
- broad README or docs cleanup;
- package publishing.

## Required REFACTOR-4C1 validation

REFACTOR-4C1 must run and record:

- package manifest contract test;
- declaration contract test;
- tarball dry-run manifest check;
- installed-tarball smoke in an isolated fixture;
- deep-import compatibility checks for the retained paths listed above;
- `huqan --help` from the installed package;
- `require('better-sqlite3')` through the installed dependency tree where
  package install requires it;
- full `npm test`;
- `git diff --check`;
- Security Checks;
- Benchmark Regression, including Docker image build.

The installed-tarball smoke must set any needed environment so `server.js` does
not bind a persistent listener during a require-based check.

## Stop conditions

Stop rather than patching if REFACTOR-4C1 requires:

- an `exports` map;
- a version or breaking compatibility decision;
- a dependency, package-lock, or TypeScript compiler addition;
- runtime source changes;
- removal of an existing compatibility path;
- inclusion of broad tests/docs/evidence/workflows in the package to keep a
  runtime path working;
- publishing credentials or npm release action;
- hidden secret, key, state, or database material in the tarball.

## Non-claims

- REFACTOR-4C0 does not make the package publish-ready.
- REFACTOR-4C0 does not close all package compatibility questions.
- REFACTOR-4C0 does not declare arbitrary deep imports public.
- REFACTOR-4C0 does not remove public Kernel admission bypass compatibility.
- REFACTOR-4C0 does not start REFACTOR-4D, Policy Auditor, V5, productization,
  or release work.

## Closeout target

After this document is reviewed, merged, and verified on canonical `main`, the
valid closeout verdict is:

`REFACTOR-4C0_PACKAGE_TYPE_SURFACE_SOURCE_REALITY_GREEN`

Only after that closeout may REFACTOR-4C1 begin from the verified post-merge
canonical SHA.
