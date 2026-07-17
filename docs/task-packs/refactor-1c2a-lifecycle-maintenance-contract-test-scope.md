# REFACTOR-1C2A Lifecycle and Maintenance Contract Test Scope

## Purpose

Define the exact green-baseline test scope for the lifecycle and maintenance
contracts selected by REFACTOR-1C2. This task-pack assigns test ownership,
fixture isolation, spies, fake readline behavior, cleanup order, and the hard
boundary between pre-runtime baseline tests and runtime seam tests.

This gate adds no test, runtime method, type declaration, CLI migration, or
dependency.

## Canonical Base

- Repository: `ali-ulu/huqan`
- Scope-definition base:
  `341d8db354984786ec2ace000fabe40052ab2d55`
- Previous checkpoint: `REFACTOR-1C2_CLOSEOUT_AUDIT_GREEN`
- Current gate:
  `REFACTOR-1C2A_LIFECYCLE_AND_MAINTENANCE_CONTRACT_TEST_SCOPE`
- Future test gate:
  `REFACTOR-1C2B_LIFECYCLE_AND_MAINTENANCE_CONTRACT_TESTS`

This base records source reality only. Every successor requires separate
exact-base authorization after its predecessor is reviewed, merged, and
closed.

## Governing Sources

- `docs/task-packs/refactor-1c2-kernel-lifecycle-maintenance-seam-scope.md`
- `docs/task-packs/refactor-1c1-cli-graph-read-contract-test-scope.md`
- `docs/refactor/kernel-facade-contract.md`
- `cli.js` and `cli.test.js`
- `kernel.js`, `kernel.v2.js`, and `kernel.d.ts`
- `graph.js`, `graph.test.js`, and `kernel.test.js`
- `backupRestore.js` and `persistencePaths.js`
- `test/kernel-facade-contract.test.js`
- `test/kernel-constructor-variant-contract.test.js`
- `package.json`

The full suite is currently `node --test --test-concurrency=1`. It is required
in the future test gate but is not run in this docs-only gate.

## Binding Gate Boundary

### REFACTOR-1C2B must remain green

1C2B runs before the proposed Kernel seams exist. It may lock only existing
Graph, Kernel-constructor, and CLI behavior plus delegation prerequisites.
It must not call or require:

```text
kernel.getPersistenceDescriptor()
kernel.reload()
kernel.persist()
kernel.optimize()
```

It must not add those names to the facade list or `kernel.d.ts`. Deliberately
red tests for missing future methods are forbidden.

### Runtime seam tests belong to REFACTOR-1C2C

1C2C owns method existence, exact signatures, Kernel v1 and KernelV2
delegation, fresh/frozen descriptors, seam return/error parity, declarations,
and facade/type parity. 1C2C does not migrate CLI callsites.

## Test Ownership

Future 1C2B may change exactly:

```text
test/kernel-lifecycle-maintenance-seam-contract.test.js
graph.test.js
cli.test.js
```

| File | Owned behavior |
| --- | --- |
| `test/kernel-lifecycle-maintenance-seam-contract.test.js` | Constructor auto-load/noLoad baseline, isolated lifecycle fixture management, and pre-runtime seam invariants |
| `graph.test.js` | Existing Graph load/save/optimize return, mutation, workspace, persistence, and error behavior |
| `cli.test.js` | Existing backup/restore behavior, `kaydet` and exit ordering, and optimize command output |

These are regression-only in 1C2B and remain unchanged:

```text
test/kernel-facade-contract.test.js
test/kernel-constructor-variant-contract.test.js
```

Future 1C2C owns:

```text
kernel.js
kernel.v2.js
kernel.d.ts
test/kernel-lifecycle-maintenance-seam-contract.test.js
test/kernel-facade-contract.test.js
```

CLI files do not change in 1C2C.

## Isolation and Cleanup Rules

Tests that replace a prototype, process function, clock, console method,
readline method, cwd, or environment value must:

1. use `{ concurrency: false }`;
2. save the exact original reference or presence/value snapshot;
3. install the replacement only after cleanup fixtures exist;
4. restore exact state in `finally`;
5. close agent storage, Graph, and MemoryStore resources;
6. restore cwd and environment before deleting temporary directories;
7. remove temporary directories last.

Use per-test `os.tmpdir()` directories. Never use repository or user
`memory.json`, `memory.db`, or backup state. No new mocking dependency, module
cache manipulation, network access, real stdin, or real process termination.

## Constructor Load Baseline

Owner: `test/kernel-lifecycle-maintenance-seam-contract.test.js`.

Both tests use `{ concurrency: false }`, isolated Graph and MemoryStore paths,
`useSQLite: false`, and disabled plugin loading.

### Default constructor exactly once

1. Save exact `Graph.prototype.load`.
2. Replace it with a synchronous call-count spy. The spy may delegate to the
   original or return current `undefined` for an absent isolated file.
