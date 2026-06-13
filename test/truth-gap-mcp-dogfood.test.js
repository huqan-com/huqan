'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('truth-gap-mcp-dogfood: MCP server exists', () => {
  const exists = fs.existsSync(path.join(__dirname, '..', 'mcpServer.js'));
  assert.equal(exists, true, 'mcpServer.js must exist');
});

test('truth-gap-mcp-dogfood: MCP gate adapter exists and exports required functions', () => {
  const adapter = require('../lib/mcp-gate-adapter');
  assert.ok(adapter.evaluateMcpGate, 'evaluateMcpGate must exist');
  assert.ok(adapter.normalizeMcpToolInput, 'normalizeMcpToolInput must exist');
  assert.ok(adapter.classifyMcpTool, 'classifyMcpTool must exist');
  assert.ok(adapter.mergeMcpDecisions, 'mergeMcpDecisions must exist');
  assert.ok(adapter.MCP_TOOL_CLASSIFICATIONS, 'MCP_TOOL_CLASSIFICATIONS must exist');
  assert.ok(adapter.MCP_GATE_DECISIONS, 'MCP_GATE_DECISIONS must exist');
});

test('truth-gap-mcp-dogfood: 10 MCP tools classified', () => {
  const adapter = require('../lib/mcp-gate-adapter');
  const classifications = adapter.MCP_TOOL_CLASSIFICATIONS;
  const toolCount = Object.keys(classifications).length;
  assert.equal(toolCount, 10, 'Must have exactly 10 MCP tools');
  assert.ok(classifications['axiom.learn'], 'axiom.learn must be classified');
  assert.ok(classifications['axiom.verify'], 'axiom.verify must be classified');
});

// CURRENT GAP: No verified dogfood client
test('truth-gap-mcp-dogfood: no MCP client configuration found', () => {
  const searchPaths = [
    path.join(__dirname, '..', 'mcp-client.js'),
    path.join(__dirname, '..', 'mcp-client'),
    path.join(__dirname, '..', '.mcp-client.json'),
    path.join(__dirname, '..', '.claude.json'),
    path.join(__dirname, '..', '.cursor.json'),
  ];
  for (const p of searchPaths) {
    assert.equal(fs.existsSync(p), false, `MCP client config must not exist: ${p}`);
  }
  // TODO(PR-TRUTH-4): After dogfood harness is built, this test must be updated
  // to assert that a client config DOES exist.
  console.log('  [GAP] No MCP client config found. Dogfood does not exist.');
});

test('truth-gap-mcp-dogfood: no automated dogfood integration test found', () => {
  const testDir = path.join(__dirname);
  const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.js') && f !== 'truth-gap-mcp-dogfood.test.js');
  const dogfoodTests = files.filter(f =>
    f.includes('dogfood') || f.includes('agent-mcp') || f.includes('mcp-client') || f.includes('mcp-integration'));
  assert.equal(dogfoodTests.length, 0,
    'No dogfood integration test found — no agent goes through MCP for trust decisions');
  // TODO(PR-TRUTH-4): After dogfood harness, this test should find an integration test.
  console.log('  [GAP] No dogfood integration test. MCP server is exposed but unused.');
});

test('truth-gap-mcp-dogfood: cli.js bypasses gate adapter', () => {
  const cliCode = fs.readFileSync(path.join(__dirname, '..', 'cli.js'), 'utf8');
  const hasGateRef = cliCode.includes('evaluateMcpGate') || cliCode.includes('gate');
  assert.equal(hasGateRef, false,
    'CLI must bypass gate — dogfood gap');
  // TODO(PR-TRUTH-4): CLI should optionally route through MCP gate.
  console.log('  [GAP] CLI bypasses gate entirely. Trust layer only available via MCP.');
});
