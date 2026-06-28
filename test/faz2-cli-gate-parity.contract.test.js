'use strict';
/**
 * FAZ2-PR1 — CLI Gate Parity Contract Tests (F-004)
 *
 * Documents the gap where CLI mutation commands bypass the MCP admission gate
 * because mapCliCommandToMcpTool() returns null for mutation-bearing commands.
 *
 * Current confirmed ungated mutation commands (normalizeCommandText applied):
 *   kaydet, backup, restore, rüya, evolve, düşün, optimize, konsolide
 *   öğren (normalizes to 'ogren' — not in switch; 'ogret' IS mapped but is
 *          the imperative form meaning "teach"; 'öğren' meaning "learn" is not)
 *
 * Note: yükle (normalizes to 'yukle') IS mapped to axiom.learn, so it IS gated.
 * That is an existing partial fix, documented here for completeness.
 *
 * Current behaviour (UNSAFE for ungated set, NOT BLESSED):
 *   _evaluateCliGate(command) → calls mapCliCommandToMcpTool(command)
 *   → returns null for ungated commands → gate branch short-circuits → no gate run
 *
 * Future invariant (FAZ2-5):
 *   Every CLI command that can mutate graph state must be mapped to an MCP tool
 *   (or a synthetic gate key) so that _evaluateCliGate never returns null for
 *   mutation-bearing commands.
 *
 * Evidence:
 *   cli.js:55-68  — normalizeCommandText (Turkish char folding)
 *   cli.js:91-113 — mapCliCommandToMcpTool switch (missing kaydet, backup,
 *                   restore, rüya, evolve, düşün, optimize, konsolide, öğren)
 *   cli.js:587-589 — _evaluateCliGate early-return when tool===null
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const CLI = require('../cli');
const Kernel = require('../kernel');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeCLI() {
  const kernel = new Kernel({ noLoad: true, useSQLite: false, loadPlugins: false });
  const cli = new CLI({ kernelInstance: kernel });
  return cli;
}

/**
 * Mutation-bearing CLI commands confirmed to return null from _evaluateCliGate
 * today (verified against live codebase 2026-06-28, commit c8e2237).
 *
 * Normalization note: Turkish chars folded via normalizeCommandText.
 *   'öğren' → 'ogren' — NOT in switch (only 'ogret' = öğret is mapped)
 *   'rüya'  → 'ruya'  — NOT in switch
 *   'düşün' → 'dusun' — NOT in switch
 */
const UNGATED_MUTATION_COMMANDS = [
  'kaydet',
  'backup',
  'restore',
  'rüya',
  'evolve',
  'düşün',
  'optimize',
  'konsolide',
];

/**
 * Commands that ARE mapped today (mapCliCommandToMcpTool returns non-null).
 * These must stay gated.
 */
const GATED_COMMANDS = [
  { command: 'öğret',  expectedTool: 'axiom.learn' }, // normalizes to 'ogret'
  { command: 'yükle',  expectedTool: 'axiom.learn' }, // normalizes to 'yukle'
  { command: 'sor',    expectedTool: 'axiom.ask'   },
  { command: 'verify', expectedTool: 'axiom.verify' },
];

// ---------------------------------------------------------------------------
// SECTION 1: Harness sanity
// ---------------------------------------------------------------------------
describe('FAZ2-PR1 contract: F-004 CLI gate parity — harness', () => {
  it('CLI class loads without error', () => {
    assert.ok(typeof CLI === 'function', 'CLI must be a constructor');
  });

  it('CLI instantiates with a fresh kernel', () => {
    const cli = makeCLI();
    assert.ok(cli.kernel, 'cli.kernel must exist');
  });

  it('_evaluateCliGate method exists on CLI prototype', () => {
    const cli = makeCLI();
    assert.strictEqual(
      typeof cli._evaluateCliGate,
      'function',
      '_evaluateCliGate must be a function'
    );
  });

  it('normalisation folds Turkish chars (oğren vs öğret parity gap confirmation)', () => {
    // öğren → ogren (NOT in switch) vs öğret → ogret (IS in switch)
    // This confirms the F-004 gap: the learn-alias 'öğren' is unmapped.
    const cli = makeCLI();
    const learnAlias   = cli._evaluateCliGate('öğren', '');   // ogren → null
    const teachCommand = cli._evaluateCliGate('öğret', '');   // ogret → axiom.learn
    assert.strictEqual(learnAlias, null,
      "'öğren' (learn alias) must return null — unmapped in switch (F-004 gap)");
    assert.notStrictEqual(teachCommand, null,
      "'öğret' (teach command) must be gated — mapped to axiom.learn");
  });
});