3. Construct Kernel without `noLoad`, or with `noLoad: false`.
4. Assert exactly one load call and no fabricated return value.
5. Restore the exact prototype in `finally`, close resources, then delete the
   temporary directory.

This test does not instantiate CLI or exercise the explicit startup call.

### `noLoad: true`

With the same model, assert zero load calls and confirm `kernel.graph`,
`kernel.memory`, and `kernel.plugins` still exist. This proves only that the
constructor load is skipped, not that all persistence construction disappears.

Forbidden: parallel prototype spies, un-restored globals, `require.cache`
changes, new mocking packages, repository persistence, or startup duplicate
load assertions.

## Persistence Descriptor Boundary

Existing `cli.test.js` already locks custom `memoryPath`, derived `dbPath`,
independent `dbPath` exclusion, isolated-cwd defaults, backup directory, and
backup/restore round trip. 1C2B reruns these without copying them.

Descriptor tests belong to 1C2C and must prove:

```text
method exists
each call returns a new object
Object.isFrozen(result) === true
memoryPath equals the Graph compatibility value
dbPath applies trailing .json -> .db case-insensitively
independent KernelOptions.dbPath is not reported
no cwd resolution or filesystem I/O
no Graph, MemoryStore, database, statement, or internal reference
```

## Graph Reload Baseline

Owner: `graph.test.js`.

### JSON visibility

With SQLite disabled in an isolated directory:

1. add stale state through public methods;
2. write different canonical JSON state;
3. call `const result = graph.load()`;
4. assert `result === undefined`;
5. assert stale state is absent and restored state is visible before return;
6. assert public outbound/inbound queries reflect rebuilt indexes.

Private collections are not expected-value sources.

### Missing JSON

For an absent isolated file, assert no throw, `undefined` return, and current
reset behavior. Load clears in-memory collections before checking existence.

### Malformed JSON

Capture and restore exact `console.error` in `finally`. Assert no throw,
`undefined` return, error-path reporting, and reset state. Do not assert exact
localized text or OS errors.

Existing SQLite save/load remains regression evidence. No SQLite failure
injection, migration redesign, or persistence hardening enters 1C2B.

## Graph Persist Baseline

Owner: `graph.test.js`.

### Return and completion

Assert `save()` returns `undefined`, the JSON file exists before return, and a
new Graph can load/query the saved public state.

### Default-workspace prune

Create weak edges in `default` and a second workspace. Parameterless `save()`
must remove the default weak edge and preserve the second-workspace weak edge.
This locks current `save() -> prune()` semantics only.

### Synchronous error propagation

Do not depend on permission bits. Create an existing directory and configure
that directory path as `memoryPath`; writing a regular file there fails on the
supported platforms. Assert only that `save()` throws synchronously. Do not
assert exact OS error codes or add recovery behavior.

## CLI Interactive Ordering Harness

Owner: `cli.test.js`.

Do not use real stdin. Temporarily replace `readline.createInterface` with a
fake implementing:

```text
on(event, callback)
prompt()
close()
captured line callback
captured close callback
ordered event log
```

Save and restore exact references for `readline.createInterface`,
`console.log`, and `process.exit`. Real `process.exit()` is forbidden. Setup
banner logs must be separated from command-order events.

### `kaydet`

After handler registration, clear setup events and call
`await lineHandler('kaydet')`. With a synchronous save spy, assert:

```text
save
Hafiza kaydedildi.
prompt
```

Save is called once, precedes success, and resources are not closed first.

### Exit

Use the stable ASCII `exit` alias. Assert:

```text
save
Hafiza kaydedildi. Gule gule.
close
```

Save is called once; close follows save/message; no prompt follows exit. If
fake close invokes the close handler, `process.exit` must be a harmless spy
after the ordered close event.

### Persist error

Make save throw a stable test-owned error. Assert the line handler propagates
the same error and emits no success, close, or post-command prompt.

## Optimize Baseline

### Graph owner

Owner: `graph.test.js`. Use controlled default/second-workspace fixtures. Stub
and restore `Date.now` only if node-decay timing is asserted.

Assert exact result keys in source order (`pruned`, `removedNodes`), numeric and
exact fixture values, default-workspace mutation, and unchanged second
workspace. Spy on save only to prove optimize does not save. Seam-level dream,
consolidate, self-evolution, and audit assertions wait for 1C2C.

### CLI owner

Owner: `cli.test.js`. Current policy reviews optimize, so an isolated test may
set `cli._evaluateCliGate = () => null` to reach existing implementation.
With a controlled optimize spy, assert one call, zero arguments, and exact:

```text
Optimize: <pruned> kenar budandi, <removedNodes> dugum silindi.
```

The bypass is test-only and does not change runtime policy.

## Future Seam Tests in REFACTOR-1C2C

Kernel v1 tests:

```text
getPersistenceDescriptor: callable, fresh, frozen, exact shape, no aliases
reload: graph.load once, no args, undefined return, exact error parity
persist: graph.save once, no args, undefined return, same error propagation
optimize: graph.optimize once, no args, exact result
```

