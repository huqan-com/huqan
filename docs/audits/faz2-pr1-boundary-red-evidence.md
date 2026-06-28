# FAZ2-PR1 Boundary Red Evidence

**Audit date:** 2026-06-28
**Branch:** faz2/pr1-universal-mutation-boundary-tests
**Base HEAD:** c8e2237481ad864c8aa668e2544550946cc82ed7 (Merge PR #133 — fix/faz2-plugin-hash-portability)

---

## 1. PR Purpose

This PR establishes a permanent contract harness for the Universal Mutation Boundary.
It records, in executable test form, every confirmed gap between the current system's
write paths and the desired future invariant.

The harness is designed so that:

- Green tests pass against the current codebase without any implementation changes.
- Skipped/todo tests encode future invariants that later PRs (FAZ2-2 through FAZ2-7)
  will implement and un-skip.
- No test blesses current unsafe behavior as desired.

---

## 2. What This PR Does NOT Implement

- `kernel._commitMutation()` — the future single controlled write path.
- Any gate on background write paths (`_autoThinkTick`, `dream`, `selfEvolve`, `_crossLink`).
- Default-on `admissionRequired` for `kernel.learn()`.
- Admission gate enforcement in MCP `axiom.learn` execution.
- Plugin sandboxing (no direct `kernel.graph.addNode/addEdge`).
- CLI command mappings for currently ungated mutation commands.
- Shared kernel instance between MCP and REST/CLI.
- SQLite-backed persistent approval queue.
- `axiom.approve` or any approve-and-execute handler.

This PR is **tests and documentation only**.  Zero runtime files are modified.

---

## 3. Confirmed Gaps — F-001 through F-006

### F-001: Background Write Paths — Gateless and Auditless

All four background write paths call `graph.addEdge` directly with no admission gate
and no audit event.

| Path | File | Line | Call |
|------|------|------|------|
| `_autoThinkTick()` | `kernel.js` | 1582 | `this.graph.addEdge(h.from, h.to, rel)` |
| `dream(learnFromDream)` | `kernel.js` | 1671 | `this.graph.addEdge(h.from, h.to, rel)` |
| `selfEvolve()` | `kernel.js` | 2007 | `this.graph.addEdge(h.from, h.to, rel, { weight, source: 'kendilik' })` |
| `_crossLink()` | `kernel.js` | 1018 | `this.graph.addEdge(subject, object, 'benzer', { workspaceId })` |

None of these paths check `admissionRequired`, call any gate function, or emit an
audit event before writing.

**Contract test file:** `test/faz2-universal-mutation-boundary.contract.test.js`
Section: "FAZ2-PR1 contract: F-001 background write paths"

---

### F-002: Admission Gate Opt-In

The admission gate in `kernel.learn()` is opt-in: it only runs when the caller
explicitly passes `admissionRequired: true` (or related flags) in opts.

```
kernel.js:394
  opts.admissionRequired ||
  ...
```

The MCP execution path (`mcpServer.js:757`) calls `kernel.learn()` without
`admissionRequired`:

```javascript
// mcpServer.js:757
return kernel.learn(sanitizeMcpString(args.text, MCP_MAX_TEXT), {
  skipConflicts: args.skipConflicts !== false,
  maxSentences: args.maxSentences,
});
```

No `admissionRequired: true` is passed.  The gate does not run.

**Contract test file:** `test/faz2-universal-mutation-boundary.contract.test.js`
Section: "FAZ2-PR1 contract: F-002 admission gate opt-in"

---

### F-003: Plugin Direct Graph Writes

Signed plugins write directly to `kernel.graph` without going through any admission
layer or `_commitMutation` (which does not exist yet).

| Plugin | File | Lines | Calls |
|--------|------|-------|-------|
| `company-brain` | `plugins/company-brain.js` | 46–48 | `kernel.graph.addNode(fromId, ...)`, `kernel.graph.addNode(toId, ...)`, `kernel.graph.addEdge(...)` |
| `repo-memory` | `plugins/repo-memory.js` | 42–44 | `kernel.graph.addNode(fromId, ...)`, `kernel.graph.addNode(toId, ...)`, `kernel.graph.addEdge(...)` |

Additionally, `/api/ingest` → `lib/ingest.js` → `plugin.run()` is called without
an admission gate wrapping the plugin execution.

**Contract test file:** `test/faz2-universal-mutation-boundary.contract.test.js`
Section: "FAZ2-PR1 contract: F-003 plugin direct graph writes"

---

### F-004: CLI Mutation Gate Parity

`mapCliCommandToMcpTool()` (`cli.js:91-113`) returns `null` for mutation-bearing
commands, causing `_evaluateCliGate()` (`cli.js:587-589`) to short-circuit without
running any gate.

**Turkish normalization note:** `normalizeCommandText` (`cli.js:55-68`) folds
diacritics: `ö→o`, `ğ→g`, `ü→u`, `ı→i`, `ç→c`, `ş→s`.

Confirmed ungated mutation commands (verified live, commit c8e2237):

| CLI input | Normalized | mapCliCommandToMcpTool | Gate runs? |
|-----------|------------|------------------------|------------|
| `kaydet` | `kaydet` | `null` | No |
| `backup` | `backup` | `null` | No |
| `restore` | `restore` | `null` | No |
| `rüya` | `ruya` | `null` | No |
| `evolve` | `evolve` | `null` | No |
| `düşün` | `dusun` | `null` | No |
| `optimize` | `optimize` | `null` | No |
| `konsolide` | `konsolide` | `null` | No |
| `öğren` | `ogren` | `null` | No (alias missing; `ogret`=`öğret` is mapped) |

Commands that ARE gated today (for reference):

| CLI input | Normalized | Tool |
|-----------|------------|------|
| `öğret` | `ogret` | `axiom.learn` |
| `yükle` | `yukle` | `axiom.learn` |
| `sor` | `sor` | `axiom.ask` |
| `verify` | `verify` | `axiom.verify` |

**Contract test file:** `test/faz2-cli-gate-parity.contract.test.js`

---

### F-005: MCP Separate Kernel Instance

`mcpServer.js:432-437` (`createKernelFromEnv`) creates an independent `Kernel`
(or `KernelV2`) instance with `loadPlugins: false`:

```javascript
function createKernelFromEnv() {
  const opts = { ...buildKernelOptsFromEnv(), loadPlugins: false };
  if (process.env.AXIOM_KERNEL_VERSION === 'v2') {
    return new KernelV2(opts);
  }
  return new Kernel(opts);
}
```

This instance (used at `mcpServer.js:619`) has no shared in-process reference
with the CLI/REST kernel constructed in `server.js:33` via `new CLI({ kernel: kernelOpts })`.

State written via MCP is not visible to REST/CLI queries and vice versa, unless
both processes happen to use the same SQLite file on disk.  In-memory graph state
is never shared.

**Contract test file:** `test/faz2-mcp-approval-persistence.contract.test.js`
Section: "FAZ2-PR1 contract: F-005 MCP kernel isolation gap"

---

### F-006: MCP Pending Approvals In-Memory Only

`_pendingApprovals` is a plain module-level array (`mcpServer.js:678`):

```javascript
const _pendingApprovals = [];
```

Evidence:
- `mcpServer.js:701` — approvals pushed: `_pendingApprovals.push(approval)`.
- `mcpServer.js:781-783` — approvals served from memory in status response.
- No `axiom.approve` or `axiom.execute_approved` case exists in the `callTool`
  switch (`mcpServer.js:755`).
- No SQLite write for pending approvals exists anywhere in `mcpServer.js`.

On process restart all pending approvals are lost.  There is no handler to approve
and execute a queued mutation.

**Contract test file:** `test/faz2-mcp-approval-persistence.contract.test.js`
Section: "FAZ2-PR1 contract: F-006 in-memory approval persistence gap"

---

## 4. Future Universal Boundary Contract Design

```
kernel._commitMutation(mutation, context)
```

**Preconditions:**
- `context.provenance` must be non-null and valid (provenanceId, actor, timestamp, trustPolicyVersion).
- `mutation` must include `{ from, to, relation }` at minimum.

**Admission outcomes:**

| Outcome | Effect |
|---------|--------|
| `allow` | Calls `graph.addNode` / `graph.addEdge`; emits `MUTATION_ALLOWED` audit event. |
| `review` | Enqueues mutation to persistent (SQLite) approval queue; does NOT write graph; emits `MUTATION_QUEUED` audit event. |
| `reject` | Drops mutation; emits `MUTATION_REJECTED` audit event; does NOT write graph. |

**Invariant:** `graph.addNode` and `graph.addEdge` may only be called from
`_commitMutation`.  All other call sites (background paths, plugins, ingest) must
be refactored to go through `_commitMutation`.

**Default:** `admissionRequired` defaults to `true` in `kernel.learn()` once
FAZ2-3 is merged.  Callers may not bypass it without an explicit approved context.

---

## 5. Why Tests Are skip/todo Instead of Failing

Contract tests for future invariants use `it.skip(...)` rather than failing assertions because:

1. **The boundary does not exist yet.** Asserting `typeof k._commitMutation === 'function'`
   would fail today and block CI.  Skipping keeps the suite green while registering
   the requirement.

2. **Later PRs own the green signal.** FAZ2-2 through FAZ2-7 each target one gap.
   When a PR merges, the corresponding skip is removed and the test is expected to pass.
   This prevents "skip rot" — skips have explicit `[FAZ2-N]` prefixes and PR references.

3. **Red evidence is captured as passing gap-inventory tests.** The current unsafe behavior
   (e.g., `_evaluateCliGate('kaydet') === null`) is asserted as a FACT, not blessed as
   desired.  When FAZ2-5 closes the gap, these gap-inventory tests must be removed and
   the future-contract tests un-skipped.

---

## 6. How Later PRs Turn Each Contract Green

| Gap | PR | Action |
|-----|----|--------|
| F-001 (background paths) | FAZ2-2 | Add `_commitMutation`; refactor `_autoThinkTick`, `dream`, `selfEvolve`, `_crossLink` to call it. Remove skip from Section 2 of boundary contract test. |
| F-002 (admission opt-in) | FAZ2-3 | Default `admissionRequired: true` in `kernel.learn()`; pass it from MCP execution. Remove skip from Section 3. |
| F-003 (plugin direct writes) | FAZ2-4 | Refactor `company-brain.js` and `repo-memory.js` to call `kernel._commitMutation`; gate `plugin.run()` in ingest. Remove skip from Section 4. |
| F-004 (CLI gate parity) | FAZ2-5 | Extend `mapCliCommandToMcpTool` switch to cover all mutation commands; add `öğren` alias. Remove gap-inventory tests; un-skip future-contract tests. |
| F-005 (MCP kernel isolation) | FAZ2-6 | Inject shared kernel instance (or shared SQLite path + graph reload) so MCP and REST see same state. Remove skip from F-005 section. |
| F-006 (in-memory approvals) | FAZ2-7 | Replace `_pendingApprovals = []` with SQLite-backed queue; add `axiom.approve` handler. Remove skip from F-006 section. |

---

## 7. Baseline Preflight Evidence

**HEAD commit:** `c8e2237481ad864c8aa668e2544550946cc82ed7`
Merge pull request #133 from agiulucom42-del/fix/faz2-plugin-hash-portability

**npm test baseline (before this PR's files):**

```
# tests 1481
# suites 185
# pass 1465
# fail 0
# cancelled 0
# skipped 16
# todo 0
# duration_ms ~45700
```

**npm test after this PR (3 new test files added):**

```
# tests 1545   (+64 new tests across 3 files)
# pass 1499    (+34 green tests)
# fail 0       (unchanged)
# skipped 46   (+30 new skip/todo registrations)
# todo 0
```

(Exact counts may vary slightly by run order; 0 fail is the invariant.)

---

## 8. Forbidden Scope Confirmation

The following runtime files were NOT modified by this PR:

- `kernel.js` — no changes
- `server.js` — no changes
- `cli.js` — no changes
- `mcpServer.js` — no changes
- `graph.js` — no changes
- `plugin.js` — no changes
- `lib/*` — no changes
- `plugins/*` — no changes
- `package.json` — no changes
- `package-lock.json` — no changes

No runtime artifacts (`agent.memory.json`, `memory.json`, `memory.db`, log files)
are staged or committed.

**Changed files (this PR only):**

```
test/faz2-universal-mutation-boundary.contract.test.js   (new)
test/faz2-cli-gate-parity.contract.test.js               (new)
test/faz2-mcp-approval-persistence.contract.test.js      (new)
docs/audits/faz2-pr1-boundary-red-evidence.md            (new)
```