// ---------------------------------------------------------------------------
// SECTION 2: Current gap inventory — document null returns (not blessing them)
// ---------------------------------------------------------------------------
describe('FAZ2-PR1 contract: F-004 ungated mutation command inventory', () => {
  /**
   * For each mutation-bearing command confirmed ungated, assert that
   * _evaluateCliGate currently returns null.  These tests are RED evidence;
   * they document the gap without asserting it is desired.
   *
   * When FAZ2-5 maps these commands, these assertions will need to be REMOVED
   * and replaced with the skip-lifted tests in SECTION 4.
   */
  for (const cmd of UNGATED_MUTATION_COMMANDS) {
    it(`current gap: _evaluateCliGate('${cmd}') returns null (no gate runs today)`, () => {
      const cli = makeCLI();
      const result = cli._evaluateCliGate(cmd, '');
      assert.strictEqual(
        result,
        null,
        `_evaluateCliGate('${cmd}') must return null today — confirming F-004 gap`
      );
    });
  }
});

// ---------------------------------------------------------------------------
// SECTION 3: Currently gated commands — must stay gated
// ---------------------------------------------------------------------------
describe('FAZ2-PR1 contract: F-004 currently gated commands stay gated', () => {
  for (const { command, expectedTool } of GATED_COMMANDS) {
    it(`_evaluateCliGate('${command}') returns a gate result (tool: ${expectedTool})`, () => {
      const cli = makeCLI();
      const result = cli._evaluateCliGate(command, 'test value');
      assert.notStrictEqual(
        result,
        null,
        `_evaluateCliGate('${command}') must not return null — gate must run for ${expectedTool}`
      );
    });
  }
});

// ---------------------------------------------------------------------------
// SECTION 4: Future contract — mutation commands must be gated (FAZ2-5)
// ---------------------------------------------------------------------------
describe('FAZ2-PR1 contract: F-004 future — mutation commands gated', () => {
  for (const cmd of UNGATED_MUTATION_COMMANDS) {
    it.skip(
      `[FAZ2-5] _evaluateCliGate('${cmd}') must return a gate result, not null`,
      // Reason: mapCliCommandToMcpTool returns null for this command today.
      // FAZ2-5 will add mappings or synthetic gate keys for all mutation-bearing
      // CLI commands so that _evaluateCliGate never short-circuits.
      () => {
        const cli = makeCLI();
        const result = cli._evaluateCliGate(cmd, '');
        assert.notStrictEqual(result, null,
          `gate must run for mutation command '${cmd}' after FAZ2-5`);
      }
    );
  }

  it.skip(
    "[FAZ2-5] 'öğren' alias must be mapped so _evaluateCliGate returns a gate result",
    // Source evidence: cli.js:93-112 — 'ogret' is mapped but 'ogren' is not.
    // 'öğren' (the user-facing learn alias) normalizes to 'ogren' → returns null.
    () => {
      const cli = makeCLI();
      const result = cli._evaluateCliGate('öğren', '');
      assert.notStrictEqual(result, null, "'öğren' alias must be gated after FAZ2-5");
    }
  );

  it.skip(
    '[FAZ2-5] mapCliCommandToMcpTool must return a non-null key for all mutation commands',
    // Source evidence: cli.js:110-112 — default: return null.
    () => {
      throw new Error('FAZ2-5 not yet merged');
    }
  );
});