KernelV2 tests prove each method delegates once to wrapped Kernel v1, does not
implement Graph logic independently, returns the exact result, and propagates
the exact error.

`test/kernel-facade-contract.test.js` then adds all four callable methods and
checks exact declarations. Constructor-variant tests rerun unchanged.

## Startup Duplicate-Load Disposition

Duplicate-load removal is outside 1C2A-1C2E. Binding rule:

```text
REFACTOR-1C2D keeps the explicit startup load.
```

Separate non-blocking backlog:

```text
REFACTOR-1C2X_STARTUP_DUPLICATE_LOAD_BEHAVIOR_ANALYSIS
```

1C2X requires subprocess startup evidence for JSON, SQLite, JSON-to-SQLite
migration, missing persistence, malformed JSON, SQLite failure/fallback, load
counts, and observable state equivalence. It is not started here.

## Exact Future REFACTOR-1C2B Scope

Allowed only:

```text
test/kernel-lifecycle-maintenance-seam-contract.test.js
graph.test.js
cli.test.js
```

Forbidden: runtime/type files, `cli.js`, `graph.js`, packages, dependencies,
workflows, Docker, server/MCP, seam-existence assertions, duplicate-load
removal, or CLI migration.

If green baseline tests require runtime changes, stop with:

```text
REFACTOR-1C2B_BLOCKED_SOURCE_CONFLICT
```

## Future REFACTOR-1C2B Validation

```powershell
node --test `
  test/kernel-lifecycle-maintenance-seam-contract.test.js `
  graph.test.js `
  cli.test.js

node --test `
  test/kernel-facade-contract.test.js `
  test/kernel-constructor-variant-contract.test.js

npm test
git diff --check
```

Every command must exit zero. Pass counts are measured in 1C2B, not guessed
here.

## Allowed Scope for This Gate

Only:

```text
docs/task-packs/refactor-1c2a-lifecycle-maintenance-contract-test-scope.md
```

## Forbidden Scope for This Gate

- runtime, test, type, fixture, schema, package, dependency, workflow, or
  Docker changes;
- CLI, Kernel, KernelV2, Graph, MemoryStore, server, or MCP implementation;
- duplicate-load removal or `PERSISTENCE-PATH-ALIGNMENT`;
- audit/status migration, V5, Policy Auditor, Self-Healer, product work;
- successor implementation or auto-merge.

## Acceptance Criteria

- Exact canonical base and green 1C2B/1C2C boundary are explicit.
- Missing runtime methods are not called in 1C2B.
- Constructor load/noLoad spy and restoration are exact.
- Temp, resources, globals, cwd, environment, clock, and process cleanup are
  exact.
- JSON reload, save return/prune/error, CLI ordering, and optimize ownership
  are exact.
- KernelV2 and facade/type seam tests are assigned to 1C2C.
- Duplicate-load removal is isolated in non-blocking 1C2X.
- Exact 1C2B files and commands are locked.
- Exactly this task-pack changes and `git diff --check` passes.
- Tests are not run because this gate is docs/task-pack only.

## Stop Conditions

Stop with `REFACTOR-1C2A_BLOCKED_SOURCE_CONFLICT` if source/tests contradict
this ownership, green tests require runtime seams, isolation needs a new
dependency, fake readline needs runtime changes, global restoration is unsafe,
Graph behavior cannot be locked unchanged, duplicate-load removal becomes
required, or server/MCP changes become necessary.

Stop with `BLOCKED_BY_CANONICAL_SOURCE_MISMATCH` for base, remote,
predecessor, branch, or worktree mismatch. Stop with
`BLOCKED_BY_SCOPE_DRIFT` for any path outside the task-pack.

## Non-Claims

- No baseline test or runtime/type method has been added.
- No CLI, Graph, Kernel, or KernelV2 behavior has changed.
- No duplicate-load equivalence or independent `dbPath` support is claimed.
- No server, MCP, audit, status, V5, Policy Auditor, or Self-Healer work has
  started.
- The refactor program is not complete.

## Validation

```powershell
git diff --name-only `
  341d8db354984786ec2ace000fabe40052ab2d55..HEAD

git diff --check `
  341d8db354984786ec2ace000fabe40052ab2d55..HEAD

git status --short
```

Expected changed file:

```text
docs/task-packs/refactor-1c2a-lifecycle-maintenance-contract-test-scope.md
```

Tests are not run because this gate is docs/task-pack only.

## Commit and Review Lifecycle

Commit: `docs: define lifecycle maintenance contract test scope`.
Push the dedicated branch and open a draft PR. Do not merge or start 1C2B.

## Success Verdict

```text
REFACTOR-1C2A_LIFECYCLE_AND_MAINTENANCE_CONTRACT_TEST_SCOPE_READY_FOR_READ_ONLY_REVIEW
```
