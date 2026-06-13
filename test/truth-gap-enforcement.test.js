'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { callTool, createKernelFromEnv } = require('../mcpServer');
const { evaluateMcpGate, MCP_GATE_DECISIONS } = require('../lib/mcp-gate-adapter');

function mockKernel() {
  return {
    learn() { return { ok: true, data: { learned: 1, skipped: 0, conflicts: [], alternatives: [] } }; },
    ask() { return { ok: true, data: { answer: 'mock' } }; },
    verify() { return { ok: true, data: { status: 'dogrulandi', confidence: 1 } }; },
  };
}

test('truth-gap-enforcement: read action allows execution', () => {
  const result = evaluateMcpGate({ tool: 'axiom.verify', args: { input: 'test' }, metadata: {} });
  assert.equal(result.allowed, true, 'Read action must be allowed');
  assert.equal(result.canExecute, true, 'Read action must be executable');
});

test('truth-gap-enforcement: write action (review) blocks execution', () => {
  const result = evaluateMcpGate({ tool: 'axiom.learn', args: { text: 'test' }, metadata: {} });
  assert.equal(result.allowed, false, 'Write action must not be allowed');
  assert.equal(result.canExecute, false, 'Write action must not be executable');
  assert.equal(result.canDryRun, true, 'Write action must support dry run');
});

test('truth-gap-enforcement: agent loop (dry_run_only) blocks execution', () => {
  const result = evaluateMcpGate({ tool: 'axiom.agent', args: { input: 'test' }, metadata: {} });
  assert.equal(result.allowed, false, 'Agent action must not be allowed');
  assert.equal(result.canExecute, false, 'Agent action must not be executable');
  assert.equal(result.canDryRun, true, 'Agent action must support dry run');
});

test('truth-gap-enforcement: unknown tool blocked', () => {
  const result = evaluateMcpGate({ tool: 'unknown.tool', args: {}, metadata: {} });
  assert.equal(result.allowed, false, 'Unknown tool must be blocked');
  assert.equal(result.canExecute, false, 'Unknown tool must not be executable');
  assert.equal(result.canDryRun, false, 'Unknown tool must not support dry run');
});

test('truth-gap-enforcement: callTool blocks non-executable actions', () => {
  const kernel = mockKernel();
  const result = callTool(kernel, { name: 'axiom.learn', arguments: { text: 'test' } });
  assert.equal(result.ok, false, 'Blocked tool must return ok=false');
  assert.ok(result.gate, 'Blocked tool must include gate metadata');
  assert.equal(result.gate.canExecute, false, 'Gate must report canExecute=false');
  assert.ok(result.message, 'Blocked tool must include message');
});

// CURRENT GAP: no dry-run execution path
test('truth-gap-enforcement: dry_run_only tool has no dry-run execution path', () => {
  const kernel = mockKernel();
  // callTool with axiom.agent returns gate block, not dry-run simulation
  const result = callTool(kernel, { name: 'axiom.agent', arguments: { input: 'test' } });
  assert.equal(result.ok, false, 'agent tool must be blocked');
  // TODO(PR-TRUTH-3): When dry-run is implemented, canDryRun=true should produce
  // a simulated result instead of a block error.
  assert.equal(result.gate.canDryRun, true, 'Gate must support dry run');
  console.log('  [GAP] dry_run_only tool returns block, not dry-run simulation');
});

// CURRENT GAP: no approval queue
test('truth-gap-enforcement: no persistent approval queue for review actions', () => {
  const kernel = mockKernel();
  const result = callTool(kernel, { name: 'axiom.learn', arguments: { text: 'test' } });
  assert.equal(result.ok, false, 'review tool must be blocked');
  // The action is blocked but NOT stored in an approval queue.
  // TODO(PR-TRUTH-3): When approval queue is implemented, check approvals endpoint.
  console.log('  [GAP] review action is blocked but not queued for later approval');
});
